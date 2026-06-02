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

A Kanban board SPA for small teams (2–15 people). **Fully implemented** — React frontend connected to a real Node.js/PostgreSQL backend.

- **Frontend** (this repo): React + Zustand + dnd-kit
- **Backend** (separate repo: `kanban-board-api`): Node.js + Express + PostgreSQL, runs on port 4000
- **Full PRD**: [requirement/Kanban-Board-PRD.md](requirement/Kanban-Board-PRD.md)

## Architecture

### API Client

`src/api/client.js` — real `fetch()` client. All functions attach `Authorization: Bearer <token>` from localStorage. 401 response clears token and redirects to `/login`. Normalizes backend snake_case responses to camelCase for the store.

In development, `src/setupProxy.js` proxies all API routes (`/auth`, `/boards`, `/columns`, `/cards`, `/labels`) to `API_PROXY_TARGET` env var (default `http://localhost:4000`). Docker Compose sets `API_PROXY_TARGET=http://api:4000` so the frontend container reaches the backend container.

### State

`src/store/useBoardStore.js` — all mutations use optimistic update pattern: snapshot → apply locally → API call → rollback on error.

`src/store/useSession.js` — JWT auth. `login()`/`register()` call the real backend, store token in localStorage, decode JWT `sub` → `currentUserId`.

### Polling

`src/hooks/usePolling.js` — 10s `setInterval`. Routes 403 → eject to `/boards`; 404 → navigate away.

### Key Decisions

- **Fractional float position**: `positionBetween(prev, next)` for drag-and-drop — single record update, backend rebalances when gap < 1e-9
- **Optimistic UI**: snapshot → apply → API → rollback on error
- **Board snapshot**: `GET /boards/:id` returns nested shape; `client.js` flattens to `{ board, columns[], cards[], labels[], members[], cardLabels[] }`
- **snake_case ↔ camelCase**: `normalizeCard()` / `cardPatchToApi()` in `client.js` handle conversion

### Validation Constraints

- `board.name`, `column.name`: non-empty, ≤ 100 chars
- `card.title`: non-empty, ≤ 255 chars
- `card.description`: ≤ 5,000 chars
- `label.color`: valid hex (`#rgb` or `#rrggbb`)
- Invite target must already be a registered user

Validation runs client-side (UX) and is enforced by the backend (authoritative).

## Tests

### Unit tests (42)
`src/domain/` and `src/hooks/`. Run: `npm test -- --watchAll=false`

Not unit-tested: store, components, auth flow — covered by manual verification.

### E2E tests (Playwright)

`e2e/` — 8 tests across 5 files. Require the full stack to be running (`docker compose up`).

| File | Flows covered |
|---|---|
| `auth.spec.js` | register, logout, login, redirect unauthenticated |
| `board.spec.js` | create/rename/delete board; member cannot delete |
| `card.spec.js` | create column + card → persist on refresh |
| `dnd.spec.js` | drag card cross-column → persist on refresh |
| `member.spec.js` | invite member → member sees board |

Run: `npm run test:e2e` (or `npx playwright test --ui` for interactive mode)

**DnD note**: dnd-kit uses `PointerSensor` with `activationConstraint: { distance: 8 }`. Use `pointerDrag()` helper in `e2e/helpers.js` — `page.dragTo()` skips pointer events and won't trigger activation.

### CI (GitHub Actions)

`.github/workflows/ci.yml` — runs 42 unit tests on every push/PR to `main`.
