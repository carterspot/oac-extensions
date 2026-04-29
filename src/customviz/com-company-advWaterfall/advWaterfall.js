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
    numberNegativeStyle: 'minus'
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
      numberNegativeStyle: w.numberNegativeStyle || DEFAULTS.numberNegativeStyle
    };
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
      var obj = { name: oDataLayout.getValue(datamodelshapes.Physical.ROW, 0, i) };
      var ci = this.getDataItemColorInfo(oHelper, oColorCtx, oColorInterp, i, 0);
      obj.color = ci.sColor;
      obj.size = oDataLayout.getValue(datamodelshapes.Physical.DATA, i, 0);
      aOut.push(obj);
    }
    return aOut.length ? aOut : null;
  };

  AdvWaterfall.prototype._render = function(ctx) {
    try {
      var oDataLayout = ctx.get(dataviz.DataContextProperty.DATA_LAYOUT);
      var elContainer = this.getContainerElem();
      $(elContainer).empty();
      var settings = getSettings(this);
      var dataset = this.myGenerateData(oDataLayout, ctx);
      if (!dataset || dataset.length === 0) return;

      // Build renderRows: insert a synthetic subtotal row at each category
      // boundary (= color change) so users see a Subtotal bar between groups.
      var renderRows = [];
      var runningCum = 0;
      for (var i = 0; i < dataset.length; i++) {
        var d = dataset[i];
        var prev = i > 0 ? dataset[i - 1] : null;
        // Insert subtotal BEFORE this row when category changes (and we have
        // accumulated some data rows under the previous category).
        if (prev && d.color !== prev.color && i > 1) {
          renderRows.push({
            name: 'Subtotal',
            size: prev.size, // cumulative at end of previous category
            _isSubtotal: true,
            _categoryColor: prev.color
          });
        }
        renderRows.push({
          name: d.name,
          size: d.size,
          color: d.color,
          _dataIdx: i,
          _prevDataSize: i > 0 ? dataset[i - 1].size : null
        });
      }
      // Final subtotal (= grand total / ending cash)
      if (dataset.length > 1) {
        renderRows.push({
          name: 'Net change',
          size: dataset[dataset.length - 1].size,
          _isSubtotal: true,
          _categoryColor: dataset[dataset.length - 1].color
        });
      }

      var names = renderRows.map(function(r){ return r.name; });
      var sizes = renderRows.map(function(r){ return r.size; });

      // Y-axis label margin sized to widest label
      var Y_FONT = 'sans-serif';
      var Y_FONT_SIZE = 12;
      var widest = 0;
      names.forEach(function(n) {
        var w = measureTextWidth(n, Y_FONT, Y_FONT_SIZE);
        if (w > widest) widest = w;
      });

      var margin = {
        top: 24,
        right: 20,
        bottom: 40,
        left: Math.ceil(widest) + 14
      };
      var width = $(elContainer).width() - 20;
      var height = $(elContainer).height() - 10;

      var svg = d3.select(elContainer).append('svg').attr({ width: width, height: height });
      svg.style('color', detectThemeTextColor(elContainer));

      var bandHeight = (height - margin.bottom - margin.top) / renderRows.length;
      var rectHeight = Math.max(2, bandHeight * (1 - settings.barGap));
      var rectYOffset = (bandHeight - rectHeight) / 2;

      var minVal = Math.min(0, Math.min.apply(null, sizes));
      var maxVal = Math.max.apply(null, sizes);
      var x = d3.scale.linear()
        .domain([minVal, maxVal])
        .range([0, width - margin.left - margin.right]);

      // Helpers ---------------------------------------------------------------
      function barLeft(r) {
        if (r._isSubtotal) return x(0);
        if (r._prevDataSize === null) return x(0);
        return x(Math.min(r._prevDataSize, r.size));
      }
      function barRight(r) {
        if (r._isSubtotal) return x(r.size);
        if (r._prevDataSize === null) return x(r.size);
        return x(Math.max(r._prevDataSize, r.size));
      }
      function barWidth(r) { return Math.max(1, barRight(r) - barLeft(r)); }
      function barColor(r) {
        if (r._isSubtotal) return settings.subtotalColor;
        return r.color || '#888';
      }

      // Bars
      var rectWrapper = svg.append('g')
        .attr('transform', 'translate(' + margin.left + ',' + margin.top + ')');
      rectWrapper.selectAll('rect')
        .data(renderRows).enter().append('rect')
        .attr({
          y: function(d, i) { return i * bandHeight + rectYOffset; },
          x: function(d) { return barLeft(d); },
          width: function(d) { return barWidth(d); },
          height: rectHeight,
          fill: function(d) { return barColor(d); }
        });

      // Connector lines between adjacent bars at the shared value
      var connectorWrapper = svg.append('g')
        .attr('transform', 'translate(' + margin.left + ',' + margin.top + ')');
      for (var ci = 0; ci < renderRows.length - 1; ci++) {
        var sharedX = x(renderRows[ci].size);
        var yTop = ci * bandHeight + rectYOffset + rectHeight;
        var yBottom = (ci + 1) * bandHeight + rectYOffset;
        connectorWrapper.append('line')
          .attr({ x1: sharedX, x2: sharedX, y1: yTop, y2: yBottom })
          .attr('stroke', '#888').attr('stroke-width', 1).attr('stroke-dasharray', '2 2');
      }

      // Data labels — value + delta inside or outside-right
      var autoFill = detectThemeTextColor(elContainer);
      var textWrapper = svg.append('g')
        .attr('transform', 'translate(' + margin.left + ',' + margin.top + ')');
      var text = textWrapper.selectAll('text').data(renderRows).enter().append('text')
        .attr({
          'text-anchor': 'start',
          'dominant-baseline': 'central',
          'font-family': 'sans-serif',
          'font-size': 12,
          'font-weight': '600'
        });
      text.append('tspan')
        .attr({
          y: function(d, i) { return i * bandHeight + bandHeight / 2; },
          x: function(d) { return barRight(d) + 6; }
        })
        .text(function(d) { return formatNumber(d.size, settings); });
      text.attr('fill', autoFill);

      // Y-axis labels (one per row, anchored at margin.left)
      var yAxisG = svg.append('g')
        .attr('transform', 'translate(' + margin.left + ',' + margin.top + ')');
      yAxisG.selectAll('text').data(renderRows).enter().append('text')
        .attr('class', function(d) { return d._isSubtotal ? 'adv-subtotal-label' : ''; })
        .attr('text-anchor', 'end')
        .attr('dominant-baseline', 'central')
        .attr('font-size', Y_FONT_SIZE)
        .attr('x', -8)
        .attr('y', function(d, i) { return i * bandHeight + bandHeight / 2; })
        .attr('fill', 'currentColor')
        .text(function(d) { return d.name; });

      // X-axis at the bottom
      var xAxis = d3.svg.axis().scale(x).tickFormat(function(v) {
        return formatNumber(v, settings);
      });
      svg.append('g')
        .attr('class', 'adv-axis')
        .attr('transform', 'translate(' + margin.left + ',' + (margin.top + (height - margin.bottom - margin.top)) + ')')
        .call(xAxis);
    } finally {
      this._setIsRendered(true);
    }
  };

  AdvWaterfall.prototype.render = function(ctx) { this._render(ctx); };

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
