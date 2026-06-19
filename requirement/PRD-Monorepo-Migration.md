# PRD: Monorepo Migration (Absorb API into Frontend Repo)

## Problem Statement

The project currently lives across two separate Git repositories — `kanban-board` (React frontend) and `kanban-board-api` (Node.js/Express backend). A developer working on a full-stack feature must keep two editor windows open, switch between two terminal directories, and maintain two separate GitHub repos (each with its own CI workflow). This constant context-switching creates unnecessary friction for a solo developer.

## Solution

Absorb the API codebase into a flat subdirectory (`api/`) inside the existing `kanban-board` repository. The result is a single folder that contains both the React frontend (`src/`) and the Node.js backend (`api/src/`), opened once in VS Code. Docker Compose remains the primary development workflow and requires only a path update — no tooling changes. The old `kanban-board-api` GitHub repository is deleted after migration.

## User Stories

1. As a developer, I want to open one folder in VS Code and see both the frontend and backend source code, so that I can work on full-stack features without switching windows.
2. As a developer, I want to run `docker compose up` once and have the full stack start — database, API, and frontend — so that I don't need to manage multiple terminal sessions.
3. As a developer, I want a single `git log` that shows both frontend and backend changes in chronological order, so that I can trace full-stack changes together.
4. As a developer, I want a single GitHub repository to track issues, PRDs, and CI results for the whole project, so that I don't have to manage two issue trackers.
5. As a developer, I want the backend integration tests (requiring PostgreSQL) to run automatically in CI when I push to `main`, so that API regressions are caught alongside frontend regressions.
6. As a developer, I want `CLAUDE.md`, `README.md`, and `.gitignore` to describe the full project in one file each, so that context is never split across repos.
7. As a developer, I want to delete the `kanban.code-workspace` multi-root workspace file, so that there is no stale artifact left over from the two-repo setup.
8. As a developer, I want the migration to preserve all existing frontend (`src/`) and backend (`api/src/`) import paths, so that no application code needs to change.
9. As a developer, I want the React dev proxy (`src/setupProxy.js`) to continue targeting `localhost:4000` unchanged, so that local non-Docker development also works without edits.

## Implementation Decisions

### Repository structure after migration

```
kanban-board/               ← single Git repo (khthana/kanban-board, branch: main)
  src/                      ← React frontend (unchanged)
  api/                      ← absorbed backend
    src/                    ← Node.js/Express source (unchanged internally)
    package.json
    package-lock.json
    Dockerfile.dev
    .dockerignore
    .env                    ← gitignored; developer copies from .env.example
    .env.example
    .gitignore              ← backend-specific ignores (node_modules, .env, etc.)
  .github/
    workflows/
      ci.yml                ← updated: two jobs (test-frontend + test-api)
  docker-compose.yml        ← updated: context + volume paths only
  CLAUDE.md                 ← merged: frontend + backend guidance in one file
  README.md                 ← merged: full-stack project description
  .gitignore                ← merged: covers both workspaces
  CONTEXT.md                ← unchanged
  docs/adr/                 ← unchanged
```

### Git history strategy

Copy files without merging `kanban-board-api` git history. A single commit `chore: absorb api into monorepo` lands all API files at `api/`. The old API git history remains accessible on GitHub until the repo is deleted (for the window between migration and deletion). This is intentional — the tradeoff of losing backend history is acceptable for a solo project where DX is the priority.

### `docker-compose.yml` changes

Two path changes only — no structural changes:
- `api.build.context`: `../kanban-board-api` → `./api`
- `api.volumes[0]`: `../kanban-board-api:/app` → `./api:/app`

### CI workflow changes

The existing `ci.yml` job (frontend unit tests, no external services) is kept unchanged and renamed `test-frontend`. A second job `test-api` is added:
- Uses `services: postgres` (same config as the current `kanban-board-api` CI workflow)
- Runs `cd api && npm ci && npm test`
- Sets `TEST_DATABASE_URL` and `JWT_SECRET` environment variables
- Both jobs run in parallel on push/PR to `main`

### Documentation merge strategy

- `CLAUDE.md`: API section appended as `## API` after the existing frontend content, covering API-specific commands (`npm run dev`, `npm run migrate`, `npm test`), key files, and environment variables.
- `README.md`: Refreshed to describe the monorepo layout, updated Docker quick-start, and full feature list for both frontend and backend.
- `.gitignore` (root): Union of both `.gitignore` files — covers `build/`, `node_modules`, `.env`, test artifacts for both workspaces.
- `api/.gitignore`: Kept for backend-specific ignores (e.g. `.env`) that `cd api && npm install` tooling expects in the subtree.

### Files deleted

- `kanban.code-workspace` — multi-root workspace file at `C:\Users\Terry\Desktop\Code\kanban.code-workspace`; no longer needed once both workspaces are in one folder.

### GitHub repository cleanup

`khthana/kanban-board-api` is deleted after migration is verified (all tests green in CI).

### No shared code layer

There is no shared `packages/` or `libs/` directory. Frontend and backend remain independently installable (`npm install` from root for frontend; `cd api && npm install` for backend). The monorepo is a flat co-location, not a workspace-linked setup. This is revisited only if a shared validation/type layer becomes valuable.

### No root-level convenience scripts

Root `package.json` remains the frontend's package descriptor. No `concurrently`-based `npm run dev` script is added at root. Docker Compose is the primary development workflow; the absence of a root dev-runner is intentional.

## Testing Decisions

This migration does not introduce new application logic, so there are no new unit or E2E tests.

**The migration is verified correct when all existing tests pass unchanged:**
- 111 frontend unit tests (`npm test -- --watchAll=false` from root)
- 113 backend integration tests (`cd api && npm test`)
- 28 Playwright E2E tests (`docker compose up` then `npm run test:e2e`)

The new `test-api` CI job is the primary regression guard. A green CI run on the migration commit is the acceptance criterion.

Prior art for the postgres CI service config: copy directly from `kanban-board-api/.github/workflows/ci.yml` (the service block is identical).

## Out of Scope

- **npm workspaces / Turborepo / Nx**: Not introduced. The project does not share code between packages, so workspace tooling adds complexity with no benefit.
- **Shared validation or type layer**: `domain/validation.js` (frontend) and equivalent backend validation remain separate. Unifying them is a future decision.
- **Deploy**: Deploying to Railway/Render/Vercel is a separate initiative unaffected by this migration.
- **E2E tests in CI**: Adding Playwright to the CI pipeline is a pre-existing backlog item; this migration does not add or remove it.
- **WebSocket / real-time**: Out of scope entirely.

## Further Notes

- The `src/api/client.js` proxy continues to target `localhost:4000` in local dev (non-Docker). No change to `src/setupProxy.js`.
- The `api/.env` file must be populated by the developer after migration (copy from `api/.env.example`). Docker Compose injects env vars directly and does not read `.env`, so Docker workflow is unaffected.
- Backend `node_modules` lives at `api/node_modules/` — already excluded by the `api/` Docker volume mount (`/app/node_modules` anonymous volume), so no Dockerfile change is needed.
- The `kanban-board-api` GitHub repo should be deleted (not archived) to avoid confusion about where the canonical source lives.
