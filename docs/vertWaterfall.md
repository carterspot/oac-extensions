# com-company-vertWaterfall

Horizontal (vertical-axis) waterfall chart for OAC. Each row represents a data point; bars between consecutive rows show the absolute change between values, color-coded for increase / decrease / neutral.

All side-panel controls live under the **Style** tab.

## Features

### Bars & layout

- Bar gap slider (0–95%)
- Color pickers for Increase, Decrease, and Start/End (neutral)
- X-axis aligned to bar bottom regardless of axis title presence
- Y-axis category labels measured exactly so wide names (e.g. "Hong Kong S.A.R.") never clip
- Y-axis labels skip every Nth tick when bands get too thin to fit text
- Y-axis label font auto-shrinks (12pt → 8pt floor) when bandHeight gets small so labels stay inside their bands
- Y-axis tick centers explicitly anchored to bar centers (no off-by-half-band drift)

### Data labels

- Toggle on/off
- Content selector: `Value (Delta)` / `Value only` / `Delta only` / `% of total` / `Cumulative`
- Position selector: `Auto` / `Inside end` / `Outside end` / `Center`
- Auto placement: 3-way fallback — inside bar → outside-right → anchored at chart's right edge if the bar hits the chart limit (so labels stay on-screen)
- Font controls: family, size (8–24), bold, italic
- Color: `Auto` / `White` / `Black` / `Dark Gray`
  - In **Auto** mode: per-bar luminance contrast for labels sitting on bars (light text on dark bars, dark text on light bars), and theme text color for labels on chart background
- Single-line `value (delta)` rendering eliminates vertical overlap on tight bands

### Totals (default ON)

- Show Start Total — forces the first data row's label to display its value regardless of the content selector
- Show End Total — appends a synthetic neutral "End" row sized at the last data row's value (fits the existing x-scale)
- Show Grand Total — static `Total: <sum>` label at the bottom-right of the plot area

### Connectors

- Show Connectors (default ON) — thin dashed gray vertical lines between consecutive bars at their shared value, in classic waterfall style

### Number format

- Number Format preset: Auto / Number / Currency / Percent
- Currency Symbol (text field, default `$`) — used by the Currency preset
- Decimal Places slider (0–6, default 2)
- Thousand Separator: comma (`1,234`) / period (`1.234`) / space (`1 234`) / none (`1234`)
- Abbreviation: Default / Auto (1.5K / 1.5M / 1.5B based on magnitude) / Thousands / Millions / Billions
- Negative Values: `-123` / `(123)` / `123-`

Composition: Currency + Auto abbreviation + 2 decimals + parens negatives → `$(1.50M)`

### Axis

- Axis title with cleanup of overlap with tick numbers
- Theme-aware axis text color (mirrors OAC light/dark mode via `currentColor`)

### Other

- Tooltip with name + value + delta and any extra columns wired to the Tooltip edge
- Reset to defaults — checkbox at the bottom of the panel clears all customizations

## Implementation notes

For framework-level patterns (gadget signatures, panel construction quirks), see [PANEL-API-NOTES.md](PANEL-API-NOTES.md).

Live-probed gadget signatures:

- `ColorPickerGadgetInfo(id, label, tooltip, valueProps, order, showGear, rules, config)` — `valueProps = GadgetValueProperties(GadgetTypeIDs.COLOR_PICKER, hexColor)`, `config = { sDefaultValue }`
- D3 v3 ordinal-scale axis tick positioning uses different bandwidth math than `(H-margin.bottom)/N`. The y-axis tick groups are explicitly re-anchored to `rowIdx * bandHeight + bandHeight/2` after the axis renders.

## Open issues

See the [GitHub issue tracker](https://github.com/carterspot/oac-extensions/issues?q=is%3Aopen+label%3AvertWaterfall) for known bugs and planned enhancements.
