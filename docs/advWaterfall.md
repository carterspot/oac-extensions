# Advanced Waterfall (`com-company-advWaterfall`)

A horizontal category-grouped waterfall, inspired by Rodriguez & Kaczmarek's *Visualizing Financial Data* (figs 7.2 / 7.4 / 7.6). Each Category becomes one row; the steps inside it stack as proportional segments. A synthetic Start row anchors the opening balance and a synthetic End row anchors the closing balance.

## Edges

| Edge          | Meaning                                                    | Cardinality |
|---------------|------------------------------------------------------------|-------------|
| Rows (Step)   | One attribute identifying each individual step (data row). | 1           |
| Color (Category) | One attribute grouping steps into category bars.        | 1–2         |
| Values        | The cumulative balance after each step (a measure).        | 1           |
| Tooltip       | Optional extra columns surfaced on hover.                  | 0+          |

Drop both Category **and** Step on the Color edge to get hue-by-category × shade-by-step from the framework's color interpolator.

## Sort workflow

The OAC row edge accepts only one attribute, and Color collapses multi-attribute keys for display. The reliable way to control row order while keeping clean labels is to **prefix the sort key into the label** in source data:

```
01 Cash beginning, 02 Net income, 03 Depreciation, ...
1. Start, 2. Operating, 3. Investing, ...
```

Sort the columns A→Z in OAC, then enable **Strip Sort Prefix** (default on) in the Properties panel. The plugin matches `^\s*\d+[.)]?\s+(.*)$` and renders just the trailing label.

## Settings (Properties → Style)

| Setting | Default | Description |
|---------|---------|-------------|
| Category Detail | Cumulative | What appears beside each bar: `Cumulative` (single bold number), `List` (per-step `value · name` table), or `Cumulative + List` (header + table). |
| List Sort | High to Low | Order of items in the list (by `\|delta\|` desc, or by source order). |
| Show End row | on | Append a synthetic End row anchored at zero showing the closing balance. |
| End Label | "End" | Text rendered in the End row's gutter. |
| Show Connectors | on | Dashed lines between adjacent category bars at the shared running cumulative. |
| Show Zero Line | on | Vertical reference line at x=0 (renders whenever 0 is within the chart's domain). |
| Step Shading | on | Vary lightness across steps within a category when all steps share a base color. |
| Shading Range | 60% | How much lightness varies (0–100% of base color). |
| Mark Negative Segments | on | Diagonal hatch overlay on negative-delta segments. |
| Strip Sort Prefix | on | Hide leading numeric prefix (`01 `, `1. `, `01) `) from displayed labels. |
| Bar Gap | 37% | Vertical spacing between bars as % of band height. |
| End / Subtotal Color | `#5A6470` | Color used for the synthetic End row. |
| Number Format | Auto | Auto / Number / Currency / Percent. |
| Currency Symbol | `$` | Prefix when format is Currency. |
| Decimal Places | 0 | 0–6. |
| Thousand Separator | `,` | Comma / Period / Space / None. |
| Abbreviation | Auto | Default / Auto / K / M / B. |
| Negative Values | `-123` | Display style for negatives: `-123`, `(123)`, `123-`. |
| Reset to defaults | — | Click to clear all `viewConfig.advWaterfall.*` and restore defaults. |

## Behaviors worth knowing

- **Category bars span exactly `[startCum, endCum]`** — no peak overshoot. Segment widths scale to `\|delta\| / Σ\|deltas\|` of the bar width, in source order. This trades exact-cumulative-path geometry for clean alignment between bars.
- **Negative-net categories** render rightward-anchored: bar visually extends *leftward* from `startCum` to `endCum`. Cumulative label appears on the left side (outside the bar).
- **Tooltips on every label** carry the full unabbreviated value. The gutter category label and right-side cumulative carry the entire step list as a tooltip — useful on dashboards where the visible bar is too short for the list.
- **Synthetic End row** treats `Show End` as opt-out; if your source data already has a closing-balance row, turn it off.

## Storage

All settings live under `viewConfig.advWaterfall.*`. Reset clears the namespace; defaults from `DEFAULTS` apply on next render.

## Files

- [`src/customviz/com-company-advWaterfall/advWaterfall.js`](../src/customviz/com-company-advWaterfall/advWaterfall.js) — render + panel
- [`src/customviz/com-company-advWaterfall/advWaterfalldatamodelhandler.js`](../src/customviz/com-company-advWaterfall/advWaterfalldatamodelhandler.js) — edge mappings
- [`src/customviz/com-company-advWaterfall/plugin.xml`](../src/customviz/com-company-advWaterfall/plugin.xml) — registration, edge cardinalities, version
- [`src/customviz/com-company-advWaterfall/nls/root/messages.js`](../src/customviz/com-company-advWaterfall/nls/root/messages.js) — localized strings
- [`test-data/cashflow-detail.csv`](../test-data/cashflow-detail.csv) — sample input with prefixed sort keys
