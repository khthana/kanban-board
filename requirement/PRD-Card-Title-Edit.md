# PRD: Edit card title inline in the side panel (CardPanel)

> Tracking issue: [#38](https://github.com/khthana/kanban-board/issues/38) · Label: `ready-for-agent`

## Problem Statement

When I open a card's side panel (CardPanel), I can edit the description, labels, assignees, due date, subtasks, and completion — but **not the card's title**. The title shows as a static heading at the top of the panel. To rename a card I have no in-panel affordance at all, which is a glaring gap given that the title is the card's most important field.

## Solution

Make the card title editable **inline** in the CardPanel header, using the same click-to-edit interaction the panel already uses for subtask titles. I click the title, it becomes a text input with the current text pre-selected, I type the new name, and it saves on Enter or when I click away. Escape cancels. Empty or over-length titles are rejected with an inline error. The card stays where it is; the new title appears everywhere the card is shown.

## User Stories

1. As a board member, I want to click the card title in the side panel and have it turn into an editable input, so that I can rename the card without leaving the panel.
2. As a board member, I want the title text fully selected when I enter edit mode, so that I can type a brand-new name without first clearing the old one.
3. As a board member, I want to press Enter to save my new title, so that I can confirm the rename quickly with the keyboard.
4. As a board member, I want clicking away (blur) to save my new title when it is valid, so that I do not lose my edit just because I clicked elsewhere.
5. As a board member, I want pressing Escape to cancel the edit and restore the original title, so that I can back out of a mistaken edit.
6. As a board member, I want a blank or whitespace-only title that I try to commit with Enter to be rejected with a visible error while the input stays open, so that I understand why it did not save and can fix it.
7. As a board member, I want a title longer than 255 characters that I try to commit with Enter to be rejected with a visible error while the input stays open, so that I know the limit and can shorten it.
8. As a board member, I want clicking away (blur) with a blank or invalid title to silently revert to the original title, so that I never end up with an empty card name by accident.
9. As a board member, I want a hover state (subtle background + text cursor) and a "click to edit" tooltip on the title, so that I can discover the title is editable.
10. As a board member, I want my renamed title to persist after a page reload, so that I trust the change was saved to the backend.
11. As a board member, I want my renamed title to appear immediately on the card face on the board, so that I get instant feedback without refreshing.
12. As a board member, I want the rename to roll back to the previous title if the server rejects it, so that the UI never lies about what was saved.
13. As a board member, I want to rename a card even after it has been marked done, so that completion does not lock me out of fixing its name.
14. As a board member editing a title, I want switching to a different card (or closing the panel) to discard any half-typed unsaved edit, so that an in-progress edit never leaks onto the wrong card.
15. As a board member, I want committing an unchanged title (same as before) to simply close the editor without a redundant save call, so that no needless write hits the server.

## Implementation Decisions

**New deep module — title commit decision (`domain/`)**
- Extract a pure function that decides what a commit attempt should do, given the trigger, the typed value, and the current title. Interface shape (from the grilling, names not final):

  ```
  resolveTitleCommit({ trigger, value, current }) ->
    { action: 'error', message }   // trigger === 'enter' && invalid
    { action: 'revert' }           // trigger === 'blur'  && invalid
    { action: 'revert' }           // valid && trimmed === current (no-op)
    { action: 'save', title }      // valid && changed
  ```
- `trigger` is `'enter'` or `'blur'`. Validity uses the existing `validateCardTitle` (non-empty, <= 255). This isolates the save/revert/error branching from React so it is unit-testable, mirroring `domain/completion.js` and `domain/accent.js`.

**CardPanel (modify)**
- Replace the static title `<h2>` with a click-to-edit affordance, reusing the existing subtask-rename pattern (`editingId`/`editInput`/`editError`-style local state, scoped to the title).
- Enter edit mode on click: render an `<input>` with `autoFocus` and select-all on focus.
- Keyboard: Enter commits via the trigger `'enter'`; Escape cancels and restores the original.
- Blur commits via the trigger `'blur'`.
- On `action: 'save'`, call the existing `onSave({ title })` (no new store action). On `action: 'error'`, show the message inline and keep the input open. On `action: 'revert'`, close the editor and restore the original title.
- Do **not** set `maxLength` on the input — let `validateCardTitle` produce the error so the over-limit case is explained rather than silently truncated (consistent with the description field).
- Reset any in-progress title edit when the active card changes (effect keyed on `card.id`).

**Save path (no change)**
- Reuses `patchCard` optimistic update + rollback. `cardPatchToApi` already maps `title`. The header reads `card.title` from the store, so optimistic apply and rollback are reflected automatically.

**Styling (modify)**
- Title hover state: subtle background wash + `cursor: text`, plus a "click to edit" tooltip. Edit-mode input styled to sit in the header without layout shift.

**Scope of editability**
- Editing happens **only** in the side panel. The board card face stays read-only.
- Marking a card done does not disable title editing.

## Testing Decisions

Good tests assert external behavior, not implementation details — the inputs and outputs a user or caller can observe, not internal React state.

**Unit test — the new title-commit domain module.** Cover the full decision table: Enter + empty -> error; Enter + over-255 -> error; blur + empty -> revert; valid + changed -> save with trimmed title; valid + unchanged -> revert (no-op). Prior art: `src/domain/completion.test.js` and `src/domain/accent.test.js` — pure-function tests with no React.

**E2E — rename persists.** Add to `e2e/card.spec.js` (reuses its existing column+card setup): open the card panel, click the title, replace it, commit with Enter, wait for the PATCH 200, reload, and assert the new title shows on the card face. Prior art: the existing create-card-persists flow in the same file, and the subtask reorder/rename waits in `subtask.spec.js`.

Components are not unit-tested in this project (covered by E2E), so the CardPanel changes themselves are exercised only through the E2E flow.

## Out of Scope

- Inline title editing on the board card face (Card.jsx) — panel only.
- Editing any other card field not already editable.
- Backend changes — `PATCH /cards/:id` already accepts `title`; `validateCardTitle` and `cardPatchToApi` already exist.
- Rich text / multi-line titles — title remains a single-line plain string.
- Undo/history of title changes beyond the in-edit Escape cancel.
- Localizing the validation error copy (reuses existing `validateCardTitle` messages).

## Further Notes

- Interaction summary agreed in grilling: click-to-edit inline; Enter saves; Escape cancels; blur saves when valid and reverts when invalid; Enter on invalid shows an inline error and keeps the input open; select-all on entering edit mode; hover affordance + tooltip; done cards remain editable; no `maxLength`.
- This deliberately differs from subtask rename in one respect: subtask rename does nothing on blur, while title saves on blur (valid) / reverts (invalid). The title is the card's most important field, so commit-on-blur matches user expectation (Trello/Notion-style).
