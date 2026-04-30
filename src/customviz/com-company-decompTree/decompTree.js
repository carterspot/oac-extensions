define([
  'jquery',
  'obitech-framework/jsx',
  'obitech-reportservices/data',
  'obitech-application/gadgets',
  'obitech-application/extendable-ui-definitions',
  'obitech-report/gadgetdialog',
  'knockout',
  'obitech-report/datavisualization',
  'obitech-legend/legendandvizcontainer',
  'obitech-reportservices/datamodelshapes',
  'd3js',
  'obitech-reportservices/events',
  'obitech-appservices/logger',
  'ojL10n!com-company-decompTree/nls/messages',
  'obitech-framework/messageformat',
  'css!com-company-decompTree/decompTreestyles'
], function(
  $, jsx, data, gadgets, euidef, gadgetdialog, ko, dataviz,
  legendandvizcontainer, datamodelshapes, d3, events, logger, messages
) {
  'use strict';

  var MODULE_NAME = 'com-company-decompTree/decompTree';
  jsx.assertAllNotNullExceptLastN(arguments, 'decompTree.js arguments', 2);
  var _logger = new logger.Logger(MODULE_NAME);

  var DEFAULTS = {
    columnWidth: 220,
    columnGap: 80,
    nodeHeight: 36,
    nodeGap: 8,
    barHeight: 14,
    labelPosition: 'under',
    showOnClick: 'children',
    headerBandHeight: 50,
    plusRadius: 9
  };

  var decompTree = {};

  DecompTree.VERSION = '1.0.0';

  function DecompTree(sID, sDisplayName, sOrigin, sVersion) {
    DecompTree.baseConstructor.call(this, sID, sDisplayName, sOrigin, sVersion);
  }
  jsx.extend(DecompTree, dataviz.DataVisualization);
  decompTree.DecompTree = DecompTree;

  decompTree.createClientComponent = function(sID, sDisplayName, sOrigin) {
    return new DecompTree(sID, sDisplayName, sOrigin, DecompTree.VERSION);
  };

  // ---- Per-viz state -------------------------------------------------------
  // Persisted via getCustomVizState/setCustomVizState so the path survives saves.
  // Shape:
  //   {
  //     selectedPath: [{ dimIdx, value }, ...],   // confirmed levels
  //     nextDim: <dimIdx or null>,                // pending column awaiting click
  //     levelDimMap: [<dimIdx>, ...]              // dim chosen at each level (parallel to columns)
  //   }
  function getState(viz) {
    var raw = viz.getCustomVizState && viz.getCustomVizState();
    var s = (raw && typeof raw === 'object') ? raw : {};
    if (!Array.isArray(s.selectedPath)) s.selectedPath = [];
    if (!Array.isArray(s.levelDimMap))  s.levelDimMap = [];
    if (typeof s.nextDim === 'undefined') s.nextDim = null;
    return s;
  }
  function setState(viz, s) {
    if (viz.setCustomVizState) viz.setCustomVizState(s);
  }

  // ---- Data extraction -----------------------------------------------------
  // Returns { rows: [{dims:[...], measure:Number}], dimNames: [...], measureName }
  // TODO: wire to real OAC dataset API once the placeholder render confirms load.
  function extractRows(viz) {
    return { rows: [], dimNames: [], measureName: '' };
  }

  // ---- Render --------------------------------------------------------------
  DecompTree.prototype._render = function(ctx) {
    try {
      var viz = this;
      var rootEl = (viz.getContainerElem && viz.getContainerElem())
        || (viz.getRootElement && viz.getRootElement());
      if (!rootEl) return;
      var $root = $(rootEl).empty().addClass('decomp-root');

      var info = extractRows(viz);
      var state = getState(viz);

      var width  = $root.width()  || 400;
      var height = $root.height() || 300;
      var svg = d3.select(rootEl).append('svg')
        .attr('width', width)
        .attr('height', height);

      if (!info.dimNames.length) {
        svg.append('text')
          .attr('x', 16).attr('y', 24)
          .attr('fill', 'currentColor')
          .text((messages && messages.DECOMPTREE_NO_DATA) || 'Drop dimensions and a measure to begin.');
        return;
      }

      if (!state.levelDimMap.length) {
        state.levelDimMap = [0];
        setState(viz, state);
      }

      svg.append('text')
        .attr('class', 'decomp-header')
        .attr('x', 16).attr('y', 24)
        .attr('fill', 'currentColor')
        .text('Decomposition Tree (skeleton) - ' + info.dimNames.length + ' dim(s), measure: ' + info.measureName);
    } finally {
      this._setIsRendered(true);
    }
  };

  DecompTree.prototype.render = function(ctx) { this._render(ctx); };

  DecompTree.prototype._isOnlyPhysicalRowEdge = function() { return false; };

  DecompTree.prototype._onDefaultColorsSettingsChanged = function() {
    var v = this.assertOrCreateVizContext();
    this._render(this.createRenderingContext(v));
  };

  DecompTree.prototype.resizeVisualization = function(dim, v) {
    this._render(this.createRenderingContext(v));
  };

  // ---- Side-panel properties ----------------------------------------------
  // Stub for v1 scaffold. Real gadgets (tree height/width, bar height,
  // label position, show-on-click) added once render is wired.
  DecompTree.prototype._addVizSpecificPropsDialog = function(oTabbedPanelsGadgetInfo) {
    DecompTree.superClass._addVizSpecificPropsDialog.call(this, oTabbedPanelsGadgetInfo);
  };

  DecompTree.prototype._handlePropChange = function(oPropChange) {
    if (typeof DecompTree.superClass._handleLegendPropChange === 'function') {
      DecompTree.superClass._handleLegendPropChange.call(this, oPropChange);
    }
    DecompTree.superClass._handlePropChange.call(this, oPropChange);
  };

  return decompTree;
});
