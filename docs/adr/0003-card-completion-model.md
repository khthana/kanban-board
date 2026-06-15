---
status: accepted
---

# Card completion — a per-card `done` state stored as a completion date

We want a way to mark that the work represented by a *single card* is finished
([issue #34](https://github.com/khthana/kanban-board/issues/34)). The board already implies "done"
through a Done column, but a card can be complete regardless of which column it sits in, and there is
no record of *when* it finished. This ADR records how completion is modelled and why.

## Decisions

1. **Completion is a per-card flag, not a column-level concept.** A card carries its own completion
   state independent of its `column_id`; marking a card done neither moves it nor depends on a
   designated "Done" column. We rejected column-based done semantics (less flexible, doesn't match
   "*this card* is done") and rejected a one-click control on the card face (would clutter the
   [editorial card](0002-card-editorial-model.md); the toggle lives only in `CardPanel`).

2. **Stored as `completed_at DATE NULL`, and the boolean is derived.** `null` = not completed; a date =
   completed on that day. "Done" is computed as `completed_at !== null` and never stored separately. We
   chose `DATE` over `TIMESTAMP` because the product only displays the completion *date*, and the
   codebase already has timezone-safe `YYYY-MM-DD` plumbing mirroring `due_date`
   (`domain/dates.js` `fromYMD`/`toYMD`/`formatDueDate`, `normalizeCard` slice). Time-of-day,
   "completed N hours ago", and sort-by-exact-time are deferred (YAGNI); a later migration to a
   timestamp stays possible. This reversed an initial plain-boolean model — once "show the completion
   date" became a requirement, a stored date was required.

3. **The client stamps the date; it flows through the generic card patch.** Marking done sends
   `patchCard({ completedAt: toYMD(new Date()) })`; un-marking sends `{ completedAt: null }`. No
   dedicated "complete" endpoint and no server-side `now()` stamping — this reuses the existing generic
   `PATCH /cards/:id` path and keeps the optimistic value available immediately for render. We accept
   that the date reflects the client's local day rather than a server clock.

4. **The subtask guard is a soft, client-side warning.** When marking done while a card still has
   unchecked subtasks, `CardPanel` shows a `window.confirm` reporting the incomplete/total count;
   proceeding completes the card, cancelling aborts. A card with no subtasks warns nothing; un-marking
   warns nothing. We rejected a hard block (can trap users when a subtask is no longer relevant) and
   rejected auto-checking/auto-completing cascades (silently mutate user data). The guard is **UX only**
   — the backend does not couple cards to subtask state.

5. **The card face reflects completion; it does not gain a control.** A completed card shows a check
   badge and a faded appearance (~0.6 opacity). Its footer shows the completion date in place of the
   due date with **no** overdue styling, while **keeping** the subtask progress indicator. The card does
   not move, sink, or hide — it stays in place. Filtering/hiding/auto-sorting completed cards is out of
   scope; the model leaves room to add it later.

## Consequences

- **New deep module `domain/completion.js`** encapsulates the done concept (`isDone`,
  `completionPatch`, `incompleteSubtasks`) so the store and components carry no completion logic. Pure,
  unit-tested in isolation alongside `dates.test.js` / `accent.test.js`.
- **No new store action**: reuses `patchCard` and its optimistic snapshot → apply → rollback path;
  `createCard`'s optimistic placeholder gains `completedAt: null`.
- **Frontend client**: `normalizeCard` maps `completed_at` → `completedAt`; `cardPatchToApi` maps
  `completedAt` → `completed_at` (passing `null` through to clear).
- **Backend repo (`kanban-board-api`) changes**: migration `007_card_completed_at.sql`
  (`ALTER TABLE cards ADD COLUMN completed_at DATE NULL`), `PATCH /cards/:id` accepting `completed_at`
  (date or null) in its dynamic SET + RETURNING, and the `GET /boards/:id` snapshot returning
  `completed_at` per card. No subtask validation server-side.
- **Tests**: `domain/completion.test.js` (unit), an optimistic-path case in `useBoardStore.test.js`,
  a `PATCH completed_at` + clear case in the API `cards.test.js`, and a new `completion.spec.js` E2E
  (mark → badge + fade + date → reload persists → unmark).
