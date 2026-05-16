define([
  'jquery',
  'obitech-framework/jsx',
  'obitech-reportservices/data',
  'obitech-application/gadgets',
  'obitech-application/extendable-ui-definitions',
  'obitech-report/gadgetdialog',
  'knockout',
  'obitech-report/datavisualization',
  'obitech-legend/legendandvizcontainer',
  'obitech-reportservices/datamodelshapes',
  'd3js',
  'obitech-reportservices/events',
  'obitech-reportservices/interactionservice',
  'obitech-reportservices/markingservice',
  'obitech-appservices/logger',
  'ojL10n!com-company-decompTree/nls/messages',
  'obitech-framework/messageformat',
  'css!com-company-decompTree/decompTreestyles'
], function(
  $, jsx, data, gadgets, euidef, gadgetdialog, ko, dataviz,
  legendandvizcontainer, datamodelshapes, d3, events, interactions, marking, logger, messages
) {
  'use strict';

  var MODULE_NAME = 'com-company-decompTree/decompTree';
  jsx.assertAllNotNullExceptLastN(arguments, 'decompTree.js arguments', 2);
  var _logger = new logger.Logger(MODULE_NAME);

  var DEFAULTS = {
    columnWidth: 220,
    columnGap: 80,
    nodeHeight: 36,
    nodeGap: 8,
    barHeight: 14,
    showValues: true,
    labelPosition: 'top',     // 'top' | 'inside'
    headerBandHeight: 50,
    barColor: '#4A90E2',
    labelColor: 'auto'        // 'auto' = derive from background luminance, else hex
  };

  // Walks up the DOM from el to find the first ancestor with a non-transparent
  // backgroundColor; returns a dark or light text color based on its luminance.
  // OAC's Style → Background panel sets a backgroundColor on the viz container,
  // but does NOT update `color`, so `currentColor` keeps inheriting the theme
  // (often dark) and text vanishes on a custom-dark background.
  function detectThemeTextColor(el) {
    try {
      var node = el;
      while (node && node !== document.documentElement) {
        var bg = window.getComputedStyle(node).backgroundColor;
        var m = bg && bg.match(/\d+(?:\.\d+)?/g);
        if (m && m.length >= 3 && (m.length < 4 || parseFloat(m[3]) > 0)) {
          var lum = (0.299 * +m[0] + 0.587 * +m[1] + 0.114 * +m[2]) / 255;
          return lum > 0.5 ? '#333' : '#E8E8E8';
        }
        node = node.parentElement;
      }
      var bodyColor = window.getComputedStyle(document.body).color;
      if (bodyColor && bodyColor !== 'rgba(0, 0, 0, 0)' && bodyColor !== 'transparent') return bodyColor;
    } catch (e) { /* ignore */ }
    return '#333';
  }

  function pickContrastFill(barColor) {
    var hex = String(barColor || '').replace('#', '');
    if (hex.length === 3) hex = hex.split('').map(function(c){ return c + c; }).join('');
    if (hex.length !== 6) return '#FFF';
    var r = parseInt(hex.substr(0, 2), 16);
    var g = parseInt(hex.substr(2, 2), 16);
    var b = parseInt(hex.substr(4, 2), 16);
    if (isNaN(r) || isNaN(g) || isNaN(b)) return '#FFF';
    var lum = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
    return lum > 0.6 ? '#222' : '#FFF';
  }

  var decompTree = {};

  DecompTree.VERSION = '1.0.0';

  function DecompTree(sID, sDisplayName, sOrigin, sVersion) {
    DecompTree.baseConstructor.call(this, sID, sDisplayName, sOrigin, sVersion);

    this.Config = {
      columnWidth:   DEFAULTS.columnWidth,
      nodeHeight:    DEFAULTS.nodeHeight,
      barHeight:     DEFAULTS.barHeight,
      showValues:    DEFAULTS.showValues,
      labelPosition: DEFAULTS.labelPosition,
      barColor:      DEFAULTS.barColor,
      labelColor:    DEFAULTS.labelColor,
      labelColorMode:'auto',
      labelColorPick:'#E8E8E8',
      // Drilldown state (selectedPath + levelDimMap)
      drillState:    { selectedPath: [], levelDimMap: [], userCleared: false }
    };

    var self = this;
    this._saveSettings = function() {
      try {
        this.getSettings().setViewConfigJSON(dataviz.SettingsNS.CHART, this.Config);
      } catch (e) { _logger.error('saveSettings failed', e); }
    };

    this.loadConfig = function() {
      try {
        var conf = this.getSettings().getViewConfigJSON(dataviz.SettingsNS.CHART) || {};
        if (typeof conf.columnWidth   === 'number')  this.Config.columnWidth   = conf.columnWidth;
        if (typeof conf.nodeHeight    === 'number')  this.Config.nodeHeight    = conf.nodeHeight;
        if (typeof conf.barHeight     === 'number')  this.Config.barHeight     = conf.barHeight;
        if (typeof conf.showValues    === 'boolean') this.Config.showValues    = conf.showValues;
        if (typeof conf.labelPosition === 'string')  this.Config.labelPosition = conf.labelPosition;
        if (typeof conf.barColor      === 'string')  this.Config.barColor      = conf.barColor;
        if (typeof conf.labelColor    === 'string')  this.Config.labelColor    = conf.labelColor;
        if (typeof conf.labelColorMode === 'string') this.Config.labelColorMode = conf.labelColorMode;
        if (typeof conf.labelColorPick === 'string') this.Config.labelColorPick = conf.labelColorPick;
        if (conf.drillState && typeof conf.drillState === 'object') {
          this.Config.drillState = {
            selectedPath: Array.isArray(conf.drillState.selectedPath) ? conf.drillState.selectedPath : [],
            levelDimMap:  Array.isArray(conf.drillState.levelDimMap)  ? conf.drillState.levelDimMap  : [],
            userCleared:  !!conf.drillState.userCleared
          };
        }
      } catch (e) { _logger.error('loadConfig failed', e); }
    };
  }
  jsx.extend(DecompTree, dataviz.DataVisualization);
  decompTree.DecompTree = DecompTree;

  decompTree.createClientComponent = function(sID, sDisplayName, sOrigin) {
    return new DecompTree(sID, sDisplayName, sOrigin, DecompTree.VERSION);
  };

  // ---- Data extraction -----------------------------------------------------
  // Each row carries its _rowIdx so we can re-find it for marking later.
  function extractRows(viz, ctx) {
    var empty = { rows: [], dimNames: [], measureName: '', oDataLayout: null };
    if (!ctx) return empty;
    var oDataLayout = ctx.get(dataviz.DataContextProperty.DATA_LAYOUT);
    if (!oDataLayout) return empty;

    var P = datamodelshapes.Physical;
    var nRows = oDataLayout.getEdgeExtent(P.ROW) || 0;
    var nRowLayers = oDataLayout.getLayerCount(P.ROW) || 0;
    var nColLayers = oDataLayout.getLayerCount(P.COLUMN) || 0;

    function isMeasureLabelsLayer(eEdge, nLayer) {
      return oDataLayout.getLayerMetadata(eEdge, nLayer, data.LayerMetadata.LAYER_ISMEASURE_LABELS);
    }

    var dimLayers = [], dimNames = [];
    for (var L = 0; L < nRowLayers; L++) {
      if (isMeasureLabelsLayer(P.ROW, L)) continue;
      dimLayers.push(L);
      dimNames.push(oDataLayout.getLayerMetadata(P.ROW, L, data.LayerMetadata.LAYER_DISPLAY_NAME) || ('Dim ' + L));
    }

    // Measure name: prefer measure-labels layer on COLUMN; else data-model column display name
    var measureName = '';
    for (var C = 0; C < nColLayers; C++) {
      if (isMeasureLabelsLayer(P.COLUMN, C)) {
        measureName = oDataLayout.getValue(P.COLUMN, C, 0, false) || '';
        break;
      }
    }
    if (!measureName) {
      try {
        var dm = viz.getRootDataModel && viz.getRootDataModel();
        if (dm) {
          var dataIds = dm.getColumnIDsIn(P.DATA) || [];
          if (dataIds.length) {
            var info = dm.getColumnInfo && dm.getColumnInfo(dataIds[0]);
            if (info && info.getDisplayName) measureName = info.getDisplayName() || '';
            if (!measureName && info && info.sDisplayName) measureName = info.sDisplayName;
            if (!measureName) measureName = String(dataIds[0]).split('.').pop();
          }
        }
      } catch (e) { /* swallow */ }
    }

    var rows = [];
    for (var r = 0; r < nRows; r++) {
      var dims = [];
      for (var i = 0; i < dimLayers.length; i++) {
        dims.push(oDataLayout.getValue(P.ROW, dimLayers[i], r, false));
      }
      var raw = oDataLayout.getValue(P.DATA, r, 0, false);
      var n = (raw === null || raw === undefined || raw === '') ? null : Number(raw);
      rows.push({ dims: dims, measure: (isNaN(n) ? null : n), _rowIdx: r });
    }
    return { rows: rows, dimNames: dimNames, measureName: measureName, oDataLayout: oDataLayout };
  }

  // ---- Marking -------------------------------------------------------------
  // Returns the list of physical row indices that match `selectedPath`.
  function rowsMatchingPath(info, selectedPath) {
    if (!selectedPath || !selectedPath.length) return [];
    var out = [];
    for (var i = 0; i < info.rows.length; i++) {
      var r = info.rows[i], ok = true;
      for (var j = 0; j < selectedPath.length; j++) {
        if (r.dims[selectedPath[j].dimIdx] !== selectedPath[j].value) { ok = false; break; }
      }
      if (ok) out.push(r._rowIdx);
    }
    return out;
  }

  // ---- Aggregation --------------------------------------------------------
  function aggregate(info, selectedPath, dimIdx) {
    var filtered = info.rows;
    if (selectedPath && selectedPath.length) {
      filtered = filtered.filter(function(r) {
        for (var i = 0; i < selectedPath.length; i++) {
          if (r.dims[selectedPath[i].dimIdx] !== selectedPath[i].value) return false;
        }
        return true;
      });
    }
    var total = 0, groups = {};
    for (var i = 0; i < filtered.length; i++) {
      var r = filtered[i];
      var v = (typeof r.measure === 'number') ? r.measure : 0;
      total += v;
      if (typeof dimIdx === 'number') {
        var k = r.dims[dimIdx];
        groups[k] = (groups[k] || 0) + v;
      }
    }
    var children = [];
    if (typeof dimIdx === 'number') {
      for (var k2 in groups) {
        if (Object.prototype.hasOwnProperty.call(groups, k2)) {
          children.push({ value: k2, measure: groups[k2] });
        }
      }
      children.sort(function(a, b) { return b.measure - a.measure; });
    }
    return { total: total, children: children };
  }

  function formatNum(n) {
    if (n == null || isNaN(n)) return '';
    var abs = Math.abs(n);
    if (abs >= 1e9) return (n / 1e9).toFixed(1) + 'B';
    if (abs >= 1e6) return (n / 1e6).toFixed(1) + 'M';
    if (abs >= 1e3) return (n / 1e3).toFixed(1) + 'K';
    return (Math.round(n * 100) / 100).toString();
  }

  // ---- Dim picker (HTML overlay) ------------------------------------------
  function closePicker($root) {
    $root.find('.decomp-picker').remove();
    $(document).off('mousedown.decompPicker');
  }

  function openPicker($root, anchorX, anchorY, options, onPick) {
    closePicker($root);
    var $picker = $('<div class="decomp-picker"></div>')
      .css({ left: anchorX + 'px', top: anchorY + 'px' });
    options.forEach(function(opt) {
      $('<div class="decomp-picker-item"></div>')
        .text(opt.label)
        .on('mousedown', function(e) {
          e.preventDefault();
          e.stopPropagation();
          closePicker($root);
          onPick(opt.value);
        })
        .appendTo($picker);
    });
    $picker.appendTo($root);
    // Clamp inside container bounds (account for picker dimensions after layout)
    var pw = $picker.outerWidth() || 160;
    var ph = $picker.outerHeight() || 100;
    var cw = $root.innerWidth();
    var ch = $root.innerHeight();
    var left = parseInt($picker.css('left'), 10);
    var top  = parseInt($picker.css('top'), 10);
    if (left + pw > cw - 4) left = Math.max(4, cw - pw - 4);
    if (top  + ph > ch - 4) top  = Math.max(4, ch - ph - 4);
    $picker.css({ left: left + 'px', top: top + 'px' });
    // Close on outside click
    setTimeout(function() {
      $(document).on('mousedown.decompPicker', function(e) {
        if (!$(e.target).closest('.decomp-picker').length) closePicker($root);
      });
    }, 0);
  }

  // ---- Render --------------------------------------------------------------
  DecompTree.prototype._render = function(ctx) {
    try {
      var viz = this;

      if (!viz._configLoaded) {
        viz.loadConfig();
        viz._configLoaded = true;
      }

      var rootEl = (viz.getContainerElem && viz.getContainerElem())
        || (viz.getRootElement && viz.getRootElement());
      if (!rootEl) return;
      var $root = $(rootEl).empty().addClass('decomp-root');
      closePicker($root);

      // Label color: user override (hex) wins; 'auto' samples the background
      // and picks light/dark. OAC's Style → Background doesn't always apply as
      // a CSS backgroundColor we can sample, so explicit override is the
      // reliable fallback.
      var labelCfg = viz.Config.labelColor || DEFAULTS.labelColor;
      var THEME_FILL = (labelCfg && labelCfg !== 'auto' && /^#?[0-9A-Fa-f]{3,8}$/.test(labelCfg.replace('#','')))
        ? (labelCfg.charAt(0) === '#' ? labelCfg : ('#' + labelCfg))
        : detectThemeTextColor(rootEl);
      $root.css('color', THEME_FILL);

      var info  = extractRows(viz, ctx);
      var state = viz.Config.drillState;

      if (!info.dimNames.length || !info.rows.length) {
        $('<div class="decomp-empty"></div>')
          .text((messages && messages.DECOMPTREE_NO_DATA) || 'Drop dimensions into Explain by and a measure into Analyze to begin.')
          .appendTo($root);
        return;
      }

      // Sanitize against current dim count
      var nDims = info.dimNames.length;
      state.selectedPath = (state.selectedPath || []).filter(function(s) { return s.dimIdx < nDims; });
      state.levelDimMap  = (state.levelDimMap  || []).filter(function(d) { return d < nDims; });

      // Resilience against external filters: trim selectedPath at the first
      // level whose value has no matching rows in the (possibly filtered) data.
      var validPath = [];
      for (var pi = 0; pi < state.selectedPath.length; pi++) {
        var testPath = validPath.concat([state.selectedPath[pi]]);
        var anyMatch = info.rows.some(function(r) {
          for (var j = 0; j < testPath.length; j++) {
            if (r.dims[testPath[j].dimIdx] !== testPath[j].value) return false;
          }
          return true;
        });
        if (anyMatch) validPath.push(state.selectedPath[pi]);
        else break;
      }
      if (validPath.length !== state.selectedPath.length) {
        state.selectedPath = validPath;
        state.levelDimMap = state.levelDimMap.slice(0, validPath.length + 1);
        viz._saveSettings();
      }
      viz._lastInfo = info;

      function nextUnusedDim() {
        var used = {};
        state.selectedPath.forEach(function(s){ used[s.dimIdx] = true; });
        state.levelDimMap.forEach(function(d){ used[d] = true; });
        for (var i = 0; i < nDims; i++) if (!used[i]) return i;
        return null;
      }
      function unusedDims() {
        var used = {};
        state.selectedPath.forEach(function(s){ used[s.dimIdx] = true; });
        state.levelDimMap.forEach(function(d){ used[d] = true; });
        var out = [];
        for (var i = 0; i < nDims; i++) if (!used[i]) out.push(i);
        return out;
      }
      // Auto-pick a first breakdown dim ONLY on initial drop (never had a path).
      // After the user explicitly closes back to Total, leave levelDimMap empty
      // so Total becomes a clickable picker for the next dim.
      if (!state.levelDimMap.length && !state.userCleared) {
        var d0 = nextUnusedDim();
        if (d0 !== null) state.levelDimMap = [d0];
      }

      // Pull settings (instance Config wins over module DEFAULTS)
      var NODE_H  = viz.Config.nodeHeight   || DEFAULTS.nodeHeight;
      var BAR_H   = Math.min(viz.Config.barHeight || DEFAULTS.barHeight, NODE_H - 4);
      var NODE_G  = DEFAULTS.nodeGap;
      var HEAD_H  = DEFAULTS.headerBandHeight;
      var LABEL_TOP = (viz.Config.labelPosition || DEFAULTS.labelPosition) === 'top';
      var SHOW_VAL  = !!viz.Config.showValues;
      var BAR_COLOR = viz.Config.barColor || DEFAULTS.barColor;
      var CONTRAST  = pickContrastFill(BAR_COLOR);
      var PAD_X = 16;

      // Build columns
      var columns = [];
      columns.push({ title: 'Total', subtitle: info.measureName || '', dimIdx: null, agg: aggregate(info, [], null), selectedValue: null });
      for (var lvl = 0; lvl < state.levelDimMap.length; lvl++) {
        var dimIdx = state.levelDimMap[lvl];
        var pathPrefix = state.selectedPath.slice(0, lvl);
        var agg = aggregate(info, pathPrefix, dimIdx);
        var sel = (state.selectedPath[lvl] && state.selectedPath[lvl].dimIdx === dimIdx)
          ? state.selectedPath[lvl].value : null;
        columns.push({ title: info.dimNames[dimIdx], subtitle: (sel !== null ? String(sel) : ''), dimIdx: dimIdx, agg: agg, selectedValue: sel });
      }

      var width  = $root.width()  || 400;
      var height = $root.height() || 300;

      // Adaptive column width/gap: try to fit user's preferred width, but shrink
      // toward a min if the container is narrower. Only scroll horizontally as a
      // last resort when even the min layout doesn't fit.
      var userColW = viz.Config.columnWidth || DEFAULTS.columnWidth;
      var userGap  = DEFAULTS.columnGap;
      var minColW = 110;
      var minGap  = 24;
      var nCols   = columns.length;
      var avail   = width - 2 * PAD_X;
      var preferredTotal = nCols * userColW + (nCols - 1) * userGap;
      var COL_W, COL_GAP;
      if (preferredTotal <= avail) {
        COL_W = userColW;
        COL_GAP = userGap;
      } else {
        // Shrink between user value and min, proportionally
        var minTotal = nCols * minColW + (nCols - 1) * minGap;
        if (minTotal <= avail) {
          // Solve: nCols*W + (nCols-1)*G = avail, with W/G in proportion to user values
          var ratio = (avail - (nCols - 1) * minGap) / (nCols * userColW);
          COL_W = Math.max(minColW, Math.floor(userColW * Math.min(1, ratio)));
          COL_GAP = Math.max(minGap, Math.floor((avail - nCols * COL_W) / Math.max(1, nCols - 1)));
        } else {
          COL_W = minColW;
          COL_GAP = minGap;
        }
      }

      var svgW = Math.max(width, nCols * COL_W + (nCols - 1) * COL_GAP + 2 * PAD_X);
      var svgH = Math.max(height, HEAD_H + 20 + Math.max.apply(null, columns.map(function(c){
        var n = c.dimIdx === null ? 1 : Math.max(c.agg.children.length, 1);
        return n * (NODE_H + NODE_G);
      })) + 20);

      var svg = d3.select(rootEl).append('svg')
        .attr('width', svgW)
        .attr('height', svgH);

      function colX(i) { return PAD_X + i * (COL_W + COL_GAP); }

      function swapColumnDim(ci, newDimIdx) {
        var lvlIdx = ci - 1;
        if (lvlIdx < 0) return;
        state.levelDimMap[lvlIdx] = newDimIdx;
        // If the existing selection at this level used the old dim, drop it
        // (and everything after) — the new dim's values are different.
        if (state.selectedPath[lvlIdx]) {
          state.selectedPath = state.selectedPath.slice(0, lvlIdx);
        }
        viz._saveSettings();
        applyMarking();
        rerender();
      }

      function openColumnDimPicker(ci, anchorX, anchorY) {
        var lvlIdx = ci - 1;
        if (lvlIdx < 0) return;
        var currentDim = state.levelDimMap[lvlIdx];
        var used = {};
        state.selectedPath.forEach(function(s){ used[s.dimIdx] = true; });
        state.levelDimMap.forEach(function(d, idx){ if (idx !== lvlIdx) used[d] = true; });
        var opts = [];
        for (var di = 0; di < info.dimNames.length; di++) {
          if (used[di] && di !== currentDim) continue;
          opts.push({ value: di, label: info.dimNames[di] + (di === currentDim ? '  ✓' : '') });
        }
        if (opts.length <= 1) return;
        openPicker($root, anchorX, anchorY, opts, function(dimIdx) {
          if (dimIdx === currentDim) return;
          swapColumnDim(ci, dimIdx);
        });
      }

      // Headers
      columns.forEach(function(col, i) {
        var x = colX(i);

        // Header background hit area for right-click dim swap (non-root only)
        if (col.dimIdx !== null) {
          svg.append('rect')
            .attr('class', 'decomp-header-hit')
            .attr('x', x - 2).attr('y', 2)
            .attr('width', COL_W).attr('height', HEAD_H - 10)
            .attr('fill', 'transparent')
            .style('pointer-events', 'all')
            .style('cursor', 'context-menu')
            .on('contextmenu', function() {
              if (d3.event) { d3.event.preventDefault(); d3.event.stopPropagation(); }
              var px = (d3.event && d3.event.offsetX) ? d3.event.offsetX : (x - $root.scrollLeft());
              var py = (d3.event && d3.event.offsetY) ? d3.event.offsetY : (HEAD_H - $root.scrollTop());
              openColumnDimPicker(i, px, py);
            });
        }

        svg.append('text')
          .attr('class', 'decomp-header')
          .attr('x', x).attr('y', 20)
          .style('fill', THEME_FILL)
          .text(col.title);
        if (col.subtitle) {
          svg.append('text')
            .attr('class', 'decomp-header-sub')
            .attr('x', x).attr('y', 38)
            .style('fill', THEME_FILL)
            .style('opacity', 0.7)
            .text(col.subtitle);
        }
        svg.append('line')
          .attr('class', 'decomp-header-rule')
          .attr('x1', x).attr('x2', x + COL_W)
          .attr('y1', HEAD_H - 6).attr('y2', HEAD_H - 6)
          .style('stroke', THEME_FILL)
          .style('opacity', 0.35);

        // Close (X) button on non-root columns
        if (col.dimIdx !== null) {
          var cx = x + COL_W - 8, cy = 14;
          var closeG = svg.append('g')
            .attr('class', 'decomp-header-close')
            .attr('transform', 'translate(' + cx + ',' + cy + ')')
            .style('pointer-events', 'all')
            .on('mousedown', function() {
              if (d3.event) { d3.event.stopPropagation(); d3.event.preventDefault(); }
              // Drop this column and everything to its right.
              var keepLevels = i - 1;
              state.selectedPath = state.selectedPath.slice(0, keepLevels);
              state.levelDimMap  = state.levelDimMap.slice(0, Math.max(keepLevels, 0));
              // If the user closed all breakdowns, mark the state so the next
              // render leaves Total alone (clickable) instead of auto-filling.
              if (!state.levelDimMap.length) state.userCleared = true;
              viz._saveSettings();
              applyMarking();
              rerender();
            });
          closeG.append('circle').attr('r', 8).attr('fill', 'transparent');
          closeG.append('path')
            .attr('d', 'M-4,-4 L4,4 M4,-4 L-4,4')
            .attr('stroke-width', 1.5).attr('fill', 'none')
            .style('stroke', THEME_FILL);
        }
      });

      // Node positions
      var colNodes = columns.map(function(col, i) {
        var nodes = (col.dimIdx === null)
          ? [{ value: 'Total', measure: col.agg.total, isRoot: true }]
          : col.agg.children.slice();
        var maxMeas = 0;
        nodes.forEach(function(n) { if (n.measure > maxMeas) maxMeas = n.measure; });
        nodes.forEach(function(n, j) {
          n._x = colX(i);
          n._y = HEAD_H + j * (NODE_H + NODE_G);
          n._barW = maxMeas > 0 ? (COL_W * (n.measure / maxMeas)) : 0;
          n._colIdx = i;
        });
        return nodes;
      });

      // Connectors
      for (var ci = 0; ci < columns.length - 1; ci++) {
        var parentNodes = colNodes[ci];
        var childNodes  = colNodes[ci + 1];
        var sel = columns[ci].selectedValue;
        var parent = null;
        if (ci === 0) parent = parentNodes[0];
        else if (sel !== null) {
          for (var p = 0; p < parentNodes.length; p++) {
            if (parentNodes[p].value === sel) { parent = parentNodes[p]; break; }
          }
        }
        if (!parent) parent = parentNodes[0];
        var px = parent._x + COL_W;
        var py = parent._y + NODE_H / 2;
        childNodes.forEach(function(child) {
          var cx2 = child._x;
          var cy2 = child._y + NODE_H / 2;
          var mid = (px + cx2) / 2;
          var isSel = (columns[ci + 1].selectedValue === child.value);
          svg.append('path')
            .attr('class', 'decomp-link' + (isSel ? ' is-selected' : ''))
            .attr('d', 'M' + px + ',' + py + ' C' + mid + ',' + py + ' ' + mid + ',' + cy2 + ' ' + cx2 + ',' + cy2)
            .style('stroke', isSel ? BAR_COLOR : THEME_FILL)
            .style('opacity', isSel ? 1 : 0.35);
        });
      }

      function rerender() {
        try {
          var v = viz.assertOrCreateVizContext();
          viz._render(viz.createRenderingContext(v));
        } catch (e) { _logger.error('rerender failed', e); }
      }

      function applyMarking() {
        try {
          var oDL = info.oDataLayout;
          if (!oDL) return;
          var svc = viz.getMarkingService && viz.getMarkingService();
          if (!svc) return;
          svc.clearMarksForDataLayout(oDL);
          var matchRows = rowsMatchingPath(info, state.selectedPath);
          for (var k = 0; k < matchRows.length; k++) {
            svc.setMark(oDL, datamodelshapes.Physical.DATA, matchRows[k], 0);
          }
          viz._publishMarkEvent(oDL);
        } catch (e) { _logger.error('applyMarking failed', e); }
      }

      function onNodeClick(col, ci, d, nodeAbsX, nodeAbsY) {
        if (d3.event) { d3.event.stopPropagation(); d3.event.preventDefault(); }

        // Root (Total) click: only meaningful when there's no breakdown yet —
        // open a picker so the user can choose which dim to start with.
        if (col.dimIdx === null) {
          if (state.levelDimMap.length > 0) return;
          var allOpts = [];
          for (var di = 0; di < info.dimNames.length; di++) {
            allOpts.push({ value: di, label: info.dimNames[di] });
          }
          if (!allOpts.length) return;
          var pX = colX(1) - $root.scrollLeft();
          var pY = HEAD_H + 4 - $root.scrollTop();
          openPicker($root, pX, pY, allOpts, function(dimIdx) {
            state.levelDimMap = [dimIdx];
            state.userCleared = false;
            viz._saveSettings();
            rerender();
          });
          return;
        }

        var selIdx = ci - 1;
        var hadDeeperColumns = (state.levelDimMap.length > selIdx + 1);

        // Update the selection at this column. Keep deeper columns intact —
        // the sanitization pass will trim selectedPath beyond here if the new
        // branch lacks matching rows. This lets the user click through
        // siblings at any depth without re-picking dims for deeper columns.
        state.selectedPath = state.selectedPath.slice(0, selIdx);
        state.selectedPath.push({ dimIdx: col.dimIdx, value: d.value });
        if (!hadDeeperColumns) {
          // No deeper columns yet — pick/prompt for the next dim as before.
          state.levelDimMap = state.levelDimMap.slice(0, selIdx + 1);

          var remaining = unusedDims();
          if (remaining.length === 0) {
            viz._saveSettings();
            applyMarking();
            rerender();
            return;
          }
          if (remaining.length === 1) {
            state.levelDimMap.push(remaining[0]);
            viz._saveSettings();
            applyMarking();
            rerender();
            return;
          }

          viz._saveSettings();
          applyMarking();
          rerender();

          var options = remaining.map(function(idx) {
            return { value: idx, label: info.dimNames[idx] };
          });
          var pickerX = colX(ci + 1) - $root.scrollLeft();
          var pickerY = HEAD_H + 4 - $root.scrollTop();
          openPicker($root, pickerX, pickerY, options, function(dimIdx) {
            state.levelDimMap.push(dimIdx);
            viz._saveSettings();
            rerender();
          });
          return;
        }

        // Deeper columns already exist — just swap the value, no picker.
        viz._saveSettings();
        applyMarking();
        rerender();
      }


      // Nodes
      colNodes.forEach(function(nodes, ci) {
        var col = columns[ci];
        var g = svg.selectAll(null)
          .data(nodes)
          .enter().append('g')
          .attr('class', function(d) {
            var c = 'decomp-node';
            if (col.selectedValue !== null && d.value === col.selectedValue) c += ' is-selected';
            else if (col.selectedValue !== null) c += ' is-dim';
            return c;
          })
          .attr('transform', function(d) { return 'translate(' + d._x + ',' + d._y + ')'; });

        // Tooltip via SVG <title>
        g.append('title').text(function(d) {
          var prefix = (col.dimIdx === null) ? 'Total' : (col.title + ': ' + d.value);
          return prefix + '\n' + (info.measureName ? (info.measureName + ': ') : '') + formatNum(d.measure);
        });

        // Full-node hit area
        g.append('rect')
          .attr('class', 'decomp-node-hit')
          .attr('x', 0).attr('y', 0)
          .attr('width', COL_W).attr('height', NODE_H)
          .attr('fill', 'transparent')
          .style('pointer-events', 'all')
          .on('mousedown', function(d) { onNodeClick(col, ci, d); })
          .on('click',     function(d) { onNodeClick(col, ci, d); });

        // Bar background + bar
        var barY = LABEL_TOP ? (NODE_H - BAR_H - 2) : Math.max(0, (NODE_H - BAR_H) / 2);
        g.append('rect')
          .attr('class', 'decomp-node-bar-bg')
          .attr('x', 0).attr('y', barY)
          .attr('width', COL_W).attr('height', BAR_H)
          .style('fill', THEME_FILL)
          .style('opacity', 0.12)
          .style('pointer-events', 'none');
        g.append('rect')
          .attr('class', 'decomp-node-bar')
          .attr('x', 0).attr('y', barY)
          .attr('width', function(d) { return d._barW; })
          .attr('height', BAR_H)
          .attr('fill', BAR_COLOR)
          .style('pointer-events', 'none');

        // Label
        var labelY = LABEL_TOP ? 12 : (NODE_H / 2 + 4);
        g.append('text')
          .attr('class', 'decomp-node-label')
          .attr('x', 2).attr('y', labelY)
          .style('fill', THEME_FILL)
          .text(function(d) { return String(d.value); });

        // Value
        if (SHOW_VAL) {
          g.append('text')
            .attr('class', 'decomp-node-value')
            .attr('x', COL_W - 2).attr('y', labelY)
            .attr('text-anchor', 'end')
            .style('fill', THEME_FILL)
            .text(function(d) { return formatNum(d.measure); });
        }

        // Auto-contrast: if the label/value text overlaps the colored bar,
        // switch its fill to the contrast color (white on dark bars, dark on
        // light bars). Only meaningful when labels are inside the bar row.
        // Use .style() (not .attr()) so we beat the CSS rule that sets
        // `fill: currentColor` on .decomp-node-label / .decomp-node-value.
        if (!LABEL_TOP) {
          g.each(function(d) {
            var $g = d3.select(this);
            var label = $g.select('.decomp-node-label').node();
            if (label && label.getBBox) {
              try {
                var bb = label.getBBox();
                if (d._barW > (bb.x + bb.width) - 1) {
                  $g.select('.decomp-node-label').style('fill', CONTRAST);
                }
              } catch (e) { /* ignore */ }
            }
            var val = $g.select('.decomp-node-value').node();
            if (val && val.getBBox) {
              try {
                var vb = val.getBBox();
                if (d._barW > vb.x - 1) {
                  $g.select('.decomp-node-value').style('fill', CONTRAST);
                }
              } catch (e) { /* ignore */ }
            }
          });
        }
      });
    } finally {
      this._setIsRendered(true);
    }
  };

  DecompTree.prototype.render = function(ctx) { this._render(ctx); };

  // Publish a marking event so other vizes on the canvas react (Use as Filter).
  DecompTree.prototype._publishMarkEvent = function(oDataLayout, eMarkContext) {
    try {
      var markingEvent = new interactions.MarkingEvent(
        this.getID(), this.getViewName(), oDataLayout, null, eMarkContext
      );
      var eventRouter = this.getEventRouter && this.getEventRouter();
      if (eventRouter) eventRouter.publish(markingEvent);
    } catch (e) { _logger.error('publishMarkEvent failed', e); }
  };

  DecompTree.prototype._isOnlyPhysicalRowEdge = function() { return false; };

  DecompTree.prototype._onDefaultColorsSettingsChanged = function() {
    var v = this.assertOrCreateVizContext();
    this._render(this.createRenderingContext(v));
  };

  DecompTree.prototype.resizeVisualization = function(dim, v) {
    this._render(this.createRenderingContext(v));
  };

  // ---- Side-panel properties ----------------------------------------------
  DecompTree.prototype._addVizSpecificPropsDialog = function(oTabbedPanelsGadgetInfo) {
    var viz = this;
    if (!viz._configLoaded) { viz.loadConfig(); viz._configLoaded = true; }

    var panel = gadgetdialog.forcePanelByID(oTabbedPanelsGadgetInfo, euidef.GD_PANEL_ID_STYLE);

    panel.addChild(new gadgets.SliderGadgetInfo(
      'dtColumnWidth', 'Column Width', 'Width of each column in pixels',
      new gadgets.SliderGadgetValueProperties(euidef.GadgetTypeIDs.SLIDER, viz.Config.columnWidth, 120, 400, 10),
      0, false, null, { fValueFormatter: function(v) { return v + 'px'; } }
    ));

    panel.addChild(new gadgets.SliderGadgetInfo(
      'dtNodeHeight', 'Node Height', 'Vertical size of each node row',
      new gadgets.SliderGadgetValueProperties(euidef.GadgetTypeIDs.SLIDER, viz.Config.nodeHeight, 24, 64, 2),
      1, false, null, { fValueFormatter: function(v) { return v + 'px'; } }
    ));

    panel.addChild(new gadgets.SliderGadgetInfo(
      'dtBarHeight', 'Bar Height', 'Thickness of the value bar',
      new gadgets.SliderGadgetValueProperties(euidef.GadgetTypeIDs.SLIDER, viz.Config.barHeight, 4, 32, 1),
      2, false, null, { fValueFormatter: function(v) { return v + 'px'; } }
    ));

    panel.addChild(new gadgets.CheckboxGadgetInfo(
      'dtShowValues', 'Show Values', 'Show numeric values on the right of each node',
      new gadgets.CheckboxGadgetValueProperties(euidef.GadgetTypeIDs.CHECKBOX, viz.Config.showValues, viz.Config.showValues),
      3, false
    ));

    panel.addChild(new gadgets.SingleSelectGadgetInfo(
      'dtLabelPosition', 'Label Position', 'Label Position',
      new gadgets.GadgetValueProperties(euidef.GadgetTypeIDs.SINGLE_SELECT, viz.Config.labelPosition, { ariaLabel: 'Label Position' }),
      4, false,
      [
        new gadgets.OptionInfo('top',    'Above bar', 'Above bar'),
        new gadgets.OptionInfo('inside', 'Centered',  'Centered')
      ]
    ));

    panel.addChild(new gadgets.ColorPickerGadgetInfo(
      'dtBarColor', 'Bar Color', 'Fill color used for the value bars',
      new gadgets.GadgetValueProperties(euidef.GadgetTypeIDs.COLOR_PICKER, viz.Config.barColor || DEFAULTS.barColor),
      5, false, null,
      { sDefaultValue: DEFAULTS.barColor }
    ));

    // Label-color mode: Auto vs Custom. Custom uses the next picker.
    var labelMode = (viz.Config.labelColor && viz.Config.labelColor !== 'auto') ? 'custom' : 'auto';
    panel.addChild(new gadgets.SingleSelectGadgetInfo(
      'dtLabelColorMode', 'Label Color', 'Label Color',
      new gadgets.GadgetValueProperties(euidef.GadgetTypeIDs.SINGLE_SELECT, labelMode, { ariaLabel: 'Label Color' }),
      6, false,
      [
        new gadgets.OptionInfo('auto',   'Auto (theme)', 'Auto (theme)'),
        new gadgets.OptionInfo('custom', 'Custom',       'Custom')
      ]
    ));

    panel.addChild(new gadgets.ColorPickerGadgetInfo(
      'dtLabelColorPick', 'Custom Label Color',
      'Color used for header / label / value text (when mode is Custom)',
      new gadgets.GadgetValueProperties(
        euidef.GadgetTypeIDs.COLOR_PICKER,
        (labelMode === 'custom' ? viz.Config.labelColor : '#E8E8E8')
      ),
      7, false, null,
      { sDefaultValue: '#E8E8E8' }
    ));

    DecompTree.superClass._addVizSpecificPropsDialog.call(this, oTabbedPanelsGadgetInfo);
  };

  var GADGET_MAP = {
    dtColumnWidth:   { key: 'columnWidth',   type: 'slider' },
    dtNodeHeight:    { key: 'nodeHeight',    type: 'slider' },
    dtBarHeight:     { key: 'barHeight',     type: 'slider' },
    dtShowValues:    { key: 'showValues',    type: 'checkbox' },
    dtLabelPosition:  { key: 'labelPosition', type: 'select' },
    dtBarColor:       { key: 'barColor',      type: 'color' },
    dtLabelColorMode: { key: 'labelColorMode', type: 'select' },
    dtLabelColorPick: { key: 'labelColorPick', type: 'color' }
  };

  DecompTree.prototype._handlePropChange = function(sGadgetID, oPropChange, oViewSettings, oActionContext) {
    var bUpdate = DecompTree.superClass._handlePropChange.call(this, sGadgetID, oPropChange, oViewSettings, oActionContext);
    if (typeof DecompTree.superClass._handleLegendPropChange === 'function') {
      if (DecompTree.superClass._handleLegendPropChange.call(this, sGadgetID, oPropChange, oViewSettings, oActionContext)) {
        bUpdate = true;
      }
    }

    var m = GADGET_MAP[sGadgetID];
    if (m && oPropChange) {
      var raw = oPropChange.getValue && oPropChange.getValue();
      if (raw == null) raw = oPropChange.value;
      if (raw == null) raw = oPropChange;
      var newVal = raw;
      if (raw && typeof raw === 'object') {
        if ('checked' in raw)              newVal = raw.checked;
        else if ('transientValue' in raw)  newVal = raw.transientValue;
        else if ('value' in raw)           newVal = raw.value;
      }
      if (m.type === 'slider')   newVal = Number(newVal);
      if (m.type === 'checkbox') newVal = !!newVal;
      if (m.type === 'color')    newVal = String(newVal || DEFAULTS.barColor);
      this.Config[m.key] = newVal;

      // Derived: labelColor = 'auto' OR the custom hex.
      if (sGadgetID === 'dtLabelColorMode' || sGadgetID === 'dtLabelColorPick') {
        var mode = this.Config.labelColorMode;
        if (mode === 'custom') {
          this.Config.labelColor = this.Config.labelColorPick || '#E8E8E8';
        } else {
          this.Config.labelColor = 'auto';
        }
      }
      this._saveSettings();
      bUpdate = true;
    }
    return bUpdate;
  };

  return decompTree;
});
