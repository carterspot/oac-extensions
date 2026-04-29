define([
  'obitech-framework/jsx',
  'obitech-reportservices/datamodelshapes',
  'obitech-viz/genericDataModelHandler',
  'obitech-report/vizdatamodelsmanager'
], function(jsx, datamodelshapes, genericDataModelHandler, vdm) {
  'use strict';
  var advWaterfallDataModelHandler = {};

  function AdvWaterfallDataModelHandler(oConfig, sId, sDisplayName, sOrigin, sVersion) {
    AdvWaterfallDataModelHandler.baseConstructor.call(this, oConfig, sId, sDisplayName, sOrigin, sVersion);
  }
  jsx.extend(AdvWaterfallDataModelHandler, genericDataModelHandler.GenericDataModelHandler);
  advWaterfallDataModelHandler.AdvWaterfallDataModelHandler = AdvWaterfallDataModelHandler;

  AdvWaterfallDataModelHandler.prototype.getLogicalMapper = function() {
    var oData = new datamodelshapes.PhysicalPlacement(datamodelshapes.Physical.DATA);
    var oRow = new datamodelshapes.PhysicalPlacement(datamodelshapes.Physical.ROW);
    var oMapper = new vdm.Mapper();

    oMapper.addCategoricalMapping(datamodelshapes.Logical.SIZE, null);
    oMapper.addCategoricalMapping(datamodelshapes.Logical.COLOR, oRow);
    oMapper.addCategoricalMapping(datamodelshapes.Logical.ROW, oRow);
    oMapper.addCategoricalMapping(datamodelshapes.Logical.CATEGORY, oRow);

    oMapper.addMeasureMapping(datamodelshapes.Logical.SIZE, null);
    oMapper.addMeasureMapping(datamodelshapes.Logical.COLOR, oRow);
    oMapper.addMeasureMapping(datamodelshapes.Logical.MEASURES, oData);
    oMapper.addMeasureMapping(datamodelshapes.Logical.CATEGORY, oRow);

    oMapper.addAdvancedAnalyticsMapping(datamodelshapes.Logical.COLOR, null, null);
    oMapper.setDefaultPhysicalMeasureLabel(datamodelshapes.Physical.COLUMN, this.getMeasureLabelConfig().visibility);
    return oMapper;
  };

  advWaterfallDataModelHandler.getHandler = function(extensionPointName, config) {
    return new AdvWaterfallDataModelHandler(config, extensionPointName);
  };

  return advWaterfallDataModelHandler;
});
