---
status: accepted
---

# Card "Editorial" redesign — category as primary label, accent derived from it, multiple assignees

We are restyling the card + board shell to the "Option C / Editorial" design
([requirement/card_ui_spec.md](../../requirement/card_ui_spec.md)). That artboard's data model
is demo data and conflicts with the real backend-backed model in three places. Rather than copy the
artboard's fields verbatim, we map them onto the existing domain and make the minimum backend change.

## Decisions

1. **Category = the card's primary [Label](../../CONTEXT.md), not a new entity.** A card keeps its
   many-to-many labels; one is designated **category** via a new nullable `category_label_id` FK on
   `cards` (`ON DELETE SET NULL`). The card face shows **only** the category (uppercase name + colored
   dot); the remaining labels are managed/visible only in `CardPanel`. The user picks the category in
   `CardPanel`. We rejected a parallel `category` entity (it would be a near-duplicate of `Label`) and
   rejected collapsing labels to single-select (loses multi-tagging).

2. **Card Accent = the category label's color — there is no separate per-card color field.** The dot,
   the uppercase category text, and the progress fill all derive from that one hex. Shades are derived
   with CSS `color-mix` (solid = the hex itself, text = `color-mix(hex, black ~35%)`), the same
   approach [ADR-0001](0001-column-accent-model.md) uses for columns — so we keep the shared
   `ColorPicker` / `PRESET_COLORS` and arbitrary custom hex rather than restricting to the spec's six
   fixed OKLCH hues. `PRESET_COLORS` is refreshed to the spec's editorial pastels. When a card has no
   category, the accent falls back to neutral gray.

3. **Multiple assignees replace the single `assignee_id`.** A new `card_assignees` join table; the
   existing `assignee_id` value is migrated into it and the column is dropped. Attach/detach mirrors the
   labels API (`PUT`/`DELETE /cards/:id/assignees/:userId`) with optimistic updates. The card face shows
   up to **3** overlapping avatars, then a `+N` chip.

4. **Due-date red stays "overdue", not the spec's "due soon".** We keep the existing computed
   `isOverdue` (red) and add the spec's muted "ไม่มีกำหนด" state when a card has no due date. We do not
   introduce a "due within N days" concept (the spec's `dueSoon` is a demo flag).

5. **Columns are unchanged in model.** [ADR-0001](0001-column-accent-model.md) still holds — column
   color is a user-set accent (hex or null → gray). We only retune the `color-mix` values to the
   editorial look. The spec's four fixed semantic columns (ideas/todo/doing/done) are demo data.

## Consequences

- **Supersedes "card color band = first label"** (documented in `CLAUDE.md`): the first-label band is
  replaced by the category dot + uppercase label. `normalizeCard()` gains `categoryLabelId`;
  `cardPatchToApi()` gains `category_label_id`.
- **Backend repo (`kanban-board-api`) changes**: migration adding `cards.category_label_id`, migration
  creating `card_assignees` (+ backfill from `assignee_id`, then drop column), and the assignee
  attach/detach endpoints. This is the only part of the redesign that touches the backend.
- **E2E + unit updates**: the whole card-face DOM changes, breaking selectors in `card.spec.js`,
  `dnd.spec.js`, `subtask.spec.js`, and `column-color.spec.js` (chip color assertions). `data-testid`
  hooks are preserved/added so selectors stay stable.
- **New font dependency**: IBM Plex Sans Thai + IBM Plex Sans from Google Fonts.
