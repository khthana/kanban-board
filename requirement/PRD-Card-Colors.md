# PRD: Card Color Bands

## Problem Statement

The Kanban board currently displays all cards with a uniform white background and small 6px-tall colored label dots. This makes the board visually flat — users cannot quickly distinguish cards by category or priority at a glance. The board lacks the visual richness needed to scan a busy board efficiently.

## Solution

Extend the existing label system so that a card's first label color is promoted into a full-width colored band at the top of the card. Cards with no labels remain unchanged. Remaining labels (2nd onward) continue to display as small dots below the band. No database changes are required — this is a pure frontend visual enhancement.

## User Stories

1. As a board member, I want cards with labels to display a colored band at the top, so that I can identify a card's category at a glance without reading its title.
2. As a board member, I want the color of the band to match the card's first label color, so that the existing label system I already understand continues to drive the visual encoding.
3. As a board member, I want cards without any labels to look the same as before (no band), so that the layout does not feel broken for unlabeled cards.
4. As a board member, I want to see remaining labels (2nd, 3rd, etc.) as small dots below the colored band, so that I do not lose visibility of secondary labels.
5. As a board member, I want the colored band to span the full width of the card, so that the color accent is immediately visible even when scanning quickly.
6. As a board member, I want columns to remain visually neutral (no color treatment), so that the card colors are the clear focal point of color on the board.
7. As a board member, I want the colored band to be consistent across all views where the card preview is shown (board view), so that the visual encoding is reliable.
8. As a board member dragging a card, I want the colored band to remain visible on the drag overlay, so that the card is still recognizable while being moved.

## Implementation Decisions

### Module: Card component (frontend only)

The only module that changes is the Card preview component and its stylesheet. No store, API, or database changes are required.

**Rendering logic:**
- If `card.labels` (the labels attached to the card) has at least one entry, render a full-width colored band at the top of the card using `labels[0].color` as the background.
- If `card.labels` is empty or undefined, render no band — the card looks exactly as it does today.
- The `labelBar` (small colored dots) is modified to render only labels at index 1 and beyond. If only one label exists, the dot bar is omitted entirely.

**Band visual spec:**
- Full width of the card
- Height: ~10px
- Border-radius on the top-left and top-right corners matching the card's own border-radius (so it sits flush inside the card)
- No text or icon content — purely decorative

**Label dot bar (remaining labels):**
- Unchanged in appearance — same 28px × 6px dots, same gap, same border-radius
- Positioned directly below the band (or at top of card body if no band)

**Drag overlay:**
- The overlay state (`.overlay` class) already wraps the full card — no special handling needed; the band renders inside it naturally.

**Overdue state:**
- The existing overdue treatment (red left border + light red background) is independent of the color band. Both can coexist — the band applies to the top, the overdue border applies to the left.

### No changes to:
- `useBoardStore.js` — label data is already in store
- `client.js` — no new API calls
- `CardPanel.jsx` — detail panel is not affected
- `Column.jsx` / `BoardPage.jsx` — column styling unchanged
- Database schema — no new fields

## Testing Decisions

**What makes a good test here:** Test the rendered output for different label configurations — not internal state. Assert on DOM structure and inline styles.

**Modules to test:** The Card component rendering logic is covered by E2E tests (Playwright), not unit tests. This is consistent with the project's testing decision that React components are not unit-tested in isolation.

**Relevant E2E coverage:** The existing `subtask.spec.js` and `card.spec.js` provide prior art for how card rendering is verified end-to-end. A label-related E2E test would:
1. Create a card, attach a label with a known color
2. Assert the colored band is visible on the card in board view
3. Assert its background color matches the label's color

No new unit tests are required — the logic (checking `labels.length`, slicing `labels[1..]`) is trivial and fully exercised by E2E.

## Out of Scope

- **Column colors** — columns remain visually neutral; no color picker for columns.
- **Per-card custom color** — cards do not get an independent color field; color always derives from the first label.
- **Card body tinting** — the card body background remains white; only the top band is colored.
- **Colored header with card ID** — no card ID or text is displayed inside the band.
- **Color picker changes** — the label color picker and validation are unchanged.
- **CardPanel changes** — the detail panel view of a card is not affected.
- **Database or API changes** — this is a zero-migration, zero-API-change feature.
- **Dark mode** — not in scope for this project.

## Further Notes

- The existing label system already validates hex colors (`#rgb` or `#rrggbb`) in `domain/validation.js` — no change needed there.
- The `labelBar` currently renders all labels. The change is to conditionally skip `labels[0]` from the dot bar when a band is shown, to avoid redundant visual encoding.
- Label order on a card follows the order in `cardLabels[]` from the store, which reflects the order labels were attached. The "first label" is `labels[0]` in this array — no sorting or prioritization logic is added.
- This feature is purely cosmetic and does not affect drag-and-drop, polling, optimistic updates, or any other behavioral system.
