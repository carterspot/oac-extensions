/********************** Dumbbell viz custom plugin **************/

/**********************Step 1: Defining the required libraries ***************/

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
        'ojL10n!com-company-dumbbellviz/nls/messages',
        'obitech-application/extendable-ui-definitions',
        'obitech-reportservices/data',
        'd3v6js',                                                //D3 V6 library
        'knockout',
        'ojs/ojattributegrouphandler',  
        'obitech-reportservices/data',
        'obitech-framework/messageformat',
        'skin!css!com-company-dumbbellviz/dumbbellVizstyles'],
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

   var MODULE_NAME = 'com-company-dumbbellviz/dumbbellViz';

   //Param validation to detect cyclical dependencies (ignore modules not used in resource arguments)
   jsx.assertAllNotNullExceptLastN(arguments, "dumbbellViz.js arguments", 2);

   //var _logger = new logger.Logger(MODULE_NAME);

   // The version of our Plugin
   DumbbellViz.VERSION = "1.0.0";

   /**
    * The implementation of the dumbbellViz visualization.
    * 
    * @constructor
    * @param {string} sID
    * @param {string} sDisplayName
    * @param {string} sOrigin
    * @param {string} sVersion
    * @extends {module:obitech-report/visualization.Visualization}
    * @memberof module:com-company-dumbbellviz/dumbbellViz#
    */
   var yText =[];
   var xText =[];
   var restooltip =[];
   var res=[];
   function DumbbellViz(sID, sDisplayName, sOrigin, sVersion) {
      // Argument validation done by base class
      DumbbellViz.baseConstructor.call(this, sID, sDisplayName, sOrigin, sVersion);
      var duration = '1';
            var xAxis = 'Off';
            var displayLabel = 'On';
            var topN = '';
            var value_panel = '';
            var tabInfo = '';
            var groupInfo = '';
            var yMin = 0, yMax = 0;
            var xDisplayName ='', yDisplayName='';
            var rowDisplayNames=[];
            var tArray = [];
            var legendItems = new Map();
            var timeArray = [];
            var cID = '';
            var ColorList = '';
            var p1color = '';
            var p2color = '';
            //var aggregate = 'None';

            this.Config = {
                duration: '1',
                topN: '',
                xAxis: 'On',
                displayLabel: 'On',
                yMin: 0,
                yMax: 0,
                c_title:'Auto',
                xDisplayName: '',
                yDisplayName: '',
                rowDisplayNames: new Map(),
                tArray: [],
                legendItems: new Map(),
                legendOption : 'Off',
                timeArray: [],
                cID: '',
                ColorList: '',
                p1color: '',
                p2color: ''
            }
             
            /************************************ JS Object Accesssors using Getters and Setters ***********/
            this._saveSettings = function() {
                this.getSettings().setViewConfigJSON(dataviz.SettingsNS.CHART, this.Config);
            };

            this.loadConfig = function (){
                var conf = this.getSettings().getViewConfigJSON(dataviz.SettingsNS.CHART) || {};
                if (conf.duration) this.Config.duration = conf.duration;
                if (conf.xAxis) this.Config.xAxis = conf.xAxis;
                if (conf.topN) this.Config.topN = conf.topN;
                if (conf.yMin) this.Config.yMin = conf.yMin;
                if (conf.yMax) this.Config.yMax = conf.yMax;
                if (conf.displayLabel) this.Config.displayLabel = conf.displayLabel;
                if (conf.c_title) this.Config.c_title = conf.c_title;
                if (conf.xDisplayName) this.Config.xDisplayName = conf.xDisplayName;
                if (conf.yDisplayName) this.Config.yDisplayName = conf.yDisplayName;
                if (conf.rowDisplayNames) this.Config.rowDisplayNames = conf.rowDisplayNames;
                if (conf.tArray) this.Config.tArray = conf.tArray;
                if (conf.legendItems) this.Config.legendItems = conf.legendItems;
                if (conf.legendOption) this.Config.legendOption=conf.legendOption;
                if (conf.timeArray) this.Config.timeArray = conf.timeArray;
                if (conf.cID) this.Config.cID = conf.cID;
                if (conf.ColorList) this.Config.ColorList = conf.ColorList;
                if (conf.p1color) this.Config.p1color = conf.p1color;
                if (conf.p2color) this.Config.p2color = conf.p2color;

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
            this.getLegendOption = function(){
                return(this.Config.legendOption);
            };

            this.setLegendOption = function (o){
                this.Config.legendOption = o;
                this._saveSettings();
            };

            this.getColorList = function(){
                return(this.Config.ColorList);
            };

            this.setColorList = function (o){
                this.Config.ColorList = o;
            };


            this.getTimeArray = function(){
                return(this.Config.timeArray);
            };

            this.setTimeArray = function (o){
                this.Config.timeArray = o;
            };

             this.getYMin = function(){
                return(this.Config.yMin);
            };

            this.setYMin = function (o){
                this.Config.yMin = o;
            };


            this.getCID = function(){
                return(this.Config.cID);
            };

            this.setCID = function (o){
                this.Config.cID = o;
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

            this.getP1color = function(){
                return(p1color);
            };

            this.setP1color = function (o){
                p1color = o;
            };
            this.getP2color = function(){
                return(p2color);
            };

            this.setP2color = function (o){
                p2color = o;
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
   jsx.extend(DumbbellViz, dataviz.DataVisualization);
   var pointSetValue;
   /**
    * Called whenever new data is ready and this visualization needs to update.
    * @param {module:obitech-renderingcontext/renderingcontext.RenderingContext} oTransientRenderingContext
    */

   /********************************** Generate Data Function *****************/

    DumbbellViz.prototype._generateData = function(oDataLayout, oTransientRenderingContext){
      
      //var jsonData = "[{\"y_a\": 100,\"y_b\": 800,\"x\": 5},{\"y_a\": 300,\"y_b\": 600,\"x\": 15},{\"y_a\": 400,\"y_b\": 500,\"x\": 25}]";
      //var oData = JSON.parse(jsonData);   
      var oDataModel = this.getRootDataModel();
            if(!oDataModel || !oDataLayout){
                return;
            }
       
            this.setRowDisplayNames(new Map());
            var aAllMeasures = oDataModel.getColumnIDsIn(datamodelshapes.Physical.DATA);
            yText = aAllMeasures;
            
            var nMeasures = aAllMeasures.length;
            var nRows = oDataLayout.getEdgeExtent(datamodelshapes.Physical.ROW);
            var nRowLayerCount = oDataLayout.getLayerCount(datamodelshapes.Physical.ROW);
            var nCols = oDataLayout.getEdgeExtent(datamodelshapes.Physical.COLUMN);
            var nColLayerCount = oDataLayout.getLayerCount(datamodelshapes.Physical.COLUMN);
            var oDataLayoutHelper = oTransientRenderingContext.get(dataviz.DataContextProperty.DATA_LAYOUT_HELPER);

            var catPoints = []; //to get red, blue and grey points


            /************* Get the display names of the rows ********************/

           for(var nRow = 0; nRow < nRowLayerCount; nRow++){
                var rowKey = oDataLayoutHelper.getLogicalEdgeName(datamodelshapes.Physical.ROW, nRow);
                var displayName = oDataLayout.getLayerMetadata(datamodelshapes.Physical.ROW, nRow, data.LayerMetadata.LAYER_DISPLAY_NAME);
                this.getRowDisplayNames().set(rowKey, {order: nRow, name: displayName});
                if(rowKey == "row"){
                    this.setXDisplayName(displayName);
                }
            }
             
               var legendItems = new Map();
               var outputMap = [];
               var xSet = new Set(), xArray;

               var xValue =0;
               for(var nRow = 0; nRow < Math.max(nRows, 1); nRow++) {
                var row = "", colorObj, color = "", tooltip;
                var point = "";
                var value = parseFloat(oDataLayout.getValue(datamodelshapes.Physical.DATA, nRow, 0));
                for (var nRowLayer = 0; nRowLayer < Math.max(nRowLayerCount, 1); nRowLayer++) {
                    var rowType = oDataLayoutHelper.getLogicalEdgeName(datamodelshapes.Physical.ROW, nRowLayer);
                    
                    /***************** switch case for various rowtype based on grammar selection***************/

                    switch (rowType) {                
                        case "row":
                            row = row!="" ? row + ", " +oDataLayout.getValue(datamodelshapes.Physical.ROW, nRowLayer, nRow, false)
                                    : oDataLayout.getValue(datamodelshapes.Physical.ROW, nRowLayer, nRow, false);
                           xSet.add(row);
                            break;
                        case "detail":
                            point = oDataLayout.getValue(datamodelshapes.Physical.ROW, nRowLayer, nRow, false);
                            catPoints.push(oDataLayout.getValue(datamodelshapes.Physical.ROW, nRowLayer, nRow, false));
                            legendItems.set(point, '');
                            break;
                        case "size":
                         size = parseFloat(oDataLayout.getValue(datamodelshapes.Physical.ROW, nRowLayer, nRow, false));
                            break;
                    }
                }
                this.setLegendItems(legendItems);
                var aOutput =[];
            
                if(isNaN(row))
                {
                   aOutput = {xValue: row, y: value, point: point, z: value, row: nRow};
                }
                else
                {
                 aOutput = {xValue: row, y: value, point: point, z: value, row: nRow};
                }
                outputMap.push(aOutput);
                res = outputMap;
            }
            
            const pointSet = new Set(catPoints);
            this.setP1color([...pointSet.values()][0]);
            this.setP2color([...pointSet.values()][1]);
            xArray = Array.from(xSet);

            pointSetValue = pointSet;
           var arr =[];
            if (outputMap){
               var result = [];

                for(var i = 0; i<= outputMap.length-1; i++)
                {
                  for(var j =i+1; j<= outputMap.length-1; j++)
                  {
                     if(outputMap[i].xValue == outputMap[j].xValue)
                     {  
                        if(outputMap[i].y == null || outputMap[i].y == "") 
                        { 
                            outputMap[i].y = 0
                        }
                        if(outputMap[j].y == null || outputMap[j].y == "") 
                        { 
                            outputMap[j].y = 0
                        }
                                               
                        result.push({
                        "x" :xArray.indexOf(outputMap[i].xValue),
                        "xValue": outputMap[i].xValue,
                        "y_a" :outputMap[i].y,
                        "y_b" :outputMap[j].y,
                        "p1" :outputMap[i].point,
                        "p2" :outputMap[j].point,
                        "z_a" :outputMap[i].z,
                        "z_b" :outputMap[j].z,
                        "row_a" : outputMap[i].row,
                        "row_b" : outputMap[j].row
                     });
                                   
                }
            }
        } 
                console.log(result);
        
                restooltip = result;
                return result;
                
                
    }
            else
                return null;
}


 /****************************************** Render Function ******************************/

   DumbbellViz.prototype._render = function(oTransientRenderingContext) {
      try {
        this.loadConfig();
         // Note: all events will be received after initialize and start complete.  We may get other events
         // such as 'resize' before the render, i.e. this might not be the first event.

         // Retrieve the data object for this visualization
         var oDataLayout = oTransientRenderingContext.get(dataviz.DataContextProperty.DATA_LAYOUT);
         if (!oDataLayout)
                    return
        var oData = this._generateData(oDataLayout, oTransientRenderingContext);
                    if(!oData) {
                       return;
                       }           
         // Determine the number of records available for rendering on ROW
         // Because we specified that Category should be placed on ROW in the data model handler,
         // this returns the number of rows for the data in Category.
         var nRows = oDataLayout.getEdgeExtent(datamodelshapes.Physical.ROW);
         
         // Retrieve the root container for our visualization.  This is provided by the framework.  It may not be deleted
         // but may be used to render.

         /************************* the HTML part ********************/

         var elContainer = this.getContainerElem();
         var sVizContainerId = this.getSubElementIdFromParent(this.getContainerElem(), "hvc");
         var pane = sVizContainerId.substring(sVizContainerId.indexOf("view")+5,sVizContainerId.indexOf("pane"));
         var conetentPane = sVizContainerId.substring(sVizContainerId.indexOf("contentpane_")+12,sVizContainerId.indexOf("vizCont")-1);
         var cId = pane+"_"+conetentPane;   // CID for duplicate
         var oViz = this;
         this.setCID(cId);
         var colorCategory = this.getRowDisplayNames().get("detail") ? this.getRowDisplayNames().get("detail").name : "";
         
         /************* Defining Div properties -  class and ID *****************/

         var htmlContent = "<div class='dumbbell' id="+cId+">" + "<div class='dumbbellmain'><p id=chart_"+cId+" class='chart'><\/p>" + "</div></div>" +
        "<div><div id=legendPane_"+cId+" class='dumbbelllegendtitle'>" +
         "<span id=legendName_"+cId+">"+ colorCategory + "</span></div>" + "<div id=legend_"+cId+" class='dumbbelllegend'></div>"+
         "</div>";

    
        $(elContainer).html(htmlContent);
                   
        var width = $(elContainer).width(); // dynamic width
        var height = $(elContainer).height(); // dynamic height
	    var margin = {top: 20, right: 60, bottom: 60, left: 60}, // margin values
        w = width - margin.left - margin.right,
        h = height - margin.top - margin.bottom;
        width = w + 10;

        /************* Defining SVG properties using D3 library **************/

        var svg = d3.select("#chart_"+cId).append("svg").attr("viewBox", `10 10 ${(width+margin.right+margin.left)} ${(h + margin.top + margin.bottom)}`)
            .attr("width", width)
            .attr("height", height)
            .on("click", function(event, d){                 
                onOutsideClick(event);
            });
            
          /************************* transform and translate **********/  

            var g = svg.append("g").attr("transform", "translate(" + margin.left + "," + margin.top + ")");

  //Color Scale
  var colorHandler = new attributeGroupHandler.ColorAttributeGroupHandler();
  
  /********************* Assigning colors to circles ************/
  var colorScale = function(str, i) {
    if (i==0) {
        return "red"
    } else if (i==1) {
        return "blue"
    } else return "grey"
  }

//Adding Legend Data
var uniqueLegends = [], colorStack = [];


//pointSet

    if (pointSetValue.size > 2)
     { 
        colorStack = [this.getP1color(), this.getP2color(), "Others"]
    } 
    else {
        colorStack = [this.getP1color(), this.getP2color()]
    };

 /******************* Legend properies **************/
function addLegendPane(){
    var legendHeight = h*0.80;
    var legendMaxHt = h;
    var marginOffset = 10;
    var legendMarginTop = legendMaxHt >= legendHeight ? ((legendMaxHt-legendHeight)/2)+marginOffset : marginOffset;


    var svgLegend4 = d3.select("#legend_"+cId).append("svg")
    .attr("width", 0.5*width)
    .attr("height", legendHeight);

    var legend4 = svgLegend4.selectAll("#legend_"+cId)
    .data(colorStack)
    .enter().append('g')
    .attr("transform", function (d, i) {
        return "translate(0," + i * 15 + ")";
    });

                /******************* Legend square shapes properties and positioning *********/
                 legend4.append('rect')
                        .attr("x", 10)
                        .attr("y", 0)
                        .attr("width", 10)
                        .attr("height", 10)
                        .style("fill", function (d, i) {
                            return colorScale(d, i);
                        });
                
                        /******************** Legend text properties **************/
                 legend4.append('text')
                        .attr("x", 25)
                        .attr("y", 10)
                        .text(function (d, i) {
                            return d
                        })
                        .attr("class", "textselected")
                        .style("text-anchor", "start")
                        .style("font-size", 8);

                        $("#legend_"+cId).css("max-height", legendMaxHt);
                        $("#legend_"+cId).css("margin-top", legendMarginTop);
                        $("#legendPane_"+cId).css("padding-top", legendMarginTop-marginOffset);
}

/********************* Outside click function **********/

function onOutsideClick(e)
                {
                
                    var circle = $("circle");
                    var clicked = false;
                    if(!e.ctrlKey){
                        // if the target of the click isn't the container nor a descendant of the container
                        if (!circle.is(e.target) && circle.has(e.target).length === 0)
                        {
                            $("circle").removeClass("dumbmark");
                            clicked = true;
                        }
                        if(clicked){
                            var oMarkingService = oViz.getMarkingService();
                            oMarkingService.clearMarksForDataLayout(oDataLayout);
                            oViz._publishMarkEvent(oDataLayout/*, marking.EMarkContext.MARK_ALL*/);
                        }
                    }
                }
           


var obj = this;
drawDumbbell(oData, obj);
addLegendPane();

/*********drawDumbbell function ************/
function drawDumbbell(data, obj){

/************* Defining tooltip properties ******************/

    var tooltip = d3.select("body")
    .append("div")
    .attr("class", "tooltip")
    .style("display", "none");

/************ to get data values in tooltip ************/
function tooltipContent(d1, y) {    
    
    var d = d1.toElement.__data__;    // look for variable to get the index or data value
    var content = "";

    /*************** a for point 1 and b for point 2 ***********/

    if(y=="a"){
        debugger
        content = "<table>" +
        "<tr><td class='tthead'>"+ obj.getXDisplayName() +"</td><td class='ttval'>" + d.xValue + "</td></tr>" +
        "<tr><td class='tthead'>"+ yText +"</td><td class='ttval'>" + d.y_a.toLocaleString() + "</td></tr>"+
        "<tr><td class='tthead'>"+obj.getRowDisplayNames().get("detail").name+"</td><td class='ttval'>"+d.p1+"</td></tr>";
    } 
    else { 
        content = "<table>" +
        "<tr><td class='tthead'>"+ obj.getXDisplayName() +"</td><td class='ttval'>" + d.xValue + "</td></tr>" +
        "<tr><td class='tthead'>"+ yText +"</td><td class='ttval'>" + d.y_b.toLocaleString() + "</td></tr>" + 
        "<tr><td class='tthead'>"+obj.getRowDisplayNames().get("detail").name+"</td><td class='ttval'>"+d.p2+"</td></tr>";

    } 
    
     content += "</table>";    
    tooltip.style("display",null);
    return content;
}  


String.prototype.trunc = String.prototype.trunc ||
function(n){
    return (this.length > n) ? this.substr(0, n-1) + '...' : this;
};

   var x_scale = d3.scalePoint()  // x-scale properties
				.rangeRound([10, w-10]).padding(0.4)
            .domain(data.map(function(d) { return d.xValue.trunc(8); }));   //truncating x display names upto 8 characters

   var y_scale = d3.scaleLinear()
				.range([h, 0])
            .domain([d3.min(data, function(d) {
                 return d.y_a < d.y_b ? d.y_a : d.y_b;   })- h/10, d3.max(data, function(d) { 

                return d.y_a > d.y_b ? d.y_a : d.y_b; })+h/10]);
         
				
			var size_scale = d3.scaleLinear()
				.range([1, 30])
				.domain([1, 30]);
			var t = d3.transition()
				.duration(750);
			var x_axis = d3.axisBottom()
				.scale(x_scale).ticks(data.length, "s");     
			var y_axis = d3.axisLeft()
				.scale(y_scale).tickFormat(function (d) {
     
                    /**************** converting values into K, Mn, etc. *******/
                    var array = ['','k','M','G','T','P'];
    var i=0, neg = 1;
    if (d < 0) { 
        neg = -1; d = d * -1;
    }        
        while (d > 1000)
    {
        i++;
        d = d/1000;
    }

    d = d * neg + ' ' + array[i];
    return d; 
                  });   
                            
         g.append("g")
			.attr("class", "x axis")
         .attr("transform", "translate(0," + h + ")")
			.call(x_axis)
            .selectAll("text")
        .style("text-anchor", "end")
        .style("font-size", "9px")
        .style("color", "777")
        .attr("dx", "-.8em")
        .attr("dy", ".15em")
        .attr("transform", function (d) {
        return "rotate(-30)";
    });
          
    
         var arr_x ="";
         arr_x = arr_x + xText[0];
         g.append("text")
         .attr("class", "x label")
        .attr("transform", "translate(" + (w / 2) + " ," + (h + margin.bottom) + ")")
        .style("text-anchor", "middle")
        .style("font-size", "11px")
        .text(obj.getXDisplayName());        

        


      g.append("g")
			.attr("class", "y axis")
            .style("font-size", "9px")
            .style("color", "777")
         .call(y_axis);

         // Add the text label for the Y axis
         var arr ="";
         arr = arr + yText[0];
         g.append("text")
    .attr("transform", "rotate(-90)")
   // .attr("y", 0 - margin.left)
   .attr("y", "-50px")
    .attr("x",0 - (h / 2))
    .attr("dy", "1em")
    .style("text-anchor", "middle")
    .style("font-size", "11px")
    .text(arr);

   
			var dot_a = g.selectAll(".dot.a")
				.data(data, function(d){ 
               return d.xValue; 
            });
        console.log(dot_a);
			var dot_b = g.selectAll(".dot.b")
				.data(data, function(d){ return d.xValue; });

			var connect_line = g.selectAll(".connect-line")
				.data(data, function(d){ return d.xValue});

			// EXIT
			dot_a.exit()
				.transition(t)
					.style("r", 1e-6)
					.remove();
			dot_b.exit()
				.transition(t)
						.style("r", 1e-6)
						.remove();

			connect_line.exit()
				.transition(t)
						.style("opacity", 1e-6)
						.remove();

			// UPDATE
			dot_a
				.transition(t)
					.attr("cx", function(d){ 
                  return x_scale(d.xValue); 
               })
					.attr("cy", function(d){ 
                  return y_scale(d.y_a); })
					.attr("r", function(d){ return size_scale(d.size_a); });

			dot_b
				.transition(t)
					.attr("cx", function(d){ 
                  return x_scale(d.xValue); })
					.attr("cy", function(d){ return y_scale(d.y_b); })
					.attr("r", function(d){ return size_scale(d.size_b); });

			connect_line
				.transition(t)
					.attr("y1", function(d){ return y_scale(d.y_a) + (size_scale(d.size_a) * multiplier(d.y_a, d.y_b)); })
					.attr("y2", function(d){ return y_scale(d.y_b) - (size_scale(d.size_b) * multiplier(d.y_a, d.y_b)); })

			// ENTER
        
			dot_a.enter().append("circle")
            .attr("data-row", function(d) { 
                    return d.row_a; })
					.attr("fill", function(d){
                        if(d.p1 == obj.getP1color()){
                            return "red" ;
                        }
                        else if(d.p1 == obj.getP2color()){
                            return "blue";
                        } else {
                            return "grey";
                        }
                       })
                     // .attr("class","dot a")
					.attr("cx", function(d){
                   return x_scale(d.xValue.trunc(8)); 
                  })
                  
					.attr("cy", function(d){ return y_scale(d.y_a); })
                    .attr("r", 5)
                   


                    .on("mouseover", function(d) {
                
                        // tooltipContent(d, "a");
                        // return tooltip.style("visibility", "visible");
                        return tooltip.style("display", null).html(tooltipContent(d, "a"));
                    })
                    .on("mousemove", function(d) {

                        tooltipContent(d, "a");
                        return tooltip.style("top", (event.pageY - 20) + "px").style("left", (event.pageX +10)+ "px");
                    })
                    .on("mouseout", function(d) {
                        return tooltip.style("display", "none");
                    })
                    .on("click", function(event, d){
                    
    
            
                        var oMarkingService = obj.getMarkingService();
                        if(!event.ctrlKey) {
                        
                            oMarkingService.clearMarksForDataLayout(oDataLayout);
                        }
                        var selectedItems = obj.getSelectedItems();
                          $(this).addClass("dumbmark");
                         $(this).parent().children().removeClass("dumbmark");
                       // $("circle").removeClass("dumbmark");
                        for(let i=0; i<pointSetValue.size; i ++){
                            
                            oMarkingService.setMark(oDataLayout, datamodelshapes.Physical.DATA, parseInt(d.row_a), 0);
                            oMarkingService.setMark(oDataLayout, datamodelshapes.Physical.DATA, parseInt(d.row_b), 0);
                        $("circle[data-row='"+d.row_a+"']").addClass("dumbmark");
                        $("circle[data-row='"+d.row_b+"']").addClass("dumbmark");
                        }
                       
                        selectedItems.set( parseInt(d.row_a), 0);
                        obj._publishMarkEvent(oDataLayout);
                        return tooltip.style("display", "none");
                    });

                   

                    dot_b.enter().append("circle")
                    .attr("data-row", function(d) { 
                    
                        return d.row_b; })
					.attr("fill", function(d){
    
                        if(d.p2 == obj.getP1color()){
                            return "red" ;
                        }
                        else if(d.p2 == obj.getP2color()){
                            return "blue";
                        } else {
                            return "grey";
                        }

                       })
					.attr("cx", function(d){ 
                  return x_scale(d.xValue.trunc(8)); 
               })
					.attr("cy", function(d){ return y_scale(d.y_b); })
					.attr("r", 5)
                    .on("mouseover", function(d) {
                        // tooltipContent(d, "b");
                        // return tooltip.style("visibility", "visible");
                        return tooltip.style("display", null).html(tooltipContent(d, "b"));
                    })
                    .on("mousemove", function(d) {
                        tooltipContent(d, "b");
                        return tooltip.style("top", (event.pageY - 20) + "px").style("left", (event.pageX + 10)+ "px");
                    })
                    .on("mouseout", function(d) {
                        return tooltip.style("display", "none");
                    })
                    .on("click", function(event, d){
                    
                          var oMarkingService = obj.getMarkingService();
                          if(!event.ctrlKey) {
                    
                            oMarkingService.clearMarksForDataLayout(oDataLayout);
                        }
                        var selectedItems = obj.getSelectedItems();
                        //    oMarkingService.clearMarksForDataLayout(oDataLayout);
                        //    oMarkingService.setMark(oDataLayout, datamodelshapes.Physical.DATA, parseInt(d.row_b), 0);
                        $(this).addClass("dumbmark");   
                       $(this).parent().children().removeClass("dumbmark");
        
                            $("circle").removeClass("dumbmark");
                            for(let i=0; i<pointSetValue.size; i ++){
                                oMarkingService.setMark(oDataLayout, datamodelshapes.Physical.DATA, parseInt(d.row_a) , 0);
                                oMarkingService.setMark(oDataLayout, datamodelshapes.Physical.DATA, parseInt(d.row_b) , 0);
                            
                            $("circle[data-row='"+d.row_a+"']").addClass("dumbmark");
                            $("circle[data-row='"+d.row_b+"']").addClass("dumbmark");
                            }
                         
                          selectedItems.set(parseInt(d.row_b), 0);
                            obj._publishMarkEvent(oDataLayout);
                            return tooltip.style("display", "none");
                            
                        });

			connect_line.enter().append("line")
					.attr("class", "connect-line")
					.attr("x1", function(d){ 
                  return x_scale(d.xValue.trunc(8)); 
               })
					.attr("y1", function(d){ return y_scale(d.y_a) + (size_scale(5) * multiplier(d.y_a, d.y_b)); })
					.attr("x2", function(d){ return x_scale(d.xValue.trunc(8)); })
					.attr("y2", function(d){ return y_scale(d.y_b) - (size_scale(5) * multiplier(d.y_a, d.y_b)); })
}

		// a or b on top
		function multiplier(a, b){
			return a > b ? 1 : -1;
		}
        if(oViz.getLegendOption() === 'On'){
            addLegendPane();
        }
      }
      finally {
         this._setIsRendered(true);
      }
    }
    /**
         * Called whenever new data is ready and this visualization needs to update.
         * @param {module:obitech-renderingcontext/renderingcontext.RenderingContext} oTransientRenderingContext
         */
     DumbbellViz.prototype.render = function(oTransientRenderingContext) {
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
    DumbbellViz.prototype.resizeVisualization = function(oVizDimensions, oTransientVizContext){
        var oTransientRenderingContext = this.createRenderingContext(oTransientVizContext);
        this._render(oTransientRenderingContext);
    };

    /**
         * Re-render the visualization when settings changes
         */
     DumbbellViz.prototype._onDefaultSettingsChanged = function(){
        
        var oTransientVizContext = this.assertOrCreateVizContext();
        var oTransientRenderingContext = this.createRenderingContext(oTransientVizContext);
        this.render(oTransientRenderingContext);
        this._setIsRendered(true);
    };

    DumbbellViz.prototype._publishMarkEvent = function (oDataLayout, eMarkContext) {

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
     DumbbellViz.prototype._addVizSpecificMenuOptions = function(oTransientVizContext, sMenuType, aResults, contextmenu, evtParams, oTransientRenderingContext){
        aResults.shift();
        
        DumbbellViz.superClass._addVizSpecificMenuOptions.call(this, oTransientVizContext, sMenuType, aResults, contextmenu, evtParams, oTransientRenderingContext);
        if (sMenuType === euidef.CM_TYPE_VIZ_PROPS) {

            // Set up the column context for the last column in the ROWS bucket
            var oColumnContext = this.getDrillPathColumnContext(oTransientVizContext, datamodelshapes.Logical.ROW);

            // Set up events
                if(!this.isViewOnlyLimit()){
                    
                     this._addFilterMenuOption(oTransientVizContext, aResults, null, null, oTransientRenderingContext);
                    this._addRemoveSelectedMenuOption(oTransientVizContext, aResults, null, null, oTransientRenderingContext);
                    //this._addDrillMenuOption(oTransientVizContext, aResults, null, null, oColumnContext, oTransientRenderingContext);
                    //this._addLateralDrillMenuOption(oTransientVizContext, aResults);
                }

        }
    };

    DumbbellViz.prototype._addVizSpecificPropsDialog = function (oTabbedPanelsGadgetInfo) {
        

        // var options = this.getViewConfig() || {};
        //  this._fillDefaultOptions(options, null);
        // this._addLegendToVizSpecificPropsDialog(options, oTabbedPanelsGadgetInfo);

       this.doAddVizSpecificPropsDialog(this, oTabbedPanelsGadgetInfo);
        DumbbellViz.superClass._addVizSpecificPropsDialog.call(this, oTabbedPanelsGadgetInfo);

    };
 
 

    /**
         * TODO: Legend should take care of this
         * Given an options / config object, configure it with default options for the visualization.
         *
         * @param {object} oOptions the options
         * @param {module:obitech-framework/actioncontext#ActionContext} oActionContext The ActionContext instance associated with this action
         * @protected
         */
     DumbbellViz.prototype._fillDefaultOptions = function (oOptions/*, oActionContext*/) {
        
        if (!jsx.isNull(oOptions) && !jsx.isNull(oOptions.legend))
            return;

        // Legend
        oOptions.legend = jsx.defaultParam(oOptions.legend, {});
        oOptions.legend.rendered = jsx.defaultParam(oOptions.legend.rendered, "on");
        oOptions.legend.position = jsx.defaultParam(oOptions.legend.position, "right");

        this.getSettings().setViewConfigJSON(dataviz.SettingsNS.CHART, oOptions);
    };    
    
    
    DumbbellViz.prototype.doAddVizSpecificPropsDialog = function (oTransientRenderingContext, oTabbedPanelsGadgetInfo) {

        jsx.assertObject(oTransientRenderingContext, "oTransientRenderingContext");
        jsx.assertInstanceOf(oTabbedPanelsGadgetInfo, gadgets.TabbedPanelsGadgetInfo, "oTabbedPanelsGadgetInfo", "obitech-application/gadgets.TabbedPanelsGadgetInfo");

        var oDataModel = this.getRootDataModel();

        this.setTabInfo(oTabbedPanelsGadgetInfo);
        var viewConfig = this.getViewConfig() || {};
        var options = this.getViewConfig() || {};
        //this._fillDefaultOptions(options, oTransientRenderingContext.get(viz.ContextProperty.ACTION_CONTEXT));
        this._fillDefaultOptions(options, null);
        var generalPanel = gadgetdialog.forcePanelByID(oTabbedPanelsGadgetInfo, euidef.GD_PANEL_ID_GENERAL);
        var oGadgetFactory = this.getGadgetFactory();
       

        if (DumbbellViz.superClass.doAddVizSpecificPropsDialog)
            DumbbellViz.superClass.doAddVizSpecificPropsDialog.apply(this, arguments);
    };

    DumbbellViz.prototype._handlePropChange = function (sGadgetID, oPropChange, oViewSettings, oActionContext){
        
        var updateSettings = DumbbellViz.superClass._handlePropChange.call(this, sGadgetID, oPropChange, oViewSettings, oActionContext);
        if (updateSettings) {
            return updateSettings; // super handled it
        }
        var conf = oViewSettings.getViewConfigJSON(dataviz.SettingsNS.CHART) || {};

        return updateSettings;
    };
    
    /**
         * Builds the list of selected items
         * @param {module:obitech-renderingcontext/renderingcontext.RenderingContext} oTransientRenderingContext - The rendering context
         */
     DumbbellViz.prototype._buildSelectedItems = function(oTransientRenderingContext){
   
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
        
            $("circle").parent().children().removeClass("dumbmark");
            for(let row of aSelectedItems.keys()){
                $("circle[data-row='"+row+"']").addClass("dumbmark");
            }
            //oViz._render(oTransientRenderingContext);
        }
        oMarkingService.getUpdatedMarkingSet(oDataLayout, marking.EMarkOperation.MARK_RELATED, fMarksReadyCallback);
    };


    /**
     * React to marking service highlight events
     */
    DumbbellViz.prototype.onHighlight = function(){
        var oTransientVizContext = this.assertOrCreateVizContext();
        var oTransientRenderingContext = this.createRenderingContext(oTransientVizContext);
        this._buildSelectedItems(oTransientRenderingContext);
    };

    /**
     * Override _doInitializeComponent in order to subscribe to events
     */
    DumbbellViz.prototype._doInitializeComponent = function() {
        
        DumbbellViz.superClass._doInitializeComponent.call(this);

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
    * @returns {module:com-company-dumbbellviz/dumbbellViz.DumbbellViz}
    * @memberof module:com-company-dumbbellviz/dumbbellViz
    */

     function createClientComponent(sID, sDisplayName, sOrigin) {
     // Argument validation done by base class
      return new DumbbellViz(sID, sDisplayName, sOrigin, DumbbellViz.VERSION);
   };

   return {
      createClientComponent : createClientComponent
   };
});