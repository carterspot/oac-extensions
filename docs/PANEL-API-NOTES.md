# Panel API notes

What we figured out about the OAC custom-viz side-panel framework. Use this as a starting point for new plugins instead of re-discovering it.

These are reverse-engineered notes from inspecting `obitech-application/gadgets` at runtime in dvdesktop's CEF DevTools. Oracle does not publicly document this API.

## Side-panel hook

Override on your viz prototype:

```js
MyViz.prototype._addVizSpecificPropsDialog = function(oTabbedPanelsGadgetInfo) {
  // 1. Get a panel — DO NOT construct PanelGadgetInfo directly
  var panel = gadgetdialog.forcePanelByID(
    oTabbedPanelsGadgetInfo,
    euidef.GD_PANEL_ID_GENERAL
  );

  // 2. Add gadgets
  panel.addChild(new gadgets.SliderGadgetInfo(...));
  panel.addChild(new gadgets.CheckboxGadgetInfo(...));
  // ...

  // 3. Always call super last
  MyViz.superClass._addVizSpecificPropsDialog.call(this, oTabbedPanelsGadgetInfo);
};
```

AMD imports needed:
```js
'obitech-application/gadgets'                  // -> gadgets
'obitech-application/extendable-ui-definitions' // -> euidef
'obitech-report/gadgetdialog'                   // -> gadgetdialog
'knockout'                                      // -> ko (only if you wire observables yourself)
```

## Available panels (`euidef.GD_PANEL_ID_*`)

`GENERAL`, `SHARE`, `PERMISSIONS`, `PREVIEW`, `ADVANCED`, `PARAMETERS`, `TARGET_MANAGEMENT`, `ADVANCED_PARAMS`, `SIZE_ALIGNMENT`. CalendarViz adds to `GENERAL`; that's the default-friendly choice.

`forcePanelByID` either returns the existing panel or creates one of the right type. Don't try `new PanelGadgetInfo(...)` — its base class `AbstractGadgetInfo` asserts non-null `oGadgetValueProperties`, and even if you satisfy that, the framework picks a view based on the typeId you give it (`CHECKBOX` → CheckboxGadgetView etc.) which then crashes during render because the panel isn't a checkbox.

## Gadget constructors that we've verified work

Each takes a different number of args because they extend different bases. **Position 4 (1-indexed) is consistently `oGadgetValueProperties` and the framework asserts it must be a non-null object.**

### SliderGadgetInfo

```js
new gadgets.SliderGadgetInfo(
  'wfBarGap',                                       // id (NO DOTS — they break aria/knockout bindings)
  'Bar Gap',                                        // label
  'Spacing between bars as a % of band width',      // description
  new gadgets.SliderGadgetValueProperties(
    euidef.GadgetTypeIDs.SLIDER,
    initialValue,                                   // number — NOT a knockout observable
    0,                                              // nMin
    95,                                             // nMax
    1                                               // nStep
  ),
  0,                                                // sortOrder
  false,                                            // isHidden
  null,                                             // unused
  { fValueFormatter: function(v) { return v + '%'; } } // config
);
```

Generic `GadgetValueProperties` is missing `min`/`max`/`step` — SliderGadgetView calls `i.min()` and crashes. Use `SliderGadgetValueProperties` exclusively.

### CheckboxGadgetInfo

```js
new gadgets.CheckboxGadgetInfo(
  'wfDataLabels',
  'Data Labels',                                    // label
  'Show value labels on bars',                      // description
  new gadgets.CheckboxGadgetValueProperties(
    euidef.GadgetTypeIDs.CHECKBOX,
    isChecked,                                      // value (boolean)
    isChecked                                       // bChecked (boolean)
  ),
  0,                                                // sortOrder
  false                                             // isHidden — only 6 args total, no config slot
);
```

### TextGadgetInfo

```js
new gadgets.TextGadgetInfo(
  'wfAxisTitle',
  'Axis Title',
  'Optional axis title',
  new gadgets.GadgetValueProperties(
    euidef.GadgetTypeIDs.TEXT_FIELD,
    initialString
  ),
  0, false, null,
  { sPlaceholderText: '(none)' }
);
```

Generic value-properties works here.

### SingleSelectGadgetInfo

```js
new gadgets.SingleSelectGadgetInfo(
  'wfNumberFormat',
  'Number Format',                                  // label
  'Number Format',                                  // 3rd arg (label-like; mirror the label)
  new gadgets.GadgetValueProperties(
    euidef.GadgetTypeIDs.SINGLE_SELECT,
    'auto'                                          // current selected option value
  ),
  0,                                                // sortOrder
  false,                                            // isHidden
  [                                                 // 7th arg = options array
    new gadgets.OptionInfo('auto',  'Auto',  'Auto'),
    new gadgets.OptionInfo('comma', 'Number','Number'),
    // ...
  ]
);
```

`OptionInfo(value, sText, sCaption, sClassName?, disabled?)` — `sText` is the visible label.

## The `ariaLabel is not defined` error

Some gadgets' view templates have a knockout binding `attr: function(){return {'aria-label':ariaLabel}}` that looks up `ariaLabel` on the bound viewmodel. If it's undefined the dialog crashes during render.

Workaround: pass `ariaLabel` via the extras object on `GadgetValueProperties`. Its constructor copies all extra keys onto `this`:

```js
new gadgets.GadgetValueProperties(
  euidef.GadgetTypeIDs.SINGLE_SELECT,
  'auto',
  { ariaLabel: 'Number Format' }   // ← copied to this.ariaLabel
);
```

We didn't fully prove this fixes ColorPicker (see below), but it's the right pattern for `SingleSelect` etc.

## Persistence (`_handlePropChange`)

```js
MyViz.prototype._handlePropChange = function(sGadgetID, oPropChange, oViewSettings, oActionContext) {
  var conf = oViewSettings.getViewConfigJSON(dataviz.SettingsNS.CHART) || {};

  var bUpdateSettings = MyViz.superClass._handlePropChange.call(this, sGadgetID, oPropChange, oViewSettings, oActionContext);
  if (typeof this._handleLegendPropChange === 'function') {
    if (this._handleLegendPropChange(conf, sGadgetID, oPropChange, oViewSettings, oActionContext)) {
      bUpdateSettings = true;
    }
  }

  // Map gadget id → settings key + transform
  var MAP = { wfBarGap: { key: 'barGap', transform: function(v){ return v/100; } }, ... };
  var m = MAP[sGadgetID];
  if (m && oPropChange) {
    var raw = oPropChange.getValue && oPropChange.getValue();
    if (raw == null) raw = oPropChange.value;
    if (raw == null) raw = oPropChange;
    var newVal = raw;
    if (raw && typeof raw === 'object') {
      if ('checked' in raw) newVal = raw.checked;          // checkbox
      else if ('transientValue' in raw) newVal = raw.transientValue; // slider
      else if ('value' in raw) newVal = raw.value;
    }
    if (!conf.waterfall) conf.waterfall = {};
    conf.waterfall[m.key] = m.transform ? m.transform(newVal) : newVal;
    oViewSettings.setViewConfigJSON(dataviz.SettingsNS.CHART, conf);
    bUpdateSettings = true;
  }
  return bUpdateSettings;
};
```

Always guard `_handleLegendPropChange` with a `typeof === 'function'` check. The helper isn't bound on every viz subclass; calling it unconditionally crashes any title-edit.

## Open mysteries

- **ColorPickerGadgetInfo** — `COLOR_SWITCHER` typeId routes to `TextSwitcherGadgetView` which calls `n.getOptionCaptionByValue()` on the value-properties. Even with `ariaLabel` in extras, the call fails because we haven't supplied a color-palette `OptionInfo[]` in the right shape. Native plugins that ship color-pickers presumably build a palette from a different source. To investigate next: native chart prototypes for `getColorPickerOptions()` callers; the `ColorPropertiesPanelGadgetTypeIDs.COLOR_PALETTE` constant suggests a separate path.

- **Sample plugins** — dvdesktop unpacks four sample plugins (`com-company-bulletViz`, `com-company-calendarViz`, `com-company-racingBarsViz`, `sample-circlepack`) under `%LOCALAPPDATA%\Temp\DVDesktop\plugins\unpacked\`. `calendarViz.js` shows the working `forcePanelByID` pattern. Worth grepping there for new patterns.

## Reference dumps

To reproduce these notes, paste in dvdesktop DevTools Console while the dialog is open:

```js
// All exports of the gadgets module
require(['obitech-application/gadgets'], function(g){
  console.log('exports:', Object.keys(g));
});

// Constructor signature of a specific gadget
require(['obitech-application/gadgets'], function(g){
  var s = g.SliderGadgetInfo.toString();
  console.log('params:', s.match(/\(([^)]*)\)/)[1]);
  console.log('first 600:', s.substring(0,600));
});

// All *GadgetValueProperties subclasses
require(['obitech-application/gadgets'], function(g){
  Object.keys(g).filter(n => /GadgetValueProperties$/.test(n)).forEach(n => {
    console.log('=== ' + n + ' ===');
    console.log(g[n].toString().substring(0,400));
  });
});
```

`euidef.GadgetTypeIDs` enum: `TEXT_FIELD`, `TEXT_AREA`, `FILE_SELECT`, `FILE`, `IMAGE_FILE`, `ALIGN`, `SLIDER`, `NUMBER_TOGGLE`, `NUMBER_FIELD`, `NUMBER_INPUT_TEXT_SWITCHER`, `CHECKBOX`, `CHECKBOX_SET`, `TEXT_TOGGLE`, `SINGLE_SELECT`, `MULTIPLE_SELECT`, `SHARED_IMAGE_SELECT`, `FONT`, `GRIDLINES`, `COLOR_SWITCHER`, `BUTTON`.
