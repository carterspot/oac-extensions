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
    'ojL10n!com-company-orgChartViz/nls/messages',
    'obitech-application/extendable-ui-definitions',
    'obitech-reportservices/data',
    'd3js',
    'knockout',
    'obitech-framework/messageformat',
    'skin!css!com-company-orgChartViz/orgChartVizstyles'],
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
         ko) {
    "use strict";

    var MODULE_NAME = 'com-company-orgChartViz/orgChartViz';

    //Param validation to detect cyclical dependencies (ignore modules not used in resource arguments)
    jsx.assertAllNotNullExceptLastN(arguments, "orgChartViz.js arguments", 2);

    var orgChart = {};

    var _logger = new logger.Logger(MODULE_NAME);

    // The version of our Plugin
    OrgChartViz.VERSION = "1.0.0";

    /**
     * The implementation of the orgchartViz visualization.
     *
     * @constructor
     * @param {string} sID
     * @param {string} sDisplayName
     * @param {string} sOrigin
     * @param {string} sVersion
     * @extends {module:obitech-report/visualization.Visualization}
     * @memberof module:com-company-orgchartViz/orgchartViz#
     */

    function OrgChartViz(sID, sDisplayName, sOrigin, sVersion) {
        // Argument validation done by base class
        OrgChartViz.baseConstructor.call(this, sID, sDisplayName, sOrigin, sVersion);

        var tabInfo = '';
        var zoomVal = '50';
        var managersList=[];
        var rowDisplayNames=[];
        var legendItems = new Map();
        var cID = '';
        var color = false;

        this.Config = {
            managersList: [],
            zoomVal: '50',
            rowDisplayNames: [],
            legendItems: new Map(),
            cID: '',
            color: false
        }

        this._saveSettings = function() {
            this.getSettings().setViewConfigJSON(dataviz.SettingsNS.CHART, this.Config);
        };

        this.loadConfig = function (){
            var conf = this.getSettings().getViewConfigJSON(dataviz.SettingsNS.CHART) || {};
            if (conf.rowDisplayNames) this.Config.rowDisplayNames = conf.rowDisplayNames;
            if (conf.legendItems) this.Config.legendItems = conf.legendItems;
            if (conf.zoomVal) this.Config.zoomVal = conf.zoomVal;
            if (conf.cID) this.Config.cID = conf.cID;
            if (conf.color) this.Config.color = conf.color;

        }

        this.getManagersList = function(){
            return(this.Config.managersList);
        };

        this.setManagersList = function (o){
            this.Config.managersList = o;
        };

        this.getRowDisplayNames = function(){
            return(this.Config.rowDisplayNames);
        };

        this.setRowDisplayNames = function (o){
            this.Config.rowDisplayNames = o;
        };

        this.getLegendItems = function(){
            return(this.Config.legendItems);
        };

        this.setLegendItems = function (o){
            this.Config.legendItems = o;
        };

        this.getZoomVal = function(){
            return(this.Config.zoomVal);
        };

        this.setZoomVal = function (o){
            zoomVal = o;
            this.Config.zoomVal = o;
            this._saveSettings();
        };

        this.getCID = function(){
            return(this.Config.cID);
        };

        this.setCID = function (o){
            this.Config.cID = o;
        };

        this.isColor = function(){
            return(this.Config.color);
        };

        this.setColor = function (o){
            this.Config.color = o;
        };

        this.getTabInfo = function(){
            return(tabInfo);
        };

        this.setTabInfo = function (o){
            tabInfo = o;
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


    jsx.extend(OrgChartViz, dataviz.DataVisualization);
    var row_limit;

    OrgChartViz.prototype._generateData = function(oDataLayout, oTransientRenderingContext){

        var oDataModel = this.getRootDataModel();
        if(!oDataModel || !oDataLayout){
            return;
        }
        this.setRowDisplayNames([]);
        var aAllMeasures = oDataModel.getColumnIDsIn(datamodelshapes.Physical.DATA);
        var nMeasures = aAllMeasures.length;
        var nRows = oDataLayout.getEdgeExtent(datamodelshapes.Physical.ROW);
        var nRowLayerCount = oDataLayout.getLayerCount(datamodelshapes.Physical.ROW);
        var nCols = oDataLayout.getEdgeExtent(datamodelshapes.Physical.COLUMN);
        var nColLayerCount = oDataLayout.getLayerCount(datamodelshapes.Physical.COLUMN);
        var oDataLayoutHelper = oTransientRenderingContext.get(dataviz.DataContextProperty.DATA_LAYOUT_HELPER);

        var oColorContext = this.getColorContext(oTransientRenderingContext);
        var oColorInterpolator = this.getCachedColorInterpolator(oTransientRenderingContext, datamodelshapes.Logical.COLOR);

        this.setRowDisplayNames([]);
        row_limit = nRows;

        //Get the display names of the rows
        for(var nRow = 2; nRow < nRowLayerCount; nRow++){
            //var rowKey = oDataLayoutHelper.getLogicalEdgeName(datamodelshapes.Physical.ROW, nRow);
            var displayName = oDataLayout.getLayerMetadata(datamodelshapes.Physical.ROW, nRow, data.LayerMetadata.LAYER_DISPLAY_NAME);
            this.getRowDisplayNames().push(displayName);
        }

        //--------------------------------------------------------
        var outputMap = [];
        var legendItems = new Map();
        this.setColor(false);

        for(var nRow = 0; nRow < Math.max(nRows, 1); nRow++) {
            var name = oDataLayout.getValue(datamodelshapes.Physical.ROW, 0, nRow, false);
            var manager = oDataLayout.getValue(datamodelshapes.Physical.ROW, 1, nRow, false);
            var empObj = {Id: name, Parent: manager, details: [], color: ''};
            var colorObj, color;
                if(nRowLayerCount > 2){
                //var detail = new Map();
                for (var nRowLayer = 2; nRowLayer < Math.max(nRowLayerCount, 1); nRowLayer++) {
                    var row = oDataLayout.getValue(datamodelshapes.Physical.ROW, nRowLayer, nRow, false);
                    var rowType = oDataLayoutHelper.getLogicalEdgeName(datamodelshapes.Physical.ROW, nRowLayer);
                    if(rowType === "color"){
                        this.setColor(true);
                        colorObj = this.getDataItemColorInfo(oDataLayoutHelper, oColorContext, oColorInterpolator, nRow, 0);
                        color = colorObj.sSeriesColorLabel ? colorObj.sSeriesColorLabel : row;
                        legendItems.set(color, '');
                        empObj.color = color;
                        empObj.details.push(color);
                    } else {
                        empObj.details.push(row);
                    }
                }
                this.setLegendItems(legendItems);
            }
            outputMap.push(empObj);
        }
        var processedOuput = convert(outputMap);
        var outputData = null;
        if(processedOuput){
            outputData = convert(outputMap).children[0];
        }
        if (outputData)
            return outputData;
        else
            return null;
    }

    function convert(array){
        var map = {}
        for(var i = 0; i < array.length; i++){
            var obj = array[i]
            if(!(obj.Id in map)){
                map[obj.Id] = obj
                map[obj.Id].children = []
            }

            if(typeof map[obj.Id].Name == 'undefined'){
                map[obj.Id].Id = obj.Id
                map[obj.Id].Parent= obj.Parent
                map[obj.Id].details = obj.details
                map[obj.Id].color = obj.color
            }

            var parent = obj.Parent || '-';
            if(!(parent in map)){
                map[parent] = {}
                map[parent].children = []
            }

            map[parent].children.push(map[obj.Id])
        }
        return map['-']
    }

    function getChildrenCount(d){
        var count = 0;
        if (d.children && d.children.length > 0 ){
            count += d.children.length;
            d.children.forEach(function(child){
                count += getChildrenCount(child);
            });
        } else if (d._children && d._children.length > 0 ){
            count += d._children.length;
            d._children.forEach(function(child){
                count += getChildrenCount(child);
            });
        }
        return count;
    }

    var getSplChar = function(num){
        var result = '';
        //for(var i = 0; i < num.length; i++){
            switch (num) {
                case '0': result = 'ZER0'; break;
                case '1': result = 'ON1E'; break;
                case '2': result = 'T2WO'; break;
                case '3': result = 'THR3EE'; break;
                case '4': result = 'FOU4R'; break;
                case '5': result = 'FI5VE'; break;
                case '6': result = 'SI6X'; break;
                case '7': result = 'SEV7EN'; break;
                case '8': result = 'EIGH8T'; break;
                case '9': result = 'NIN9E'; break;
            }
        //}
        return result;
    }

    var colorScale = function(str) {
        var num = (str.charAt(0));
        str = str.concat(str);
        str = str.concat(getSplChar(num));
        //str = getSplChar(num.toString());
        var hash = 0;
        for (var i = 0; i < str.length; i++) {
            hash = str.charCodeAt(i) + ((hash << 5) - hash);
        }
        var hex = ((hash>>24)&0xFF).toString(16) +
            ((hash>>16)&0xFF).toString(16) +
            ((hash>>8)&0xFF).toString(16) +
            (hash&0xFF).toString(16);
        // Sometimes the string returned will be too short so we
        // add zeros to pad it out, which later get removed if
        // the length is greater than six.
        hex += '000000';
        return "#"+hex.substring(0, 6);
    }

    OrgChartViz.prototype._render = function(oTransientRenderingContext) {
        // Note: all events will be received after initialize and start complete.  We may get other events
        // such as 'resize' before the render, i.e. this might not be the first event.
        try{
            this.loadConfig();
            

           
            // Retrieve the data object for this visualization
            var oDataLayout = oTransientRenderingContext.get(dataviz.DataContextProperty.DATA_LAYOUT);

            if (!oDataLayout)
                return;

            var grouped = this._generateData(oDataLayout, oTransientRenderingContext);

            if(row_limit == 25000){
                var oMsgComponentManager = this.getService(definitions.MessageComponentManager_SERVICE_NAME);
                oMsgComponentManager.displayMessage(this, {
                      message: "Displaying the first 25,000 rows. Results may be incomplete for datasets exceeding this limit.",
                      type: definitions.MessageTypeStyles.WARNING,
                      isInline: false,
                      closeTimeout: 100000,
                      position: {
                         my: "center top-50",
                         at: "center top",
                         of: $(this.getContainerElem()),
                         collision: "fit flip"
                      }
                });
             }

            var displayNames = this.getRowDisplayNames();
            var zoomScale = this.getZoomVal() / 100;

            // Determine the number of records available for rendering on ROW
            // Because we specified that Category should be placed on ROW in the data model handler,
            // this returns the number of rows for the data in Category.
            var nRows = oDataLayout.getEdgeExtent(datamodelshapes.Physical.ROW);

            // Retrieve the root container for our visualization.  This is provided by the framework.  It may not be deleted
            // but may be used to render.
            var elContainer = this.getContainerElem();
            var sVizContainerId = this.getSubElementIdFromParent(this.getContainerElem(), "hvc");
            var pane = sVizContainerId.substring(sVizContainerId.indexOf("view")+5,sVizContainerId.indexOf("pane"));
            var conetentPane = sVizContainerId.substring(sVizContainerId.indexOf("contentpane_")+12,sVizContainerId.indexOf("vizCont")-1);

            var width = $(elContainer).width();
            var height = $(elContainer).height();


            var cId = pane+"_"+conetentPane;
            this.setCID(cId);

            //Adding Legend Data
            var uniqueLegends = [];

            if(this.isColor()){
                for(let color of this.getLegendItems().keys()){
                    uniqueLegends.push(color);
                }
            }

            var legendTitle;
            var dispSize = this.getRowDisplayNames().length;
            var isColor = false;
            if (uniqueLegends && uniqueLegends.length > 0){
                isColor = true;
            }
            legendTitle = isColor ? this.getRowDisplayNames()[dispSize-1] : "";
            var legendTitleWidth = width * .49;
            var svgWidth = isColor ? "85% !important" : "100% !important";
            var legendWidth = isColor ? "120px !important" : "0% !important";
            //var legendTitleWidth = isColor ? "100px !important" : "0% !important";

            var hParam = 0, wParam = [], j = 0;
            wParam[j] = 0;
            for(var i = 0; i < uniqueLegends.length; i++){
                hParam += uniqueLegends[i].length;
                wParam[j] += uniqueLegends[i].length;
                if(wParam[j] < width*.75){
                    hParam += 110;
                } else {
                    j++;
                    wParam[j] = 0;
                }
            }
            hParam -= 110;
            var lines = hParam/(width*.75);
            lines = lines % 1 > 0 ? lines + 1 : lines;
            lines = Math.floor(lines);
            var lHeight = height - (lines * 30);
            //var tHeight = (lines * 30) + 30;
            var tHeight = height - ((lines+1) * 30);

            //removed
            //style='max-width: "+svgWidth+"'
            var htmlContent = "<div id=canvas_"+cId+">" +
                "<div id=main_"+cId+" class='main' >" +
                "<div id=full-container_"+cId+" class='full-container'><div id=svgChart_"+cId+" class=\"svgChart\"></div></div>";

            htmlContent += "<div id=legendPane_"+cId+" class='legend-pane'>"+
                "<div id=legendTitle_"+cId+" class='title' style='width: 90%; float=center;'>" +
                /*"<div id=legendTitle_"+cId+" class='title' style='left: "+legendTitleWidth+"px; bottom:"+tHeight+"px;'>" +*/
                /*"<span id=legendName_"+cId+" class='title'>"+legendTitle+"</span>" +*/
                "</div>"+
                "<div id=legend4_"+cId+" class='legend4' style='width: 90%; float=center;'>" +
                "</div></div>";
            htmlContent += "</div>" +
                "</div>";
            $(elContainer).html(htmlContent);
            var wParam = 1;

            var params = {
                selector: "#svgChart_"+cId,
                chartWidth: width * wParam,
                chartHeight: height - ((lines+1) * 30),
                funcs: {
                    showMySelf: null,
                    search: null,
                    closeSearchBox: null,
                    clearResult: null,
                    findInTree: null,
                    reflectResults: null,
                    departmentClick: null,
                    back: null,
                    toggleFullScreen: null,
                    locate:null
                },
                data: this._generateData(oDataLayout, oTransientRenderingContext)
            }

            d3.json(params.dataLoadUrl, function(data) {
                //params.data = data;
                params.pristinaData = JSON.parse(JSON.stringify(params.data));
                //console.log(JSON.stringify(params.data));
                drawOrganizationChart(params);
            })

            function drawOrganizationChart(params) {
                //listen();

                params.funcs.showMySelf = showMySelf;
                params.funcs.expandAll = expandAll;
                params.funcs.search = searchUsers;
                params.funcs.closeSearchBox = closeSearchBox;
                params.funcs.findInTree = findInTree;
                params.funcs.clearResult = clearResult;
                params.funcs.reflectResults = reflectResults;
                params.funcs.departmentClick = departmentClick;
                params.funcs.back = back;
                params.funcs.toggleFullScreen = toggleFullScreen;
                params.funcs.locate=locate;

                var attrs = {
                    EXPAND_SYMBOL: '+',
                    COLLAPSE_SYMBOL: '-',
                    NO_COLLAPSE: '',
                    selector: params.selector,
                    root: params.data,
                    width: params.chartWidth,
                    height: params.chartHeight,
                    index: 0,
                    nodePadding: 9,
                    collapseCircleRadius: 7,
                    nodeHeight: 55,
                    nodeWidth: 130,
                    duration: 750,
                    rootNodeTopMargin: 20,
                    minMaxZoomProportions: [0.05, 3],
                    linkLineSize: 180,
                    collapsibleFontSize: '14px',
                    userIcon: 'Children:',
                    nodeStroke: "#ccc",
                    nodeStrokeWidth: '4px'
                }

                var dynamic = {}
                dynamic.nodeImageWidth = attrs.nodeHeight * 100 / 140;
                dynamic.nodeImageHeight = attrs.nodeHeight - 2 * attrs.nodePadding;
                dynamic.nodeTextLeftMargin = attrs.nodePadding * 2; /*+ dynamic.nodeImageWidth*/
                dynamic.rootNodeLeftMargin = attrs.width / 2;
                dynamic.nodePositionNameTopMargin = attrs.nodePadding + 8 + dynamic.nodeImageHeight / 4 * 1
                dynamic.nodeChildCountTopMargin = attrs.nodePadding + 14 + dynamic.nodeImageHeight / 4 * 3

                var tree = d3.layout.tree().nodeSize([attrs.nodeWidth + 40, attrs.nodeHeight]);
                var diagonal = d3.svg.diagonal()
                    .projection(function(d) {
                        return [d.x + attrs.nodeWidth / 2, d.y + attrs.nodeHeight / 2];
                    });


                var zoomBehaviours = d3.behavior
                    .zoom()
                    .scaleExtent(attrs.minMaxZoomProportions)
                    .on("zoom", redraw);

                var zoom = d3.behavior.zoom().scaleExtent(attrs.minMaxZoomProportions).translate([attrs.width/2,50]).scale(1);

                var svgLength = $("#svgChart_"+cId).get(0).children.length;
                if(svgLength > 0){
                    return;
                }

                var zX = attrs.width/2.3;
                var svg = d3.select(attrs.selector)
                    .append("svg:svg")
                    //.attr("id", "svgPane_"+cId)
                    .attr("width", attrs.width)
                    .attr("height", attrs.height)
                    .attr("class", "svg-class")
                    //.call(zoomBehaviours)mo
                    .call(zoom.on("zoom",redraw))
                    .append("svg:g")
                    .attr("transform","translate("+zX+",20)scale("+zoomScale+","+zoomScale+")");

                //necessary so that zoom knows where to zoom and unzoom from
                //zoomBehaviours.translate([dynamic.rootNodeLeftMargin, attrs.rootNodeTopMargin]);

                attrs.root.x0 = 0;
                attrs.root.y0 = dynamic.rootNodeLeftMargin;

                if (params.mode != 'department') {
                    // adding unique values to each node recursively
                    var uniq = 1;
                    addPropertyRecursive('uniqueIdentifier', function(v) {

                        return uniq++;
                    }, attrs.root);

                }

                expand(attrs.root);
                if (attrs.root.children) {
                    attrs.root.children.forEach(collapse);
                }

                update(attrs.root);

                d3.select(attrs.selector).style("height", attrs.height);

                /////Legend Title///

                var xpos = width * .1, ypos = 35;
                var pMark = uniqueLegends.length * 20;
                xpos = lines === 1 ? (width-hParam+pMark)/2 : xpos;
                var titleY = lines === 1 ? 0 : 10;

                var svgTitle = d3.select("#legendTitle_"+cId).append("svg")
                    .attr("text-anchor", "center")
                    .attr("width", width)
                    .attr("height", 30)

                svgTitle.append("text")
                    .attr("class", "title")
                    .attr("text-anchor", "center")
                    .attr("x", "48%")
                    .attr("y", 10)
                    .text(legendTitle);

                /////////////////// Title Ends here


                /////////D3 Horizonal Lengend 1///////////////////////////

                if($("#legend4_"+cId).find('svg').length > 0)
                    d3.select("svg").empty();

                var svgLegend4 = d3.select("#legend4_"+cId).append("svg")
                    .attr("text-anchor", "center")
                    .attr("width", width)
                    .attr("height", lHeight)

                var dataL = 0;
                var offset = 80;


                var legendH = svgLegend4.selectAll("#legend4_"+cId)
                    .data(uniqueLegends.sort())
                    .enter().append('g')
                    .attr("class", "legend4")
                    .attr("transform", function (d, i) {
                        if (i === 0) {
                            dataL = xpos + d.length + offset
                            return "translate("+(xpos)+","+ypos+")"
                        } else {
                            var newdataL = dataL
                            if (dataL < width*.85){
                                dataL +=  d.length + offset
                                return "translate(" + (newdataL) + ","+ypos+")"
                            } else {
                                ypos += 30;
                                dataL = xpos + d.length + offset;
                                return "translate(" + (xpos) + ","+ypos+")"
                            }
                        }
                    })

                legendH.append('rect')
                    .attr("x", 0)
                    .attr("y", 0)
                    .attr("width", 10)
                    .attr("height", 10)
                    .style("text-anchor", "center")
                    .style("fill", function (d, i) {
                        return colorScale(d);
                    })

                legendH.append('text')
                    .attr("x", 15)
                    .attr("y", 10)
                    //.attr("dy", ".35em")
                    .text(function (d, i) {
                        var textlength = d.length;
                        if(textlength > 13){
                            return (d.substring(0,13) + "..")
                        } else
                        return d
                    })
                    .attr("class", "textselected")
                    .style("text-anchor", "center")
                    .style("text-overflow", "ellipsis")
                    .style("font-size", 10);


                var tooltip = d3.select('body')
                    .append('div')
                    .attr('class', 'customTooltip-wrapper');

                function update(source, param) {

                    // Compute the new tree layout.
                    var nodes = tree.nodes(attrs.root)
                            .reverse(),
                        links = tree.links(nodes);

                    // Normalize for fixed-depth.
                    nodes.forEach(function(d) {
                        d.y = d.depth * attrs.linkLineSize;
                    });

                    // Update the nodes…
                    var node = svg.selectAll("g.node")
                        .data(nodes, function(d) {
                            return d.id || (d.id = ++attrs.index);
                        });

                    // Enter any new nodes at the parent's previous position.
                    var nodeEnter = node.enter()
                        .append("g")
                        .attr("class", "node")
                        .attr("transform", function(d) {
                            return "translate(" + source.x0 + "," + source.y0 + ")";
                        })

                    var nodeGroup = nodeEnter.append("g")
                        .attr("class", "node-group")


                    nodeGroup.append("rect")
                        .attr("width", attrs.nodeWidth)
                        .attr("height", attrs.nodeHeight)
                        .attr("data-node-group-id",function(d){
                            return d.uniqueIdentifier;
                        })
                        .attr("class", function(d) {
                            var res = "";
                            if (d.isLoggedUser) res += 'nodeRepresentsCurrentUser ';
                            res += d._children || d.children ? "nodeHasChildren" : "nodeDoesNotHaveChildren";
                            return res;
                        });

                    var collapsiblesWrapper =
                        nodeEnter.append('g')
                            .attr('data-id', function(v) {
                                return v.uniqueIdentifier;
                            });

                    var collapsibleRects = collapsiblesWrapper.append("rect")
                        .attr('class', 'node-collapse-right-rect')
                        .attr('height', attrs.collapseCircleRadius)
                        .attr('fill', 'black')
                        .attr('x', attrs.nodeWidth - attrs.collapseCircleRadius)
                        .attr('y', attrs.nodeHeight - 7)
                        .attr("width", function(d) {
                            if (d.children || d._children) return attrs.collapseCircleRadius;
                            return 0;
                        })

                    var collapsibles =
                        collapsiblesWrapper.append("circle")
                            .attr('class', 'node-collapse')
                            .attr('cx', attrs.nodeWidth - attrs.collapseCircleRadius)
                            .attr('cy', attrs.nodeHeight - 7)
                            .attr("", setCollapsibleSymbolProperty);

                    //hide collapse rect when node does not have children
                    collapsibles.attr("r", function(d) {
                        if (d.children || d._children) return attrs.collapseCircleRadius;
                        return 0;
                    })
                        .attr("height", attrs.collapseCircleRadius)

                    collapsiblesWrapper.append("text")
                        .attr('class', 'text-collapse')
                        .attr("x", attrs.nodeWidth - attrs.collapseCircleRadius)
                        .attr('y', attrs.nodeHeight - 3)
                        .attr('width', attrs.collapseCircleRadius)
                        .attr('height', attrs.collapseCircleRadius)
                        .style('font-size', attrs.collapsibleFontSize)
                        .attr("text-anchor", "middle")
                        .style('font-family', 'FontAwesome')
                        .text(function(d) {
                            if (d.children || d._children) return d.collapseText;
                        })

                    collapsiblesWrapper.on("click", click);

                    nodeGroup.append("text")
                        .attr("x", dynamic.nodeTextLeftMargin + 50)
                        .attr("y", attrs.nodePadding + 10)
                        .attr('class', 'emp-name')
                        //.attr("text-anchor", "center")
                        .attr("text-anchor", "middle")
                        .text(function(d) {
                            if(d.details[0]) return d.details[0].trim();
                            else return d.Id;
                        })
                        .call(wrap, attrs.nodeWidth);

                    nodeGroup.append("text")
                        .attr("x", dynamic.nodeTextLeftMargin + 15)
                        .attr("y", dynamic.nodeChildCountTopMargin - 18)
                        //.attr('class', 'emp-count-icon')
                        .attr('class', 'emp-area')
                        .attr("text-anchor", "center")
                        //.style('font-family', 'FontAwesome')
                        .text(function(d) {
                            if (d.children || d._children) return 'All:';
                        });

                    nodeGroup.append("text")
                        .attr("x", dynamic.nodeTextLeftMargin + 70)
                        .attr("y", dynamic.nodeChildCountTopMargin - 18)
                        .attr('class', 'emp-area')
                        .attr("text-anchor", "center")

                        .text(function(d) {
                            if (d) return getChildrenCount(d);
                            //else if (d && d._children) return getChildrenCount(d);
                            else return;
                        })

                    nodeGroup.append("text")
                        .attr("x", dynamic.nodeTextLeftMargin + 15)
                        .attr("y", dynamic.nodeChildCountTopMargin - 5)
                        //.attr('class', 'emp-count-icon')
                        .attr('class', 'emp-area')
                        .attr("text-anchor", "center")
                        //.style('font-family', 'FontAwesome')
                        .text(function(d) {
                            if (d.children || d._children) return 'Direct:';
                        });

                    nodeGroup.append("text")
                        .attr("x", dynamic.nodeTextLeftMargin + 70)
                        .attr("y", dynamic.nodeChildCountTopMargin - 5)
                        .attr('class', 'emp-area')
                        .attr("text-anchor", "center")

                        .text(function(d) {
                            if (d && d.children) return d.children.length;
                            else if (d && d._children) return d._children.length;
                            else return;
                        })

                    // Transition nodes to their new position.
                    var nodeUpdate = node.transition()
                        .duration(attrs.duration)
                        .attr("transform", function(d) {
                            return "translate(" + d.x + "," + d.y + ")";
                        })

                    //todo replace with attrs object
                    nodeUpdate.select("rect")
                        .attr("width", attrs.nodeWidth)
                        .attr("height", attrs.nodeHeight)
                        .attr('rx', 6)
                        .attr("stroke", function(d){
                            if(param && d.uniqueIdentifier== param.locate){
                                return '#a1ceed'
                            }
                            //return attrs.nodeStroke;
                            return d.color ? colorScale(d.color) : attrs.nodeStroke;
                        })
                        .attr('stroke-width', function(d){
                            if(param && d.uniqueIdentifier== param.locate){
                                return 6;
                            }
                            return attrs.nodeStrokeWidth})

                    // Transition exiting nodes to the parent's new position.
                    var nodeExit = node.exit().transition()
                        .duration(attrs.duration)
                        .attr("transform", function(d) {
                            return "translate(" + source.x + "," + source.y + ")";
                        })
                        .remove();

                    nodeExit.select("rect")
                        .attr("width", attrs.nodeWidth)
                        .attr("height", attrs.nodeHeight)

                    // Update the links…
                    var link = svg.selectAll("path.link")
                        .data(links, function(d) {
                            return d.target.id;
                        });

                    // Enter any new links at the parent's previous position.
                    link.enter().insert("path", "g")
                        .attr("class", "link")
                        .attr("x", attrs.nodeWidth / 2)
                        .attr("y", attrs.nodeHeight / 2)
                        .attr("d", function(d) {
                            var o = {
                                x: source.x0,
                                y: source.y0
                            };
                            return diagonal({
                                source: o,
                                target: o
                            });
                        });

                    // Transition links to their new position.
                    link.transition()
                        .duration(attrs.duration)
                        .attr("d", diagonal)
                    ;

                    // Transition exiting nodes to the parent's new position.
                    link.exit().transition()
                        .duration(attrs.duration)
                        .attr("d", function(d) {
                            var o = {
                                x: source.x,
                                y: source.y
                            };
                            return diagonal({
                                source: o,
                                target: o
                            });
                        })
                        .remove();

                    // Stash the old positions for transition.
                    nodes.forEach(function(d) {
                        d.x0 = d.x;
                        d.y0 = d.y;
                    });

                    if(param && param.locate){
                        var x;
                        var y;

                        nodes.forEach(function(d) {
                            if (d.uniqueIdentifier == param.locate) {
                                x = d.x;
                                y = d.y;
                            }
                        });

                        // normalize for width/height
                        var new_x = (-x + (window.innerWidth / 2));
                        var new_y = (-y + (window.innerHeight / 2));

                        // move the main container g
                        svg.attr("transform", "translate(" + new_x + "," + new_y + ")")
                        zoomBehaviours.translate([new_x, new_y]);
                        zoomBehaviours.scale(1);
                    }

                    if (param && param.centerMySelf) {
                        var x;
                        var y;

                        nodes.forEach(function(d) {
                            if (d.isLoggedUser) {
                                x = d.x;
                                y = d.y;
                            }

                        });

                        // normalize for width/height
                        var new_x = (-x + (window.innerWidth / 2));
                        var new_y = (-y + (window.innerHeight / 2));

                        // move the main container g
                        svg.attr("transform", "translate(" + new_x + "," + new_y + ")")
                        zoomBehaviours.translate([new_x, new_y]);
                        zoomBehaviours.scale(1);
                    }

                    /*################  TOOLTIP  #############################*/

                    function getTagsFromCommaSeparatedStrings(tags) {
                        return tags.split(',').map(function(v) {
                            return '<li><div class="tag">' + v + '</div></li>  '
                        }).join('');
                    }

                    function getDirectChildren(d) {
                        if (d && d.children) return d.children.length;
                        else if (d && d._children) return d._children.length;
                        else return;
                    }

                    function tooltipContent(item) {

                        var strVar = "";

                        strVar += "  <div class=\"customTooltip\">";
                        strVar += "<table>";
                        strVar +=  "<tr><td class='tthead'>All Children<\/td><td class='ttval'>"+getChildrenCount(item)+"<\/td><\/tr>";
                        strVar +=  "<tr><td class='tthead'>Direct Children<\/td><td class='ttval'>"+getDirectChildren(item)+"<\/td><\/tr>";
                        for(var i=0; i<item.details.length; i++){
                            strVar +=  "<tr><td class='tthead'>"+displayNames[i]+"<\/td><td class='ttval'>"+item.details[i]+"<\/td><\/tr>";
                        }
                        strVar += "<\/table>";
                        strVar += "  <\/div>";
                        strVar += "";
                        return strVar;
                    }

                    function tooltipHoverHandler(d) {

                        var content = tooltipContent(d);
                        tooltip.html(content);

                        tooltip.transition()
                            .duration(200).style("opacity", "1").style('display', 'block');
                        d3.select(this).attr('cursor', 'pointer').attr("stroke-width", 50);

                        var y = d3.event.pageY;
                        var x = d3.event.pageX;

                        //restrict tooltip to fit in borders
                        if (y < 220) {
                            y += 220 - y;
                            x += 130;
                        }

                        /*if(y>attrs.height-300){
                            y-=300-(attrs.height-y);
                        }*/

                        tooltip.style('top', (y - 100) + 'px')
                            .style('left', (x - 270) + 'px');
                    }

                    function tooltipOutHandler() {
                        tooltip.transition()
                            .duration(200)
                            .style('opacity', '0').style('display', 'none');
                        d3.select(this).attr("stroke-width", 5);

                    }

                    nodeGroup.on('click', tooltipHoverHandler);

                    nodeGroup.on('dblclick', tooltipOutHandler);

                    function equalToEventTarget() {
                        return this == d3.event.target;
                    }

                    d3.select("#canvas_"+cId).on("click", function() {
                        var outside = tooltip.filter(equalToEventTarget).empty();
                        if (outside) {
                            tooltip.style('opacity', '0').style('display', 'none');
                        }
                    });

                    $(document).on('click', function(e) {
                        tooltip.style('opacity', '0').style('display', 'none');
                    });

                }

                // Toggle children on click.
                function click(d) {

                    d3.select(this).select("text").text(function(dv) {

                        if (dv.collapseText == attrs.EXPAND_SYMBOL) {
                            dv.collapseText = attrs.COLLAPSE_SYMBOL
                        } else {
                            dv.collapseText = attrs.EXPAND_SYMBOL
                            /*if (dv.children) {
                                dv.collapseText = attrs.EXPAND_SYMBOL
                            }*/
                        }
                        return dv.collapseText;

                    })

                    if (d.children) {
                        d._children = d.children;
                        d.children = null;
                    } else {
                        d.children = d._children;
                        d._children = null;
                    }
                    update(d);

                }

                //########################################################

                //Redraw for zoom
                function redraw() {
                    console.log("here", d3.event.translate, d3.event.scale);
                    svg.attr("transform",
                        "translate(" + d3.event.translate + ")" +
                        " scale(" + d3.event.scale + ")");
                }

                // #############################   Function Area #######################
                function wrap(text, width) {

                    text.each(function() {
                        var text = d3.select(this),
                            words = text.text().split(/\s+/).reverse(),
                            word,
                            line = [],
                            lineNumber = 0,
                            lineHeight = 1.1, // ems
                            x = text.attr("x"),
                            y = text.attr("y"),
                            dy = 0, //parseFloat(text.attr("dy")),
                            tspan = text.text(null)
                                .append("tspan")
                                .attr("x", x)
                                .attr("y", y)
                                .attr("dy", dy + "em");
                        while (word = words.pop()) {
                            line.push(word);
                            tspan.text(line.join(" "));
                            if (tspan.node().getComputedTextLength() > width) {
                                line.pop();
                                tspan.text(line.join(" "));
                                line = [word];
                                tspan = text.append("tspan")
                                    .attr("x", x)
                                    .attr("y", y)
                                    .attr("dy", ++lineNumber * lineHeight + dy + "em")
                                    .text(word);
                            }
                        }
                    });
                }

                function addPropertyRecursive(propertyName, propertyValueFunction, element) {
                    if (element[propertyName]) {
                        element[propertyName] = element[propertyName] + ' ' + propertyValueFunction(element);
                    } else {
                        element[propertyName] = propertyValueFunction(element);
                    }
                    if (element.children) {
                        element.children.forEach(function(v) {
                            addPropertyRecursive(propertyName, propertyValueFunction, v)
                        })
                    }
                    if (element._children) {
                        element._children.forEach(function(v) {
                            addPropertyRecursive(propertyName, propertyValueFunction, v)
                        })
                    }
                }

                function departmentClick(item) {
                    hide(['.customTooltip-wrapper']);

                    if (item.type == 'department' && params.mode != 'department') {
                        //find third level department head user
                        var found = false;
                        var secondLevelChildren = params.pristinaData.children;
                        parentLoop:
                            for (var i = 0; i < secondLevelChildren.length; i++) {
                                var secondLevelChild = secondLevelChildren[i];
                                var thirdLevelChildren = secondLevelChild.children ? secondLevelChild.children : secondLevelChild._children;

                                for (var j = 0; j < thirdLevelChildren.length; j++) {
                                    var thirdLevelChild = thirdLevelChildren[j];
                                    if (thirdLevelChild.unit.value.trim() == item.value.trim()) {
                                        clear(params.selector);

                                        hide(['.btn-action']);
                                        show(['.btn-action.btn-back', '.btn-action.btn-fullscreen', '.department-information']);
                                        set('.dept-name', item.value);

                                        set('.dept-emp-count', "Employees Quantity - " + getEmployeesCount(thirdLevelChild));
                                        set('.dept-description', thirdLevelChild.unit.desc);

                                        params.oldData = params.data;

                                        params.data = deepClone(thirdLevelChild);
                                        found = true;
                                        break parentLoop;
                                    }
                                }
                            }
                        if (found) {
                            params.mode = "department";
                            params.funcs.closeSearchBox();
                            drawOrganizationChart(params);

                        }

                    }
                }

                function getEmployeesCount(node) {
                    var count = 1;
                    countChilds(node);
                    return count;

                    function countChilds(node) {
                        var childs = node.children ? node.children : node._children;
                        if (childs) {
                            childs.forEach(function(v) {
                                count++;
                                countChilds(v);
                            })
                        }
                    }
                }

                function reflectResults(results) {
                    var htmlStringArray = results.map(function(result) {
                        var strVar = "";
                        strVar += "         <div class=\"list-item\">";
                        strVar += "          <a >";
                        strVar += "            <div class=\"description\">";
                        strVar += "              <p class=\"name\">" + result.details[0] + "<\/p>";
                        strVar += "               <p class=\"position-name\">" + result.details[1] + "<\/p>";
                        strVar += "            <\/div>";
                        strVar += "            <div class=\"buttons\">";
                        strVar += "              <a target='_blank' href='"+result.profileUrl+"'><button class='btn-search-box btn-action'>View Profile<\/button><\/a>";
                        strVar += "              <button class='btn-search-box btn-action btn-locate' onclick='params.funcs.locate("+result.uniqueIdentifier+")'>Locate <\/button>";
                        strVar += "            <\/div>";
                        strVar += "          <\/a>";
                        strVar += "        <\/div>";

                        return strVar;

                    })

                    var htmlString = htmlStringArray.join('');
                    params.funcs.clearResult();

                    var parentElement = get('.result-list');
                    var old = parentElement.innerHTML;
                    var newElement = htmlString + old;
                    parentElement.innerHTML = newElement;
                    set('.user-search-box .result-header', "RESULT - " + htmlStringArray.length);

                }

                function clearResult() {
                    set('.result-list', '<div class="buffer" ></div>');
                    set('.user-search-box .result-header', "RESULT");

                }

                function searchUsers() {

                    d3.selectAll('.user-search-box')
                        .transition()
                        .duration(250)
                        .style('width', '350px')
                }

                function closeSearchBox() {
                    d3.selectAll('.user-search-box')
                        .transition()
                        .duration(250)
                        .style('width', '0px')
                        .each("end", function() {
                            params.funcs.clearResult();
                            clear('.search-input');
                        });

                }

                function findInTree(rootElement, searchText) {
                    var result = [];
                    // use regex to achieve case insensitive search and avoid string creation using toLowerCase method
                    var regexSearchWord = new RegExp(searchText, "i");

                    recursivelyFindIn(rootElement, searchText);

                    return result;

                    function recursivelyFindIn(user) {
                        if (user.name.match(regexSearchWord) ||
                            user.tags.match(regexSearchWord)) {
                            result.push(user)
                        }

                        var childUsers = user.children ? user.children : user._children;
                        if (childUsers) {
                            childUsers.forEach(function(childUser) {
                                recursivelyFindIn(childUser, searchText)
                            })
                        }
                    };
                }

                function back() {

                    show(['.btn-action']);
                    hide(['.customTooltip-wrapper', '.btn-action.btn-back', '.department-information'])
                    clear(params.selector);

                    params.mode = "full";
                    params.data = deepClone(params.pristinaData)
                    drawOrganizationChart(params);

                }

                function expandAll() {
                    expand(root);
                    update(root);
                }

                function expand(d) {
                    if (d.children) {
                        d.children.forEach(expand);
                    }

                    if (d._children) {
                        d.children = d._children;
                        d.children.forEach(expand);
                        d._children = null;
                    }

                    if (d.children) {
                        // if node has children and it's expanded, then  display -
                        setToggleSymbol(d, attrs.COLLAPSE_SYMBOL);
                    }
                }

                function collapse(d) {
                    if (d._children) {
                        d._children.forEach(collapse);
                    }
                    if (d.children) {
                        d._children = d.children;
                        d._children.forEach(collapse);
                        d.children = null;
                    }

                    if (d._children) {
                        // if node has children and it's collapsed, then  display +
                        setToggleSymbol(d, attrs.EXPAND_SYMBOL);
                    }
                }

                function setCollapsibleSymbolProperty(d) {
                    if (d._children) {
                        d.collapseText = attrs.EXPAND_SYMBOL;
                    } else if (d.children) {
                        d.collapseText = attrs.COLLAPSE_SYMBOL;
                    }
                }

                function setToggleSymbol(d, symbol) {
                    d.collapseText = symbol;
                    d3.select("*[data-id='" + d.uniqueIdentifier + "']").select('text').text(symbol);
                }

                /* recursively find logged user in subtree */
                function findmySelf(d) {
                    if (d.isLoggedUser) {
                        expandParents(d);
                    } else if (d._children) {
                        d._children.forEach(function(ch) {
                            ch.parent = d;
                            findmySelf(ch);
                        })
                    } else if (d.children) {
                        d.children.forEach(function(ch) {
                            ch.parent = d;
                            findmySelf(ch);
                        });
                    };

                }

                function locateRecursive(d,id) {
                    if (d.uniqueIdentifier == id) {
                        expandParents(d);
                    } else if (d._children) {
                        d._children.forEach(function(ch) {
                            ch.parent = d;
                            locateRecursive(ch,id);
                        })
                    } else if (d.children) {
                        d.children.forEach(function(ch) {
                            ch.parent = d;
                            locateRecursive(ch,id);
                        });
                    };

                }

                /* expand current nodes collapsed parents */
                function expandParents(d) {
                    while (d.parent) {
                        d = d.parent;
                        if (!d.children) {
                            d.children = d._children;
                            d._children = null;
                            setToggleSymbol(d, attrs.COLLAPSE_SYMBOL);
                        }

                    }
                }

                function toggleFullScreen() {

                    if ((document.fullScreenElement && document.fullScreenElement !== null) ||
                        (!document.mozFullScreen && !document.webkitIsFullScreen)) {
                        if (document.documentElement.requestFullScreen) {
                            document.documentElement.requestFullScreen();
                        } else if (document.documentElement.mozRequestFullScreen) {
                            document.documentElement.mozRequestFullScreen();
                        } else if (document.documentElement.webkitRequestFullScreen) {
                            document.documentElement.webkitRequestFullScreen(Element.ALLOW_KEYBOARD_INPUT);
                        }
                        d3.select(params.selector + ' svg').attr('width', screen.width).attr('height', screen.height);
                    } else {
                        if (document.cancelFullScreen) {
                            document.cancelFullScreen();
                        } else if (document.mozCancelFullScreen) {
                            document.mozCancelFullScreen();
                        } else if (document.webkitCancelFullScreen) {
                            document.webkitCancelFullScreen();
                        }
                        d3.select(params.selector + ' svg').attr('width', params.chartWidth).attr('height', params.chartHeight);
                    }

                }



                function showMySelf() {
                    /* collapse all and expand logged user nodes */
                    if (!attrs.root.children) {
                        if (!attrs.root.isLoggedUser) {
                            attrs.root.children = attrs.root._children;
                        }
                    }
                    if (attrs.root.children) {
                        attrs.root.children.forEach(collapse);
                        attrs.root.children.forEach(findmySelf);
                    }

                    update(attrs.root, {centerMySelf:true});
                }

                //locateRecursive
                function locate(id){
                    /* collapse all and expand logged user nodes */
                    if (!attrs.root.children) {
                        if (!attrs.root.uniqueIdentifier == id) {
                            attrs.root.children = attrs.root._children;
                        }
                    }
                    if (attrs.root.children) {
                        attrs.root.children.forEach(collapse);
                        attrs.root.children.forEach(function(ch){
                            locateRecursive(ch,id)
                        });
                    }

                    update(attrs.root, {locate:id});
                }

                function deepClone(item) {
                    return JSON.parse(JSON.stringify(item));
                }

                function show(selectors) {
                    display(selectors, 'initial')
                }

                function hide(selectors) {
                    display(selectors, 'none')
                }

                function display(selectors, displayProp) {
                    selectors.forEach(function(selector) {
                        var elements = getAll(selector);
                        elements.forEach(function(element) {
                            element.style.display = displayProp;
                        })
                    });
                }

                function set(selector, value) {
                    var elements = getAll(selector);
                    elements.forEach(function(element) {
                        element.innerHTML = value;
                        element.value = value;
                    })
                }

                function clear(selector) {
                    set(selector, '');
                }

                function get(selector) {
                    return document.querySelector(selector);
                }

                function getAll(selector) {
                    return document.querySelectorAll(selector);
                }


            }

            $(".canvas").attr("width", $(elContainer).width());
            $(".canvas").attr("height", $(elContainer).height());
          }  
        finally {
            this._setIsRendered(true);
        }


    }

    /**
     * Called whenever new data is ready and this visualization needs to update.
     * @param {module:obitech-renderingcontext/renderingcontext.RenderingContext} oTransientRenderingContext
     */
    OrgChartViz.prototype.render = function(oTransientRenderingContext) {
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
    OrgChartViz.prototype.resizeVisualization = function(oVizDimensions, oTransientVizContext){
        var oTransientRenderingContext = this.createRenderingContext(oTransientVizContext);
        this._render(oTransientRenderingContext);
    };

    /**
     * Re-render the visualization when settings changes
     */
    OrgChartViz.prototype._onDefaultSettingsChanged = function(){
        var oTransientVizContext = this.assertOrCreateVizContext();
        var oTransientRenderingContext = this.createRenderingContext(oTransientVizContext);
        this.render(oTransientRenderingContext);
        this._setIsRendered(true);
    };


    OrgChartViz.prototype._publishMarkEvent = function (oDataLayout, eMarkContext) {

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
    OrgChartViz.prototype._addVizSpecificMenuOptions = function(oTransientVizContext, sMenuType, aResults, contextmenu, evtParams, oTransientRenderingContext){
        aResults.shift();
        OrgChartViz.superClass._addVizSpecificMenuOptions.call(this, oTransientVizContext, sMenuType, aResults, contextmenu, evtParams, oTransientRenderingContext);
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

    OrgChartViz.prototype._addVizSpecificPropsDialog = function(oTabbedPanelsGadgetInfo){

        //var options = this.getViewConfig() || {};
        //this._fillDefaultOptions(options, null);
        //this._addLegendToVizSpecificPropsDialog(options, oTabbedPanelsGadgetInfo);

        this.doAddVizSpecificPropsDialog(this, oTabbedPanelsGadgetInfo);
        OrgChartViz.superClass._addVizSpecificPropsDialog.call(this, oTabbedPanelsGadgetInfo);

    };

    /**
     * TODO: Legend should take care of this
     * Given an options / config object, configure it with default options for the visualization.
     *
     * @param {object} oOptions the options
     * @param {module:obitech-framework/actioncontext#ActionContext} oActionContext The ActionContext instance associated with this action
     * @protected
     */
    OrgChartViz.prototype._fillDefaultOptions = function (oOptions/*, oActionContext*/) {
        if (!jsx.isNull(oOptions) && !jsx.isNull(oOptions.legend))
            return;

        // Legend
        oOptions.legend = jsx.defaultParam(oOptions.legend, {});
        oOptions.legend.rendered = jsx.defaultParam(oOptions.legend.rendered, "on");
        oOptions.legend.position = jsx.defaultParam(oOptions.legend.position, "auto");

        this.getSettings().setViewConfigJSON(dataviz.SettingsNS.CHART, oOptions);
    };

    OrgChartViz.prototype.doAddVizSpecificPropsDialog = function (oTransientRenderingContext, oTabbedPanelsGadgetInfo) {
        jsx.assertObject(oTransientRenderingContext, "oTransientRenderingContext");
        jsx.assertInstanceOf(oTabbedPanelsGadgetInfo, gadgets.TabbedPanelsGadgetInfo, "oTabbedPanelsGadgetInfo", "obitech-application/gadgets.TabbedPanelsGadgetInfo");

        var oDataModel = this.getRootDataModel();

        this.setTabInfo(oTabbedPanelsGadgetInfo);
        var viewConfig = this.getViewConfig() || {};
        var options = this.getViewConfig() || {};
        //this._fillDefaultOptions(options, oTransientRenderingContext.get(viz.ContextProperty.ACTION_CONTEXT));
        this._fillDefaultOptions(options, null);
        /*var valuePanel = gadgetdialog.forcePanelByID(oTabbedPanelsGadgetInfo, euidef.GD_PANEL_ID_VALUE);
        this.setValuePanel(valuePanel);*/
        var generalPanel = gadgetdialog.forcePanelByID(oTabbedPanelsGadgetInfo, euidef.GD_PANEL_ID_GENERAL);

        var oGadgetFactory = this.getGadgetFactory();

        var zoomVal = new gadgets.GadgetValueProperties(euidef.GadgetTypeIDs.TEXT_FIELD, this.getZoomVal());
        var zoomValInfo = oGadgetFactory.createGadgetInfo("zoomValue", 'Zoom Scale(%)', 'Zoom %', zoomVal);
        generalPanel.addChild(zoomValInfo);

        if (OrgChartViz.superClass.doAddVizSpecificPropsDialog)
            OrgChartViz.superClass.doAddVizSpecificPropsDialog.apply(this, arguments);
    };

    OrgChartViz.prototype._handlePropChange = function (sGadgetID, oPropChange, oViewSettings, oActionContext){
        var updateSettings = OrgChartViz.superClass._handlePropChange.call(this, sGadgetID, oPropChange, oViewSettings, oActionContext);
        if (updateSettings) {
            return updateSettings; // super handled it
        }
        /*var conf = oViewSettings.getViewConfigJSON(dataviz.SettingsNS.CHART) || {};
        if(this._handleLegendPropChange(conf, sGadgetID, oPropChange, oViewSettings, oActionContext)){
            updateSettings = true;
        }*/

        // Allow the super class an attempt to handle the changes
        var conf = oViewSettings.getViewConfigJSON(dataviz.SettingsNS.CHART) || {};

        if (sGadgetID === "zoomValue")
        {
            if (jsx.isNull(conf.styleDefaults))
            {
                conf.styleDefaults = {};
            }

            this.setZoomVal(oPropChange.value);
            updateSettings = true;
        }

        return updateSettings;
    };

    /**
     * Builds the list of selected items
     * @param {module:obitech-renderingcontext/renderingcontext.RenderingContext} oTransientRenderingContext - The rendering context
     */
    OrgChartViz.prototype._buildSelectedItems = function(oTransientRenderingContext){
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
            
            //oViz._render(oTransientRenderingContext);
        }
        oMarkingService.getUpdatedMarkingSet(oDataLayout, marking.EMarkOperation.MARK_RELATED, fMarksReadyCallback);
    };


    /**
     * React to marking service highlight events
     */
    OrgChartViz.prototype.onHighlight = function(){
        var oTransientVizContext = this.assertOrCreateVizContext();
        var oTransientRenderingContext = this.createRenderingContext(oTransientVizContext);
        this._buildSelectedItems(oTransientRenderingContext);
    };

    /**
     * Override _doInitializeComponent in order to subscribe to events
     */
    OrgChartViz.prototype._doInitializeComponent = function() {
        OrgChartViz.superClass._doInitializeComponent.call(this);

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
     * @returns {module:com-company-orgchartViz/orgchartViz.OrgChartViz}
     * @memberof module:com-company-orgchartViz/orgchartViz
     */
    orgChart.createClientComponent = function (sID, sDisplayName, sOrigin) {
        // Argument validation done by base class
        return new OrgChartViz(sID, sDisplayName, sOrigin, OrgChartViz.VERSION);
    };

    return orgChart;
});