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
docker compose up                        # Start postgres + api + frontend (frontend on :3500)
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

### API Client

`src/api/client.js` — real `fetch()` client. All functions attach `Authorization: Bearer <token>` from localStorage. 401 response clears token and redirects to `/login`. Normalizes backend snake_case responses to camelCase for the store.

In development, `src/setupProxy.js` proxies API routes (`/auth`, `/boards`, `/columns`, `/cards`, `/labels`, `/subtasks`) to `API_PROXY_TARGET` (default `http://localhost:4000`). **Proxy skips requests with `Accept: text/html`** so browser navigation to `/boards/:id` etc. is handled by React's historyApiFallback (serves `index.html`), not forwarded to the API.

### State

`src/store/useBoardStore.js` — all mutations use optimistic update pattern: snapshot → apply locally → API call → rollback on error.

`src/store/useSession.js` — JWT auth. `login()`/`register()` call the real backend, store token in localStorage, decode JWT `sub` → `currentUserId`. Also stores `displayName` and `email` fetched from `GET /auth/me` after auth. Exposes `fetchProfile()` (re-fetch on page reload) and `updateProfile()` (PATCH /auth/me).

`src/components/RequireAuth.jsx` — calls `fetchProfile()` on mount when `isAuthenticated && !displayName` to re-hydrate after page reload.

### Polling

`src/hooks/usePolling.js` — 10s `setInterval`. Routes 403 → eject to `/boards`; 404 → navigate away.

### Key Decisions

- **Fractional float position**: `positionBetween(prev, next)` for drag-and-drop and subtask reordering — single record update, backend rebalances when gap < 1e-9
- **Optimistic UI**: snapshot → apply → API → rollback on error
- **Board snapshot**: `GET /boards/:id` returns nested shape; `client.js` flattens to `{ board, columns[], cards[], labels[], members[], cardLabels[], subtasks[] }`
- **snake_case ↔ camelCase**: `normalizeCard()` / `normalizeSubtask()` / `cardPatchToApi()` in `client.js` handle conversion
- **Profile endpoints**: `GET /auth/me`, `PATCH /auth/me`, `PATCH /auth/me/password` in `kanban-board-api`
- **Refresh tokens**: 60-minute access token + 7-day refresh token. On 401, `client.js` attempts silent refresh with single in-flight promise; failure clears both tokens and redirects to `/login`
- **Subtasks**: Nested per card, limit 20 per card, stored with float position (not array index). Support toggle (checked), rename, reorder (↑/↓), delete. Progress indicator "✓ n / total" shown on card preview when present.

### Validation Constraints

- `board.name`, `column.name`: non-empty, ≤ 100 chars
- `card.title`: non-empty, ≤ 255 chars
- `card.description`: ≤ 5,000 chars
- `subtask.title`: non-empty, ≤ 100 chars; max 20 subtasks per card
- `label.color`: valid hex (`#rgb` or `#rrggbb`)
- Invite target must already be a registered user
- `displayName`: non-empty, ≤ 100 chars
- `newPassword`: ≥ 8 chars; `confirmPassword` must match

Validation runs client-side (UX) and is enforced by the backend (authoritative).

## Tests

### Unit tests (58)
`src/domain/`, `src/hooks/`, `src/store/useSession.test.js`. Run: `npm test -- --watchAll=false`

Not unit-tested: `useBoardStore`, components — covered by E2E.

`useSession` IS unit-tested: use `useSession.getState()` directly (no renderHook), mock `../api/client` entirely, reset with `useSession.setState({...})` in `beforeEach`.

### E2E tests (Playwright)

`e2e/` — 18 tests across 7 files. Require the full stack (`docker compose up`).

| File | Flows covered | Status |
|---|---|---|
| `auth.spec.js` | register, logout, login, redirect unauthenticated | ✅ |
| `card.spec.js` | create column + card → persist on refresh | ✅ |
| `dnd.spec.js` | drag card cross-column → persist on refresh | ✅ |
| `profile.spec.js` | update name, email conflict, change password, wrong password | ✅ |
| `subtask.spec.js` | create, toggle, rename, reorder, delete subtasks; max 20 limit | ✅ |
| `board.spec.js` | create/rename/delete board; member cannot delete | ✅ |
| `member.spec.js` | invite member → member sees board | ✅ |

Run: `npm run test:e2e` (or `npx playwright test --ui` for interactive mode)

**DnD note**: dnd-kit uses `PointerSensor` with `activationConstraint: { distance: 8 }`. Use `pointerDrag()` helper in `e2e/helpers.js` — `page.dragTo()` skips pointer events and won't trigger activation.

**Profile E2E note**: Use `page.click('a:has-text("← Boards")')` for SPA navigation back to boards. Avoid `page.goBack()` to board pages — Chromium's history navigation sends a non-HTML Accept header that bypasses the proxy fix, returning API JSON.

**Subtask E2E note**: `setupBoard()` waits for board/column/card POST responses before proceeding to prevent tempId races. E2E subtask tests wait for POST 201 on create/add and PATCH 200 on toggle/rename/reorder to ensure real server IDs are in store before assertions.

### CI (GitHub Actions)

`.github/workflows/ci.yml` — runs 58 unit tests on every push/PR to `main`.
