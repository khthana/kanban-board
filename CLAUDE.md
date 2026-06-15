# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm start                                # Dev server at localhost:3000 (proxies API to localhost:4000)
npm test                                 # Run tests in watch mode
npm test -- --watchAll=false             # Run tests once (CI mode)
npm test -- --testPathPattern="polling"  # Run a single test file
npm run build                            # Production build
npm run test:e2e                         # Run Playwright E2E tests (requires app running)
```

### Docker (recommended for full-stack dev)

```bash
docker compose up                        # Start postgres + api + frontend (frontend on :3600)
docker compose down                      # Stop all
docker compose down -v                   # Stop and delete database volume
```

First run only: `npm install && npx playwright install chromium`

## Project Overview

A Kanban board SPA for small teams (2–15 people). **Fully implemented** — React frontend connected to a real Node.js/PostgreSQL backend. Includes User Profile page (view/edit displayName, email, password) and Subtasks with progress tracking.

- **Frontend** (this repo): React + Zustand + dnd-kit
- **Backend** (separate repo: `kanban-board-api`): Node.js + Express + PostgreSQL, runs on port 4000
- **Full PRD**: [requirement/Kanban-Board-PRD.md](requirement/Kanban-Board-PRD.md)
- **User Profile PRD**: [requirement/PRD-User-Profile.md](requirement/PRD-User-Profile.md)

## Architecture

### Layout

`src/` is layered: `api/` (fetch client), `domain/` (pure logic — `ordering`, `validation`, `dates`, `colors`, `progress`, `accent` — unit-tested where there's real logic), `store/` (Zustand), `hooks/`, `components/`, `routes/` (route components + `RequireAuth` guard). Generic, reusable presentational primitives live in `components/common/` (`Avatar`, `AvatarStack`, `Toast`, `ColorPicker`); the rest of `components/` is board-feature-specific. App-wide tunables (polling interval, toast duration, dnd activation distance) live in `src/constants.js`. CSS modules and `.test.js` are co-located with their source.

### API Client

`src/api/client.js` — real `fetch()` client. All functions attach `Authorization: Bearer <token>` from localStorage. 401 response clears token and redirects to `/login`. Normalizes backend snake_case responses to camelCase for the store.

In development, `src/setupProxy.js` proxies API routes (`/auth`, `/boards`, `/columns`, `/cards`, `/labels`, `/subtasks`) to `API_PROXY_TARGET` (default `http://localhost:4000`). **Proxy skips requests with `Accept: text/html`** so browser navigation to `/boards/:id` etc. is handled by React's historyApiFallback (serves `index.html`), not forwarded to the API.

### State

`src/store/useBoardStore.js` — all mutations use optimistic update pattern: snapshot → apply locally → API call → rollback on error.

`src/store/useSession.js` — JWT auth. `login()`/`register()` call the real backend, store token in localStorage, decode JWT `sub` → `currentUserId`. Also stores `displayName` and `email` fetched from `GET /auth/me` after auth. Exposes `fetchProfile()` (re-fetch on page reload) and `updateProfile()` (PATCH /auth/me).

`src/routes/RequireAuth.jsx` — calls `fetchProfile()` on mount when `isAuthenticated && !displayName` to re-hydrate after page reload.

### Polling

`src/hooks/usePolling.js` — 10s `setInterval`. Routes 403 → eject to `/boards`; 404 → navigate away.

### Key Decisions

- **Fractional float position**: `positionBetween(prev, next)` for drag-and-drop and subtask reordering — single record update, backend rebalances when gap < 1e-9
- **Optimistic UI**: snapshot → apply → API → rollback on error
- **Board snapshot**: `GET /boards/:id` returns nested shape; `client.js` flattens to `{ board, columns[], cards[], labels[], members[], cardLabels[], cardAssignees[], subtasks[] }`
- **snake_case ↔ camelCase**: `normalizeCard()` / `normalizeSubtask()` / `cardPatchToApi()` in `client.js` handle conversion
- **Profile endpoints**: `GET /auth/me`, `PATCH /auth/me`, `PATCH /auth/me/password` in `kanban-board-api`
- **Refresh tokens**: 60-minute access token + 7-day refresh token. On 401, `client.js` attempts silent refresh with single in-flight promise; failure clears both tokens and redirects to `/login`
- **Subtasks**: Nested per card, limit 20 per card, stored with float position (not array index). Support toggle (checked), rename, reorder (↑/↓), delete. Progress shown on the card via `domain/progress.js` `progressView(done,total)` — adaptive **segments** (≤ 8 subtasks) vs continuous **mini-bar** (> 8) + `done/total` count (turns green when complete).
- **Column Accent** (see [ADR-0001](docs/adr/0001-column-accent-model.md)): `color VARCHAR(7) NULL` on `columns` table is the column's **Accent** — it themes the whole column, not just the header strip (which superseded [PRD-Column-Colors](requirement/PRD-Column-Colors.md)). `PATCH /columns/:id` accepts `color` (hex or null); `renameColumn(id, userId, { name, color })` optimistic update uses `color !== undefined ? color : c.color` to handle null (clear). In `Column.jsx`, when `color` is set the column root gets `className .accented` + inline `--accent` CSS var; CSS derives: title chip background = `var(--accent)`, column wash = `color-mix(--accent 12%, white)`, count = `color-mix(--accent, black 38%)`, "New card" button text = `color-mix(--accent, black 30%)` (passed to `CardComposer` via `accent` prop). Chip text stays `#1e293b`. When `color` is null, all fall back to neutral gray. Edit form shows 8 pastel presets + "+" custom + "✕" clear using `data-swatch` attributes.
- **Editorial card** (see [ADR-0002](docs/adr/0002-card-editorial-model.md), [spec](requirement/card_ui_spec.md)): type-forward card — category dot + uppercase label, hero title, hairline rule, foot (due / adaptive progress). IBM Plex Sans Thai; tokens in `index.css`. Superseded the old "card color band = first label". `normalizeCard()` in client.js uses `.slice(0,10)` to normalize node-pg ISO timestamp DATE columns to YYYY-MM-DD.
- **Card Category** (ADR-0002): a card's **Category** is the label flagged by `category_label_id` (nullable FK on `cards`). It's the only label shown on the card face (uppercase name + dot); its color is the **card accent** (`domain/accent.js` — `categoryLabel()` resolves it, `cardAccent()` derives `solid`/`text` shades via `color-mix`, neutral gray when unset). Other labels are managed only in `CardPanel`. Set via the ★ toggle in `LabelPicker`; **auto-set** to the first attached label, and promoted to the next remaining label on detach. No new store action — reuses `patchCard({ categoryLabelId })`.
- **Multiple assignees** (ADR-0002): modeled like labels — a `cardAssignees: [{cardId,userId}]` join in the store, optimistic `attachAssignee`/`detachAssignee` (`PUT`/`DELETE /cards/:id/assignees/:userId`). Replaced the single `assignee_id`. `AssigneePicker` is a multi-toggle list; the card face shows up to 3 overlapping avatars then `+N` via `common/AvatarStack`.
- **Card completion** (see [ADR-0003](docs/adr/0003-card-completion-model.md), issues #35–#37): a per-card **done** state independent of column, stored as `completed_at DATE NULL` on `cards`; the boolean is derived (`completedAt !== null`). Toggled only in `CardPanel` (full-width button at the top of the body) — no card-face control. Client stamps the date (`patchCard({ completedAt: toYMD(new Date()) })`; clear with `null`) through the generic card patch — no new store action. Soft client-side guard: marking done with unchecked subtasks fires a `window.confirm`; un-marking and no-subtask cards warn nothing. Card face reflects done with a ✓ badge + ~0.6 opacity; the foot shows the completion date in place of the due date (no overdue styling) while keeping subtask progress; the card stays in place (no move/hide). Logic lives in the new deep module `domain/completion.js` (`isDone`, `completionPatch`, `incompleteSubtasks`). `normalizeCard()`/`cardPatchToApi()` map `completed_at` ↔ `completedAt`.
- **Due date picker**: react-datepicker replaces native `<input type="date">` (fixes Firefox UX). Format `dd/MM/yyyy`. Thai locale incompatible with date-fns v4 — omitted.
- **Label color picker**: 8 pastel preset swatches + "+" custom (hidden `<input type="color">` triggered by ref). Selection ring via CSS `outline`. Default `#fca5a5`.
- **Label edit**: existing labels are editable (name + color) via the ✎ button per row in `LabelPicker` → inline edit form (mirrors Column `RenameForm`). Optimistic `patchLabel(labelId, userId, patch)` updates `board.labels` in place, so any card using that label as its Category re-renders with the new name/color instantly. Backend `PATCH /labels/:id` + client `patchLabel` already existed.
- **Shared `ColorPicker`**: `src/components/common/ColorPicker.jsx` is the single swatch picker used by both the column-color (`allowClear` → renders "✕" clear, value can be `null`) and label-color editors. Palette lives in `src/domain/colors.js` (`PRESET_COLORS`). Keeps `data-swatch` attrs (`<hex>` / `custom` / `clear`) that the column-color E2E selectors depend on.
- **Date helpers**: `src/domain/dates.js` — `fromYMD`/`toYMD` (timezone-safe local-day conversion for the `YYYY-MM-DD` due-date strings), `formatDueDate` (th-TH), `isOverdue`. Used by `Card.jsx` and `DueDateField.jsx`.
- **Store optimistic helper**: `useBoardStore.js` wraps every `board`-scoped mutation in an `optimistic(get, set, { apply, commit, settle, rethrow })` helper (snapshot → apply → await commit → settle → rollback on error). Some subtask mutations pass `rethrow: false` (fire-and-forget). `moveSubtaskUp/Down` delegate to one `moveSubtask(id, dir)`.

### Validation Constraints

- `board.name`, `column.name`: non-empty, ≤ 100 chars
- `card.title`: non-empty, ≤ 255 chars
- `card.description`: ≤ 5,000 chars
- `subtask.title`: non-empty, ≤ 100 chars; max 20 subtasks per card
- `label.color`, `column.color`: valid hex (`#rgb` or `#rrggbb`), or `null` to clear column color
- Invite target must already be a registered user
- `displayName`: non-empty, ≤ 100 chars
- `newPassword`: ≥ 8 chars; `confirmPassword` must match

Validation runs client-side (UX) and is enforced by the backend (authoritative).

## Tests

### Unit tests (106)
`src/domain/` (incl. `progress.test.js`, `accent.test.js`, `dates.test.js`, `completion.test.js`), `src/hooks/`, `src/store/useSession.test.js`, `src/store/useBoardStore.test.js`. Run: `npm test -- --watchAll=false`

Not unit-tested: components — covered by E2E.

`useSession` and `useBoardStore` are unit-tested with the same pattern: call actions via `useBoardStore.getState()` directly (no renderHook), `jest.mock('../api/client')`, reset with `setState({...})` in `beforeEach`. `useBoardStore.test.js` covers the optimistic-apply → settle → rollback path for representative mutations (incl. the no-rethrow subtask mutations).

### E2E tests (Playwright)

`e2e/` — 27 tests across 11 files. Require the full stack (`docker compose up`).

| File | Flows covered | Status |
|---|---|---|
| `auth.spec.js` | register, logout, login, redirect unauthenticated | ✅ |
| `card.spec.js` | create column + card → persist on refresh | ✅ |
| `dnd.spec.js` | drag card cross-column → persist on refresh | ✅ |
| `profile.spec.js` | update name, email conflict, change password, wrong password | ✅ |
| `subtask.spec.js` | create, toggle, rename, reorder, delete subtasks; max 20 limit | ✅ |
| `board.spec.js` | create/rename/delete board; member cannot delete | ✅ |
| `member.spec.js` | invite member → member sees board | ✅ |
| `column-color.spec.js` | set column color, persist after reload, clear color | ✅ |
| `category.spec.js` | attach label → auto-set as category → shows on card; rename label → card reflects it | ✅ |
| `assignee.spec.js` | assign two members → stack of two avatars, persists | ✅ |
| `completion.spec.js` | mark done → ✓ badge + fade + footer date → reload → unmark; subtask warn (cancel/accept) | ✅ |

Run: `npm run test:e2e` (or `npx playwright test --ui` for interactive mode). **Flaky under parallel** (single shared Postgres → contention; tests time out waiting for elements). Re-run, or use `npx playwright test --workers=1` for a deterministic pass.

**DnD note**: dnd-kit uses `PointerSensor` with `activationConstraint: { distance: 8 }`. Use `pointerDrag()` helper in `e2e/helpers.js` — `page.dragTo()` skips pointer events and won't trigger activation.

**Profile E2E note**: Use `page.click('a:has-text("← Boards")')` for SPA navigation back to boards. Avoid `page.goBack()` to board pages — Chromium's history navigation sends a non-HTML Accept header that bypasses the proxy fix, returning API JSON.

**Subtask E2E note**: `setupBoard()` waits for board/column/card POST responses before proceeding to prevent tempId races. E2E subtask tests wait for POST 201 on create/add and PATCH 200 on toggle/rename/reorder to ensure real server IDs are in store before assertions.

**Column color E2E note**: `data-swatch` attributes on swatch buttons enable stable selectors — `button[data-swatch="#fca5a5"]` for presets, `button[data-swatch="clear"]` for clear, `button[data-swatch="custom"]` for the "+" picker. Accent assertions target the **title chip** (`[data-testid="column-chip"]`), not the header: `getComputedStyle(chip).backgroundColor` equals the chosen hex when set, or the neutral default `rgb(226, 232, 240)` (`#e2e8f0`) when cleared. The "+ New card" composer trigger text is referenced by `card.spec.js`, `dnd.spec.js`, and `subtask.spec.js`.

### CI (GitHub Actions)

`.github/workflows/ci.yml` — runs the 106 unit tests on every push/PR to `main`.
