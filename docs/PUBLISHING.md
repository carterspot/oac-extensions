# Publishing

How to package a plugin and ship it to OAC.

## Build a release ZIP

```powershell
.\tools\build-plugin.ps1 com-company-vertWaterfall
```

Output: `dist/<plugin-id>-<timestamp>.zip`. Contents (verify with `Expand-Archive` or any ZIP tool):

```
resourcefolder.lst.json
customviz/<plugin-id>/plugin.xml
customviz/<plugin-id>/<entry>.js
customviz/<plugin-id>/<entry>datamodelhandler.js
customviz/<plugin-id>/<entry>Icon.png
customviz/<plugin-id>/<entry>styles.css
customviz/<plugin-id>/nls/messages.js
customviz/<plugin-id>/nls/root/messages.js
```

ZIP entries **must use forward slashes** — `build-plugin.ps1` handles this correctly. If you see backslashes when inspecting the ZIP, OAC will reject it.

## Bump the version

Before building a ship ZIP, bump the version in `src/customviz/<plugin-id>/plugin.xml`:

```xml
<obiplugin ... version="1.0.0.<NEW-NUMBER>" ...>
```

OAC compares versions to decide whether an upload is an upgrade. The number is treated as a string lexically — bigger string = newer.

## Upload to OAC

1. Open your OAC instance.
2. Top-right menu → **Console** (or `/dv/ui/admin/extensions`).
3. **Extensions** tab → **Upload Extension** button.
4. Pick your `dist/<plugin-id>-<timestamp>.zip`.
5. OAC validates and installs. If a plugin with the same `id` already exists, the upload upgrades it.
6. Refresh any open workbook to pick up the new version.

## Sanity check after upload

- Open a workbook that uses the viz, drop the chart on the canvas, give it data — render-layer should look correct.
- Click the chart → side panel — your custom controls should appear.
- Save the workbook, close, reopen — settings should persist.
- F12 DevTools → Console — should be clean (no errors related to your plugin).

## Rolling back

If a release misbehaves:

1. Console → Extensions → find your plugin → Delete.
2. Upload the prior known-good ZIP from `dist/`.

Keeping prior ZIPs in `dist/` (gitignored locally) makes rollback fast.
