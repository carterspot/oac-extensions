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
  'ojL10n!com-company-targetBar/nls/messages',
  'obitech-framework/messageformat',
  'css!com-company-targetBar/targetBarstyles'
], function(
  $, jsx, data, gadgets, euidef, gadgetdialog, ko, dataviz,
  legendandvizcontainer, datamodelshapes, d3, events, logger, messages
) {
  'use strict';

  var MODULE_NAME = 'com-company-targetBar/targetBar';
  jsx.assertAllNotNullExceptLastN(arguments, 'targetBar.js arguments', 2);
  var _logger = new logger.Logger(MODULE_NAME);

  var DEFAULTS = {
    barColor: '#7AA8C4',
    belowColor: '#C46B6B',
    targetColor: '#3A3A3A',
    barGapPct: 35,
    showBelowGlyph: true,
    belowGlyph: '✗'
  };

  var targetBar = {};

  TargetBar.VERSION = '1.0.0';

  function TargetBar(sID, sDisplayName, sOrigin, sVersion) {
    TargetBar.baseConstructor.call(this, sID, sDisplayName, sOrigin, sVersion);
  }
  jsx.extend(TargetBar, dataviz.DataVisualization);
  targetBar.TargetBar = TargetBar;

  targetBar.createClientComponent = function(sID, sDisplayName, sOrigin) {
    return new TargetBar(sID, sDisplayName, sOrigin, TargetBar.VERSION);
  };

  // ---- Data extraction -----------------------------------------------------
  // Returns array of { category, actual, target, color }
  // 1 measure  -> target = null (no hash mark)
  // 2 measures -> column 0 = actual, column 1 = target
  TargetBar.prototype.myGenerateData = function(oDataLayout, ctx) {
    if (!oDataLayout) return null;
    var nRows = oDataLayout.getEdgeExtent(datamodelshapes.Physical.ROW);
    var nMeasures = 0;
    try { nMeasures = oDataLayout.getEdgeExtent(datamodelshapes.Physical.COLUMN); } catch (e) {}
    if (!nMeasures) {
      // probe column 0 — getValue throws if unbound
      try { oDataLayout.getValue(datamodelshapes.Physical.DATA, 0, 0); nMeasures = 1; } catch (e) {}
      try { oDataLayout.getValue(datamodelshapes.Physical.DATA, 0, 1); nMeasures = 2; } catch (e) {}
    }
    var oHelper = ctx.get(dataviz.DataContextProperty.DATA_LAYOUT_HELPER);
    var oColorCtx = this.getColorContext(ctx);
    var oColorInterp = this.getCachedColorInterpolator(ctx, datamodelshapes.Logical.COLOR);

    var aOut = [];
    for (var i = 0; i < nRows; i++) {
      var category = oDataLayout.getValue(datamodelshapes.Physical.ROW, 0, i);
      var actual = null, target = null;
      try { actual = oDataLayout.getValue(datamodelshapes.Physical.DATA, i, 0); } catch (e) {}
      if (nMeasures > 1) {
        try { target = oDataLayout.getValue(datamodelshapes.Physical.DATA, i, 1); } catch (e) {}
      }
      var ci = this.getDataItemColorInfo(oHelper, oColorCtx, oColorInterp, i, 0);
      aOut.push({
        category: category,
        actual: Number(actual),
        target: target == null ? null : Number(target),
        color: (ci && ci.sColor) || null
      });
    }
    return aOut.length ? aOut : null;
  };

  // ---- Render --------------------------------------------------------------
  function detectThemeTextColor(el) {
    try { return getComputedStyle(el).color || '#3A3A3A'; }
    catch (e) { return '#3A3A3A'; }
  }

  function fmt(v) {
    if (v == null || isNaN(v)) return '';
    var n = Number(v);
    if (Math.abs(n) >= 1e6) return (n / 1e6).toFixed(1).replace(/\.0$/, '') + 'M';
    if (Math.abs(n) >= 1e3) return (n / 1e3).toFixed(1).replace(/\.0$/, '') + 'K';
    return String(Math.round(n));
  }

  TargetBar.prototype._render = function(ctx) {
    try {
      var elContainer = this.getContainerElem();
      var $root = $(elContainer).empty().addClass('target-bar-root');
      var oDataLayout = ctx.get(dataviz.DataContextProperty.DATA_LAYOUT);
      var dataset = this.myGenerateData(oDataLayout, ctx);

      var width  = $root.width()  || 400;
      var height = $root.height() || 300;
      var svg = d3.select(elContainer).append('svg')
        .attr('width', width).attr('height', height);
      svg.style('color', detectThemeTextColor(elContainer));

      if (!dataset || !dataset.length) {
        svg.append('text')
          .attr('x', 16).attr('y', 24)
          .attr('fill', 'currentColor')
          .text((messages && messages.TARGETBAR_NO_DATA) || 'Drop a Category and 1-2 measures (Actual, Target) to begin.');
        return;
      }

      // Measure label widths to set left margin
      var FONT = 'sans-serif', LABEL_SIZE = 12, VAL_SIZE = 11;
      var probe = svg.append('text').attr('font-family', FONT).attr('font-size', LABEL_SIZE)
        .attr('visibility', 'hidden');
      var widestLabel = 0;
      dataset.forEach(function(d) {
        probe.text(String(d.category == null ? '' : d.category));
        var w = probe.node().getComputedTextLength ? probe.node().getComputedTextLength() : String(d.category).length * 7;
        if (w > widestLabel) widestLabel = w;
      });
      probe.remove();

      var margin = {
        top: 16,
        right: 60,
        bottom: 28,
        left: Math.min(Math.ceil(widestLabel) + 16, Math.floor(width * 0.3))
      };
      var plotW = Math.max(40, width - margin.left - margin.right);
      var plotH = Math.max(40, height - margin.top - margin.bottom);

      // X domain: 0 .. max(actual, target) * 1.05
      var maxV = 0;
      dataset.forEach(function(d) {
        if (d.actual > maxV) maxV = d.actual;
        if (d.target != null && d.target > maxV) maxV = d.target;
      });
      if (maxV <= 0) maxV = 1;
      var x = d3.scale.linear().domain([0, maxV * 1.05]).range([0, plotW]);

      var bandHeight = plotH / dataset.length;
      var rectHeight = Math.max(4, bandHeight * (1 - DEFAULTS.barGapPct / 100));
      var rectYOffset = (bandHeight - rectHeight) / 2;

      var plot = svg.append('g').attr('transform', 'translate(' + margin.left + ',' + margin.top + ')');

      dataset.forEach(function(d, i) {
        var y = i * bandHeight + rectYOffset;
        var hasTarget = d.target != null && !isNaN(d.target);
        var below = hasTarget && d.actual < d.target;
        var fill = below ? DEFAULTS.belowColor : (d.color || DEFAULTS.barColor);

        // Bar
        plot.append('rect')
          .attr('class', 'target-bar-bar')
          .attr('x', 0).attr('y', y)
          .attr('width', Math.max(1, x(d.actual)))
          .attr('height', rectHeight)
          .attr('fill', fill)
          .append('title').text(String(d.category) + ': ' + fmt(d.actual) +
            (hasTarget ? '  (target ' + fmt(d.target) + ')' : ''));

        // Target hash
        if (hasTarget) {
          var tx = x(d.target);
          plot.append('line')
            .attr('class', 'target-bar-target')
            .attr('x1', tx).attr('x2', tx)
            .attr('y1', y - 3).attr('y2', y + rectHeight + 3)
            .attr('stroke', DEFAULTS.targetColor)
            .attr('stroke-width', 2);
        }

        // Actual value label (right of bar)
        plot.append('text')
          .attr('x', Math.max(1, x(d.actual)) + 6)
          .attr('y', y + rectHeight / 2)
          .attr('dominant-baseline', 'central')
          .attr('font-family', FONT).attr('font-size', VAL_SIZE)
          .attr('fill', 'currentColor')
          .text(fmt(d.actual));

        // Below-target glyph (left gutter)
        if (below && DEFAULTS.showBelowGlyph) {
          svg.append('text')
            .attr('class', 'target-bar-below-glyph')
            .attr('x', margin.left - 6)
            .attr('y', margin.top + y + rectHeight / 2)
            .attr('text-anchor', 'end')
            .attr('dominant-baseline', 'central')
            .attr('font-family', FONT).attr('font-size', LABEL_SIZE)
            .attr('fill', DEFAULTS.belowColor)
            .text(DEFAULTS.belowGlyph);
        }

        // Category label (left gutter, with offset for glyph if present)
        var labelX = below && DEFAULTS.showBelowGlyph ? margin.left - 18 : margin.left - 6;
        svg.append('text')
          .attr('x', labelX)
          .attr('y', margin.top + y + rectHeight / 2)
          .attr('text-anchor', 'end')
          .attr('dominant-baseline', 'central')
          .attr('font-family', FONT).attr('font-size', LABEL_SIZE)
          .attr('fill', 'currentColor')
          .text(String(d.category == null ? '' : d.category))
          .append('title').text(String(d.category));
      });

      // X-axis
      var xAxis = d3.svg.axis().scale(x).orient('bottom').ticks(5).tickFormat(fmt);
      var axisG = svg.append('g')
        .attr('transform', 'translate(' + margin.left + ',' + (margin.top + plotH) + ')')
        .attr('font-family', FONT).attr('font-size', 10)
        .attr('fill', 'currentColor');
      axisG.call(xAxis);
      axisG.selectAll('path, line').attr('stroke', 'currentColor').attr('opacity', 0.4);
      axisG.selectAll('text').attr('fill', 'currentColor');
    } finally {
      this._setIsRendered(true);
    }
  };

  TargetBar.prototype.render = function(ctx) { this._render(ctx); };

  TargetBar.prototype._isOnlyPhysicalRowEdge = function() { return false; };

  TargetBar.prototype._onDefaultColorsSettingsChanged = function() {
    var v = this.assertOrCreateVizContext();
    this._render(this.createRenderingContext(v));
  };

  TargetBar.prototype.resizeVisualization = function(dim, v) {
    this._render(this.createRenderingContext(v));
  };

  // ---- Properties panel (stub) --------------------------------------------
  TargetBar.prototype._addVizSpecificPropsDialog = function(oTabbedPanelsGadgetInfo) {
    TargetBar.superClass._addVizSpecificPropsDialog.call(this, oTabbedPanelsGadgetInfo);
  };

  TargetBar.prototype._handlePropChange = function(oPropChange) {
    if (typeof TargetBar.superClass._handleLegendPropChange === 'function') {
      TargetBar.superClass._handleLegendPropChange.call(this, oPropChange);
    }
    TargetBar.superClass._handlePropChange.call(this, oPropChange);
  };

  return targetBar;
});
