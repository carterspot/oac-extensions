define(['jquery',
		'obitech-framework/jsx',
		'obitech-report/datavisualization',
		'obitech-reportservices/datamodelshapes',
		'obitech-reportservices/data',
		'obitech-reportservices/events',
		'obitech-appservices/logger',
		'ojL10n!com-company-calendarViz/nls/messages',
		'knockout', 'ojs/ojbootstrap', 'ojs/ojarraydataprovider',
		'ojs/ojattributegrouphandler',
		'ojs/ojpalette', 'ojs/ojpaletteutils',
		'obitech-application/extendable-ui-definitions',
		'obitech-application/gadgets',
		'obitech-report/gadgetdialog',
		'ojs/ojknockout', 'ojs/ojpictochart', 'ojs/ojlegend',
		'obitech-framework/messageformat',
		'css!com-company-calendarViz/calendarVizstyles'],
	function($,
			 jsx,
			 dataviz,
			 datamodelshapes,
			 data,
			 events,
			 logger,
			 messages,
			 ko, bootstrap, ArrayDataProvider,
			 AttributeGroupHandler,
			 ojpalette_1, ojpaletteutils_1,
			 euidef, gadgets, gadgetdialog) {
		"use strict";

		var MODULE_NAME = 'com-company-calendarViz/calendarViz';

		//Param validation to detect cyclical dependencies (ignore modules not used in resource arguments)
		//jsx.assertAllNotNullExceptLastN(arguments, "calendarViz.js arguments", 2);

		var _logger = new logger.Logger(MODULE_NAME);
		var inputValues = [];
		var value_column = "Value";
		const months = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
		//var colororder = 'Green-to-Red';

		// The version of our Plugin
		CalendarViz.VERSION = "1.0.0";

		/**
		 * The implementation of the calendarViz visualization.
		 *
		 * @constructor
		 * @param {string} sID
		 * @param {string} sDisplayName
		 * @param {string} sOrigin
		 * @param {string} sVersion
		 * @extends {module:obitech-report/visualization.Visualization}
		 * @memberof module:com-company-calendarViz/calendarViz#
		 */
		function CalendarViz(sID, sDisplayName, sOrigin, sVersion) {
			// Argument validation done by base class
			CalendarViz.baseConstructor.call(this, sID, sDisplayName, sOrigin, sVersion);

			this.Config = {
				colororder : 'Green-to-Red'
			};

			this._saveSettings = function () {
				this.getSettings().setViewConfigJSON(dataviz.SettingsNS.CHART, this.Config);
			};

			this.loadConfig = function () {
				var conf = this.getSettings().getViewConfigJSON(dataviz.SettingsNS.CHART) || {};
				if (conf.colororder)
					this.Config.colororder = conf.colororder;
			}

			this.setColorOrder = function (o) {
				this.Config.colororder = o;
				this._saveSettings();
			};
		};
		jsx.extend(CalendarViz, dataviz.DataVisualization);
		/**
		 * Called whenever new data is ready and this visualization needs to update.
		 * @param {module:obitech-renderingcontext/renderingcontext.RenderingContext} oTransientRenderingContext
		 */
		CalendarViz.prototype._generateData = function(oDataLayout){

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
			value_column = nMeasures > 0 ? aAllMeasures[0] : "Value";

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
			var aOutput = [];
			var dateArray = [];
			var index = 0;
			if(nRows > 0 || nCols > 0){
				var nRow, nCol;
				for(nRow=0; nRow < Math.max(nRows, 1); nRow++){
					var prevDate = '', prevValue = 0, totalValue;
					var aggData = [];
					for(nCol=0; nCol < Math.max(nCols, 1); nCol++){
						var oNode = {};
						var sValue = oDataLayout.getValue(datamodelshapes.Physical.DATA, nRow, nCol);
						var dt = oDataLayout.getValue(datamodelshapes.Physical.ROW, 0, nRow, false);
						var d = new Date(dt);
						if(!jsx.isNull(sValue) && sValue.length > 0 &&
							Object.prototype.toString.call(d) === "[object Date]" && !isNaN(d.valueOf())
						){
							oNode.id = index;
							var date=new Date(dt);
							dateArray[index] = date
							sValue = sValue ? sValue : '';
							var f_date = date.getFullYear()+"-"+(date.getMonth()+1)+"-"+date.getDate();
							oNode.date = f_date;
							oNode.value = sValue;
							aOutput.push(oNode);
							index++;
						}
					}
				}
			}

			const inputData = aOutput.reduce((resMap, obj) => {
				//const date = new Date(obj.date).toISOString().split('T')[0];
				if (resMap[obj.date] !== undefined)
					resMap[obj.date] += parseFloat(obj.value);
				else
					resMap[obj.date] = parseFloat(obj.value);

				return resMap;
			}, {});

			inputValues = Object.values(inputData);
			const inputKey = Object.keys(inputData);
			const maxDate=new Date(Math.max.apply(null,dateArray));
			const max_year = maxDate.getFullYear();
			const max_month = maxDate.getMonth();
			const minDate=new Date(Math.min.apply(null,dateArray));
			const min_year = minDate.getFullYear();
			const min_month = minDate.getMonth();

			function getDaysInMonth(year, month){
				return new Date(year, month, 0).getDate();
			}
			var calData = [];
			var monthData = [];
			for (var year = min_year; year <= max_year; year++){
				for(var month = 0; month < 12; month++){
					if(year == min_year && month < min_month){
						continue;
					}
					if(year == max_year && month > max_month){
						break;
					}
					var month_year = months[month]+' '+year;
					var dateList = [];
					for (var _date = 1; _date <=  getDaysInMonth(year, month+1); _date++){
						var jsonObj = {date:'', value:''};
						//var month1 = month+1;
						//('0' + MyDate.getDate()).slice(-2)
						//month1 = ('0'+month1).slice(-2);
						//_date = ('0'+_date).slice(-2);
						var full_date = year+'-'+(month+1)+'-'+_date;
						jsonObj.date = _date;
						var date_index = inputKey.indexOf(full_date);
						if(date_index != -1){
							jsonObj.value = parseInt(inputValues[date_index]);
						} else {
							jsonObj.value = '';
						}
						dateList.push(jsonObj);
					}
					monthData[month_year] = dateList;
				}
			}

			if (monthData)
				return monthData;
			else
				return null;
		}
		CalendarViz.prototype.render = function(oTransientRenderingContext) {
			try {
				// Note: all events will be received after initialize and start complete.  We may get other events
				// such as 'resize' before the render, i.e. this might not be the first event.

				// Retrieve the data object for this visualization
				var oDataLayout = oTransientRenderingContext.get(dataviz.DataContextProperty.DATA_LAYOUT);
				if (!oDataLayout)
					return;
				var calData = this._generateData(oDataLayout);
				var titleArray = [];
				Object.keys(calData).forEach(key => {
					titleArray.push(key);
				});

				this.loadConfig();

				// Retrieve the root container for our visualization.  This is provided by the framework.  It may not be deleted
				// but may be used to render.
				var elContainer = this.getContainerElem();
				elContainer.innerHTML = '';
				var height = $(elContainer).height();
				var width = $(elContainer).width();
				var calContainerDiv = document.createElement('div');
				elContainer.style.overflow = "auto";
				var htmlContent = "<div id=\"chart-container\" class=\"oj-sm-padding-2x-horizontal\">"+
					"            <div style='height: 30px;'><oj-legend\n" +
					"              id=\"legend1\"\n" +
					"              class=\"oj-sm-padding-2x-horizontal demo-datavisualizations-blockcalendar-style\"\n" +
					"              orientation=\"horizontal\"\n" +
					"              data=\"[[legendDataProvider]]\"\n" +
					"              symbol-width=\"15\"\n" +
					"              symbol-height=\"15\">" +
					"              <template slot=\"itemTemplate\" data-oj-as=\"item\">" +
					"                <oj-legend-item text=\"[[item.data.text]]\" color=\"[[item.data.color]]\"></oj-legend-item>" +
					"              </template>" +
					"            </oj-legend></div>" +
					"            <div class=\"oj-flex oj-sm-flex-items-initial\">" ;
				for (var i = 0; i < titleArray.length; i++) {
					htmlContent +=
						"              <div class=\"oj-flex-item\">\n" +
						"                <div class=\"oj-typography-body-sm oj-typography-bold oj-sm-margin-4x-vertical\">"+titleArray[i]+"</div>\n" +
						"                <div class=\"oj-sm-margin-4x-start oj-sm-margin-3x-end demo-datavisualizations-blockcalendar-wordspacing\">\n" +
						"                  <div style='word-spacing:7px;'>S M T W T F S</div>" +
						"                </div>\n" +
						"                <oj-picto-chart\n" +
						"                  id=\"pictochart3\"\n" +
						"                  data=\"[[ dataProvider["+i+"] ]]\"\n" +
						"                  layout=\"horizontal\"\n" +
						"                  row-height=\"20\"\n" +
						"                  column-count=\"7\">\n" +
						"                  <template slot=\"itemTemplate\" data-oj-as=\"item\">\n" +
						"                    <oj-picto-chart-item\n" +
						"                      short-desc='[[getTooltip(\""+titleArray[i]+"\", item.data.date, item.data.value)]]'\n" +
						"                      color=\"[[getColor(item.data.date,item.data.value)]]\"></oj-picto-chart-item>\n" +
						"                  </template>" +
						"                </oj-picto-chart>" +
						"             </div>" ;
				}
				htmlContent += "          </div></div>";
				calContainerDiv.innerHTML = htmlContent;
				elContainer.appendChild(calContainerDiv);

				var bins, tiles, ftiles;
				function formatNumber(num){
					return Intl.NumberFormat('en-US', {
						notation: "compact",
						maximumFractionDigits: 1
					}).format(num);
				}
				function computeBins(calData){
					calData.sort(function (a, b) {
						return ('' + a).localeCompare(b, 'en', { numeric: true });
					});

					//var min = Math.min(...calData);
					var max = Math.max(...calData);
					var temp;
					if(calData.length <= 4){
						tiles = [max * 0.2, max * 0.4, max * 0.6, max * 0.8 ];
						ftiles = [
							formatNumber(tiles[0]),
							formatNumber(tiles[1]),
							formatNumber(tiles[2]),
							formatNumber(tiles[3])
						];

					}
					else if(calData.length > 4){
						temp = [
							Math.floor(calData.length*.2) - 1,
							Math.floor(calData.length*.4) - 1,
							Math.floor(calData.length*.6) - 1,
							Math.floor(calData.length*.8) - 1
						];

						tiles = [
							calData[temp[0]],
							calData[temp[1]],
							calData[temp[2]],
							calData[temp[3]]
						];

						ftiles = [
							formatNumber(calData[temp[0]]),
							formatNumber(calData[temp[1]]),
							formatNumber(calData[temp[2]]),
							formatNumber(calData[temp[3]])
						];
					}
					else {
						return;
					}

					bins =['< '+ftiles[0],
						ftiles[0]+'-'+ftiles[1],
						ftiles[1]+'-'+ftiles[2],
						ftiles[2]+'-'+ftiles[3],
						'> '+ftiles[3]];
					return bins;
				}

				function roundOff(d) {var round = Number.isInteger(d) ? d : +d.toFixed(2); return round;}
				function numSeparator(num)
				{
					var num_parts = num.toString().split(".");
					num_parts[0] = num_parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, ",");
					return num_parts.join(".");
				}

				var color_order = this.Config.colororder;
				/*
                  Assign the values from 'self' object to ChartModel object, this is a requirement of latest JET library.
                  */
				//var _this = self;
				function ChartModel() {
					this.data = calData;
					this.legendItems = [];
					this.temp = computeBins(inputValues);

					this.getPictoItems = (month) => {
						let yyyy = month.substring(month.indexOf(' ')+1);
						let mm = month.substring(0, month.indexOf(' '))
						let parseDate = new Date(parseInt(yyyy), months.indexOf(mm), 1);
						// =  Date.parse(yyyy+'/'+mm+'/01');
						let offset = new Date(parseDate).getDay();

						const padItems = [];
						for (let i = 0; i < offset; i++) {
							padItems.push({ date: 0, value: null });
						}
						return padItems.concat(this.data[month]);
					};
					this.dataProvider = [];
					this.titleArray = [];
					Object.keys(this.data).forEach(key => {
						//console.log(key, this.data[key]);
						titleArray.push(key);
						this.dataProvider.push(new ArrayDataProvider(this.getPictoItems(key), { keyAttributes: "date" }));
					});
					this.legendDataProvider = new ArrayDataProvider(this.legendItems, {
						keyAttributes: "text",
					});
					this.getTooltip = (month, date, value) => {
						//value = numSeparator(roundOff(value));
						if(!value){
							value = 0;
							return date === 0
								? ""
								: `${month} ${date.toString()} [${value_column}: - ]`;
						}
						else {
							value = parseFloat(value);
							value = numSeparator(roundOff(value));
							return date === 0
								? ""
								: `${month} ${date.toString()}  [${value_column}: ${value}]`;

						}

						//console.log(`${month} ${date.toString()}  [${value_column}: ${value}]`);

					};
					this.colors = ["#009933", "#a2bf39", "#fad55c", "#ffb54d", "#ed6647"];
					this.getColor = function (d,v){
						if(!d && v===null){
							return "rgba(0,0,0,0)";
						}
						if(v === ''){
							return "#D3D3D3";
						}
						//var c = Math.floor(v/10000);
						var c=0;
						//v = formatNumber(v);
						//v = parseFloat(v);
						if (v<=tiles[0]) { c=0; }
						else if (v>tiles[0] && v<=tiles[1]) { c=1; }
						else if (v>tiles[1] && v<=tiles[2]) { c=2; }
						else if (v>tiles[2] && v<=tiles[3]) { c=3; }
						else if (v>tiles[3]) { c=4; }

						if (color_order== 'Green-to-Red'){
							return this.colors[c];
						} else {
							return this.colors[4-c];
						}
					}
					for (let i = 0; i < this.temp.length; i++) {
						if (color_order== 'Green-to-Red'){
							this.legendItems.push({ text: this.temp[i], color: this.colors[i] });
						} else{
							this.legendItems.push({ text: this.temp[i], color: this.colors[this.colors.length-i-1] });
						}
					}
				};

				/*
                Binding step needs to be inside bootstrap's whenDocumentReady block as a new requirement for latest JET version.
                */
				bootstrap.whenDocumentReady().then(
					function()
					{
						ko.applyBindings(new ChartModel(), calContainerDiv);
					}
				);
			}
			finally {
				this._setIsRendered(true);
			}
		};

		/**
		 * Resize the visualization
		 * @param {Object} oVizDimensions - contains two properties, width and height
		 * @param {module:obitech-report/vizcontext#VizContext} oTransientVizContext the viz context
		 */
		CalendarViz.prototype.resizeVisualization = function(oVizDimensions, oTransientVizContext){
			var oTransientRenderingContext = this.createRenderingContext(oTransientVizContext);
			this.render(oTransientRenderingContext);
		};


		CalendarViz.prototype._addVizSpecificPropsDialog = function(oTabbedPanelsGadgetInfo){
			this.doAddVizSpecificPropsDialog(this, oTabbedPanelsGadgetInfo);
			CalendarViz.superClass._addVizSpecificPropsDialog.call(this, oTabbedPanelsGadgetInfo);
		};

		CalendarViz.prototype.doAddVizSpecificPropsDialog = function (oTransientRenderingContext, oTabbedPanelsGadgetInfo) {
			jsx.assertObject(oTransientRenderingContext, "oTransientRenderingContext");
			jsx.assertInstanceOf(oTabbedPanelsGadgetInfo, gadgets.TabbedPanelsGadgetInfo, "oTabbedPanelsGadgetInfo", "obitech-application/gadgets.TabbedPanelsGadgetInfo");

			var options = this.getViewConfig() || {};
			this._fillDefaultOptions(options, null);

			var generalPanel = gadgetdialog.forcePanelByID(oTabbedPanelsGadgetInfo, euidef.GD_PANEL_ID_GENERAL);

			var colVales = [];
			colVales.push(new gadgets.OptionInfo('Green-to-Red','Green-to-Red'));
			colVales.push(new gadgets.OptionInfo('Red-to-Green','Red-to-Green'));

			var oOrientTypeGVP = new gadgets.GadgetValueProperties(euidef.GadgetTypeIDs.TEXT_SWITCHER, this.Config.colororder);
			var oOrientTypeGadgetInfo = new gadgets.TextSwitcherGadgetInfo("colOrderTypeGadget", 'Color Order', 'Color Order', oOrientTypeGVP, euidef.GD_FIELD_ORDER_GENERAL_LINE_TYPE, false, colVales);
			generalPanel.addChild(oOrientTypeGadgetInfo);

			if (CalendarViz.superClass.doAddVizSpecificPropsDialog)
				CalendarViz.superClass.doAddVizSpecificPropsDialog.apply(this, arguments);
		};


		CalendarViz.prototype._handlePropChange = function (sGadgetID, oPropChange, oViewSettings, oActionContext){
			var updateSettings = CalendarViz.superClass._handlePropChange.call(this, sGadgetID, oPropChange, oViewSettings, oActionContext);
			if (updateSettings) {
				return updateSettings; // super handled it
			}

			// Allow the super class an attempt to handle the changes
			var conf = oViewSettings.getViewConfigJSON(dataviz.SettingsNS.CHART) || {};

			if (sGadgetID === "colOrderTypeGadget")
			{
				if (jsx.isNull(conf.styleDefaults))
				{
					conf.styleDefaults = {};
				}
				this.setColorOrder(oPropChange.value);
				updateSettings = true;
			}

			return updateSettings;
		};

		/**
		 * Factory method declared in the plugin configuration
		 * @param {string} sID Component ID for the visualization
		 * @param {string=} sDisplayName Component display name
		 * @param {string=} sOrigin Component host identifier
		 * @param {string=} sVersion
		 * @returns {module:com-company-calendarViz/calendarViz.CalendarViz}
		 * @memberof module:com-company-calendarViz/calendarViz
		 */
		function createClientComponent(sID, sDisplayName, sOrigin) {
			// Argument validation done by base class
			return new CalendarViz(sID, sDisplayName, sOrigin, CalendarViz.VERSION);
		};

		return {
			createClientComponent : createClientComponent
		};
	});