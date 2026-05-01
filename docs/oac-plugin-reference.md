# OAC Custom Viz Plugin Reference

What you actually need to ship a working OAC custom visualization plugin. Built from the live `advWaterfall`, the Oracle samples in [`extension-examples/`](../extension-examples/), and the [SDK JavaScript Reference](https://docs.oracle.com/en/cloud/paas/analytics-cloud/acsjs/). Read [PANEL-API-NOTES.md](PANEL-API-NOTES.md) for the gadget framework deep dive — this doc is the surrounding scaffold.

## File layout

```
src/customviz/<plugin-id>/
├── plugin.xml                 # registration, edge cardinalities, version
├── <pluginName>.js            # AMD module: ClientComponent + render
├── <pluginName>datamodelhandler.js   # edge → role mappings
├── <pluginName>styles.css     # styles bundled via css! loader
├── <pluginName>Icon.png       # toolbar icon
└── nls/
    ├── messages.js            # ojL10n shim (re-exports root)
    └── root/messages.js       # default-locale strings
```

`<plugin-id>` convention: `com-company-<vizName>`. The folder name, plugin.xml `id`, and AMD module path must agree.

## plugin.xml essentials

- `version` is a lexical string (`1.0.0.<epoch-ms>`). Bump on every Console upload — installed > devDir.
- Each `<resource>` `id` matches its filename (no extension). Add a `<resource type="binary">` for the icon.
- `<extension point-id="oracle.bi.tech.plugin.visualization">` configuration JSON wires:
  - `host.script.module` → AMD module path
  - `host.script.method` → factory function (typically `createClientComponent`)
  - `vizSettings.viewConfig.viz:chart.type` → unique chart type ID (used in saved viewConfig)
  - `properties.dataModelHandler` → datamodelhandler extension ID
  - `properties.icon` → resource id of the PNG
- `<extension point-id="oracle.bi.tech.plugin.visualizationDatamodelHandler">` configuration JSON wires `module`/`method` and the `edgeConfig` (rows/measures/color/size/glyph/detail with min/maxCount and `contentType`).

## Render lifecycle — the things that broke decompTree

`createClientComponent` **must return a new instance**, not the class:

```js
decompTree.createClientComponent = function(sID, sDisplayName, sOrigin) {
  return new DecompTree(sID, sDisplayName, sOrigin, DecompTree.VERSION);
};
```

Constructor calls `baseConstructor`, prototype extends `dataviz.DataVisualization`:

```js
function DecompTree(sID, sDisplayName, sOrigin, sVersion) {
  DecompTree.baseConstructor.call(this, sID, sDisplayName, sOrigin, sVersion);
}
jsx.extend(DecompTree, dataviz.DataVisualization);
```

`_render(ctx)` **must call `this._setIsRendered(true)` before returning**, even on no-data early-outs. Wrap in try/finally:

```js
DecompTree.prototype._render = function(ctx) {
  try { /* draw */ } finally { this._setIsRendered(true); }
};
DecompTree.prototype.render = function(ctx) { this._render(ctx); };  // public wrapper required
```

Required prototype stubs:

- `_isOnlyPhysicalRowEdge()` → `false` for most vizzes
- `_onDefaultColorsSettingsChanged()` → re-render via `this._render(this.createRenderingContext(this.assertOrCreateVizContext()))`
- `resizeVisualization(dim, v)` → `this._render(this.createRenderingContext(v))`

Skipping any of these silently fails to load with the *"does not invoke `_setIsRendered` or the parent render function"* error.

## Properties panel

See [PANEL-API-NOTES.md](PANEL-API-NOTES.md). Summary: use `gadgetdialog.forcePanelByID(info, euidef.GD_PANEL_ID_STYLE)`, never construct `PanelGadgetInfo` directly. Gadget IDs cannot contain dots. Slider/Checkbox/ColorPicker need their *specific* `*GadgetValueProperties` subclass with `ariaLabel` for any gadget whose template binds it. End `_addVizSpecificPropsDialog` with the super call.

`_handlePropChange` guards `_handleLegendPropChange` with `typeof === 'function'`, then calls `superClass._handlePropChange.call(this, oPropChange)`.

## i18n

`nls/messages.js` is a one-liner: `define({ root: true, ... })`. `nls/root/messages.js` is the actual KV store. Reference via `'ojL10n!<plugin-id>/nls/messages'` in the AMD deps. Always provide a fallback: `messages.MY_KEY || 'Default'`.

## Storage

Per-viz settings: `viewConfig.<vizNamespace>.*` via `getViewConfigJSON` / `setViewConfigJSON` on `dataviz.SettingsNS.CHART`. Reset = clear the namespace, defaults applied next render.

## Build & ship

```powershell
.\gradlew run                              # devloop (system tray)
.\tools\build-plugin.ps1 <plugin-id>       # ZIP into dist/
```

ZIP entries must use forward slashes — use `build-plugin.ps1`, never `Compress-Archive`.

## Reference samples

[`extension-examples/`](../extension-examples/) contains Oracle's published plugins. Best patterns:

- **bulletViz** — measure/target overlay, `_saveSettings`/`loadConfig`, d3-tip tooltips
- **calendarViz** — canonical `_addVizSpecificPropsDialog` + `forcePanelByID`
- **racingBarsViz** — animation loop, marking/interaction services
- **dumbbellviz** — paired-measure layout
- **funnelviz** — single-measure + categorical row edge
- **orgChartViz / v2** — hierarchical data
- **vertWaterfall** (Oracle's) — older waterfall predating ours

## Known SDK quirks

- D3 bundled is **v3** (`d3.svg.axis`, `d3.scale.linear`, `.attr({...})` object form). Do not "modernize."
- File line endings: CRLF on Windows; git autocrlf handles it.
- Console-installed plugin **wins** over `-pluginDevDir` — uninstall before iterating in SDK.
- dvdesktop launches into the system tray, not as a window — copy URL from tray icon.
- `gadgets.SomeGadgetInfo.toString()` from DevTools is the fastest way to discover constructor signatures.
