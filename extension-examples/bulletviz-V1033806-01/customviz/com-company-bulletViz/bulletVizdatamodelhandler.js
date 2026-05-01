define(
[
   'obitech-framework/jsx',
   'obitech-appservices/logger',
   'obitech-reportservices/datamodelshapes',
   'obitech-reportservices/logicalDataModel',
   "obitech-dvtchart/dvtChartDataModelHandler",
   'obitech-report/vizdatamodelsmanager',
   'obitech-reportservices/datamodelshapes',
   'obitech-viz/genericDataModelHandler',
], 
function (jsx,
          logger,
          datamodelshapes,
          logicalDataModel,
          dvtChartDataModelHandler,
          vdm,
          datashapes,
		  genericDataModelHandler) {
   "use strict";
   var bulletVizDataModelHandler = {};

   /**
    * @class The data model handler.
    * @constructor
    * @param {object=} oConfig
    * @param {string=} sId
    * @param {string=} sDisplayName
    * @param {string=} sOrigin
    * @param {string=} sVersion
    * @memberof module:com-company-bulletViz/BulletVizDataModelHandler#
    * @extends module:obitech-viz/vizDataModelHandlerBase#VisualizationHandlerBase
    */
   function BulletVizDataModelHandler(oConfig, sId, sDisplayName, sOrigin, sVersion)
   {
      BulletVizDataModelHandler.baseConstructor.call(this, oConfig, sId, sDisplayName, sOrigin, sVersion);
   }
   jsx.extend(BulletVizDataModelHandler, genericDataModelHandler.GenericDataModelHandler);
   bulletVizDataModelHandler.BulletVizDataModelHandler = BulletVizDataModelHandler;
   
   /**
    * @returns module:obitech-report/vizdatamodelsmanager#Mapper
    */
   BulletVizDataModelHandler.prototype.getLogicalMapper = function () {
      var oData = new datamodelshapes.PhysicalPlacement(datamodelshapes.Physical.DATA);
      var oRow = new datamodelshapes.PhysicalPlacement(datamodelshapes.Physical.ROW);
      var oCol = new datamodelshapes.PhysicalPlacement(datamodelshapes.Physical.COLUMN);

      var oMapper = new vdm.Mapper();

      oMapper.addCategoricalMapping(datamodelshapes.Logical.SIZE,   null); // don't place
      oMapper.addCategoricalMapping(datamodelshapes.Logical.COLOR,  oRow); // color -> row
      oMapper.addCategoricalMapping(datamodelshapes.Logical.ROW, oRow); // row -> row

      oMapper.addMeasureMapping(datamodelshapes.Logical.SIZE,   null); // Don't place
      oMapper.addMeasureMapping(datamodelshapes.Logical.COLOR,  oData); // Don't place
      oMapper.addMeasureMapping(datamodelshapes.Logical.MEASURES, oData);

      // where to place physical measure label in case no measure layer is present in logical
      oMapper.setDefaultPhysicalMeasureLabel(datamodelshapes.Physical.COLUMN, this.getMeasureLabelConfig().visibility);

      return oMapper;
   };

   /**
    * Returns the handler
    *@param {String} extensionPointName
    *@param {Object} config
    */
   bulletVizDataModelHandler.getHandler = function(extensionPointName, config) {
      return new BulletVizDataModelHandler(config, extensionPointName);
   };
	
   return bulletVizDataModelHandler;
});
