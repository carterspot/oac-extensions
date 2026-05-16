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
    showGlyph: true,
    glyphRadius: 4,
    showShortfall: true,
    conditionalColor: true,
    showValueLabels: true,
    valueLabelPosition: 'outside-right',
    showTargetLabel: true
  };

  function getSettings(self) {
    var cfg = (self.getViewConfig && self.getViewConfig()) || {};
    var t = cfg.targetBar || {};
    function b(k){ return typeof t[k] === 'boolean' ? t[k] : DEFAULTS[k]; }
    return {
      barColor:           t.barColor           || DEFAULTS.barColor,
      belowColor:         t.belowColor         || DEFAULTS.belowColor,
      targetColor:        t.targetColor        || DEFAULTS.targetColor,
      showGlyph:          b('showGlyph'),
      showShortfall:      b('showShortfall'),
      conditionalColor:   b('conditionalColor'),
      showValueLabels:    b('showValueLabels'),
      valueLabelPosition: t.valueLabelPosition || DEFAULTS.valueLabelPosition,
      showTargetLabel:    b('showTargetLabel')
    };
  }

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
    var nMeasures = 1;
    try {
      var oDataModel = this.getRootDataModel();
      if (oDataModel && oDataModel.getColumnIDsIn) {
        var aCols = oDataModel.getColumnIDsIn(datamodelshapes.Physical.DATA);
        if (aCols && aCols.length) nMeasures = aCols.length;
      }
    } catch (e) {}

    var aOut = [];
    for (var i = 0; i < nRows; i++) {
      var category = oDataLayout.getValue(datamodelshapes.Physical.ROW, 0, i);
      var actual = null, target = null;
      try { actual = oDataLayout.getValue(datamodelshapes.Physical.DATA, i, 0); } catch (e) {}
      if (nMeasures > 1) {
        try { target = oDataLayout.getValue(datamodelshapes.Physical.DATA, i, 1); } catch (e) {}
      }
      aOut.push({
        category: category,
        actual: Number(actual),
        target: (target == null || target === '') ? null : Number(target)
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
      var s = getSettings(this);

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
        var fill = (s.conditionalColor && below) ? s.belowColor : s.barColor;

        // Tooltip text — includes variance when target present
        var tip = String(d.category) + ': ' + fmt(d.actual);
        if (hasTarget) {
          var diff = d.actual - d.target;
          var pct = d.target !== 0 ? (diff / d.target) * 100 : 0;
          var sign = diff > 0 ? '+' : (diff < 0 ? '-' : '');
          tip += '  (target ' + fmt(d.target) + ')';
          tip += '\nΔ ' + sign + fmt(Math.abs(diff)) + '  (' + sign + Math.abs(pct).toFixed(1) + '%)';
        }

        // Bar
        plot.append('rect')
          .attr('class', 'target-bar-bar')
          .attr('x', 0).attr('y', y)
          .attr('width', Math.max(1, x(d.actual)))
          .attr('height', rectHeight)
          .attr('fill', fill)
          .append('title').text(tip);

        // Shortfall connector: faint dashed line from bar-end to target tick when below
        if (below && s.showShortfall) {
          plot.append('line')
            .attr('class', 'target-bar-shortfall')
            .attr('x1', x(d.actual)).attr('x2', x(d.target))
            .attr('y1', y + rectHeight / 2).attr('y2', y + rectHeight / 2)
            .attr('stroke', s.belowColor)
            .attr('stroke-width', 1)
            .attr('stroke-dasharray', '3,3')
            .attr('opacity', 0.6);
        }

        // Target hash
        if (hasTarget) {
          var tx = x(d.target);
          plot.append('line')
            .attr('class', 'target-bar-target')
            .attr('x1', tx).attr('x2', tx)
            .attr('y1', y - 3).attr('y2', y + rectHeight + 3)
            .attr('stroke', s.targetColor)
            .attr('stroke-width', 2);
        }

        // Actual value label — position per setting, with inside-too-narrow fallback
        if (s.showValueLabels) {
          var actualText = fmt(d.actual);
          var actualW = actualText.length * 6.5; // rough estimate
          var barW = Math.max(1, x(d.actual));
          var ax, anchor, color;
          var pos = s.valueLabelPosition;
          var fits = barW > actualW + 12;
          if (pos === 'inside-left' && fits) {
            ax = 6; anchor = 'start'; color = '#fff';
          } else if (pos === 'inside-right' && fits) {
            ax = barW - 6; anchor = 'end'; color = '#fff';
          } else {
            ax = barW + 6; anchor = 'start'; color = 'currentColor';
          }
          plot.append('text')
            .attr('class', 'target-bar-actual-label')
            .attr('x', ax).attr('y', y + rectHeight / 2)
            .attr('text-anchor', anchor)
            .attr('dominant-baseline', 'central')
            .attr('font-family', FONT).attr('font-size', VAL_SIZE)
            .attr('fill', color)
            .text(actualText);
        }

        // Target value label at hash mark, italic gray, with collision flip
        if (s.showValueLabels && s.showTargetLabel && hasTarget) {
          var targetText = fmt(d.target);
          var tcx = x(d.target);
          var actualLabelRight = Math.max(1, x(d.actual)) + 6 + (fmt(d.actual).length * 6.5);
          var collision = (s.valueLabelPosition === 'outside-right' || !((s.valueLabelPosition === 'inside-left' || s.valueLabelPosition === 'inside-right') && Math.max(1, x(d.actual)) > fmt(d.actual).length * 6.5 + 12)) && Math.abs(tcx - actualLabelRight) < 40;
          var ty = collision ? (y + rectHeight + 9) : (y - 3);
          var baseline = collision ? 'hanging' : 'auto';
          plot.append('text')
            .attr('class', 'target-bar-target-label')
            .attr('x', tcx).attr('y', ty)
            .attr('text-anchor', 'middle')
            .attr('dominant-baseline', baseline)
            .attr('font-family', FONT).attr('font-size', 9)
            .attr('font-style', 'italic')
            .attr('fill', 'currentColor')
            .attr('opacity', 0.65)
            .text(targetText);
        }

        // Status dot (left gutter) — always conditional, independent of bar coloring
        if (s.showGlyph) {
          svg.append('circle')
            .attr('class', 'target-bar-glyph')
            .attr('cx', margin.left - 8)
            .attr('cy', margin.top + y + rectHeight / 2)
            .attr('r', DEFAULTS.glyphRadius)
            .attr('fill', below ? s.belowColor : s.barColor);
        }

        // Category label (left gutter, with offset for dot if present)
        var labelX = s.showGlyph ? margin.left - 18 : margin.left - 6;
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

  // ---- Properties panel ---------------------------------------------------
  TargetBar.prototype._addVizSpecificPropsDialog = function(oTabbedPanelsGadgetInfo) {
    var cfg = this.getViewConfig() || {};
    var t = cfg.targetBar || {};
    var panel = gadgetdialog.forcePanelByID(oTabbedPanelsGadgetInfo, euidef.GD_PANEL_ID_STYLE);

    var lblShowGlyph = 'Show status dot';
    var ckGlyph = typeof t.showGlyph === 'boolean' ? t.showGlyph : DEFAULTS.showGlyph;
    panel.addChild(new gadgets.CheckboxGadgetInfo(
      'tbShowGlyph', lblShowGlyph, 'Colored dot in the left gutter, one per row',
      new gadgets.CheckboxGadgetValueProperties(euidef.GadgetTypeIDs.CHECKBOX, ckGlyph, ckGlyph),
      0, false
    ));

    var lblShortfall = 'Show shortfall connector';
    var ckShort = typeof t.showShortfall === 'boolean' ? t.showShortfall : DEFAULTS.showShortfall;
    panel.addChild(new gadgets.CheckboxGadgetInfo(
      'tbShowShortfall', lblShortfall, 'Dashed line from bar-end to target tick when below target',
      new gadgets.CheckboxGadgetValueProperties(euidef.GadgetTypeIDs.CHECKBOX, ckShort, ckShort),
      0, false
    ));

    var lblBarColor = 'Above-target bar color';
    panel.addChild(new gadgets.ColorPickerGadgetInfo(
      'tbBarColor', lblBarColor, lblBarColor,
      new gadgets.GadgetValueProperties(euidef.GadgetTypeIDs.COLOR_PICKER, t.barColor || DEFAULTS.barColor, { ariaLabel: lblBarColor }),
      0, false, null,
      { sDefaultValue: DEFAULTS.barColor }
    ));

    var lblBelowColor = 'Below-target bar color';
    panel.addChild(new gadgets.ColorPickerGadgetInfo(
      'tbBelowColor', lblBelowColor, lblBelowColor,
      new gadgets.GadgetValueProperties(euidef.GadgetTypeIDs.COLOR_PICKER, t.belowColor || DEFAULTS.belowColor, { ariaLabel: lblBelowColor }),
      0, false, null,
      { sDefaultValue: DEFAULTS.belowColor }
    ));

    var lblTargetColor = 'Target hash color';
    panel.addChild(new gadgets.ColorPickerGadgetInfo(
      'tbTargetColor', lblTargetColor, lblTargetColor,
      new gadgets.GadgetValueProperties(euidef.GadgetTypeIDs.COLOR_PICKER, t.targetColor || DEFAULTS.targetColor, { ariaLabel: lblTargetColor }),
      0, false, null,
      { sDefaultValue: DEFAULTS.targetColor }
    ));

    var ckCond = typeof t.conditionalColor === 'boolean' ? t.conditionalColor : DEFAULTS.conditionalColor;
    panel.addChild(new gadgets.CheckboxGadgetInfo(
      'tbConditionalColor', 'Color bars by target', 'When off, all bars use the above-target color regardless of target comparison',
      new gadgets.CheckboxGadgetValueProperties(euidef.GadgetTypeIDs.CHECKBOX, ckCond, ckCond),
      0, false
    ));

    var ckLbls = typeof t.showValueLabels === 'boolean' ? t.showValueLabels : DEFAULTS.showValueLabels;
    panel.addChild(new gadgets.CheckboxGadgetInfo(
      'tbShowValueLabels', 'Show value labels', 'Show actual and target value labels',
      new gadgets.CheckboxGadgetValueProperties(euidef.GadgetTypeIDs.CHECKBOX, ckLbls, ckLbls),
      0, false
    ));

    var lblPos = 'Value label position';
    var posOptions = [
      new gadgets.OptionInfo('outside-right', 'Outside (right of bar)', 'Outside (right of bar)'),
      new gadgets.OptionInfo('inside-right',  'Inside (right end)',     'Inside (right end)'),
      new gadgets.OptionInfo('inside-left',   'Inside (left end)',      'Inside (left end)')
    ];
    panel.addChild(new gadgets.SingleSelectGadgetInfo(
      'tbValueLabelPosition', lblPos, lblPos,
      new gadgets.GadgetValueProperties(
        euidef.GadgetTypeIDs.SINGLE_SELECT,
        t.valueLabelPosition || DEFAULTS.valueLabelPosition,
        { ariaLabel: lblPos }
      ),
      0, false, posOptions
    ));

    var ckTgtLbl = typeof t.showTargetLabel === 'boolean' ? t.showTargetLabel : DEFAULTS.showTargetLabel;
    panel.addChild(new gadgets.CheckboxGadgetInfo(
      'tbShowTargetLabel', 'Show target value', 'Show target value at the hash mark (auto-flips below the bar to avoid collision)',
      new gadgets.CheckboxGadgetValueProperties(euidef.GadgetTypeIDs.CHECKBOX, ckTgtLbl, ckTgtLbl),
      0, false
    ));

    TargetBar.superClass._addVizSpecificPropsDialog.call(this, oTabbedPanelsGadgetInfo);
  };

  var TB_GADGET_TO_KEY = {
    tbShowGlyph:          'showGlyph',
    tbShowShortfall:      'showShortfall',
    tbBarColor:           'barColor',
    tbBelowColor:         'belowColor',
    tbTargetColor:        'targetColor',
    tbConditionalColor:   'conditionalColor',
    tbShowValueLabels:    'showValueLabels',
    tbValueLabelPosition: 'valueLabelPosition',
    tbShowTargetLabel:    'showTargetLabel'
  };

  TargetBar.prototype._handlePropChange = function(sGadgetID, oPropChange, oViewSettings, oActionContext) {
    var conf = oViewSettings.getViewConfigJSON(dataviz.SettingsNS.CHART) || {};
    var bUpdateSettings = TargetBar.superClass._handlePropChange.call(this, sGadgetID, oPropChange, oViewSettings, oActionContext);
    if (typeof this._handleLegendPropChange === 'function') {
      if (this._handleLegendPropChange(conf, sGadgetID, oPropChange, oViewSettings, oActionContext)) {
        bUpdateSettings = true;
      }
    }
    var key = TB_GADGET_TO_KEY[sGadgetID];
    if (key && oPropChange) {
      var raw = oPropChange.getValue && oPropChange.getValue();
      if (raw === undefined || raw === null) raw = oPropChange.value;
      if (raw === undefined || raw === null) raw = oPropChange;
      var newVal = raw;
      if (raw && typeof raw === 'object') {
        if ('checked' in raw)             newVal = raw.checked;
        else if ('transientValue' in raw) newVal = raw.transientValue;
        else if ('value' in raw)          newVal = raw.value;
      }
      if (!conf.targetBar) conf.targetBar = {};
      conf.targetBar[key] = newVal;
      oViewSettings.setViewConfigJSON(dataviz.SettingsNS.CHART, conf);
      bUpdateSettings = true;
    }
    return bUpdateSettings;
  };

  return targetBar;
});
