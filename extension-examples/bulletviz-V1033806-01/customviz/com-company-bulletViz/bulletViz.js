define(['jquery',
        'obitech-framework/jsx',
		'obitech-application/gadgets',
        'obitech-report/datavisualization',
		'obitech-legend/legendandvizcontainer',
        'obitech-reportservices/datamodelshapes',
		'obitech-reportservices/data',
		'obitech-report/vizcontext',
		'd3js',	
        'obitech-reportservices/events',
		'obitech-reportservices/interactionservice',
        'obitech-reportservices/markingservice',
        'obitech-application/extendable-ui-definitions',
        'obitech-appservices/logger',
		'obitech-viz/viewdatadropinfo',
        'ojL10n!com-company-bulletViz/nls/messages',			
		'obitech-report/gadgetdialog',
        'obitech-framework/messageformat',
        'css!com-company-bulletViz/bulletVizstyles',
		'com-company-bulletViz/bullet'],
        function($,
                 jsx,
				 gadgets,
                 dataviz,
				 legendandvizcontainer,
                 datamodelshapes,
				 data,
				 vizcontext,
				 d3,
                 events,
				 interactions,
                 marking,
                 euidef,
                 logger,
				 viewdatadropinfo,
                 messages,
				 gadgetdialog
				 ) {
   "use strict";

   var MODULE_NAME = 'com-company-bulletViz/bulletViz';
   
   //Param validation to detect cyclical dependencies (ignore modules not used in resource arguments)
   jsx.assertAllNotNullExceptLastN(arguments, "bulletViz.js arguments", 2);

   var _logger = new logger.Logger(MODULE_NAME);

   // The version of our Plugin
   BulletViz.VERSION = "1.0.0";
	
   var datashapes = datamodelshapes;

   /**
    * The implementation of the bulletViz visualization.
    * 
    * @constructor
    * @param {string} sID
    * @param {string} sDisplayName
    * @param {string} sOrigin
    * @param {string} sVersion
    * @extends {module:obitech-report/visualization.Visualization}
    * @memberof module:com-company-bulletViz/bulletViz#
    */
   function BulletViz(sID, sDisplayName, sOrigin, sVersion) {
      // Argument validation done by base class
      BulletViz.baseConstructor.call(this, sID, sDisplayName, sOrigin, sVersion);
		this.Config = {
			nLow:0,
			nMedium:0,
			nHigh:0
		};

		this._saveSettings = function () {
			this.getSettings().setViewConfigJSON(dataviz.SettingsNS.CHART, this.Config);			
		};

		this.loadConfig = function () {
			var conf = this.getSettings().getViewConfigJSON(dataviz.SettingsNS.CHART) || {};
			if (conf.nLow)
				this.Config.nLow = conf.nLow;
			if (conf.nMedium)
				this.Config.nMedium = conf.nMedium;
			if (conf.nHigh)
				this.Config.nHigh = conf.nHigh;			
		}

		this.set_nLow = function (o) {
			this.Config.nLow = o;
			this._saveSettings();
		};
		
		this.set_nMedium = function (o) {
			this.Config.nMedium = o;
			this._saveSettings();
		};
		
		this.set_nHigh = function (o) {
			this.Config.nHigh = o;
			this._saveSettings();
		};
		
   };
   
   jsx.extend(BulletViz, dataviz.DataVisualization);
   
   BulletViz.prototype._generateData = function (oDataLayout,oTransientRenderingContext) {	
		var oDataModel = this.getRootDataModel();
		if (!oDataModel || !oDataLayout) {
			return;
		}
		var oDataLayoutHelper = oTransientRenderingContext.get(dataviz.DataContextProperty.DATA_LAYOUT_HELPER);
		
		var aAllMeasures = oDataModel.getColumnIDsIn(datamodelshapes.Physical.DATA);
		var Bullets = [];
		var lowvalue,midvalue, highvalue, marker;
		/******** The following lines are to determine if there's any metric on the color edge. 
		Not the best way to determine the same ******************/
		
		var oColorContext = this.getColorContext(oTransientRenderingContext);
        var oColorInterpolator = this.getCachedColorInterpolator(oTransientRenderingContext, datamodelshapes.Logical.COLOR);		
	    var oInfo = this.getDataItemColorInfo(oDataLayoutHelper, oColorContext, oColorInterpolator, 0, 0);
		var hasColor; 
		if(oInfo.sSeriesColorLabel == "")
			hasColor=false; 
		else
			hasColor=true;
		
		
		var oBullet = {
			title : "",
			secondtitle:"",
			subtitle : "",
			ranges:[],
			measures:[],
			markers:[]
		};
		
		oBullet.title=oDataLayout.getValue(datamodelshapes.Physical.COLUMN, 0, 0, false);		
		
				
		if(aAllMeasures.length==1)
		{
			oBullet.measures = [Number([oDataLayout.getValue(datamodelshapes.Physical.DATA, 0, 0, false)]).toFixed(2)];			
			oBullet.markers = [Number([oDataLayout.getValue(datamodelshapes.Physical.DATA, 0, 0, false)]).toFixed(2)];
		}	
		else if(aAllMeasures.length==2 && hasColor==false)	
		{
			oBullet.measures = [Number([oDataLayout.getValue(datamodelshapes.Physical.DATA, 0, 0, false)]).toFixed(2),
								Number([oDataLayout.getValue(datamodelshapes.Physical.DATA, 0, 1, false)]).toFixed(2)];
			oBullet.markers = [Number([oDataLayout.getValue(datamodelshapes.Physical.DATA, 0, 0, false)]).toFixed(2)];					
			oBullet.secondtitle = oDataLayout.getValue(datamodelshapes.Physical.COLUMN, 0, 1, false);				
		}
		else if(aAllMeasures.length==2 && hasColor==true)
		{
			oBullet.measures = [Number([oDataLayout.getValue(datamodelshapes.Physical.DATA, 0, 0, false)]).toFixed(2)];
			oBullet.markers = [Number([oDataLayout.getValue(datamodelshapes.Physical.DATA, 0, 1, false)]).toFixed(2)];	
			oBullet.secondtitle = oDataLayout.getValue(datamodelshapes.Physical.COLUMN, 0, 1, false);	
		}	
		else if(aAllMeasures.length==3)
		{
			oBullet.measures = [Number([oDataLayout.getValue(datamodelshapes.Physical.DATA, 0, 0, false)]).toFixed(2),
								Number([oDataLayout.getValue(datamodelshapes.Physical.DATA, 0, 1, false)]).toFixed(2)];
			oBullet.markers = [Number([oDataLayout.getValue(datamodelshapes.Physical.DATA, 0, 2, false)]).toFixed(2)];	
			oBullet.secondtitle = oDataLayout.getValue(datamodelshapes.Physical.COLUMN, 0, 1, false);	
		}
		
		if(this.Config.nLow == 0 || this.Config.nLow == "")
			lowvalue  =  Math.round(Number([oDataLayout.getValue(datamodelshapes.Physical.DATA, 0, 0, false)])/2);
		else
			lowvalue = Number(this.Config.nLow);
		
		if(this.Config.nMedium == 0 || this.Config.nMedium == "")
			midvalue  =  Math.round(Number([oDataLayout.getValue(datamodelshapes.Physical.DATA, 0, 0, false)]));
		else
			midvalue = Number(this.Config.nMedium);
		
		if(this.Config.nHigh == 0 || this.Config.nHigh == "")
			highvalue =  Math.round(Number([oDataLayout.getValue(datamodelshapes.Physical.DATA, 0, 0, false)]) * 2); 
		else
			highvalue = Number(this.Config.nHigh);
		oBullet.ranges=[(lowvalue/1000).toFixed(3) * 1000,midvalue,(Math.max(highvalue,oBullet.markers[0])/1000).toFixed(3) * 1000];
		
		Bullets.push(oBullet);
		return Bullets;
   }
   /**
    * Called whenever new data is ready and this visualization needs to update.
    * @param {module:obitech-renderingcontext/renderingcontext.RenderingContext} oTransientRenderingContext
    */
   BulletViz.prototype.render = function(oTransientRenderingContext) {
		// Note: all events will be received after initialize and start complete.  We may get other events
		// such as 'resize' before the onDataReady, i.e. this might not be the first event.
		this._render(oTransientRenderingContext);
		
     
    };
	BulletViz.prototype._render = function(oTransientRenderingContext) {
		      // Note: all events will be received after initialize and start complete.  We may get other events
      // such as 'resize' before the render, i.e. this might not be the first event.

      // Retrieve the data object for this visualization
		var oDataLayout = oTransientRenderingContext.get(dataviz.DataContextProperty.DATA_LAYOUT);
		var oData = this._generateData(oDataLayout,oTransientRenderingContext);
		if (!oData) return;
		this.loadConfig();
		var elContainer = this.getContainerElem();
		      
        $(elContainer).addClass("bulletRootContainer");
        var sVizContainerId = this.getSubElementIdFromParent(elContainer, "hvc");
        $(elContainer).html("<div id=\"" + sVizContainerId + "\" class=\"bulletVizContainer\" />");
        var elVizContainer = document.getElementById(sVizContainerId);
	    var h = $(elContainer).height()-5;
	    var w = $(elContainer).width()-5;
	  
		var margin = {top: 5, right: 40, bottom: 20, left: 120},
		width =  $(elContainer).width() - 200,
		//height =  $(elContainer).height() - 400;
		height =  40;

		var chart = d3.bullet()
		.width(width)
		.height(height);

		var svg = d3.select(elVizContainer).selectAll("svg")
			.data(oData)
			.enter().append("svg")
			.attr("class", "bullet")
			.attr("width", width + margin.left + margin.right)
			.attr("height", height + margin.top + margin.bottom)
			.append("g")
			.attr("transform", "translate(" + margin.left + "," + margin.top + ")")
			.call(chart);

		var title = svg.append("g")
			.style("text-anchor", "end")
			.attr("transform", "translate(-6," + height / 2 + ")");

			title.append("text")
			.attr("class", "title")
			.text(function(d) { return d.title; });

			title.append("text")
			.attr("class", "subtitle")
			.attr("dy", "1em")
			.text(function(d) { return d.subtitle; });

				  
        this._setIsRendered(true) ; 

	}
	
	BulletViz.prototype._addVizSpecificPropsDialog = function (oTabbedPanelsGadgetInfo) {
		this.doAddVizSpecificPropsDialog(this, oTabbedPanelsGadgetInfo);
		BulletViz.superClass._addVizSpecificPropsDialog.call(this, oTabbedPanelsGadgetInfo);
	};

	BulletViz.prototype.doAddVizSpecificPropsDialog = function (oTransientRenderingContext, oTabbedPanelsGadgetInfo) {
		jsx.assertObject(oTransientRenderingContext, "oTransientRenderingContext");
		jsx.assertInstanceOf(oTabbedPanelsGadgetInfo, gadgets.TabbedPanelsGadgetInfo, "oTabbedPanelsGadgetInfo", "obitech-application/gadgets.TabbedPanelsGadgetInfo");

		var options = this.getViewConfig() || {};
		this._fillDefaultOptions(options, null);

		var generalPanel = gadgetdialog.forcePanelByID(oTabbedPanelsGadgetInfo, euidef.GD_PANEL_ID_GENERAL);
		var oGadgetFactory = this.getGadgetFactory();
			
		var oLow = new gadgets.GadgetValueProperties(euidef.GadgetTypeIDs.TEXT_FIELD, this.Config.nLow);
        var oLowGadgetInfo = oGadgetFactory.createGadgetInfo("LowGadget", 'Low', 'Low', oLow);
        generalPanel.addChild(oLowGadgetInfo);
		
		var oMedium = new gadgets.GadgetValueProperties(euidef.GadgetTypeIDs.TEXT_FIELD, this.Config.nMedium);
        var oMediumGadgetInfo = oGadgetFactory.createGadgetInfo("MediumGadget", 'Medium', 'Medium', oMedium);
        generalPanel.addChild(oMediumGadgetInfo);

		var oHigh = new gadgets.GadgetValueProperties(euidef.GadgetTypeIDs.TEXT_FIELD, this.Config.nHigh);
        var oHighGadgetInfo = oGadgetFactory.createGadgetInfo("HighGadget", 'High', 'High', oHigh);
        generalPanel.addChild(oHighGadgetInfo);

		if (BulletViz.superClass.doAddVizSpecificPropsDialog)
			BulletViz.superClass.doAddVizSpecificPropsDialog.apply(this, arguments);
	};
	
	BulletViz.prototype._handlePropChange = function (sGadgetID, oPropChange, oViewSettings, oActionContext) {
		var updateSettings = BulletViz.superClass._handlePropChange.call(this, sGadgetID, oPropChange, oViewSettings, oActionContext);
		if (updateSettings) {
			return updateSettings; // super handled it
		}

		// Allow the super class an attempt to handle the changes
		var conf = oViewSettings.getViewConfigJSON(dataviz.SettingsNS.CHART) || {};

		if (sGadgetID === "LowGadget") {
			if (jsx.isNull(conf.nLow)) {
				conf.nLow = '';
			}
			this.set_nLow(oPropChange.value);
			updateSettings = true;
		}

		if (sGadgetID === "MediumGadget") {
			if (jsx.isNull(conf.nMedium)) {
				conf.nMedium = '';
			}
			this.set_nMedium(oPropChange.value);
			updateSettings = true;
		}
		if (sGadgetID === "HighGadget") {
			if (jsx.isNull(conf.nHigh)) {
				conf.nHigh = '';
			}
			this.set_nHigh(oPropChange.value);
			updateSettings = true;
		}
		
		return updateSettings;
	};
	
	BulletViz.prototype.resizeVisualization = function (oVizDimensions, oTransientVizContext) {
		var oTransientRenderingContext = this.createRenderingContext(oTransientVizContext);
		this._render(oTransientRenderingContext);
	};
     /* This method generates all the DropTargets for the supported logical edges
    * @param {module:obitech-report/vizcontext#VizContext} oTransientVizContext the viz context
    * @param {boolean} bEnableInlineEditors whether to enable inline editors ( e.g. inline color editor )
    * @public
    * @override
    * @returns {object} A map of logicalEdge to DropTarget instance for the edge
    */
	

   function createClientComponent(sID, sDisplayName, sOrigin) {
     // Argument validation done by base class
      return new BulletViz(sID, sDisplayName, sOrigin, BulletViz.VERSION);
   };

   return {
      createClientComponent : createClientComponent
   };
});