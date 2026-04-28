# CLAUDE.md

Notes for Claude sessions opened against this repo. Read this before doing real work — it captures non-obvious things that would otherwise have to be re-discovered.

## What this repo is

A monorepo of custom visualization plugins for Oracle Analytics Cloud / Desktop (OAC). Each plugin lives under `src/customviz/<plugin-id>/`. The repo includes the OAC SDK gradle scaffolding so `gradlew run` launches dvdesktop in SDK mode and loads all plugins from `src/customviz/` automatically.

The user (carterspot, on Windows) is the sole maintainer. Plugins ship to a real OAC cloud instance via Console → Extensions → Upload Extension.

## Dev loop

```powershell
cd C:\Code\oac-extensions   # this repo's local clone
.\gradlew run               # launches dvdesktop in SDK mode (system tray)
```

dvdesktop launches into the **system tray, not as a visible window**. Show hidden icons → right-click Oracle Analytics Desktop → Copy URL to Clipboard → paste in browser.

To see edits: stop gradlew (Ctrl+C → `y` to confirm), then `.\gradlew run` again. CEF doesn't reliably hot-reload — full restart is the dependable path.

If a plugin you're editing is *also* installed via OAC Console → Extensions, **the installed copy wins over `-pluginDevDir`**. Uninstall it from Console first, otherwise edits in `src/` won't show. Symptom: the unpacked file at `%LOCALAPPDATA%\Temp\DVDesktop\plugins\unpacked\<plugin-id>\customviz\<plugin-id>\<entry>.js` doesn't match what's in `src/`. Diagnose with a unique marker string in source and grep the unpacked file.

## Shipping a release

```powershell
# 1. Bump version in src/customviz/<plugin-id>/plugin.xml
#    (lexical string compare — "1.0.0.1547829180000" > "1.0.0.1547829179000")

# 2. Build ZIP
.\tools\build-plugin.ps1 com-company-vertWaterfall

# 3. Upload dist/<plugin-id>-<timestamp>.zip via OAC Console → Extensions
```

ZIP entries **must use forward slashes**. `build-plugin.ps1` already handles this — don't switch to `Compress-Archive` (it produces backslash entries which OAC rejects).

## Adding controls to the side panel

**Always read `docs/PANEL-API-NOTES.md` first.** That file captures the gadget framework patterns that took most of a multi-session debugging slog to figure out. Specifically:

- Use `gadgetdialog.forcePanelByID(oTabbedPanelsGadgetInfo, euidef.GD_PANEL_ID_GENERAL)` to get a real panel. **Never** construct `PanelGadgetInfo` directly — even with valid value-properties, the framework picks a view based on `typeId` and crashes during render.
- Each gadget type usually wants a *specific* `*GadgetValueProperties` subclass (Slider needs `SliderGadgetValueProperties` with `nMin`/`nMax`/`nStep`; Checkbox needs `CheckboxGadgetValueProperties` with `bChecked`). Generic `GadgetValueProperties` works only for Text and SingleSelect.
- Position 4 of every `*GadgetInfo` constructor is `oGadgetValueProperties` — the framework asserts non-null object. Don't pass null.
- Gadget IDs **must not contain dots**. `wf.barGap` breaks knockout/aria bindings; use `wfBarGap`.
- Gadgets with view templates that bind `aria-label:ariaLabel` (ColorPicker, SingleSelect) crash if `ariaLabel` is undefined on the viewmodel. Pass it via `GadgetValueProperties` extras: `new GadgetValueProperties(typeId, value, { ariaLabel: 'Foo' })`.
- `MyViz.superClass._addVizSpecificPropsDialog.call(this, oTabbedPanelsGadgetInfo)` should always be the LAST line of the override.
- In `_handlePropChange`, guard `_handleLegendPropChange` with `typeof === 'function'` — it's not bound on every viz subclass.

When in doubt about a gadget signature, dump it from dvdesktop DevTools while the dialog is open:

```js
require(['obitech-application/gadgets'], function(g){
  var s = g.SomeGadgetInfo.toString();
  console.log('params:', s.match(/\(([^)]*)\)/)[1]);
  console.log(s.substring(0, 800));
});
```

The user knows this DevTools-dump pattern; it's a fast way to unblock unknown signatures.

## Reference: shipped Oracle samples

dvdesktop unpacks Oracle's sample plugins to `%LOCALAPPDATA%\Temp\DVDesktop\plugins\unpacked\` after a fresh launch:

- `com-company-bulletViz`
- `com-company-calendarViz` ← canonical example of `_addVizSpecificPropsDialog` + `forcePanelByID`
- `com-company-racingBarsViz`
- `sample-circlepack`

Grep these for working patterns before reverse-engineering anything from scratch.

## Codebase conventions

- The waterfall plugin uses **D3.js v3** (`d3.svg.axis`, `d3.scale.linear`, `.attr({...})` object form). Don't "modernize" to v4+ — the bundled D3 in dvdesktop is v3.
- AMD modules: `define([deps], function(...){})`. Top-of-file deps array order must match the function-arg order exactly.
- File line endings: CRLF (Windows). Git is configured with `core.autocrlf` so this is invisible most of the time.

## Don't

- **Don't leave diagnostic `console.log` calls in committed code.** During debugging we add tracers like `console.log('[vertWaterfall]', ...)` freely; remove them before commit/ship.
- **Don't use `Compress-Archive`** for ZIP builds. Use `tools/build-plugin.ps1`.
- **Don't force-push** without explicit user approval. The repo's only branch is `main` and the user pushes from one machine, but treat it as authoritative anyway.
- **Don't put files under OneDrive paths** for git work. The previous working copy at `C:\Users\CarterBeaton\OneDrive - Argano LLC\Development\Waterfall-V1033793-01-Copy\` is now stale; the repo at `C:\Code\oac-extensions` is the source of truth.
- **Don't create new files just to document a session's work.** Update `docs/ROADMAP.md` for pinned issues, `docs/PANEL-API-NOTES.md` for new framework discoveries. Don't make `NOTES.md` or `WORKLOG.md` etc.

## State of things at last session

- v3 of `com-company-vertWaterfall` shipped to user's cloud OAC instance with 6 working side-panel controls (slider, 3 checkboxes, text, single-select).
- Local SDK at `C:\OAC-PluginDev` is now redundant — the repo IS the dev tree. User can delete that directory once confident.
- Three pinned items in `docs/ROADMAP.md` were filed as GitHub issues (see `.github/ISSUES_TO_CREATE.md` if those issues haven't been opened on github.com yet).
