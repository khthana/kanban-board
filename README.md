# Kanban Board

[🇹🇭 อ่านเป็นภาษาไทย](README.th.md)

A collaborative Kanban board for small teams (2–15 people). Drag-and-drop cards across columns, assign members, set due dates, and add labels — all synced in real time via polling.

## Tech Stack

- **React 19** — UI
- **Zustand** — state management with optimistic updates
- **dnd-kit** — drag-and-drop (pointer + keyboard)
- **React Router v7** — client-side routing

## Prerequisites

- Node.js 18+
- The [kanban-board-api](https://github.com/khthana/kanban-board-api) backend running on port 4000

## Getting Started

```bash
npm install
npm start        # dev server at http://localhost:3000
```

The CRA proxy forwards all API requests to `http://localhost:4000` automatically — no CORS configuration needed in development.

## Environment

```bash
# .env.development.local (optional — defaults to http://localhost:4000)
REACT_APP_API_URL=http://localhost:4000
```

For production set `REACT_APP_API_URL` to your backend URL before building.

## Available Scripts

```bash
npm start                        # dev server
npm test                         # watch mode
npm test -- --watchAll=false     # CI mode (42 tests)
npm run build                    # production build
```

## Architecture

```
src/
├── api/
│   └── client.js          # fetch client — JWT header, 401 handler, snake_case→camelCase
├── store/
│   ├── useSession.js       # JWT auth (login / register / logout)
│   └── useBoardStore.js    # board state + optimistic mutations
├── hooks/
│   └── usePolling.js       # 10s polling for cross-tab sync
├── domain/
│   ├── ordering.js         # positionBetween, needsRebalance, rebalance
│   └── validation.js       # client-side field validation
├── routes/
│   ├── LoginPage.jsx
│   ├── RegisterPage.jsx
│   ├── BoardListPage.jsx
│   └── BoardPage.jsx       # drag-and-drop board
└── components/
    ├── Column.jsx
    ├── Card.jsx
    ├── CardPanel.jsx        # card detail side-panel
    ├── TopBar.jsx           # member avatars + invite
    └── InviteDialog.jsx
```

### Key Design Decisions

**Fractional float positions** — card and column positions are stored as floats (`1.0`, `1.5`, `1.25` …). Drag-and-drop updates a single record. The backend rebalances positions when precision runs out (gap < 1e-9).

**Optimistic UI** — every mutation snapshots state, applies the change locally, then calls the API. On failure the snapshot is restored and an error banner is shown.

**JWT auth** — token stored in `localStorage`. Every request attaches `Authorization: Bearer <token>`. A 401 response clears the token and redirects to `/login`.

**Polling** — `GET /boards/:id` is called every 10 seconds to reconcile state across tabs. A 403 ejects the user to the board list; a 404 navigates away.

## Features

- Register / Login / Logout
- Create, rename, delete boards (owner only)
- Create, rename, delete columns
- Create, edit, delete cards with title, description, assignee, due date
- Drag cards within and across columns
- Drag columns to reorder
- Labels — create with hex color, attach/detach per card
- Invite members by email; remove members (owner only)
- Overdue card highlight (red border + ⚠ icon)
- Cross-tab sync via polling (~10 s)
