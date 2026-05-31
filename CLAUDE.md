# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm start          # Dev server at localhost:3000
npm test           # Run tests in watch mode
npm test -- --watchAll=false   # Run tests once (CI mode)
npm test -- --testPathPattern="App"  # Run a single test file
npm run build      # Production build
```

## Architecture

This project is currently a Create React App scaffold. The full application to be built is a Kanban board for small teams (2–15 people). The complete PRD is in [requirement/Kanban-Board-PRD.md](requirement/Kanban-Board-PRD.md).

### Planned Stack

- **Frontend**: React SPA (this repo) — communicates with backend via REST/JSON
- **Backend**: Node.js (Express or Fastify) — business logic and auth (separate repo/service)
- **Database**: PostgreSQL

### Key Architecture Decisions

**Ordering**: Column and card positions use a **fractional float** field (`position`), not integer indices. Inserting between position 1.0 and 2.0 assigns 1.5. This lets drag-and-drop update a single record rather than re-writing all siblings. Backend must periodically rebalance when precision runs out.

**State & Optimistic UI**: Frontend loads the full board snapshot from `GET /boards/:id` into a client store (Redux/Zustand/React Query). Drag-and-drop updates state immediately and fires `PATCH /cards/:id` in the background; failure rolls back and shows an error.

**Sync**: MVP uses polling (~10 s interval) — no WebSockets. API shape must be designed to support WebSocket upgrade in a future phase without schema changes.

**Auth**: Stateless JWT. `Authorization: Bearer <token>` header on every protected request. Access token TTL 15–60 min. Passwords hashed with bcrypt (cost ≥ 10) or argon2 — no plaintext ever stored.

**Authorization**: Two roles only — `owner` (can delete board, manage members) and `member` (full CRUD on columns/cards, cannot delete board). All enforcement happens on the backend; never trust client-supplied role claims.

### Data Model (logical)

All tables use UUID primary keys and `created_at`/`updated_at`.

| Table | Key fields |
|---|---|
| `users` | `email` (unique), `password_hash`, `display_name` |
| `boards` | `name`, `owner_id → users` |
| `board_members` | `board_id`, `user_id`, `role` (owner\|member); unique (board_id, user_id) |
| `columns` | `board_id`, `name`, `position` (float) |
| `cards` | `column_id`, `title`, `description`, `assignee_id`, `due_date`, `position` (float) |
| `labels` | `board_id`, `name`, `color` (hex) |
| `card_labels` | `card_id`, `label_id` (composite PK) |

Cascade rules: delete board → cascade to columns, cards, labels, memberships; delete column → cascade to cards; delete label → only removes `card_labels` rows.

Index on frequently queried FKs: `columns.board_id`, `cards.column_id`, `board_members.user_id`.

### API Contract (REST)

Card move uses a single `PATCH /cards/:id` with `{ column_id, position }` — covers both cross-column move and in-column reorder.

`GET /boards/:id` returns the full board snapshot (board + columns + cards + labels) in one call for initial render.

### Frontend Module Plan

- **Auth views** — login/register
- **Board list view** — all boards the user owns or is a member of
- **Board detail view** — columns + cards with drag-and-drop (recommended: dnd-kit)
- **Card detail modal/panel** — full card fields (description, assignee, due date, labels)
- **Shared API client + state store**

### Validation Constraints

- `board.name`, `column.name`: non-empty, ≤ 100 chars
- `card.title`: non-empty, ≤ 255 chars
- `card.description`: ≤ ~5,000 chars
- `label.color`: valid hex color
- Invite target must be an existing registered user (no unregistered invites in MVP)

Validation runs both client-side (UX) and backend (authoritative).
