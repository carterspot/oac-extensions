# Dev setup

What you need to be able to run `gradlew run` and see custom plugins in dvdesktop.

## 1. Install Oracle Analytics Desktop

Download from Oracle. Default install path: `C:\Program Files\Oracle Analytics Desktop`.

The SDK is bundled — `tools/` subfolder contains `bivalidate.bat` and the gradle plugin JARs.

## 2. Install JDK 17 (Eclipse Temurin)

The bundled JDK that ships with dvdesktop is too new for the SDK's gradle 7.6.2. Install Eclipse Temurin JDK 17 separately:

- https://adoptium.net/temurin/releases/?version=17

Default install path: `C:\Program Files\Eclipse Adoptium\jdk-17.x.x.x-hotspot`.

## 3. Environment variables

Set these in **User** scope (Windows Settings → Environment Variables):

| Variable | Value |
|---|---|
| `JAVA_HOME` | `C:\Program Files\Eclipse Adoptium\jdk-17.x.x.x-hotspot` |
| `DVDESKTOP_SDK_HOME` | `C:\Program Files\Oracle Analytics Desktop` |
| `BIVALIDATE_OPTS` | see below |
| `JAVA_OPTS` | same as `BIVALIDATE_OPTS` |
| `JAVA_TOOL_OPTIONS` | same as `BIVALIDATE_OPTS` |

Append to `Path`: `%DVDESKTOP_SDK_HOME%\tools\bin`

### `BIVALIDATE_OPTS` value

JDK 17 closes a bunch of internal modules that the SDK's legacy JAXB depends on. Required `--add-opens` flags:

```
--add-opens=java.base/java.lang=ALL-UNNAMED --add-opens=java.base/java.lang.reflect=ALL-UNNAMED --add-opens=java.base/java.util=ALL-UNNAMED --add-opens=java.base/java.io=ALL-UNNAMED --add-opens=java.xml/com.sun.org.apache.xerces.internal.util=ALL-UNNAMED
```

Set the same string for `JAVA_OPTS` and `JAVA_TOOL_OPTIONS`.

## 4. Verify

In a fresh PowerShell:

```powershell
java -version            # 17.x
echo $env:JAVA_HOME      # path above
echo $env:DVDESKTOP_SDK_HOME
```

Then in this repo:

```powershell
.\gradlew run
```

dvdesktop launches into the system tray. Right-click the tray icon → "Copy URL to Clipboard" → paste in your browser to get the dvdesktop UI. Plugins under `src/customviz/` are loaded automatically.

## Troubleshooting

**`Unsupported class file major version 65`** — JDK is too new. Make sure `JAVA_HOME` points at JDK 17, not the bundled 21.

**`Unable to make ... accessible: module java.base does not "opens java.lang"`** — missing `--add-opens` flags. Set `BIVALIDATE_OPTS` / `JAVA_OPTS` / `JAVA_TOOL_OPTIONS` (see above).

**Custom plugin not loading / stale code** — if your plugin is also installed via Console → Extensions in the running dvdesktop, that installed copy wins over `-pluginDevDir`. Uninstall the installed version first. To force a fresh unpack: `Remove-Item -Recurse -Force "$env:LOCALAPPDATA\Temp\DVDesktop"` before running gradle.

**dvdesktop window not visible** — it launches into the system tray. Click the system tray's "Show hidden icons" arrow → right-click Oracle Analytics Desktop → "Copy URL to Clipboard" → paste in browser.

## Chrome DevTools Protocol (CDP) for MCP integration

`build.gradle`'s `run` task passes `--remote-debugging-port=9222` to dvdesktop, exposing CDP on a fixed port (the dvdesktop UI itself is served on a different, randomly-chosen Jetty port — that one varies, the CDP port doesn't).

When dvdesktop is running, verify CDP is live:

```powershell
Invoke-RestMethod http://localhost:9222/json/version
```

If you get JSON back with `Browser` / `Protocol-Version` / etc., CDP is up.

If you get a 404 or connection refused, CEF didn't honor the flag. Fallback: try the env var
`$env:CEF_REMOTE_DEBUGGING_PORT = '9222'` before `gradlew run`, or check `build/run.log` for CEF startup messages mentioning the flag.

`.mcp.json` at the repo root configures the [`chrome-devtools-mcp`](https://github.com/ChromeDevTools/chrome-devtools-mcp) server to connect to `http://localhost:9222`. With Claude Code open in the repo, the MCP server gives Claude tools to evaluate JS in the running dvdesktop, read the console, take screenshots, etc. — useful for the gadget-framework debugging patterns documented in `PANEL-API-NOTES.md`.

Requires Node.js installed (npx is bundled). First time the MCP server runs, it downloads the package; subsequent launches are cached.
