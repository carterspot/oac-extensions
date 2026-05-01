define([
  'obitech-framework/jsx',
  'obitech-reportservices/datamodelshapes',
  'obitech-viz/genericDataModelHandler',
  'obitech-report/vizdatamodelsmanager'
], function(jsx, datamodelshapes, genericDataModelHandler, vdm) {
  'use strict';
  var targetBarDataModelHandler = {};

  function TargetBarDataModelHandler(oConfig, sId, sDisplayName, sOrigin, sVersion) {
    TargetBarDataModelHandler.baseConstructor.call(
      this, oConfig, sId, sDisplayName, sOrigin, sVersion
    );
  }
  jsx.extend(TargetBarDataModelHandler, genericDataModelHandler.GenericDataModelHandler);
  targetBarDataModelHandler.TargetBarDataModelHandler = TargetBarDataModelHandler;

  TargetBarDataModelHandler.prototype.getLogicalMapper = function() {
    var oData = new datamodelshapes.PhysicalPlacement(datamodelshapes.Physical.DATA);
    var oRow  = new datamodelshapes.PhysicalPlacement(datamodelshapes.Physical.ROW);

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

    oMapper.setDefaultPhysicalMeasureLabel(
      datamodelshapes.Physical.COLUMN,
      this.getMeasureLabelConfig().visibility
    );

    return oMapper;
  };

  targetBarDataModelHandler.getHandler = function(extensionPointName, config) {
    return new TargetBarDataModelHandler(config, extensionPointName);
  };

  return targetBarDataModelHandler;
});
