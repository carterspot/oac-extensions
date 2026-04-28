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
    numberFormat: 'auto'
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
      numberFormat: wf.numberFormat || DEFAULTS.numberFormat
    };
  }

  function formatNumber(val, fmt) {
    var n = Number.parseFloat(val);
    if (isNaN(n)) return String(val);
    switch (fmt) {
      case 'abbreviated': {
        var abs = Math.abs(n);
        if (abs >= 1e9) return (n / 1e9).toFixed(2).replace(/\.?0+$/, '') + 'B';
        if (abs >= 1e6) return (n / 1e6).toFixed(2).replace(/\.?0+$/, '') + 'M';
        if (abs >= 1e3) return (n / 1e3).toFixed(2).replace(/\.?0+$/, '') + 'K';
        return n.toLocaleString();
      }
      case 'currency':
        return '$' + n.toLocaleString(undefined, {
          minimumFractionDigits: 2,
          maximumFractionDigits: 2
        });
      case 'percent':
        return (n * 100).toFixed(2).replace(/\.?0+$/, '') + '%';
      case 'comma':
      case 'auto':
      default:
        return n.toLocaleString();
    }
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

      var names = [];
      dataset.forEach(function(d, i, a) {
        names.push(d.name);
      });

      var sizes = [];
      dataset.forEach(function(d, i, a) {
        sizes.push(d.size);
      });

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

      var bandHeight = (height - margin.bottom) / dataset.length;

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
        .data(dataset)
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
          if (d.tooltip.length > 0) {
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
             <td>${formatNumber(d.size, settings.numberFormat)} (${
                i !== 0
                  ? formatNumber(
                      d.size - dataset[i - 1].size,
                      settings.numberFormat
                    )
                  : 0
              })</td>
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
          .data(dataset)
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
          .text(function(d, i) {
            var value = formatNumber(d.size, settings.numberFormat);
            if (i === 0) return value;
            var raw = d.size - dataset[i - 1].size;
            var delta = formatNumber(raw, settings.numberFormat);
            if (raw > 0 && delta.charAt(0) !== '+') delta = '+' + delta;
            return value + ' (' + delta + ')';
          });

        // Three-way label placement (issues #6, #12):
        //   1. Fits inside the bar → leave it (anchor end at barRight - 10).
        //   2. Doesn't fit, but there's room outside-right → flip there.
        //   3. Wouldn't fit outside either (bar near chart's right edge) →
        //      anchor at the chart's right edge so the label stays on-screen,
        //      using insideFill since most of it overlays the bar.
        var plotWidth = width - margin.left - margin.right;
        text.each(function(d, i) {
          var node = this;
          var barLeft = waterfallX(d, i);
          var barRight = barLeft + waterfallSize(d, i);
          var labelRight = textPosition(d, i);
          var maxTspanWidth = 0;
          var tspans = node.getElementsByTagName('tspan');
          for (var k = 0; k < tspans.length; k++) {
            var w = tspans[k].getComputedTextLength ? tspans[k].getComputedTextLength() : 0;
            if (w > maxTspanWidth) maxTspanWidth = w;
          }
          var fitsInside = labelRight - maxTspanWidth >= barLeft;
          if (fitsInside) return;
          var fitsOutsideRight = barRight + 4 + maxTspanWidth <= plotWidth;
          if (fitsOutsideRight) {
            d3.select(node)
              .attr('text-anchor', 'start')
              .attr('fill', outsideFill);
            d3.select(node).selectAll('tspan').attr('x', barRight + 4);
          } else {
            d3.select(node)
              .attr('text-anchor', 'end')
              .attr('fill', insideFill);
            d3.select(node).selectAll('tspan').attr('x', plotWidth - 2);
          }
        });
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
        if (i === 0) {
          val = d.size;
        } else {
          var previousSize = dataset[i - 1].size;
          val = Math.abs(previousSize - d.size);
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
        if (i === 0) {
          if (d.size >= 0) {
            val = 0;
          } else {
            val = d.size;
          }
        } else {
          var previousSize = Number.parseFloat(dataset[i - 1].size);
          if (previousSize > Number.parseFloat(d.size)) {
            val = d.size;
          } else {
            val = dataset[i - 1].size;
          }
        }

        return x(val);
      }

      function waterfallColor(d, i) {
        if (!areColorsTheSame()) {
          return d.color;
        }
        if (i === 0) return settings.neutralColor;
        var prev = Number.parseFloat(dataset[i - 1].size);
        var cur = Number.parseFloat(d.size);
        if (cur > prev) return settings.increaseColor;
        if (cur < prev) return settings.decreaseColor;
        return settings.neutralColor;
      }

      function textPosition(d, i) {
        if (i === 0 || d.size > dataset[i - 1].size) return x(d.size) - 10;
        else return x(dataset[i - 1].size) - 10;
      }

      function setAxis() {
        var xAxis = d3.svg.axis().scale(x).tickFormat(function(v) {
          if (settings.valuesAxisLabels === 'off') return '';
          return formatNumber(v, settings.numberFormat);
        });
        // When the per-row band gets shorter than a label line, ticks would
        // stack on top of each other. Show every Nth label so they stay
        // legible (issue #1). Margin.left is sized for the widest label, so
        // visible labels won't suddenly need more room.
        var labelLineHeight = Y_AXIS_FONT_SIZE + 4;
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

        svg
          .append('g')
          .attr(
            'transform',
            'translate(' + margin.left + ',' + margin.top + ')'
          )
          .attr('class', 'axis-y')
          .call(yAxis);

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
    // CalendarViz uses this exact pattern. Adding to the GENERAL panel keeps
    // our controls alongside the standard Title/Subtitle/Footnote section.
    var panel = gadgetdialog.forcePanelByID(
      oTabbedPanelsGadgetInfo,
      euidef.GD_PANEL_ID_GENERAL
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

    // ColorPickers deferred to a later iteration — COLOR_SWITCHER typeId routes
    // to TextSwitcherGadgetView which calls getOptionCaptionByValue() on the
    // value-properties; needs a color-palette OptionInfo array we haven't yet
    // figured out the right shape for. Render-layer keeps the right defaults.

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
      new gadgets.OptionInfo('auto',        'Auto',        'Auto'),
      new gadgets.OptionInfo('comma',       'Number',      'Number'),
      new gadgets.OptionInfo('abbreviated', 'Abbreviated', 'Abbreviated'),
      new gadgets.OptionInfo('currency',    'Currency',    'Currency'),
      new gadgets.OptionInfo('percent',     'Percent',     'Percent')
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
    // Map gadget IDs (no dots — ids with dots break aria/knockout bindings) to
    // the keys we store in viewConfig.waterfall.
    var WF_GADGET_TO_KEY = {
      wfBarGap:            { key: 'barGap',           transform: function(v){ return Math.max(0, Math.min(95, Number(v))) / 100; } },
      wfDataLabels:        { key: 'dataLabels',       transform: function(v){ return v ? 'on' : 'off'; } },
      wfAxisLabels:        { key: 'axisLabels',       transform: function(v){ return v ? 'on' : 'off'; } },
      wfValuesAxisLabels:  { key: 'valuesAxisLabels', transform: function(v){ return v ? 'on' : 'off'; } },
      wfAxisTitle:         { key: 'axisTitle' },
      wfNumberFormat:      { key: 'numberFormat' },
      wfDataLabelFont:     { key: 'dataLabelFont' },
      wfDataLabelSize:     { key: 'dataLabelSize',    transform: function(v){ return Math.max(8, Math.min(24, Number(v))); } },
      wfDataLabelBold:     { key: 'dataLabelBold' },
      wfDataLabelItalic:   { key: 'dataLabelItalic' },
      wfDataLabelColor:    { key: 'dataLabelColor' }
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
        numberFormat: DEFAULTS.numberFormat
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
