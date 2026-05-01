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
  'obitech-appservices/logger',
  'ojL10n!com-company-advWaterfall/nls/messages',
  'obitech-framework/messageformat',
  'css!com-company-advWaterfall/advWaterfallstyles'
], function(
  $, jsx, data, gadgets, euidef, gadgetdialog, ko, dataviz,
  legendandvizcontainer, datamodelshapes, d3, events, logger, messages
) {
  'use strict';

  var MODULE_NAME = 'com-company-advWaterfall/advWaterfall';
  jsx.assertAllNotNullExceptLastN(arguments, 'advWaterfall.js arguments', 2);
  var _logger = new logger.Logger(MODULE_NAME);

  var DEFAULTS = {
    barGap: 0.37,
    subtotalColor: '#5A6470',
    numberFormat: 'auto',
    currencySymbol: '$',
    numberDecimals: 0,
    numberThousandSep: ',',
    numberAbbreviation: 'auto',
    numberNegativeStyle: 'minus',
    stripLabelPrefix: true,
    showConnectors: true,
    showEnd: true,
    endLabel: messages.ADVWATERFALL_END || 'End',
    showZeroLine: true,
    stepShading: true,
    stepShadingRange: 0.6,
    markNegativeSegments: true,
    categoryDetailMode: 'cumulative',
    listSort: 'magnitude',
    showInSegmentLabels: true,
    gutterMaxPct: 30
  };

  function getSettings(viz) {
    var cfg = (viz.getViewConfig && viz.getViewConfig()) || {};
    var w = cfg.advWaterfall || {};
    return {
      barGap: typeof w.barGap === 'number' ? w.barGap : DEFAULTS.barGap,
      subtotalColor: w.subtotalColor || DEFAULTS.subtotalColor,
      numberFormat: w.numberFormat || DEFAULTS.numberFormat,
      currencySymbol: typeof w.currencySymbol === 'string' ? w.currencySymbol : DEFAULTS.currencySymbol,
      numberDecimals: typeof w.numberDecimals === 'number' ? w.numberDecimals : DEFAULTS.numberDecimals,
      numberThousandSep: typeof w.numberThousandSep === 'string' ? w.numberThousandSep : DEFAULTS.numberThousandSep,
      numberAbbreviation: w.numberAbbreviation || DEFAULTS.numberAbbreviation,
      numberNegativeStyle: w.numberNegativeStyle || DEFAULTS.numberNegativeStyle,
      stripLabelPrefix: typeof w.stripLabelPrefix === 'boolean' ? w.stripLabelPrefix : DEFAULTS.stripLabelPrefix,
      showConnectors: typeof w.showConnectors === 'boolean' ? w.showConnectors : DEFAULTS.showConnectors,
      showEnd: typeof w.showEnd === 'boolean' ? w.showEnd : DEFAULTS.showEnd,
      endLabel: typeof w.endLabel === 'string' && w.endLabel ? w.endLabel : DEFAULTS.endLabel,
      showZeroLine: typeof w.showZeroLine === 'boolean' ? w.showZeroLine : DEFAULTS.showZeroLine,
      stepShading: typeof w.stepShading === 'boolean' ? w.stepShading : DEFAULTS.stepShading,
      stepShadingRange: typeof w.stepShadingRange === 'number' ? w.stepShadingRange : DEFAULTS.stepShadingRange,
      markNegativeSegments: typeof w.markNegativeSegments === 'boolean' ? w.markNegativeSegments : DEFAULTS.markNegativeSegments,
      categoryDetailMode: (w.categoryDetailMode === 'list' || w.categoryDetailMode === 'both' || w.categoryDetailMode === 'cumulative') ? w.categoryDetailMode : DEFAULTS.categoryDetailMode,
      listSort: (w.listSort === 'source' || w.listSort === 'magnitude') ? w.listSort : DEFAULTS.listSort,
      showInSegmentLabels: typeof w.showInSegmentLabels === 'boolean' ? w.showInSegmentLabels : DEFAULTS.showInSegmentLabels,
      gutterMaxPct: typeof w.gutterMaxPct === 'number' ? w.gutterMaxPct : DEFAULTS.gutterMaxPct
    };
  }

  function formatFull(val, s) {
    var s2 = {};
    if (s) for (var k in s) if (Object.prototype.hasOwnProperty.call(s, k)) s2[k] = s[k];
    s2.numberAbbreviation = 'default';
    return formatNumber(val, s2);
  }

  function formatSignedFull(val, s) {
    if (val > 0) return '+' + formatFull(val, s);
    return formatFull(val, s);
  }

  function shadeFor(baseHex, idx, count, range) {
    if (count <= 1) return baseHex;
    var rgb = d3.rgb(baseHex);
    if (!rgb || isNaN(rgb.r)) return baseHex;
    var factor = -range / 2 + (idx / (count - 1)) * range;
    if (factor > 0) return rgb.brighter(factor).toString();
    if (factor < 0) return rgb.darker(-factor).toString();
    return rgb.toString();
  }

  function allSame(arr) {
    if (arr.length < 2) return true;
    for (var i = 1; i < arr.length; i++) if (arr[i] !== arr[0]) return false;
    return true;
  }

  // Strip leading numeric sort prefix like "01 ", "1. ", "01) " from labels
  function stripPrefix(s) {
    if (s == null) return '';
    var str = String(s);
    var m = str.match(/^\s*\d+[.)]?\s+(.*)$/);
    return m ? m[1] : str;
  }

  function formatNumber(val, s) {
    var n = Number.parseFloat(val);
    if (isNaN(n)) return String(val);
    s = s || {};
    var fmt = s.numberFormat || 'auto';
    var decimals = typeof s.numberDecimals === 'number' ? s.numberDecimals : 0;
    var thousandSep = typeof s.numberThousandSep === 'string' ? s.numberThousandSep : ',';
    var abbreviation = s.numberAbbreviation || 'default';
    var negStyle = s.numberNegativeStyle || 'minus';
    var sym = s.currencySymbol || '$';
    var working = n;
    var suffix = '';
    function applyAbbr(scale, suf) { working = n / scale; suffix = suf; }
    switch (abbreviation) {
      case 'auto': {
        var abs = Math.abs(n);
        if (abs >= 1e9) applyAbbr(1e9, 'B');
        else if (abs >= 1e6) applyAbbr(1e6, 'M');
        else if (abs >= 1e3) applyAbbr(1e3, 'K');
        break;
      }
      case 'B': applyAbbr(1e9, 'B'); break;
      case 'M': applyAbbr(1e6, 'M'); break;
      case 'K': applyAbbr(1e3, 'K'); break;
    }
    if (fmt === 'percent') working = working * 100;
    var fixed = Math.abs(working).toFixed(decimals);
    var parts = fixed.split('.');
    var intPart = parts[0];
    if (thousandSep) intPart = intPart.replace(/\B(?=(\d{3})+(?!\d))/g, thousandSep);
    var absStr = decimals > 0 && parts[1] ? intPart + '.' + parts[1] : intPart;
    var prefix = fmt === 'currency' ? sym : '';
    var trailing = fmt === 'percent' ? '%' : '';
    var body = prefix + absStr + suffix + trailing;
    if (working >= 0) return body;
    if (negStyle === 'parens') return '(' + body + ')';
    if (negStyle === 'trailing') return body + '-';
    return '-' + body;
  }

  function formatSigned(n, s) {
    if (n > 0) return '+' + formatNumber(n, s);
    return formatNumber(n, s);
  }

  function detectThemeTextColor(el) {
    var bodyColor = window.getComputedStyle(document.body).color;
    if (bodyColor && bodyColor !== 'rgba(0, 0, 0, 0)' && bodyColor !== 'transparent') return bodyColor;
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

  function measureTextWidth(text, fontFamily, fontSize) {
    var probe = d3.select(document.body).append('svg')
      .style('position', 'absolute').style('left', '-9999px').style('top', '-9999px')
      .attr('width', 1).attr('height', 1);
    var t = probe.append('text')
      .attr('font-family', fontFamily || 'sans-serif')
      .attr('font-size', fontSize || 12)
      .text(String(text));
    var w = t.node().getComputedTextLength
      ? t.node().getComputedTextLength()
      : String(text).length * (fontSize || 12) * 0.55;
    probe.remove();
    return w;
  }

  // Right-truncate text to fit within budget pixels; appends ellipsis when truncated.
  function truncateText(text, budget, fontFamily, fontSize) {
    var s = String(text);
    if (measureTextWidth(s, fontFamily, fontSize) <= budget) return s;
    var ellipsis = '…';
    var lo = 0, hi = s.length;
    while (lo < hi) {
      var mid = Math.ceil((lo + hi) / 2);
      if (measureTextWidth(s.slice(0, mid) + ellipsis, fontFamily, fontSize) <= budget) lo = mid;
      else hi = mid - 1;
    }
    return (lo > 0 ? s.slice(0, lo) : '') + ellipsis;
  }

  // Word-wrap text into up to maxLines lines fitting budget pixels.
  // Last line right-truncates with ellipsis if remaining words don't fit.
  function wrapTextLines(text, budget, fontFamily, fontSize, maxLines) {
    var words = String(text).split(/\s+/).filter(Boolean);
    if (!words.length) return [''];
    if (maxLines <= 1) return [truncateText(text, budget, fontFamily, fontSize)];
    var lines = [];
    var cur = '';
    for (var i = 0; i < words.length; i++) {
      var trial = cur ? cur + ' ' + words[i] : words[i];
      if (measureTextWidth(trial, fontFamily, fontSize) <= budget) {
        cur = trial;
      } else {
        if (cur) lines.push(cur);
        cur = words[i];
        if (lines.length === maxLines - 1) {
          var rest = words.slice(i).join(' ');
          lines.push(truncateText(rest, budget, fontFamily, fontSize));
          return lines;
        }
      }
    }
    if (cur) lines.push(cur);
    return lines;
  }

  AdvWaterfall.VERSION = '1.0.0';

  function AdvWaterfall(sID, sDisplayName, sOrigin, sVersion) {
    AdvWaterfall.baseConstructor.call(this, sID, sDisplayName, sOrigin, sVersion);
  }
  jsx.extend(AdvWaterfall, dataviz.DataVisualization);

  AdvWaterfall.prototype.myGenerateData = function(oDataLayout, ctx) {
    var oDataModel = this.getRootDataModel();
    if (!oDataModel || !oDataLayout) return null;
    var nRows = oDataLayout.getEdgeExtent(datamodelshapes.Physical.ROW);
    var oHelper = ctx.get(dataviz.DataContextProperty.DATA_LAYOUT_HELPER);
    var oColorCtx = this.getColorContext(ctx);
    var oColorInterp = this.getCachedColorInterpolator(ctx, datamodelshapes.Logical.COLOR);

    var aOut = [];
    for (var i = 0; i < nRows; i++) {
      var step = oDataLayout.getValue(datamodelshapes.Physical.ROW, 0, i);
      var category = null;
      try {
        var v = oDataLayout.getValue(datamodelshapes.Physical.ROW, 1, i);
        if (v != null) category = v;
      } catch (e) { /* second position not bound */ }
      var ci = this.getDataItemColorInfo(oHelper, oColorCtx, oColorInterp, i, 0);
      aOut.push({
        step: step,
        category: category,
        color: ci.sColor,
        cumulative: oDataLayout.getValue(datamodelshapes.Physical.DATA, i, 0)
      });
    }
    return aOut.length ? aOut : null;
  };

  function buildCategories(dataset, settings) {
    var cats = [];
    var runningCum = 0;
    var current = null;
    for (var i = 0; i < dataset.length; i++) {
      var d = dataset[i];
      var key = d.category != null ? String(d.category) : '__color:' + d.color;
      if (!current || current._key !== key) {
        if (current) {
          current.endCum = runningCum;
          current.netDelta = current.endCum - current.startCum;
          cats.push(current);
        }
        current = {
          _key: key,
          name: d.category != null ? String(d.category) : '',
          color: d.color,
          startCum: runningCum,
          steps: []
        };
      }
      var delta = (+d.cumulative) - runningCum;
      current.steps.push({
        name: d.step,
        delta: delta,
        cumulative: +d.cumulative,
        color: d.color
      });
      runningCum = +d.cumulative;
    }
    if (current) {
      current.endCum = runningCum;
      current.netDelta = current.endCum - current.startCum;
      cats.push(current);
    }
    if (settings.showEnd && cats.length > 0) {
      var endVal = cats[cats.length - 1].endCum;
      cats.push({
        _key: '__end__',
        name: settings.endLabel,
        color: settings.subtotalColor,
        startCum: 0,
        endCum: endVal,
        netDelta: endVal,
        steps: [{ name: messages.ADVWATERFALL_CLOSING_BALANCE || 'Closing balance', delta: endVal, cumulative: endVal, color: settings.subtotalColor }],
        _isClosing: true
      });
    }
    return cats;
  }

  AdvWaterfall.prototype._render = function(ctx) {
    try {
      var oDataLayout = ctx.get(dataviz.DataContextProperty.DATA_LAYOUT);
      var elContainer = this.getContainerElem();
      $(elContainer).empty();
      var settings = getSettings(this);
      var dataset = this.myGenerateData(oDataLayout, ctx);
      if (!dataset || dataset.length === 0) return;

      var cats = buildCategories(dataset, settings);

      function disp(s) { return settings.stripLabelPrefix ? stripPrefix(s) : (s == null ? '' : String(s)); }

      // X-domain: only category boundaries (startCum/endCum) plus 0.
      // Segments don't overshoot — bars span [startCum, endCum] cleanly.
      var allValues = [0];
      cats.forEach(function(c) { allValues.push(c.startCum, c.endCum); });
      var minVal = Math.min.apply(null, allValues);
      var maxVal = Math.max.apply(null, allValues);
      if (minVal === maxVal) { minVal = Math.min(0, minVal); maxVal = Math.max(0, maxVal + 1); }
      // Inset bars from the chart edge so labels and edges have breathing room
      var domainPad = (maxVal - minVal) * 0.03;
      if (domainPad > 0) {
        maxVal += domainPad;
        if (minVal < 0) minVal -= domainPad;
      }

      var Y_FONT = 'sans-serif';
      var Y_FONT_SIZE = 12;
      var Y_SUB_SIZE = 11;
      var widestLeft = 0;
      var widestRight = 0;
      var listMode = settings.categoryDetailMode;
      cats.forEach(function(c) {
        var nameW = measureTextWidth(disp(c.name), Y_FONT, Y_FONT_SIZE);
        var subW = measureTextWidth(formatSigned(c.netDelta, settings), Y_FONT, Y_SUB_SIZE);
        widestLeft = Math.max(widestLeft, nameW, subW);
        var cumW = measureTextWidth(formatNumber(c.endCum, settings), Y_FONT, Y_FONT_SIZE);
        if ((listMode === 'list' || listMode === 'both') && !c._isClosing) {
          var mv = 0, mn = 0;
          c.steps.forEach(function(st) {
            var vw = measureTextWidth(formatFull(st.delta, settings), Y_FONT, 11);
            var nw = measureTextWidth(disp(st.name), Y_FONT, 11);
            if (vw > mv) mv = vw;
            if (nw > mn) mn = nw;
          });
          var blockW = mv + 8 + mn;
          if (listMode === 'both' && cumW > blockW) blockW = cumW;
          widestRight = Math.max(widestRight, blockW);
        } else {
          widestRight = Math.max(widestRight, cumW);
        }
      });

      var width = $(elContainer).width() - 20;
      var height = $(elContainer).height() - 10;
      // #33: cap left gutter to gutterMaxPct of width so chart stays the star
      var gutterCap = Math.floor(width * (settings.gutterMaxPct / 100));
      var margin = {
        top: 24,
        right: Math.max(40, Math.ceil(widestRight) + 16),
        bottom: 40,
        left: Math.min(Math.ceil(widestLeft) + 20, gutterCap)
      };

      var svg = d3.select(elContainer).append('svg').attr({ width: width, height: height });
      svg.style('color', detectThemeTextColor(elContainer));
      var autoFill = detectThemeTextColor(elContainer);

      // Diagonal hatch pattern for negative segments
      var defs = svg.append('defs');
      var pat = defs.append('pattern')
        .attr('id', 'adv-neg-hatch')
        .attr('width', 6).attr('height', 6)
        .attr('patternUnits', 'userSpaceOnUse')
        .attr('patternTransform', 'rotate(45)');
      pat.append('rect').attr('width', 6).attr('height', 6).attr('fill', 'transparent');
      pat.append('line')
        .attr('x1', 0).attr('y1', 0).attr('x2', 0).attr('y2', 6)
        .attr('stroke', 'rgba(255,255,255,0.28)').attr('stroke-width', 1.5);

      var plotW = Math.max(20, width - margin.left - margin.right);
      var plotH = Math.max(20, height - margin.top - margin.bottom);

      var bandHeight = plotH / cats.length;
      var rectHeight = Math.max(2, bandHeight * (1 - settings.barGap));
      var rectYOffset = (bandHeight - rectHeight) / 2;

      var x = d3.scale.linear().domain([minVal, maxVal]).range([0, plotW]);

      var plot = svg.append('g').attr('transform', 'translate(' + margin.left + ',' + margin.top + ')');

      // Vertical zero reference line — render whenever 0 is in domain
      if (settings.showZeroLine && minVal <= 0 && maxVal >= 0) {
        plot.append('line')
          .attr({ x1: x(0), x2: x(0), y1: -4, y2: plotH + 4 })
          .attr('stroke', autoFill).attr('stroke-width', 1.25).attr('opacity', 0.85);
      }

      cats.forEach(function(cat, ci) {
        var rowG = plot.append('g').attr('transform', 'translate(0,' + (ci * bandHeight + rectYOffset) + ')');

        var startX = x(cat.startCum);
        var endX = x(cat.endCum);
        var barLeft = Math.min(startX, endX);
        var barRight = Math.max(startX, endX);
        var barWidth = Math.max(1, barRight - barLeft);
        var direction = cat.netDelta < 0 ? -1 : 1;
        var absSum = cat.steps.reduce(function(s, st) { return s + Math.abs(st.delta); }, 0);
        var stepColors = cat.steps.map(function(st){ return st.color || cat.color || '#888'; });
        var sameColor = allSame(stepColors);

        // Render segments stacked in source order, sized proportionally to |delta|
        var cursor = direction > 0 ? barLeft : barRight;
        cat.steps.forEach(function(step, si) {
          var segW;
          if (absSum > 0) segW = (Math.abs(step.delta) / absSum) * barWidth;
          else segW = barWidth / Math.max(1, cat.steps.length);
          var x0 = direction > 0 ? cursor : cursor - segW;
          var baseFill = step.color || cat.color || '#888';
          var fill = (settings.stepShading && sameColor && cat.steps.length > 1 && !cat._isClosing)
            ? shadeFor(baseFill, si, cat.steps.length, settings.stepShadingRange)
            : baseFill;
          var labelText = disp(step.name) + ': ' + formatNumber(step.delta, settings);
          var rect = rowG.append('rect')
            .attr({ x: x0, y: 0, width: Math.max(1, segW), height: rectHeight })
            .attr('fill', fill);
          rect.append('title').text(labelText);
          if (settings.markNegativeSegments && step.delta < 0) {
            rowG.append('rect')
              .attr({ x: x0, y: 0, width: Math.max(1, segW), height: rectHeight })
              .attr('fill', 'url(#adv-neg-hatch)')
              .attr('pointer-events', 'none');
          }
          var lw = measureTextWidth(labelText, Y_FONT, 11);
          // #29: show truncated in-segment label when the full string doesn't fit
          var inSegLabel = lw + 8 < segW ? labelText
            : (segW >= 20 ? truncateText(labelText, segW - 8, Y_FONT, 11) : null);
          // #34: suppress in-segment when user toggled off, or when list mode renders the same text
          var listActive = !cat._isClosing && (settings.categoryDetailMode === 'list' || settings.categoryDetailMode === 'both');
          // #32: closing row's in-bar text duplicates the gutter — suppress it
          if (!settings.showInSegmentLabels || listActive || cat._isClosing) inSegLabel = null;
          if (inSegLabel !== null) {
            rowG.append('text')
              .attr({
                x: x0 + 6,
                y: rectHeight / 2,
                'text-anchor': 'start',
                'dominant-baseline': 'central',
                'font-family': Y_FONT,
                'font-size': 11
              })
              .attr('fill', pickContrastFill(fill))
              .text(inSegLabel)
              .append('title').text(labelText);
          }
          cursor += direction * segW;
        });

        // Cumulative / list block OUTSIDE the bar on the endCum side
        var labelX = direction > 0 ? barRight + 6 : barLeft - 6;
        var labelAnchor = direction > 0 ? 'start' : 'end';

        // Sorted step list for tooltip and (optional) visible list
        var sortedSteps = cat.steps.slice();
        if (settings.listSort === 'magnitude') {
          sortedSteps.sort(function(a, b) { return Math.abs(b.delta) - Math.abs(a.delta); });
        }
        var fullListLines = [
          disp(cat.name) + ' ' + (messages.ADVWATERFALL_CUMULATIVE || 'cumulative') + ': ' + formatFull(cat.endCum, settings),
          ''
        ];
        sortedSteps.forEach(function(st) {
          fullListLines.push(formatFull(st.delta, settings) + '  ' + disp(st.name));
        });
        var fullListText = fullListLines.join('\n');

        var mode = cat._isClosing ? 'cumulative' : settings.categoryDetailMode;

        if (mode === 'cumulative') {
          rowG.append('text')
            .attr({
              x: labelX,
              y: rectHeight / 2,
              'text-anchor': labelAnchor,
              'dominant-baseline': 'central',
              'font-family': Y_FONT,
              'font-size': 12,
              'font-weight': '600'
            })
            .attr('fill', autoFill)
            .text(formatNumber(cat.endCum, settings))
            .append('title').text(fullListText);
        } else {
          var listFontSize = 11;
          var lineHeight = 13;
          var headerLines = (mode === 'both') ? 1 : 0;
          var headerHeight = headerLines * (lineHeight + 4);
          var available = Math.max(0, rectHeight - headerHeight);
          var maxLines = Math.floor(available / lineHeight);
          var visibleSteps = sortedSteps.slice(0, Math.max(0, maxLines));

          var maxValueW = 0, maxNameW = 0;
          visibleSteps.forEach(function(st) {
            var vw = measureTextWidth(formatFull(st.delta, settings), Y_FONT, listFontSize);
            var nw = measureTextWidth(disp(st.name), Y_FONT, listFontSize);
            if (vw > maxValueW) maxValueW = vw;
            if (nw > maxNameW) maxNameW = nw;
          });
          var blockW = maxValueW + 8 + maxNameW;
          // #31: always render list to the right of the bar's right edge,
          // regardless of bar direction. Never on top of the bar.
          var blockLeft = barRight + 6;
          // #28: also keep clear of the zero line if it's drawn
          if (settings.showZeroLine && minVal <= 0 && maxVal >= 0) {
            blockLeft = Math.max(blockLeft, x(0) + 5);
          }
          var valueColRight = blockLeft + maxValueW;
          var nameColLeft = blockLeft + maxValueW + 8;

          if (mode === 'both') {
            rowG.append('text')
              .attr({
                x: valueColRight,
                y: lineHeight - 1,
                'text-anchor': 'end',
                'font-family': Y_FONT,
                'font-size': 12,
                'font-weight': '700'
              })
              .attr('fill', autoFill)
              .text(formatNumber(cat.endCum, settings))
              .append('title').text(fullListText);
          }

          visibleSteps.forEach(function(st, i) {
            var y = headerHeight + i * lineHeight + lineHeight - 2;
            var rowOpacity = st.delta < 0 ? 0.6 : 1.0;
            var tip = formatFull(st.delta, settings) + '  ' + disp(st.name);
            rowG.append('text')
              .attr({
                x: valueColRight, y: y,
                'text-anchor': 'end',
                'font-family': Y_FONT, 'font-size': listFontSize
              })
              .attr('fill', autoFill).attr('opacity', rowOpacity)
              .text(formatFull(st.delta, settings))
              .append('title').text(tip);
            rowG.append('text')
              .attr({
                x: nameColLeft, y: y,
                'text-anchor': 'start',
                'font-family': Y_FONT, 'font-size': listFontSize
              })
              .attr('fill', autoFill).attr('opacity', rowOpacity)
              .text(disp(st.name))
              .append('title').text(tip);
          });
        }

        // Left gutter: category name (wrapped or right-truncated) + signed subtotal
        // #33: word-wrap when band has vertical room, right-truncate otherwise
        var gutterBudget = margin.left - 14;
        var lineH = Y_FONT_SIZE + 2;
        var subH = Y_SUB_SIZE + 2;
        var availForName = bandHeight / 2 - 2;
        var maxNameLines = Math.max(1, Math.floor(availForName / lineH));
        var nameLines = wrapTextLines(disp(cat.name) || '', gutterBudget, Y_FONT, Y_FONT_SIZE, maxNameLines);
        var gutter = svg.append('g').attr('transform',
          'translate(' + margin.left + ',' + (margin.top + ci * bandHeight + bandHeight / 2) + ')');
        var nameText = gutter.append('text')
          .attr('class', 'adv-category-label')
          .attr('text-anchor', 'end')
          .attr('dominant-baseline', 'auto')
          .attr('x', -10)
          .attr('y', -3 - (nameLines.length - 1) * lineH)
          .attr('font-family', Y_FONT)
          .attr('font-size', Y_FONT_SIZE)
          .attr('fill', 'currentColor');
        nameLines.forEach(function(ln, li) {
          nameText.append('tspan')
            .attr('x', -10)
            .attr('dy', li === 0 ? 0 : lineH)
            .text(ln);
        });
        nameText.append('title').text(disp(cat.name) || '');
        // #32: closing row dedups — gutter shows just the value (already labeled by End row position)
        var subtotalText = cat._isClosing
          ? formatNumber(cat.endCum, settings)
          : formatSigned(cat.netDelta, settings);
        var subtotalTip = cat._isClosing
          ? (messages.ADVWATERFALL_GRAND_TOTAL || 'Grand total') + ': ' + formatFull(cat.endCum, settings)
          : disp(cat.name) + ' ' + (messages.ADVWATERFALL_SUBTOTAL || 'subtotal') + ': ' + formatSignedFull(cat.netDelta, settings);
        gutter.append('text')
          .attr('class', 'adv-category-subtotal')
          .attr('text-anchor', 'end')
          .attr('dominant-baseline', 'hanging')
          .attr('x', -10)
          .attr('y', 5)
          .attr('font-family', Y_FONT)
          .attr('font-size', Y_SUB_SIZE)
          .attr('fill', 'currentColor')
          .attr('opacity', cat._isClosing ? 0.85 : 0.7)
          .text(truncateText(subtotalText, gutterBudget, Y_FONT, Y_SUB_SIZE))
          .append('title').text(subtotalTip);
      });

      // Connectors between adjacent data categories at shared running cumulative
      if (settings.showConnectors)
      for (var k = 0; k < cats.length - 1; k++) {
        var a = cats[k];
        var b = cats[k + 1];
        if (b._isClosing) continue;
        if (Math.abs(a.endCum - b.startCum) > 1e-9) continue;
        var xv = x(a.endCum);
        var yTop = k * bandHeight + rectYOffset + rectHeight;
        var yBot = (k + 1) * bandHeight + rectYOffset;
        plot.append('line')
          .attr({ x1: xv, x2: xv, y1: yTop, y2: yBot })
          .attr('stroke', '#888').attr('stroke-width', 1).attr('stroke-dasharray', '2 2');
      }

      var xAxis = d3.svg.axis().scale(x).tickFormat(function(v) { return formatNumber(v, settings); });
      svg.append('g')
        .attr('class', 'adv-axis')
        .attr('transform', 'translate(' + margin.left + ',' + (margin.top + plotH) + ')')
        .call(xAxis);
    } finally {
      this._setIsRendered(true);
    }
  };

  AdvWaterfall.prototype.render = function(ctx) { this._render(ctx); };

  AdvWaterfall.prototype._fillDefaultOptions = function(oOptions) {
    if (jsx.isNull(oOptions)) return;
    var bUpdated = false;
    if (jsx.isNull(oOptions.legend)) {
      oOptions.legend = { rendered: 'on', position: 'auto' };
      bUpdated = true;
    }
    if (jsx.isNull(oOptions.advWaterfall)) {
      oOptions.advWaterfall = {
        barGap: DEFAULTS.barGap,
        subtotalColor: DEFAULTS.subtotalColor,
        numberFormat: DEFAULTS.numberFormat,
        currencySymbol: DEFAULTS.currencySymbol,
        numberDecimals: DEFAULTS.numberDecimals,
        numberThousandSep: DEFAULTS.numberThousandSep,
        numberAbbreviation: DEFAULTS.numberAbbreviation,
        numberNegativeStyle: DEFAULTS.numberNegativeStyle,
        stripLabelPrefix: DEFAULTS.stripLabelPrefix,
        showEnd: DEFAULTS.showEnd,
        showConnectors: DEFAULTS.showConnectors,
        endLabel: DEFAULTS.endLabel,
        showZeroLine: DEFAULTS.showZeroLine,
        stepShading: DEFAULTS.stepShading,
        stepShadingRange: DEFAULTS.stepShadingRange,
        markNegativeSegments: DEFAULTS.markNegativeSegments,
        categoryDetailMode: DEFAULTS.categoryDetailMode,
        listSort: DEFAULTS.listSort
      };
      bUpdated = true;
    }
    if (bUpdated) this.getSettings().setViewConfigJSON(dataviz.SettingsNS.CHART, oOptions);
  };

  AdvWaterfall.prototype._addVizSpecificPropsDialog = function(oTabbedPanelsGadgetInfo) {
    var options = this.getViewConfig() || {};
    this._fillDefaultOptions(options, null);
    var w = options.advWaterfall || {};

    var panel = gadgetdialog.forcePanelByID(oTabbedPanelsGadgetInfo, euidef.GD_PANEL_ID_STYLE);

    // Category Detail
    var lblCum  = messages.ADVWATERFALL_DETAIL_CUMULATIVE || 'Cumulative';
    var lblList = messages.ADVWATERFALL_DETAIL_LIST || 'List';
    var lblBoth = messages.ADVWATERFALL_DETAIL_BOTH || 'Cumulative + List';
    var catDetailOpts = [
      new gadgets.OptionInfo('cumulative', lblCum,  lblCum),
      new gadgets.OptionInfo('list',       lblList, lblList),
      new gadgets.OptionInfo('both',       lblBoth, lblBoth)
    ];
    var lblCD = messages.ADVWATERFALL_CATEGORY_DETAIL || 'Category Detail';
    panel.addChild(new gadgets.SingleSelectGadgetInfo(
      'awCategoryDetailMode', lblCD, lblCD,
      new gadgets.GadgetValueProperties(
        euidef.GadgetTypeIDs.SINGLE_SELECT,
        w.categoryDetailMode || DEFAULTS.categoryDetailMode,
        { ariaLabel: lblCD }
      ),
      0, false, catDetailOpts
    ));

    // List Sort
    var lblHL = messages.ADVWATERFALL_SORT_HIGH_LOW || 'High to Low';
    var lblAZ = messages.ADVWATERFALL_SORT_A_Z || 'A to Z';
    var listSortOpts = [
      new gadgets.OptionInfo('magnitude', lblHL, lblHL),
      new gadgets.OptionInfo('source',    lblAZ, lblAZ)
    ];
    var lblLS = messages.ADVWATERFALL_LIST_SORT || 'List Sort';
    panel.addChild(new gadgets.SingleSelectGadgetInfo(
      'awListSort', lblLS, lblLS,
      new gadgets.GadgetValueProperties(
        euidef.GadgetTypeIDs.SINGLE_SELECT,
        w.listSort || DEFAULTS.listSort,
        { ariaLabel: lblLS }
      ),
      0, false, listSortOpts
    ));

    // Show End
    var ckShowEnd = typeof w.showEnd === 'boolean' ? w.showEnd : DEFAULTS.showEnd;
    panel.addChild(new gadgets.CheckboxGadgetInfo(
      'awShowEnd',
      messages.ADVWATERFALL_SHOW_END || 'Show End row',
      messages.ADVWATERFALL_SHOW_END_TIP || 'Append a synthetic End row showing the closing balance',
      new gadgets.CheckboxGadgetValueProperties(euidef.GadgetTypeIDs.CHECKBOX, ckShowEnd, ckShowEnd),
      0, false
    ));

    // End Label
    panel.addChild(new gadgets.TextGadgetInfo(
      'awEndLabel',
      messages.ADVWATERFALL_END_LABEL || 'End Label',
      messages.ADVWATERFALL_END_LABEL_TIP || 'Label for the synthetic End row',
      new gadgets.GadgetValueProperties(
        euidef.GadgetTypeIDs.TEXT_FIELD,
        typeof w.endLabel === 'string' ? w.endLabel : DEFAULTS.endLabel
      ),
      0, false, null,
      { sPlaceholderText: messages.ADVWATERFALL_END || 'End' }
    ));

    // Show Connectors
    var ckConn = typeof w.showConnectors === 'boolean' ? w.showConnectors : DEFAULTS.showConnectors;
    panel.addChild(new gadgets.CheckboxGadgetInfo(
      'awShowConnectors',
      messages.ADVWATERFALL_SHOW_CONNECTORS || 'Show Connectors',
      messages.ADVWATERFALL_SHOW_CONNECTORS_TIP || 'Dashed connector lines between adjacent category bars',
      new gadgets.CheckboxGadgetValueProperties(euidef.GadgetTypeIDs.CHECKBOX, ckConn, ckConn),
      0, false
    ));

    // Show Zero Line
    var ckZero = typeof w.showZeroLine === 'boolean' ? w.showZeroLine : DEFAULTS.showZeroLine;
    panel.addChild(new gadgets.CheckboxGadgetInfo(
      'awShowZeroLine',
      messages.ADVWATERFALL_SHOW_ZERO_LINE || 'Show Zero Line',
      messages.ADVWATERFALL_SHOW_ZERO_LINE_TIP || 'Vertical reference line at zero',
      new gadgets.CheckboxGadgetValueProperties(euidef.GadgetTypeIDs.CHECKBOX, ckZero, ckZero),
      0, false
    ));

    // Step Shading
    var ckShade = typeof w.stepShading === 'boolean' ? w.stepShading : DEFAULTS.stepShading;
    panel.addChild(new gadgets.CheckboxGadgetInfo(
      'awStepShading',
      messages.ADVWATERFALL_STEP_SHADING || 'Step Shading',
      messages.ADVWATERFALL_STEP_SHADING_TIP || 'Vary lightness across steps within a category',
      new gadgets.CheckboxGadgetValueProperties(euidef.GadgetTypeIDs.CHECKBOX, ckShade, ckShade),
      0, false
    ));

    // Step Shading Range (slider 0-100, stored as 0-1)
    var initialShadeRange = Math.round(((typeof w.stepShadingRange === 'number') ? w.stepShadingRange : DEFAULTS.stepShadingRange) * 100);
    panel.addChild(new gadgets.SliderGadgetInfo(
      'awStepShadingRange',
      messages.ADVWATERFALL_SHADING_RANGE || 'Shading Range',
      messages.ADVWATERFALL_SHADING_RANGE_TIP || 'How much lightness varies across steps',
      new gadgets.SliderGadgetValueProperties(euidef.GadgetTypeIDs.SLIDER, initialShadeRange, 0, 100, 5),
      0, false, null,
      { fValueFormatter: function(v) { return v + '%'; } }
    ));

    // Mark Negatives (hatch)
    var ckHatch = typeof w.markNegativeSegments === 'boolean' ? w.markNegativeSegments : DEFAULTS.markNegativeSegments;
    panel.addChild(new gadgets.CheckboxGadgetInfo(
      'awMarkNegatives',
      messages.ADVWATERFALL_MARK_NEGATIVES || 'Mark Negative Segments',
      messages.ADVWATERFALL_MARK_NEGATIVES_TIP || 'Diagonal hatch overlay on negative-delta segments',
      new gadgets.CheckboxGadgetValueProperties(euidef.GadgetTypeIDs.CHECKBOX, ckHatch, ckHatch),
      0, false
    ));

    // Strip Label Prefix
    var ckStrip = typeof w.stripLabelPrefix === 'boolean' ? w.stripLabelPrefix : DEFAULTS.stripLabelPrefix;
    panel.addChild(new gadgets.CheckboxGadgetInfo(
      'awStripLabelPrefix',
      messages.ADVWATERFALL_STRIP_PREFIX || 'Strip Sort Prefix',
      messages.ADVWATERFALL_STRIP_PREFIX_TIP || 'Hide leading numeric prefix from displayed labels',
      new gadgets.CheckboxGadgetValueProperties(euidef.GadgetTypeIDs.CHECKBOX, ckStrip, ckStrip),
      0, false
    ));

    // Bar Gap (slider 0-95, stored as 0-1)
    var initialBarGap = Math.round(((typeof w.barGap === 'number') ? w.barGap : DEFAULTS.barGap) * 100);
    panel.addChild(new gadgets.SliderGadgetInfo(
      'awBarGap',
      messages.ADVWATERFALL_BAR_GAP || 'Bar Gap',
      messages.ADVWATERFALL_BAR_GAP_TIP || 'Spacing between bars as a % of band width',
      new gadgets.SliderGadgetValueProperties(euidef.GadgetTypeIDs.SLIDER, initialBarGap, 0, 95, 1),
      0, false, null,
      { fValueFormatter: function(v) { return v + '%'; } }
    ));

    // Subtotal / End color
    panel.addChild(new gadgets.ColorPickerGadgetInfo(
      'awSubtotalColor',
      messages.ADVWATERFALL_SUBTOTAL_COLOR || 'End / Subtotal Color',
      messages.ADVWATERFALL_SUBTOTAL_COLOR_TIP || 'Color used for the synthetic End row',
      new gadgets.GadgetValueProperties(euidef.GadgetTypeIDs.COLOR_PICKER, w.subtotalColor || DEFAULTS.subtotalColor),
      0, false, null,
      { sDefaultValue: DEFAULTS.subtotalColor }
    ));

    // Number Format
    var lblNFAuto = messages.ADVWATERFALL_NUMBER_FORMAT_AUTO || 'Auto';
    var lblNFNum  = messages.ADVWATERFALL_NUMBER_FORMAT_NUMBER || 'Number';
    var lblNFCur  = messages.ADVWATERFALL_NUMBER_FORMAT_CURRENCY || 'Currency';
    var lblNFPct  = messages.ADVWATERFALL_NUMBER_FORMAT_PERCENT || 'Percent';
    var fmtOptions = [
      new gadgets.OptionInfo('auto',     lblNFAuto, lblNFAuto),
      new gadgets.OptionInfo('comma',    lblNFNum,  lblNFNum),
      new gadgets.OptionInfo('currency', lblNFCur,  lblNFCur),
      new gadgets.OptionInfo('percent',  lblNFPct,  lblNFPct)
    ];
    var lblFmt = messages.ADVWATERFALL_NUMBER_FORMAT || 'Number Format';
    panel.addChild(new gadgets.SingleSelectGadgetInfo(
      'awNumberFormat', lblFmt, lblFmt,
      new gadgets.GadgetValueProperties(
        euidef.GadgetTypeIDs.SINGLE_SELECT,
        w.numberFormat || DEFAULTS.numberFormat,
        { ariaLabel: lblFmt }
      ),
      0, false, fmtOptions
    ));

    panel.addChild(new gadgets.TextGadgetInfo(
      'awCurrencySymbol',
      messages.ADVWATERFALL_CURRENCY_SYMBOL || 'Currency Symbol',
      messages.ADVWATERFALL_CURRENCY_SYMBOL_TIP || 'Symbol prefixed when Number Format = Currency',
      new gadgets.GadgetValueProperties(
        euidef.GadgetTypeIDs.TEXT_FIELD,
        typeof w.currencySymbol === 'string' ? w.currencySymbol : DEFAULTS.currencySymbol
      ),
      0, false, null,
      { sPlaceholderText: '$' }
    ));

    var initialDecimals = typeof w.numberDecimals === 'number' ? w.numberDecimals : DEFAULTS.numberDecimals;
    panel.addChild(new gadgets.SliderGadgetInfo(
      'awNumberDecimals',
      messages.ADVWATERFALL_DECIMALS || 'Decimal Places',
      messages.ADVWATERFALL_DECIMALS_TIP || 'Number of digits after the decimal point (0-6)',
      new gadgets.SliderGadgetValueProperties(euidef.GadgetTypeIDs.SLIDER, initialDecimals, 0, 6, 1),
      0, false, null,
      { fValueFormatter: function(v) { return String(v); } }
    ));

    var thousandSepOptions = [
      new gadgets.OptionInfo(',', 'Comma (1,234)',  'Comma (1,234)'),
      new gadgets.OptionInfo('.', 'Period (1.234)', 'Period (1.234)'),
      new gadgets.OptionInfo(' ', 'Space (1 234)',  'Space (1 234)'),
      new gadgets.OptionInfo('',  'None (1234)',    'None (1234)')
    ];
    var lblSep = messages.ADVWATERFALL_THOUSAND_SEP || 'Thousand Separator';
    panel.addChild(new gadgets.SingleSelectGadgetInfo(
      'awNumberThousandSep', lblSep, lblSep,
      new gadgets.GadgetValueProperties(
        euidef.GadgetTypeIDs.SINGLE_SELECT,
        typeof w.numberThousandSep === 'string' ? w.numberThousandSep : DEFAULTS.numberThousandSep,
        { ariaLabel: lblSep }
      ),
      0, false, thousandSepOptions
    ));

    var abbrOptions = [
      new gadgets.OptionInfo('default', 'Default (full digits)',     'Default'),
      new gadgets.OptionInfo('auto',    'Auto (1.5K / 1.5M / 1.5B)', 'Auto'),
      new gadgets.OptionInfo('K',       'Thousands (K)',             'Thousands'),
      new gadgets.OptionInfo('M',       'Millions (M)',              'Millions'),
      new gadgets.OptionInfo('B',       'Billions (B)',              'Billions')
    ];
    var lblAbbr = messages.ADVWATERFALL_ABBREVIATION || 'Abbreviation';
    panel.addChild(new gadgets.SingleSelectGadgetInfo(
      'awNumberAbbreviation', lblAbbr, lblAbbr,
      new gadgets.GadgetValueProperties(
        euidef.GadgetTypeIDs.SINGLE_SELECT,
        w.numberAbbreviation || DEFAULTS.numberAbbreviation,
        { ariaLabel: lblAbbr }
      ),
      0, false, abbrOptions
    ));

    var negStyleOptions = [
      new gadgets.OptionInfo('minus',    '-123',  '-123'),
      new gadgets.OptionInfo('parens',   '(123)', '(123)'),
      new gadgets.OptionInfo('trailing', '123-',  '123-')
    ];
    var lblNeg = messages.ADVWATERFALL_NEGATIVE_STYLE || 'Negative Values';
    panel.addChild(new gadgets.SingleSelectGadgetInfo(
      'awNumberNegativeStyle', lblNeg, lblNeg,
      new gadgets.GadgetValueProperties(
        euidef.GadgetTypeIDs.SINGLE_SELECT,
        w.numberNegativeStyle || DEFAULTS.numberNegativeStyle,
        { ariaLabel: lblNeg }
      ),
      0, false, negStyleOptions
    ));

    // Reset Defaults
    panel.addChild(new gadgets.CheckboxGadgetInfo(
      'awResetDefaults',
      messages.ADVWATERFALL_RESET || 'Reset to defaults',
      messages.ADVWATERFALL_RESET_TIP || 'Click to clear all advanced waterfall settings',
      new gadgets.CheckboxGadgetValueProperties(euidef.GadgetTypeIDs.CHECKBOX, false, false),
      0, false
    ));

    AdvWaterfall.superClass._addVizSpecificPropsDialog.call(this, oTabbedPanelsGadgetInfo);
  };

  AdvWaterfall.prototype._handlePropChange = function(sGadgetID, oPropChange, oViewSettings, oActionContext) {
    var conf = oViewSettings.getViewConfigJSON(dataviz.SettingsNS.CHART) || {};
    var bUpdateSettings = AdvWaterfall.superClass._handlePropChange.call(
      this, sGadgetID, oPropChange, oViewSettings, oActionContext
    );
    if (typeof this._handleLegendPropChange === 'function') {
      if (this._handleLegendPropChange(conf, sGadgetID, oPropChange, oViewSettings, oActionContext)) {
        bUpdateSettings = true;
      }
    }
    if (sGadgetID === 'awResetDefaults') {
      conf.advWaterfall = {};
      oViewSettings.setViewConfigJSON(dataviz.SettingsNS.CHART, conf);
      return true;
    }
    var AW_GADGET_TO_KEY = {
      awCategoryDetailMode:   { key: 'categoryDetailMode' },
      awListSort:             { key: 'listSort' },
      awShowEnd:              { key: 'showEnd' },
      awShowConnectors:       { key: 'showConnectors' },
      awEndLabel:             { key: 'endLabel' },
      awShowZeroLine:         { key: 'showZeroLine' },
      awStepShading:          { key: 'stepShading' },
      awStepShadingRange:     { key: 'stepShadingRange', transform: function(v){ return Math.max(0, Math.min(100, Number(v))) / 100; } },
      awMarkNegatives:        { key: 'markNegativeSegments' },
      awStripLabelPrefix:     { key: 'stripLabelPrefix' },
      awBarGap:               { key: 'barGap',           transform: function(v){ return Math.max(0, Math.min(95, Number(v))) / 100; } },
      awSubtotalColor:        { key: 'subtotalColor' },
      awNumberFormat:         { key: 'numberFormat' },
      awCurrencySymbol:       { key: 'currencySymbol' },
      awNumberDecimals:       { key: 'numberDecimals',  transform: function(v){ return Math.max(0, Math.min(6, Number(v))); } },
      awNumberThousandSep:    { key: 'numberThousandSep' },
      awNumberAbbreviation:   { key: 'numberAbbreviation' },
      awNumberNegativeStyle:  { key: 'numberNegativeStyle' }
    };
    var mapping = AW_GADGET_TO_KEY[sGadgetID];
    if (mapping && oPropChange) {
      var raw = oPropChange.getValue && oPropChange.getValue();
      if (raw === undefined || raw === null) raw = oPropChange.value;
      if (raw === undefined || raw === null) raw = oPropChange;
      var newVal = raw;
      if (raw && typeof raw === 'object') {
        if ('checked' in raw)             newVal = raw.checked;
        else if ('transientValue' in raw) newVal = raw.transientValue;
        else if ('value' in raw)          newVal = raw.value;
      }
      if (!conf.advWaterfall) conf.advWaterfall = {};
      conf.advWaterfall[mapping.key] = mapping.transform ? mapping.transform(newVal) : newVal;
      oViewSettings.setViewConfigJSON(dataviz.SettingsNS.CHART, conf);
      bUpdateSettings = true;
    }
    return bUpdateSettings;
  };

  AdvWaterfall.prototype._isOnlyPhysicalRowEdge = function() { return false; };

  AdvWaterfall.prototype._onDefaultColorsSettingsChanged = function() {
    var v = this.assertOrCreateVizContext();
    this._render(this.createRenderingContext(v));
  };

  AdvWaterfall.prototype.resizeVisualization = function(dim, v) {
    this._render(this.createRenderingContext(v));
  };

  function createClientComponent(sID, sDisplayName, sOrigin) {
    return new AdvWaterfall(sID, sDisplayName, sOrigin, AdvWaterfall.VERSION);
  }
  return { createClientComponent: createClientComponent };
});
