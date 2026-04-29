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

  function DecompTree() {
    DecompTree.baseConstructor.apply(this, arguments);
  }
  jsx.extend(DecompTree, dataviz.DataVisualization);
  decompTree.DecompTree = DecompTree;

  decompTree.createClientComponent = function() {
    return DecompTree;
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
  DecompTree.prototype._render = function() {
    var viz = this;
    var rootEl = viz.getRootElement && viz.getRootElement();
    if (!rootEl) return;
    var $root = $(rootEl).empty().addClass('decomp-root');

    var info = extractRows(viz);
    var state = getState(viz);

    if (!info.dimNames.length) {
      $root.append(
        $('<div class="decomp-empty"></div>').text(messages.DECOMPTREE_NO_DATA)
      );
      return;
    }

    // Default level→dim mapping: first unused dim slot, in order.
    if (!state.levelDimMap.length) {
      state.levelDimMap = [0];
      setState(viz, state);
    }

    // Columns to render: one per level in the path + one for the active tip column.
    // For now we just stub a single column so the load path is verified end to end.
    var width  = $root.width();
    var height = $root.height();
    var svg = d3.select(rootEl).append('svg')
      .attr('width', width)
      .attr('height', height);

    svg.append('text')
      .attr('class', 'decomp-header')
      .attr('x', 16).attr('y', 24)
      .text('Decomposition Tree (skeleton) — ' + info.dimNames.length + ' dim(s), measure: ' + info.measureName);
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
