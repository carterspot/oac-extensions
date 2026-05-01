define(['jquery',
        'obitech-framework/jsx',
        'obitech-report/datavisualization',
        'obitech-reportservices/datamodelshapes',
		'obitech-reportservices/data',
        'obitech-reportservices/events',
		'obitech-reportservices/interactionservice',
		'obitech-reportservices/markingservice',
		'obitech-application/gadgets',
		'obitech-report/visualization',
		'obitech-report/gadgetdialog',
		'obitech-application/bi-definitions',
        'obitech-application/extendable-ui-definitions',
        'obitech-appservices/logger',
        'ojL10n!com-company-funnelviz/nls/messages',
		'ojs/ojcore', 'knockout', 'ojs/ojarraydataprovider',
		'ojs/ojbootstrap', "ojs/ojhtmlutils", 'ojs/ojknockout', 'ojs/ojchart', 'ojs/ojtoolbar',
        'obitech-framework/messageformat',
        'css!com-company-funnelviz/funnelVizstyles'],
        function($,
                 jsx,
                 dataviz,
                 datamodelshapes,
				 data,
                 events,
				 interactions,
				 marking,
				 gadgets,
				 viz,
				 gadgetdialog,
				 definitions,
				 euidef,
                 logger,
                 messages,
				 oj, ko,
             ArrayDataProvider, bootstrap, ojhtmlutils_1) {
   "use strict";

   var MODULE_NAME = 'com-company-funnelviz/funnelViz';

   //Param validation to detect cyclical dependencies (ignore modules not used in resource arguments)
   //jsx.assertAllNotNullExceptLastN(arguments, "funnelViz.js arguments", 2);

   var _logger = new logger.Logger(MODULE_NAME);

   // The version of our Plugin
   FunnelViz.VERSION = "1.0.0";

   /**
    * The implementation of the funnelViz visualization.
    * 
    * @constructor
    * @param {string} sID
    * @param {string} sDisplayName
    * @param {string} sOrigin
    * @param {string} sVersion
    * @extends {module:obitech-report/visualization.Visualization}
    * @memberof module:com-company-funnelviz/funnelViz#
    */
   function FunnelViz(sID, sDisplayName, sOrigin, sVersion) {
      // Argument validation done by base class
      FunnelViz.baseConstructor.call(this, sID, sDisplayName, sOrigin, sVersion);
	  
	  /**
	 * @type {Array.<String>} - The array of selected items
	 */
	var aSelectedItems = [];
	var orientation = 'vertical';
	 
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
	   aSelectedItems = [];
	};
	
	this.getOrientation = function(){
	   return(orientation);
	};
	
	this.setChartOrientation = function (o){
		orientation = o;	
	};
   };
   jsx.extend(FunnelViz, dataviz.DataVisualization);
   
   

FunnelViz.prototype._generateData = function(oDataLayout){
   
   
   var oDataModel = this.getRootDataModel();
   if(!oDataModel || !oDataLayout){
      return;
   }
   
   var aAllMeasures = oDataModel.getColumnIDsIn(datamodelshapes.Physical.DATA);
   var nMeasures = aAllMeasures.length;    
   var nRows = oDataLayout.getEdgeExtent(datamodelshapes.Physical.ROW);
   var nRowLayerCount = oDataLayout.getLayerCount(datamodelshapes.Physical.ROW);
   var nCols = oDataLayout.getEdgeExtent(datamodelshapes.Physical.COLUMN);
   var nColLayerCount = oDataLayout.getLayerCount(datamodelshapes.Physical.COLUMN);

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
    
   var hasCategoryOrColor = function () {
      return nLastLayer >= 0;
   };
   
 	function sortByKey(arr, prop, asc) {
		arr = arr.sort(function(a, b) {
			if (asc) return (a[prop] > b[prop]) ? 1 : ((a[prop] < b[prop]) ? -1 : 0);
			else return (b[prop] > a[prop]) ? 1 : ((b[prop] < a[prop]) ? -1 : 0);
		});
		return arr;
	}
	
   //--------------------------------------------------------
   var aOutput = [];
   
    if(nRows > 0 || nCols > 0){
      
      var nRow, nCol;
      for(nRow=0; nRow < Math.max(nRows, 1); nRow++){
         
         for(nCol=0; nCol < Math.max(nCols, 1); nCol++){
		//	var oNode = {name:"", items:[]};
         var oNode = {series:"", value: "", id:""};
			var sValue = oDataLayout.getValue(datamodelshapes.Physical.DATA, nRow, nCol);
			oNode.series = oDataLayout.getValue(datamodelshapes.Physical.ROW, 0, nRow, false);
		    oNode.value = parseFloat(sValue);
          oNode.id = nRow;
       //   oNode.items.push ({value:parseFloat(sValue), id:nRow+':'+nCol});
		    aOutput.push(oNode);		   
		}
      }
	}
	//--------------------------------------------------------
   if (aOutput.length>0)
		return aOutput; /*sortByKey(aOutput, 'value', true);*/
	else
		return null;
}
   
   /**
    * Called whenever new data is ready and this visualization needs to update.
    * @param {module:obitech-renderingcontext/renderingcontext.RenderingContext} oTransientRenderingContext
    */
FunnelViz.prototype._render = function(oTransientRenderingContext) {
   
      // Note: all events will be received after initialize and start complete.  We may get other events
      // such as 'resize' before the render, i.e. this might not be the first event.

      // Retrieve the data object for this visualization
      var oDataLayout = oTransientRenderingContext.get(dataviz.DataContextProperty.DATA_LAYOUT);
	  //var oDvtData = FunnelViz.superClass._generateDvtData.call(this, oTransientRenderingContext);
	  //var oDvtData = this.getViewModel().get('data');
	  
	  if (!oDataLayout)
		  return;
	  
	  var funnelSeries = this._generateData(oDataLayout);
    function kFormatter(num) {
        var ret_val;
            if(Math.abs(num) > 999999){
                ret_val = Math.sign(num)*((Math.abs(num)/1000000).toFixed(1)) + 'M';
            } else if(Math.abs(num) > 999) {
                ret_val = Math.sign(num)*((Math.abs(num)/1000).toFixed(1)) + 'K';
            } else {
                ret_val = Math.sign(num)*Math.abs(num);
            }
        return ret_val;
    }

     for (var index=0; index<funnelSeries.length; index++) {
      var item = funnelSeries[index];
      var name = item.series;
     // if (item && name) {
       if (item) {
      var items = item.items;
      var value = kFormatter(item.value);
      if (value) {
          funnelSeries[index].name = name + "  " + value.toString();
      }
      }
      }

      var sVizContainerId = this.getSubElementIdFromParent(this.getContainerElem(), "hvc");
		var pane = sVizContainerId.substring(sVizContainerId.indexOf("view")+5,sVizContainerId.indexOf("pane"));
		var conetentPane = sVizContainerId.substring(sVizContainerId.indexOf("contentpane_")+12,sVizContainerId.indexOf("vizCont")-1);
		var cId = pane+"_"+conetentPane;
	//	self.cID = cId;
	  
      // Determine the number of records available for rendering on ROW
      // Because we specified that Category should be placed on ROW in the data model handler,
      // this returns the number of rows for the data in Category.

      // Retrieve the root container for our visualization.  This is provided by the framework.  It may not be deleted
      // but may be used to render.
      var elContainer = this.getContainerElem();
	  elContainer.innerHTML = '';
	  var h = $(elContainer).height()-30;
	  var w = $(elContainer).width()-30;  

	  var funnelContainerDiv = document.createElement('div'); 
     funnelContainerDiv.innerHTML = "<oj-chart\n" +
			"              id=\""+cId+"\"\n" +
     //    "              id=\"funnelChart\"\n" +
			"              type=\"funnel\"\n" +
         "              data=\"[[dataProvider]]\"\n" +
     //    "              orientation=\"vertical\"\n" +
         "              orientation=\" [[orientationValue]]\"\n" +
         "              on-selection-changed=\"[[chartOptionChange]]\"\n" +
         "              selection-mode=\"[[selectionValue]]\"\n" +
         "              selection=\"{{selectedItemsValue}}\"\n" + ">" +
    //     " animation-on-data-change=\"auto\"\n" +
    //     "              animation-on-display=\"auto\"\n" + 
			"			   <template slot=\"itemTemplate\">\n" +
			"              	<oj-chart-item\n" +
			"                  value=\"[[$current.data.value]]\"\n" +
			"                  group-id=\"[[ [$current.data.group] ]]\"\n" +
			"				   series-id=\"[[$current.data.name]]\">\n"
			"              	</oj-chart-item>\n" +
			"            </template>\n"+
			"			</oj-chart>";

//      funnelContainerDiv.innerHTML = "<div id='funnelChart' data-bind=\"ojComponent: { \
//       component: 'ojChart',  \
//       type: 'funnel', \
//       series: funnelSeriesValue, \
//       orientation: orientationValue, \
//       selectionMode: 'multiple', \
//       selection: selectedItemsValue, \
//       hoverBehavior: 'dim', \
//       animationOnDisplay: 'none', \
//       animationOnDataChange: 'none', \
//       styleDefaults: {threeDEffect: 'off'}, \
//       optionChange: chartOptionChange \
//    }\" \
//    style='width:WIDTHpx;height:HEIGHTpx;'> \
// </div>".replace("WIDTH",w).replace("HEIGHT",h);

elContainer.appendChild(funnelContainerDiv);  

/*
		Assign the values from 'self' object to ChartModel object, this is a requirement of latest JET library.
		*/
      var chartModel = new ChartModel(this);

/*
		Binding step needs to be inside bootstrap's whenDocumentReady block as a new requirement for latest JET version.
		*/
		bootstrap.whenDocumentReady().then(
			function()
			{
				ko.applyBindings(chartModel, funnelContainerDiv);
			}
		);

      const funnel_element = document.getElementById(cId);
		funnel_element.setAttribute("style", "width:"+w+"px;height:"+h+"px;");

	function ChartModel(oViz) {
      
   var self = this;
    //    self.funnelSeriesValue = ko.observableArray(funnelSeries);
	self.orientationValue = ko.observable(oViz.getOrientation());
   //self.orientationValue = ko.observable("vertical");
   self.selectionValue = ko.observable("multiple");
   self.idToItemMap = {};
   this.jsonData = funnelSeries;
   this.dataProvider = new ArrayDataProvider(this.jsonData), {
    keyAttributes: "id",       
  };
   self.selected = [];

   //self.selectedItemsValue = ko.observableArray(self.selected);
   var selected = [];
   var aSelectedItems = oViz.getSelectedItems(); 
   for (var j=0; j < aSelectedItems.length; j++)		
      selected.push(parseInt(aSelectedItems[j].split(":")[0]));
   self.selectedItemsValue = ko.observableArray(selected);

   this.selectionInfo = ko.pureComputed(() => {
               let items = '';
               const selection = this.selectedItemsValue();
               items += 'items: <br/>';
               if (selection.length > 0) {
                   for (let i = 0; i < selection.length; i++) {
                       const id = selection[i];
                       const item = this.idToItemMap[id];
                       items += `    ${item.series}<br/>`;
                   }
               }
               return (0, ojhtmlutils_1.stringToNodeArray)(items);
   });

   this.selectionValue.subscribe((newValue) => {
            this.selectedItemsValue(this.selected);
   });
         
   this.jsonData.map((dataItem) => {
      this.idToItemMap[dataItem.id] = dataItem;
   });

		// var selected = [];
		//  var aSelectedItems = oViz.getSelectedItems(); 
		//  for (var j=0; j < aSelectedItems.length; j++)		
		//  	selected.push({id:aSelectedItems[j]});
      //   self.selectedItemsValue = ko.observableArray(selected);
       
   //      var data_1 = [
   //       {
   //         "id": 0,
   //         "series": "Series 1",
   //       //  "group": "Group A",
   //         "value": 42
   //       },
   //       {
   //         "id": 1,
   //         "series": "Series 2",
   //        // "group": "Group A",
   //         "value": 55
   //       },
   //       {
   //         "id": 2,
   //         "series": "Series 3",
   //       //  "group": "Group A",
   //         "value": 36
   //       },
   //       {
   //         "id": 3,
   //         "series": "Series 4",
   //     //    "group": "Group A",
   //         "value": 22
   //       },
   //       {
   //         "id": 4,
   //         "series": "Series 5",
   //   //      "group": "Group A",
   //         "value": 22
   //       }
   //     ];


      //  this.dataProvider = new ArrayDataProvider(JSON.parse(JSON.stringify(data_1)), {
      //    keyAttributes: "id",       
      //  });
       
		self.chartOptionChange = function(event, ui) {
         var aSelectedValues = event.detail.selectionData;
         if (aSelectedValues.length>0) {
            var oMarkingService = oViz.getMarkingService();
            oMarkingService.clearMarksForDataLayout(oDataLayout);
            for (var i=0;i<aSelectedValues.length;i++) {
               var oData = aSelectedValues[i];
               var oItemData = oData.itemData;
               var nRow = oItemData.id;
           //    $(this).addClass("funnelmark");
               oMarkingService.setMark(oDataLayout, datamodelshapes.Physical.DATA, nRow, 0 );
            }
            oViz._publishMarkEvent(oDataLayout);
         } else {
            // Clear all the marks 
            var oMarkingService = oViz.getMarkingService();
            oMarkingService.clearMarksForDataLayout(oDataLayout);
            oViz._publishMarkEvent(oDataLayout/*, marking.EMarkContext.MARK_ALL*/);
         }
         //  if (ui['option'] == 'selection') {
         //    if(ui['value']){
			//   var oMarkingService = oViz.getMarkingService();
			//   oMarkingService.clearMarksForDataLayout(oDataLayout);

         //      for(var i = 0; i < ui['value'].length; i++){
         //        if(ui['value'][i]){
			// 		var id = ui['value'][i]['id'].split(':');
			// 		var nRow = parseInt(id[0]);
			// 		var nCol = parseInt(id[1]);
			// 		oMarkingService.setMark(oDataLayout, datamodelshapes.Physical.DATA, nRow, nCol );
			// 	}
         //      }
			//   oViz._publishMarkEvent(oDataLayout);
         //    }
         //  }
        }
		
    }
			  
    this._setIsRendered(true) ;
};
	
   /**
 * Called whenever new data is ready and this visualization needs to update.
 * @param {module:obitech-renderingcontext/renderingcontext.RenderingContext} oTransientRenderingContext
 */
FunnelViz.prototype.render = function(oTransientRenderingContext) {
   
   // Note: all events will be received after initialize and start complete.  We may get other events
   // such as 'resize' before the onDataReady, i.e. this might not be the first event.
    
   this._render(oTransientRenderingContext);
   
   // Generate (asynchronously) the list of selected items for this visual
   this._buildSelectedItems(oTransientRenderingContext); 
};

/**
 * Resize the visualization
 * @param {Object} oVizDimensions - contains two properties, width and height
 * @param {module:obitech-report/vizcontext#VizContext} oTransientVizContext the viz context
 */
FunnelViz.prototype.resizeVisualization = function(oVizDimensions, oTransientVizContext){
   var oTransientRenderingContext = this.createRenderingContext(oTransientVizContext);
   this._render(oTransientRenderingContext);
};

FunnelViz.prototype._publishMarkEvent = function (oDataLayout, eMarkContext) {
  
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
FunnelViz.prototype._addVizSpecificMenuOptions = function(oTransientVizContext, sMenuType, aResults, contextmenu, evtParams, oTransientRenderingContext){
   FunnelViz.superClass._addVizSpecificMenuOptions.call(this, oTransientVizContext, sMenuType, aResults, contextmenu, evtParams, oTransientRenderingContext);
    
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

FunnelViz.prototype._addVizSpecificPropsDialog = function(oTabbedPanelsGadgetInfo){
   //var options = this.getViewConfig() || {};
  // this._fillDefaultOptions(options, null);
   //this._addLegendToVizSpecificPropsDialog(options, oTabbedPanelsGadgetInfo);
   this.doAddVizSpecificPropsDialog(this, oTabbedPanelsGadgetInfo);
   FunnelViz.superClass._addVizSpecificPropsDialog.call(this, oTabbedPanelsGadgetInfo);
   
   /*
    var b = this._getInnerViz();
        if (b.doAddVizSpecificPropsDialog) {
            var c = this.getViewModel(0,0);
            this.pushViewModel(c);
            c = this.createVizContext();
            c = this.createCellRenderingContext(c, 0, 0);
            b.doAddVizSpecificPropsDialog(c, a);
            this.popViewModel()
        }*/
};

FunnelViz.prototype.doAddVizSpecificPropsDialog = function (oTransientRenderingContext, oTabbedPanelsGadgetInfo) {
      jsx.assertObject(oTransientRenderingContext, "oTransientRenderingContext");
      jsx.assertInstanceOf(oTabbedPanelsGadgetInfo, gadgets.TabbedPanelsGadgetInfo, "oTabbedPanelsGadgetInfo", "obitech-application/gadgets.TabbedPanelsGadgetInfo");

      var options = this.getViewConfig() || {};
      //this._fillDefaultOptions(options, oTransientRenderingContext.get(viz.ContextProperty.ACTION_CONTEXT));
	  this._fillDefaultOptions(options, null);

      var generalPanel = gadgetdialog.forcePanelByID(oTabbedPanelsGadgetInfo, euidef.GD_PANEL_ID_GENERAL);

      var orientVals = [];
      orientVals.push(new gadgets.OptionInfo('horizontal','horizontal'));
	  orientVals.push(new gadgets.OptionInfo('vertical','vertical'));

      var oOrientTypeGVP = new gadgets.GadgetValueProperties(euidef.GadgetTypeIDs.TEXT_SWITCHER, this.getOrientation());
      var oOrientTypeGadgetInfo = new gadgets.TextSwitcherGadgetInfo("orientTypeGadget", 'Orientation', 'Orientation', oOrientTypeGVP, euidef.GD_FIELD_ORDER_GENERAL_LINE_TYPE, false, orientVals);
      generalPanel.addChild(oOrientTypeGadgetInfo);

	  if (FunnelViz.superClass.doAddVizSpecificPropsDialog)
		FunnelViz.superClass.doAddVizSpecificPropsDialog.apply(this, arguments);
};


FunnelViz.prototype._handlePropChange = function (sGadgetID, oPropChange, oViewSettings, oActionContext){
   var updateSettings = FunnelViz.superClass._handlePropChange.call(this, sGadgetID, oPropChange, oViewSettings, oActionContext);      
      if (updateSettings) {
         return updateSettings; // super handled it
      }

   // Allow the super class an attempt to handle the changes
   var conf = oViewSettings.getViewConfigJSON(dataviz.SettingsNS.CHART) || {};
	  
    if (sGadgetID === "orientTypeGadget")
      {
         if (jsx.isNull(conf.styleDefaults))
         {
            conf.styleDefaults = {};
         }
         //conf.styleDefaults.lineType = oPropChange.value;
         //oViewSettings.setViewConfigJSON(dataviz.SettingsNS.CHART, conf);
		 
		 //this.chartModel.orientation = oPropChange.value;
		 this.setChartOrientation(oPropChange.value);
         updateSettings = true;
      }

   return updateSettings;
};
   
/**
 * Builds the list of selected items
 * @param {module:obitech-renderingcontext/renderingcontext.RenderingContext} oTransientRenderingContext - The rendering context
 */
FunnelViz.prototype._buildSelectedItems = function(oTransientRenderingContext){
   var oViz = this;
   var oDataLayout = oTransientRenderingContext.get(dataviz.DataContextProperty.DATA_LAYOUT);
   var oMarkingService = this.getMarkingService();
    
   function fMarksReadyCallback() {
      oViz.clearSelectedItems();
      var aSelectedItems = oViz.getSelectedItems();
       
      if(!oViz.isStarted()) {
         return;
      }
      oMarkingService.traverseDataEdgeMarks(oDataLayout, function (nRow, nCol) {
     //    aSelectedItems.push(nRow,nCol);
         aSelectedItems.push(nRow + ':' + nCol);
      });
       
     oViz._render(oTransientRenderingContext);         
   }
    
   oMarkingService.getUpdatedMarkingSet(oDataLayout, marking.EMarkOperation.MARK_RELATED, fMarksReadyCallback);
};


/**
 * React to marking service highlight events
 */
FunnelViz.prototype.onHighlight = function(){
   var oTransientVizContext = this.assertOrCreateVizContext();
   var oTransientRenderingContext = this.createRenderingContext(oTransientVizContext);
   this._buildSelectedItems(oTransientRenderingContext);
};

FunnelViz.prototype._onDefaultColorsSettingsChange = function(/*oClientEvent*/){
   var oTransientVizContext = this.createVizContext();
   if(!this._handleVizPlaceholderState(oTransientVizContext)){
       this.readyForData({aEventTriggers:[events.types.DEFAULT_COLOR_SETTINGS_CHANGED_EVENT_TRIGGER]});
       var oTransientVizContext = this.assertOrCreateVizContext();
     var oTransientRenderingContext = this.createRenderingContext(oTransientVizContext);
     this._render(oTransientRenderingContext);
   }
};

/**
 * Override _doInitializeComponent in order to subscribe to events
 */
FunnelViz.prototype._doInitializeComponent = function() {
   FunnelViz.superClass._doInitializeComponent.call(this);
    
   this.subscribeToEvent(events.types.INTERACTION_HIGHLIGHT, this.onHighlight, this.getViewName() + "." + events.types.INTERACTION_HIGHLIGHT)
   this.subscribeToEvent(events.types.DEFAULT_COLOR_SETTINGS_CHANGED, this._onDefaultColorsSettingsChange, "**");
};

   /**
    * Factory method declared in the plugin configuration
    * @param {string} sID Component ID for the visualization
    * @param {string=} sDisplayName Component display name
    * @param {string=} sOrigin Component host identifier
    * @param {string=} sVersion 
    * @returns {module:com-company-funnelviz/funnelViz.FunnelViz}
    * @memberof module:com-company-funnelviz/funnelViz
    */
   function createClientComponent(sID, sDisplayName, sOrigin) {
     // Argument validation done by base class
      return new FunnelViz(sID, sDisplayName, sOrigin, FunnelViz.VERSION);
   };

   return {
      createClientComponent : createClientComponent
   };
});
