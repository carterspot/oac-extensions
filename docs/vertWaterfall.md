# com-company-vertWaterfall

Horizontal (vertical-axis) waterfall chart for OAC. Each row represents a data point; bars between consecutive rows show the absolute change between values, color-coded for increase / decrease / neutral.

## Features

### Bars & layout

- Bar gap slider (0–95%)
- Increase / decrease / neutral colors (defaults match native OAC waterfall)
- X-axis aligned to bar bottom regardless of axis title presence
- Y-axis category labels measured exactly so wide names (e.g. "Hong Kong S.A.R.") never clip
- Y-axis labels skip every Nth tick when bands get too thin to fit text

### Data labels

- Toggle on/off
- Content selector: `Value (Delta)` / `Value only` / `Delta only` / `% of total` / `Cumulative`
- Font controls: family, size (8–24), bold, italic
- Color: `Auto` (mirrors OAC theme text color), White, Black, Dark Gray
- Auto-flip placement (3-way): inside bar → outside-right → anchored at chart's right edge if no room, so labels stay on-screen
- Single-line `value (delta)` rendering eliminates vertical overlap on tight bands

### Totals (default ON)

- Show Start Total — forces the first data row's label to display its value regardless of the content selector
- Show End Total — appends a synthetic neutral "End" row sized at the last data row's value
- Show Grand Total — static `Total: <sum>` label at the bottom-right of the plot area

### Axis & formatting

- Axis title with cleanup of overlap with tick numbers
- Number format presets: Auto / Number / Abbreviated (1K/1M/1B) / Currency / Percent
- Theme-aware axis text color (mirrors OAC light/dark mode via `currentColor`)

### Other

- Tooltip with name + value + delta and any extra columns wired to the Tooltip edge
- Reset to defaults — checkbox at the bottom of the panel clears all customizations

## Open issues

See the [GitHub issue tracker](https://github.com/carterspot/oac-extensions/issues?q=is%3Aopen+label%3AvertWaterfall) for known bugs and planned enhancements.

## Implementation notes

For framework-level patterns (gadget signatures, panel construction quirks), see [PANEL-API-NOTES.md](PANEL-API-NOTES.md).
