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
  'ojL10n!com-company-vertWaterfall/nls/messages',
  'obitech-framework/messageformat',
  'css!com-company-vertWaterfall/vertWaterfallstyles'
], function(
  $,
  jsx,
  data,
  gadgets,
  euidef,
  gadgetdialog,
  ko,
  dataviz,
  legendandvizcontainer,
  datamodelshapes,
  d3,
  events,
  logger,
  messages
) {
  'use strict';

  var MODULE_NAME = 'com-company-vertWaterfall/vertWaterfall';

  //Param validation to detect cyclical dependencies (ignore modules not used in resource arguments)
  jsx.assertAllNotNullExceptLastN(arguments, 'vertWaterfall.js arguments', 2);

  var _logger = new logger.Logger(MODULE_NAME);

  // Default waterfall options — match native OAC waterfall look.
  // Read at render time from getViewConfig().waterfall, falling back here.
  var DEFAULTS = {
    increaseColor: '#3BB273',
    decreaseColor: '#E04A2B',
    neutralColor: '#9AA4AD',
    barGap: 0.37,
    dataLabels: 'on',
    dataLabelFont: 'sans-serif',
    dataLabelSize: 12,
    dataLabelBold: true,
    dataLabelItalic: false,
    dataLabelColor: 'auto',
    axisLabels: 'on',
    valuesAxisLabels: 'on',
    axisTitle: '',
    numberFormat: 'auto',
    currencySymbol: '$',
    numberDecimals: 2,
    numberThousandSep: ',',
    numberAbbreviation: 'default',
    numberNegativeStyle: 'minus',
    dataLabelContent: 'valueDelta',
    dataLabelPosition: 'auto',
    showStartTotal: true,
    showEndTotal: true,
    showGrandTotal: true,
    showConnectors: true
  };

  function getWaterfallSettings(viz) {
    var cfg = (viz.getViewConfig && viz.getViewConfig()) || {};
    var wf = cfg.waterfall || {};
    return {
      increaseColor: wf.increaseColor || DEFAULTS.increaseColor,
      decreaseColor: wf.decreaseColor || DEFAULTS.decreaseColor,
      neutralColor: wf.neutralColor || DEFAULTS.neutralColor,
      barGap: typeof wf.barGap === 'number' ? wf.barGap : DEFAULTS.barGap,
      dataLabels: wf.dataLabels || DEFAULTS.dataLabels,
      dataLabelFont: wf.dataLabelFont || DEFAULTS.dataLabelFont,
      dataLabelSize: typeof wf.dataLabelSize === 'number' ? wf.dataLabelSize : DEFAULTS.dataLabelSize,
      dataLabelBold: typeof wf.dataLabelBold === 'boolean' ? wf.dataLabelBold : DEFAULTS.dataLabelBold,
      dataLabelItalic: typeof wf.dataLabelItalic === 'boolean' ? wf.dataLabelItalic : DEFAULTS.dataLabelItalic,
      dataLabelColor: wf.dataLabelColor || DEFAULTS.dataLabelColor,
      axisLabels: wf.axisLabels || DEFAULTS.axisLabels,
      valuesAxisLabels: wf.valuesAxisLabels || DEFAULTS.valuesAxisLabels,
      axisTitle: typeof wf.axisTitle === 'string' ? wf.axisTitle : DEFAULTS.axisTitle,
      numberFormat: wf.numberFormat || DEFAULTS.numberFormat,
      currencySymbol: typeof wf.currencySymbol === 'string' ? wf.currencySymbol : DEFAULTS.currencySymbol,
      numberDecimals: typeof wf.numberDecimals === 'number' ? wf.numberDecimals : DEFAULTS.numberDecimals,
      numberThousandSep: typeof wf.numberThousandSep === 'string' ? wf.numberThousandSep : DEFAULTS.numberThousandSep,
      numberAbbreviation: wf.numberAbbreviation || DEFAULTS.numberAbbreviation,
      numberNegativeStyle: wf.numberNegativeStyle || DEFAULTS.numberNegativeStyle,
      dataLabelContent: wf.dataLabelContent || DEFAULTS.dataLabelContent,
      dataLabelPosition: wf.dataLabelPosition || DEFAULTS.dataLabelPosition,
      showStartTotal: typeof wf.showStartTotal === 'boolean' ? wf.showStartTotal : DEFAULTS.showStartTotal,
      showEndTotal: typeof wf.showEndTotal === 'boolean' ? wf.showEndTotal : DEFAULTS.showEndTotal,
      showGrandTotal: typeof wf.showGrandTotal === 'boolean' ? wf.showGrandTotal : DEFAULTS.showGrandTotal,
      showConnectors: typeof wf.showConnectors === 'boolean' ? wf.showConnectors : DEFAULTS.showConnectors
    };
  }

  // Format a number per the user's number-format settings. Accepts either a
  // settings object or, for backward compat, a fmt string + optional symbol.
  function formatNumber(val, fmtOrSettings, currencySymbol) {
    var n = Number.parseFloat(val);
    if (isNaN(n)) return String(val);

    var s;
    if (typeof fmtOrSettings === 'string') {
      s = { numberFormat: fmtOrSettings, currencySymbol: currencySymbol };
    } else {
      s = fmtOrSettings || {};
    }
    var fmt = s.numberFormat || 'auto';
    var decimals = typeof s.numberDecimals === 'number' ? s.numberDecimals : 2;
    var thousandSep = typeof s.numberThousandSep === 'string' ? s.numberThousandSep : ',';
    var abbreviation = s.numberAbbreviation || 'default';
    var negStyle = s.numberNegativeStyle || 'minus';
    var sym = (typeof s.currencySymbol === 'string' && s.currencySymbol) ? s.currencySymbol : '$';

    // Backward compat: legacy 'abbreviated' preset → auto-abbreviation
    if (fmt === 'abbreviated') {
      fmt = 'auto';
      if (abbreviation === 'default') abbreviation = 'auto';
    }

    // Step 1 — abbreviation: scale magnitude and pick a suffix
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
      // 'default' — no abbreviation
    }

    // Step 2 — percent preset multiplies by 100
    if (fmt === 'percent') working = working * 100;

    // Step 3 — format absolute value with decimals + thousand separator
    var absStr = formatAbs(Math.abs(working), decimals, thousandSep);

    // Step 4 — assemble with prefix/suffix and negative styling
    var isNeg = working < 0;
    var prefix = '';
    var trailing = '';
    if (fmt === 'currency') prefix = sym;
    if (fmt === 'percent') trailing = '%';
    var body = prefix + absStr + suffix + trailing;
    if (!isNeg) return body;
    switch (negStyle) {
      case 'parens':   return '(' + body + ')';
      case 'trailing': return body + '-';
      case 'minus':
      default:         return '-' + body;
    }
  }

  function formatAbs(absN, decimals, sep) {
    var fixed = absN.toFixed(decimals);
    var parts = fixed.split('.');
    var intPart = parts[0];
    var decPart = parts[1];
    if (sep) intPart = intPart.replace(/\B(?=(\d{3})+(?!\d))/g, sep);
    return decimals > 0 && decPart ? intPart + '.' + decPart : intPart;
  }

  // Measure SVG text width by rendering it off-screen and reading
  // getComputedTextLength(). Used to size the left margin from the actual
  // widest y-axis label (issue #13) instead of a px-per-char heuristic.
  function measureTextWidth(text, fontFamily, fontSize) {
    var probe = d3.select(document.body).append('svg')
      .style('position', 'absolute')
      .style('left', '-9999px')
      .style('top', '-9999px')
      .attr('width', 1).attr('height', 1);
    var t = probe.append('text')
      .attr('font-family', fontFamily || 'sans-serif')
      .attr('font-size', fontSize || 12)
      .text(String(text));
    var node = t.node();
    var w = node.getComputedTextLength
      ? node.getComputedTextLength()
      : String(text).length * (fontSize || 12) * 0.55;
    probe.remove();
    return w;
  }

  // The version of our Plugin
  VertWaterfall.VERSION = '1.0.0';

  function getIndex(arr, name) {
    var result = -1;
    for (var i = 0; i < arr.length; i++) {
      if (arr[i] == name) {
        result = i;
        break;
      }
    }
    return result;
  }

  /**
   * The implementation of the vertWaterfall visualization.
   *
   * @constructor
   * @param {string} sID
   * @param {string} sDisplayName
   * @param {string} sOrigin
   * @param {string} sVersion
   * @extends {module:obitech-report/visualization.Visualization}
   * @memberof module:com-company-vertWaterfall/vertWaterfall#
   */
  function VertWaterfall(sID, sDisplayName, sOrigin, sVersion) {
    // Argument validation done by base class
    VertWaterfall.baseConstructor.call(
      this,
      sID,
      sDisplayName,
      sOrigin,
      sVersion
    );
  }
  jsx.extend(VertWaterfall, dataviz.DataVisualization);

  VertWaterfall.prototype.myGenerateData = function(
    oDataLayout,
    oTransientRenderingContext
  ) {
    var oDataModel = this.getRootDataModel();
    if (!oDataModel || !oDataLayout) {
      return;
    }

    var aAllRows = oDataModel.getColumnIDsIn(datamodelshapes.Physical.ROW);
    var aAllData = oDataModel.getColumnIDsIn(datamodelshapes.Physical.DATA);

    //var nMeasures = aAllMeasures.length;
    var nRows = oDataLayout.getEdgeExtent(datamodelshapes.Physical.ROW);
    var nRowLayerCount = oDataLayout.getLayerCount(
      datamodelshapes.Physical.ROW
    );
    var nCols = oDataLayout.getEdgeExtent(datamodelshapes.Physical.COLUMN);
    var nColLayerCount = oDataLayout.getLayerCount(
      datamodelshapes.Physical.COLUMN
    );

    //--------------------------------------------------------
    var oDataLayoutHelper = oTransientRenderingContext.get(
      dataviz.DataContextProperty.DATA_LAYOUT_HELPER
    );
    var oColorContext = this.getColorContext(oTransientRenderingContext);
    var oColorInterpolator = this.getCachedColorInterpolator(
      oTransientRenderingContext,
      datamodelshapes.Logical.COLOR
    );

    //var my_result = parseGrammar(oDataLayoutHelper,oDataLayout);

    var aOutput = [];
    for (var i = 0; i < nRows; i++) {
      var obj = {};
      obj['name'] = oDataLayout.getValue(datamodelshapes.Physical.ROW, 0, i);
      //color code

      var color_value = this.getDataItemColorInfo(
        oDataLayoutHelper,
        oColorContext,
        oColorInterpolator,
        i,
        0
      );
      obj['color'] = color_value.sColor;
      obj['size'] = oDataLayout.getValue(datamodelshapes.Physical.DATA, i, 0);
      //get the tooltip
      var tooltipArr = [];
      var num;
      if (
        oDataModel.getLogicalDataModel().getJSON().logicalEdges.color
          .logicalEdgeLayers.length == 1
      ) {
        num = aAllRows.length - 1;
      } else {
        num = aAllRows.length - 2;
      }
      if (
        typeof oDataModel.getLogicalDataModel().getJSON().logicalEdges.detail !=
        'undefined'
      ) {
        for (
          var j = 0;
          j <
          oDataModel.getLogicalDataModel().getJSON().logicalEdges.detail
            .logicalEdgeLayers.length;
          j++
        ) {
          var index = getIndex(
            aAllRows,
            oDataModel.getLogicalDataModel().getJSON().logicalEdges.detail
              .logicalEdgeLayers[j]['columnID']
          );
          var ttobj = {};
          var key = oDataModel.getLogicalDataModel().getJSON().logicalEdges
            .detail.logicalEdgeLayers[j]['columnID'];
          var value = oDataLayout.getValue(
            datamodelshapes.Physical.ROW,
            index,
            i
          );
          ttobj[key] = value;
          tooltipArr.push(ttobj);
        }
      }

      obj['tooltip'] = tooltipArr;
      aOutput.push(obj);
    }
    //--------------------------------------------------------
    if (aOutput.length > 0) return aOutput;
    /*sortByKey(aOutput, 'value', true);*/ else return null;
  };

  /**
   * Called whenever new data is ready and this visualization needs to update.
   * @param {module:obitech-renderingcontext/renderingcontext.RenderingContext} oTransientRenderingContext
   */
  VertWaterfall.prototype._render = function(oTransientRenderingContext) {
    try {
      // Note: all events will be received after initialize and start complete.  We may get other events
      // such as 'resize' before the render, i.e. this might not be the first event.

      // Retrieve the data object for this visualization
      var oDataLayout = oTransientRenderingContext.get(
        dataviz.DataContextProperty.DATA_LAYOUT
      );

      // Retrieve the root container for our visualization.  This is provided by the framework.  It may not be deleted
      // but may be used to render.
      var elContainer = this.getContainerElem();
      // Let's reset our container on render
      $(elContainer).empty();

      var settings = getWaterfallSettings(this);

      var dataset = this.myGenerateData(
        oDataLayout,
        oTransientRenderingContext
      );
      if (!dataset) {
        return;
      }

      // Build renderRows from data rows, attaching per-row context so the
      // bar/label helpers don't need to walk back into `dataset[i-1]`.
      // Issue #14 (cumulative/percent), #15 (Start/End value override on
      // first/last data row).
      var grandTotal = 0;
      for (let gi = 0; gi < dataset.length; gi++) {
        grandTotal += Number(dataset[gi].size) || 0;
      }
      var renderRows = [];
      var runningSum = 0;
      for (let di = 0; di < dataset.length; di++) {
        runningSum += Number(dataset[di].size) || 0;
        renderRows.push({
          name: dataset[di].name,
          size: dataset[di].size,
          color: dataset[di].color,
          tooltip: dataset[di].tooltip,
          _dataIdx: di,
          _prevDataSize: di > 0 ? dataset[di - 1].size : null,
          _cumulative: runningSum
        });
      }
      // End total bar (#15): static neutral bar sized at the LAST data row's
      // value so it fits the existing x-scale and doesn't skew the chart.
      // Always labelled with its value (handled by buildLabel via _isTotal).
      if (settings.showEndTotal && dataset.length > 0) {
        renderRows.push({
          name: 'End',
          size: dataset[dataset.length - 1].size,
          _isTotal: true
        });
      }

      var names = [];
      renderRows.forEach(function(d) { names.push(d.name); });

      var sizes = [];
      renderRows.forEach(function(d) { sizes.push(d.size); });

      // Reserve enough left margin for the widest *actual* y-axis label —
      // the previous 6.5*charCount heuristic underestimated capitals and
      // punctuation (e.g. "Hong Kong S.A.R." was clipped) — issue #13.
      var Y_AXIS_FONT = 'sans-serif';
      var Y_AXIS_FONT_SIZE = 12;
      var widestYLabel = 0;
      for (let index = 0; index < names.length; index++) {
        var w = measureTextWidth(names[index], Y_AXIS_FONT, Y_AXIS_FONT_SIZE);
        if (w > widestYLabel) widestYLabel = w;
      }

      // Get the width and height of our container
      var margin = {
        top: 20,
        right: 20,
        bottom: settings.axisTitle ? 60 : 40,
        left: Math.ceil(widestYLabel) + 14
      };
      var width = $(elContainer).width() - 20;
      var height = $(elContainer).height() - 10;

      var svg = d3
        .select(elContainer)
        .append('svg')
        .attr({
          width: width,
          height: height
        });

      // Detect dark/light theme by walking up from the container until we find
      // a non-transparent background, then set the SVG's `color` so axis text
      // (which uses `fill: currentColor` via CSS) stays legible (issue #9).
      svg.style('color', detectThemeTextColor(elContainer));

      // Define the div for the tooltip
      var tooltip = d3
        .select('body')
        .append('div')
        .attr('class', 'tooltip')
        .style('opacity', 0);

      var x = getXScale();
      var y = getYScale();

      var bandHeight = (height - margin.bottom) / renderRows.length;

      setAxis();
      setFilter();

      //Grouping, powerpoint group
      var rectWrapper = svg
        .append('g')
        .attr('transform', 'translate(' + margin.left + ',' + margin.top + ')');
      var rectHeight = bandHeight * (1 - settings.barGap);
      rectHeight = rectHeight < 2 ? 2 : rectHeight;
      var rectYOffset = (bandHeight - rectHeight) / 2;
      rectWrapper
        .selectAll('rect')
        .data(renderRows)
        .enter()
        .append('rect')
        .attr({
          y: function(d, i) {
            return i * bandHeight + rectYOffset;
          },
          x: function(d, i) {
            return waterfallX(d, i);
          },
          height: rectHeight,
          width: function(d, i) {
            return waterfallSize(d, i);
          },
          fill: function(d, i) {
            return waterfallColor(d, i);
          }
        })
        .on('mouseover', function(d, i) {
          d3.select(this).style('filter', 'url(#drop-shadow)');
          var tempTooltip = '';
          if (d.tooltip && d.tooltip.length > 0) {
            for (let index = 0; index < d.tooltip.length; index++) {
              const element = d.tooltip[index];
              var keys = Object.keys(element);
              tempTooltip += `
           <tr>
             <th>${keys[0]}</th>
             <td>${Number.parseFloat(element[keys[0]]).toLocaleString()}</td>
           </tr>
 `;
            }
          }
          var deltaTxt = (d._isTotal || d._prevDataSize === null)
            ? '0'
            : formatNumber(d.size - d._prevDataSize, settings);
          tooltip
            .transition()
            .duration(200)
            .style('opacity', 0.9);
          tooltip
            .html(
              `<table class="tooltip-table">
              <tr >
             <th>Name</th>
             <td>${d.name}</td>
           </tr>
           <tr >
             <th ${
               tempTooltip === ''
                 ? ''
                 : "style='border-bottom: 1px solid black;'"
             }>Value</th>
             <td>${formatNumber(d.size, settings)} (${deltaTxt})</td>
           </tr>
           ${tempTooltip}
         </table>
          `
            )
            .style('left', d3.event.pageX + 'px')
            .style('top', d3.event.pageY - 28 + 'px');
        })
        .on('mouseout', function(d) {
          d3.select(this).style('filter', '');
          tooltip
            .transition()
            .duration(500)
            .style('opacity', 0);
        });

      // Waterfall connector lines (#17). For each pair of adjacent rows, draw
      // a vertical dashed segment at the SHARED value (= renderRows[i].size)
      // between the bottom of bar i and the top of bar i+1. Visually echoes
      // a classic financial waterfall.
      if (settings.showConnectors && renderRows.length > 1) {
        var connectorWrapper = svg.append('g')
          .attr('transform', 'translate(' + margin.left + ',' + margin.top + ')');
        for (var ci = 0; ci < renderRows.length - 1; ci++) {
          var sharedX = x(renderRows[ci].size);
          var yTop = ci * bandHeight + rectYOffset + rectHeight;
          var yBottom = (ci + 1) * bandHeight + rectYOffset;
          connectorWrapper.append('line')
            .attr({
              x1: sharedX, x2: sharedX,
              y1: yTop, y2: yBottom
            })
            .attr('stroke', '#888')
            .attr('stroke-width', 1)
            .attr('stroke-dasharray', '2 2');
        }
      }

      if (rectHeight > settings.dataLabelSize && settings.dataLabels === 'on') {
        var textWrapper = svg
          .append('g')
          .attr(
            'transform',
            'translate(' + margin.left + ',' + margin.top + ')'
          );

        // 'auto' mirrors the OAC theme text color so labels stay legible in
        // both light and dark themes (issue #9 follow-up). Same methodology as
        // the axis tick labels — pick what the body's `color` style says.
        var autoFill = detectThemeTextColor(elContainer);
        var insideFill = settings.dataLabelColor === 'auto' ? autoFill : settings.dataLabelColor;
        var outsideFill = settings.dataLabelColor === 'auto' ? autoFill : settings.dataLabelColor;

        var text = textWrapper
          .selectAll('text')
          .data(renderRows)
          .enter()
          .append('text')
          .attr({
            'text-anchor': 'end',
            'dominant-baseline': 'central',
            'font-family': settings.dataLabelFont,
            'font-size': settings.dataLabelSize,
            'font-style': settings.dataLabelItalic ? 'italic' : 'normal',
            'font-weight': settings.dataLabelBold ? '600' : 'normal',
            fill: insideFill
          });

        // Single-line "value (delta)" — stacking the two tspans caused vertical
        // overlap when bandHeight was small (issue #11). Width grows but the
        // auto-flip post-pass below handles overflow.
        text
          .append('tspan')
          .attr({
            y: function(d, i) {
              return i * bandHeight + bandHeight / 2;
            },
            x: function(d, i) {
              return textPosition(d, i);
            }
          })
          .text(function(d) {
            return buildLabel(d);
          });

        // Label placement honors `dataLabelPosition` (#7). Fill is per-label:
        // when label sits ON a bar, pick a color that contrasts with that
        // specific bar's luminance (so user-picked Increase/Decrease/Neutral
        // colors always have legible labels). When label sits on the chart
        // background, use the theme text color.
        var plotWidth = width - margin.left - margin.right;
        var labelPos = settings.dataLabelPosition || 'auto';
        function pickFill(onBarColor, isOnBar) {
          if (settings.dataLabelColor !== 'auto') return settings.dataLabelColor;
          if (!isOnBar) return autoFill; // theme text color for chart-bg labels
          // On a colored bar — pick contrasting based on perceived luminance.
          var c = String(onBarColor || '').replace('#', '');
          if (c.length === 3) c = c[0]+c[0]+c[1]+c[1]+c[2]+c[2];
          if (c.length !== 6) return autoFill;
          var r = parseInt(c.substr(0,2), 16);
          var g = parseInt(c.substr(2,2), 16);
          var b = parseInt(c.substr(4,2), 16);
          var lum = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
          return lum > 0.55 ? '#222' : '#FFF';
        }
        text.each(function(d, i) {
          var node = this;
          var barLeft = waterfallX(d, i);
          var barRight = barLeft + waterfallSize(d, i);
          var barColor = waterfallColor(d, i);
          var labelRight = textPosition(d, i);
          var maxTspanWidth = 0;
          var tspans = node.getElementsByTagName('tspan');
          for (var k = 0; k < tspans.length; k++) {
            var w = tspans[k].getComputedTextLength ? tspans[k].getComputedTextLength() : 0;
            if (w > maxTspanWidth) maxTspanWidth = w;
          }

          if (labelPos === 'insideEnd') {
            d3.select(node).attr('text-anchor', 'end').attr('fill', pickFill(barColor, true));
            d3.select(node).selectAll('tspan').attr('x', barRight - 4);
            return;
          }
          if (labelPos === 'outsideEnd') {
            d3.select(node).attr('text-anchor', 'start').attr('fill', pickFill(barColor, false));
            d3.select(node).selectAll('tspan').attr('x', barRight + 4);
            return;
          }
          if (labelPos === 'center') {
            d3.select(node).attr('text-anchor', 'middle').attr('fill', pickFill(barColor, true));
            d3.select(node).selectAll('tspan').attr('x', (barLeft + barRight) / 2);
            return;
          }

          // 'auto'
          var fitsInside = labelRight - maxTspanWidth >= barLeft;
          if (fitsInside) {
            d3.select(node).attr('fill', pickFill(barColor, true));
            return;
          }
          var fitsOutsideRight = barRight + 4 + maxTspanWidth <= plotWidth;
          if (fitsOutsideRight) {
            d3.select(node)
              .attr('text-anchor', 'start')
              .attr('fill', pickFill(barColor, false));
            d3.select(node).selectAll('tspan').attr('x', barRight + 4);
          } else {
            d3.select(node)
              .attr('text-anchor', 'end')
              .attr('fill', pickFill(barColor, true));
            d3.select(node).selectAll('tspan').attr('x', plotWidth - 2);
          }
        });
      }

      // Grand total static label (issue #16). Sits at the bottom-right of the
      // plot area, above the X-axis line. Uses the data-label font + auto fill.
      if (settings.showGrandTotal) {
        var gtFill = settings.dataLabelColor === 'auto'
          ? detectThemeTextColor(elContainer)
          : settings.dataLabelColor;
        svg.append('text')
          .attr({
            x: width - margin.right - 4,
            y: margin.top + (height - margin.bottom) - 6,
            'text-anchor': 'end',
            'font-family': settings.dataLabelFont,
            'font-size': settings.dataLabelSize + 2,
            'font-style': settings.dataLabelItalic ? 'italic' : 'normal',
            'font-weight': '700',
            fill: gtFill
          })
          .text('Total: ' + formatNumber(grandTotal, settings));
      }

      // *** METHODS SECTION ***

      function areColorsTheSame() {
        var res = true;
        dataset.forEach((value, i, a) => {
          if (i !== 0) {
            if (value.color != dataset[i - 1].color) {
              res = false;
            }
          }
        });
        return res;
      }

      function waterfallSize(d, i) {
        var val;
        if (d._isTotal || d._prevDataSize === null) {
          val = d.size;
        } else {
          val = Math.abs(d._prevDataSize - d.size);
        }

        if (val === 0) {
          val = Math.max(...sizes) * 0.002;
        }

        if (Math.min(...sizes) < 0) {
          val = val - Math.abs(Math.min(...sizes));
        }
        return x(val);
      }

      function waterfallX(d, i) {
        var val;
        if (d._isTotal) {
          val = 0;
        } else if (d._prevDataSize === null) {
          val = d.size >= 0 ? 0 : d.size;
        } else {
          var previousSize = Number.parseFloat(d._prevDataSize);
          if (previousSize > Number.parseFloat(d.size)) {
            val = d.size;
          } else {
            val = d._prevDataSize;
          }
        }
        return x(val);
      }

      function waterfallColor(d, i) {
        if (d._isTotal) return settings.neutralColor;
        if (!areColorsTheSame()) {
          return d.color;
        }
        if (d._prevDataSize === null) return settings.neutralColor;
        var prev = Number.parseFloat(d._prevDataSize);
        var cur = Number.parseFloat(d.size);
        if (cur > prev) return settings.increaseColor;
        if (cur < prev) return settings.decreaseColor;
        return settings.neutralColor;
      }

      function textPosition(d, i) {
        if (d._isTotal) return x(d.size) - 10;
        if (d._prevDataSize === null || d.size > d._prevDataSize) return x(d.size) - 10;
        return x(d._prevDataSize) - 10;
      }

      // Format the label per the user's "Data Label Content" setting (#14).
      // Show Start/End Total (#15) force the first/last data row to display
      // its value regardless of the content selector — useful when the user
      // picks "Delta only" or "Cumulative" but still wants the endpoints.
      function buildLabel(d) {
        var value = formatNumber(d.size, settings);
        if (d._isTotal) return value;
        var isFirst = d._dataIdx === 0;
        var isLast = d._dataIdx === dataset.length - 1;
        if ((isFirst && settings.showStartTotal) || (isLast && settings.showEndTotal)) {
          return value;
        }
        var hasPrev = d._prevDataSize !== null;
        switch (settings.dataLabelContent) {
          case 'valueOnly':
            return value;
          case 'deltaOnly': {
            if (!hasPrev) return '';
            var raw = d.size - d._prevDataSize;
            var delta = formatNumber(raw, settings);
            if (raw > 0 && delta.charAt(0) !== '+') delta = '+' + delta;
            return '(' + delta + ')';
          }
          case 'percentOfTotal': {
            if (!grandTotal) return value;
            var pct = (Number(d.size) / grandTotal) * 100;
            return (Math.round(pct * 10) / 10) + '%';
          }
          case 'cumulative':
            return formatNumber(d._cumulative, settings);
          case 'valueDelta':
          default: {
            if (!hasPrev) return value;
            var raw2 = d.size - d._prevDataSize;
            var delta2 = formatNumber(raw2, settings);
            if (raw2 > 0 && delta2.charAt(0) !== '+') delta2 = '+' + delta2;
            return value + ' (' + delta2 + ')';
          }
        }
      }

      function setAxis() {
        var xAxis = d3.svg.axis().scale(x).tickFormat(function(v) {
          if (settings.valuesAxisLabels === 'off') return '';
          return formatNumber(v, settings);
        });
        // Auto-shrink y-axis font when bandHeight is too small to fit the
        // default 12pt label. Keeps text inside its band so the visual
        // center actually sits where the bar's center is in dense charts.
        // Floor at 8pt — anything smaller is unreadable. Margin.left was
        // sized using the max font (12), so smaller font won't need more
        // horizontal room.
        var effectiveAxisFontSize = Math.max(8, Math.min(Y_AXIS_FONT_SIZE, Math.floor(bandHeight - 4)));
        // Skip every Nth tick when bands are too thin even for the shrunken
        // font (issue #1). Margin.left already covers the widest label.
        var labelLineHeight = effectiveAxisFontSize + 2;
        var skipEvery = bandHeight > 0
          ? Math.max(1, Math.ceil(labelLineHeight / bandHeight))
          : 1;
        var yTicks = skipEvery > 1
          ? names.filter(function(_, i) { return i % skipEvery === 0; })
          : names;

        var yAxis = d3.svg
          .axis()
          .scale(y)
          .tickSize(0)
          .tickPadding(10)
          .orient('left')
          .tickValues(yTicks)
          .tickFormat(function(v) {
            return settings.axisLabels === 'off' ? '' : v;
          });

        // X axis aligns with the bottom of the bar area (margin.top + plot
        // height) so it stays glued to the bars when an axis title pushes
        // margin.bottom up. Previously hardcoded to `height - margin.top`,
        // which left a 20px gap with a title and let tick labels overlap the
        // title text (issue #2).
        svg
          .append('g')
          .attr(
            'transform',
            'translate(' + margin.left + ',' + (margin.top + (height - margin.bottom)) + ')'
          )
          .attr('class', 'axis')
          .call(xAxis);

        var yAxisG = svg
          .append('g')
          .attr(
            'transform',
            'translate(' + margin.left + ',' + margin.top + ')'
          )
          .attr('class', 'axis-y')
          .call(yAxis);
        // Apply the (possibly shrunken) effective font size so labels fit
        // their bands.
        yAxisG.selectAll('.tick text')
          .style('font-size', effectiveAxisFontSize + 'px');
        // d3 v3's ordinal-scale tick positioning uses different bandwidth
        // math than our bar code (probed live: tick spacing 19 vs bar spacing
        // bandHeight). Bypass it by re-anchoring each tick group to the row's
        // bar center: i*bandHeight + bandHeight/2. (#19)
        yAxisG.selectAll('.tick').each(function(d) {
          var rowIdx = names.indexOf(d);
          if (rowIdx >= 0) {
            d3.select(this).attr('transform',
              'translate(0,' + (rowIdx * bandHeight + bandHeight / 2) + ')');
          }
        });

        if (settings.axisTitle) {
          svg
            .append('text')
            .attr('class', 'axis-title')
            .attr('text-anchor', 'middle')
            .attr('font-size', 12)
            .attr('fill', 'currentColor')
            .attr(
              'transform',
              'translate(' +
                (margin.left + (width - margin.left - margin.right) / 2) +
                ',' +
                (height - 5) +
                ')'
            )
            .text(settings.axisTitle);
        }
      }

      function getXScale() {
        var leftDomain = Math.min(...sizes) < 0 ? Math.min(...sizes) : 0;
        return d3.scale
          .linear()
          .domain([leftDomain, Math.max(...sizes)])
          .range([0, width - margin.left - margin.right]);
      }

      function getYScale() {
        return d3.scale
          .ordinal()
          .rangeRoundBands([0, height - margin.bottom])
          .domain(names);
      }

      function detectThemeTextColor(el) {
        // Mirror the body's text color — OAC's theme system sets this on the
        // document, so it stays in sync with both light and dark themes
        // without us having to guess from background luminance (issue #9).
        var bodyColor = window.getComputedStyle(document.body).color;
        if (bodyColor && bodyColor !== 'rgba(0, 0, 0, 0)' && bodyColor !== 'transparent') {
          return bodyColor;
        }
        // Fallback: walk up from the container looking for a non-transparent
        // background and pick a contrasting color from its luminance.
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

      function setFilter() {
        var defs = svg.append('defs');
        var filter = defs
          .append('filter')
          .attr('id', 'drop-shadow')
          .attr('height', '130%');

        filter
          .append('feGaussianBlur')
          .attr('in', 'SourceAlpha')
          .attr('stdDeviation', 5)
          .attr('result', 'blur');

        filter
          .append('feOffset')
          .attr('in', 'blur')
          .attr('result', 'offsetBlur');

        var feMerge = filter.append('feMerge');

        feMerge.append('feMergeNode').attr('in', 'offsetBlur');
        feMerge.append('feMergeNode').attr('in', 'SourceGraphic');
      }
    } finally {
      this._setIsRendered(true);
    }
  };
  /**
   * Called whenever new data is ready and this visualization needs to update.
   * @param {module:obitech-renderingcontext/renderingcontext.RenderingContext} oTransientRenderingContext
   */
  VertWaterfall.prototype.render = function(oTransientRenderingContext) {
    this._render(oTransientRenderingContext);
  };

  /**
   * Build the "Waterfall" tab in the right-click → Properties dialog.
   * @param oTabbedPanelsGadgetInfo
   */
  VertWaterfall.prototype._addVizSpecificPropsDialog = function(
    oTabbedPanelsGadgetInfo
  ) {
    var viz = this;
    var options = this.getViewConfig() || {};
    this._fillDefaultOptions(options, null);
    var wf = options.waterfall || {};

    // Helpers ---------------------------------------------------------------
    function persist(key, val) {
      var cfg = viz.getViewConfig() || {};
      if (!cfg.waterfall) cfg.waterfall = {};
      cfg.waterfall[key] = val;
      viz.getSettings().setViewConfigJSON(dataviz.SettingsNS.CHART, cfg);
      try {
        var ctx = viz.assertOrCreateVizContext();
        viz._render(viz.createRenderingContext(ctx));
      } catch (e) {
        _logger.warn('re-render after prop change failed: ' + e.message);
      }
    }
    function obs(initial, key, transform) {
      var o = ko.observable(initial);
      o.subscribe(function(v) {
        persist(key, transform ? transform(v) : v);
      });
      return o;
    }
    function vp(typeId, observable) {
      return new gadgets.GadgetValueProperties(typeId, observable);
    }

    // Observables -----------------------------------------------------------
    var oIncrease   = obs(wf.increaseColor || DEFAULTS.increaseColor, 'increaseColor');
    var oDecrease   = obs(wf.decreaseColor || DEFAULTS.decreaseColor, 'decreaseColor');
    var oNeutral    = obs(wf.neutralColor  || DEFAULTS.neutralColor,  'neutralColor');
    var oBarGap     = obs(Math.round(((typeof wf.barGap === 'number') ? wf.barGap : DEFAULTS.barGap) * 100),
                          'barGap', function(v){ return Math.max(0, Math.min(95, Number(v))) / 100; });
    var oDataLabels = obs(wf.dataLabels === 'off' ? false : true, 'dataLabels',
                          function(v){ return v ? 'on' : 'off'; });
    var oAxisLabels = obs(wf.axisLabels === 'off' ? false : true, 'axisLabels',
                          function(v){ return v ? 'on' : 'off'; });
    var oValAxisLbls = obs(wf.valuesAxisLabels === 'off' ? false : true, 'valuesAxisLabels',
                          function(v){ return v ? 'on' : 'off'; });
    var oAxisTitle  = obs(wf.axisTitle || '', 'axisTitle');
    var oNumFmt     = obs(wf.numberFormat || DEFAULTS.numberFormat, 'numberFormat');

    // Use the framework helper to get/force a real panel container.
    // Issue #20: moved from GENERAL to STYLE so our settings sit in their
    // own tab instead of mixing with Title/Subtitle/Footnote. Eventually
    // distribute across STYLE/AXIS/NUMBERFORMAT/LAYER_LABELS/TOTALS.
    var panel = gadgetdialog.forcePanelByID(
      oTabbedPanelsGadgetInfo,
      euidef.GD_PANEL_ID_STYLE
    );

    // Slider — SliderGadgetValueProperties(typeId, nValue, nMin, nMax, nStep)
    var initialBarGap = Math.round(((typeof wf.barGap === 'number') ? wf.barGap : DEFAULTS.barGap) * 100);
    panel.addChild(new gadgets.SliderGadgetInfo(
      'wfBarGap',
      messages.VERTWATERFALL_BAR_GAP || 'Bar Gap',
      'Spacing between bars as a % of band width',
      new gadgets.SliderGadgetValueProperties(euidef.GadgetTypeIDs.SLIDER, initialBarGap, 0, 95, 1),
      0, false, null,
      { fValueFormatter: function(v) { return v + '%'; } }
    ));

    // Checkboxes — CheckboxGadgetValueProperties(typeId, value, bChecked)
    var ckDataLabels = wf.dataLabels !== 'off';
    var ckAxisLabels = wf.axisLabels !== 'off';
    var ckValAxis    = wf.valuesAxisLabels !== 'off';
    panel.addChild(new gadgets.CheckboxGadgetInfo(
      'wfDataLabels',
      messages.VERTWATERFALL_DATA_LABELS || 'Data Labels',
      'Show value and delta labels on bars',
      new gadgets.CheckboxGadgetValueProperties(euidef.GadgetTypeIDs.CHECKBOX, ckDataLabels, ckDataLabels),
      0, false
    ));
    panel.addChild(new gadgets.CheckboxGadgetInfo(
      'wfAxisLabels',
      messages.VERTWATERFALL_AXIS_LABELS || 'Labels Axis',
      'Show category-axis (Y) labels',
      new gadgets.CheckboxGadgetValueProperties(euidef.GadgetTypeIDs.CHECKBOX, ckAxisLabels, ckAxisLabels),
      0, false
    ));
    panel.addChild(new gadgets.CheckboxGadgetInfo(
      'wfValuesAxisLabels',
      messages.VERTWATERFALL_VALUES_AXIS_LABELS || 'Values Axis',
      'Show value-axis (X) labels',
      new gadgets.CheckboxGadgetValueProperties(euidef.GadgetTypeIDs.CHECKBOX, ckValAxis, ckValAxis),
      0, false
    ));

    // ColorPickers (#3). Live-probed signature:
    //   ColorPickerGadgetInfo(id, label, tooltip, valueProps, order, showGear, rules, config)
    // config = { sDefaultValue, colorPickerOptions }
    // valueProps = GadgetValueProperties(GadgetTypeIDs.COLOR_PICKER, hexColor)
    panel.addChild(new gadgets.ColorPickerGadgetInfo(
      'wfIncreaseColor',
      messages.VERTWATERFALL_INCREASE_COLOR || 'Increase Color',
      'Bar color when the value increased from the previous row',
      new gadgets.GadgetValueProperties(euidef.GadgetTypeIDs.COLOR_PICKER, wf.increaseColor || DEFAULTS.increaseColor),
      0, false, null,
      { sDefaultValue: DEFAULTS.increaseColor }
    ));
    panel.addChild(new gadgets.ColorPickerGadgetInfo(
      'wfDecreaseColor',
      messages.VERTWATERFALL_DECREASE_COLOR || 'Decrease Color',
      'Bar color when the value decreased from the previous row',
      new gadgets.GadgetValueProperties(euidef.GadgetTypeIDs.COLOR_PICKER, wf.decreaseColor || DEFAULTS.decreaseColor),
      0, false, null,
      { sDefaultValue: DEFAULTS.decreaseColor }
    ));
    panel.addChild(new gadgets.ColorPickerGadgetInfo(
      'wfNeutralColor',
      messages.VERTWATERFALL_NEUTRAL_COLOR || 'Start, End Color',
      'Bar color for the first/last bars and for End total',
      new gadgets.GadgetValueProperties(euidef.GadgetTypeIDs.COLOR_PICKER, wf.neutralColor || DEFAULTS.neutralColor),
      0, false, null,
      { sDefaultValue: DEFAULTS.neutralColor }
    ));

    // Text — generic GadgetValueProperties (CalendarViz uses this pattern)
    panel.addChild(new gadgets.TextGadgetInfo(
      'wfAxisTitle',
      messages.VERTWATERFALL_AXIS_TITLE || 'Axis Title',
      'Optional axis title displayed below the chart',
      new gadgets.GadgetValueProperties(euidef.GadgetTypeIDs.TEXT_FIELD, wf.axisTitle || ''),
      0, false, null,
      { sPlaceholderText: '(none)' }
    ));

    // SingleSelect — generic GadgetValueProperties + options array as last arg
    var fmtOptions = [
      new gadgets.OptionInfo('auto',     'Auto',     'Auto'),
      new gadgets.OptionInfo('comma',    'Number',   'Number'),
      new gadgets.OptionInfo('currency', 'Currency', 'Currency'),
      new gadgets.OptionInfo('percent',  'Percent',  'Percent')
    ];
    var lblFmt = messages.VERTWATERFALL_NUMBER_FORMAT || 'Number Format';
    panel.addChild(new gadgets.SingleSelectGadgetInfo(
      'wfNumberFormat', lblFmt, lblFmt,
      new gadgets.GadgetValueProperties(
        euidef.GadgetTypeIDs.SINGLE_SELECT,
        wf.numberFormat || DEFAULTS.numberFormat,
        { ariaLabel: lblFmt }
      ),
      0, false,
      fmtOptions
    ));

    // Currency symbol — used when Number Format is 'currency' (#5).
    panel.addChild(new gadgets.TextGadgetInfo(
      'wfCurrencySymbol',
      messages.VERTWATERFALL_CURRENCY_SYMBOL || 'Currency Symbol',
      'Symbol prefixed to currency-formatted values (e.g. $, €, £, ¥)',
      new gadgets.GadgetValueProperties(
        euidef.GadgetTypeIDs.TEXT_FIELD,
        typeof wf.currencySymbol === 'string' ? wf.currencySymbol : DEFAULTS.currencySymbol
      ),
      0, false, null,
      { sPlaceholderText: '$' }
    ));

    // Decimal Places (#18)
    var initialDecimals = typeof wf.numberDecimals === 'number' ? wf.numberDecimals : DEFAULTS.numberDecimals;
    panel.addChild(new gadgets.SliderGadgetInfo(
      'wfNumberDecimals',
      messages.VERTWATERFALL_NUMBER_DECIMALS || 'Decimal Places',
      'Number of digits after the decimal point (0–6)',
      new gadgets.SliderGadgetValueProperties(euidef.GadgetTypeIDs.SLIDER, initialDecimals, 0, 6, 1),
      0, false, null,
      { fValueFormatter: function(v) { return String(v); } }
    ));

    // Thousand Separator (#18)
    var thousandSepOptions = [
      new gadgets.OptionInfo(',', 'Comma (1,234)',  'Comma (1,234)'),
      new gadgets.OptionInfo('.', 'Period (1.234)', 'Period (1.234)'),
      new gadgets.OptionInfo(' ', 'Space (1 234)',  'Space (1 234)'),
      new gadgets.OptionInfo('',  'None (1234)',    'None (1234)')
    ];
    var lblSep = messages.VERTWATERFALL_NUMBER_THOUSAND_SEP || 'Thousand Separator';
    panel.addChild(new gadgets.SingleSelectGadgetInfo(
      'wfNumberThousandSep', lblSep, lblSep,
      new gadgets.GadgetValueProperties(
        euidef.GadgetTypeIDs.SINGLE_SELECT,
        typeof wf.numberThousandSep === 'string' ? wf.numberThousandSep : DEFAULTS.numberThousandSep,
        { ariaLabel: lblSep }
      ),
      0, false,
      thousandSepOptions
    ));

    // Abbreviation (#18) — orthogonal to Number Format so Currency + Auto can compose ($1.5M)
    var abbrOptions = [
      new gadgets.OptionInfo('default', 'Default (full digits)',  'Default'),
      new gadgets.OptionInfo('auto',    'Auto (1.5K / 1.5M / 1.5B)', 'Auto'),
      new gadgets.OptionInfo('K',       'Thousands (K)',           'Thousands'),
      new gadgets.OptionInfo('M',       'Millions (M)',            'Millions'),
      new gadgets.OptionInfo('B',       'Billions (B)',            'Billions')
    ];
    var lblAbbr = messages.VERTWATERFALL_NUMBER_ABBREVIATION || 'Abbreviation';
    panel.addChild(new gadgets.SingleSelectGadgetInfo(
      'wfNumberAbbreviation', lblAbbr, lblAbbr,
      new gadgets.GadgetValueProperties(
        euidef.GadgetTypeIDs.SINGLE_SELECT,
        wf.numberAbbreviation || DEFAULTS.numberAbbreviation,
        { ariaLabel: lblAbbr }
      ),
      0, false,
      abbrOptions
    ));

    // Negative Values style (#18)
    var negStyleOptions = [
      new gadgets.OptionInfo('minus',    '-123',  '-123'),
      new gadgets.OptionInfo('parens',   '(123)', '(123)'),
      new gadgets.OptionInfo('trailing', '123-',  '123-')
    ];
    var lblNeg = messages.VERTWATERFALL_NUMBER_NEGATIVE_STYLE || 'Negative Values';
    panel.addChild(new gadgets.SingleSelectGadgetInfo(
      'wfNumberNegativeStyle', lblNeg, lblNeg,
      new gadgets.GadgetValueProperties(
        euidef.GadgetTypeIDs.SINGLE_SELECT,
        wf.numberNegativeStyle || DEFAULTS.numberNegativeStyle,
        { ariaLabel: lblNeg }
      ),
      0, false,
      negStyleOptions
    ));

    // Data label font controls
    var labelFontOptions = [
      new gadgets.OptionInfo('sans-serif', 'Sans-serif', 'Sans-serif'),
      new gadgets.OptionInfo('serif',      'Serif',      'Serif'),
      new gadgets.OptionInfo('monospace',  'Monospace',  'Monospace')
    ];
    var lblFont = messages.VERTWATERFALL_DATA_LABEL_FONT || 'Data Label Font';
    panel.addChild(new gadgets.SingleSelectGadgetInfo(
      'wfDataLabelFont', lblFont, lblFont,
      new gadgets.GadgetValueProperties(
        euidef.GadgetTypeIDs.SINGLE_SELECT,
        wf.dataLabelFont || DEFAULTS.dataLabelFont,
        { ariaLabel: lblFont }
      ),
      0, false,
      labelFontOptions
    ));

    var initialLabelSize = typeof wf.dataLabelSize === 'number' ? wf.dataLabelSize : DEFAULTS.dataLabelSize;
    panel.addChild(new gadgets.SliderGadgetInfo(
      'wfDataLabelSize',
      messages.VERTWATERFALL_DATA_LABEL_SIZE || 'Data Label Size',
      'Font size for data labels (px)',
      new gadgets.SliderGadgetValueProperties(euidef.GadgetTypeIDs.SLIDER, initialLabelSize, 8, 24, 1),
      0, false, null,
      { fValueFormatter: function(v) { return v + 'px'; } }
    ));

    var ckLabelBold = typeof wf.dataLabelBold === 'boolean' ? wf.dataLabelBold : DEFAULTS.dataLabelBold;
    panel.addChild(new gadgets.CheckboxGadgetInfo(
      'wfDataLabelBold',
      messages.VERTWATERFALL_DATA_LABEL_BOLD || 'Data Label Bold',
      'Render data labels in bold',
      new gadgets.CheckboxGadgetValueProperties(euidef.GadgetTypeIDs.CHECKBOX, ckLabelBold, ckLabelBold),
      0, false
    ));

    var ckLabelItalic = typeof wf.dataLabelItalic === 'boolean' ? wf.dataLabelItalic : DEFAULTS.dataLabelItalic;
    panel.addChild(new gadgets.CheckboxGadgetInfo(
      'wfDataLabelItalic',
      messages.VERTWATERFALL_DATA_LABEL_ITALIC || 'Data Label Italic',
      'Render data labels in italic',
      new gadgets.CheckboxGadgetValueProperties(euidef.GadgetTypeIDs.CHECKBOX, ckLabelItalic, ckLabelItalic),
      0, false
    ));

    var labelColorOptions = [
      new gadgets.OptionInfo('auto',  'Auto (contrast)', 'Auto (contrast)'),
      new gadgets.OptionInfo('white', 'White',           'White'),
      new gadgets.OptionInfo('black', 'Black',           'Black'),
      new gadgets.OptionInfo('#444',  'Dark Gray',       'Dark Gray')
    ];
    var lblLabelColor = messages.VERTWATERFALL_DATA_LABEL_COLOR || 'Data Label Color';
    panel.addChild(new gadgets.SingleSelectGadgetInfo(
      'wfDataLabelColor', lblLabelColor, lblLabelColor,
      new gadgets.GadgetValueProperties(
        euidef.GadgetTypeIDs.SINGLE_SELECT,
        wf.dataLabelColor || DEFAULTS.dataLabelColor,
        { ariaLabel: lblLabelColor }
      ),
      0, false,
      labelColorOptions
    ));

    // Data Label Content selector (#14)
    var labelContentOptions = [
      new gadgets.OptionInfo('valueDelta',     'Value (Delta)', 'Value (Delta)'),
      new gadgets.OptionInfo('valueOnly',      'Value only',    'Value only'),
      new gadgets.OptionInfo('deltaOnly',      'Delta only',    'Delta only'),
      new gadgets.OptionInfo('percentOfTotal', '% of total',    '% of total'),
      new gadgets.OptionInfo('cumulative',     'Cumulative',    'Cumulative')
    ];
    var lblContent = messages.VERTWATERFALL_DATA_LABEL_CONTENT || 'Data Label Content';
    panel.addChild(new gadgets.SingleSelectGadgetInfo(
      'wfDataLabelContent', lblContent, lblContent,
      new gadgets.GadgetValueProperties(
        euidef.GadgetTypeIDs.SINGLE_SELECT,
        wf.dataLabelContent || DEFAULTS.dataLabelContent,
        { ariaLabel: lblContent }
      ),
      0, false,
      labelContentOptions
    ));

    // Data Label Position (#7) — overrides the auto-flip post-pass
    var labelPositionOptions = [
      new gadgets.OptionInfo('auto',       'Auto',         'Auto'),
      new gadgets.OptionInfo('insideEnd',  'Inside end',   'Inside end'),
      new gadgets.OptionInfo('outsideEnd', 'Outside end',  'Outside end'),
      new gadgets.OptionInfo('center',     'Center',       'Center')
    ];
    var lblPosition = messages.VERTWATERFALL_DATA_LABEL_POSITION || 'Data Label Position';
    panel.addChild(new gadgets.SingleSelectGadgetInfo(
      'wfDataLabelPosition', lblPosition, lblPosition,
      new gadgets.GadgetValueProperties(
        euidef.GadgetTypeIDs.SINGLE_SELECT,
        wf.dataLabelPosition || DEFAULTS.dataLabelPosition,
        { ariaLabel: lblPosition }
      ),
      0, false,
      labelPositionOptions
    ));

    // Start / End total bars (#15)
    var ckStartTotal = typeof wf.showStartTotal === 'boolean' ? wf.showStartTotal : DEFAULTS.showStartTotal;
    panel.addChild(new gadgets.CheckboxGadgetInfo(
      'wfShowStartTotal',
      messages.VERTWATERFALL_SHOW_START_TOTAL || 'Show Start Total',
      'Insert a synthetic Start row showing the first value',
      new gadgets.CheckboxGadgetValueProperties(euidef.GadgetTypeIDs.CHECKBOX, ckStartTotal, ckStartTotal),
      0, false
    ));
    var ckEndTotal = typeof wf.showEndTotal === 'boolean' ? wf.showEndTotal : DEFAULTS.showEndTotal;
    panel.addChild(new gadgets.CheckboxGadgetInfo(
      'wfShowEndTotal',
      messages.VERTWATERFALL_SHOW_END_TOTAL || 'Show End Total',
      'Insert a synthetic End row showing the last (cumulative) value',
      new gadgets.CheckboxGadgetValueProperties(euidef.GadgetTypeIDs.CHECKBOX, ckEndTotal, ckEndTotal),
      0, false
    ));

    // Grand total static label (#16)
    var ckGrandTotal = typeof wf.showGrandTotal === 'boolean' ? wf.showGrandTotal : DEFAULTS.showGrandTotal;
    panel.addChild(new gadgets.CheckboxGadgetInfo(
      'wfShowGrandTotal',
      messages.VERTWATERFALL_SHOW_GRAND_TOTAL || 'Show Grand Total',
      'Render a static grand-total label in the bottom-right of the plot area',
      new gadgets.CheckboxGadgetValueProperties(euidef.GadgetTypeIDs.CHECKBOX, ckGrandTotal, ckGrandTotal),
      0, false
    ));

    // Connector lines between adjacent bars (#17)
    var ckConnectors = typeof wf.showConnectors === 'boolean' ? wf.showConnectors : DEFAULTS.showConnectors;
    panel.addChild(new gadgets.CheckboxGadgetInfo(
      'wfShowConnectors',
      messages.VERTWATERFALL_SHOW_CONNECTORS || 'Show Connectors',
      'Draw thin dashed lines connecting consecutive bars at their shared value',
      new gadgets.CheckboxGadgetValueProperties(euidef.GadgetTypeIDs.CHECKBOX, ckConnectors, ckConnectors),
      0, false
    ));

    // Reset to defaults trigger (#4). Clicking this checkbox clears all
    // waterfall.* keys from viewConfig so settings fall back to DEFAULTS.
    // The checkbox itself is stateless — _handlePropChange treats any
    // change as the reset signal.
    panel.addChild(new gadgets.CheckboxGadgetInfo(
      'wfResetDefaults',
      messages.VERTWATERFALL_RESET_DEFAULTS || 'Reset to defaults',
      'Click to clear all waterfall settings and restore the defaults',
      new gadgets.CheckboxGadgetValueProperties(euidef.GadgetTypeIDs.CHECKBOX, false, false),
      0, false
    ));

    VertWaterfall.superClass._addVizSpecificPropsDialog.call(
      this,
      oTabbedPanelsGadgetInfo
    );
  };

  /**
   * @param sGadgetID
   * @param oPropChange
   * @param oViewSettings
   * @param oActionContext
   */
  VertWaterfall.prototype._handlePropChange = function(
    sGadgetID,
    oPropChange,
    oViewSettings,
    oActionContext
  ) {
    var conf = oViewSettings.getViewConfigJSON(dataviz.SettingsNS.CHART) || {};
    var bUpdateSettings = VertWaterfall.superClass._handlePropChange.call(
      this,
      sGadgetID,
      oPropChange,
      oViewSettings,
      oActionContext
    );
    if (typeof this._handleLegendPropChange === 'function') {
      if (
        this._handleLegendPropChange(
          conf,
          sGadgetID,
          oPropChange,
          oViewSettings,
          oActionContext
        )
      ) {
        bUpdateSettings = true;
      }
    }
    // Reset trigger (#4): clear all waterfall.* keys so settings fall back
    // to DEFAULTS on next render. We don't store the trigger value itself.
    if (sGadgetID === 'wfResetDefaults') {
      conf.waterfall = {};
      oViewSettings.setViewConfigJSON(dataviz.SettingsNS.CHART, conf);
      return true;
    }
    // Map gadget IDs (no dots — ids with dots break aria/knockout bindings) to
    // the keys we store in viewConfig.waterfall.
    var WF_GADGET_TO_KEY = {
      wfIncreaseColor:     { key: 'increaseColor' },
      wfDecreaseColor:     { key: 'decreaseColor' },
      wfNeutralColor:      { key: 'neutralColor' },
      wfBarGap:            { key: 'barGap',           transform: function(v){ return Math.max(0, Math.min(95, Number(v))) / 100; } },
      wfDataLabels:        { key: 'dataLabels',       transform: function(v){ return v ? 'on' : 'off'; } },
      wfAxisLabels:        { key: 'axisLabels',       transform: function(v){ return v ? 'on' : 'off'; } },
      wfValuesAxisLabels:  { key: 'valuesAxisLabels', transform: function(v){ return v ? 'on' : 'off'; } },
      wfAxisTitle:         { key: 'axisTitle' },
      wfNumberFormat:      { key: 'numberFormat' },
      wfCurrencySymbol:    { key: 'currencySymbol' },
      wfNumberDecimals:    { key: 'numberDecimals',  transform: function(v){ return Math.max(0, Math.min(6, Number(v))); } },
      wfNumberThousandSep: { key: 'numberThousandSep' },
      wfNumberAbbreviation:{ key: 'numberAbbreviation' },
      wfNumberNegativeStyle:{ key: 'numberNegativeStyle' },
      wfDataLabelFont:     { key: 'dataLabelFont' },
      wfDataLabelSize:     { key: 'dataLabelSize',    transform: function(v){ return Math.max(8, Math.min(24, Number(v))); } },
      wfDataLabelBold:     { key: 'dataLabelBold' },
      wfDataLabelItalic:   { key: 'dataLabelItalic' },
      wfDataLabelColor:    { key: 'dataLabelColor' },
      wfDataLabelContent:  { key: 'dataLabelContent' },
      wfShowStartTotal:    { key: 'showStartTotal' },
      wfShowEndTotal:      { key: 'showEndTotal' },
      wfShowGrandTotal:    { key: 'showGrandTotal' },
      wfDataLabelPosition: { key: 'dataLabelPosition' },
      wfShowConnectors:    { key: 'showConnectors' }
    };
    var mapping = WF_GADGET_TO_KEY[sGadgetID];
    if (mapping && oPropChange) {
      // Try every shape we've seen oPropChange take across slider/checkbox.
      var raw = oPropChange.getValue && oPropChange.getValue();
      if (raw === undefined || raw === null) raw = oPropChange.value;
      if (raw === undefined || raw === null) raw = oPropChange;
      // Checkbox value props expose `.checked`; slider exposes the number directly.
      var newVal = raw;
      if (raw && typeof raw === 'object') {
        if ('checked' in raw)            newVal = raw.checked;
        else if ('transientValue' in raw) newVal = raw.transientValue;
        else if ('value' in raw)         newVal = raw.value;
      }
      if (!conf.waterfall) conf.waterfall = {};
      conf.waterfall[mapping.key] = mapping.transform ? mapping.transform(newVal) : newVal;
      oViewSettings.setViewConfigJSON(dataviz.SettingsNS.CHART, conf);
      bUpdateSettings = true;
    }
    return bUpdateSettings;
  };

  /**
   * Given an options / config object, configure it with default options for the visualization.
   *
   * @param {object} oOptions the options
   * @param {module:obitech-framework/actioncontext#ActionContext} oActionContext The ActionContext instance associated with this action
   * @protected
   */
  VertWaterfall.prototype._fillDefaultOptions = function(
    oOptions /*, oActionContext*/
  ) {
    if (jsx.isNull(oOptions)) return;
    var bUpdated = false;
    if (jsx.isNull(oOptions.legend)) {
      oOptions.legend = {
        rendered: 'on',
        position: 'auto'
      };
      bUpdated = true;
    }
    if (jsx.isNull(oOptions.waterfall)) {
      oOptions.waterfall = {
        increaseColor: DEFAULTS.increaseColor,
        decreaseColor: DEFAULTS.decreaseColor,
        neutralColor: DEFAULTS.neutralColor,
        barGap: DEFAULTS.barGap,
        dataLabels: DEFAULTS.dataLabels,
        dataLabelFont: DEFAULTS.dataLabelFont,
        dataLabelSize: DEFAULTS.dataLabelSize,
        dataLabelBold: DEFAULTS.dataLabelBold,
        dataLabelItalic: DEFAULTS.dataLabelItalic,
        dataLabelColor: DEFAULTS.dataLabelColor,
        axisLabels: DEFAULTS.axisLabels,
        valuesAxisLabels: DEFAULTS.valuesAxisLabels,
        axisTitle: DEFAULTS.axisTitle,
        numberFormat: DEFAULTS.numberFormat,
        currencySymbol: DEFAULTS.currencySymbol,
        numberDecimals: DEFAULTS.numberDecimals,
        numberThousandSep: DEFAULTS.numberThousandSep,
        numberAbbreviation: DEFAULTS.numberAbbreviation,
        numberNegativeStyle: DEFAULTS.numberNegativeStyle,
        dataLabelContent: DEFAULTS.dataLabelContent,
        dataLabelPosition: DEFAULTS.dataLabelPosition,
        showStartTotal: DEFAULTS.showStartTotal,
        showEndTotal: DEFAULTS.showEndTotal,
        showGrandTotal: DEFAULTS.showGrandTotal,
        showConnectors: DEFAULTS.showConnectors
      };
      bUpdated = true;
    }
    if (bUpdated) {
      this.getSettings().setViewConfigJSON(dataviz.SettingsNS.CHART, oOptions);
    }
  };

  /**
   * Override the base visualization and allow marks on the
   * data edge to be processed for color.
   * @returns {Boolean}
   */
  VertWaterfall.prototype._isOnlyPhysicalRowEdge = function() {
    return false;
  };

  /**
   * Re-render the visualization when color changes
   */
  VertWaterfall.prototype._onDefaultColorsSettingsChanged = function() {
    var oTransientVizContext = this.assertOrCreateVizContext();
    var oTransientRenderingContext = this.createRenderingContext(
      oTransientVizContext
    );
    this._render(oTransientRenderingContext);
  };

  /**
   * Resize the visualization
   * @param {Object} oVizDimensions - contains two properties, width and height
   * @param {module:obitech-report/vizcontext#VizContext} oTransientVizContext the viz context
   */
  VertWaterfall.prototype.resizeVisualization = function(
    oVizDimensions,
    oTransientVizContext
  ) {
    var oTransientRenderingContext = this.createRenderingContext(
      oTransientVizContext
    );

    this._render(oTransientRenderingContext);
  };

  /**
   * Returns the color layer info for categorical colors
   * @param {object} oDataLayoutHelper - The data layout helper
   * @param {object} oColorMapper - The color mapper
   * @param {boolean} bIncludeFormattedSeriesValues - Whether to include formatted series values
   * @param {boolean} bCalcDatapoint - Whether to calc data point coloring
   * @return {object} an object with two arrays; valueIds and formattedValues
   * @private
   */
  VertWaterfall.prototype._getCategoricalColorPropertiesForRowSlices = function(
    oDataLayoutHelper,
    oColorMapper,
    bIncludeFormattedSeriesValues,
    bCalcDatapoint,
    bCalcSeries
  ) {
    var oDataLayout = oDataLayoutHelper.getDataLayout();
    var nRowSlices =
      oDataLayout.getEdgeExtent(datamodelshapes.Physical.ROW) || 1;
    return jsx.Array.range(nRowSlices).map(function(i) {
      return oColorMapper.getColorProperties(i, 0, oDataLayoutHelper, {
        bIncludeFormattedSeriesValues: bIncludeFormattedSeriesValues,
        bIncludeMeasuresInCategoricalColorId: false,
        bCalcDatapoint: bCalcDatapoint,
        bCalcSeries: bCalcSeries
      });
    });
  };

  /**
   * Generate a color legend section
   * @param {module:obitech-renderingcontext/renderingcontext.RenderingContext} oTransientRenderingContext - The rendering context
   * @return {Object} - the color legend section
   * @private
   */
  VertWaterfall.prototype._getColorLegendSection = function(
    oTransientRenderingContext
  ) {
    var oDataLayoutHelper = oTransientRenderingContext.get(
      dataviz.DataContextProperty.DATA_LAYOUT_HELPER
    );
    var oLogicalDataModel = oTransientRenderingContext.get(
      dataviz.DataContextProperty.LOGICAL_DATA_MODEL
    );
    var aColumnsInColor = oLogicalDataModel.getColumnIDsIn(
      datamodelshapes.Logical.COLOR
    );

    if (jsx.isNull(aColumnsInColor) || aColumnsInColor.length === 0) {
      return null;
    }
    var oColorLegendItems =
      this.buildPresetLegendItemsForColor(
        oDataLayoutHelper,
        oDataModelColorMapper
      ) || {};
    var bIsEmptyPresetColorLegend = jsx.Map.isEmpty(oColorLegendItems);
    if (bIsEmptyPresetColorLegend) {
      // Fetch all color assignments for the table
      var aColorProps = this._getCategoricalColorPropertiesForRowSlices(
        oDataLayoutHelper,
        oDataModelColorMapper,
        true,
        false
      );
      var oDoneMap = {};
      // Remove the duplicate color assignments, so every item in the legend is unique
      for (var i = 0; i < aColorProps.length; i++) {
        var oColorProp = aColorProps[i].seriesProps;
        var sLabel = oColorProp.formattedValues.join(', ');
        if (jsx.isNull(oDoneMap[oColorProp.valueId])) {
          oDoneMap[oColorProp.valueId] = true;
          oColorLegendItems[sLabel] = oColorProp.color;
        }
      }
    }
    var aItems = [];
    for (var item in oColorLegendItems) {
      aItems.push({
        text: item,
        color: oColorLegendItems[item],
        type: 'marker',
        markerShape: 'square'
      });
    }
    if (aItems.length === 0) return null;
    var sTitle = this._getDisplayNameFromColumnIDs(
      oLogicalDataModel.getColumnIDsIn(datamodelshapes.Logical.COLOR)
    );
    var oColorSection = {
      title: sTitle,
      items: aItems
    };
    return oColorSection;
  };
  /**
   * Generates an array of objects containing 'ojSection' values that are used
   * by the legend component.  In our case, this generates a size
   * and a categorical legend.
   *
   * @param {module:obitech-renderingcontext/renderingcontext.RenderingContext} oTransientRenderingContext - The rendering context
   *
   * @return {Array.<>}an array of oj legend sections
   */
  VertWaterfall.prototype.generateOjLegendSections = function(
    oTransientRenderingContext
  ) {
    var aSections = [];
    var oColorSection = this._getColorLegendSection(oTransientRenderingContext);
    if (oColorSection) {
      aSections.push({ ojSection: oColorSection });
    }
    return aSections;
  };

  /**
   * Factory method declared in the plugin configuration
   * @param {string} sID Component ID for the visualization
   * @param {string=} sDisplayName Component display name
   * @param {string=} sOrigin Component host identifier
   * @param {string=} sVersion
   * @returns {module:com-company-vertWaterfall/vertWaterfall.VertWaterfall}
   * @memberof module:com-company-vertWaterfall/vertWaterfall
   */
  function createClientComponent(sID, sDisplayName, sOrigin) {
    // Argument validation done by base class
    return new VertWaterfall(sID, sDisplayName, sOrigin, VertWaterfall.VERSION);
  }

  return {
    createClientComponent: createClientComponent
  };
});
