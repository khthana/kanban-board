# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm start                                # Dev server at localhost:3000 (proxies API to localhost:4000)
npm test                                 # Run tests in watch mode
npm test -- --watchAll=false             # Run tests once (CI mode)
npm test -- --testPathPattern="polling"  # Run a single test file
npm run build                            # Production build
```

## Project Overview

A Kanban board SPA for small teams (2–15 people). **Fully implemented** — React frontend connected to a real Node.js/PostgreSQL backend.

- **Frontend** (this repo): React + Zustand + dnd-kit
- **Backend** (separate repo: `kanban-board-api`): Node.js + Express + PostgreSQL, runs on port 4000
- **Full PRD**: [requirement/Kanban-Board-PRD.md](requirement/Kanban-Board-PRD.md)

## Architecture

### API Client

`src/api/client.js` — real `fetch()` client. All functions attach `Authorization: Bearer <token>` from localStorage. 401 response clears token and redirects to `/login`. Normalizes backend snake_case responses to camelCase for the store.

In development, CRA proxies all API requests through the dev server (`"proxy": "http://localhost:4000"` in package.json) — no CORS needed.

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

42 unit tests — `src/domain/` and `src/hooks/`. Run: `npm test -- --watchAll=false`

Not unit-tested: store, components, auth flow — covered by manual verification.
