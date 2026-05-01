define(['jquery',
        'obitech-framework/jsx',
        'obitech-report/datavisualization',
        'obitech-legend/legendandvizcontainer',
        'obitech-reportservices/datamodelshapes',
        'obitech-reportservices/events',
        'obitech-reportservices/interactionservice',
        'obitech-reportservices/markingservice',
        'obitech-application/gadgets',
        'obitech-report/visualization',
        'obitech-report/gadgetdialog',
        'obitech-application/bi-definitions',
        'obitech-appservices/logger',
        'ojL10n!com-company-racingBarsViz/nls/messages',
        'obitech-application/extendable-ui-definitions',
        'obitech-reportservices/data',
        'd3js',
        'knockout',
        'ojs/ojattributegrouphandler',
        'obitech-framework/messageformat',
        'skin!css!com-company-racingBarsViz/racingBarsVizstyles'],
    function($,
             jsx,
             dataviz,
             legendandvizcontainer,
             datamodelshapes,
             events,
             interactions,
             marking,
             gadgets,
             viz,
             gadgetdialog,
             definitions,
             logger,
             messages,
             euidef,
             data,
             d3,
             ko,
             attributeGroupHandler) {
        "use strict";

        var MODULE_NAME = 'com-company-racingBarsViz/racingBarsViz';

        //Param validation to detect cyclical dependencies (ignore modules not used in resource arguments)
        jsx.assertAllNotNullExceptLastN(arguments, "racingBarsViz.js arguments", 2);

        var racingBars = {};

        var _logger = new logger.Logger(MODULE_NAME);

        // The version of our Plugin
        RacingBarsViz.VERSION = "1.0.0";

        /**
         * The implementation of the racingbarsViz visualization.
         *
         * @constructor
         * @param {string} sID
         * @param {string} sDisplayName
         * @param {string} sOrigin
         * @param {string} sVersion
         * @extends {module:obitech-report/visualization.Visualization}
         * @memberof module:com-company-racingbarsViz/racingbarsViz#
         */

        function RacingBarsViz(sID, sDisplayName, sOrigin, sVersion) {
            // Argument validation done by base class
            RacingBarsViz.baseConstructor.call(this, sID, sDisplayName, sOrigin, sVersion);

            var duration = '1';
            var xAxis = 'Off';
            var zAxis = 'None';
            var displayLabel = 'On';
            var topN = '';
            var value_panel = '';
            var tabInfo = '';
            var groupInfo = '';
            var xDisplayName ='', yDisplayName='';
            var rowDisplayNames=[];
            var tArray = [];
            var legendItems = new Map();
            var timeArray = [];
            var cID = '';
            //var aggregate = 'None';

            this.Config = {
                duration: '1',
                topN: '',
                xAxis: 'Off',
                zAxis: 'None',
                displayLabel: 'On',
                c_title:'Auto',
                xDisplayName: '',
                yDisplayName: '',
                rowDisplayNames: [],
                tArray: [],
                legendItems: new Map(),
                timeArray: [],
                cID: '',
                aggregate: 'None'
            }

            this._saveSettings = function() {
                this.getSettings().setViewConfigJSON(dataviz.SettingsNS.CHART, this.Config);
            };

            this.loadConfig = function (){
                var conf = this.getSettings().getViewConfigJSON(dataviz.SettingsNS.CHART) || {};
                if (conf.duration) this.Config.duration = conf.duration;
                if (conf.xAxis) this.Config.xAxis = conf.xAxis;
                if (conf.zAxis) this.Config.zAxis = conf.zAxis;
                if (conf.topN) this.Config.topN = conf.topN;
                if (conf.displayLabel) this.Config.displayLabel = conf.displayLabel;
                if (conf.c_title) this.Config.c_title = conf.c_title;
                if (conf.xDisplayName) this.Config.xDisplayName = conf.xDisplayName;
                if (conf.yDisplayName) this.Config.yDisplayName = conf.yDisplayName;
                if (conf.rowDisplayNames) this.Config.rowDisplayNames = conf.rowDisplayNames;
                if (conf.tArray) this.Config.tArray = conf.tArray;
                if (conf.legendItems) this.Config.legendItems = conf.legendItems;
                if (conf.timeArray) this.Config.timeArray = conf.timeArray;
                if (conf.cID) this.Config.cID = conf.cID;
                if (conf.aggregate) this.Config.aggregate = conf.aggregate;

            }

            this.getXDisplayName = function(){
                return(this.Config.xDisplayName);
            };

            this.setXDisplayName = function (o){
                this.Config.xDisplayName = o;
            };

            this.getYDisplayName = function(){
                return(this.Config.yDisplayName);
            };

            this.setYDisplayName = function (o){
                this.Config.yDisplayName = o;
            };

            this.getRowDisplayNames = function(){
                return(this.Config.rowDisplayNames);
            };

            this.setRowDisplayNames = function (o){
                this.Config.rowDisplayNames = o;
            };

            this.getTArray = function(){
                return(this.Config.tArray);
            };

            this.setTArray = function (o){
                this.Config.tArray = o;
            };

            this.getLegendItems = function(){
                return(this.Config.legendItems);
            };

            this.setLegendItems = function (o){
                this.Config.legendItems = o;
            };

            this.getTimeArray = function(){
                return(this.Config.timeArray);
            };

            this.setTimeArray = function (o){
                this.Config.timeArray = o;
            };

            this.getCID = function(){
                return(this.Config.cID);
            };

            this.setCID = function (o){
                this.Config.cID = o;
            };

            this.getAggregate = function(){
                return(this.Config.aggregate);
            };

            this.setAggregate = function (o){
                this.Config.aggregate = o;
                this._saveSettings();
            };

            this.getCTitle = function(){
                return(this.Config.c_title);
            };

            this.setCTitle = function (o){
                this.Config.c_title = o;
                this._saveSettings();
            };

            this.getDuration = function(){
                return(this.Config.duration);
            };

            this.setDuration = function (o){
                this.Config.duration = o;
                this._saveSettings();
            };

            this.getTopN = function(){
                return(this.Config.topN);
            };

            this.setTopN = function (o){
                this.Config.topN = o;
                this._saveSettings();
            };

            this.getXAxis = function(){
                return(this.Config.xAxis);
            };

            this.setXAxis = function (o){
                this.Config.xAxis = o;
                this._saveSettings();
            };

            this.getZAxis = function(){
                return(this.Config.zAxis);
            };

            this.setZAxis = function (o){
                this.Config.zAxis = o;
                this._saveSettings();
            };

            this.getDisplayLabel = function(){
                return(this.Config.displayLabel);
            };

            this.setDisplayLabel = function (o){
                this.Config.displayLabel = o;
                this._saveSettings();
            };

            this.getValuePanel = function(){
                return(value_panel);
            };

            this.setValuePanel = function (o){
                value_panel = o;
            };

            this.getTabInfo = function(){
                return(tabInfo);
            };

            this.setTabInfo = function (o){
                tabInfo = o;
            };

            this.getGroupInfo = function(){
                return(groupInfo);
            };

            this.setGroupInfo = function (o){
                groupInfo = o;
            };

            /**
             * @type {Array.<String>} - The array of selected items
             */
            var aSelectedItems = new Map();

            /**
             * @return  {Array.<String>} - The array of selected items
             */
            this.getSelectedItems = function(){
                return aSelectedItems;
            };

            /**
             * Clears the current list of selected items
             */
            this.clearSelectedItems = function(){
                aSelectedItems = new Map();
            };
        };


        jsx.extend(RacingBarsViz, dataviz.DataVisualization);

        RacingBarsViz.prototype._generateData = function(oDataLayout, oTransientRenderingContext){

            var oDataModel = this.getRootDataModel();
            if(!oDataModel || !oDataLayout){
                return;
            }
            this.setRowDisplayNames(new Map());
            var aAllMeasures = oDataModel.getColumnIDsIn(datamodelshapes.Physical.DATA);
            var nMeasures = aAllMeasures.length;
            var nRows = oDataLayout.getEdgeExtent(datamodelshapes.Physical.ROW);
            var nRowLayerCount = oDataLayout.getLayerCount(datamodelshapes.Physical.ROW);
            var nCols = oDataLayout.getEdgeExtent(datamodelshapes.Physical.COLUMN);
            var nColLayerCount = oDataLayout.getLayerCount(datamodelshapes.Physical.COLUMN);
            var oDataLayoutHelper = oTransientRenderingContext.get(dataviz.DataContextProperty.DATA_LAYOUT_HELPER);

            //Get the display names of the rows
            for(var nRow = 0; nRow < nRowLayerCount; nRow++){
                var rowKey = oDataLayoutHelper.getLogicalEdgeName(datamodelshapes.Physical.ROW, nRow);
                var displayName = oDataLayout.getLayerMetadata(datamodelshapes.Physical.ROW, nRow, data.LayerMetadata.LAYER_DISPLAY_NAME);
                this.getRowDisplayNames().set(rowKey, {order: nRow, name: displayName});
            }

            var oColorContext = this.getColorContext(oTransientRenderingContext);
            var oColorInterpolator = this.getCachedColorInterpolator(oTransientRenderingContext, datamodelshapes.Logical.COLOR);

            // Measure labels layer
            var isMeasureLabelsLayer = function (eEdgeType, nLayer) {
                return oDataLayout.getLayerMetadata(eEdgeType, nLayer, data.LayerMetadata.LAYER_ISMEASURE_LABELS);
            };

            // Last layer: we get the data values and colors from this layer
            var getLastNonMeasureLayer = function (eEdge) {
                var nLayerCount = oDataLayout.getLayerCount(eEdge);
                for (var i = nLayerCount - 1; i >= 0; i--) {
                    if (!isMeasureLabelsLayer(eEdge, i))
                        return i;
                }
                return -1;
            };

            var nLastEdge = datamodelshapes.Physical.COLUMN; // check column edge first

            var nLastLayer = getLastNonMeasureLayer(datamodelshapes.Physical.COLUMN);
            if (nLastLayer < 0) { // if not on column edge look on row edge
                nLastEdge = datamodelshapes.Physical.ROW;
                nLastLayer = getLastNonMeasureLayer(datamodelshapes.Physical.ROW);
            }


            //--------------------------------------------------------
            var outputMap = [], outputObj = [];

            var tArray = [], legendItems = new Map();
            var zElements = new Map();
            var isColor = this.getRowDisplayNames().get("color") ? true : false;
            var valMap = new Map();
            var zColOrder = parseInt(this.getRowDisplayNames().get("detail").order);
            var zColumnId = oDataLayout.getLayerMetadata(datamodelshapes.Physical.ROW, zColOrder, data.LayerMetadata.LAYER_ID);
                //this._getAllColumnInfos()[zColOrder]._info.columnID;
            var rSum = {};

            for(var nRow = 0; nRow < Math.max(nRows, 1); nRow++) {
                var colorObj, color, xval, yval, zval, name;
                xval = parseFloat(oDataLayout.getValue(datamodelshapes.Physical.DATA, nRow, 0));
                for (var nRowLayer = 0; nRowLayer < Math.max(nRowLayerCount, 1); nRowLayer++) {
                    var rowType = oDataLayoutHelper.getLogicalEdgeName(datamodelshapes.Physical.ROW, nRowLayer);
                    switch (rowType) {
                        case "row":
                            yval = !yval ? oDataLayout.getValue(datamodelshapes.Physical.ROW, nRowLayer, nRow, false)
                                    : yval + ', ' + oDataLayout.getValue(datamodelshapes.Physical.ROW, nRowLayer, nRow, false);
                            break;
                        case "detail":
                            zval = oDataLayout.getValue(datamodelshapes.Physical.ROW, nRowLayer, nRow, false);
                            zval = zval.trim();
                            //tArray.push(zval);
                            var timestamp = Date.parse(zval);
                            if (isNaN(timestamp) == false) {
                                zval = this.formatValue(zval, zColumnId, this.assertOrCreateVizContext());
                            }
                            zElements.set(zval, '');
                            break;
                        case "color":
                            colorObj = this.getDataItemColorInfo(oDataLayoutHelper, oColorContext, oColorInterpolator, nRow, 0);
                            color = colorObj.sSeriesColorLabel;
                            legendItems.set(color, '');
                            break;
                    }
                }
                name = isColor ? yval + ', ' + color : yval;
                valMap.set(name, 0);

                if(this.getAggregate() === 'RSUM'){
                    //New change to include RSUM
                    rSum[name] = rSum[name] || {x:0};
                    rSum[name].x += xval;
                    xval = rSum[name].x;
                }

                var aOutput = {name: name, category: yval,  value: xval, year: zval, lastValue: 0, rank: 0, color: color, row: nRow, col: 0 };
                outputMap.push(aOutput);
                yval = null;
            }

            var uniqueZ = [];
            for(let z of zElements.keys()){
                uniqueZ.push(z);
            }

            if(this.getZAxis() === 'Ascending'){
                uniqueZ.sort(function (a, b) {
                    return ('' + a).localeCompare(b, 'en', { numeric: true });
                });
            } else if(this.getZAxis() === 'Descending'){
                uniqueZ.sort(function (a, b) {
                    return ('' + b).localeCompare(a, 'en', { numeric: true });
                });
            }

            var groupByZ = outputMap.reduce(function (r, a) {
                r[a.year] = r[a.year] || [];
                r[a.year].push(a);
                return r;
            }, Object.create(null));

            var txMap = new Map();
            for(let i = 0; i < uniqueZ.length; i++){
                groupByZ[uniqueZ[i]].sort(function (a, b) {
                    return ('' + b.value).localeCompare(a.value, 'en', { numeric: true });
                });
                for(let j = 0; j < groupByZ[uniqueZ[i]].length; j++){
                    var obj = groupByZ[uniqueZ[i]][j];
                    obj.rank = j+1;
                    if(txMap.get(obj.name)){
                        obj.lastValue = txMap.get(obj.name);
                    } else {
                        obj.lastValue = 0;
                    }
                    txMap.set(obj.name, obj.value);
                }
            }

            this.setTArray(uniqueZ);
            this.setLegendItems(legendItems);

            if (outputMap)
                return outputMap;
            else
                return null;
        }


        RacingBarsViz.prototype._render = function(oTransientRenderingContext) {
            // Note: all events will be received after initialize and start complete.  We may get other events
            // such as 'resize' before the render, i.e. this might not be the first event.
            var playing = true;
            try{
                this.loadConfig();
                // Retrieve the data object for this visualization
                var oDataLayout = oTransientRenderingContext.get(dataviz.DataContextProperty.DATA_LAYOUT);

                if (!oDataLayout)
                    return;

                var durationValue = parseFloat(this.getDuration());
                var dataObj = this._generateData(oDataLayout, oTransientRenderingContext);
                var obj = this;

                var elContainer = this.getContainerElem();
                //console.log("Container ID: "+$(elContainer)[0].id);
                var sVizContainerId = this.getSubElementIdFromParent(this.getContainerElem(), "hvc");
                var pane = sVizContainerId.substring(sVizContainerId.indexOf("view")+5,sVizContainerId.indexOf("pane"));
                var conetentPane = sVizContainerId.substring(sVizContainerId.indexOf("contentpane_")+12,sVizContainerId.indexOf("vizCont")-1);
                var cId = pane+"_"+conetentPane;
                this.setCID(cId);
                var colorCategory = this.getRowDisplayNames().get("color") ? this.getRowDisplayNames().get("color").name : "";
                var isColor = this.getRowDisplayNames().get("color") ? true : false;
                var widthParam = isColor ? 130 : 0;
                var htmlContent = "<div class='canvas' id="+cId+">" +
                    "<div class='racing_bars_main'><p id=chart_"+cId+" class='chart'><\/p>"+
                    "<div class='playarea'>" +
                    "<span id=playText_"+cId+" class='playText'><\/span>\n" +
                    "<div id=play_"+cId+" data-role=button data-inline=true data-icon=refresh class='play'>" +
                    "<\/div><\/div>"+
                    "</div>";
                if(isColor){
                    htmlContent += "<div>"+
                        "<div id=legendPane_"+cId+" class='title'>" +
                        "<span id=legendName_"+cId+">"+colorCategory+"</span></div>" +
                        "<div id=legend_"+cId+" class='legend'></div>"+
                        "</div>";
                }
                htmlContent += "</div>";
                $(elContainer).html(htmlContent);
                //elContainer.style.overflow = "auto";

                $(".canvas").attr("width", $(elContainer).width());
                $(".canvas").attr("height", $(elContainer).height());
                var width = $(elContainer).width();
                var height = $(elContainer).height();

                var xCaption = oDataLayout.getValue(datamodelshapes.Physical.COLUMN, 0, 0, false);
                var yCaption = this.getRowDisplayNames().get("row").name;

                //Adding Legend Data
                var uniqueLegends = [], colorStack = [];
                for(let color of this.getLegendItems().keys()){
                    uniqueLegends.push(color);
                    colorStack.push(color);
                }

                //Color Scale
                var colorHandler = new attributeGroupHandler.ColorAttributeGroupHandler();
                var colorScale = function(str) {
                    return colorHandler.getValue(str);
                }

                var opacityPoint = isColor ? .85 : 1;
                /*var colorScale = function(i){
                    i = i < 0 ? 0 : i;
                    i = i > 100 ? i - 100 : i;
                    var colorArray = ["#4682B4", "#32CD32", "#FFD700", "#FF4500", "#6A5ACD", "#40E0D0", "#FFA500", "#FF69B4", "#1E90FF", "#9ACD32", "#9932CC",
                        "#FFE4C4", "#0000FF", "#008000", "#DAA520", "#B22222", "#483D8B", "#008B8B", "#FF7F50", "#FF1493", "#00FF00", "#DA70D6", "#DEB887",
                        "#00008B", "#00BFFF", "#D2691E", "#7FFFD4", "#8B4513", "#00FA9A", "#556B2F", "#800000", "#CD5C5C", "#FFFF00", "#E6E6FA", "#B0E0E6",
                        "#87CEFA", "#6495ED", "#5F9EA0", "#7B68EE", "#4169E1", "#0000CD", "#000080", "#191970", "#8A2BE2", "#4B0082", "#FFF8DC", "#FFEBCD",
                        "#FFDEAD", "#F5DEB3", "#D2B48C", "#BC8F8F", "#F4A460", "#CD853F", "#A0522D", "#A52A2A", "#E0FFFF", "#00FFFF", "#AFEEEE", "#00CED1",
                        "#20B2AA", "#008080", "#F0E68C", "#FF8C00", "#FFDF00", "#D4AF37", "#E6BE8A", "#996515", "#7CFC00", "#228B22", "#006400", "#ADFF2F",
                        "#00FF7F", "#98FB98", "#8FBC8F", "#3CB371", "#2E8B57", "#808000", "#6B8E23", "#708090", "#DC143C", "#FF6347", "#FFC0CB", "#DB7093",
                        "#C71585", "#D8BFD8", "#EE82EE", "#FF00FF", "#BA55D3", "#9370DB", "#9400D3", "#800080", "#FFA07A", "#FA8072", "#F08080", "#FF0000",
                        "#BDB76B", "#FFFFCC", "#FFFF66", "#CCCC00", "#999900", "#666600"];
                    return colorArray[i];
                }*/

                function addLegendPane(){
                    //legend_"+cId+"
                    var legendHeight = 20*uniqueLegends.length;
                    var legendMaxHt = height + .7;
                    var marginOffset = 25;
                    var legendMarginTop = legendMaxHt >= legendHeight ? ((legendMaxHt-legendHeight)/2)+marginOffset : marginOffset;

                    var svgLegned4 = d3.select("#legend_"+cId).append("svg")
                        .attr("width", 110)
                        .attr("height", legendHeight);

                    //colorStack.sort();

                    var legend4 = svgLegned4.selectAll("#legend_"+cId)
                        .data(colorStack)
                        .enter().append('g')
                        .attr("transform", function (d, i) {
                            return "translate(0," + i * 20 + ")";
                        });

                    legend4.append('rect')
                        .attr("x", 0)
                        .attr("y", 0)
                        .attr("width", 10)
                        .attr("height", 10)
                        .style("opacity", opacityPoint)
                        .style("fill", function (d, i) {
                            return colorScale(d);
                        });

                    legend4.append('text')
                        .attr("x", 20)
                        .attr("y", 10)
                        .text(function (d, i) {
                            return d
                        })
                        .attr("class", "textselected")
                        .style("text-anchor", "start")
                        .style("font-size", 10);

                    $("#legend_"+cId).css("max-height", legendMaxHt);
                    $("#legend_"+cId).css("margin-top", legendMarginTop);
                    $("#legendPane_"+cId).css("padding-top", legendMarginTop-marginOffset);
                }

                var m = {top: 10, right: 10, bottom: 10, left: 10}
                    , h = height - m.top - m.bottom - 30
                    , w = (width - widthParam) - m.left - m.right;

                var svg = d3.select("#chart_"+cId).append("svg")
                    .attr("width", w)
                    .attr("height", h);

                const uniqueCat = [...new Set(dataObj.map(item => item.name))];
                var uniqueYears = this.getTArray();

                //var tickDuration = (durationValue / uniqueYears.length) * 1000;
                var tickDuration = durationValue * 1000;
                var durationCycle = tickDuration + 1000;

                //console.log("ZAxis: "+uniqueYears);

                let year = uniqueYears[0];
                let maxYear = uniqueYears[uniqueYears.length-1];
                let yearIndex = 0;

                let subTitle = svg.append("text")
                    .attr("class", "subTitle")
                    .attr("y", 10)
                    .attr("x", w/2)
                    .html(xCaption);

                svg.append("text")
                    .attr("class", "subTitle")
                    .attr("text-anchor", "end")
                    .attr("y", 15)
                    .attr("transform", "rotate(-90)")
                    .html(yCaption);


                $("#play_"+cId).addClass("play_button");
                $("#playText_"+cId).text("Refresh Plugin : ");

                $("#play_"+cId).click(function() {
                    if($("#play_"+cId).hasClass("play_button")) {
                        startPlaying();
                    }
                });

                function startPlaying() {
                    obj._render(oTransientRenderingContext);
                }

                drawRacingBars(dataObj, obj);
                if(isColor){
                    addLegendPane();
                }

                function drawRacingBars(data, obj) {

                    String.prototype.trunc = String.prototype.trunc ||
                        function(n){
                            var pos = this.indexOf(',');
                            var output;
                            output = pos > 0 ?  this.substr(0, pos) : this;
                            return (output.length > n) ? output.substr(0, n-1) + '...' : output;
                        };

                    data.forEach(d => {
                        d.value = +d.value,
                        d.lastValue = +d.lastValue,
                        d.value = isNaN(d.value) ? 0 : d.value,
                        d.year = d.year,
                        d.colour = colorScale(d.color)
                    });

                    var yearSlice = data.filter(d => d.year == uniqueYears[yearIndex]);

                    var topNVal = obj.getTopN() ? parseInt(obj.getTopN()) : 0;

                    var top_n = (topNVal > 0 && topNVal < yearSlice.length) ? topNVal : yearSlice.length;

                    yearSlice = yearSlice.sort((a,b) => b.value - a.value)
                        .slice(0, top_n);

                    yearSlice.forEach((d,i) => d.rank = i);

                    var barPadding = (h)/(top_n*5);


                    var xMin;
                    var x = d3.scale.linear()
                        .range([70, w-65]);

                    if(obj.getXAxis() === 'On'){
                        xMin = d3.min(yearSlice, d => d.value) > 0 ? 0 : d3.min(yearSlice, d => d.value);
                        x.domain([xMin, d3.max(yearSlice, d => d.value)]);
                    } else {
                        xMin = d3.min(data, d => d.value) >= 0 ? 0 : d3.min(data, d => d.value);
                        x.domain([xMin, d3.max(data, d => d.value)]);
                    }

                    var y = d3.scale.linear()
                        .domain([top_n, 0])
                        .range([h-m.bottom, m.top+20]);

                    var xAxis = d3.svg.axis()
                        .scale(x)
                        .orient('top')
                        .ticks(w > 500 ? 5:2)
                        .tickSize(h)
                        .tickFormat(d => d3.format(',')(d));

                    svg.append('g')
                        .attr('class', 'axis xAxis')
                        .attr('transform', `translate(0, ${h+30})`)
                        .call(xAxis)
                        .selectAll('.tick line')
                        .classed('origin', d => d == 0);

                    svg.selectAll('rect.bar')
                        .data(yearSlice, d => d.name)
                        .enter()
                        .append('rect')
                        .attr('class', 'bar')
                        .attr('x', d => x(Math.min(0, d.value))+1)
                        .attr('width', d => Math.abs(x(d.value)-x(0)-1))
                        .attr('y', d => y(d.rank)+5)
                        .attr('height', y(1)-y(0)-barPadding)
                        .style("opacity", opacityPoint)
                        .style('fill', d => d.colour)
                        .attr("data-row", d => d.row);

                    obj._buildSelectedItems(oTransientRenderingContext);

                    if(obj.getDisplayLabel() === 'On'){
                        svg.selectAll('text.label')
                            .data(yearSlice, d => d.name)
                            .enter()
                            .append('text')
                            .attr('class', 'label')
                            .attr('x', d => x(d.value)-8)
                            .attr('y', d => y(d.rank)+5+((y(1)-y(0))/2)+1)
                            .style('text-anchor', 'end')
                            .html(d => d.category.trunc(13));

                        svg.selectAll('text.valueLabel')
                            .data(yearSlice, d => d.name)
                            .enter()
                            .append('text')
                            .attr('class', 'valueLabel')
                            .attr('x', d => x(d.value)+5)
                            .attr('y', d => y(d.rank)+5+((y(1)-y(0))/2)+1)
                            .text(d => d3.format(',.2f')(d.value));
                    }

                    const halo = function(text, strokeWidth) {
                        text.select(function() { return this.parentNode.insertBefore(this.cloneNode(true), this); })
                            .style('fill', '#ffffff')
                            .style( 'stroke','#ffffff')
                            .style('stroke-width', strokeWidth)
                            .style('stroke-linejoin', 'round')
                            .style('opacity', 1);
                    };

                    let yearText = svg.append('text')
                        .attr('class', 'yearText')
                        .attr('x', w-m.right)
                        .attr('y', h-10)
                        .style('text-anchor', 'end')
                        .html(uniqueYears[yearIndex].trunc(15))
                        .call(halo, 8);

                    yearIndex++;
                    tweenBars();

                    function tweenBars(){
                        var ticker;
                        try{
                            ticker = setInterval(function(){
                                yearSlice = data.filter(d => d.year == uniqueYears[yearIndex]);

                                if(yearSlice && yearSlice.length > 0 && yearIndex < uniqueYears.length){
                                    top_n = (topNVal > 0 && topNVal < yearSlice.length) ? topNVal : yearSlice.length;
                                    barPadding = (h)/(top_n*5);
                                    y = d3.scale.linear()
                                        .domain([top_n, 0])
                                        .range([h-m.bottom, m.top+20]);
                                    yearSlice = yearSlice.sort((a,b) => b.value - a.value)
                                        .slice(0, top_n);

                                    yearSlice.forEach((d,i) => d.rank = i);

                                    if(obj.getXAxis() === 'On'){
                                        var xmin = d3.min(yearSlice, d => d.value) > 0 ? 0 : d3.min(yearSlice, d => d.value);
                                        x.domain([xmin, d3.max(yearSlice, d => d.value)]);
                                    }

                                    let bars = svg.selectAll('.bar').data(yearSlice, d => d.name);

                                    bars.enter().append('rect')
                                        //.attr('class', 'bar')
                                        .attr('x', d => x(Math.min(0, d.value)))
                                        .attr('width', d => Math.abs(x(d.value)-x(0)))
                                        .attr('y', d => y(top_n+1)+5)
                                        .attr('height', y(1)-y(0)-barPadding)
                                        .style('fill', d => d.colour)
                                        .style("opacity", opacityPoint)
                                        .transition()
                                        .duration(tickDuration)
                                        .ease('linear')
                                        .attr('y', d => y(d.rank)+5)
                                        .attr("data-row", d => d.row)
                                        .attr("class", function (d) {
                                            if (obj.getSelectedItems().has(d.row)){
                                                return "bar mark";
                                            } else {
                                                return "bar";
                                            }
                                        });


                                    bars.transition().duration(tickDuration)
                                        .ease('linear')
                                        .attr('x', d => x(Math.min(0, d.value)))
                                        .attr('width', d => Math.abs(x(d.value)-x(0)))
                                        .attr('height', y(1)-y(0)-barPadding)
                                        .attr('y', d => y(d.rank)+5)
                                        .attr("data-row", d => d.row)
                                        .attr("class", function (d) {
                                            if (obj.getSelectedItems().has(d.row)){
                                                //$("rect[data-row='"+row+"']").addClass("mark");
                                                return "bar mark";
                                            } else {
                                                return "bar";
                                            }
                                        });

                                    bars.exit()
                                        .transition()
                                        .duration(tickDuration)
                                        .ease('linear')
                                        .attr('x', d => x(Math.min(0, d.value)))
                                        .attr('width', d => Math.abs(x(d.value)-x(0)))
                                        .attr('height', y(1)-y(0)-barPadding)
                                        .attr('y', d => y(top_n+1)+5)
                                        .attr("data-row", d => d.row)
                                        .attr("class", function (d) {
                                            if (obj.getSelectedItems().has(d.row)){
                                                //$("rect[data-row='"+row+"']").addClass("mark");
                                                return "bar mark";
                                            } else {
                                                return "bar";
                                            }
                                        })
                                        .remove();

                                    if(obj.getDisplayLabel() === 'On'){
                                        let labels = svg.selectAll('.label').data(yearSlice, d => d.name);

                                        labels.enter()
                                            .append('text')
                                            .attr('class', 'label')
                                            .attr('x', d => x(d.value)-6)
                                            .attr('y', d => y(top_n+1)+5+((y(1)-y(0))/2))
                                            .style('text-anchor', 'end')
                                            .html(d => d.category.trunc(13))
                                            .transition()
                                            .duration(tickDuration)
                                            .ease('linear')
                                            .attr('y', d => y(d.rank)+5+((y(1)-y(0))/2)+1);

                                        labels
                                            .transition()
                                            .ease('linear')
                                            .attr('x', d => x(d.value)-8)
                                            .attr('y', d => y(d.rank)+5+((y(1)-y(0))/2)+1)
                                            .duration(tickDuration);

                                        labels
                                            .exit()
                                            .transition()
                                            .duration(tickDuration)
                                            .ease('linear')
                                            .attr('x', d => x(d.value)-8)
                                            .attr('y', d => y(top_n+1)+5)
                                            .remove();

                                        let valueLabels = svg.selectAll('.valueLabel').data(yearSlice, d => d.name);

                                        valueLabels
                                            .enter()
                                            .append('text')
                                            .attr('class', 'valueLabel')
                                            .attr('x', d => x(d.value)+5)
                                            .attr('y', d => y(top_n+1)+5)
                                            .text(d => d3.format(',.2f')(d.lastValue))
                                            .transition()
                                            .duration(tickDuration)
                                            .ease('linear')
                                            .attr('y', d => y(d.rank)+5+((y(1)-y(0))/2)+1);

                                        valueLabels
                                            .transition()
                                            .duration(tickDuration)
                                            .ease('linear')
                                            .attr('x', d => x(d.value)+5)
                                            .attr('y', d => y(d.rank)+5+((y(1)-y(0))/2)+1)
                                            .tween("text", function(d) {
                                                return function(t) {
                                                    this.textContent = d3.format(',.2f')(d.value);
                                                };
                                            });

                                        valueLabels
                                            .exit()
                                            .transition()
                                            .duration(tickDuration)
                                            .ease('linear')
                                            .attr('x', d => x(d.value)+5)
                                            .attr('y', d => y(top_n+1)+5)
                                            .remove();
                                    }

                                    yearText.html(uniqueYears[yearIndex].trunc(15));

                                    svg.select('.xAxis')
                                        .transition()
                                        .duration(tickDuration)
                                        .ease('linear')
                                        .call(xAxis);

                                    if(yearIndex >= uniqueYears.length -1) {
                                        year = uniqueYears[uniqueYears.length -1];
                                        setTimeout(function () {
                                            //obj._buildSelectedItems(oTransientRenderingContext);
                                            clearInterval(ticker);
                                            //console.log("clearing timer..");
                                        }, tickDuration);

                                    } else {
                                        yearIndex++;
                                        year = uniqueYears[yearIndex];
                                    }
                                } /*else {
                                    console.log("Loop ends");
                                }*/
                            } , durationCycle);
                        } catch (e){
                            console.log("Exception in ticker..")
                        }
                    }
                };
            }
            finally {
                this._setIsRendered(true);
            }
        }

        /**
         * Called whenever new data is ready and this visualization needs to update.
         * @param {module:obitech-renderingcontext/renderingcontext.RenderingContext} oTransientRenderingContext
         */
        RacingBarsViz.prototype.render = function(oTransientRenderingContext) {
            // Note: all events will be received after initialize and start complete.  We may get other events
            // such as 'resize' before the render, i.e. this might not be the first event.

            this._render(oTransientRenderingContext);
            //this.renderLegend(oTransientRenderingContext);
            //this._buildSelectedItems(oTransientRenderingContext);
        };


        /**
         * Resize the visualization
         * @param {Object} oVizDimensions - contains two properties, width and height
         * @param {module:obitech-report/vizcontext#VizContext} oTransientVizContext the viz context
         */
        RacingBarsViz.prototype.resizeVisualization = function(oVizDimensions, oTransientVizContext){
            var oTransientRenderingContext = this.createRenderingContext(oTransientVizContext);
            this._render(oTransientRenderingContext);
        };

        /**
         * Re-render the visualization when settings changes
         */
        RacingBarsViz.prototype._onDefaultSettingsChanged = function(){
            var oTransientVizContext = this.assertOrCreateVizContext();
            var oTransientRenderingContext = this.createRenderingContext(oTransientVizContext);
            this.render(oTransientRenderingContext);
            this._setIsRendered(true);
        };


        RacingBarsViz.prototype._publishMarkEvent = function (oDataLayout, eMarkContext) {

            $(function() {
                $(".oj-dvt-datatip").css("visibility", "hidden");
            });

            try {
                // Create the marking event
                var markingEvent = new interactions.MarkingEvent(this.getID(), this.getViewName(), oDataLayout, null, eMarkContext);
                var eventRouter = this.getEventRouter();
                if (eventRouter) {
                    // Publish the event to listeners
                    eventRouter.publish(markingEvent);
                }
            }
            catch (e) {
                console.log("Error during mark", e);
            }
        };


        /**
         * Override to add in options to the context menu
         *
         * @param {module:obitech-report/vizcontext#VizContext} oTransientVizContext the viz context
         * @param {string} sMenuType The menu type associated with the context menu being populated
         * @param {Array} The array of resulting menu options
         * @param {module:obitech-appservices/contextmenu} contextmenu The contextmenu namespace object (used to reduce dependencies)
         * @param {object} evtParams The entire 'params' object that is extracted from client evt
         * @param {object} oTransientRenderingContext the current transient rendering context
         */
        RacingBarsViz.prototype._addVizSpecificMenuOptions = function(oTransientVizContext, sMenuType, aResults, contextmenu, evtParams, oTransientRenderingContext){
            aResults.shift();
            RacingBarsViz.superClass._addVizSpecificMenuOptions.call(this, oTransientVizContext, sMenuType, aResults, contextmenu, evtParams, oTransientRenderingContext);
            if (sMenuType === euidef.CM_TYPE_VIZ_PROPS) {
                // Set up the column context for the last column in the ROWS bucket
                var oColumnContext = this.getDrillPathColumnContext(oTransientVizContext, datamodelshapes.Logical.ROW);

                // Set up events
                /*if(!this.isViewOnlyLimit()){
                    this._addFilterMenuOption(oTransientVizContext, aResults, null, null, oTransientRenderingContext);
                    this._addRemoveSelectedMenuOption(oTransientVizContext, aResults, null, null, oTransientRenderingContext);
                    //this._addDrillMenuOption(oTransientVizContext, aResults, null, null, oColumnContext, oTransientRenderingContext);
                    //this._addLateralDrillMenuOption(oTransientVizContext, aResults);
                }*/
            }
        };

        RacingBarsViz.prototype._addVizSpecificPropsDialog = function(oTabbedPanelsGadgetInfo){

            //var options = this.getViewConfig() || {};
            //this._fillDefaultOptions(options, null);
            //this._addLegendToVizSpecificPropsDialog(options, oTabbedPanelsGadgetInfo);

            this.doAddVizSpecificPropsDialog(this, oTabbedPanelsGadgetInfo);
            RacingBarsViz.superClass._addVizSpecificPropsDialog.call(this, oTabbedPanelsGadgetInfo);

        };

        /**
         * TODO: Legend should take care of this
         * Given an options / config object, configure it with default options for the visualization.
         *
         * @param {object} oOptions the options
         * @param {module:obitech-framework/actioncontext#ActionContext} oActionContext The ActionContext instance associated with this action
         * @protected
         */
        RacingBarsViz.prototype._fillDefaultOptions = function (oOptions/*, oActionContext*/) {
            if (!jsx.isNull(oOptions) && !jsx.isNull(oOptions.legend))
                return;

            // Legend
            oOptions.legend = jsx.defaultParam(oOptions.legend, {});
            oOptions.legend.rendered = jsx.defaultParam(oOptions.legend.rendered, "on");
            oOptions.legend.position = jsx.defaultParam(oOptions.legend.position, "auto");

            this.getSettings().setViewConfigJSON(dataviz.SettingsNS.CHART, oOptions);
        };

        RacingBarsViz.prototype.doAddVizSpecificPropsDialog = function (oTransientRenderingContext, oTabbedPanelsGadgetInfo) {
            jsx.assertObject(oTransientRenderingContext, "oTransientRenderingContext");
            jsx.assertInstanceOf(oTabbedPanelsGadgetInfo, gadgets.TabbedPanelsGadgetInfo, "oTabbedPanelsGadgetInfo", "obitech-application/gadgets.TabbedPanelsGadgetInfo");

            var oDataModel = this.getRootDataModel();

            this.setTabInfo(oTabbedPanelsGadgetInfo);
            var viewConfig = this.getViewConfig() || {};
            var options = this.getViewConfig() || {};
            this._fillDefaultOptions(options, null);
            var generalPanel = gadgetdialog.forcePanelByID(oTabbedPanelsGadgetInfo, euidef.GD_PANEL_ID_GENERAL);

            var oGadgetFactory = this.getGadgetFactory();

            var oDuration = new gadgets.GadgetValueProperties(euidef.GadgetTypeIDs.TEXT_FIELD, this.Config.duration);
            var oDurationGadgetInfo = oGadgetFactory.createGadgetInfo("durationGadget", 'Frequency(seconds)', 'Frequency', oDuration);
            generalPanel.addChild(oDurationGadgetInfo);

            var displayLabel = [];
            displayLabel.push(new gadgets.OptionInfo('On','On'));
            displayLabel.push(new gadgets.OptionInfo('Off','Off'));
            var oDisplayLabelGVP = new gadgets.GadgetValueProperties(euidef.GadgetTypeIDs.TEXT_SWITCHER, this.Config.displayLabel);
            var oDisplayLabelGadgetInfo = new gadgets.TextSwitcherGadgetInfo("displayLabelGadget", 'Description', 'Description', oDisplayLabelGVP, euidef.GD_FIELD_ORDER_GENERAL_LINE_TYPE, false, displayLabel);
            generalPanel.addChild(oDisplayLabelGadgetInfo);

            var xAxis = [];
            xAxis.push(new gadgets.OptionInfo('On','On'));
            xAxis.push(new gadgets.OptionInfo('Off','Off'));
            var oXAxisGVP = new gadgets.GadgetValueProperties(euidef.GadgetTypeIDs.TEXT_SWITCHER, this.Config.xAxis);
            var oXAxisGadgetInfo = new gadgets.TextSwitcherGadgetInfo("xAxisGadget", 'Dynamic X-Axis', 'Dynamic X-Axis', oXAxisGVP, euidef.GD_FIELD_ORDER_GENERAL_LINE_TYPE, false, xAxis);
            generalPanel.addChild(oXAxisGadgetInfo);

            var zAxis = [];
            zAxis.push(new gadgets.OptionInfo('Ascending','Ascending'));
            zAxis.push(new gadgets.OptionInfo('Descending','Descending'));
            zAxis.push(new gadgets.OptionInfo('None','None'));
            var oZAxisGVP = new gadgets.GadgetValueProperties(euidef.GadgetTypeIDs.TEXT_SWITCHER, this.Config.zAxis);
            var oZAxisGadgetInfo = new gadgets.TextSwitcherGadgetInfo("zAxisGadget", 'Sort Z-Axis', 'Sort Z-Axis', oZAxisGVP, euidef.GD_FIELD_ORDER_GENERAL_LINE_TYPE, false, zAxis);
            generalPanel.addChild(oZAxisGadgetInfo);

            /*var aggregate = [];
            aggregate.push(new gadgets.OptionInfo('None','None'));
            aggregate.push(new gadgets.OptionInfo('RSUM','RSUM'));
            var oAggregateGVP = new gadgets.GadgetValueProperties(euidef.GadgetTypeIDs.TEXT_SWITCHER, this.Config.aggregate);
            var oAggregateGadgetInfo = new gadgets.TextSwitcherGadgetInfo("aggregateGadget", 'Viz Aggregation', 'Viz Aggregation', oAggregateGVP, euidef.GD_FIELD_ORDER_GENERAL_LINE_TYPE, false, aggregate);
            generalPanel.addChild(oAggregateGadgetInfo);*/

            var oTopN = new gadgets.GadgetValueProperties(euidef.GadgetTypeIDs.TEXT_FIELD, this.Config.topN);
            var oTopNGadgetInfo = oGadgetFactory.createGadgetInfo("topNGadget", 'Top N', 'Top N', oTopN);
            generalPanel.addChild(oTopNGadgetInfo);


            if (RacingBarsViz.superClass.doAddVizSpecificPropsDialog)
                RacingBarsViz.superClass.doAddVizSpecificPropsDialog.apply(this, arguments);
        };

        RacingBarsViz.prototype._handlePropChange = function (sGadgetID, oPropChange, oViewSettings, oActionContext){
            var updateSettings = RacingBarsViz.superClass._handlePropChange.call(this, sGadgetID, oPropChange, oViewSettings, oActionContext);
            if (updateSettings) {
                return updateSettings; // super handled it
            }

            // Allow the super class an attempt to handle the changes
            var conf = oViewSettings.getViewConfigJSON(dataviz.SettingsNS.CHART) || {};

            if (sGadgetID === "durationGadget") {
                if (jsx.isNull(conf.styleDefaults))
                {
                    conf.styleDefaults = {};
                }
                this.setDuration(oPropChange.value);
                updateSettings = true;
            }

            if (sGadgetID === "topNGadget") {
                if (jsx.isNull(conf.styleDefaults))
                {
                    conf.styleDefaults = {};
                }
                this.setTopN(oPropChange.value);
                updateSettings = true;
            }

            if (sGadgetID === "displayLabelGadget") {
                if (jsx.isNull(conf.styleDefaults))
                {
                    conf.styleDefaults = {};
                }
                this.setDisplayLabel(oPropChange.value);
                updateSettings = true;
            }

            if (sGadgetID === "xAxisGadget") {
                if (jsx.isNull(conf.styleDefaults))
                {
                    conf.styleDefaults = {};
                }
                this.setXAxis(oPropChange.value);
                updateSettings = true;
            }

            if (sGadgetID === "zAxisGadget") {
                if (jsx.isNull(conf.styleDefaults))
                {
                    conf.styleDefaults = {};
                }
                this.setZAxis(oPropChange.value);
                updateSettings = true;
            }

            if (sGadgetID === "aggregateGadget") {
                if (jsx.isNull(conf.styleDefaults))
                {
                    conf.styleDefaults = {};
                }
                this.setAggregate(oPropChange.value);
                updateSettings = true;
            }

            return updateSettings;
        };

        /**
         * Builds the list of selected items
         * @param {module:obitech-renderingcontext/renderingcontext.RenderingContext} oTransientRenderingContext - The rendering context
         */
        RacingBarsViz.prototype._buildSelectedItems = function(oTransientRenderingContext){
            var oViz = this;
            var oDataLayout = oTransientRenderingContext.get(dataviz.DataContextProperty.DATA_LAYOUT);
            var oMarkingService = this.getMarkingService();

            function fMarksReadyCallback() {
                oViz.clearSelectedItems();
                var aSelectedItems = oViz.getSelectedItems();
                //var selectedMap = new Map();

                if(!oViz.isStarted()) {
                    return;
                }
                oMarkingService.traverseDataEdgeMarks(oDataLayout, function (nRow, nCol) {
                    //aSelectedItems.push(nRow + ':' + nCol);
                    aSelectedItems.set(nRow, nCol);
                });
                //console.log("selected items mocha: ");
                //for(let row of aSelectedItems.keys())
                    //console.log(row);
                $("rect").parent().children().removeClass("mark");
                for(let row of aSelectedItems.keys()){
                    $("rect[data-row='"+row+"']").addClass("mark");
                }
                //oViz._render(oTransientRenderingContext);
            }
            oMarkingService.getUpdatedMarkingSet(oDataLayout, marking.EMarkOperation.MARK_RELATED, fMarksReadyCallback);
        };


        /**
         * React to marking service highlight events
         */
        RacingBarsViz.prototype.onHighlight = function(){
            var oTransientVizContext = this.assertOrCreateVizContext();
            var oTransientRenderingContext = this.createRenderingContext(oTransientVizContext);
            this._buildSelectedItems(oTransientRenderingContext);
        };

        /**
         * Override _doInitializeComponent in order to subscribe to events
         */
        RacingBarsViz.prototype._doInitializeComponent = function() {
            RacingBarsViz.superClass._doInitializeComponent.call(this);

            //this.subscribeToEvent(events.types.DEFAULT_SETTINGS_CHANGED, this._onDefaultSettingsChanged, "**");
            this.subscribeToEvent(events.types.INTERACTION_HIGHLIGHT, this.onHighlight, this.getViewName() + "." + events.types.INTERACTION_HIGHLIGHT);

            //this.initializeLegendAndVizContainer();
        };


        /**
         * Factory method declared in the plugin configuration
         * @param {string} sID Component ID for the visualization
         * @param {string=} sDisplayName Component display name
         * @param {string=} sOrigin Component host identifier
         * @param {string=} sVersion
         * @returns {module:com-company-racingbarsViz/racingbarsViz.RacingBarsViz}
         * @memberof module:com-company-racingbarsViz/racingbarsViz
         */
        racingBars.createClientComponent = function (sID, sDisplayName, sOrigin) {
            // Argument validation done by base class
            return new RacingBarsViz(sID, sDisplayName, sOrigin, RacingBarsViz.VERSION);
        };

        return racingBars;
    });