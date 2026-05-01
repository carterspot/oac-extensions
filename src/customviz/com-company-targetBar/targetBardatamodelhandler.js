define([
  'obitech-framework/jsx',
  'obitech-reportservices/datamodelshapes',
  'obitech-reportservices/datavisualizationhandlerutils'
], function(jsx, datamodelshapes, dvHandlerUtils) {
  'use strict';

  var handler = {};

  handler.getHandler = function(config) {
    var base = dvHandlerUtils.createDefaultDataVisualizationHandler(config);
    return base;
  };

  return handler;
});
