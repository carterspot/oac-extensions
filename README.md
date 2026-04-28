# oac-extensions

Custom visualization plugins for Oracle Analytics Cloud / Desktop.

## Plugins

| ID | Description | Status |
|---|---|---|
| `com-company-vertWaterfall` | Horizontal (vertical-axis) waterfall chart with side-panel controls for bar gap, data labels, axis labels, axis title, and number format | v3 — shipped |

## Quickstart

Prerequisites: Oracle Analytics Desktop, Eclipse Temurin JDK 17, Windows.

```powershell
# 1. Clone
git clone https://github.com/carterspot/oac-extensions.git
cd oac-extensions

# 2. Set environment (one time, see docs/DEV-SETUP.md for full list)
$env:JAVA_HOME = "C:\Program Files\Eclipse Adoptium\jdk-17.0.x.x-hotspot"
$env:DVDESKTOP_SDK_HOME = "C:\Program Files\Oracle Analytics Desktop"

# 3. Run dvdesktop in SDK mode (loads plugins from ./src/)
.\gradlew run
```

Edit anything under `src/customviz/<plugin-id>/`, restart `gradlew run`, see changes.

## Repo layout

```
oac-extensions/
├── build.gradle, gradle.properties, gradlew*  # OAC SDK gradle scaffold
├── src/customviz/                             # Plugin sources — one folder per plugin
│   └── com-company-vertWaterfall/
├── resourcefolder.lst.json                    # Resource manifest (root of every ZIP)
├── tools/
│   └── build-plugin.ps1                       # Package any plugin into dist/<id>.zip
├── dist/                                      # Built ZIPs (gitignored)
└── docs/
    ├── DEV-SETUP.md         # Environment setup
    ├── PUBLISHING.md        # Build & upload to OAC
    ├── PANEL-API-NOTES.md   # Hard-won notes on the gadget framework
    └── ROADMAP.md           # Pinned issues per plugin
```

## Building a release ZIP

```powershell
.\tools\build-plugin.ps1 com-company-vertWaterfall
# → dist/com-company-vertWaterfall-<timestamp>.zip
```

Upload via OAC Console → Extensions → Upload Extension. See `docs/PUBLISHING.md`.

## Adding a new plugin

1. Create `src/customviz/<your-plugin-id>/` with `plugin.xml`, the JS entry, datamodelhandler, icon, styles, and `nls/{messages.js, root/messages.js}`.
2. Add an entry to `resourcefolder.lst.json` for the new `nls` paths (see existing entries for the pattern).
3. `gradlew run` — your plugin appears in the dvdesktop visualizations list.
4. When ready to ship: `.\tools\build-plugin.ps1 <your-plugin-id>` and upload the ZIP.
