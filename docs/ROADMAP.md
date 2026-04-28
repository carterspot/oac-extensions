# Roadmap

Pinned items per plugin. Loose, not a project plan — write them down so they don't get lost between iterations.

## com-company-vertWaterfall

### Render-layer issues

- **Y-axis labels overlap** when the data has many rows. Currently each label is rendered at fixed font size with no rotation; with 50+ rows they collapse on top of each other. Options: scale font down based on `bandHeight`, rotate labels, truncate with ellipsis + tooltip, or switch to virtualized rendering.

- **Axis title overlaps value-axis numbers.** Bumping `margin.bottom` from 40 to 60 when an axis title is set isn't enough — D3 v3's axis tick label positioning still puts numbers in our title's row. Likely fix: append the title to a separate group with explicit transform (`translate(centerX, height - 4)`) and ensure `margin.bottom` is at least `tickFontSize + titleFontSize + 12px`. Or render the title via the axis's `.title()` accessor if available.

### Side-panel UI

- **ColorPickers (Increase / Decrease / Start–End)** — currently deferred. `COLOR_SWITCHER` typeId routes to `TextSwitcherGadgetView` which expects a color-palette `OptionInfo[]` we don't yet have the shape for. See `docs/PANEL-API-NOTES.md` "Open mysteries" for investigation hints. Without these, render-layer keeps the green/red/gray defaults — chart still ships correctly, just no UI to override them.

### Nice-to-have

- "Reset to defaults" button on the panel (per-plugin or per-tab).
- Tooltip currency-symbol switching (today it always uses `$`; should follow the user's locale or a dedicated setting).

## Future plugins

Empty — drop ideas here as you scope new ones.
