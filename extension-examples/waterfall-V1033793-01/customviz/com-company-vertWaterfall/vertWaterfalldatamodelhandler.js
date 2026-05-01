define([
  'obitech-framework/jsx',
  'obitech-reportservices/datamodelshapes',
  'obitech-viz/genericDataModelHandler',
  'obitech-report/vizdatamodelsmanager'
], function(jsx, datamodelshapes, genericDataModelHandler, vdm) {
  'use strict';
  var vertWaterfallDataModelHandler = {};

  /**
   * @class The data model handler.
   * @constructor
   * @param {object=} oConfig
   * @param {string=} sId
   * @param {string=} sDisplayName
   * @param {string=} sOrigin
   * @param {string=} sVersion
   * @memberof module:com-company-vertWaterfall/VertWaterfallDataModelHandler#
   * @extends module:obitech-viz/vizDataModelHandlerBase#VisualizationHandlerBase
   */
  function VertWaterfallDataModelHandler(
    oConfig,
    sId,
    sDisplayName,
    sOrigin,
    sVersion
  ) {
    VertWaterfallDataModelHandler.baseConstructor.call(
      this,
      oConfig,
      sId,
      sDisplayName,
      sOrigin,
      sVersion
    );
  }
  jsx.extend(
    VertWaterfallDataModelHandler,
    genericDataModelHandler.GenericDataModelHandler
  );
  vertWaterfallDataModelHandler.VertWaterfallDataModelHandler = VertWaterfallDataModelHandler;

  /**
   * @returns module:obitech-report/vizdatamodelsmanager#Mapper
   */
  VertWaterfallDataModelHandler.prototype.getLogicalMapper = function() {
    var oData = new datamodelshapes.PhysicalPlacement(
      datamodelshapes.Physical.DATA
    );
    var oRow = new datamodelshapes.PhysicalPlacement(
      datamodelshapes.Physical.ROW
    );
    var oCol = new datamodelshapes.PhysicalPlacement(
      datamodelshapes.Physical.COLUMN
    );

    var oMapper = new vdm.Mapper();

    oMapper.addCategoricalMapping(datamodelshapes.Logical.SIZE, null); // don't place
    oMapper.addCategoricalMapping(datamodelshapes.Logical.COLOR, oRow); // color -> row
    oMapper.addCategoricalMapping(datamodelshapes.Logical.ROW, oRow); // row -> row
    oMapper.addCategoricalMapping(datamodelshapes.Logical.CATEGORY, oRow);

    oMapper.addMeasureMapping(datamodelshapes.Logical.SIZE, null); // Don't place
    oMapper.addMeasureMapping(datamodelshapes.Logical.COLOR, oRow); // Don't place
    oMapper.addMeasureMapping(datamodelshapes.Logical.MEASURES, oData);
    oMapper.addMeasureMapping(datamodelshapes.Logical.CATEGORY, oRow); //det->place

    oMapper.addAdvancedAnalyticsMapping(
      datamodelshapes.Logical.COLOR,
      null,
      null
    );

    // where to place physical measure label in case no measure layer is present in logical
    oMapper.setDefaultPhysicalMeasureLabel(
      datamodelshapes.Physical.COLUMN,
      this.getMeasureLabelConfig().visibility
    );

    return oMapper;
  };

  /**
   * Returns the handler
   *@param {String} extensionPointName
   *@param {Object} config
   */
  vertWaterfallDataModelHandler.getHandler = function(
    extensionPointName,
    config
  ) {
    return new VertWaterfallDataModelHandler(config, extensionPointName);
  };

  return vertWaterfallDataModelHandler;
});
