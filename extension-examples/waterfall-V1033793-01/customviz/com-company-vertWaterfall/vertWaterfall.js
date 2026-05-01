define([
  'jquery',
  'obitech-framework/jsx',
  'obitech-reportservices/data',
  'obitech-application/gadgets',
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

      var longestStringLength = names[0].length;
      for (let index = 1; index < names.length; index++) {
        if (longestStringLength < names[index].length) {
          longestStringLength = names[index].length;
        }
      }

      // Get the width and height of our container
      var margin = {
        top: 20,
        right: 20,
        bottom: 40,
        left: 6.5 * longestStringLength
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

      // Define the div for the tooltip
      var tooltip = d3
        .select('body')
        .append('div')
        .attr('class', 'tooltip')
        .style('opacity', 0);

      var x = getXScale();
      var y = getYScale();

      setAxis();
      setFilter();

      //Grouping, powerpoint group
      var rectWrapper = svg
        .append('g')
        .attr('transform', 'translate(' + margin.left + ',' + margin.top + ')');
      var rectHeight = (height - margin.bottom) / dataset.length - 10;
      rectHeight = rectHeight < 0 ? 2 : rectHeight;
      rectWrapper
        .selectAll('rect')
        .data(dataset)
        .enter()
        .append('rect')
        .attr({
          y: function(d, i) {
            return i * ((height - margin.bottom) / dataset.length);
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
             <td>${Number.parseFloat(d.size).toLocaleString()} (${
                i !== 0 ? (d.size - dataset[i - 1].size).toLocaleString() : 0
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

      if (rectHeight > 30) {
        var textWrapper = svg
          .append('g')
          .attr(
            'transform',
            'translate(' + margin.left + ',' + margin.top + ')'
          );

        var text = textWrapper
          .selectAll('text')
          .data(dataset)
          .enter()
          .append('text')
          .attr({
            'text-anchor': 'end',
            'font-family': 'sans-serif',
            'font-size': 12,
            fill: 'white'
          });

        text
          .append('tspan')
          .attr({
            y: function(d, i) {
              var rectangleheight = (height - margin.bottom) / dataset.length;
              var position = i * rectangleheight;
              return position + (rectangleheight - 5) / 2 - 3;
            },
            x: function(d, i) {
              return textPosition(d, i);
            },
            'font-weight': '600'
          })
          .text(function(d, i) {
            return Number.parseFloat(d.size).toLocaleString();
          });
        text
          .append('tspan')
          .attr({
            y: function(d, i) {
              var rectangleheight = (height - margin.bottom) / dataset.length;
              var position = i * rectangleheight;
              return position + (rectangleheight - 10) / 2 - 3;
            },
            x: function(d, i) {
              return textPosition(d, i);
            },
            dy: 16
          })
          .text(function(d, i) {
            var diff;
            if (i === 0) {
              diff = '';
            } else {
              diff = d.size - dataset[i - 1].size;
              if (diff > 0) diff = '+' + diff.toLocaleString();
              else diff = diff.toLocaleString();
              diff = '(' + diff + ')';
            }
            return diff;
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
        } else {
          if (i === 0) {
            return '#00b0f0';
          } else if (
            Number.parseFloat(dataset[i - 1].size) > Number.parseFloat(d.size)
          ) {
            return 'orange';
          } else {
            return '#00b0f0';
          }
        }
      }

      function textPosition(d, i) {
        if (i === 0 || d.size > dataset[i - 1].size) return x(d.size) - 10;
        else return x(dataset[i - 1].size) - 10;
      }

      function setAxis() {
        var xAxis = d3.svg.axis().scale(x);
        var yAxis = d3.svg
          .axis()
          .scale(y)
          .tickSize(0)
          .tickPadding(10)
          .orient('left');

        svg
          .append('g')
          .attr(
            'transform',
            'translate(' + margin.left + ',' + (height - margin.top) + ')'
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
   * @param oTabbedPanelsGadgetInfo
   */
  VertWaterfall.prototype._addVizSpecificPropsDialog = function(
    oTabbedPanelsGadgetInfo
  ) {
    var options = this.getViewConfig() || {};
    this._fillDefaultOptions(options, null);
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
    //Allow the super class an attempt to handle the changes
    var bUpdateSettings = VertWaterfall.superClass._handlePropChange.call(
      this,
      sGadgetID,
      oPropChange,
      oViewSettings,
      oActionContext
    );
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
    if (!jsx.isNull(oOptions) && !jsx.isNull(oOptions.legend)) return;
    // Legend
    oOptions.legend = jsx.defaultParam(oOptions.legend, {});
    oOptions.legend.rendered = jsx.defaultParam(oOptions.legend.rendered, 'on');
    oOptions.legend.position = jsx.defaultParam(
      oOptions.legend.position,
      'auto'
    );
    this.getSettings().setViewConfigJSON(dataviz.SettingsNS.CHART, oOptions);
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
