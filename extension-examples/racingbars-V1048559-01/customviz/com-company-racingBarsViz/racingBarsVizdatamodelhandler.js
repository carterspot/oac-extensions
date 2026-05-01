define(['obitech-framework/jsx',
        'obitech-reportservices/datamodelshapes',
        'obitech-viz/genericDataModelHandler',
        'obitech-report/vizdatamodelsmanager'],
        function(jsx, 
                 datamodelshapes,
                 genericDataModelHandler,
                 vdm) {
   "use strict";
   var racingbarsVizDataModelHandler = {};

   /**
    * @class The data model handler.
    * @constructor
    * @param {object=} oConfig
    * @param {string=} sId
    * @param {string=} sDisplayName
    * @param {string=} sOrigin
    * @param {string=} sVersion
    * @memberof module:com-company-racingbarsViz/RacingBarsVizDataModelHandler#
    * @extends module:obitech-viz/vizDataModelHandlerBase#VisualizationHandlerBase
    */
   function RacingBarsVizDataModelHandler(oConfig, sId, sDisplayName, sOrigin, sVersion)
   {
      RacingBarsVizDataModelHandler.baseConstructor.call(this, oConfig, sId, sDisplayName, sOrigin, sVersion);
   }
   jsx.extend(RacingBarsVizDataModelHandler, genericDataModelHandler.GenericDataModelHandler);
   racingbarsVizDataModelHandler.RacingBarsVizDataModelHandler = RacingBarsVizDataModelHandler;

   /**
    * @returns module:obitech-report/vizdatamodelsmanager#Mapper
    */
   RacingBarsVizDataModelHandler.prototype.getLogicalMapper = function () {
      var oData = new datamodelshapes.PhysicalPlacement(datamodelshapes.Physical.DATA);
      var oRow = new datamodelshapes.PhysicalPlacement(datamodelshapes.Physical.ROW);
      var oCol = new datamodelshapes.PhysicalPlacement(datamodelshapes.Physical.COLUMN);

      var oMapper = new vdm.Mapper();

      oMapper.addCategoricalMapping(datamodelshapes.Logical.SIZE,   null); // don't place
      oMapper.addCategoricalMapping(datamodelshapes.Logical.COLOR,  oRow); // color -> row
      oMapper.addCategoricalMapping(datamodelshapes.Logical.ROW, oRow); // row -> row
      oMapper.addCategoricalMapping(datamodelshapes.Logical.CATEGORY, oRow); // det -> row

      oMapper.addMeasureMapping(datamodelshapes.Logical.SIZE,   oRow); // Don't place
      oMapper.addMeasureMapping(datamodelshapes.Logical.COLOR,  oRow); // Don't place
      oMapper.addMeasureMapping(datamodelshapes.Logical.MEASURES, oData);
      oMapper.addMeasureMapping(datamodelshapes.Logical.CATEGORY, oRow); // ''

      // where to place physical measure label in case no measure layer is present in logical
      oMapper.setDefaultPhysicalMeasureLabel(datamodelshapes.Physical.COLUMN, this.getMeasureLabelConfig().visibility);
      return oMapper;
   };

   /**
    * Returns the handler
    *@param {String} extensionPointName
    *@param {Object} config
    */
   racingbarsVizDataModelHandler.getHandler = function(extensionPointName, config) {
      return new RacingBarsVizDataModelHandler(config, extensionPointName);
   };

   return racingbarsVizDataModelHandler;
});
