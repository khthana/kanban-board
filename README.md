# Kanban Board

[🇹🇭 อ่านเป็นภาษาไทย](README.th.md)

A collaborative Kanban board for small teams (2–15 people). Drag-and-drop cards across columns, assign multiple members, set due dates, organise with labels and a primary **category**, track work with subtasks, and mark cards done — all synced in near real time via polling.

## Monorepo Layout

```
kanban-board/
  src/          ← React frontend
  api/          ← Node.js + Express + PostgreSQL backend
  e2e/          ← Playwright E2E tests
  docs/adr/     ← Architecture decision records
  requirement/  ← Per-feature PRDs
```

## Tech Stack

**Frontend** (`src/`)
- **React 19** + **React Router v7**
- **Zustand** — state management with optimistic updates
- **dnd-kit** — drag-and-drop (pointer + keyboard)
- **react-datepicker** — due-date picker (`dd/MM/yyyy`)

**Backend** (`api/`)
- **Node.js** + **Express 5**
- **PostgreSQL** — via `pg` (node-postgres), raw SQL
- **JWT** — stateless auth (60 min access token + 7 day refresh token)

## Prerequisites

- Node.js 18+
- Docker (recommended for full-stack dev), **or** PostgreSQL running locally

## Getting Started

### Option A — Docker (full stack, recommended)

Runs postgres + api + frontend together. Frontend is served on **port 3700**.

```bash
# first run only
npm install && npx playwright install chromium

docker compose up           # postgres + api + frontend (http://localhost:3700)
docker compose down         # stop all
docker compose down -v      # stop and delete the database volume
```

### Option B — frontend only

Requires the backend already running on port 4000.

```bash
npm install
npm start                   # dev server at http://localhost:3000
```

In development `src/setupProxy.js` forwards API routes to `http://localhost:4000` automatically — no CORS configuration needed.

### Option C — backend only (native)

```bash
cp api/.env.example api/.env   # then edit DATABASE_URL, JWT_SECRET
cd api && npm install
cd api && npm run migrate       # create tables
cd api && npm run dev           # API at http://localhost:4000
```

## Environment

```bash
# .env.development.local (optional — defaults to http://localhost:4000)
REACT_APP_API_URL=http://localhost:4000
```

For production set `REACT_APP_API_URL` to your backend URL before building.

## Available Scripts

**Frontend** (run from repo root):

```bash
npm start                                # dev server (http://localhost:3000)
npm test                                 # watch mode
npm test -- --watchAll=false             # run unit tests once (111 tests)
npm test -- --testPathPattern="polling"  # run a single test file
npm run build                            # production build
npm run test:e2e                         # Playwright E2E (28 tests, requires docker compose up)
```

**Backend** (run from `api/`):

```bash
cd api && npm run dev                    # API server with --watch at localhost:4000
cd api && npm run migrate               # run DB migrations
cd api && npm test                       # 116 integration tests (requires local postgres)
```

E2E tests are flaky under parallel (single shared Postgres → contention). Use `npx playwright test --workers=1` for a deterministic pass, or `npx playwright test --ui` for interactive mode.

## Architecture

`src/` is layered — pure logic in `domain/`, network in `api/`, state in `store/`, and feature components in `components/`. CSS modules and `.test.js` files are co-located with their source.

```
src/
├── api/
│   └── client.js          # fetch client — JWT header, 401 silent refresh, snake_case↔camelCase
├── store/
│   ├── useSession.js      # JWT auth (login / register / logout / profile)
│   └── useBoardStore.js   # board state + optimistic mutations (optimistic() helper)
├── hooks/
│   └── usePolling.js      # 10s polling for cross-tab sync
├── domain/                # pure, unit-tested logic
│   ├── ordering.js        # positionBetween, needsRebalance, rebalance
│   ├── validation.js      # client-side field validation
│   ├── dates.js           # timezone-safe YYYY-MM-DD helpers, overdue check
│   ├── colors.js          # preset swatch palette
│   ├── progress.js        # adaptive subtask progress view
│   ├── accent.js          # card category → accent colour derivation
│   ├── completion.js      # per-card done state (isDone / completionPatch)
│   └── titleEdit.js       # inline card-title commit decision (save / revert / error)
├── routes/
│   ├── LoginPage.jsx
│   ├── RegisterPage.jsx
│   ├── BoardListPage.jsx
│   ├── BoardPage.jsx      # drag-and-drop board
│   ├── ProfilePage.jsx
│   └── RequireAuth.jsx    # auth guard
└── components/
    ├── Column.jsx          # column with optional accent theming
    ├── Card.jsx            # editorial card face (category, title, due, progress)
    ├── CardPanel.jsx       # card detail side-panel
    ├── CardComposer.jsx
    ├── LabelPicker.jsx     # attach/create/edit labels, set category (★)
    ├── AssigneePicker.jsx  # multi-assignee toggle
    ├── DueDateField.jsx
    ├── TopBar.jsx          # member avatars + invite
    ├── InviteDialog.jsx
    └── common/             # Avatar, AvatarStack, Toast, ColorPicker
```

### Key Design Decisions

**Fractional float positions** — card, column, and subtask positions are stored as floats (`1.0`, `1.5`, `1.25` …). Drag-and-drop and reordering update a single record. The backend rebalances when precision runs out (gap < 1e-9).

**Optimistic UI** — every mutation snapshots state, applies the change locally, then calls the API. On failure the snapshot is restored.

**JWT auth with refresh tokens** — 60-minute access token + 7-day refresh token in `localStorage`. A 401 triggers a single in-flight silent refresh; failure clears both tokens and redirects to `/login`.

**Polling** — `GET /boards/:id` runs every 10 seconds to reconcile state across tabs. A 403 ejects to the board list; a 404 navigates away.

**Editorial card** ([ADR-0002](docs/adr/0002-card-editorial-model.md)) — a type-forward card face: category dot + uppercase label, hero title, due date, and adaptive subtask progress.

**Category** ([ADR-0002](docs/adr/0002-card-editorial-model.md)) — one label per card is the **category**, the only label shown on the card face; its colour becomes the card accent. Other labels are managed in the panel.

**Column accent** ([ADR-0001](docs/adr/0001-column-accent-model.md)) — an optional colour that themes the whole column (chip, wash, count, new-card button), not just a header strip.

**Card completion** ([ADR-0003](docs/adr/0003-card-completion-model.md)) — a per-card done state stored as `completed_at DATE`, independent of column. Toggled in the panel; the card face shows a ✓ badge and the completion date.

**Subtasks** — up to 20 per card, stored with float position. Toggle, rename, reorder, delete; adaptive progress (segments ≤ 8, mini-bar > 8) on the card face.

## Features

- Register / Login / Logout with refresh tokens
- Create, rename, delete boards (owner only)
- Create, rename, delete columns; **column accent colour** themes the whole column
- Create, edit, delete cards — **title editable inline in the panel**, description, due date
- **Category** — promote one label to the card face; manage all labels in the panel
- **Multiple assignees** per card, shown as an overlapping avatar stack
- **Subtasks** — add, toggle, rename inline, reorder, delete; progress indicator on the card
- **Card completion** — mark/un-mark done; ✓ badge, fade, and completion date on the card
- Drag cards within and across columns; drag columns to reorder
- Labels — create and edit (name + hex colour), attach/detach per card
- Invite members by email; remove members (owner only)
- User profile — edit display name, email, change password
- Overdue card highlight
- Cross-tab sync via polling (~10 s)

## Documentation

- **Product requirements**: [requirement/](requirement/) — per-feature PRDs
- **Architecture decisions**: [docs/adr/](docs/adr/)
- **Domain glossary**: [CONTEXT.md](CONTEXT.md)
- **Contributor / agent guide**: [CLAUDE.md](CLAUDE.md)
