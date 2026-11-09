# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm start                                # Dev server at localhost:3000 (proxies API to localhost:3350)
npm test                                 # Run tests in watch mode
npm test -- --watchAll=false             # Run tests once (CI mode)
npm test -- --testPathPattern="polling"  # Run a single test file
npm run build                            # Production build
npm run test:e2e                         # Run Playwright E2E tests (requires app running)
```

### Docker (recommended for full-stack dev)

```bash
docker compose up                        # Start postgres + api + frontend (frontend on :3300)
docker compose down                      # Stop all
docker compose down -v                   # Stop and delete database volume
```

First run only: `npm install && npx playwright install chromium`

**`CI=true npm run build` fails on a harmless third-party warning**: CRA treats warnings as errors under `CI=true`, and `react-datepicker` (9.1.0, latest) emits webpack's "Critical dependency: the request of a dependency is an expression" — it deliberately `require`s the optional `date-fns-tz` through a variable and falls back to `null`, so it's harmless. CRA can't ignore a single warning without `craco`/eject, so we accept it: use plain `npm run build`. ESLint itself is clean (`npx eslint src`). E2E runs against the dev server, so this doesn't block an E2E CI job.

## Project Overview

A Kanban board SPA for small teams (2–15 people). **Fully implemented** — React frontend connected to a real Node.js/PostgreSQL backend. Includes User Profile page (view/edit displayName, email, password), Subtasks with progress tracking, and a read-oriented List view alongside the default Board view.

- **Frontend** (`src/`): React + Zustand + dnd-kit
- **Backend** (`api/`): Node.js + Express + PostgreSQL, runs on port 3350
- **Full PRD (all features, merged, Thai)**: [requirement/Kanban-Board-PRD.md](requirement/Kanban-Board-PRD.md)
- **User Profile PRD**: [requirement/Kanban-Board-PRD.md §3](requirement/Kanban-Board-PRD.md#3-user-profile)

## Architecture

### Layout

`src/` is layered: `api/` (fetch client), `domain/` (pure logic — `ordering`, `validation`, `dates`, `colors`, `progress`, `accent`, `dragDrop`, `category`, `completion`, `titleEdit`, `assignees`, `subtaskBatch`, `subtaskVisibility`, `cardView` — unit-tested where there's real logic), `store/` (Zustand + the pure board actions factory `boardActions.js`), `hooks/`, `components/`, `routes/` (route components + `RequireAuth` guard). Generic, reusable presentational primitives live in `components/common/` (`Avatar`, `AvatarStack`, `Toast`, `ColorPicker`); the rest of `components/` is board-feature-specific. App-wide tunables (polling interval, toast duration, dnd activation distance) live in `src/constants.js`. CSS modules and `.test.js` are co-located with their source.

### API Client

`src/api/auth.js` — token storage (6 functions), silent-refresh logic (single in-flight promise), and `apiFetch(method, path, body)`. This is the auth seam: `apiFetch` is the only export callers need for requests. 401 clears both tokens and redirects to `/login`. `useSession.js` imports token helpers directly from here.

`src/api/client.js` — 29 exported API functions, each calling `apiFetch` + normalizing responses. No token knowledge (`login`/`register` return the API body; `useSession` stores the tokens via `auth.js`). Every function that returns an entity returns camelCase keys only — see the normalizers below. Unit-tested in `src/api/client.test.js` (`apiFetch` mocked).

In development, `src/setupProxy.js` proxies API routes (`/auth`, `/boards`, `/columns`, `/cards`, `/labels`, `/subtasks`) to `API_PROXY_TARGET` (default `http://localhost:3350`). **Proxy skips requests with `Accept: text/html`** so browser navigation to `/boards/:id` etc. is handled by React's historyApiFallback (serves `index.html`), not forwarded to the API.

### State

`src/store/useBoardStore.js` — all mutations use optimistic update pattern: snapshot → apply locally → API call → rollback on error.

`src/store/useSession.js` — JWT auth. `login()`/`register()` call the real backend, store token in localStorage, decode JWT `sub` → `currentUserId`. Also stores `displayName` and `email` fetched from `GET /auth/me` after auth. Exposes `fetchProfile()` (re-fetch on page reload) and `updateProfile()` (PATCH /auth/me).

`src/routes/RequireAuth.jsx` — calls `fetchProfile()` on mount when `isAuthenticated && !displayName` to re-hydrate after page reload.

### Polling

`src/hooks/usePolling.js` — 10s `setInterval`. Routes 403 → eject to `/boards`; 404 → navigate away.

### Key Decisions

- **Fractional float position**: `positionBetween(prev, next)` for drag-and-drop and subtask reordering — single record update; for cards and columns the backend rebalances on write when any gap < 1e-9 (subtasks never rebalance) — in the **same transaction** as the move, via `api/src/db/reposition.js` (#66), which locks the scope rows (source + target Column for Cards, the board for Columns) before the write so concurrent moves into one scope take turns. A request rejected inside the transaction (e.g. an unattached Category) throws an error carrying `status`, so the move rolls back too. The client proposes the position on move and the backend stores it as sent (a concurrent collision has gap 0, so it triggers a rebalance); on create the backend assigns `MAX(position) + 1` and the placeholder's position is replaced — PRD §1.3, decided in #53
- **Optimistic UI**: snapshot → apply → API → rollback on error
- **Board snapshot**: `GET /boards/:id` returns nested shape; `client.js` flattens to `{ board, columns[], cards[], labels[], members[], cardLabels[], cardAssignees[], subtasks[] }`
- **snake_case ↔ camelCase**: `normalizeBoard()` / `normalizeColumn()` / `normalizeLabel()` / `normalizeCard()` / `normalizeSubtask()` (responses), `normalizeSnapshot()` (the nested `GET /boards/:id` body), and `cardPatchToApi()` (requests) in `client.js` handle conversion. `attachLabel`/`attachAssignee` return the store's `{cardId, labelId}` / `{cardId, userId}` join shape. The API returns `board_id` on column/label create and patch so the normalizers never have to guess it (#52).
- **Profile endpoints**: `GET /auth/me`, `PATCH /auth/me`, `PATCH /auth/me/password` — implemented in `api/src/routes/auth.js`
- **Refresh tokens**: 60-minute access token + 7-day refresh token. On 401, `src/api/auth.js` `apiFetch` attempts silent refresh with single in-flight promise; failure clears both tokens and redirects to `/login`
- **Subtasks**: Nested per card, limit 50 per card (`MAX_SUBTASKS_PER_CARD` in `domain/validation.js`, imported by the API too; the API counts under a lock on the card row so concurrent adds can't overshoot — #59), stored with float position (not array index). Support toggle (checked), rename, reorder (↑/↓), delete. **One add path** (#67): a typed title is a **batch of one** — the single-line input sends `[title]` through the same `checkSubtaskBatch`/`describeSubtaskBatchError`, store `createSubtasks`, client `createSubtasks` and `POST …/subtasks/batch` as a paste; there is no single-add action/function/endpoint. Items without a `line` get line-less wording (`ชื่อ Subtask ว่าง`, `ชื่อ Subtask ยาวเกิน 100 ตัวอักษร`), and a full card reads `Subtask ครบลิมิต 50 แล้ว` — the same text as the hint that replaces "+ Add subtask" at 50 (`cardFullMessage`). **Batch add** (PRD §12, #60): pasting ≥ 2 non-blank lines into the "+ Add subtask" input turns it into a multi-line box (`SubtaskSection`, hint `Enter เพื่อเพิ่ม N รายการ · Esc ยกเลิก`; Shift+Enter = newline); each non-blank trimmed line becomes one Subtask, **all-or-nothing** — `domain/subtaskBatch.js` (`splitSubtaskLines`, `checkSubtaskBatch`, `describeSubtaskBatchError`) validates client-side and is reused by `POST /cards/:cardId/subtasks/batch` (`{ titles }` → 201 rows, one transaction under `lockCard`); store `createSubtasks(cardId, titles)` is optimistic, and a failure keeps the text in the box with the error inline; a second Enter while the POST is in flight is ignored. **Done Subtasks hidden** (PRD §12, #61): the panel lists only unchecked Subtasks plus `▸ แสดงที่เสร็จแล้ว (N)` (`data-testid="subtask-done-toggle"`, toggles to `▾ ซ่อนที่เสร็จแล้ว`, reveals them in place); the reveal state is local and resets on every panel open/Card switch (`CardPanel` keys `SubtaskSection` by `card.id`). In hidden mode ↑/↓ swap with the next *visible* Subtask: `domain/subtaskVisibility.js` (`visibleSubtasks`, `visibleNeighbour`) finds it, and `moveSubtask(id, dir, { hideDone })` lands between it and its real-order neighbour — hidden Subtasks keep their positions. Header count and card progress still count all. Progress shown on the card via `domain/progress.js` `progressView(done,total)` — adaptive **segments** (≤ 8 subtasks) vs continuous **mini-bar** (> 8) + `done/total` count (turns green when complete).
- **Column Accent** (see [ADR-0001](docs/adr/0001-column-accent-model.md)): `color VARCHAR(7) NULL` on `columns` table is the column's **Accent** — it themes the whole column, not just the header strip (which superseded the original [Column Header Colors PRD](requirement/Kanban-Board-PRD.md#2-column-header-colors-superseded-by-adr-0001)). `PATCH /columns/:id` accepts `color` (hex or null); `renameColumn(id, { name, color })` optimistic update uses `color !== undefined ? color : c.color` to handle null (clear). In `Column.jsx`, when `color` is set the column root gets `className .accented` + inline `--accent` CSS var; CSS derives: title chip background = `var(--accent)`, column wash = `color-mix(--accent 12%, white)`, count = `color-mix(--accent, black 38%)`, "New card" button text = `color-mix(--accent, black 30%)` (passed to `CardComposer` via `accent` prop). Chip text stays `#1e293b`. When `color` is null, all fall back to neutral gray. Edit form shows 8 pastel presets + "+" custom + "✕" clear using `data-swatch` attributes.
- **Editorial card** (see [ADR-0002](docs/adr/0002-card-editorial-model.md), [spec](requirement/card_ui_spec.md)): type-forward card — category dot + uppercase label, hero title, hairline rule, foot (due / adaptive progress). IBM Plex Sans Thai; tokens in `index.css`. Superseded the old "card color band = first label". `normalizeCard()` in client.js uses `.slice(0,10)` to normalize node-pg ISO timestamp DATE columns to YYYY-MM-DD.
- **Card Category** (ADR-0002): a card's **Category** is the label flagged by `category_label_id` (nullable FK on `cards`). It's the only label shown on the card face (uppercase name + dot); its color is the **card accent** (`domain/accent.js` — `categoryLabel()` resolves it, `cardAccent()` derives `solid`/`text` shades via `color-mix`, neutral gray when unset). Other labels are managed only in `CardPanel`. Set via the ★ toggle in `LabelPicker`; **auto-set** to the first attached label, and promoted to the next remaining label on detach. Auto-promotion rules live in `domain/category.js` (`resolveAttach`, `resolveDetach`) and are **enforced server-side** (issue #55): `PUT`/`DELETE /cards/:id/labels/:labelId` apply them in the same transaction as the attach/detach (promotion order = label creation order, `created_at, id`, matched by the snapshot and the store) and return `{ card_id, label_id, category_label_id }` (detach is 200, not 204); `PATCH /cards/:id` rejects a `category_label_id` not attached to the card (400). The store's `attachLabel`/`detachLabel` carry the Category in the same optimistic step (predict with `resolveAttach`/`resolveDetach`, settle to the server's value), so a failed attach/detach rolls both back together — `CardPanel` no longer fires a second category patch. Settle adopts the server's Category only if the card's Category is still what apply predicted (a ★ pressed mid-flight wins). `LabelPicker` counts attaches still in flight per card+label (`pendingAttaches`) and disables their ☆/★ until it settles, since the server would reject them as the Category until the attach commits (#56). Known residual: ☆ on a label another tab detached (before the next poll) still gets a 400 → rollback + op-error banner. The ★ toggle still uses `patchCard({ categoryLabelId })`.
- **Multiple assignees** (ADR-0002): modeled like labels — a `cardAssignees: [{cardId,userId}]` join in the store, optimistic `attachAssignee`/`detachAssignee` (`PUT`/`DELETE /cards/:id/assignees/:userId`). Replaced the single `assignee_id`. `AssigneePicker` is a multi-toggle list; the card face shows up to 3 overlapping avatars then `+N` via `common/AvatarStack`.
- **Card completion** (see [ADR-0003](docs/adr/0003-card-completion-model.md), issues #35–#37): a per-card **done** state independent of column, stored as `completed_at DATE NULL` on `cards`; the boolean is derived (`completedAt !== null`). Toggled only in `CardPanel` (full-width button at the top of the body) — no card-face control. Client stamps the date (`patchCard({ completedAt: toYMD(new Date()) })`; clear with `null`) through the generic card patch — no new store action. Soft client-side guard: marking done with unchecked subtasks fires a `window.confirm`; un-marking and no-subtask cards warn nothing. Card face reflects done with a ✓ badge + ~0.6 opacity; the foot shows the completion date in place of the due date (no overdue styling) while keeping subtask progress; the card stays in place (no move/hide). Logic lives in the new deep module `domain/completion.js` (`isDone`, `completionPatch`; the unchecked-Subtask count for the warning comes from `subtaskProgress`, #64). `normalizeCard()`/`cardPatchToApi()` map `completed_at` ↔ `completedAt`.
- **Card title inline edit** (issue #38): the card title is editable **inline in `CardPanel`** — click the `<h2>` header (hover wash + `cursor: text`) to swap it for an input (`autoFocus` + select-all). **Enter** commits, **Escape** cancels, **blur** commits when valid / reverts when invalid. Empty/over-255 on Enter shows an inline error with the input kept open; no `maxLength` (lets `validateCardTitle` explain). Saves through the generic `patchCard({ title })` (optimistic + rollback) — no new store action. Card face stays read-only; done cards remain editable. The save/revert/error branching lives in the deep module `domain/titleEdit.js` (`resolveTitleCommit({ trigger, value, current })`); a `skipTitleBlur` ref suppresses the unmount-blur that a keyboard commit would otherwise re-fire.
- **Card view** (#64): `domain/cardView.js` `cardView(board, card)` is the one place a Card's face data (plus the joins the Card panel needs) is derived from the store board — attached `labelIds`, `category` + `accent`, `done`, `overdue` (never on a done card), `date` (`{ kind: 'completed'|'due'|'none', ymd }` — which date the foot shows), `assigneeIds` + resolved `assignees` (assignment order, non-members skipped), the card's `subtasks`, and `progress` (`{ done, total, view }` or `null` with no Subtasks). `Card`, `ListRow` take it as a `face` prop; `Column`/`ListView`/`CardPanel` take the store `board` and call it per Card, as does the drag overlay in `BoardPage` — no component joins `cardLabels`/`cardAssignees`/`subtasks` by card id. The done count itself is `subtaskProgress(subtasks)` in `domain/progress.js` (used by `cardView` and `SubtaskSection`'s reveal line; the panel's mark-done warning reads it via `cardView(...).progress`).
- **List view** (issues #45–#48, #51; [PRD §11](requirement/Kanban-Board-PRD.md#11-board-list-view)): a second, read-oriented rendering of the board, toggled via a `role="tablist"` `[ Board | List ]` control in `TopBar`'s left cluster (`view`/`onViewChange` props). Route, data, and mutation flow are unchanged — `BoardPage` holds `view` as local state (default `'board'`, not persisted) and gates the whole `DndContext` block on `view === 'board'`, rendering `ListView` on `view === 'list'`. `ListView.jsx` renders one `<section>` per Column, sorted by position, with a sticky (`position: sticky; top: 0`) header pill themed by the Column's Accent (same `--accent`/`.accented` mechanism as ADR-0001, reusing `data-testid="column-chip"`), each Column's Cards as `ListRow`s, and a `CardComposer` at the section foot for adding cards. `ListRow.jsx` is a single-line row that **intentionally duplicates** `Card.jsx`'s presentational markup (category dot, due date, adaptive progress, done badge, assignee `AvatarStack`) rather than sharing a component, because `Card.jsx` is coupled to dnd-kit's `useSortable` hook, which List view doesn't mount — both get their face data from the same Card view module (`domain/cardView.js`). Unlike the card face, a row with no Category still renders a neutral gray dot (`data-testid="list-row-category-none"`, per PRD §11) so row columns stay aligned. Clicking (or Enter/Space on) a row opens the same `CardPanel` as Board view; switching views closes the panel. No new ADR, store action, or API endpoint — reuses ADR-0001/0002/0003 wholesale. Both views' composers add cards through the board actions' `createCard(colId, title)` (banner on failure) — the banner was added during #48 after discovering Board view had none for failed card creation at all.
- **Due date picker**: react-datepicker replaces native `<input type="date">` (fixes Firefox UX). Format `dd/MM/yyyy`. Thai locale incompatible with date-fns v4 — omitted.
- **Label color picker**: 8 pastel preset swatches + "+" custom (hidden `<input type="color">` triggered by ref). Selection ring via CSS `outline`. Default `#fca5a5`.
- **Label edit** ([PRD §7](requirement/Kanban-Board-PRD.md#7-label-color-picker--pastel-presets), kept as a feature in #53): existing labels are editable (name + color) via the ✎ button per row in `LabelPicker` → inline edit form (mirrors Column `RenameForm`). Optimistic `patchLabel(labelId, patch)` updates `board.labels` in place, so any card using that label as its Category re-renders with the new name/color instantly. Backend `PATCH /labels/:id` + client `patchLabel` already existed.
- **Shared `ColorPicker`**: `src/components/common/ColorPicker.jsx` is the single swatch picker used by both the column-color (`allowClear` → renders "✕" clear, value can be `null`) and label-color editors. Palette lives in `src/domain/colors.js` (`PRESET_COLORS`). Keeps `data-swatch` attrs (`<hex>` / `custom` / `clear`) that the column-color E2E selectors depend on.
- **Date helpers**: `src/domain/dates.js` — `fromYMD`/`toYMD` (timezone-safe local-day conversion for the `YYYY-MM-DD` due-date strings), `formatDueDate` (th-TH), `isOverdue`. Used by `Card.jsx` and `DueDateField.jsx`.
- **Store optimistic helper**: `useBoardStore.js` wraps every `board`-scoped mutation except `addMember` in an `optimistic(get, set, { apply, commit, settle })` helper (snapshot → apply → await commit → settle → rollback on error → rethrow). Every mutation rethrows; the **board actions** module decides what that means (see below). `BoardListPage` swallows the board-list mutations' rejections because the store's `error` is already rendered there (issue #49). `moveSubtaskUp/Down` delegate to one `moveSubtask(id, dir, { hideDone })` (`hideDone` = the panel is hiding done Subtasks, #61). `addMember` is deliberately not optimistic — the invitee's id isn't known until the server resolves the email — so it refetches the board after success.
- **Board actions** (#68): `src/store/boardActions.js` — `createBoardActions({ store, boardId, report })` (pure, unit-tested against a fake store in `boardActions.test.js`) and the hook `hooks/useBoardActions(boardId, { opError, closeCard })` that binds it to `useBoardStore`. It owns every mutation of the open board **and its error policy**: **banner** (default — `report.opError(message)`, the promise resolves), **inline** (Subtask add/rename and invite reject so `SubtaskSection`/`InviteDialog` show it), **card gone** (`patchCard` 404 → close the Card panel + "This card was deleted by another member."; also `actions.cardDeleted()` for polling), and **delete-404 swallowed**. `BoardPage` builds it once and passes `actions` to `CardPanel`, which passes it to `LabelPicker`/`AssigneePicker`/`SubtaskSection` — they call e.g. `actions.attachLabel(cardId, labelId)` directly; no per-mutation callback props. Nothing passes a user id any more: the client, store and actions take only what the server needs (the session's user id is used only for `isOwner` and a new board's placeholder `ownerId`).
- **Card deleted by another member** (issue #50, PRD §1.5): `moveCard`/`patchCard`/`deleteCard` are wrapped in `dropCardIfGone` — on a 404 the card (plus its `cardLabels`/`cardAssignees`/`subtasks`, via `withoutCards`) is removed instead of restored from the rollback snapshot, then the error is rethrown. The board actions announce "This card was deleted by another member." and close the Card panel only where a deletion is actually detected: `BoardPage`'s `handleReconcile` (the open card is missing from a polled snapshot → `actions.cardDeleted()`) and a panel `patchCard` 404. `actions.deleteCard` swallows a 404 (the card is already gone, which is what the user asked for). Any other disappearance of the open card (e.g. its column deleted locally) closes the panel silently. `deleteColumn` drops its Cards through the same `withoutCards`, so their labels/assignees/Subtasks don't linger in the store (#63).

### Validation Constraints

- `board.name`, `column.name`: non-empty, ≤ 100 chars
- `card.title`: non-empty, ≤ 255 chars
- `card.description`: ≤ 5,000 chars
- `subtask.title`: non-empty, ≤ 100 chars; max 50 subtasks per card
- `label.color`, `column.color`: valid hex (`#rgb` or `#rrggbb`), or `null` to clear column color
- Invite target must already be a registered user
- `displayName`: non-empty, ≤ 100 chars
- `newPassword`: ≥ 8 chars; `confirmPassword` must match

Validation runs client-side (UX) and is enforced by the backend (authoritative).

## Tests

### Unit tests (222)
`src/domain/` (incl. `progress.test.js`, `accent.test.js`, `dates.test.js`, `completion.test.js`, `titleEdit.test.js`, `dragDrop.test.js`, `category.test.js`, `assignees.test.js`, `subtaskBatch.test.js`, `subtaskVisibility.test.js`, `cardView.test.js`), `src/api/client.test.js` (response normalization, no token storage), `src/hooks/`, `src/store/useSession.test.js`, `src/store/useBoardStore.test.js`, `src/store/boardActions.test.js` (the error policy). Run: `npm test -- --watchAll=false`

Not unit-tested: components — covered by E2E.

`useSession` and `useBoardStore` are unit-tested with the same pattern: call actions via `useBoardStore.getState()` directly (no renderHook), `jest.mock('../api/client')`, reset with `setState({...})` in `beforeEach`. `useSession.test.js` also mocks `../api/auth` for token helpers. `useBoardStore.test.js` covers the optimistic-apply → settle → rollback path for representative mutations (incl. subtask toggle/delete/move rolling back and rethrowing, and card 404s dropping the card).

### E2E tests (Playwright)

`e2e/` — 78 tests across 14 files. Require the full stack (`docker compose up`).

| File | Flows covered | Status |
|---|---|---|
| `auth.spec.js` | register, logout, login, redirect unauthenticated | ✅ |
| `card.spec.js` | create column + card → persist on refresh; edit card title inline → persist; failed card creation rolls back + shows error banner | ✅ |
| `dnd.spec.js` | drag card cross-column → persist on refresh; the dragged Card (drag overlay) shows the same Subtask progress and assignee avatars as the resting Card | ✅ |
| `profile.spec.js` | update name, email conflict, change password, wrong password | ✅ |
| `subtask.spec.js` | create, single-add inline validation in batch wording (no POST), toggle, rename, reorder, delete subtasks; max 50 limit; paste multi-line → batch box → Enter adds all in order (persists), single-line paste acts like typing, over-limit message keeps the text, Esc cancels, Shift+Enter adds a line, server failure rolls back, double Enter posts once; done Subtasks hidden behind a reveal line (resets on reopen), all-done card, ↑ skips a hidden Subtask → persists | ✅ |
| `board.spec.js` | create/rename/delete board; owner-only buttons show on a new board without reload; member cannot delete | ✅ |
| `member.spec.js` | invite member → member sees board | ✅ |
| `column-color.spec.js` | set column color, persist after reload, clear color | ✅ |
| `category.spec.js` | attach label → auto-set as category → shows on card; rename label → card reflects it; ☆ disabled while the attach PUT is held, then sets the Category with no error banner (#56) | ✅ |
| `assignee.spec.js` | assign two members → stack of two avatars, persists | ✅ |
| `completion.spec.js` | mark done → ✓ badge + fade + footer date → reload → unmark; subtask warn (cancel/accept) | ✅ |
| `list-view.spec.js` | toggle Board↔List; sections per column w/ sticky Accent-tinted headers; rows sorted by position; category (or neutral dot)/due/progress/done state/assignee avatars on rows; no DnD; cross-tab polling; row click/Enter opens Card panel + panel push/close on view switch; "+ New card" per section (success + rollback) | ✅ |
| `op-error.spec.js` | failed column rename / subtask toggle / column create / label create / assignee toggle / card delete → rollback + op-error banner, no uncaught page error; failed label attach → no orphaned Category on the server snapshot or card face (#55); failed board rename on `/boards` → rollback, form closes, error shown, no uncaught page error | ✅ |
| `deleted-card.spec.js` | drag a card deleted server-side → removed (no snap-back) + "card not found" banner; polling drops the open card → panel closes + notice, in Board and List view; deleting an already-deleted card → just gone, no banner | ✅ |

Run: `npm run test:e2e` (or `npx playwright test --ui` for interactive mode). **Flaky under parallel** (single shared Postgres → contention; tests time out waiting for elements). Re-run, or use `npx playwright test --workers=1` for a deterministic pass.

**DnD note**: dnd-kit uses `PointerSensor` with `activationConstraint: { distance: 8 }`. Use `pointerDrag()` helper in `e2e/helpers.js` — `page.dragTo()` skips pointer events and won't trigger activation.

**Profile E2E note**: Use `page.click('a:has-text("← Boards")')` for SPA navigation back to boards. Avoid `page.goBack()` to board pages — Chromium's history navigation sends a non-HTML Accept header that bypasses the proxy fix, returning API JSON.

**Subtask E2E note**: `setupBoard()` waits for board/column/card POST responses before proceeding to prevent tempId races. E2E subtask tests wait for POST 201 on create/add and PATCH 200 on toggle/rename/reorder to ensure real server IDs are in store before assertions.

**Column color E2E note**: `data-swatch` attributes on swatch buttons enable stable selectors — `button[data-swatch="#fca5a5"]` for presets, `button[data-swatch="clear"]` for clear, `button[data-swatch="custom"]` for the "+" picker. Accent assertions target the **title chip** (`[data-testid="column-chip"]`), not the header: `getComputedStyle(chip).backgroundColor` equals the chosen hex when set, or the neutral default `rgb(226, 232, 240)` (`#e2e8f0`) when cleared. The "+ New card" composer trigger text is referenced by `card.spec.js`, `dnd.spec.js`, and `subtask.spec.js`.

**List view E2E note**: `addCardToColumn(page, columnIndex, title)` scopes card creation to a specific `[data-testid="column"]` — the generic `addCard()` always hits the *first* matching "+ New card" composer on the page, so populating more than one column requires the scoped helper. Sticky-header assertions must take their baseline measurement after scrolling past the section's `margin-top` (~20px) — measuring before any scroll captures the header's natural (unstuck) position, not its pinned one, and produces a false failure even when sticky positioning is correct. `openNewBoard(page, boardName, { email, displayName })` (register + create board + navigate to it) is shared by `setupBoard()` and any test that needs a differently-named or differently-owned board.

### CI (GitHub Actions)

`.github/workflows/ci.yml` — runs both `test-frontend` (222 unit tests) and `test-api` (194 integration tests, postgres:16-alpine service) on every push/PR to `main`.

## API

The Node.js + Express + PostgreSQL backend lives in `api/`. Run all API commands from the `api/` directory (or prefix with `cd api &&`).

### Commands

```bash
cd api && npm run dev                              # API server with --watch at localhost:3350
cd api && npm run migrate                          # Run DB migrations (kanban_dev)
cd api && npm run migrate:test                     # Run DB migrations (kanban_test)
cd api && npm test                                 # Run all tests (--maxWorkers=1 --forceExit)
cd api && npm test -- --testPathPatterns="boards"  # Run a single test file
```

Docker is the recommended way to run the API in development — `docker compose up` from the repo root starts postgres + API + frontend together.

### Key Files

| File | Purpose |
|---|---|
| `api/src/app.js` | Express app — cors, json middleware, route mounts |
| `api/src/index.js` | HTTP server (PORT=3350) |
| `api/src/db/pool.js` | pg Pool — `DATABASE_URL` or `TEST_DATABASE_URL` from env |
| `api/src/db/inTransaction.js` | `inTransaction(fn)` — BEGIN/COMMIT/ROLLBACK on one client; the only place routes get a transaction (no hand-written BEGIN/COMMIT) |
| `api/src/db/reposition.js` | `moveCard(client, cardId, targetColumnId, write)` / `moveColumn(client, boardId, write)` — lock scope(s) → write → rebalance if crowded, in the caller's transaction (#66). A Card move locks its source **and** target Column in id order (else opposite cross-column moves deadlock); a Card moved by another request between read and lock → 409 |
| `api/src/db/migrate.js` | Idempotent migration runner (schema_migrations table) |
| `api/src/db/migrations/` | SQL migration files 001–007 |
| `api/src/middleware/requireAuth.js` | JWT verify → `req.user.id` |
| `api/src/middleware/requireAccess.js` | `requireAccess(kind, param)` — Card/Subtask/Column/Label id → board + membership in one query → 404/403 before the handler; `req.access` |
| `api/src/routes/auth.js` | POST /auth/register, /auth/login, GET /auth/me, PATCH /auth/me |
| `api/src/routes/boards.js` | Board CRUD, membership, labels, full snapshot GET /boards/:id |
| `api/src/routes/columns.js` | Column CRUD + POST /columns/:id/cards |
| `api/src/routes/cards.js` | Card PATCH/DELETE, assignees, category |
| `api/src/routes/subtasks.js` | POST batch (the only add — a single add is a batch of one) + PATCH/DELETE subtasks |
| `api/src/routes/labels.js` | Label PATCH/DELETE |
| `api/src/test/helpers.js` | createUser(), clearDb() for integration tests |
| `api/src/test/globalSetup.js` | Runs migrations on TEST_DATABASE_URL before test run |

### Environment (`api/.env` — gitignored)

```
DATABASE_URL=postgres://postgres:PASSWORD@127.0.0.1:5434/kanban_dev
TEST_DATABASE_URL=postgres://postgres:PASSWORD@127.0.0.1:5434/kanban_test
JWT_SECRET=dev-secret-key-kanban
PORT=3350
```

Copy from `api/.env.example`. Docker Compose injects its own env vars; `api/.env` is only needed for non-Docker local dev and running tests natively.

### Tests

194 integration tests across 8 suites. Hit a real `kanban_test` PostgreSQL database (local postgres, not Docker — Docker's postgres uses a separate network). Run with `cd api && npm test` (no env override needed; dotenv loads `api/.env`). Uses `cross-env NODE_OPTIONS=--experimental-vm-modules` for ESM/Jest compatibility on Windows and Linux.

**Critical**: use `--maxWorkers=1`, NOT `--runInBand`. Jest 30 runs test files in parallel by default.

### Key Decisions

- **Board snapshot**: `GET /boards/:id` returns the board's own fields at the top level (`id`, `name`, `owner_id`, …) plus `columns[]` (each with nested `cards[]`, each card carrying `label_ids[]`, `assignees[]`, `subtasks[]`), `labels[]`, and `members[]` — one call for initial render. `client.js` `normalizeSnapshot()` flattens it to `{ board, columns[], cards[], labels[], members[], cardLabels[], cardAssignees[], subtasks[] }`.
- **Card completion**: `cards.completed_at DATE NULL` — null = not done. `PATCH /cards/:id` accepts it. No server-side subtask check (client-side UX guard only).
- **Card Category**: `cards.category_label_id` (nullable FK → labels, `ON DELETE SET NULL`). Snapshot returns it per card. Label attach/detach auto-set/promote it transactionally using the shared `src/domain/category.js`; PATCH only accepts an attached label (or null), checked in the same transaction. Every Category path locks the card row **first** among card-level locks (`lockCard` — `SELECT … FOR UPDATE`; only a move's Column locks, #66, come before it): locking after the `card_labels` INSERT deadlocks concurrent attaches (its FK check holds KEY SHARE on the card). A card deleted mid-request returns 404.
- **Multiple assignees**: `card_assignees (card_id, user_id)` join. `PUT`/`DELETE /cards/:id/assignees/:userId`.
- **Authorization**: board membership resolved via FK chain; never trust client-supplied role claims. Board-id routes use `requireMembership`/`requireOwner`; every route reached by a Card, Subtask, Column or Label id uses `requireAccess(kind)` (#65), so all answer alike **before body validation**: unknown or malformed id → 404, non-member → 403 (matrix in `requireAccess.test.js`). An entity deleted after the check → 404 too: every PATCH that updates no row returns 404 (DELETE of a Card/Column/Label stays an idempotent 204; DELETE of a Subtask returns 404), and the two INSERTs whose only FK parent is the resolved entity (POST a Card into a Column, PUT an assignee) map an FK violation to 404 via `db/isParentGone.js` — not globally, since a Card PATCH whose target Column/Label vanished must not read as "card deleted". Length limits come from `src/domain/validation.js` (`MAX_NAME_LENGTH`, `MAX_CARD_TITLE_LENGTH`, `MAX_CARD_DESCRIPTION_LENGTH`, `MAX_SUBTASK_TITLE_LENGTH`) — no hard-coded numbers in routes.
- **Rate limiter**: bypassed when `NODE_ENV === 'development'` or `'test'` to avoid accumulation across test runs.
- **ESM**: `api/` uses `"type": "module"` (full ESM). `api/src/db/reposition.js` imports `needsRebalance`/`rebalance` directly from the shared `src/domain/ordering.js` — there is no separate backend copy. `cross-env` in test scripts ensures `NODE_OPTIONS=--experimental-vm-modules` works on Windows and Linux.

## Agent skills

### Issue tracker

Issues and PRDs live in GitHub Issues (`khthana/kanban-board`) via the `gh` CLI. See `docs/agents/issue-tracker.md`.

### Triage labels

Five canonical triage roles; `ready-for-human` maps to the existing `hitl` label, the rest use their default names (`needs-triage`, `needs-info` not yet created). See `docs/agents/triage-labels.md`.

### Domain docs

Single-context: one `CONTEXT.md` + `docs/adr/` at the repo root. See `docs/agents/domain.md`.
