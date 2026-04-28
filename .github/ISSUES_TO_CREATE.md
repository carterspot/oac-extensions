# Issues to create on GitHub

Five draft issues for the `com-company-vertWaterfall` plugin. Open each one at https://github.com/carterspot/oac-extensions/issues/new with the title and body below.

If you install `gh` later, these can be created in one shot — see the `gh issue create` commands at the bottom.

---

## Issue 1

**Title:** vertWaterfall: Y-axis labels overlap when row count is high

**Labels:** `bug`, `vertWaterfall`, `render-layer`

**Body:**

When the chart's data has many rows (50+), the category-axis (Y) labels render at fixed font size with no rotation or truncation, so labels collapse on top of each other and become unreadable.

**Steps to reproduce:**

1. Drop the Vert Waterfall on a workbook canvas.
2. Set Rows (Y-Axis) to a column with 50+ distinct values (e.g., Industry, City, etc.).
3. Observe the country/category labels stacking unreadably along the Y axis.

**Expected:** labels remain legible — either by scaling font down based on `bandHeight`, rotating, or truncating with ellipsis + tooltip on hover.

**Suggested fix:**

In `vertWaterfall.js`, the y-axis label rendering doesn't currently adapt to band height. Compute `fontSize = clamp(bandHeight * 0.6, 8, 14)` and pass to the axis, OR rotate to 0–30deg when `bandHeight < 14`, OR drop every Nth label when count exceeds a threshold.

---

## Issue 2

**Title:** vertWaterfall: Axis title overlaps value-axis numbers

**Labels:** `bug`, `vertWaterfall`, `render-layer`

**Body:**

When an Axis Title is set in the side panel, the title text renders at roughly the same vertical position as the value-axis tick labels (e.g. "Test Title" sits next to "8M" instead of below all the tick numbers).

**Reproduce:**

1. Drop the chart, click it, set Axis Title in the side panel to anything.
2. Title appears at `y = height - 5`, overlapping the axis tick labels.

**Current state:**

The first attempt bumped `margin.bottom` from 40 to 60 when an axis title is set, but D3 v3's tick labels still render in the bottom margin area where we placed the title.

**Suggested fix:**

In `vertWaterfall.js` find the `if (settings.axisTitle)` block. Instead of placing the title at `(margin.left + plotWidth/2, height - 5)`:

- Append it inside a separate `<g>` translated to `(margin.left + plotWidth/2, height - 4)` AFTER measuring the actual tick label height.
- Ensure `margin.bottom` is at least `tickFontSize + titleFontSize + 12` (rough: 14 + 12 + 12 = 38).

Or render via the axis's title accessor if D3 v3 supports it on this axis type.

---

## Issue 3

**Title:** vertWaterfall: ColorPickers (Increase / Decrease / Start–End) deferred — palette OptionInfo shape unknown

**Labels:** `enhancement`, `vertWaterfall`, `panel-ui`, `blocked-research`

**Body:**

The 3 color pickers were deferred from v3 because `COLOR_SWITCHER` typeId routes to `TextSwitcherGadgetView`, which calls `n.getOptionCaptionByValue()` on the value-properties. Our generic `GadgetValueProperties` doesn't supply that method — the framework expects a color-palette `OptionInfo[]` in some shape we haven't yet figured out.

**What we tried:**

- Generic `GadgetValueProperties(COLOR_SWITCHER, hex)` → `ariaLabel is not defined` at render.
- Adding `{ ariaLabel: 'Increase Color', sDefaultValue: hex }` extras → `getOptionCaptionByValue is not a function`.

**Investigation hints:**

- `ColorPropertiesPanelGadgetTypeIDs.COLOR_PALETTE` constant suggests a separate path from the leaf `GadgetTypeIDs.COLOR_SWITCHER`.
- Native charts that ship color pickers presumably build a palette — find one that does, dump its prototype's `_addVizSpecificPropsDialog` source via DevTools.
- ColorPickerGadgetInfo's own source has `getColorPickerOptions()` returning `config.colorPickerOptions`. May need to populate that with a valid palette structure.
- Check the unpacked sample plugin `com-company-calendarViz` (at `%LOCALAPPDATA%\Temp\DVDesktop\plugins\unpacked\com-company-calendarViz/customviz/com-company-calendarViz/calendarViz.js`) — it doesn't ship a ColorPicker but its patterns may give hints.

**Workaround in v3:** the chart's render layer keeps the green/red/gray defaults (from `DEFAULTS` in `vertWaterfall.js`). Users can't override colors via the UI yet, but the chart still renders correctly.

---

## Issue 4

**Title:** vertWaterfall: Add "Reset to defaults" button on side panel

**Labels:** `enhancement`, `vertWaterfall`, `panel-ui`, `nice-to-have`

**Body:**

Once a workbook accumulates custom Waterfall settings, there's no quick way to revert. A single button — `Reset Waterfall settings to defaults` — would clear `viewConfig.waterfall` and re-render with `DEFAULTS`.

**Implementation sketch:**

- Add a `ButtonGadgetInfo` (or similar) at the bottom of the panel.
- On click, call `oViewSettings.setViewConfigJSON(dataviz.SettingsNS.CHART, { ...conf, waterfall: undefined })` and trigger a re-render.
- Confirm the button gadget's signature via DevTools dump first — `BUTTON` is in `GadgetTypeIDs` so it likely has its own subclass.

---

## Issue 5

**Title:** vertWaterfall: Tooltip currency symbol should follow locale or be configurable

**Labels:** `enhancement`, `vertWaterfall`, `nice-to-have`

**Body:**

When `numberFormat = 'currency'`, the tooltip and bar labels always render with `$`. Should follow the user's OAC locale, or at minimum expose a "Currency Symbol" text field on the panel when format is currency.

**Implementation sketch:**

- Read locale from `dataviz` or `obitech-framework` (need to find the module that exposes it).
- Or add a conditional gadget: when `wf.numberFormat === 'currency'`, show a `TextGadgetInfo` for `wf.currencySymbol` that defaults to `$`.

---

## Bulk-create with `gh`

After installing `gh` (`winget install --id GitHub.cli -e`) and `gh auth login`:

```powershell
gh issue create --title "vertWaterfall: Y-axis labels overlap when row count is high" --label "bug,vertWaterfall,render-layer" --body-file - <<<'<paste body 1 here>'
gh issue create --title "vertWaterfall: Axis title overlaps value-axis numbers" --label "bug,vertWaterfall,render-layer" --body-file - <<<'<paste body 2 here>'
gh issue create --title "vertWaterfall: ColorPickers (Increase / Decrease / Start-End) deferred — palette OptionInfo shape unknown" --label "enhancement,vertWaterfall,panel-ui" --body-file - <<<'<paste body 3 here>'
gh issue create --title "vertWaterfall: Add ""Reset to defaults"" button on side panel" --label "enhancement,vertWaterfall,panel-ui" --body-file - <<<'<paste body 4 here>'
gh issue create --title "vertWaterfall: Tooltip currency symbol should follow locale or be configurable" --label "enhancement,vertWaterfall" --body-file - <<<'<paste body 5 here>'
```

Labels need to be created in the repo first if they don't exist. Easiest: GitHub web UI → Issues → Labels → New label, or `gh label create vertWaterfall --color "0e8a16"` etc.

After all five are filed, this file (`.github/ISSUES_TO_CREATE.md`) can be deleted.
