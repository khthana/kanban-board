---
status: accepted
---

# Column color is an Accent that themes the whole column, not just the header strip

The original column-color feature ([PRD-Column-Colors, now §2 of the merged PRD](../../requirement/Kanban-Board-PRD.md#2-column-header-colors-superseded-by-adr-0001)) painted `column.color` as the background of the header strip only, and explicitly put "card-area color" out of scope. To match a Notion-style board layout, we redefine `column.color` as the column's **Accent** (see [CONTEXT.md](../../CONTEXT.md)): a single optional color that themes the whole column — a pastel title chip, a faint color-mix wash over the entire column including the card area, the card-count number, and the "New card" button. When `color` is `null` the column falls back to the existing neutral gray.

We reuse the same single `color VARCHAR(7)` field (no schema/API change) rather than adding a separate accent field, accepting that this reverses a documented PRD decision.

## Consequences

- **PRD-Column-Colors is superseded** by this model. Its "header strip only" and "card-area color out of scope" statements no longer hold.
- **E2E `column-color.spec.js` must change**: it asserted `getComputedStyle(header).backgroundColor === accent`; the accent now lands on the title chip + column wash, not the header background.
- Chip text stays a fixed dark slate (`#1e293b`) — no per-accent contrast math — so arbitrary custom colors remain safe.
