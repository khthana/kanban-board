# PRD — Card "Editorial" Redesign (Option C)

> Status: ready-for-agent
> Design source: [card_ui_spec.md](card_ui_spec.md) · artboard: [Option C - Editorial.png](Option%20C%20-%20Editorial.png)
> Decisions of record: [ADR-0002](../docs/adr/0002-card-editorial-model.md) (this redesign), [ADR-0001](../docs/adr/0001-column-accent-model.md) (column accent, unchanged)
> Glossary: [CONTEXT.md](../CONTEXT.md) — terms **Category**, **Card Accent**, **Assignee** (now multiple)

## Problem Statement

The current Kanban card is functional but visually flat: a color band sourced from an arbitrary
"first" label, a plain title, and a `✓ n / total` text. Users can't tell at a glance what *kind* of
work a card represents, the board lacks visual grouping, and a card can only show one assignee even
when several people share the work. The team wants a calmer, more legible, type-forward ("editorial")
board that reads cleanly in Thai and Latin, communicates category and progress instantly, and reflects
that work is often shared.

## Solution

Redesign the card and board shell to the "Option C / Editorial" language:

- Each card leads with an **uppercase Category** (a colored dot + label) — the Category is simply the
  card's chosen **primary Label**, so no new tagging concept is introduced.
- The card's **accent** (dot, category text, progress fill) is the Category label's own color, keeping
  the board visually grouped: same category → same hue.
- A **hairline-divided foot** shows the due date (with a muted "ไม่มีกำหนด" when none) on the left and
  an **adaptive checklist progress** indicator on the right (discrete segments for small lists, a
  mini-bar for large ones).
- The top row carries **stacked assignee avatars** (up to three, then `+N`), reflecting that a card can
  now have **multiple assignees**.
- Columns keep their user-set **Accent** (ADR-0001) but are retuned to the editorial palette: a soft
  tint over the whole column, a name pill, and a count. Typography moves to **IBM Plex Sans Thai**.

All existing behavior (drag-and-drop, optimistic updates, polling, the card detail `CardPanel`, label
management, subtasks, due-date picker) is preserved.

## User Stories

1. As a board member, I want each card to show an uppercase Category with a colored dot, so that I can tell at a glance what kind of work it is.
2. As a board member, I want cards of the same Category to share the same accent color, so that the board reads as visually grouped.
3. As a board member, I want to choose which of a card's labels is its Category, so that the most meaningful label is the one featured on the card face.
4. As a board member, I want a card with no Category to fall back to a neutral gray accent, so that uncategorized cards still look intentional.
5. As a board member, I want to keep attaching multiple labels to a card, so that I don't lose multi-tagging when only one is shown on the face.
6. As a board member, I want the non-category labels to remain visible and editable in the card detail panel, so that the extra labels are still useful.
7. As a board member, I want the card title to be the visual hero (large, legible), so that I can scan tasks quickly.
8. As a Thai-speaking user, I want Thai and Latin text to render cleanly without clipped descenders, so that the board is comfortable to read.
9. As a board member, I want the card to show a due date with a calendar icon, so that I know when work is due.
10. As a board member, I want an overdue card's due date shown in red, so that late work stands out.
11. As a board member, I want a card with no due date to show a muted "ไม่มีกำหนด", so that the absence of a deadline is explicit rather than blank.
12. As a board member, I want the due date shown in Thai Buddhist-era format (e.g. 15 มิ.ย. 2569), so that it matches local conventions.
13. As a board member, I want a checklist with ≤ 8 subtasks shown as discrete segments, so that I can see exactly how many are done.
14. As a board member, I want a checklist with > 8 subtasks shown as a continuous mini-bar, so that the indicator never overflows the card.
15. As a board member, I want the progress count (done/total) always shown, so that the exact numbers are available.
16. As a board member, I want the count to turn green when all subtasks are complete, so that finished work is obvious.
17. As a board member, I want to assign more than one member to a card, so that shared work is represented accurately.
18. As a board member, I want assignee avatars stacked with overlap on the card face, so that multiple owners fit compactly.
19. As a board member, I want at most three avatars then a "+N" chip, so that a heavily-assigned card stays readable.
20. As a board member, I want to add and remove assignees from the card detail panel, so that I can manage ownership over time.
21. As an existing user, I want my current single assignee preserved after the upgrade, so that no ownership data is lost in the migration.
22. As a board member, I want each column tinted by its accent across the whole column, so that columns are visually distinct (per ADR-0001).
23. As a board member, I want a column with no accent to use a neutral gray, so that uncolored columns look clean.
24. As a board member, I want the column header to show a name pill and card count, so that I can orient quickly.
25. As a board member, I want the "+ New card" composer and "+ Add column" affordances retained, so that creating work still flows as before.
26. As a board member, I want to drag cards between columns exactly as before, so that the redesign doesn't regress drag-and-drop.
27. As a board member, I want clicking a card to open the existing detail panel, so that editing behavior is unchanged.
28. As a board member, I want the top bar restyled (back link, board name, current-user avatar, Invite), so that the shell matches the editorial look.
29. As a board member, I want a subtle hover lift on cards, so that the card feels interactive.
30. As a board member, I want my optimistic edits (category, assignees) to roll back on server error, so that the UI never lies about saved state.

## Implementation Decisions

### Domain model (see [ADR-0002](../docs/adr/0002-card-editorial-model.md))

- **Category = the card's primary Label.** New nullable `category_label_id` FK on `cards`
  (`ON DELETE SET NULL`). No separate Category entity. Labels stay many-to-many; the card face shows
  only the Category, the rest live in `CardPanel`.
- **Card Accent = the Category label's color.** No separate per-card color field. Shades are derived
  with CSS `color-mix` (solid = the hex; text = `color-mix(hex, black ~35%)`), mirroring ADR-0001's
  column derivation. No-category → neutral gray.
- **Multiple assignees** replace the single `assignee_id`: new `card_assignees` join table; the
  existing `assignee_id` is backfilled into it and the column is dropped.
- **Due-date red = overdue** (existing `isOverdue`), plus a muted "ไม่มีกำหนด" state. No "due-soon"
  concept is introduced.
- **Columns unchanged in model** (ADR-0001 holds); only `color-mix` values are retuned.

### Modules to build / modify

- `domain/progress.js` *(new, deep, pure)* — `progressView(done, total)` →
  `{ mode: 'segments' | 'minibar', segments: boolean[], pct, complete }`. `SEG_MAX = 8`.
- `domain/accent.js` *(new, deep, pure)* — resolve a card's Category label from `categoryLabelId` +
  the board's labels; return its color or the neutral fallback.
- `domain/colors.js` — refresh `PRESET_COLORS` to the spec's editorial pastels (OKLCH values converted
  to hex); keep custom-color support.
- `domain/dates.js` — unchanged formatting; the "no due date" muted state is rendered in the component.
- `store/useBoardStore.js` — new optimistic actions `setCardCategory(cardId, labelId|null)`,
  `attachAssignee(cardId, userId)`, `detachAssignee(cardId, userId)`, using the existing
  `optimistic()` helper (snapshot → apply → commit → settle → rollback). Single-assignee patch path
  removed.
- `api/client.js` — `normalizeCard()` adds `categoryLabelId` and `assignees[]`; `cardPatchToApi()`
  adds `category_label_id`; new `attachAssignee` / `detachAssignee` mirroring `attachLabel` /
  `detachLabel`; board snapshot normalization includes the new fields.
- Components — `Card.jsx` (rewritten to the editorial DOM: top row, title, hairline, foot),
  `Column.jsx` (retuned tint/pill), `CardPanel.jsx` (Category selection + multi-assignee),
  `AssigneePicker.jsx` (single → multi-select), new `AvatarStack` (overlap + `+N`), `LabelPicker.jsx`
  (mark which label is Category), `TopBar.jsx` / board shell restyle. `data-testid` hooks preserved.
- Typography — load IBM Plex Sans Thai + IBM Plex Sans (weights 400/500/600/700), set `--font` and
  antialiasing.

### Backend (`kanban-board-api`)

- Migration: add `cards.category_label_id` (nullable FK, `ON DELETE SET NULL`).
- Migration: create `card_assignees (card_id, user_id)` join; backfill from `assignee_id`; drop
  `assignee_id`.
- API: `PUT /cards/:id/assignees/:userId`, `DELETE /cards/:id/assignees/:userId` (mirror labels);
  `PATCH /cards/:id` accepts `category_label_id` (id or null); board snapshot returns
  `category_label_id` and an `assignees` array per card.
- Authorization unchanged (board membership).

## Testing Decisions

A good test asserts **external behavior**, not implementation details: given inputs, assert the
returned value / resulting store state, never internal calls or DOM structure beyond stable
`data-testid` / role hooks.

- **`domain/progress.js`** — unit-tested directly: boundary cases at `total = 8` vs `9` (segments vs
  mini-bar), `done = 0`, `done = total` (complete flag), `pct` rounding, `total = 0`. Prior art:
  `domain/validation.test.js`, `domain/dates.test.js`.
- **`domain/accent.js`** — unit-tested: category resolved from `categoryLabelId`, missing/deleted
  category id → neutral fallback, no labels → fallback. Prior art: same pure-domain tests.
- **Store actions (`setCardCategory`, `attachAssignee`, `detachAssignee`)** — unit-tested via
  `useBoardStore.getState()` with `jest.mock('../api/client')`, asserting optimistic apply → settle and
  rollback on rejection. Prior art: `store/useBoardStore.test.js` (existing optimistic-path coverage).
- **E2E (Playwright)** — update `card.spec.js`, `dnd.spec.js`, `subtask.spec.js`, `column-color.spec.js`
  for the new card-face DOM; add coverage for choosing a Category (accent appears on the card face) and
  for adding a second assignee (stacked avatars). Selectors rely on preserved `data-testid` hooks.

Not unit-tested: presentational components (covered by E2E), CSS `color-mix` derivation (visual,
covered by E2E chip/accent assertions).

## Out of Scope

- A separate first-class Category entity (Category is the primary Label — see ADR-0002).
- Collapsing labels to single-select (multi-tagging is retained).
- A per-card color independent of its Category.
- A "due-soon / due within N days" concept (only overdue + no-due states).
- Restricting label colors to the spec's six fixed OKLCH hues (arbitrary + custom hex retained).
- Showing non-category labels on the card face (they live in `CardPanel`).
- Per-position default column tints for accent-less columns (neutral gray instead).
- Any change to auth, polling, subtasks behavior, or the board-snapshot transport beyond the new fields.

## Further Notes

- This supersedes the "card color band = first label" decision recorded in `CLAUDE.md`.
- The artboard's four fixed semantic columns (ideas/todo/doing/done) and its `assignees[]` /
  `color` / `label` demo fields are **demo data**, not the data model — the real model is defined here
  and in ADR-0002.
- `formatDueDate` already emits Buddhist-era years via `th-TH`; no date-logic change is required for
  user story 12.
- The migration must run before the frontend ships, since `normalizeCard` will read the new fields.
