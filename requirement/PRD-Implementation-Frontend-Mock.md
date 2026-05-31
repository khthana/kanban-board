# PRD — Kanban Board Frontend (Mock-Backend Build)

> **Triage label:** `ready-for-agent`
> **Source documents:** [Kanban-Board-PRD.md](./Kanban-Board-PRD.md) (Draft v1.0) · [Approve PRD.md](./Approve%20PRD.md) (Approved v1.0)

---

## Problem Statement

ทีมเล็ก (2–15 คน) จัดการงานกระจัดกระจายในแชท สเปรดชีต และอีเมล ไม่มีจุดเดียวที่เห็นสถานะงานทั้งหมด ไม่รู้ว่าใครรับผิดชอบอะไร และงานตกหล่น ผู้ใช้ต้องการกระดาน Kanban ที่เห็นงานทั้งทีมในหน้าจอเดียว ลากการ์ดข้ามสถานะได้ลื่นไหล และเชื่อถือได้ว่าข้อมูลไม่หาย

ในเชิงการพัฒนา ทีมยังไม่ต้องการลงทุนกับโครงสร้าง backend (Node + PostgreSQL + auth จริง) ก่อนจะได้พิสูจน์ว่า core experience ของกระดาน — การสร้าง/ลาก-ย้าย card, ordering, optimistic UI — ใช้งานได้จริงและน่าใช้

## Solution

สร้าง **Kanban Board frontend** เป็น React SPA ที่กดเล่นได้เต็มรูปแบบในเบราว์เซอร์ทันที โดยมี **mock backend** ที่เก็บ canonical state ไว้ใน localStorage และจำลองพฤติกรรมของ server จริง (async, latency, การ enforce สิทธิ์, การ broadcast การเปลี่ยนแปลงข้ามแท็บ)

ผู้ใช้เปิดแอปแล้วเลือกตัวตนจาก **user-switcher** (ตัวตนที่ seed ไว้) เห็นรายการ Board ที่ตนเป็น owner หรือ member เปิด Board เห็น Column เรียงแนวนอน แต่ละ Column มี Card ที่ลาก-ย้าย/จัดลำดับได้ด้วย drag-and-drop การลากตอบสนองทันที (optimistic) และคงอยู่หลัง refresh เปิดรายละเอียด Card ใน side-panel เพื่อแก้ description, assignee, due date, labels ได้

mock backend ถูกออกแบบให้ interface ของ API client ตรงกับ REST contract ของ PRD ต้นฉบับ (§3.7) เพื่อให้สลับไปต่อ Node backend จริงในอนาคตได้โดยแก้แค่ไส้ในของ client ชั้นเดียว ไม่ต้องแตะ UI, state store หรือ data model

## User Stories

**Identity & Session**
1. As a user, I want to pick which seeded identity I am acting as from a switcher, so that I can simulate different team members without a real login.
2. As a user, I want my current identity to persist across page refresh, so that I don't have to re-select it every time.
3. As a user, I want to switch identity at any time, so that I can demonstrate collaboration between members on one machine.

**Board list**
4. As a user, I want to see a list of all Boards where I am owner or member, so that I can switch between projects.
5. As a user, I want Boards I have no access to to be hidden from my list, so that I only see what is relevant to me.
6. As a user, I want to create a new Board with a name, so that I can organize work for a specific project.
7. As a Board owner, I want to rename my Board, so that I can keep the name accurate.
8. As a Board owner, I want to delete my Board, so that I can remove finished projects.
9. As a member who is not the owner, I want the delete action to be unavailable, so that I cannot accidentally remove a Board I don't own.

**Membership & invitation**
10. As a Board owner, I want to invite an existing seeded user by email, so that they can collaborate on the Board.
11. As a Board owner, I want to remove a member, so that I can manage who has access.
12. As an invited member, I want the Board to appear in my list when I switch to my identity, so that I can start working on it.
13. As a user, I want to see the avatars of all Board members in the top bar, so that I know who is on the team.

**Columns**
14. As a member, I want to create Columns with custom names, so that I can model my workflow stages.
15. As a member, I want to rename a Column, so that I can adjust the workflow wording.
16. As a member, I want to delete a Column, with confirmation when it still has Cards, so that I don't lose Cards by accident.
17. As a member, I want to reorder Columns by dragging, so that the Board reflects the real sequence of work.
18. As a member, I want each Column header to show a count of its Cards, so that I can see workload at a glance.
19. As a member, I want an empty Board to show an inviting empty state to add the first Column, so that I know how to start.

**Cards**
20. As a member, I want to create a Card with a title inside a Column, so that I can capture a task quickly.
21. As a member, I want to open a Card in a side-panel to see and edit its full detail, so that the Board stays visible behind it.
22. As a member, I want to edit a Card's description, so that I can capture full task detail.
23. As a member, I want to delete a Card, so that I can remove tasks that are no longer relevant.
24. As a member, I want an empty Column to show an inviting empty state to add the first Card, so that I know how to start.

**Drag-and-drop & ordering**
25. As a member, I want to drag a Card to another Column, so that I can update its status visually.
26. As a member, I want to reorder a Card within its Column, so that I can express priority.
27. As a member, I want the moved Card to appear in its new place instantly (optimistic), so that the interaction feels immediate.
28. As a member, I want a clear placeholder/ghost showing where the Card will drop, so that I can aim the drop accurately.
29. As a member, I want a moved Card to stay where I dropped it after refresh, so that I trust the change was saved.
30. As a member, I want a Card to snap back with an error message if the save fails, so that I am never misled about the saved state.
31. As a member, I want to drag Cards and Columns using the keyboard, so that the Board is accessible.

**Collaboration fields**
32. As a member, I want to assign a Card to a single teammate, so that responsibility is clear.
33. As a member, I want to create colored Labels at the Board level, so that I can define categories like bug/feature/urgent.
34. As a member, I want to attach and detach Labels on a Card, so that I can categorize it.
35. As a member, I want a Card to show its Label color bar, assignee avatar, and due date for quick scanning, so that I don't need to open it.
36. As a member, I want to set a due date on a Card, so that deadlines are explicit.
37. As a member, I want overdue Cards highlighted with color plus an icon/text (not color alone), so that the cue is accessible to color-blind users.

**Sync & reconcile**
38. As a member, I want changes made in another tab (as another identity) to appear in my open Board, so that collaboration is visible.
39. As a member, I want the Board to refresh quietly without flashing the whole screen, so that updates are unobtrusive.
40. As a member whose Card was deleted by someone else, I want it removed from my view, so that I don't act on a stale Card.
41. As a member who is removed from a Board while viewing it, I want to be ejected with a message on the next sync, so that I understand my access changed.

**Robustness toggles (dev/demo)**
42. As a developer demoing the app, I want a toggle that forces mock-backend failures, so that I can demonstrate optimistic rollback on demand.

## Implementation Decisions

**Scope & architecture** (locked — see Approve PRD §1)
- Build the React frontend only; back it with a mock backend (localStorage). No Node/PostgreSQL this round.
- Layering: **UI components → Zustand store (optimistic, persisted) → API client (PRD §3.7 method shape) → mockBackend**.
- The **API client** is a deliberately *shallow* seam (the swap point). Its methods (`getBoards`, `getBoard`, `createBoard`, `patchBoard`, `deleteBoard`, `addMember`, `removeMember`, `createColumn`, `patchColumn`, `deleteColumn`, `createCard`, `patchCard`, `moveCard`, `deleteCard`, `createLabel`, `patchLabel`, `deleteLabel`, `attachLabel`, `detachLabel`) match PRD §3.7 names/semantics so a real `fetch()`-based backend drops in without changing callers.

**Deep modules** (confirmed with developer — built/tested in isolation where chosen)
- **`domain/ordering`** — pure functions for fractional float ordering: `positionBetween(prevPos, nextPos)`, `needsRebalance(positions)`, `rebalance(items)`. Moving one item computes a new `position` from its neighbours and writes a single record. Rebalance runs when the gap between two floats gets too small.
- **`domain/validation`** — pure validators encoding §3.10: board/column name non-empty ≤100; card title non-empty ≤255; description ≤~5000; label color valid hex; invite email must match an existing seeded user.
- **`api/mockBackend`** — the "server". Holds canonical state, applies mutations, enforces authorization (membership guard on every op; `owner` check for board delete and member management), performs cascade deletes (board→columns/cards/labels/members; column→cards; label→card_labels only), simulates latency and forced failures, and persists + broadcasts changes to other tabs. Async interface mirroring REST.

**Shallow / coupled modules** (not unit-tested in isolation)
- **`store/useBoardStore`** (Zustand + `persist`) — orchestrates optimistic updates: snapshot affected slice, apply immediately, call client, restore snapshot + surface error on rejection.
- **`api/client`** — thin adapter delegating to mockBackend.
- **React components / routes** — verified via manual acceptance flows.

**Identity** — User-switcher over a set of seeded users; current identity persisted in localStorage; used as the "current user" for all authz checks in mockBackend. No real password hashing or JWT.

**Data model** — follows PRD §3.6 logical schema (users, boards, board_members, columns, cards, labels, card_labels) with UUID ids and `position` floats on columns and cards. Stored as JSON in localStorage rather than relational tables, but shaped identically so a real DB maps 1:1.

**Card move contract** — a single `moveCard(cardId, { columnId, position })` operation covers both cross-Column move and in-Column reorder (PRD §3.7 / §3.8). mockBackend always assigns a final authoritative `position`, so two concurrent moves never collide at the same position (PRD §3.9).

**Sync** — `usePolling` reconciles the Board snapshot from mockBackend on a fallback interval and on cross-tab `storage` events (last-write-wins). This is the mechanism by which another member's change appears, standing in for the PRD's ~10s polling.

**Card detail** — presented as a right-hand **side-panel**, keeping the Board visible behind it (PRD §4.2 chose modal-or-panel; panel selected).

**Tech choices** — react-router-dom (board list / board detail / switcher); dnd-kit (`@dnd-kit/core` + `@dnd-kit/sortable`) for drag-and-drop incl. keyboard; CSS Modules for styling; uuid for ids; seed data includes the "Project Phoenix" example board from mockup §4.7.

## Testing Decisions

**What makes a good test here:** assert external behavior through the module's public interface, not internal representation. For `domain/ordering`, that means: given neighbour positions (or none), the returned position sorts correctly relative to siblings — assert the *ordering outcome*, not the exact float value beyond what the contract guarantees.

**Modules to be unit-tested** (developer selected): **`domain/ordering` only.**
- Insert at head (no previous neighbour), at tail (no next neighbour), and in the middle (between two neighbours) — result must sort into the intended slot.
- `rebalance` — when many inserts collapse the gap, rebalancing must redistribute positions while preserving the existing visual order.
- `needsRebalance` — returns true when precision between adjacent positions is exhausted.

**Explicitly not unit-tested this round** (per developer): `domain/validation`, `mockBackend` authz, and store rollback. These are covered by the manual acceptance flows below. (They remain natural future test targets — the interfaces are designed to be testable.)

**Prior art:** the repo's existing `src/App.test.js` uses `@testing-library/react` + Jest (CRA default). `domain/ordering` tests need no DOM — plain Jest unit tests, run via `npm test`.

## Out of Scope

- Real backend (Node.js/Express/Fastify), PostgreSQL, real JWT/bcrypt — deferred to a later phase; the API client seam is the integration point.
- Real multi-user/multi-device collaboration, WebSocket live sync, presence/cursors.
- Fine-grained roles beyond owner/member (viewer/editor/admin).
- Sub-checklists, large file attachments, email/push notifications, automation rules, swimlanes, cross-board advanced search, mobile native app, analytics dashboard.
- Inviting users who are not already seeded/registered.
- Unit tests for validation, mockBackend authz, and store rollback (manual coverage only this round).

## Further Notes

- Honest trade-offs (Approve PRD §2): auth is simulated; collaboration is single-machine via user-switcher + cross-tab sync. Everything else — board/column/card CRUD, drag-and-drop + fractional ordering, optimistic + rollback, persistence across refresh, labels/due-date/assignee, owner-vs-member authorization, and edge cases (404 deleted card / 403 removed member / cascade) — works for real and is demoable.
- Build order (milestones M0–M7) and the eight manual acceptance flows are defined in [Approve PRD.md](./Approve%20PRD.md) §6–§7, derived from PRD §5.1–§5.2.
- Domain glossary (Board, Column, Card, Member, Assignee, Position, Current User, Overdue) to live in a root `CONTEXT.md`; use these terms consistently in code and discussion.
- A standalone HTML rendering of the approved decisions exists at `requirement/Approve PRD.html` for easy reading.
