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
    'ojL10n!com-company-orgchartviz-v2/nls/messages',
    'obitech-application/extendable-ui-definitions',
    'obitech-reportservices/data',
    'd3js',
    'knockout',
    'obitech-framework/messageformat',
    'css!com-company-orgchartviz-v2/orgChartVizstyles',],
    function ($,
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

        var MODULE_NAME = 'com-company-orgchartviz-v2/orgChartViz';

        //Param validation to detect cyclical dependencies (ignore modules not used in resource arguments)
        jsx.assertAllNotNullExceptLastN(arguments, "orgChartViz.js arguments", 2);

        var orgChart = {};

        var _logger = new logger.Logger(MODULE_NAME);

        // The version of our Plugin
        OrgChartViz.VERSION = "2.0.0";

        /**
         * The implementation of the orgchartViz visualization.
         *
         * @constructor
         * @param {string} sID
         * @param {string} sDisplayName
         * @param {string} sOrigin
         * @param {string} sVersion
         * @extends {module:obitech-report/visualization.Visualization}
         * @memberof module:com-company-orgchartviz-v2/orgChartViz#
         */

        function OrgChartViz(sID, sDisplayName, sOrigin, sVersion) {
            // Argument validation done by base class
            OrgChartViz.baseConstructor.call(this, sID, sDisplayName, sOrigin, sVersion);

            var tabInfo = '';
            var zoomVal = '50';
            var managersList = [];
            var rowDisplayNames = [];
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

            this._saveSettings = function () {
                this.getSettings().setViewConfigJSON(dataviz.SettingsNS.CHART, this.Config);
            };

            this.loadConfig = function () {
                var conf = this.getSettings().getViewConfigJSON(dataviz.SettingsNS.CHART) || {};
                if (conf.rowDisplayNames) this.Config.rowDisplayNames = conf.rowDisplayNames;
                if (conf.legendItems) this.Config.legendItems = conf.legendItems;
                if (conf.zoomVal) this.Config.zoomVal = conf.zoomVal;
                if (conf.cID) this.Config.cID = conf.cID;
                if (conf.color) this.Config.color = conf.color;

            }

            this.getManagersList = function () {
                return (this.Config.managersList);
            };

            this.setManagersList = function (o) {
                this.Config.managersList = o;
            };

            this.getRowDisplayNames = function () {
                return (this.Config.rowDisplayNames);
            };

            this.setRowDisplayNames = function (o) {
                this.Config.rowDisplayNames = o;
            };

            this.getLegendItems = function () {
                return (this.Config.legendItems);
            };

            this.setLegendItems = function (o) {
                this.Config.legendItems = o;
            };

            this.getZoomVal = function () {
                return (this.Config.zoomVal);
            };

            this.setZoomVal = function (o) {
                zoomVal = o;
                this.Config.zoomVal = o;
                this._saveSettings();
            };

            this.getCID = function () {
                return (this.Config.cID);
            };

            this.setCID = function (o) {
                this.Config.cID = o;
            };

            this.isColor = function () {
                return (this.Config.color);
            };

            this.setColor = function (o) {
                this.Config.color = o;
            };

            this.getTabInfo = function () {
                return (tabInfo);
            };

            this.setTabInfo = function (o) {
                tabInfo = o;
            };

            /**
             * @type {Array.<String>} - The array of selected items
             */
            var aSelectedItems = new Map();

            /**
             * @return  {Array.<String>} - The array of selected items
             */
            this.getSelectedItems = function () {
                return aSelectedItems;
            };

            /**
             * Clears the current list of selected items
             */
            this.clearSelectedItems = function () {
                aSelectedItems = new Map();
            };
        };

        jsx.extend(OrgChartViz, dataviz.DataVisualization);
        var row_limit;

        OrgChartViz.prototype._generateData = function (oDataLayout, oTransientRenderingContext) {

            var oDataModel = this.getRootDataModel();
            if (!oDataModel || !oDataLayout) {
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
            for (var nRow = 2; nRow < nRowLayerCount; nRow++) {
                //var rowKey = oDataLayoutHelper.getLogicalEdgeName(datamodelshapes.Physical.ROW, nRow);
                var displayName = oDataLayout.getLayerMetadata(datamodelshapes.Physical.ROW, nRow, data.LayerMetadata.LAYER_DISPLAY_NAME);
                this.getRowDisplayNames().push(displayName);
            }
            
            var outputMap = [];
            var legendItems = new Map();
            this.setColor(false);
            var color_hash;
            var color;

            for (var nRow = 0; nRow < Math.max(nRows, 1); nRow++) {
                var name = oDataLayout.getValue(datamodelshapes.Physical.ROW, 0, nRow, false);
                var manager = oDataLayout.getValue(datamodelshapes.Physical.ROW, 1, nRow, false);
                var empObj = { Id: name, Parent: manager, details: [], color: '', color_val: '' };
                var colorObj;
                if (nRowLayerCount > 2) {
                    //var detail = new Map();
                    for (var nRowLayer = 2; nRowLayer < Math.max(nRowLayerCount, 1); nRowLayer++) {
                        var row = oDataLayout.getValue(datamodelshapes.Physical.ROW, nRowLayer, nRow, false);
                        var rowType = oDataLayoutHelper.getLogicalEdgeName(datamodelshapes.Physical.ROW, nRowLayer);
                        if (rowType === "color") {
                            this.setColor(true);
                            colorObj = this.getDataItemColorInfo(oDataLayoutHelper, oColorContext, oColorInterpolator, nRow, 0);
                            // getting color hexcode from color palette
                            color_hash = colorObj.sColor;

                            // getting value from parameter within color parameter
                            color = colorObj.sSeriesColorLabel ? colorObj.sSeriesColorLabel : row;
                            
                            //reset Legends                           
                            legendItems.set(color, '');
                            legendItems.set(color_hash, '');
                            
                            // Push the values into the JSON data
                            empObj.color = color_hash;
                            empObj.details.push(color);
                            empObj.color_val = color;
                        }
                        else {
                            empObj.details.push(row);
                        }
                    }
                    
                    this.setLegendItems(legendItems);
                }
                outputMap.push(empObj);
            }

            var outputData = convert(outputMap).children[0];
            if (outputData)
                return outputData;
            else
                return null;
        }

        function convert(array) {
            var map = {}
            for (var i = 0; i < array.length; i++) {
                var obj = array[i]
                if (!(obj.Id in map)) {
                    map[obj.Id] = obj
                    map[obj.Id].children = []
                }

                if (typeof map[obj.Id].Name == 'undefined') {
                    map[obj.Id].Id = obj.Id
                    map[obj.Id].Parent = obj.Parent
                    map[obj.Id].details = obj.details
                    map[obj.Id].color = obj.color
                }

                var parent = obj.Parent || '-';
                if (!(parent in map)) {
                    map[parent] = {}
                    map[parent].children = []
                }

                map[parent].children.push(map[obj.Id])
            }
            return map['-']
        }

        function getChildrenCount(d) {
            var count = 0;
            if (d.children && d.children.length > 0) {
                count += d.children.length;
                d.children.forEach(function (child) {
                    count += getChildrenCount(child);
                });
            } else if (d._children && d._children.length > 0) {
                count += d._children.length;
                d._children.forEach(function (child) {
                    count += getChildrenCount(child);
                });
            }
            return count;
        }

        var getSplChar = function (num) {
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

        /*var colorScale = function (str, intensity) {
            var num = str.charAt(0);
            str = str.concat(str);
            str = str.concat(getSplChar(num));
            var hash = 0;
            for (var i = 0; i < str.length; i++) {
              hash = str.charCodeAt(i) + ((hash << 5) - hash);
            }
          
            // Redwood theme colors (adjust these values to achieve desired shades)
            var r = Math.min(255, Math.max(0, (hash >> 16) & 0xFF));
            var g = Math.min(255, Math.max(0, (hash >> 8) & 0xFF));
            var b = Math.min(255, Math.max(0, hash & 0xFF));
          
            // Modify color intensity based on input value
            r = Math.min(255, Math.max(0, r * intensity));
            g = Math.min(255, Math.max(0, g * intensity));
            b = Math.min(255, Math.max(0, b * intensity));
          
            // Calculate a distinct gradient based on value range
            var valueRange = 100; // Adjust this value based on the range of values you have
            var colorValue = (r + g + b) / 3; // Calculate the average color value
            var colorRatio = colorValue / 255; // Convert the color value to a ratio (between 0 and 1)
            var darkShade = 0.3; // Adjust this value to control the darkness of the lower values
          
            // Calculate the final color intensity
            var adjustedIntensity = darkShade + (1 - darkShade) * colorRatio;
          
            // Apply the adjusted intensity to the color
            r = Math.min(255, Math.max(0, r * adjustedIntensity));
            g = Math.min(255, Math.max(0, g * adjustedIntensity));
            b = Math.min(255, Math.max(0, b * adjustedIntensity));
          
            var hex = (r << 16 | g << 8 | b).toString(16).padStart(6, '0');
            return "#" + hex;
          }*/
          
        

        OrgChartViz.prototype._render = function (oTransientRenderingContext) {
            // Note: all events will be received after initialize and start complete.  We may get other events
            // such as 'resize' before the render, i.e. this might not be the first event.
            try {
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
                var pane = sVizContainerId.substring(sVizContainerId.indexOf("view") + 5, sVizContainerId.indexOf("pane"));
                var conetentPane = sVizContainerId.substring(sVizContainerId.indexOf("contentpane_") + 12, sVizContainerId.indexOf("vizCont") - 1);

                var width = $(elContainer).width();
                var height = $(elContainer).height();


                var cId = pane + "_" + conetentPane;
                this.setCID(cId);

                // Adding Legend Data
                var uniqueLegends = {};
                if (this.isColor()) {
                    for (let color of this.getLegendItems().keys()) {
                        if (!color.startsWith('#')){
                            var key = color;
                        }
                        else {
                            var actualValue = color
                        }
                
                        uniqueLegends[key] = actualValue;
                    }
                }

                // ------------------------------ Getting Legend Title Data --------------------------//
                var legendTitle;
                var isColor = false;
                var isNumerical = false;
                var isCategorical = false;

                // true - ceiling, false - floor
                function customRound(value, roundUp) {
                    const magnitude = Math.pow(10, Math.floor(Math.log10(value)));
                    const remainder = value % magnitude;
                    const roundingFactor = roundUp ? magnitude : 0;

                    let roundedValue;

                    if (roundUp) {
                        roundedValue = remainder === 0 ? value : Math.ceil(value / magnitude) * magnitude;
                    } else {
                        roundedValue = Math.floor(value / magnitude) * magnitude + roundingFactor;
                        if (roundingFactor > 0 && value % magnitude < roundingFactor) {
                            roundedValue -= magnitude;
                        }
                    }

                    return roundedValue;
                }

                function hexToRgb(hex) {
                    const bigint = parseInt(hex.slice(1), 16);
                    const r = (bigint >> 16) & 255;
                    const g = (bigint >> 8) & 255;
                    const b = bigint & 255;
                    return { r, g, b };
                }
                
                function colorDistance(color1, color2) {
                    const diffR = color1.r - color2.r;
                    const diffG = color1.g - color2.g;
                    const diffB = color1.b - color2.b;
                    return Math.sqrt(diffR * diffR + diffG * diffG + diffB * diffB);
                }
                
                function getDistinctiveColors(hexColors) {
                    const rgbColors = hexColors.map(hexToRgb);
                    const distinctiveColors = [];
                
                    for (const color of rgbColors) {
                        const isDistinctive = distinctiveColors.every(distinctColor => colorDistance(color, distinctColor) > 50);
                
                        if (isDistinctive) {
                            distinctiveColors.push(color);
                        }
                
                        if (distinctiveColors.length === 5) {
                            break;
                        }
                    }
                
                    const distinctiveHexColors = distinctiveColors.map(color => `#${(1 << 24 | color.r << 16 | color.g << 8 | color.b).toString(16).slice(1)}`);
                    return distinctiveHexColors;
                }                

                if (uniqueLegends && Object.keys(uniqueLegends).length > 0) {
                    isColor = true;
                    // Check if the data is numerical
                    var numericalData = Object.keys(uniqueLegends).map(function(key) {return Number(key);});
                    // Check the number of unique values in numericalData
                    var uniqueValues = new Set(numericalData);
                    var numUniqueValues = uniqueValues.size;

                    if (numericalData.every((value) => typeof value === 'number')) {
                        var isCategorical = false;
                        isNumerical = true;
                        if (numericalData.every((value) => Number.isInteger(value))) {
                            // Check if the min and max values have a difference greater than 5
                            var minValue = customRound(Math.min(...numericalData), false);
                            var maxValue = customRound(Math.max(...numericalData), true);
                            var minActualValue = Math.min(...numericalData);
                            var maxActualValue = Math.max(...numericalData);

                            if (maxValue - minValue > 5 || numUniqueValues > 5) {
                                var binSize = customRound((maxValue - minValue) / 5, false);
                                var bins = [];
                                var previousBinEnd = minValue;

                                for (var i = 0; i < 5; i++) {
                                    var binStart = previousBinEnd;

                                    // Calculate binEnd based on the binStart value
                                    var binEnd = i === 4 ? maxValue : binStart + binSize;

                                    binEnd = binEnd > maxValue ? maxValue : binEnd;
                                    binStart = binStart > maxValue ? maxValue - binSize : binStart;
                                    if (binStart <= maxActualValue) {
                                        bins.push(`${formatNumber(customRound(binStart, false))} - ${formatNumber(customRound(binEnd, true))}`);
                                    }
                                    previousBinEnd = customRound(binEnd, true);
                                }

                                var colors = getDistinctiveColors([...new Set(Object.values(uniqueLegends))])

                                var bin_dict = bins.map((bin, i) => ({ bin: formatNumber(bin), color: colors[i] }));
                            }
                        } else {
                            // Check if the min and max values have a difference greater than 5
                            var minValue = customRound(Math.min(...numericalData), false);
                            var maxValue = customRound(Math.max(...numericalData), true);
                            var minActualValue = Math.min(...numericalData);
                            var maxActualValue = Math.max(...numericalData);

                            if (maxValue - minValue > 5 || numUniqueValues > 5) {
                                var binSize = customRound((maxValue - minValue) / 5, false);
                                var bins = [];
                                var previousBinEnd = minValue;

                                for (var i = 0; i < 5; i++) {
                                    var binStart = previousBinEnd;

                                    // Calculate binEnd based on the binStart value
                                    var binEnd = i === 4 ? maxValue : binStart + binSize;

                                    binEnd = binEnd > maxValue ? maxValue : binEnd;
                                    binStart = binStart > maxValue ? maxValue - binSize : binStart;
                                    if (binStart <= maxActualValue) {
                                        bins.push(`${formatNumber(customRound(binStart, false))} - ${formatNumber(customRound(binEnd, true))}`);
                                    }
                                    previousBinEnd = customRound(binEnd, true);
                                }

                                var colors = getDistinctiveColors([...new Set(Object.values(uniqueLegends))])

                                console.log(colors);
                                var bin_dict = bins.map((bin, i) => ({ bin: formatNumber(bin), color: colors[i] }));
                            }
                        }
                    }
                }

                function formatNumber(value) {
                    if (value >= 1000 && value < 1000000) {
                        return (value / 1000).toFixed(0) + 'K';
                    } else if (value >= 1000000) {
                        return (value / 1000000).toFixed(2) + 'M';
                    } else if (value >= 1000000000) {
                        return (value / 1000000000).toFixed(2) + 'B';
                    } else {
                        return value;
                    }
                }

                function undoFormatNumber(formattedValue) {
                    const match = formattedValue.match(/([0-9.]+)([KMB])?/);
                    if (!match) {
                        return parseFloat(formattedValue);
                    }
                
                    const numericValue = parseFloat(match[1]);
                    const suffix = match[2];
                
                    if (suffix === 'K') {
                        return Math.floor(numericValue * 1000);
                    } else if (suffix === 'M') {
                        return Math.ceil(numericValue * 1000000);
                    } else if (suffix === 'B') {
                        return Math.ceil(numericValue * 1000000000);
                    } else {
                        return Math.round(numericValue);
                    }
                }
                

                function isCategoricalData(legends) {
                    const firstKey = Object.keys(legends)[0];
                    return typeof firstKey === 'string';
                }
                if (isCategoricalData(uniqueLegends) && Object.keys(uniqueLegends).length > 0) {
                    var isCategorical = true;
                    var maxWidth = 0;
                    var maxLegendsPerRow = 4; // Maximum number of legend items per row
                    var offset = 10;
                
                    for (var key in uniqueLegends) {
                        if (uniqueLegends.hasOwnProperty(key)) {
                            var legendText = key;
                        
                        var textWidth = legendText.length * 8; 
                        maxWidth = Math.max(maxWidth, textWidth);
                        }
                    }
                
                    maxWidth = width / maxLegendsPerRow - offset;
                }

                legendTitle = isColor ? this.getRowDisplayNames()[0] : "";

                /*var legendTitleWidth = width * .49;
                var svgWidth = isColor ? "85% !important" : "100% !important";
                var legendWidth = isColor ? "120px !important" : "0% !important";
                var legendTitleWidth = isColor ? "100px !important" : "0% !important";*/

                var hParam = 0;
                var wParam = [];
                var j = 0;
                wParam[j] = 0;

                if (bin_dict) {
                    // Determine the number of bins created
                    var numBins = bin_dict.length;

                    for (var i = 0; i < numBins; i++) {
                        hParam += bin_dict[i].bin.length; 
                        wParam[j] += bin_dict[i].bin.length; 
                        
                        // Adjust width calculation based on the number of bins
                        if (wParam[j] < width * 0.75) {
                            hParam += 110;
                        } else {
                            j++;
                            wParam[j] = 0;
                        }
                    }
                } else {
                    // Original calculation for uniqueLegends
                    for (var i = 0; i < uniqueLegends.length; i++) {
                        hParam += uniqueLegends[i].length;
                        wParam[j] += uniqueLegends[i].length;
                        if (wParam[j] < width * 0.75) {
                            hParam += 110;
                        } else {
                            j++;
                            wParam[j] = 0;
                        }
                    }
                }

                hParam -= 110;
                var lines = hParam / (width * .75);
                lines = lines % 1 > 0 ? lines + 1 : lines;
                lines = Math.floor(lines);
                var lHeight = height - (lines * 30);
                //var tHeight = (lines * 30) + 30;
                var tHeight = height - ((lines + 1) * 30);

                // Structure for entire viz
                var htmlContent = "<div style='height:100%' id=canvas_" + cId + ">" +
                    "<div id=main_" + cId + " style='height:100%' class='main' >";

                // Adding Structure for Search Bar/Collapse All/Expand All/Hide Lines Features
                htmlContent += "<div id=toolsHeader" + cId + " class='tools-menu' style='display:flex;justify-content:center'>" +
                                    "<div id=tools_search" + cId + " class='tool_item' style='display:flex; height:10%'>" +
                                    "</div></div>";
                                    
                // Adding Structure for the OrgChart
                htmlContent += "<div id=full-container_" + cId + " style='height:100%' class='full-container'><div id=svgChart_" + cId + " style='height:100%' class=\"svgChart\"></div></div>" +
                                "<div id=legendPane_" + cId + " class='legend-pane' style='visibility:hidden; position:absolute;left:0;bottom:0;width:100%;height:15%; display:flex; justify-content:center;'>" +
                                    "<div id=legendTitle_" + cId + " class='title' style='float=center;z-index:1;position:fixed;width:10%;'>" +
                                    "</div>" +
                                    "<div id=legend4_" + cId + " class='legend4' style='top: 25px; width:100%; position: absolute;'>" +
                                    "</div></div>";

                htmlContent += "</div>" +  // Close main div
                                "</div>";  // Close canvas div

                $(elContainer).html(htmlContent);
                var wParam = 1;

                var params = {
                    selector: "#svgChart_" + cId,
                    chartWidth: width * wParam,
                    chartHeight: height - ((lines + 1) * 30),
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
                        locate: null
                    },
                    data: this._generateData(oDataLayout, oTransientRenderingContext)
                }

                d3.json(params.dataLoadUrl, function (data) {
                    //params.data = data;
                    params.pristinaData = JSON.parse(JSON.stringify(params.data));
                    //console.log(JSON.stringify(params.data));
                    drawOrganizationChart(params);
                })

                function drawOrganizationChart(params) {
                    //listen();

                    params.funcs.showMySelf = showMySelf;
                    params.funcs.search = searchUsers;
                    params.funcs.closeSearchBox = closeSearchBox;
                    params.funcs.findInTree = findInTree;
                    params.funcs.clearResult = clearResult;
                    params.funcs.reflectResults = reflectResults;
                    params.funcs.departmentClick = departmentClick;
                    params.funcs.back = back;
                    params.funcs.toggleFullScreen = toggleFullScreen;
                    params.funcs.locate = locate;

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
                        collapseCircleRadius: 9,
                        nodeHeight: 55,
                        nodeWidth: 300,
                        duration: 750,
                        rootNodeTopMargin: 20,
                        minMaxZoomProportions: [0.05, 3],
                        linkLineSize: 180,
                        collapsibleFontSize: '26px',
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

                    var baseMultiplier = 1.3;
                    var increment = 0.15;
                    var tree = d3.layout.tree().nodeSize([attrs.nodeWidth * 1.35, (attrs.nodeHeight)]);
                    var diagonal = d3.svg.diagonal()
                            .projection(function (d) {
                                var detailsLen = d.details && Array.isArray(d.details) ? d.details.length : 0;
                                var multiplier = detailsLen >= 5 ? baseMultiplier + (detailsLen - 4) * increment : 1.2;
                                return [d.x + attrs.nodeWidth / 2, (d.y + attrs.nodeHeight / 2) * multiplier];
                            });

                    var zoomBehaviours = d3.behavior
                        .zoom()
                        .scaleExtent(attrs.minMaxZoomProportions)
                        .on("zoom", redraw);

                    var zoom = d3.behavior.zoom().scaleExtent(attrs.minMaxZoomProportions).translate([attrs.width / 2, 50]).scale(1);

                    var svgLength = $("#svgChart_" + cId).get(0).children.length;
                    if (svgLength > 0) {
                        return;
                    }

                    var zX = attrs.width / 2.3;
                    var svg = d3.select(attrs.selector)
                        .append("svg:svg")
                        //.attr("id", "svgPane_"+cId)
                        .attr("width", "100%")
                        .attr("height", "100%")
                        .attr("class", "svg-class")
                        //.call(zoomBehaviours)
                        .call(zoom.on("zoom", redraw))
                        .append("svg:g")
                        .attr("transform", "translate(" + zX + ",20)scale(" + zoomScale + "," + zoomScale + ")");

                    var entireChart = d3.select(".svgChart")
                    const loadingScreen = entireChart.append('div')
                                             .attr('class', 'overlay')
                                             .style('display', 'none')
                                            
                    const loadingAnimation = [
                        {
                          r: 36, 
                          width: 0.4, // border width
                          color: "rgba(95, 143, 181, 1)",
                          dashArray: ["1%", "10.3%", "22%"], // svg stroke-dasharray value
                          // offset: "10", // rotate start offset
                          speed: 50 // transform duration
                        },
                        {
                          r: 36,
                          width: 0.4,
                          color: "rgba(95, 143, 181, 0.3)",
                          dashArray: ["20%", "12%"],
                          speed: 50
                        },
                        {
                          r: 31,
                          width: 1,
                          color: "rgba(120, 175, 159, 1)",
                          dashArray: ["1%", "12.3%", "15.3%"],
                          speed: 50
                        },
                        {
                          r: 31,
                          width: 1,
                          color: "rgba(120, 175, 159, 0.3)",
                          offset: "-8",
                          dashArray: ["1%", "14%", "15%", "5%", "6%"],
                          speed: 50
                        },
                        {
                          r: 28.9,
                          width: 1.5,
                          color: "rgba(198, 139, 34, 1)",
                          dashArray: ["1%", "8%", "20%"],
                          speed: 40
                        },
                        {
                          r: 28.9,
                          width: 1.5,
                          color: "rgba(198, 139, 34, 0.3)",
                          offset: "15",
                          dashArray: ["1%", "20%", "5%"],
                          speed: 40
                        },
                        {
                          r: 27,
                          width: 1,
                          color: "rgba(193, 93, 15, 1)",
                          dashArray: ["1%", "13%", "5%"],
                          speed: 37
                        },
                        {
                          r: 27,
                          width: 1,
                          color: "rgba(193, 93, 5, 0.3)",
                          dashArray: [ "14%", "15%"],
                          offset: "-6",
                          speed: 37
                        },
                        {
                          r: 25,
                          width: 0.6,
                          color: "rgb(170,52,9)",
                          dashArray: ["2%", "8%", "0.4%"],
                          speed: 30
                        },
                        {
                          r: 25,
                          width: 0.6,
                          color: "rgba(170,52,9,0.3)",
                          dashArray: ["15%"],
                          offset: "8",
                          speed: 28
                        },
                      ]

                    function showLoadingAnimation() {
                        function mount(selector, circles) {
                            const svgNS = "http://www.w3.org/2000/svg";
                            const content = document.querySelector(selector);
                            const circleSVG = document.createElementNS(svgNS, "svg");
                            circleSVG.setAttribute("viewBox", "0 0 100 100");
                            circleSVG.setAttribute("height", "100%")
                            content.innerHTML = "";
                          
                            const group = document.createElementNS(svgNS, "g");
                            group.style.transformOrigin = "center";
                            const animationTransform = document.createElementNS(svgNS, "animateTransform");
                            animationTransform.setAttribute("attributeName", "transform");
                            animationTransform.setAttribute("attributeType", "XML");
                            animationTransform.setAttribute("type", "rotate");
                            animationTransform.setAttribute("to", "360");
                            animationTransform.setAttribute("repeatCount", "indefinite");
                          
                            circles.forEach(circle => {
                              const _group = group.cloneNode(true);
                              const _animationTransform = animationTransform.cloneNode(true);
                              const child = document.createElementNS(svgNS, 'circle');
                              child.setAttribute("cx", "50");
                              child.setAttribute("cy", "50");
                              child.setAttribute("r", circle.r);
                              child.setAttribute("fill", "#ffffff00");
                              child.setAttribute("stroke-width", circle.width);
                              child.setAttribute("stroke-dasharray", (circle.dashArray || [10, 25]).join(","));
                              child.setAttribute("stroke", circle.color);
                          
                              _animationTransform.setAttribute("from", circle.offset || "0");
                              if (circle.speed) _animationTransform.setAttribute("dur", circle.speed + "s");
                              _group.appendChild(child);
                              _group.appendChild(_animationTransform);
                              circleSVG.appendChild(_group);
                            });
                            
                            // Text Element for progress %
                            const text = document.createElementNS(svgNS, 'text');
                            text.setAttribute("class", "progress")
                            text.setAttribute("x", "50");
                            text.setAttribute("y", "50");
                            text.setAttribute("text-anchor", "middle");
                            text.setAttribute("dy", "0.3em");
                            text.setAttribute("font-size", "10");
                            text.textContent = "0%";
                            circleSVG.appendChild(text);

                            // Text Element for estimated time progress
                            const estTimeText = document.createElementNS(svgNS, 'text');
                            estTimeText.setAttribute("class", "estTime");
                            estTimeText.setAttribute("x", "50");
                            estTimeText.setAttribute("y", "60"); 
                            estTimeText.setAttribute("text-anchor", "middle");
                            estTimeText.setAttribute("font-size", "3"); 
                            estTimeText.textContent = "(Est. 0m 0s)";
                            circleSVG.appendChild(estTimeText);
                          
                            content.appendChild(circleSVG);
                        }
                        const chart = document.querySelector(".svg-class");
                        const loadingScreen = document.querySelector('.overlay')
                        
                        if (!loadingScreen.innerHTML.trim()) {
                            mount(".overlay", loadingAnimation);
                            loadingScreen.style.display = "block";
                            chart.style.display = "none";
                        } else {
                            loadingScreen.style.display = "block";
                            chart.style.display = "none";
                        }
                    }
                    
                    
                    // Function to hide the loading animation
                    function hideLoadingAnimation() {
                        const chart = document.querySelector(".svg-class");
                        const loadingScreen = document.querySelector('.overlay')
                        loadingScreen.style.display = "none";
                        chart.style.display = "block";
                    }                     

                    //necessary so that zoom knows where to zoom and unzoom from
                    //zoomBehaviours.translate([dynamic.rootNodeLeftMargin, attrs.rootNodeTopMargin]);

                    attrs.root.x0 = 0;
                    attrs.root.y0 = dynamic.rootNodeLeftMargin;

                    if (params.mode != 'department') {
                        // adding unique values to each node recursively
                        var uniq = 1;
                        addPropertyRecursive('uniqueIdentifier', function (v) {

                            return uniq++;
                        }, attrs.root);

                    }

                    if (attrs.root.children) {
                        attrs.root.children.forEach(collapse);
                    }

                    update(attrs.root);
                    d3.select(attrs.selector).style("height", attrs.height);
                    
                    /////Legend Title///

                    var xpos = width * .15, ypos = 35;
                    if (bin_dict) {
                        // Determine the number of bins created
                        var numBins = bin_dict.length;

                        var pMark = numBins * 20; // Adjust the factor as needed
                    } else {
                        var pMark = Object.keys(uniqueLegends).length * 20; // Original calculation
                    }

                    xpos = lines === 1 ? (width - hParam + pMark) / 2 : xpos;
                    var titleY = lines === 1 ? 0 : 10;

                    var svgTitle = d3.select("#legendTitle_" + cId).append("svg")
                        .attr("text-anchor", "center")
                        .attr("width", width)
                        .attr("height", 12)

                    svgTitle.append("text")
                        .attr("class", "title")
                        .attr("text-anchor", "center")
                        .attr("x", "0%")
                        .attr("y", 10)
                        .text(legendTitle);

                    /////////////////// Title Ends here


                    /////////Displaying Horizonal Lengend///////////////////////////
                    function showLegendLoading() {
                        const legendContainer = d3.select(".legend-pane");
                        legendContainer.style("visibility", "visible");
                        legendContainer.style("overflow","hidden")
                        var spinnerGroup = legendContainer.insert("div", ":first-child")
                                    .attr("class", "spinner-group")
                                    .style("position", "absolute")
                                    .style("scale", "0.75")
                                    .style("display", "flex")
                                    .style("transform", "translate(-50%, -50%)")
                                    .style("left", "50%")
                                    .style("top", "50%")

                        const foreignObject = spinnerGroup.append("foreignObject")
                                    .attr("width", "250px")
                                    .attr("height", "250px")

                        foreignObject.html('<div class="triple-spinner"></div>');
                            
                        spinnerGroup.select(".triple-spinner")
                                    .style("animation", "spin 2s linear infinite");
                            
                        spinnerGroup.select(".triple-spinner")
                                    .style("width", "200px")
                                    .style("height", "200px");
                        
                        spinnerGroup.append("div")
                                    .attr("class", "loading-text")
                                    .text("Loading Legends...")
                                    .style("transform", "translate(-130%, 425%)")
                                    .style("position", "relative")
                                    .style("height", "20px");
                    }
                
                    // Function to hide the legend loading animation
                    function hideLegendLoading() {
                        d3.selectAll(".spinner-group").style("visibility", "hidden");
                        d3.select(".legend-pane").style("visibility", "visible");
                        d3.select(".legend4").style("visibility", "visible");
                        d3.select(".legend-pane").style("overflow-y", "auto")
                    }

                    if ($("#legend4_" + cId).find('svg').length > 0)
                        d3.select("svg").empty();

                    var svgLegend4 = d3.select("#legend4_" + cId).append("svg")
                        .attr("class", "legend4_svg" + cId)
                        .attr("text-anchor", "center")
                        .attr("height", "100%")

                        var dataL = 0;
                        var minPadding = 5; // Minimum padding between legend items
                        var availableWidth = width * 0.85;
                        var startX = 15;
                        var ypos = 5; 
                        var resetXpos = startX; 
                        var loadedNodesCounter = 1;
                        var legendContainer = d3.select(".legend-pane");
                        var legendItems = d3.select(".legend4")
                        var legendExecuted = false;
                        var rowWidths = [];
                            

                        var legendH = svgLegend4.selectAll("#legend4_" + cId)
                                .data(function () {
                                    if (isNumerical === true && typeof bin_dict !== 'undefined') {
                                        return bin_dict.map(item => item.bin);
                                    } else {
                                        return Object.keys(uniqueLegends).sort((a, b) => parseFloat(a) - parseFloat(b));
                                    }
                                })
                                .enter().append('g')
                                .attr("class", "legend4")
                                .each(function (d, i) {
                                    if (!legendExecuted){
                                        showLegendLoading();
                                        legendItems.style("visibility", "hidden")
                                        legendExecuted = true;
                                    }
                                    var currentG = this;
                                    var legendItemWidth = isNaN(parseFloat(d)) ? d.length : dataL + d.length;
                        
                                    xpos = resetXpos;
                        
                                    // Check if the legend item can fit in the remaining space of the current row
                                    if (xpos + legendItemWidth + minPadding > availableWidth && i > 0) {
                                        ypos += 30;
                                    
                                        // Start a new row in the nested array
                                        rowWidths.push(resetXpos); 
                                    
                                        // Update xpos for the next legend item in the new row
                                        xpos = resetXpos + legendItemWidth + minPadding; 
                                    } else {
                                        // Accumulate the item widths within the current row
                                        if (rowWidths.length > 0) {
                                            rowWidths[rowWidths.length - 1] += legendItemWidth*8.75 + (i > 0 ? minPadding*2.5 : 0)
                                        } else {
                                            width = legendItemWidth*8.75 + minPadding*2.5
                                            rowWidths.push(width);
                                        }
                                    
                                        // Update xpos for the next legend item
                                        xpos += legendItemWidth + (i > 0 ? minPadding : 0);
                                    }
                        
                        
                                    setTimeout(function () {
                                        var previousElements = svgLegend4.selectAll(".legend4").filter(function (_, index) {
                                            return index === i - 1;
                                        });
                                        var previousElementWidth = previousElements.empty() ? 0 : previousElements.node().getBBox().width;
                                        
                                        // If its the very first item, we force it to start at original position, else xpos logic will work itself
                                        var newX = i === 0 ? resetXpos : xpos + minPadding + previousElementWidth;

                                        // Check if the legend item overflows and start on a new row
                                        if (newX + legendItemWidth > availableWidth && i > 0) {
                                            ypos += 30; 
                                            newX = resetXpos; // Reset x-position to 0 for the first legend item in each row
                                        }
                        
                                        xpos = newX + legendItemWidth;
                        
                                        // Updating the height of legend4_ div (dynamic in height for scrolling)
                                        var div = d3.select("#legend4_" + cId);
                                        var divHeight = ypos + 30;
                                        div.style("height", divHeight + "px");
                        
                                        d3.select(currentG).attr("transform", "translate(" + newX + "," + ypos + ")");
                        
                                        var transformAttribute = d3.select(currentG).attr("transform");
                                        if (transformAttribute && transformAttribute.includes("translate")) {
                                            loadedNodesCounter++;
                                            // Check if all nodes are loaded before showing the legend container
                                            if (loadedNodesCounter >= legendH.size()-5) {
                                                hideLegendLoading();
                                                d3.selectAll(".legend-pane").style("visibility", "visible");
                                                d3.selectAll(".legend4").style("visibility", "visible");
                                                
                                                // Calculate the maximum width from the array
                                                var maxRowWidth = Math.max(...rowWidths);
                        
                                                // Check if maxRowWidth is a finite number, set it as SVG width
                                                if (isFinite(maxRowWidth) && maxRowWidth > 0) {
                                                    var rowWidth = maxRowWidth + 135;
                                                    if (rowWidth > 1300){
                                                        d3.selectAll(".legend4_svg" +cId).attr("width", "100%");
                                                    }
                                                    else{
                                                        d3.selectAll(".legend4_svg" +cId).attr("width", rowWidth);
                                                    }
                        
                                                    var legendSvg = document.querySelector('.legend4_svg' + cId);
                                                    var mainElement = document.querySelector('.main');

                                                    if (legendSvg.scrollHeight > mainElement.clientHeight * 0.15) {
                                                        document.querySelector("#legendPane_" + cId).classList.remove("overflow-auto", "overflow-hidden");
                                                        document.querySelector("#legendPane_" + cId).classList.add("overflow-auto");
                                                    } else {
                                                        document.querySelector("#legendPane_" + cId).classList.remove("overflow-auto", "overflow-hidden");
                                                        document.querySelector("#legendPane_" + cId).classList.add("overflow-hidden");
                                                    }
                                                    

                                                    if (rowWidth > 1300) {
                                                        d3.selectAll(".legend4_svg" + cId).attr("width", "100%");
                                                    } else {
                                                        d3.selectAll(".legend4_svg" + cId).attr("width", rowWidth);
                                                    }
                                                    resetXpos = startX; // Reset the resetXpos to the initial starting position
                                                } else {
                                                    // Set a default width if the calculated width is not valid
                                                    console.error("Error: Unable to calculate valid maximum width.");
                                                }
                                            }
                                        }
                                    }, 0);
                                });
                                var hasLegendData = legendH.size() > 0;

                                if (hasLegendData) {
                                    d3.selectAll("#legendPane_" + cId).style("visibility", "visible !important");
                                } else {
                                    d3.selectAll("#legendPane_" + cId).style("visibility", "hidden !important");
                                }
                    
                    legendH.append('rect')
                        .attr("x", 0)
                        .attr("y", 0)
                        .attr("width", 10)
                        .attr("height", 10)
                        .style("text-anchor", "center")
                        .style("fill", function (d, i) {
                            if (isNumerical === true && typeof bin_dict !== 'undefined'){
                                return bin_dict[parseInt(i)]["color"];
                            }
                            else{
                                return Object.values(uniqueLegends)[i] //colorScale(d, 0.8);
                            }
                        })

                    legendH.append('text')
                        .attr("x", 20)
                        .attr("y", 10)
                        //.attr("dy", ".35em")
                        .text(function (d, i) {
                            if (isNumerical === true && typeof bin_dict !== 'undefined'){
                                return d;
                        }
                        else{
                            return Object.keys(uniqueLegends)[i];
                        }
                    })
                        .attr("class", "textselected")
                        .style("text-anchor", "center")
                        .style("text-overflow", "ellipsis")
                        .style("font-size", 10);

                        /* Allow Resizing of Legend */
                        const legendPane = document.querySelector('.legend-pane' + cId);
                        const legendTitleC = document.querySelector('.title');

                        let isResizing = false;
                        let initialMouseY;
                        let initialHeightPercentage;

                        // Initialize Mouse Movement
                        function handleMouseDown(event) {
                            // Check if the mouse is on the legend title
                            const legendTitle = d3.select('.title').node();
                            if (event.target === legendTitle) {
                                isResizing = true;
                                initialMouseY = event.clientY;
                                initialHeightPercentage = parseFloat(getComputedStyle(legendPane).height) / window.innerHeight * 100;

                                // Set the resize cursor
                                legendTitle.style.cursor = 'ns-resize';

                                document.addEventListener('mousemove', handleMouseMove);
                            }
                        }

                        // Move the mouse to drag the legend area
                        function handleMouseMove(event) {
                            if (isResizing) {
                                const deltaY = event.clientY - initialMouseY;
                                let newHeightPercentage = initialHeightPercentage - deltaY / window.innerHeight * 100;

                                newHeightPercentage = Math.min(Math.max(newHeightPercentage, 10), 55);
                                legendPane.style.height = newHeightPercentage + '%';
                            }
                        }

                        // Remove the EventListener when they stop dragging to change back cursor
                        function handleMouseUp() {
                            isResizing = false;

                            // Reset the cursor
                            legendTitleC.style.cursor = 'pointer';
                            
                            document.removeEventListener('mousemove', handleMouseMove);
                        }

                        // Set resize cursor on hover
                        /*legendTitleC.addEventListener('mouseenter', function () {
                            if (!isResizing) {
                                legendTitleC.style.cursor = 'ns-resize';
                            }
                        });

                        legendTitleC.addEventListener('mouseleave', function () {
                            if (!isResizing) {
                                legendTitleC.style.cursor = 'pointer';
                            }
                        });
                        */

                        /*document.addEventListener('mousedown', handleMouseDown);
                        document.addEventListener('mousemove', handleMouseMove);
                        document.addEventListener('mouseup', handleMouseUp);*/




                    var tooltip = d3.select('body')
                        .append('div')
                        .attr('class', 'customTooltip-wrapper');


                    function update(source, param) {
                        // Compute the new tree layout.
                        var nodes = tree.nodes(attrs.root)
                            .reverse(),
                            links = tree.links(nodes);

                            function findAllObjectNodes(node) {
                                const objectNodes = [];
                            
                                function traverse(node) {
                                    objectNodes.push(node);
                                    if (node.children) {
                                        for (const child of node.children) {
                                            traverse(child);
                                        }
                                    }
                                    if (node._children) {
                                        for (const child of node._children) {
                                            traverse(child);
                                        }
                                    }
                                }
                            
                                traverse(node);
                                return objectNodes;
                            }
                           
                        const allNodes = findAllObjectNodes(attrs.root)
                        // Normalize for fixed-depth.
                        nodes.forEach(function (d) {
                            d.y = d.depth * attrs.linkLineSize;
                        });

//-------------------------------------------------------------  Dragging Feature  -------------------------------------------------------------//
                        // Define the drag behavior
                        var drag = d3.behavior.drag()
                            .origin(function (d) {
                                return d; // Set the drag origin to the node's current position
                            })
                            .on("dragstart", dragstart)
                            .on("drag", dragmove)
                            .on("dragend", dragend);

                        // Function to handle dragstart event
                        function dragstart(d) {
                            d3.event.sourceEvent.stopPropagation(); // Prevent panning while dragging
                            d.fixed = true; // Fix the node position during dragging
                            d3.select(this).classed("dragging", true);
                        }

                        // Dragging Event
                        function dragmove(d) {
                            const deltaX = d3.event.dx;
                            const deltaY = d3.event.dy;
                        
                            // Update the current node and its links
                            d.x += deltaX;
                            d.y += deltaY;
                            updateNodePositions(d, deltaX, deltaY);
                        
                            // Update the links
                            link.attr("d", function (l) {
                                return "M" + l.source.x + "," + l.source.y + "L" + l.target.x + "," + l.target.y;
                            });
                        
                            tick();
                        }
                        
                        function updateNodePositions(node, deltaX, deltaY) {
                            if (node.children) {
                                node.children.forEach(function (child) {
                                    child.x += deltaX;
                                    child.y += deltaY;
                                    updateNodePositions(child, deltaX, deltaY);
                                });
                            } else if (node._children) {
                                node._children.forEach(function (child) {
                                    child.x += deltaX;
                                    child.y += deltaY;
                                    updateNodePositions(child, deltaX, deltaY);
                                });
                            }
                        }

                        // Function to handle dragend event
                        function dragend(d) {
                            d.fixed = true; // Fix the node position after dragging
                            d3.select(this).classed("dragging", false);
                        }
                        
                        function tick() {
                            link.attr("d", function (d) {
                                var detailsLenSource = d.source.details && Array.isArray(d.source.details) ? d.source.details.length : 0;
                                var detailsLenTarget = d.target.details && Array.isArray(d.target.details) ? d.target.details.length : 0;
                        
                                // Calculate dynamic spacing for nodes in the tick function
                                var baseMultiplier = 1.3;
                                var increment = 0.15;
                                var multiplierSource = detailsLenSource >= 4 ? baseMultiplier + (detailsLenSource - 4) * increment : 1.2;
                                var multiplierTarget = detailsLenTarget >= 4 ? baseMultiplier + (detailsLenTarget - 4) * increment : 1.2;
                        
                                var sourceX = d.source.x + attrs.nodeWidth / 2;
                                var sourceY = (d.source.y + attrs.nodeHeight / 2) * multiplierSource;
                                var targetX = d.target.x + attrs.nodeWidth / 2;
                                var targetY = (d.target.y + attrs.nodeHeight / 2) * multiplierTarget;
                        
                                return "M" + sourceX + "," + sourceY + "L" + targetX + "," + targetY;
                            });
                        
                            node.attr("transform", function (d) {
                                var detailsLen = d.details && Array.isArray(d.details) ? d.details.length : 0;
                        
                                // Calculate dynamic spacing for nodes in the tick function
                                var baseMultiplier = 1.3;
                                var increment = 0.15;
                                var multiplier = detailsLen >= 4 ? baseMultiplier + (detailsLen - 4) * increment : 1.25;
                        
                                // Apply dynamic spacing to nodes
                                return "translate(" + d.x + "," + (d.y * multiplier) + ")";
                            });
                        }

                        var toolsSearchDiv = d3.select("#tools_search" + cId)
                        // Clear existing content before appending new elements
                        toolsSearchDiv.selectAll("*").remove();

                        // Update the nodes
                        var node = svg.selectAll("g.node")
                            .data(nodes, function (d) {
                                return d.id || (d.id = ++attrs.index);
                            })
                            .call(drag)

                        function updateCollapseText(node) {
                                if (node.children || node._children) {
                                    node.collapseText = node._children ? attrs.EXPAND_SYMBOL : attrs.COLLAPSE_SYMBOL;
                                }
                            
                                if (node.children) {
                                    node.children.forEach(child => {
                                        updateCollapseText(child);
                                    });
                                }
                                if (node._children) {
                                    node._children.forEach(child => {
                                        updateCollapseText(child);
                                    });
                                }
                        }
                            

//----------------------------- Search Function / Find a Person in Hierarchy / Auto-Zoom into Person -----------------------------//
                        // Basic search function to find a node by name
                        function searchNode(node, name) {
                            if (node.Id.toLowerCase() === name) {
                                return [node]; 
                            } else if (node.children) {
                                for (const child of node.children) {
                                    const foundNodes = searchNode(child, name);
                                    if (foundNodes.length > 0) {
                                        return [node, ...foundNodes]; 
                                    }
                                }
                            } else if (node._children) {
                                for (const child of node._children) {
                                    const foundNodes = searchNode(child, name);
                                    if (foundNodes.length > 0) {
                                        return [node, ...foundNodes]; 
                                    }
                                }
                            }
                            return []; 
                        }
                        
                        function updateCollapseTextOnCanvas(node) {
                            // Select the text elements based on the uniqueIdentifier
                            var textElements = d3.select('[data-id="' + node.uniqueIdentifier + '"] .text-collapse');
                        
                            // Update the text content based on the collapseText value
                            textElements.text(function (d) {
                                if (d.children || d._children) return d.collapseText;
                            });
                        }

                        // Variables declared to capture the zoom level and translate values
                        var capturedTranslateX, capturedTranslateY;

                        function handleSearch() {
                            if (nodes.length !== 1){
                                searchCollapse(attrs.root)
                            }
                            const selectedName = searchInput.node().value.toLowerCase();
                            const foundNodes = searchNode(attrs.root, selectedName);
                            function expandPathToNode(foundNodes) {
                                if (!foundNodes || foundNodes.length === 0) {
                                    return;
                                }
                                const lastNode = foundNodes[foundNodes.length - 1];
                                
                                // Function to recursively collect all descendants of a node
                                function collectDescendants(node, descendants) {
                                    if (node.children) {
                                        node.children.forEach(child => {
                                            descendants.push(child);
                                            collectDescendants(child, descendants);
                                        });
                                    } else if (node._children) {
                                        node._children.forEach(child => {
                                            descendants.push(child);
                                            collectDescendants(child, descendants);
                                        });
                                    }
                                }
                                
                                const allNodes = [...foundNodes];
                                collectDescendants(lastNode, allNodes);
                                allNodes.forEach((node, index) => {
                                    if (node.children || node._children) {
                                        click(node);
                                        if (node._children){
                                            node.collapseText = attrs.EXPAND_SYMBOL;
                                            updateCollapseTextOnCanvas(node);
                                        } else {
                                            node.collapseText = attrs.COLLAPSE_SYMBOL;
                                            updateCollapseTextOnCanvas(node);
                                        }
                                        update(node);
                                    }
                                    if (!node._children && !node.children){
                                        const lastNodeWrapper = d3.select('[data-id="' + node.uniqueIdentifier + '"]');
        
                                        // For those at the end of the hierarchy, they shouldnt display collapsible wrapper. Thus, we remove it here by adding this precautionary measure into our search expand feature
                                        lastNodeWrapper.remove();
                                    }
                                });
                            }

                            function applyShadowFilterAndSpinner(nodeGroup, nodeColor) {
                                const filterId = "shadow-filter-" + Math.random().toString(36).substring(7); // Generate a unique ID for each filter
                                const defs = nodeGroup.append("defs");

                                const filter = defs.append("filter")
                                    .attr("id", filterId);

                                filter.append("feDropShadow")
                                    .attr("dx", "0")
                                    .attr("dy", "0")
                                    .attr("stdDeviation", "10")
                                    .style("flood-color", nodeColor);
                            
                                nodeGroup.style("filter", `url(#${filterId})`);
                                /*const spinnerGroup = nodeGroup.append("g")
                                    .attr("class", "spinner-group");*/

                                /*const foreignObject = spinnerGroup.append("foreignObject")
                                    .attr("width", "250px")
                                    .attr("height", "250px")
                                    .style("transform", "translateY(-55px) translateX(15px)");*/

                                /*foreignObject.html('<div class="triple-spinner"></div>');*/
                            
                                /*spinnerGroup.select(".triple-spinner")
                                    .style("animation", "spin 2s linear infinite");
                            
                                spinnerGroup.select(".triple-spinner")
                                    .style("width", "200px")
                                    .style("height", "200px");*/
                
                                // Remove the additional filters after 3.5 seconds
                                setTimeout(() => {
                                    nodeGroup.style("filter", "none");
                                    /*spinnerGroup.remove();*/
                                }, 3500); 
                            }

                            d3.selectAll("g.node").style("filter", "none");
                            /*d3.selectAll(".triple-spinner").remove();*/

                            if (foundNodes.length > 0) {
                                const foundNode = foundNodes[foundNodes.length - 1];
                                expandPathToNode(foundNodes)
                                hideLoadingAnimation();
                                const childSpacingX = attrs.nodeWidth * 1.2;
                                const childSpacingY = 125;
                                const positions = [];
                                const foundNodeElement = d3.select(`g.node[main-node-id="${foundNode.uniqueIdentifier}"]`);
                                const rectElement = foundNodeElement.select('rect');
                                const computedStyle = window.getComputedStyle(rectElement.node());
                                const borderColor = computedStyle.getPropertyValue('stroke');

                                // Function to recursively reposition child nodes and their descendants
                                function repositionDescendants(node, deltaX, deltaY) {
                                    const childCount = node.children ? node.children.length : 0;

                                    if (childCount >= 2) {
                                        node.children.forEach((child, index) => {
                                            // Calculate new positions for child nodes
                                            let newX = node.x - attrs.nodeWidth * 1.35 + childSpacingX * index;
                                            let newY = node.y + attrs.nodeHeight + childSpacingY;

                                            // Check if the new position is too close to any previous positions
                                            for (const position of positions) {
                                                const [prevX, prevY] = position;
                                                if (
                                                    Math.abs(newX - prevX) < 50 && // Range of values specified for nodes to stay away from
                                                    Math.abs(newY - prevY) < 50
                                                ) {
                                                    newX += childSpacingX + attrs.nodeWidth * 1.3;
                                                    newY += childSpacingY + attrs.nodeHeight;
                                                }
                                            }

                                            child.x = newX;
                                            child.x0 = newX;
                                            child.y = newY;
                                            child.y0 = newY;

                                            d3.select(`g.node[main-node-id="${child.uniqueIdentifier}"]`)
                                                .transition()
                                                .duration(attrs.duration)
                                                .attr("transform", function (d) {
                                                    var detailsLen = d.details && Array.isArray(d.details) ? d.details.length : 0;
                                                    // Calculate dynamic spacing for nodes in the tick function
                                                    var baseMultiplier = 1.3;
                                                    var increment = 0.15;
                                                    var multiplier = detailsLen >= 4 ? baseMultiplier + (detailsLen - 4) * increment : 1.25;
                                                    return `translate(${d.x},${d.y*multiplier})`;
                                                });
    
                                            // Recursively reposition descendants
                                            repositionDescendants(child, deltaX, deltaY);
                                            positions.push([newX, newY]);
                                        });
                                    } else if (childCount === 1) {
                                        // If there's only one child, position it directly below the parent node
                                        const child = node.children[0];
                                        let newX = node.x;
                                        let newY = node.y + attrs.nodeHeight + childSpacingY;

                                        for (const position of positions) {
                                            const [prevX, prevY] = position;
                                            if (
                                                Math.abs(newX - prevX) < 50 &&
                                                Math.abs(newY - prevY) < 50
                                            ) {
                                                newX += attrs.nodeWidth * 1.35 + childSpacingX;
                                            }
                                        }

                                        // Update child node positions
                                        child.x = newX;
                                        child.x0 = newX;
                                        child.y = newY;
                                        child.y0 = newY;

                                        
                                        d3.select(`g.node[main-node-id="${child.uniqueIdentifier}"]`)
                                            .transition()
                                            .duration(attrs.duration)
                                            .attr("transform", function (d) {
                                                var detailsLen = d.details && Array.isArray(d.details) ? d.details.length : 0;
                                                // Calculate dynamic spacing for nodes in the tick function
                                                var baseMultiplier = 1.3;
                                                var increment = 0.15;
                                                var multiplier = detailsLen >= 4 ? baseMultiplier + (detailsLen - 4) * increment : 1.25;
                                                return `translate(${d.x},${d.y*multiplier})`;
                                            });

                                        repositionDescendants(child, deltaX, deltaY);
                                        positions.push([newX, newY]);
                                    }
                                } 
                                repositionDescendants(foundNode, 0, 0);

                                
                                const links = d3.selectAll('path.link');

                               
                                links.transition().duration(attrs.duration).attr("d", function (d) {
                                    var detailsLenSource = d.source.details && Array.isArray(d.source.details) ? d.source.details.length : 0;
                                    var detailsLenTarget = d.target.details && Array.isArray(d.target.details) ? d.target.details.length : 0;

                                    // Calculate dynamic spacing for nodes in the tick function
                                    var baseMultiplier = 1.3;
                                    var increment = 0.15;
                                    var multiplierSource = detailsLenSource >= 4 ? baseMultiplier + (detailsLenSource - 4) * increment : 1.25;
                                    var multiplierTarget = detailsLenTarget >= 4 ? baseMultiplier + (detailsLenTarget - 4) * increment : 1.25;

                                    const sourceX = d.source.x + attrs.nodeWidth / 2; 
                                    const sourceY = (d.source.y + attrs.nodeHeight / 2)*multiplierSource;
                                    const targetX = d.target.x + attrs.nodeWidth / 2; 
                                    const targetY = (d.target.y + attrs.nodeHeight / 2)*multiplierTarget;

                                    
                                    return `M${sourceX},${sourceY}L${targetX},${targetY}`;
                                });
                                
                               
                                const translationBuffer = 275;
                                capturedTranslateX = -foundNode.x + translationBuffer*2.1;
                                capturedTranslateY = -foundNode.y + translationBuffer;
                                svg.transition().duration(1500).call(zoom.translate([capturedTranslateX, capturedTranslateY]).scale(0.75).event)
                                // Enable manual zoom/drag interactions
                                svg.call(zoomBehaviours);
                                applyShadowFilterAndSpinner(foundNodeElement, "yellow");
                                searchInput.property("value", "")
                            }
                        }

                        function createDropdownWithPages(names, pageSize) {
                            const totalPages = Math.ceil(names.length / pageSize);
                        
                            // Loop through the total number of pages
                            for (let page = 0; page < totalPages; page++) {
                                
                                const startIndex = page * pageSize;
                                const endIndex = Math.min(startIndex + pageSize, names.length);
                                
                            
                                const dropdown = document.createElement("select");
                                dropdown.classList.add("search-bar-dropdown");
                                dropdown.style.display = "none"; 
                        
                                
                                for (let i = startIndex; i < endIndex; i++) {
                                    const option = document.createElement("option");
                                    option.value = names[i];
                                    option.text = names[i];
                                    dropdown.appendChild(option);
                                }
                            
                                
                                const svgElement = document.querySelector(".svg-class");
                                svgElement.appendChild(dropdown);
                                
                               
                                svgElement.addEventListener("click", function(event) {
                                    
                                    if (event.target === svgElement) {
                                        if (dropdown.style.display === "none") {
                                            dropdown.style.display = "block"; 
                                        } 
                                        else {
                                            dropdown.style.display = "none"; 
                                        }
                                    }
                                });
                            }
                        }
                        
                        const allNames = [];
                        const topParent = findTopParent(source);
                        function getAllNames(topParent) {
                            const stack = [topParent];
                        
                            while (stack.length > 0) {
                                const currentNode = stack.pop();
                                allNames.push(currentNode.Id.toLowerCase());
                        
                                if (currentNode.children) {
                                    stack.push(...currentNode.children);
                                } else if (currentNode._children) {
                                    stack.push(...currentNode._children);
                                }
                            }
                        
                            allNames.sort();
                        }
                        getAllNames(topParent);
                        createDropdownWithPages(allNames, 10)
                        const searchInput = toolsSearchDiv.append("foreignObject")
                            .style("display", "flex")
                            .style("justify-content", "flex-start")
                            .style("flex-shrink", "0")
                            .style("cursor", "pointer")
                            .append("xhtml:input")
                            .attr("type", "text")
                            .attr("class", "search-box-input")
                            .style("width", "192px")
                            .style("height", "19px")
                            .style("border", "2px solid black")
                            .style("border-radius", "6px")
                            .style("font-size", "14px")
                            .on("keydown", function() {
                                // Allow the default behavior of the backspace key within the input
                                if (d3.event.key !== "Backspace") {
                                    return;
                                }
                                // Prevent the event from propagating to the rest of the visualization
                                d3.event.stopPropagation();
                            })
                            .on("mouseover", function(){
                                d3.select(this).style("background-color", "#ddd")
                            })
                            .on("mouseout", function(){
                                d3.select(this).style("background-color", "white")
                            })
                            .on("click", function(){
                                d3.select(this).style("background-color", "white")
                            })
                        searchInput.on("input", handleInput)

                            
                            // Suggestion List
                            const suggestionList = toolsSearchDiv.append("foreignObject")
                            .style("position", "absolute")
                            .style("cursor", "default")
                            .append("xhtml:ul")
                            .attr("class", "suggestion-list")
                            .style("list-style", "none")
                            .style("padding", "0")
                            .style("width", "192px")
                            .style("margin-top", "25px")
                            .style("max-height", "120px")
                            .style("overflow-y", "auto")
                            .style("border-left", "1px solid #ccc")
                            .style("border-right", "1px solid #ccc")
                            .style("border-bottom", "1px solid #ccc")
                            .style("border-radius", "6px")
                            .style("box-shadow", "0 2px 4px rgba(0, 0, 0, 0.1)")
                            .style("background-color", "white")
                            .style("font-size", "14px")
                            .style("position", "absolute")
                            .on("wheel", function(){
                                d3.event.stopPropagation();
                            })
                        
                        let timeoutId;
                        // Dropdown Menu, to show the suggested person whilst user is searching
                        function handleInput() {
                            const inputValue = this.value.toLowerCase();
                            suggestionList.html("");
                            clearTimeout(timeoutId);
                            timeoutId = setTimeout(() => {
                                const filteredSuggestions = allNames.filter(suggestion => {
                                    return (
                                        suggestion.toLowerCase().includes(inputValue) ||
                                        suggestionDetailsMatch(suggestion, inputValue)
                                    );
                                });
                                let index = 0;
                                filteredSuggestions.forEach(suggestion => {
                                    // Find the corresponding node by Id
                                    const foundNode = findNodeById(attrs.root, suggestion);
                                    if (foundNode) {
                                        let suggestionText = suggestion.replace(/\b\w/g, c => c.toUpperCase());
                                        if (suggestionText === foundNode.details[0] || suggestionText === foundNode.details[1]) {
                                            //pass
                                        } else {
                                            if (foundNode.details && foundNode.details.length > 0) {
                                                if (foundNode.color) {
                                                    suggestionText += foundNode.details.length === 1
                                                        ? ''
                                                        : ` - ${foundNode.details[1] || foundNode.details[0]}`;
                                                } else {
                                                    suggestionText += ` - ${foundNode.details[0] || ''}`;
                                                }
                                            }
                                        }

                                        suggestionList.append("xhtml:li")
                                            .attr("class", `search-item-${index}`)
                                            .style("padding", "5px 10px")
                                            .style("cursor", "pointer")
                                            .text(suggestionText) // Display "source.Id - emp-name"
                                            .on("click", function() {
                                                suggestionList.html("");
                                                searchInput.property("value", suggestion); // Fill input with selected suggestion
                                                handleSearch(); // Perform search
                                            })
                                            .on("mouseover", function() {
                                                d3.select(this).style("background-color", "#2980b9"); // Change background color on hover
                                            })
                                            .on("mouseout", function() {
                                                d3.select(this).style("background-color", "white")})
                                            .style("animation", "rotateMenu 800ms ease-in-out forwards");
                                        index++
                                    }
                                });
                            }, 420);
                                searchInput.on("keyup", function() {
                                    if (d3.event.key === "Enter" && filteredSuggestions.length > 0) {
                                        suggestionList.select("li").node().click();
                                        // Clear the search input
                                        searchInput.property("value", "");
                                    }
                                });
                                if (d3.event.key === "Enter" && filteredSuggestions.length > 0) {
                                    // Clear the search input
                                    searchInput.property("value", "");
                                }
                        }
                        
                        function findNodeById(node, id) {
                            const isNumerical = /^\d+$/.test(id);
                            if (isNumerical) {
                                if (node.Id === id) {
                                    return node;
                                }
                            } else {
                                if (node.Id.toLowerCase().includes(id.toLowerCase())) {
                                    return node;
                                }
                            }

                            if (node.children) {
                                for (const child of node.children) {
                                    const found = findNodeById(child, id);
                                    if (found) {
                                        return found;
                                    }
                                }
                            }

                            if (node._children) {
                                for (const child of node._children) {
                                    const found = findNodeById(child, id);
                                    if (found) {
                                        return found;
                                    }
                                }
                            }

                            return null; // Node not found
                        }

                        // Allow search using id and details(name)
                        function suggestionDetailsMatch(suggestion, inputValue) {
                            const foundNode = findNodeById(attrs.root, suggestion);
                            if (foundNode && foundNode.details) {
                                for (const detail of foundNode.details) {
                                    if (detail.toLowerCase().includes(inputValue)) {
                                        return true;
                                    }
                                }
                            }
                        
                            return false;
                        }

                        // Placeholder
                        searchInput.attr("placeholder", "Search");
                        let hideTimeout;

                        // When focus is on the search bar (input area)
                        searchInput.on('focus', function() {
                            // Show the dropdown box
                            clearTimeout(hideTimeout);
                            suggestionList.classed('suggestion-list-hide', false);
                        });
                        
                        // When focus is not on the search bar (input area)
                        searchInput.on('blur', function() {
                            // Hide the dropdown box
                            hideTimeout = setTimeout(function() {
                                suggestionList.classed('suggestion-list-hide', true);}, 100);
                        });

                        searchInput.on("keyup", function() {
                            // CTRL + A (shortcut optimization)
                            if (d3.event.ctrlKey && d3.event.key === "a") {
                                this.select(); // Select all text
                            }
                        });

                        // "Expand All" button 
                        var expandAllButton = toolsSearchDiv
                        .append("button")
                        .attr("text-anchor", "middle")
                        .attr("class", "expand-all-text main-div")
                        .html("<span></span><span></span><span></span><span></span>Expand All")
                        .style("font-size", "14px")
                        .style("border-radius", "7px")
                        .style("border", "none")
                        .style("cursor", "pointer")
                        .on("click", function () {
                            expandAll(source);
                        })
                        .classed("neon__button", true);
                              
                        // "Collapse All" Button
                        var collapseAllButton = toolsSearchDiv
                            .append("button")
                            .attr("text-anchor", "middle")
                            .attr("class", "collapse-all-text main-div")
                            .html("<span></span><span></span><span></span><span></span>Collapse All")
                            .style("font-size", "14px")
                            .style("border-radius", "7px")
                            .style("border", "none")
                            .style("cursor", "pointer")
                            .on("click", function () {
                                collapseAll(source);
                            })
                            .classed("neon__button", true);
                        
                        // "Hide Lines" Button
                        var hideLinesButton = toolsSearchDiv
                            .append("button")
                            .attr("text-anchor", "middle")
                            .attr("class", "hide-lines-text main-div")
                            .html("<span></span><span></span><span></span><span></span>Hide/Unhide Lines")
                            .style("font-size", "14px")
                            .style("border-radius", "7px")
                            .style("border", "none")
                            .style("cursor", "pointer")
                            .on("click", function () {
                                hideLines();
                            })
                            .classed("neon__button", true);

                        // Enter any new nodes at the parent's previous position.
                        var nodeEnter = node.enter()
                            .append("g")
                            .attr("class", "node")
                            .attr("main-node-id", function(d){
                                return d.uniqueIdentifier})
                            .attr("transform", function (d){
                                return "translate(" + source.x0  + "," + source.y0 + ")";
                            })
                            .call(drag); // Apply drag behavior to new node groups

                        var nodeGroup = nodeEnter.append("g")
                            .attr("class", "node-group")

                        // Rectangle Size (Initial)
                        // Refer to NodeUpdate for Final Sizing
                        nodeGroup.append("rect")
                            .attr("width", attrs.nodeWidth)
                            .attr("height", function(d){
                                if (d.details) {
                                    var hasImages = false;
                                    for (var i = 0; i < d.details.length; i++) {
                                        if (d.details[i].includes("data:image") || isImageUrl(d.details[i])) {
                                            hasImages = true;
                                            break;
                                        }
                                    }
                                    var num_var;
                                    if (hasImages) {
                                        num_var = d.details.length * 5;
                                    } else {
                                        num_var = d.details.length * 25;
                                    }
                                    var dynamic_height = num_var + attrs.nodeHeight + 30;
                                    return dynamic_height;
                                } else {
                                    return attrs.nodeHeight;
                                }
                            })
                            .attr("data-node-group-id", function (d) {
                                return d.uniqueIdentifier;
                            })
                            .attr("class", function (d) {
                                var res = "";
                                if (d.isLoggedUser) res += 'nodeRepresentsCurrentUser ';
                                res += d._children || d.children ? "nodeHasChildren" : "nodeDoesNotHaveChildren";
                                return res;
                            });

                        // Append Rectangle to act as a background for Name
                        nodeGroup.append("rect")
                            .attr("width", attrs.nodeWidth+50)
                            .attr("height", attrs.nodeHeight*0.45)
                            .attr("rx", 6)
                            .style("fill", "#292929")
                            .attr("transform", "translate(" + 1.5 + "," + 2  + ")")
                            .style("clip-path", "inset(0px 0px 5px 0px)")

                        // Specifying a Unique ID to the Collapsible Button
                        var collapsiblesWrapper =
                            nodeEnter.append('g')
                                .attr('data-id', function (v) {
                                    return v.uniqueIdentifier;
                                });

                        // Collapse Circle Display
                        var collapsibles =
                            collapsiblesWrapper.append("circle")
                                .attr('class', 'node-collapse')
                                .attr('cx', attrs.nodeWidth+50) 
                                .attr('cy', function(d){
                                    if (d.details) {
                                        var hasImages = false;
                                        for (var i = 0; i < d.details.length; i++) {
                                            if (d.details[i].includes("data:image") || isImageUrl(d.details[i])) {
                                                hasImages = true;
                                                break;
                                            }
                                        }
                                        var num_var;
                                        if (hasImages) {
                                            num_var = (d.details.length - 1) * 18.5
                                        } else {
                                            num_var = d.details.length * 18.5
                                        }
                                        var dynamic_height = num_var + attrs.nodeHeight + 2;
                                        return dynamic_height;
                                    } else {
                                        return attrs.nodeHeight - 18;
                                    }
                                })
                                .attr("", setCollapsibleSymbolProperty);

                        //hide collapse rect when node does not have children
                        collapsibles.attr("r", function (d) {
                            if (d.children || d._children) return attrs.collapseCircleRadius;
                            return 0;
                        })
                            .attr("height", attrs.collapseCircleRadius)

                        collapsiblesWrapper.append("text")
                            .attr('class', 'text-collapse')
                            .attr("x", attrs.nodeWidth+50)
                            .attr('y', function(d){
                                if (d.details) {
                                    var hasImages = false;
                                    for (var i = 0; i < d.details.length; i++) {
                                        if (d.details[i].includes("data:image") || isImageUrl(d.details[i])) {
                                            hasImages = true;
                                            break;
                                        }
                                    }
                                    var num_var;
                                    if (hasImages) {
                                        num_var = (d.details.length - 1) * 18;
                                    } else {
                                    num_var = d.details.length * 19;
                                    }
                                    var dynamic_height = num_var + attrs.nodeHeight + 9.5;
                                    return dynamic_height;
                                } else {
                                    return attrs.nodeHeight - 15;
                                }
                            })
                            .attr('width', attrs.collapseCircleRadius)
                            .attr('height', attrs.collapseCircleRadius)
                            .style('font-size', attrs.collapsibleFontSize)
                            .attr("text-anchor", "middle")
                            .style('font-family', 'Oracle Sans')
                            .text(function (d) {
                                if (d.children || d._children) return d.collapseText;
                            })

                        collapsiblesWrapper.on("click", click);

                        // Profile Image Display
                        var placeholder = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAOEAAADhCAMAAAAJbSJIAAAATlBMVEWVu9////+Rud6Ntt2LtdyPuN3H2u250emYveDq8fj6/P6zzeeKtNzz9/uiw+LQ4PDd6PTh6/WsyeXL3e/B1uvt8/mfweGvy+be6fTX5PJcXCnCAAAG9UlEQVR4nO2d2XKjMBBFTUvs+2Ji/v9HBznx2MTYBnRlNY7OVM3L1KS4EVKvag4Hh8PhcDgcDofD4XCwgsgnXwgx/k1k+2GwjNIk9U0XlEN1Gv8MZdA1PckPEUpCFEGVe/fkVVAIsXeRgsJTMqPuQlKHJGw/5HYoa05P1F04Ndk+F5KycO7dnCMPd6iRZPrs7bx7W1O5M41+H6/Qp4h73/ZDr0EGK/UpAmn7sZcj1i7gzzLuZRWpX7MDb0n6XWxGajbqUzQ7kKglcA8SqdAS6HkFe4maAj3PtoAXZEvdmMfkrP1UOWgL9LyBsV2kL4BAz/viuxX9rYZwSsLW8vslRKDnlVwlRiCBnhfZljKPqGAKK6bnKUwgU6MoULtQUXJcRAEU6HkMFVIIVRjys4myhiqMGTo2UIEMzxrwS8rwNfURPvctFTe/RuiHTVPYBVE4j+0CM8+NUrjClNdGpBausOWl0MdaQ0XN66iR6INmPGp42XxQdH8Ls0if4AI9j9c+xBsLz+tti7pFO9M9B6/sNyaNOIVVUhHudytY+d5OoVPoFNrHQGjBLbjQK23P09gWNcGIxbctaoIJr41XkP/5nrcwED3xSkXJI1zhkVkE/PFZDFiB+wqzUjd1cIUdr5NGs5ttDl4G/w/kvPHmglmqbXNb8GNiXubQwGHK7Cj9CxXSQw9WyCpbegac12d30MB7MWpeXqmCtlwieUzAbhuiE/u8UvrfZFCFmW05MwjkRqy52XsFNLxgFlj8gMzV2NYyDzCTceS4DaGvKUNbcebjO9lxERS7yOkCLL7gF1dcQJ2mbAUeBKbJdOAXV/wHEyTyCw2vQEIohoHTFUiAwS1ROiXTNxgxT3/mAmAROUaGt2jvRNa78Iyu68b5IP1GMzXMLhE8g1ZakWES8R6tQhurjsuHaPhuA9eg4hebG/eZtec/Y6NC24+9nI1bkf/klitiSywc7mQTfiPWZ6W6XQncIHFvAkeJ65pq090JVGHGcucm4R5QzEOHpXFGfdiPQJrYbLnsSA2n/4mzWsq66aQAotce3DCdRCvjju0gTOGrQvevYQh+9FzjEE2jCanSIIHP8Nwh0f8Ehr+nH4pD8MhPzYPDLymXwkDZ8xq/S8JPrymo490/yz6ofx+sSR3091vuWqCLU5+LSKKsKCfPn0R3jzb+Dvo0KE/x8XiMT2WQ9jPP/2ukZFIWmf1p0ffyzqRzYRDReZy3Gug9++Dy3kewLpLknLzzAbL+qHgQOI8irdkPEbWPQ928WKdRNE9+VhvZOFvl1wuPZTgszyr5hxd2s/5690Jm6YK2hGDhYUhiQcfYMX1ntt+PFpYn2vFUefnDxMKZGnH0tlSjXBH7DYV89ly+bFZk5ro3Zarkutl6ednM2+7RRjblurRc9RaJcn0BLanbphdSjkoVwpdS9F/tnZ/zmneMANtcXEryeijbIAjacqjzral/86Upib/gtI7SsEQjV5rXYfoCtG19nuHMOHBE6XaMlm9MXNlej8FL3oBOCwQGuzV4LKHBRQRfGtmOMaNoYqzANgx12IJvxehgqEvawNS5rZgphxuZ57UVI5UcA1fut2OksQg+g1UHI/Nb0ZdE9TDQ/mZgaoIOBi5GQa+m6WPgcht2qLw+cIWsbIUCbi+YbUMDG5FF7HsL/CMfGX4QlB4JOkg0McxLD/RbamKonh7giyeMIqcL4AjK53bQwD+eAPhiHJoce9Rw82gU0DVk59EosF6NiRmzuoRIgcQpvr9QIteQTab0FmjWVHLz2RQJNOFmW80sQH0sj1LoYWpkXLc+wNELBr6TgwD4rR2GXqkC6JkamBKMADhp2MB3chAAr9TyKRxOwZUReRoLZLXbfpvQPClKIMMUxjewRAaryuEtsCoiu2zwBVhWGD4FGQVsJhijFoUpsIYFA592wAD7QAS/jP4F1EnD1aXBOTW8ehRuQfUr8KvKXABVZxj0dj8C1PPNNIehAOUx2JXwr4CK+X9AIdfQAhZcOIUWQSn8+LP0D3htnx8fMi3MIEszTP025D09Wnp5+43EPbZlSBa80lFVgb9yISjkspBxSGbuIJKMOvsi4y4yOUHCtkjD8n5Ejq/ryYq80/hyvmn+B4msCN67lHFQZO+dqkQkRdPG78ikJnHbCGln1BBJKrrKZEY8r7qC7M6oU7Ofok0jLl6hhmlEaqaUTXn/UTLToEatZl4HaSRfj7Z5M+NqZqIJB629mcRD2IiMy8rNQb7MDk1YViunlyR5VYbNIeO3cvMQCelHhZpBd3wqNcmPaj5dEflSMF63R9C4or6yYlHRhF3QluVQVaeqGsqyDbqwKaLRsgp/XLX9abtHzRbyR8HiLElN3fsEVQ6Hw+FwOBwOh8PxOfwDT/dxGdSpqv0AAAAASUVORK5CYII="

                        // Appending Image to the left of the nodes
                        nodeGroup.append('svg:circle')
                        .attr('cx', 0) 
                        .attr('cy', 0) 
                        .attr('r', 50)  
                        .attr("class", "profile-circle")
                        .style('stroke-width', '1.5px') 
                        .attr('circle-id', function(d){
                            return d.uniqueIdentifier
                        })
                        .style('filter', function (d) {
                            if (typeof bin_dict !== 'undefined' && isNumerical === true) {
                                var value = undoFormatNumber(d.color);  // Undo formatting to get the actual numeric value
                                for (const idx in bin_dict) {
                                    const [start, end] = bin_dict[idx]["bin"].split('-').map(undoFormatNumber);
                                    if (value >= start && value <= end) {
                                        var shadow_color = bin_dict[idx]["color"];
                                        return `drop-shadow(0 0 0.45rem ${shadow_color})`;
                                    }
                                }
                            } else {
                                return 'drop-shadow(0 0 0.45rem grey)';
                            }
                        })
                        .style('visibility', function(d) {
                            const hasImage = d.details.some(detail => isBase64Image(detail) || isImageUrl(detail));
                            return hasImage ? 'visible' : 'hidden';
                        });
                        // Append a clipping path for circular images
                        svg.append('defs')
                            .append('clipPath')
                            .attr('id', 'circle-clip')
                            .append('circle')
                            .attr('cx', 0)
                            .attr('cy', 0) 
                            .attr('r', 50) 

                        nodeGroup.append('svg:image')
                            .attr('x', -100)
                            .attr('y', -50)
                            .attr('width', 200)
                            .attr('height', 100)
                            .attr('id', 'profile-img')
                            .each(function(d) {
                                var profileCircle = d3.select(`circle[circle-id="${d.uniqueIdentifier}"]`)
                                const index = d.details.findIndex(ele => {
                                    if (isBase64Image(ele)) {
                                        return true;
                                    } else if (isImageUrl(ele)){
                                        return true;
                                    }
                                });

                                if (index !== -1) {
                                    const imgSrc = d.details[parseInt(index)];

                                    if (isBase64Image(imgSrc)) {
                                        profileCircle.style('visibility', 'visible')
                                        d3.select(this).attr('xlink:href', imgSrc);
                                    } else {
                                        const img = document.createElement("img");
                                        img.className = 'tileImg';
                                        img.style.height = "100px"
                                        img.crossOrigin = "anonymous";
                                        img.src = imgSrc;

                                        const imageElement = this;

                                        img.onload = function () {
                                            profileCircle.style('visibility', 'visible')
                                            d3.select(imageElement).attr('xlink:href', imgSrc);
                                        };

                                        img.onerror = function () {
                                            profileCircle.style('visibility', 'hidden');
                                        };
                                    }
                                }
                            })
                            .style('object-fit', 'cover')
                            .style('clip-path', 'url(#circle-clip)');

                        // Appending the "Name" into the Rectangle Node
                        nodeGroup.append("text")
                            .attr("x", (attrs.nodeWidth+25) / 2)
                            .attr("y", function(d){
                                if (d.color){
                                    return attrs.nodePadding + 9
                                }
                                else{
                                    return attrs.nodePadding + 11
                                }
                            })
                            .attr('class', 'emp-name')
                            //.attr("text-anchor", "center")
                            .attr("text-anchor", "middle")
                            .text(function (d) {
                                if (d.details && d.details.length > 0) {
                                    if (d.details[0] && (d.details[0].includes("data:image") || isImageUrl(d.details[0]))) {
                                        return d.Id;
                                    }
                                    if (d.color) {
                                        if (d.details.length === 1) {
                                            return d.Id;
                                        } else {
                                            return d.details[1] || d.details[0] || d.Id;
                                        }
                                    } else {
                                        return d.details[0] || d.Id;
                                    }
                                } else if (d.color) {
                                    return d.Id;
                                } else {
                                    return d.Id;
                                }
                            })
                                                                              
                            .call(wrap, attrs.nodeWidth);

                        // Append the "Total Reports:" text into the Rectangle Node
                        nodeGroup.append("text")
                            .attr("x", 110) 
                            .attr("y", function (d){
                                if (d.color){
                                    return dynamic.nodeChildCountTopMargin * 0.7
                                }
                                else{
                                    return dynamic.nodeChildCountTopMargin * 0.8
                                }
                            }) 
                            .attr('class', 'emp-area')
                            .attr("text-anchor", "center")
                            .text('All')
                            .style("font-size", '16px');

                        // Append the Arrow into Rectangle Node
                        nodeGroup.append("text")
                            .attr("x", 0.55*(attrs.nodeWidth))
                            .attr("y", function (d){
                                if (d.color){
                                    return dynamic.nodeChildCountTopMargin * 0.7
                                }
                                else{
                                    return dynamic.nodeChildCountTopMargin * 0.8
                                }
                            }) 
                            .attr('class', 'emp-area')
                            .attr("text-anchor", "center")
                            .text('➔')
                            .style("font-size", '16px');

                        // Append the Value of All Children into the Rectangle Node
                        nodeGroup.append("text")
                            .attr("x", 0.55*(attrs.nodeWidth)+43) 
                            .attr("y", function (d){
                                if (d.color){
                                    return dynamic.nodeChildCountTopMargin * 0.7
                                }
                                else{
                                    return dynamic.nodeChildCountTopMargin * 0.8
                                }
                            }) 
                            .attr('class', 'emp-area')
                            .attr("text-anchor", "center")
                            .text(function (d) {
                                if (d.children || d._children) {
                                    // Check if the node is the last node in the family tree
                                    const isLastNode = !d.children && !d._children && (!d.parent || (!d.parent.children && !d.parent._children));
                                    return isLastNode ? "0" : getChildrenCount(d);
                                }
                                else{
                                    return "0"
                                }
                            })
                            .style("font-size", '16px');

                        // Append "Direct:" Text into the Rectangle Node
                        nodeGroup.append("text")
                            .attr("x", 104) 
                            .attr("y", function (d){
                                if (d.color){
                                    return dynamic.nodeChildCountTopMargin * 1
                                }
                                else{
                                    return dynamic.nodeChildCountTopMargin * 1.07
                                }
                            }) 
                            .attr('class', 'emp-area')
                            .attr("text-anchor", "center")
                            .text('Direct')
                            .style("font-size", '16px');

                        // Append the Arrow into Rectangle Node
                        nodeGroup.append("text")
                            .attr("x", 0.55*(attrs.nodeWidth)) 
                            .attr("y", function (d){
                                if (d.color){
                                    return dynamic.nodeChildCountTopMargin * 1
                                }
                                else{
                                    return dynamic.nodeChildCountTopMargin * 1.07
                                }
                            }) 
                            .attr('class', 'emp-area')
                            .attr("text-anchor", "center")
                            .text('➔')
                            .style("font-size", '16px');

                        // Append the Value of Direct Reports into the Rectangle Node
                        nodeGroup.append("text")
                            .attr("x", 0.55*(attrs.nodeWidth)+43) 
                            .attr("y", function (d){
                                if (d.color){
                                    return dynamic.nodeChildCountTopMargin * 1
                                }
                                else{
                                    return dynamic.nodeChildCountTopMargin * 1.07
                                }
                            }) 
                            .attr('class', 'emp-area')
                            .attr("text-anchor", "center")
                            .text(function (d) {
                                if (d.children || d._children) {
                                    // Check if the node is the last node in the family tree
                                    const isLastNode = !d.children && !d._children && (!d.parent || (!d.parent.children && !d.parent._children));
                                    return isLastNode ? "0" : (d.children ? d.children.length : (d._children ? d._children.length : 0));
                                }
                                else{
                                    return "0"
                                }
                            })
                            .style("font-size", '16px');

                        // Category (Details) Positioning
                        const detailsTextGroup = nodeGroup.append("g")
                            .attr("class", "details-text-group")
                            .attr("transform", function (d) {
                                return `translate(${25+attrs.nodeWidth*0.4}, ${(dynamic.nodeTextLeftMargin*2 - 8)})`;
                            })
                        
                        function appendDetailsText(detailsTextGroup, dynamic) {
                            detailsTextGroup.each(function(d) {
                                let dictionary = updateDetails(d);
                                let strings = [];
                                // Detail Formatting
                                for (var key in dictionary) {
                                    strings.push(key + "   ➔   " + dictionary[key]);
                                }
                        
                                const lineHeight = 20; 

                                d3.select(this).selectAll("text.details-item").remove();

                                d3.select(this)
                                    .selectAll("text.details-item") 
                                    .data(strings)
                                    .enter()
                                    .append("text")
                                    .attr("class", "details-item")
                                    .attr("x", 20) 
                                    .attr("y", function(_, i) { 
                                        var y_pos = i * lineHeight + 40
                                        return y_pos;
                                    }) 
                                    .style("font-size", "16px")
                                    .style("fill", "#4f5254")
                                    .style("text-anchor", "middle")
                                    .text(function(d) {
                                        return d;
                                    });
                            });
                        }

                        appendDetailsText(detailsTextGroup, dynamic);

                        // Transition nodes to their new position.
                        // Edit node posiitons here 
                        var nodeUpdate = node.transition()
                            .duration(attrs.duration)
                            .attr("transform", function (d) {
                                var detailsLen = d.details && Array.isArray(d.details) ? d.details.length : 0;
                                
                                var baseMultiplier = 1.3;
                                var increment = 0.15;
                            
                                // Calculate the multiplier based on the conditions (dynamic)
                                var multiplier = detailsLen >= 4 ? baseMultiplier + (detailsLen - 4) * increment : 1.25;
                            
                                return "translate(" + d.x + "," + (d.y * multiplier) + ")";
                            });

                        //todo replace with attrs object
                        nodeUpdate.select("rect")
                            .attr("width", attrs.nodeWidth+50)
                            .attr("height", function(d){
                                if (d.details) {
                                    var hasImages = false;
                                    for (var i = 0; i < d.details.length; i++) {
                                        if (d.details[i].includes("data:image") || isImageUrl(d.details[i])) {
                                            hasImages = true;
                                            break;
                                        }
                                    }
                                    var num_var;
                                    if (hasImages) {
                                        num_var = (d.details.length - 1) * 19
                                    } else {
                                        num_var = d.details.length * 19
                                    }
                                    var dynamic_height = num_var + attrs.nodeHeight + 5;
                                    return dynamic_height;
                                } else {
                                    return attrs.nodeHeight;
                                }
                            })
                            .attr('rx', 6)
                            .attr("stroke", function (d) {
                                if (!d.color) {
                                    return '#ccc'
                                }
                                else if (typeof bin_dict !== 'undefined' && (d.color).isNumerical === true) {
                                    // Check if the value inside d.color falls within a certain range of values in bin_dict
                                    var value = undoFormatNumber(d.color);
                                    for (const idx in bin_dict) {
                                        const [start, end] = bin_dict[idx]["bin"].split('-').map(undoFormatNumber);
                                        if (value >= start && value <= end) {
                                            return bin_dict[idx]["color"];
                                        }
                                    }
                                }
                                 else {
                                    return d.color //? colorScale(d.color, 0.8) : attrs.nodeStroke;
                                }
                            })
                            .attr('stroke-width', function (d) {
                                if (param && d.uniqueIdentifier == param.locate) {
                                    return 6;
                                }
                                return attrs.nodeStrokeWidth
                            })
                            .attr("transform", function (d) {
                                return "translate(" + 0 + "," + 0 + ")";
                            })

                        // Transition exiting nodes to the parent's new position.
                        var nodeExit = node.exit().transition()
                            .duration(attrs.duration)
                            .attr("transform", function (d) {
                                return "translate(" + source.x + "," + source.y + ")";
                            })
                            .remove();

                        nodeExit.select("rect")
                            .attr("width", attrs.nodeWidth)
                            .attr("height", attrs.nodeHeight)

                        // Update the links…
                        var link = svg.selectAll("path.link")
                            .data(links, function (d) {
                                return d.target.id;
                            })
                            .attr("display", function(){
                                if (clicked && link_viz === false){
                                    return "none"
                                }
                                else{
                                    return "block"
                                }
                            })

                        // Enter any new links at the parent's previous position.
                        link.enter().insert("path", "g")
                            .attr("class", "link")
                            .attr("x", attrs.nodeWidth / 2)
                            .attr("y", attrs.nodeHeight / 2)
                            .attr("d", function (d) {
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
                            .attr("d", diagonal);

                        // Transition exiting nodes to the parent's new position.
                        link.exit().transition()
                            .duration(attrs.duration)
                            .attr("d", function (d) {
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
                        nodes.forEach(function (d) {
                            d.x0 = d.x;
                            d.y0 = d.y;
                        });

                        if (param && param.locate) {
                            var x;
                            var y;

                            nodes.forEach(function (d) {
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

                            nodes.forEach(function (d) {
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

                        // -------------------------------------------------- Expand All / Collapse All / Hide Lines Buttons  --------------------------------------------------//
                        function findTopParent(node) {
                            let currentNode = node;
                            while (currentNode.parent) {
                                currentNode = currentNode.parent;
                            }
                            return currentNode;
                        }

                        function collapseAll(node) {      
                            hideLoadingAnimation();              
                            const topParent = findTopParent(node);
                            const stack = [topParent];
                            while (stack.length) {
                              const currentNode = stack.pop();
                          
                              if (currentNode.children) {
                                currentNode.children.forEach((child) => {
                                  stack.push(child);
                                });
                          
                                currentNode._children = currentNode.children;
                                currentNode.children = null;
                                currentNode.collapseText = "+"; 
                              }
                            }
                        
                            setTimeout(() => {
                                svg.transition().duration(1500).call(zoom.translate([355, 250]).scale(1).event);
                            }, 100);
                            update(node); 
                        }

                          function searchCollapse(node) {     
                            hideLoadingAnimation();              
                            const topParent = findTopParent(node);
                            const stack = [topParent];
                            while (stack.length) {
                              const currentNode = stack.pop();
                          
                              if (currentNode.children) {
                                currentNode.children.forEach((child) => {
                                  stack.push(child);
                                });
                          
                                currentNode._children = currentNode.children;
                                currentNode.children = null;
                                currentNode.collapseText = "+"; 
                              }
                            };
                            const links = d3.selectAll('path.link');
                            links.remove();
                            links.transition().duration(attrs.duration).attr("d", function (d) {
                                    
                                    const sourceX = d.source.x + attrs.nodeWidth / 2; 
                                    const sourceY = d.source.y + attrs.nodeHeight / 2;
                                    const targetX = d.target.x + attrs.nodeWidth / 2; 
                                    const targetY = d.target.y + attrs.nodeHeight / 2;

                                    
                                    return `M${sourceX},${sourceY}L${targetX},${targetY}`;
                            });
                            update(node); 
                        }
                          
                          function expandAll(node) {
                            /*const startTime = performance.now();*/
                            collapseAll(source);
                            showLoadingAnimation();
                            const stack = [node];
                            let expandedNodes = 0;
                            const textElement = document.querySelector('.progress');
                            const estTimeText = document.querySelector('.estTime');
                            const loadingScreen = d3.select('.overlay');
                        
                            const processNode = () => {
                                if (stack.length > 0) {
                                    const currentNode = stack.pop();
                        
                                    if (currentNode._children) {
                                        currentNode._children.forEach((child) => {
                                            stack.push(child);
                                        });
                        
                                        currentNode.children = currentNode._children;
                                        currentNode._children = null;
                                        currentNode.collapseText = "-";
                                        expandedNodes++;
                        
                                        const progress = (expandedNodes / nRows) * 100;
                                        textElement.textContent = `${progress.toFixed(1)}%`;
                                        estTimeText.textContent = `${expandedNodes} of ${nRows} nodes expanded`;
                                    }
                        
                                    setTimeout(processNode, 0);
                                } else {
                                    /*const endTime = performance.now();
                                    const elapsedTime = endTime - startTime;*/
                                    loadingScreen.style('display', 'none');
                                    hideLoadingAnimation();
                        
                                    setTimeout(() => {
                                        svg.transition().duration(1500).call(zoom.translate([425, 125]).scale(0.5).event);
                                    }, 120);
                                    update(node);
                                }
                            };
                        
                            processNode();
                        }
                        
                        /** Multi-Threading Attempt, using Worker script **/
                        /*function expandAll(node) {
                            require(['d3'], function (d3) {
                                const svg = d3.select('.svg-class');
                                const createWorker = (fn) => {
                                const blob = new Blob([`(${fn.toString()})()`], { type: 'application/javascript' });
                                const url = URL.createObjectURL(blob);
                                return new Worker(url);
                                };
                            
                                const workerScript = () => {
                                    const {node, d3, svg} = e.data;
                                    function collapseAll(node) {                    
                                        const topParent = findTopParent(node);
                                        const stack = [topParent];
                                        while (stack.length) {
                                        const currentNode = stack.pop();
                                    
                                        if (currentNode.children) {
                                            currentNode.children.forEach((child) => {
                                            stack.push(child);
                                            });
                                    
                                            currentNode._children = currentNode.children;
                                            currentNode.children = null;
                                            currentNode.collapseText = "+"; 
                                        }
                                        }
                                    
                                        //update(node); 
            
                                        setTimeout(() => {
                                            svg.transition().duration(1500).call(zoom.translate([550, 250]).scale(1).event);
                                        }, 100);
                                    }
                                    function findTopParent(node) {
                                        let currentNode = node;
                                        while (currentNode.parent) {
                                            currentNode = currentNode.parent;
                                        }
                                        return currentNode;
                                    }
                            
                                self.onmessage = function (e) {
                                    const node = e.data;
                                    collapseAll(node); 
                                    const stack = [node];

                                    while (stack.length) {
                                    const currentNode = stack.pop();
                                    if (currentNode._children) {
                                        currentNode._children.forEach((child) => {
                                        stack.push(child);
                                        });
                                
                                        currentNode.children = currentNode._children;
                                        currentNode._children = null;
                                        currentNode.collapseText = "-";
                                    }
                                    }
                                    const detailsContainer = d3.select(".details-text-group"); 
                                    appendDetailsText(detailsContainer, dynamic); 
                                    //update(node); 
                                    setTimeout(() => {svg.transition().duration(1500).call(zoom.translate([600, 100])
                                    .scale(0.25).event)},120);
                                    self.postMessage('Done');
                                    };
                                };
                            
                                const worker = createWorker(workerScript);
                            
                                if (typeof Worker !== 'undefined') {
                                worker.onmessage = function (e) {
                                    if (e.data === 'Done') {
                                    // Worker has finished its task
                                    console.log('Worker has completed its task.');
                                    }
                                };
                            
                                worker.postMessage({node,d3,svg}); // Start the worker
                                } else {
                                // Fallback to the main thread execution
                                collapseAll(node);
                                    const stack = [node];

                                    while (stack.length) {
                                    const currentNode = stack.pop();
                                    if (currentNode._children) {
                                        currentNode._children.forEach((child) => {
                                        stack.push(child);
                                        });
                                
                                        currentNode.children = currentNode._children;
                                        currentNode._children = null;
                                        currentNode.collapseText = "-";
                                    }
                                    }
                                    const detailsContainer = d3.select(".details-text-group"); 
                                    appendDetailsText(detailsContainer, dynamic); 
                                    //update(node); 
                                    setTimeout(() => {svg.transition().duration(1500).call(zoom.translate([600, 100])
                                    .scale(0.25).event)},120);
                                    }
                            });
                        }*/
                        
                        /*async function expandAll(node) {
                            const levels = [];
                            const startTime = performance.now();
                            const rootLevel = 0;
                            node = findTopParent(node);
                            levels[rootLevel] = [node];
                            let expandedNodes = 0;
                            const expandLevel = async (level) => {
                                const nodesToExpand = levels[level];
                                const arrLength = nodesToExpand.length;
                                const textElement = document.querySelector('.progress')
                                const estTimeText = document.querySelector('.estTime')

                                if (!nodesToExpand || nodesToExpand.length === 0) {
                                    return;
                                }
                        
                                // Determine batch size based on the number of nodes at this level
                                let batchSize;
                                let baseDelay;
                                if (arrLength > 500) {
                                    batchSize = 45
                                    baseDelay = 400;
                                } else if (arrLength > 1000) {
                                    batchSize = 45
                                    baseDelay = 700;
                                } else if (arrLength > 3000) {
                                    batchSize = 45
                                    baseDelay = 1000;
                                } else {
                                    batchSize = arrLength;
                                }
                        
                                // Divide nodes into batches based on the batch size
                                for (let i = 0; i < arrLength; i += batchSize) {
                                    const batch = nodesToExpand.slice(i, i + batchSize);
                        
                                    // Expand nodes in the batch in parallel
                                    await Promise.all(
                                        batch.map(async (node) => {
                                            node.children = node._children;
                                            node._children = null;
                                            node.cCollapseText = "-";
                                            update(node);
                                            expandedNodes++
                                        })
                                    );

                                    const progress = (expandedNodes / nRows) * 100;
                                    textElement.textContent = `${progress.toFixed(1)}%`;
                                    estTimeText.textContent = `${expandedNodes} of ${nRows} nodes expanded`;
                        
                                    await new Promise((resolve) => setTimeout(resolve, 3000));
                                }
                        
                                // Prepare the next level for expansion
                                levels[level + 1] = [];
                                for (const node of nodesToExpand) {
                                    if (node.children) {
                                        levels[level + 1] = levels[level + 1].concat(node.children);
                                    }
                                }
                        
                                await expandLevel(level + 1);
                            };
                        
                            collapseAll(node);
                            showLoadingAnimation();
                            await expandLevel(rootLevel);
                            hideLoadingAnimation();
                            const endTime = performance.now();
                            const elapsedTime = (endTime - startTime)/1000;
                            setTimeout(() => {
                                svg.transition().duration(1500).call(zoom.translate([425, 125]).scale(0.5).event);
                            }, 120);
                            console.log(`Expand all function completed in ${elapsedTime} seconds`);
                        }*/
                        
                        var link_viz = false;
                        var clicked = false;

                        // Hide Path Links Between Nodes (On-Click)
                        function hideLines(){
                            clicked = true
                            if (link_viz === false){
                                svg.selectAll("path.link").attr("display", "none")
                                link_viz = true;
                            }
                            else{
                                svg.selectAll("path.link").attr("display", "block")
                                link_viz = false;
                            }
                        }

                        // Helper function to check if a string is a valid image URL / Base64 Formatted
                        function isImageUrl(url) {
                            return /\.(png|jpe?g|gif|svg)$/i.test(url);
                        }

                        function isBase64Image(url) {
                            return url.startsWith('data:image');
                        }

                        // Function to update the details rectangle and text
                        function updateDetails(item) {
                            let dictionary = {}; // Initialize an empty dictionary
                            for (var i in item.details) {
                                if (item.details[i].includes("data:image") || isImageUrl(item.details[i])) {
                                    continue;
                                }
                                else {
                                    if (i < displayNames.length) {
                                        dictionary[displayNames[i]] = item.details[i];
                                    }
                                    else{
                                        console.log("Error has occurred")
                                    }
                                }
                            }

                            return dictionary;
                        }

                        function equalToEventTarget() {
                            return this == d3.event.target;
                        }

                        d3.select("#canvas_" + cId)
                            .on("click", function () {
                            var outside = tooltip.filter(equalToEventTarget).empty();
                            if (outside) {
                                tooltip.style('opacity', '0').style('display', 'none');
                            }})
                            .style("width",)

                        $(document).on('click', function (e) {
                            tooltip.style('opacity', '0').style('display', 'none');
                        });
                    }

                    // Toggle children on click.
                    function click(d) {
                        d3.select(this).select("text").text(function (dv) {

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
                        //console.log("here", d3.event.translate, d3.event.scale);
                        svg.attr("transform",
                            "translate(" + d3.event.translate + ")" +
                            " scale(" + d3.event.scale + ")");
                    }

                    // #############################   Function Area #######################
                    function wrap(text, width) {

                        text.each(function () {
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
                            element.children.forEach(function (v) {
                                addPropertyRecursive(propertyName, propertyValueFunction, v)
                            })
                        }
                        if (element._children) {
                            element._children.forEach(function (v) {
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
                                childs.forEach(function (v) {
                                    count++;
                                    countChilds(v);
                                })
                            }
                        }
                    }

                    function reflectResults(results) {
                        var htmlStringArray = results.map(function (result) {
                            var strVar = "";
                            strVar += "         <div class=\"list-item\">";
                            strVar += "          <a >";
                            strVar += "            <div class=\"description\">";
                            strVar += "              <p class=\"name\">" + result.details[0] + "<\/p>";
                            strVar += "               <p class=\"position-name\">" + result.details[1] + "<\/p>";
                            strVar += "            <\/div>";
                            strVar += "            <div class=\"buttons\">";
                            strVar += "              <a target='_blank' href='" + result.profileUrl + "'><button class='btn-search-box btn-action'>View Profile<\/button><\/a>";
                            strVar += "              <button class='btn-search-box btn-action btn-locate' onclick='params.funcs.locate(" + result.uniqueIdentifier + ")'>Locate <\/button>";
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
                            .each("end", function () {
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
                                childUsers.forEach(function (childUser) {
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
                            d._children.forEach(function (ch) {
                                ch.parent = d;
                                findmySelf(ch);
                            })
                        } else if (d.children) {
                            d.children.forEach(function (ch) {
                                ch.parent = d;
                                findmySelf(ch);
                            });
                        };

                    }

                    function locateRecursive(d, id) {
                        if (d.uniqueIdentifier == id) {
                            expandParents(d);
                        } else if (d._children) {
                            d._children.forEach(function (ch) {
                                ch.parent = d;
                                locateRecursive(ch, id);
                            })
                        } else if (d.children) {
                            d.children.forEach(function (ch) {
                                ch.parent = d;
                                locateRecursive(ch, id);
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

                        update(attrs.root, { centerMySelf: true });
                    }

                    //locateRecursive
                    function locate(id) {
                        /* collapse all and expand logged user nodes */
                        if (!attrs.root.children) {
                            if (!attrs.root.uniqueIdentifier == id) {
                                attrs.root.children = attrs.root._children;
                            }
                        }
                        if (attrs.root.children) {
                            attrs.root.children.forEach(collapse);
                            attrs.root.children.forEach(function (ch) {
                                locateRecursive(ch, id)
                            });
                        }

                        update(attrs.root, { locate: id });
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
                        selectors.forEach(function (selector) {
                            var elements = getAll(selector);
                            elements.forEach(function (element) {
                                element.style.display = displayProp;
                            })
                        });
                    }

                    function set(selector, value) {
                        var elements = getAll(selector);
                        elements.forEach(function (element) {
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
        OrgChartViz.prototype.render = function (oTransientRenderingContext) {
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
        OrgChartViz.prototype.resizeVisualization = function (oVizDimensions, oTransientVizContext) {
            var oTransientRenderingContext = this.createRenderingContext(oTransientVizContext);
            this._render(oTransientRenderingContext);
        };

        /**
         * Re-render the visualization when settings changes
         */
        OrgChartViz.prototype._onDefaultSettingsChanged = function () {
            var oTransientVizContext = this.assertOrCreateVizContext();
            var oTransientRenderingContext = this.createRenderingContext(oTransientVizContext);
            this.render(oTransientRenderingContext);
            this._setIsRendered(true);
        };


        OrgChartViz.prototype._publishMarkEvent = function (oDataLayout, eMarkContext) {

            $(function () {
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
        OrgChartViz.prototype._addVizSpecificMenuOptions = function (oTransientVizContext, sMenuType, aResults, contextmenu, evtParams, oTransientRenderingContext) {
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

        OrgChartViz.prototype._addVizSpecificPropsDialog = function (oTabbedPanelsGadgetInfo) {

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

        OrgChartViz.prototype._handlePropChange = function (sGadgetID, oPropChange, oViewSettings, oActionContext) {
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

            if (sGadgetID === "zoomValue") {
                if (jsx.isNull(conf.styleDefaults)) {
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
        OrgChartViz.prototype._buildSelectedItems = function (oTransientRenderingContext) {
            var oViz = this;
            var oDataLayout = oTransientRenderingContext.get(dataviz.DataContextProperty.DATA_LAYOUT);
            var oMarkingService = this.getMarkingService();

            function fMarksReadyCallback() {
                oViz.clearSelectedItems();
                var aSelectedItems = oViz.getSelectedItems();
                //var selectedMap = new Map();

                if (!oViz.isStarted()) {
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
        OrgChartViz.prototype.onHighlight = function () {
            var oTransientVizContext = this.assertOrCreateVizContext();
            var oTransientRenderingContext = this.createRenderingContext(oTransientVizContext);
            this._buildSelectedItems(oTransientRenderingContext);
        };

        OrgChartViz.prototype._OnDefaultColorSettingsChange = function(oClientEvent){
            var oTransientVizContext = this.createVizContext();
            if(!this._handleVizPlaceholderState(oTransientVizContext)){
                //this.readyForData({aEventTriggers:[DEFAULT_COLOR_SETTINGS_CHANGED_EVENT_TRIGGER]});
                var oTransientVizContext = this.assertOrCreateVizContext();
                var oTransientRenderingContext = this.createRenderingContext(oTransientVizContext);
                this._render(oTransientRenderingContext);
            }
        };

        /**
         * Override _doInitializeComponent in order to subscribe to events
         */
        OrgChartViz.prototype._doInitializeComponent = function () {
            OrgChartViz.superClass._doInitializeComponent.call(this);

            //this.subscribeToEvent(events.types.DEFAULT_SETTINGS_CHANGED, this._onDefaultSettingsChanged, "**");
            this.subscribeToEvent(events.types.INTERACTION_HIGHLIGHT, this.onHighlight, this.getViewName() + "." + events.types.INTERACTION_HIGHLIGHT);
            //this.subscribeToEvent(events.types.DEFAULT_COLOR_SETTINGS_CHANGED, this._onDefaultColorsSettingsChange, "**");
            //this.initializeLegendAndVizContainer();
        };


        /**
         * Factory method declared in the plugin configuration
         * @param {string} sID Component ID for the visualization
         * @param {string=} sDisplayName Component display name
         * @param {string=} sOrigin Component host identifier
         * @param {string=} sVersion
         * @returns {module:com-company-orgchartviz-v2/orgChartViz.OrgChartViz}
         * @memberof module:com-company-orgchartviz-v2/orgChartViz
         */
        orgChart.createClientComponent = function (sID, sDisplayName, sOrigin) {
            // Argument validation done by base class
            return new OrgChartViz(sID, sDisplayName, sOrigin, OrgChartViz.VERSION);
        };

        return orgChart;
    });