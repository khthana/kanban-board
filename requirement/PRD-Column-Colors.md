# PRD: Column Header Colors

## Problem Statement

Columns on the board all look identical — the same gray header regardless of their meaning or stage in the workflow. Users who manage boards with many columns have no visual way to distinguish them at a glance or convey status through color (e.g., red for "Blocked", green for "Done"). Setting a color currently requires manually editing the database.

## Solution

Allow board members to assign a background color to any column header directly from the board UI. Clicking the existing edit (✏️) button opens an inline form that includes both the column name field and a row of pastel color swatches. When a color is set, the column header renders with that color as its background. When no color is set, the header remains the default gray. A clear option ("✕" swatch) removes the color at any time. Colors are persisted to the database so they survive page reloads.

## User Stories

1. As a board member, I want to set a background color on a column header, so that I can visually distinguish columns at a glance without reading the name.
2. As a board member, I want to choose from 8 pastel preset swatches, so that I can assign a color in one click without thinking about hex codes.
3. As a board member, I want the color picker to appear inside the existing rename form, so that I do not need to open a separate panel just to change the color.
4. As a board member, I want the selected swatch to have a visible ring around it, so that I always know which color is currently chosen.
5. As a board member, I want a "+" swatch as a ninth option, so that I can still choose a custom color if none of the presets suits my needs.
6. As a board member, I want a "✕" swatch to clear the color, so that I can restore the default gray header if I no longer want a color.
7. As a board member, I want the column header background to change immediately when I save, so that the result is visible without needing to reload the page.
8. As a board member, I want the color to persist after a page reload, so that the board looks the same every time I open it.
9. As a board member, I want columns without a color to display the default gray header, so that the board does not look unfinished when I have not set colors yet.
10. As a board member, I want the column name and card count to remain readable against any pastel background, so that the header is functional as well as colorful.
11. As a board owner, I want column colors to be visible to all board members, so that the visual structure I set up is shared across the team.
12. As a board member, I want the color swatches to use the same palette as label colors, so that the board has a visually consistent color language.
13. As a board member, I want clicking the "+" swatch to open the native color picker, so that I can pick any color without leaving the panel.
14. As a board member, I want the "+" swatch to reflect the custom color I picked, so that I can see which custom color is active at a glance.
15. As a board member dragging a column, I want the drag overlay to also show the column's color, so that the dragged column looks correct mid-drag.

## Implementation Decisions

### Backend (kanban-board-api)

**Schema change:**
Add a nullable `color` column to the `columns` table via a new migration:
```
color VARCHAR(7) NULL
```
Accepts `NULL` (no color) or a valid 6-digit hex string (`#rrggbb`). No default value — existing rows get `NULL`.

**API changes:**
- `PATCH /columns/:id` — accept an optional `color` field in the request body. Validate that it is either `null` or a valid `#rgb`/`#rrggbb` hex string. Persist to DB.
- `GET /boards/:id` (board snapshot) — include `color` in each column object in the response.

No new endpoints are required.

### Frontend (kanban-board)

**API client normalization:**
The board snapshot flattening already maps column fields. Add `color` to the column mapping so it flows through to the store. `patchColumn` already passes patch data through unchanged — no modification needed there.

**Store (`useBoardStore`):**
Extend `renameColumn` to accept `{ name, color }` instead of just `{ name }`. Apply optimistic update to both fields; rollback on API error. This keeps the column save as a single action, consistent with the existing pattern.

**Column component:**
- The `RenameForm` sub-component receives the column's current `color` and renders the swatch row below the name input — identical in layout to the label color picker (8 pastel presets + "+" custom + "✕" clear).
- `RenameForm` manages local `color` state initialized from `column.color ?? null`.
- On save, calls `onSave(name, color)`.
- The column header `div` applies `style={{ background: column.color }}` when `column.color` is set; otherwise no inline style (CSS default applies).
- The drag overlay already renders a `Column` — it receives `column.color` from the store, so the overlay naturally picks up the color.

**Color swatch component:**
Reuse the same swatch pattern as `LabelPicker`: 8 preset circles, "+" custom via hidden `<input type="color">`, "✕" clear swatch. This is duplicated inline rather than extracted to a shared component, consistent with the project's current approach.

**Preset palette (same 8 as LabelPicker):**
```
#fca5a5  #fdba74  #fde047  #86efac
#67e8f9  #93c5fd  #c4b5fd  #f9a8d4
```

**Validation:**
Reuse the existing `validateLabelColor()` domain function before submitting. The "✕" clear action sets `color` to `null`, which bypasses color validation (name-only save).

**Text contrast:**
All 8 presets are light pastel values. The existing dark header text (`#1e293b`) remains readable against all presets without dynamic contrast logic. Custom colors are the user's responsibility.

## Testing Decisions

**What makes a good test here:** Test observable behavior through the public interface, not internal state. For E2E, assert that the header background changes after saving, and that the color is still present after a page reload.

**Modules to test:**
- No new unit tests are required. `validateLabelColor()` is already unit-tested in `domain/validation.test.js`. The swatch pattern is a UI concern covered by E2E.
- E2E (Playwright): Add a test to `board.spec.js` or a new `column-color.spec.js`:
  1. Open a board, click ✏️ on a column
  2. Assert 10 swatches are visible (8 presets + "+" + "✕")
  3. Click a preset swatch, click Save
  4. Assert the column header has the expected background color
  5. Reload the page, assert color persists

**Prior art:** `board.spec.js` (rename column flow), `subtask.spec.js` (wait for PATCH 200 after save).

## Out of Scope

- **Per-column text color** — all text stays dark; no auto-contrast logic.
- **Column background (card area) color** — only the header strip changes color, not the card list area below.
- **Animated color transitions** — no CSS transition on the header background.
- **Color visible to unauthenticated users** — board requires authentication; no public view.
- **Bulk color assignment** — colors are set one column at a time.
- **Column color in card side-panel** — the card panel does not reference the parent column's color.

## Further Notes

- The `✕` clear swatch submits `color: null` to `PATCH /columns/:id`. The backend must accept `null` explicitly and store `NULL` in the DB (not an empty string).
- The rename form currently saves on submit only; the color is saved in the same submit, not on swatch click — no intermediate PATCH is fired while browsing swatches.
- The drag overlay path: `BoardPage` passes `column` objects (including `color`) to `DragOverlay → Column`. No additional prop threading is needed as long as the store normalizes `color` from the snapshot.
