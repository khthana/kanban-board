# PRD: Label Color Picker — Pastel Presets

## Problem Statement

When creating a label, users must manually type a hex color code or interact with a native color picker widget. This is cumbersome — most users only need a small set of distinct, readable colors, and the current free-form picker offers no guidance. The result is inconsistent label colors and unnecessary friction in a routine workflow.

## Solution

Replace the current free-form color picker (native `<input type="color">` + hex text field) with a row of 8 preset pastel color swatches. Each swatch is a 24px circle that can be tapped to select instantly. A ninth "+" swatch opens the native color picker for users who need a custom color. No hex text field is shown.

## User Stories

1. As a board member, I want to see 8 pastel color swatches when creating a label, so that I can pick a color in one click without thinking about hex codes.
2. As a board member, I want the swatches to be pastel tones, so that label colors look soft and consistent on cards rather than harsh or saturated.
3. As a board member, I want the selected swatch to have a visible ring around it, so that I always know which color is currently chosen.
4. As a board member, I want the ring indicator to appear outside the swatch circle, so that the swatch color itself is fully visible and not obscured.
5. As a board member, I want a "+" swatch as the ninth option, so that I can still choose a custom color if none of the presets suits my needs.
6. As a board member, I want clicking "+" to open the native color picker, so that I can pick any color without leaving the panel.
7. As a board member, I want the "+" swatch to reflect the custom color I picked, so that I can see which custom color is active at a glance.
8. As a board member, I want no hex text input to be visible by default, so that the label creation form is clean and fast to use.
9. As a board member, I want a preset swatch to be pre-selected when I open the create form, so that I can submit immediately without having to make a color choice first.
10. As a board member, I want the color swatches to be large enough to tap easily, so that I can use the picker comfortably on a laptop trackpad or touchscreen.
11. As a board member editing an existing label, I want the correct swatch to be highlighted if the label's current color matches a preset, so that I know which preset was used.
12. As a board member editing an existing label, I want the "+" swatch to be highlighted if the label's current color is a custom (non-preset) value, so that I can see it was customised.

## Implementation Decisions

### Module: LabelPicker component (frontend only)

Only the LabelPicker component and its stylesheet change. No store, API, or database modifications are required — the label `color` field continues to hold a hex string (`#rrggbb`), exactly as before.

**Preset palette (8 colors):**
```
#fca5a5  (pastel red/pink)
#fdba74  (pastel orange)
#fde047  (pastel yellow)
#86efac  (pastel green)
#67e8f9  (pastel cyan)
#93c5fd  (pastel blue)
#c4b5fd  (pastel purple)
#f9a8d4  (pastel rose)
```

**Swatch row layout:**
- 9 swatches rendered in a horizontal flex row with consistent gap
- Swatches 1–8: 24px filled circles, one per preset color
- Swatch 9: 24px circle styled as "+" button, filled with the current custom color if one has been selected, otherwise neutral gray

**Selection ring:**
- The selected swatch receives an `outline` ring rendered outside the circle (not inside, so the swatch color is not obscured)
- Only one swatch can be selected at a time
- Clicking a preset swatch immediately updates the active color to that preset's hex value
- Clicking "+" opens a hidden `<input type="color">` via a programmatic `.click()` and updates the active color to whatever the user picks

**Default selected color:**
- When the create form first opens, the first preset (`#fca5a5`) is pre-selected
- When the form opens for an existing label, the swatch matching that label's current color is highlighted; if no preset matches, the "+" swatch is highlighted

**Removed elements:**
- The `<input type="color">` that was previously visible in the form is replaced by the "+" swatch trigger (the native picker is still used, but as a hidden element triggered by the "+" swatch click)
- The hex text `<input>` for manually typing a color is removed entirely

**Validation:**
- The existing `validateLabelColor()` domain function is still called before submit — no change to validation logic

## Testing Decisions

**What makes a good test here:** Test the rendered output for different color inputs — not internal state transitions. Assert that the correct swatch has the selection ring class, and that the form submits with the expected hex value.

**Modules to test:** LabelPicker rendering is covered by E2E tests (Playwright), consistent with the project's decision not to unit-test React components in isolation.

**Relevant E2E coverage:** The existing label-related flows (create label, attach to card, card color band) exercise the LabelPicker. A specific E2E test for the color picker would:
1. Open a card, click "+ Create label"
2. Assert 9 swatches are visible
3. Click a preset swatch, assert it receives the ring
4. Submit the form, assert the label is created with the correct color

No new unit tests are required — the preset array is a simple constant, and the `validateLabelColor()` function that guards the submit path is already unit-tested in `domain/validation.test.js`.

## Out of Scope

- **Adding or changing the 8 preset colors** — the palette is fixed; if the user wants different presets, that is a separate change.
- **Showing a hex readout** — no hex text is shown anywhere in the form.
- **Renaming or editing existing label colors** — this PRD only covers the color picker during label creation. Editing an existing label's color is out of scope.
- **Per-board custom palettes** — the 8 presets are global, not configurable per board.
- **Database or API changes** — the `color` column and all API contracts are unchanged.

## Further Notes

- The existing `validateLabelColor()` accepts any valid `#rgb` or `#rrggbb` hex string. All 8 presets are 6-digit hex values and pass this validation without modification.
- The "+" swatch triggers a hidden `<input type="color">` element. This avoids any dependency on a third-party color picker library for the custom path.
- The pre-selected default (`#fca5a5`) ensures the form is always in a valid state on open — the user can submit immediately after typing a name.
