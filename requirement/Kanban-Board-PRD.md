# PRD หลัก — ระบบ Kanban Board (รวมทุกฟีเจอร์)

> เอกสารนี้เป็น **PRD ฉบับรวม** ที่ผนวก PRD แยกตามฟีเจอร์ทั้งหมดของโปรเจกต์เข้าไว้ในไฟล์เดียว เขียนใหม่เป็นภาษาไทยทั้งหมด แทนที่ไฟล์ PRD เดิม 11 ไฟล์ใน `requirement/` (ไฟล์ต้นฉบับถูกลบหลังรวม) ยกเว้น [card_ui_spec.md](card_ui_spec.md) ซึ่งเป็นสเปกการออกแบบ (ไม่ใช่ PRD) จึงยังคงแยกไฟล์ไว้ตามเดิม
>
> แต่ละหัวข้อด้านล่างมี **สถานะ** กำกับ — `Implemented` (ทำแล้ว), `Superseded` (ถูกแทนที่ด้วยการตัดสินใจใหม่กว่า แต่เก็บไว้เป็นประวัติ), หรือ `ready-for-agent` (ยังไม่ implement) เนื้อหาถูกเก็บไว้ **ครบถ้วนตามต้นฉบับ** ไม่ตัดทอน เพื่อรักษาประวัติการตัดสินใจ (decision trail) ของโปรเจกต์
>
> Glossary กลางของระบบอยู่ที่ [CONTEXT.md](../CONTEXT.md) — ให้ยึดตามนั้นเป็นหลักเมื่อคำศัพท์ในหัวข้อเก่าขัดแย้งกัน (เช่น glossary ในหัวข้อ 1 เป็นฉบับร่างแรกสุด ถูกแทนที่โดย CONTEXT.md ที่ root ไปแล้ว) ADR ที่เกี่ยวข้องอยู่ที่ `docs/adr/`

## สารบัญ

| # | ฟีเจอร์ | สถานะ |
|---|---|---|
| [1](#1-mvp-เริ่มต้น--kanban-board-full-stack-draft-การอนุมัติขอบเขต-และ-mock-backend-build) | MVP เริ่มต้น (Full-stack Draft → Mock Backend Build) | Implemented (historical — ภายหลังถูกแทนที่ด้วย backend จริง) |
| [2](#2-column-header-colors-superseded-by-adr-0001) | Column Header Colors | **Superseded** โดย [ADR-0001](../docs/adr/0001-column-accent-model.md) |
| [3](#3-user-profile) | User Profile | Implemented |
| [4](#4-subtasks-checklist) | Subtasks (Checklist) | Implemented |
| [5](#5-card-color-bands-superseded-by-card-editorial-redesign) | Card Color Bands | **Superseded** โดยหัวข้อ 6 ([ADR-0002](../docs/adr/0002-card-editorial-model.md)) |
| [6](#6-card-editorial-redesign-option-c) | Card "Editorial" Redesign (Option C) | Implemented |
| [7](#7-label-color-picker--pastel-presets) | Label Color Picker — Pastel Presets | Implemented |
| [8](#8-card-completion-per-card-done-state) | Card Completion (Per-card Done State) | Implemented (#35–#37) |
| [9](#9-card-title-edit-inline-ใน-cardpanel) | Card Title Edit (Inline ใน CardPanel) | Implemented (#38) |
| [10](#10-monorepo-migration-รวม-api-เข้า-frontend-repo) | Monorepo Migration | Implemented |
| [11](#11-board-list-view) | Board "List View" | **ready-for-agent** (ยังไม่ implement — [issue #44](https://github.com/khthana/kanban-board/issues/44)) |

---

## 1. MVP เริ่มต้น — Kanban Board (Full-stack Draft, การอนุมัติขอบเขต, และ Mock-Backend Build)

**สถานะ:** Implemented (historical) — รอบนี้สร้างเฉพาะ frontend + mock backend ก่อน ภายหลัง backend จริง (Node.js/Express/PostgreSQL) ถูกพัฒนาต่อและมาแทนที่ mock backend ตามที่เอกสารนี้วางเส้นทางไว้ (ดู §1.6 "Seam สำหรับสลับ backend")

### 1.1 ภาพรวมและปัญหาที่แก้ (PRD ต้นฉบับ Draft v1.0 — 30 พฤษภาคม 2026)

**ขอบเขต:** Team MVP (ทีมเล็ก 2–15 คน) · **Tech Stack ที่ตั้งใจไว้ในระยะยาว:** React (frontend), Node.js (backend), PostgreSQL (database)

Kanban Board เป็น web application สำหรับทีมเล็ก (2–15 คน) ใช้บริหารงานแบบ visual board โดยจัดงานเป็น card ที่เคลื่อนผ่าน column ต่างๆ ตามสถานะของงาน (เช่น To Do → In Progress → Done) ผู้ใช้ลากการ์ด (drag-and-drop) ข้าม column ได้ และมองเห็นภาพรวมความคืบหน้าของทีมในหน้าจอเดียว

เป้าหมายของ MVP คือทำให้ flow หลัก — สร้าง board, สร้าง card, ลากย้าย card, มอบหมายงาน — ทำงานได้ลื่นไหลและเชื่อถือได้ก่อน โดย**ตัด** real-time collaborative editing แบบ live cursor และระบบ permission ที่ซับซ้อนออกไปเป็น Phase ถัดไป

ทีมเล็กมักจัดการงานกระจัดกระจายในแชท สเปรดชีต และอีเมล ทำให้ไม่มีจุดเดียวที่เห็นสถานะงานทั้งหมด ไม่รู้ว่าใครทำอะไรอยู่ และงานตกหล่น Kanban Board รวมศูนย์ข้อมูลงานให้เห็นเป็นภาพ พร้อมสถานะและผู้รับผิดชอบที่ชัดเจน

**ขอบเขต MVP (In Scope):** การจัดการบัญชีผู้ใช้และ authentication, การสร้างและจัดการ board, การจัดการ column ภายใน board, การจัดการ card (สร้าง/แก้ไข/ลบ/ลากย้าย), การมอบหมายงานให้สมาชิก, การติด label และกำหนด due date, การเชิญสมาชิกเข้า board, และการ sync ข้อมูลเมื่อผู้ใช้รีเฟรชหรือเปิดหน้าใหม่ (polling-based refresh ไม่ใช่ live websocket)

**นอกขอบเขต MVP (ยกไป Phase ถัดไป):** Real-time live sync ผ่าน WebSocket พร้อม presence/cursor ของผู้ใช้คนอื่น, ระบบ role/permission แบบละเอียด (เช่น viewer/editor/admin ต่อ board), checklist ย่อยใน card (ภายหลังทำจริงในหัวข้อ 4), ไฟล์แนบขนาดใหญ่, การแจ้งเตือนผ่านอีเมล/push, automation rules, swimlanes, การค้นหาขั้นสูงข้าม board, mobile native app และ analytics dashboard

**Non-Functional Requirements:** หน้า board ที่มี card ไม่เกิน 500 ใบควรโหลดเสร็จภายใน 2 วินาทีบนเครือข่ายปกติ การลากย้าย card ต้องตอบสนองทันที (optimistic UI) และ persist ลง backend ภายใน 1 วินาที ระบบต้องรองรับผู้ใช้พร้อมกันต่อ board อย่างน้อย 15 คน รหัสผ่านต้อง hash ด้วย bcrypt/argon2 และทุก API ต้องผ่าน authentication ยกเว้น endpoint สำหรับ login/register UI ต้องใช้งานได้บน desktop browser รุ่นใหม่ (Chrome, Firefox, Safari, Edge) และ responsive พอใช้บนแท็บเล็ต

### 1.2 User Stories (ต้นฉบับ full-stack)

รูปแบบ: *As a [role], I want [feature], so that [benefit]*

**Authentication & Account**
- As a new user, I want to register with email and password, so that I can create my own account and start using the board.
- As a registered user, I want to log in and stay logged in across sessions, so that I don't have to re-enter credentials every time.
- As a user, I want to log out, so that my account is secure on shared computers.

**Board Management**
- As a user, I want to create a new board with a name, so that I can organize work for a specific project.
- As a user, I want to see a list of all boards I own or am a member of, so that I can switch between projects easily.
- As a board owner, I want to rename or delete a board, so that I can keep my workspace tidy.
- As a board owner, I want to invite teammates to a board by email, so that we can collaborate on the same project.

**Column Management**
- As a board member, I want to create columns with custom names, so that I can model my team's workflow stages.
- As a board member, I want to reorder columns by dragging, so that the board reflects the real sequence of work.
- As a board member, I want to rename or delete a column, so that I can adjust the workflow as it evolves.

**Card Management**
- As a board member, I want to create a card with a title inside a column, so that I can capture a task quickly.
- As a board member, I want to open a card to edit its description, assignee, due date, and labels, so that I can capture full task detail.
- As a board member, I want to drag a card to another column or reorder it within a column, so that I can update its status visually.
- As a board member, I want to delete a card, so that I can remove tasks that are no longer relevant.

**Collaboration & Visibility**
- As a board member, I want to assign a card to a teammate, so that responsibility is clear.
- As a board member, I want to add colored labels to cards, so that I can categorize tasks (e.g., bug, feature, urgent).
- As a board member, I want to set a due date on a card and see overdue cards highlighted, so that I don't miss deadlines.
- As a board member, I want the board to reflect recent changes when I refresh or reopen it, so that I see up-to-date status from my teammates.

### 1.3 Implementation Decisions (ต้นฉบับ full-stack)

> หมายเหตุ: ส่วนนี้บันทึก **การตัดสินใจเชิงสถาปัตยกรรมและสัญญา (contracts)** ไม่ใช่ source code หรือ file path เพื่อให้คงทนต่อการเปลี่ยนแปลง

**Architecture & Tech Stack:** ระบบเป็น web application แบบ client-server แยกชั้นชัดเจน Frontend เป็น React single-page application (SPA) สื่อสารกับ backend ผ่าน REST API (JSON) Backend เป็น Node.js (แนะนำ Express หรือ Fastify) ทำหน้าที่ business logic และ authentication ฐานข้อมูลเป็น PostgreSQL การ deploy คาดว่าเป็น stateless backend หลาย instance หลัง load balancer โดยเก็บ session state ไว้ใน token ไม่ใช่ในหน่วยความจำ server

การ sync ข้อมูลใน MVP ใช้รูปแบบ **polling** — frontend ดึงสถานะ board ใหม่เมื่อเปิดหน้า/รีเฟรช และ poll ซ้ำทุก ~10 วินาทีขณะเปิดอยู่ (ออกแบบ API ให้รองรับการเปลี่ยนไปใช้ WebSocket ใน Phase ถัดไปได้โดยไม่ต้องเปลี่ยน data model)

**Modules ที่จะสร้าง:** Backend แบ่งเป็น module ตาม domain: **Auth module** (register, login, token issuance/verification), **User module** (โปรไฟล์ผู้ใช้, ค้นหาผู้ใช้สำหรับ invite/assign), **Board module** (CRUD board + membership), **Column module** (CRUD column + reordering), **Card module** (CRUD card + การย้าย/reorder ข้าม column), และ **Label module** (CRUD label ระดับ board + ผูก label กับ card) Frontend แบ่งเป็น: **Auth views** (login/register), **Board list view**, **Board detail view** (แสดง column + card พร้อม drag-and-drop), **Card detail modal/panel**, และ **shared API client + state store**

**Authentication Contract:** ใช้ JWT (JSON Web Token) แบบ stateless ผู้ใช้ login แล้วได้รับ access token (อายุสั้น เช่น 15–60 นาที) เก็บฝั่ง client ทุก request ที่ต้อง auth ส่ง token ผ่าน header `Authorization: Bearer <token>` Backend ตรวจสอบ token ทุก request และดึง `user_id` จาก payload รหัสผ่าน hash ด้วย bcrypt (cost ≥ 10) หรือ argon2 ก่อนเก็บลง DB **ห้าม**เก็บ plaintext password ในกรณีต้องการ "stay logged in" ระยะยาว ให้ออกแบบ refresh token แยก (optional ใน MVP — ภายหลัง implement จริงตามที่บันทึกใน [CLAUDE.md](../CLAUDE.md))

**Authorization Model (MVP — แบบเรียบง่าย):** ใช้โมเดล authorization 2 ระดับเท่านั้น: **owner** (ผู้สร้าง board — ลบ board / จัดการสมาชิกได้) และ **member** (สมาชิกที่ถูกเชิญ — สร้าง/แก้ไข/ลบ column และ card ได้ทั้งหมด แต่ลบ board ไม่ได้) ผู้ที่ไม่ใช่ owner หรือ member ของ board เข้าถึง board นั้นไม่ได้เลย การ enforce ทำที่ backend ทุก endpoint โดยตรวจว่า `user_id` เป็นสมาชิกของ board ที่เกี่ยวข้องก่อนเสมอ (ไม่เชื่อถือ client) ระบบ role ละเอียด (viewer/editor/admin) เลื่อนไป Phase ถัดไป

**Ordering Strategy (สำคัญ):** ลำดับของ column ภายใน board และ card ภายใน column เก็บด้วยฟิลด์ `position` แบบ **fractional/float** (หรือ lexicographic rank string) ไม่ใช่ integer index ต่อเนื่อง เพื่อให้การย้าย 1 รายการไม่ต้อง re-write ทุก record ในคอลัมน์ เมื่อย้าย card ไปแทรกระหว่าง card A (position 1.0) และ B (position 2.0) ระบบกำหนด position ใหม่เป็นค่ากึ่งกลาง (1.5) Backend ทำ periodic rebalancing เมื่อ precision เริ่มตัน แนวทางนี้รองรับ drag-and-drop ที่ตอบสนองเร็วโดยอัปเดต record เดียว

**Data Model / Schema (เชิงตรรกะ):** ตารางหลักและความสัมพันธ์ (ใช้ UUID เป็น primary key, มี `created_at` / `updated_at` ทุกตาราง):

- **users** — `id`, `email` (unique), `password_hash`, `display_name`
- **boards** — `id`, `name`, `owner_id` (→ users)
- **board_members** — `id`, `board_id` (→ boards), `user_id` (→ users), `role` (`owner` | `member`); unique (board_id, user_id) — ตารางเชื่อม many-to-many สำหรับสมาชิก board
- **columns** — `id`, `board_id` (→ boards), `name`, `position` (float)
- **cards** — `id`, `column_id` (→ columns), `title`, `description` (nullable), `assignee_id` (→ users, nullable), `due_date` (nullable), `position` (float)
- **labels** — `id`, `board_id` (→ boards), `name`, `color`
- **card_labels** — `card_id` (→ cards), `label_id` (→ labels); composite PK — เชื่อม card กับ label แบบ many-to-many

กฎ cascade: ลบ board → ลบ column, card, label, membership ที่เกี่ยวข้อง; ลบ column → ลบ card ในนั้น; ลบ label → ลบ row ใน card_labels เท่านั้น (ไม่ลบ card) ใส่ index บน foreign key ที่ query บ่อย: `columns.board_id`, `cards.column_id`, `board_members.user_id`

**API Contract (REST):** ทุก endpoint (ยกเว้น auth) ต้องมี valid token และผ่านการตรวจ membership ของ board ที่เกี่ยวข้อง ใช้ HTTP status มาตรฐาน (200/201 สำเร็จ, 400 input ผิด, 401 ไม่ได้ auth, 403 ไม่มีสิทธิ์, 404 ไม่พบ, 409 conflict)

```
POST   /auth/register          → สร้าง user, คืน token
POST   /auth/login             → คืน token
GET    /boards                 → board ทั้งหมดที่ user เป็น owner/member
POST   /boards                 → สร้าง board (ผู้สร้างเป็น owner)
GET    /boards/:id             → board + columns + cards + labels (full snapshot สำหรับ render หน้าเดียว)
PATCH  /boards/:id             → rename board (owner)
DELETE /boards/:id             → ลบ board (owner)
POST   /boards/:id/members     → เชิญสมาชิกด้วย email (owner)
DELETE /boards/:id/members/:userId → เอาสมาชิกออก (owner)
POST   /boards/:id/columns     → สร้าง column
PATCH  /columns/:id            → rename / เปลี่ยน position
DELETE /columns/:id            → ลบ column
POST   /columns/:id/cards      → สร้าง card
PATCH  /cards/:id              → แก้ field และ/หรือ ย้าย (column_id + position)
DELETE /cards/:id              → ลบ card
POST   /boards/:id/labels      → สร้าง label
PATCH  /labels/:id             → แก้ label
DELETE /labels/:id             → ลบ label
PUT    /cards/:id/labels/:labelId    → ติด label
DELETE /cards/:id/labels/:labelId    → ถอด label
```

**การย้าย card** ใช้ `PATCH /cards/:id` ส่ง `{ column_id, position }` ใน body เดียว (ครอบคลุมทั้งย้ายข้าม column และ reorder ใน column เดิม) — ตัดสินใจรวมเป็น endpoint เดียวเพื่อให้ frontend จัดการ drag-and-drop ด้วย call เดียว

**Frontend State & Optimistic UI:** Frontend โหลด full board snapshot จาก `GET /boards/:id` ครั้งเดียวเก็บใน client state store (เช่น Redux/Zustand/React Query) การ render board อิงจาก state นี้ การลาก-ย้าย card ใช้ **optimistic update**: อัปเดต UI ทันทีที่ผู้ใช้ drop แล้วยิง `PATCH /cards/:id` เบื้องหลัง หาก API ล้มเหลวให้ rollback state กลับและแจ้ง error การ poll ทุก ~10 วินาทีดึง snapshot ใหม่มา reconcile (last-write-wins ใน MVP — ยังไม่ทำ conflict merge ละเอียด)

ไลบรารี drag-and-drop แนะนำเป็น library ที่ดูแลต่อเนื่องและรองรับ accessibility/keyboard (เช่น dnd-kit) — ตัดสินใจหลีกเลี่ยง library ที่หยุด maintain แล้ว

**Concurrency & Conflict (MVP):** เนื่องจาก MVP ใช้ polling + last-write-wins การแก้ field เดียวกันพร้อมกันจาก 2 คน ผลลัพธ์คือคนที่บันทึกทีหลังชนะ ถือว่ายอมรับได้สำหรับทีมเล็ก สำหรับการย้าย card ที่ position ชนกัน backend จะ assign position ใหม่ให้เสมอ ดังนั้นจะไม่เกิด card ทับซ้อนที่ position เดียวกัน

**Validation Rules (ระดับ contract):** `board.name` และ `column.name` ต้องไม่ว่างและยาวไม่เกิน 100 ตัวอักษร, `card.title` ต้องไม่ว่าง ยาวไม่เกิน 255, `card.description` ไม่เกิน ~5,000 ตัวอักษร, `label.color` ต้องเป็นค่า hex color ที่ valid, การเชิญสมาชิกต้องเป็น email ที่มี user อยู่ในระบบแล้ว (MVP ยังไม่ทำ invite ผู้ที่ยังไม่สมัคร) Validation ทำทั้งฝั่ง client (UX) และ backend (authoritative)

### 1.4 UI/UX Guidelines (ต้นฉบับ)

**Layout & Hierarchy:** หน้า board เป็น column วางเรียงแนวนอนและ scroll แนวนอนได้ ความกว้าง column คงที่ ~280–320px card สูงตามเนื้อหา ใช้ whitespace และเส้นแบ่งบางแทนกรอบหนา เพื่อให้สายตาโฟกัสที่ card หัวแต่ละ column แสดงชื่อพร้อมตัวนับจำนวน card ช่วยให้เห็นภาระงานทันที แถบบนสุด (top bar) แสดงชื่อ board, avatar สมาชิก และปุ่ม invite

**Card Design:** หน้า card แสดงเฉพาะข้อมูลที่ scan เร็ว ได้แก่ แถบ label สีด้านบน, title, avatar ผู้รับผิดชอบ และ due date เป็น chip รายละเอียดเต็ม (description, การจัดการ label, assignee) เปิดใน modal หรือ side-panel เมื่อคลิก card — ไม่ยัดทุกอย่างลงบนหน้า card *(หมายเหตุ: ดีไซน์ "แถบ label สี" นี้ถูกทำจริงในหัวข้อ 5 แล้วถูกแทนที่ด้วย editorial card ในหัวข้อ 6)*

**Drag-and-Drop Affordance:** จุดสำคัญที่สุดของ Kanban ขณะลากต้องมี placeholder/ghost ชี้ตำแหน่ง drop ชัดเจน card ที่ลากยกขึ้นด้วย shadow และเอียงเล็กน้อย column เป้าหมาย highlight ระหว่าง hover ต้องรองรับการลากด้วยคีย์บอร์ด (accessibility)

**Color & State:** สีพื้นเป็น neutral ให้ label และสถานะเป็นตัวเดินสี ใช้สีเชิงความหมายสม่ำเสมอ (overdue = แดง, ใกล้ครบกำหนด = เหลือง) และ**ห้าม**สื่อความหมายด้วยสีอย่างเดียว ต้องเติม icon หรือข้อความกำกับด้วยเสมอ (รองรับผู้ใช้ตาบอดสี ตาม WCAG)

**Empty & Loading States:** board ที่ยังไม่มี column และ column ที่ยังไม่มี card ต้องมี empty state ที่ชวนลงมือ (เช่น "+ เพิ่ม column แรก") การ poll refresh ต้องเงียบ ไม่กระพริบทั้งหน้า — อัปเดตเฉพาะส่วนที่เปลี่ยน

**Responsive:** บนแท็บเล็ตให้ column แคบลงและ scroll แนวนอนได้ บนจอเล็กพิจารณาแสดงทีละ column พร้อมตัวสลับ touch target ทุกปุ่มอย่างน้อย 44×44px

**ASCII Mockup — Board Detail View:**

```
┌─────────────────────────────────────────────────────────────────────────┐
│  ☰  Project Phoenix          [🔍 Search]      (T)(A)(M) +    [+ Invite]    │  ← top bar
├─────────────────────────────────────────────────────────────────────────┤
│                                                                           │
│  ┌── To Do ──────── 3 ─┐  ┌─ In Progress ── 2 ─┐  ┌── Done ──────── 4 ─┐ │
│  │                     │  │                     │  │                     │ │
│  │ ┌─────────────────┐ │  │ ┌─────────────────┐ │  │ ┌─────────────────┐ │ │
│  │ │ ▌bug            │ │  │ │ ▌feature        │ │  │ │ ▌feature        │ │ │
│  │ │ Fix login crash │ │  │ │ Build card modal│ │  │ │ Setup CI        │ │ │
│  │ │ 🗓 Jun 2  ⚠ (A) │ │  │ │ 🗓 Jun 5    (T) │ │  │ │           (M)   │ │ │
│  │ └─────────────────┘ │  │ └─────────────────┘ │  │ └─────────────────┘ │ │
│  │ ┌─────────────────┐ │  │ ┌─────────────────┐ │  │ ┌─────────────────┐ │ │
│  │ │ ▌feature        │ │  │ │ ░░░░░░░░░░░░░░░░ │ │  │ │ DB schema       │ │ │
│  │ │ Drag-and-drop   │ │  │ │ ░ drop here ░░░ │ │  │ │           (A)   │ │ │
│  │ │ 🗓 Jun 8    (M) │ │  │ │ ░░░░░░░░░░░░░░░░ │ │  │ └─────────────────┘ │ │
│  │ └─────────────────┘ │  │ └─────────────────┘ │  │   … 2 more          │ │
│  │ ┌─ ▛ dragging ▜ ──┐ │  │                     │  │                     │ │
│  │ │ ▌urgent  Deploy │ │  │ [+ Add a card]      │  │ [+ Add a card]      │ │
│  │ └─────────────────┘ │  └─────────────────────┘  └─────────────────────┘ │
│  │ [+ Add a card]      │                                                   │
│  └─────────────────────┘   [+ Add column]                                 │
│                                                                           │
└─────────────────────────────────────────────────────────────────────────┘

  ▌ = แถบ label สี      (T)(A)(M) = avatar       ⚠ = overdue
  ░░ = placeholder ตอนลาก (drop target)          ▛ ▜ = card ที่กำลังลาก (ยกขึ้น)
```

**ASCII Mockup — Card Detail Panel:**

```
┌──────────────────────────────────────────────┐
│  Fix login crash                          [✕] │
│  อยู่ใน: To Do                                 │
├──────────────────────────────────────────────┤
│  Labels:   ▌bug   ▌urgent   [+]                │
│  Assignee: (A) Alice                 [เปลี่ยน] │
│  Due date: 🗓 Jun 2, 2026   ⚠ overdue          │
│                                                │
│  Description                                   │
│  ┌────────────────────────────────────────┐   │
│  │ ผู้ใช้กด login แล้ว app crash บน Safari   │   │
│  │ ต้องตรวจ token parsing ...               │   │
│  └────────────────────────────────────────┘   │
│                                                │
│              [ลบ card]            [บันทึก]      │
└──────────────────────────────────────────────┘
```

### 1.5 ข้อมูลเสริมสำหรับการพัฒนา (ต้นฉบับ)

**ลำดับการพัฒนาแนะนำ (Milestones):** เริ่มจาก Auth + User (รากฐาน) → Board CRUD + membership → Column CRUD → Card CRUD → Drag-and-drop + ordering → Labels + due date + assignee → Polling refresh → ขัดเกลา UX และ validation ปลายทาง แต่ละ milestone ควรมี API ใช้งานได้จริงก่อนต่อ frontend

**Acceptance Criteria ตัวอย่าง (flow หลัก):** การลากย้าย card ถือว่าผ่านเมื่อ: ผู้ใช้ลาก card จาก column A ไป column B แล้ว card ปรากฏใน B ทันที, รีเฟรชหน้าแล้ว card ยังอยู่ที่ B (persist สำเร็จ), และถ้า API ล้มเหลว card เด้งกลับ A พร้อมข้อความ error การเชิญสมาชิกถือว่าผ่านเมื่อ: owner กรอก email ของ user ที่มีอยู่ → สมาชิกเห็น board ใน list ของตนเมื่อ login และแก้ card ได้ แต่ลบ board ไม่ได้

**Edge Cases ที่ต้องจัดการ:** ลบ column ที่มี card อยู่ (ต้องยืนยันและ cascade), ย้าย card ขณะมีคนอื่นลบ card นั้นไปแล้ว (คืน 404, frontend ลบออกจาก state), board ว่าง (ไม่มี column) ต้องแสดง empty state ที่ชวนสร้าง column แรก, due date ในอดีตต้อง highlight เป็น overdue, สมาชิกถูกถอดออกจาก board ขณะเปิดอยู่ (poll ครั้งถัดไปได้ 403 → เด้งออกพร้อมข้อความ)

**Testing Strategy (สรุป):** Unit test สำหรับ business logic (โดยเฉพาะ position/ordering algorithm และ authorization check), integration test สำหรับทุก API endpoint รวม happy path + auth failure + permission failure, และ end-to-end test สำหรับ flow หลัก: register → สร้าง board → สร้าง column/card → ลากย้าย → รีเฟรชแล้วข้อมูลคงอยู่ ควรมี test เฉพาะสำหรับ ordering edge case (แทรกหัว/ท้าย/กลาง และ rebalancing)

**ข้อสมมติ (Assumptions):** ถือว่าทีมขนาดเล็กและปริมาณ card ต่อ board ไม่เกินหลักร้อย จึงโหลด full snapshot ได้ ถ้าในอนาคต board ใหญ่ขึ้นมากต้องเพิ่ม pagination/lazy-load ต่อ column ถือว่าผู้ใช้ทุกคนสมัครสมาชิกก่อน จึง assign/invite ด้วย email ที่มีในระบบเท่านั้น และถือว่า MVP ยังไม่ต้องรองรับ offline mode

### 1.6 การตัดสินใจอนุมัติรอบแรก — Frontend + Mock Backend (Approved v1.0 — 31 พฤษภาคม 2026)

**ที่มา:** PRD ต้นฉบับ (§1.1–1.5 ข้างต้น) ออกแบบระบบเป็น full-stack (React + Node.js + PostgreSQL) แต่ repository ตอนนั้นเป็นเพียง Create React App scaffold เปล่า (React 19, ยังไม่มี backend/DB/router/state) จากการ grill ข้อกำหนดร่วมกัน ได้ข้อสรุปว่า **รอบนี้จะสร้างเฉพาะ frontend** โดยมี **mock API client** ที่เลียนแบบ REST contract ใน §1.3 คุยกับ "server จำลอง" ที่เก็บ state ใน localStorage เป้าหมายคือได้ Kanban ที่กดเล่นได้จริงในเบราว์เซอร์ทันที และเปลี่ยนไปต่อ Node backend จริงในอนาคตได้โดยแก้แค่ไส้ในของ API client ชั้นเดียว — ไม่ต้องแตะ UI, state หรือ data model ส่วนนี้บันทึก **เฉพาะการตัดสินใจที่ override หรือเพิ่มเติมจาก §1.1–1.5** ส่วนที่ไม่กล่าวถึงให้ยึดตามเดิม

**การตัดสินใจที่อนุมัติแล้ว (Locked Decisions):**

| หัวข้อ | ตัดสินใจ | override PRD เดิม? |
|---|---|---|
| **ขอบเขต** | Frontend + mock API client + localStorage persistence | ใช่ — เลื่อน Node/PostgreSQL ออกไป Phase ถัดไป |
| **Identity / Auth** | **User-switcher** — seed ผู้ใช้หลายคน (Alice/Bob/…) มี dropdown เลือกว่า "ตอนนี้เราเป็นใคร" ไม่มีหน้า login จริง | ใช่ — JWT/bcrypt เป็นของจริงไม่ได้เพราะไม่มี server |
| **State management** | **Zustand** + `persist` middleware (localStorage) | เลือก 1 ใน option ที่เปิดไว้ |
| **Mock fidelity** | เต็มรูปแบบ — async Promise + หน่วงเวลา, toggle บังคับ fail (โชว์ rollback), cross-tab sync ผ่าน `storage` event (จำลอง polling ~10s) | เพิ่มเติม — วิธีจำลองพฤติกรรมบนเครื่องเดียว |
| **Styling** | **CSS Modules** (มากับ CRA ไม่ต้องตั้ง build config) | เพิ่มเติม |
| **Card detail** | **Side-panel** เลื่อนเข้าจากขวา (board ยังเห็นด้านหลัง) | เลือกจาก "modal หรือ side-panel" ที่เปิดไว้ |
| **Drag-and-drop** | **dnd-kit** (`@dnd-kit/core` + `@dnd-kit/sortable`) | ยึดตามเดิม |
| **Ordering** | **Fractional float `position`** | ยึดตามเดิม |
| **Routing** | **react-router-dom** | เพิ่มเติม |
| **Seed data** | บอร์ดตัวอย่าง "Project Phoenix" ตาม mockup §1.4 | เพิ่มเติม |

**Trade-offs ที่ยอมรับ** เนื่องจากไม่มี server จริงในรอบนี้: **Auth เป็นของจำลอง** — ไม่มี password hashing/JWT จริง การ "เป็นใคร" มาจาก user-switcher **Collaboration เป็น single-machine** — invite teammate, assignee, polling refresh จาก "คนอื่น" จำลองด้วย user-switcher + cross-tab sync (เปิดหลายแท็บ) ไม่ใช่ multi-user ข้ามเครื่องจริง **ปริมาณข้อมูล** — เก็บใน localStorage เหมาะกับ card หลักร้อยใบตามข้อสมมติ §1.5

ส่วนที่ยังคงทำงาน *จริง* และ demo ได้ครบ: board/column/card CRUD, drag-and-drop + fractional ordering, optimistic update + rollback, persist ข้าม refresh, label/due-date/assignee, owner-vs-member authorization, edge cases (404/403/cascade)

**สถาปัตยกรรม (Seam สำหรับสลับ backend ภายหลัง):**

```
UI components ─► Zustand store (optimistic, persisted) ─► API client (รูปแบบ method ตาม §1.3)
                                                                │
                                                        mockBackend ("server" จำลอง:
                                                        canonical state ใน localStorage,
                                                        latency, failure toggle,
                                                        membership/authz checks,
                                                        broadcast การเปลี่ยนข้ามแท็บ)
```

**จุดสลับ (swap point)** คือ API client — method (`getBoards`, `getBoard`, `createBoard`, `patchCard`, `moveCard`, `addMember`, …) มีชื่อและ semantics ตรงตาม §1.3 วันนี้เรียก `mockBackend`; วันหน้าเปลี่ยนเป็น `fetch()` ยิง Node API จริงโดยผู้เรียกไม่ต้องแก้ (แนวทางนี้ถูกใช้จริงภายหลังตอนย้ายไป backend จริง — ดู [CLAUDE.md](../CLAUDE.md))

**Authorization** อยู่ใน `mockBackend` เสมอ (ไม่เชื่อ caller): ทุก operation ตรวจว่า current user เป็นสมาชิกของ board ที่เกี่ยวข้อง; การลบ board / จัดการสมาชิก ตรวจ role `owner`

**Domain Glossary ฉบับแรกสุด** *(เก็บไว้เป็นประวัติ — glossary ปัจจุบันของระบบอยู่ที่ [CONTEXT.md](../CONTEXT.md) ที่ root แล้ว ให้ยึดตามนั้น)*: Board, Column, Card (ยุคนั้นยังไม่มี Category / multi-assignee), Member (owner/member), Assignee (ยุคนั้นยังเป็นคนเดียว — ภายหลังเปลี่ยนเป็นหลายคนในหัวข้อ 6), Position, Current User (ยุคนั้นคือ user-switcher), Overdue

**โครงไฟล์ที่วางแผนไว้ตอนนั้น:**

```
src/
  index.js                      (เดิม — ครอบด้วย BrowserRouter)
  App.js                        (เขียนใหม่ — routes + session)
  routes/
    BoardListPage.jsx           GET /boards
    BoardPage.jsx               GET /boards/:id (full snapshot)
  api/
    client.js                   API surface ตาม §1.3 (จุดสลับ)
    mockBackend.js              "server" บน localStorage: authz, latency, failure toggle, cross-tab broadcast
  domain/
    ordering.js                 positionBetween, needsRebalance, rebalance — pure, unit-tested
    validation.js               กฎ §1.3
  store/
    useBoardStore.js            Zustand+persist: snapshot, optimistic mutate, rollback
    useSession.js               current user + seed users (user-switcher)
  hooks/
    usePolling.js               interval + storage-event reconcile
  components/
    UserSwitcher · TopBar · MemberAvatars · InviteDialog
    Column · ColumnComposer · Card · CardComposer
    CardPanel · LabelPicker · AssigneePicker · DueDateField
    EmptyState · Avatar · LabelChip
    *.module.css                co-located styles
  seed.js                       seed users + บอร์ด "Project Phoenix"
CONTEXT.md  (root)              glossary
```

Dependencies ที่ต้องเพิ่มตอนนั้น: `zustand`, `react-router-dom`, `@dnd-kit/core`, `@dnd-kit/sortable`, `@dnd-kit/utilities`, `uuid`

**Milestones (แต่ละอันรันได้จริง):** M0 — Scaffold & seam (deps, `CONTEXT.md`, routing, โครง `mockBackend`+`client`, `useSession`+UserSwitcher, `seed.js`) → M1 — Boards (list, create/rename/delete owner-only, membership, authz) → M2 — Columns (create/rename/delete + empty states, ordering) → M3 — Cards (create/edit/delete, CardPanel side-panel, ตัวนับ card) → M4 — Drag-and-drop + ordering (dnd-kit, fractional position, optimistic+rollback, placeholder/ghost, คีย์บอร์ด) → M5 — Collaboration fields (assignee picker, label สี, due date+overdue, invite dialog) → M6 — Polling/reconcile + edge cases (`usePolling`, 404 card ถูกลบ, 403 member ถูกถอด, ลบ column cascade) → M7 — Polish (loading/empty states, responsive, neutral palette)

**Verification (เกณฑ์ตรวจรับตอนนั้น):** Unit tests (`ordering.test.js`, `validation.test.js`, authz checks) + Manual flow: สลับ user → เห็น board seed → สร้าง board/column/card → ลาก card A→B คงอยู่หลัง refresh → เปิด toggle บังคับ fail แล้วดู rollback → 2 แท็บคนละ user เห็นการเปลี่ยนแปลงของกันและกัน → invite แล้วสิทธิ์ owner/member ถูกต้อง → due date อดีต highlight overdue → ลบ column ที่มี card ต้องยืนยันและ cascade

### 1.7 PRD คำสั่งดำเนินการจริง — Frontend (Mock-Backend Build)

> **Triage label ตอนนั้น:** `ready-for-agent`

**Problem Statement:** ทีมเล็ก (2–15 คน) จัดการงานกระจัดกระจายในแชท สเปรดชีต และอีเมล ไม่มีจุดเดียวที่เห็นสถานะงานทั้งหมด ไม่รู้ว่าใครรับผิดชอบอะไร และงานตกหล่น ผู้ใช้ต้องการกระดาน Kanban ที่เห็นงานทั้งทีมในหน้าจอเดียว ลากการ์ดข้ามสถานะได้ลื่นไหล และเชื่อถือได้ว่าข้อมูลไม่หาย ในเชิงการพัฒนา ทีมยังไม่ต้องการลงทุนกับโครงสร้าง backend (Node + PostgreSQL + auth จริง) ก่อนจะได้พิสูจน์ว่า core experience ของกระดาน — การสร้าง/ลาก-ย้าย card, ordering, optimistic UI — ใช้งานได้จริงและน่าใช้

**Solution:** สร้าง **Kanban Board frontend** เป็น React SPA ที่กดเล่นได้เต็มรูปแบบในเบราว์เซอร์ทันที โดยมี **mock backend** ที่เก็บ canonical state ไว้ใน localStorage และจำลองพฤติกรรมของ server จริง (async, latency, การ enforce สิทธิ์, การ broadcast การเปลี่ยนแปลงข้ามแท็บ) ผู้ใช้เปิดแอปแล้วเลือกตัวตนจาก **user-switcher** (ตัวตนที่ seed ไว้) เห็นรายการ Board ที่ตนเป็น owner หรือ member เปิด Board เห็น Column เรียงแนวนอน แต่ละ Column มี Card ที่ลาก-ย้าย/จัดลำดับได้ด้วย drag-and-drop การลากตอบสนองทันที (optimistic) และคงอยู่หลัง refresh เปิดรายละเอียด Card ใน side-panel เพื่อแก้ description, assignee, due date, labels ได้

**User Stories (42 ข้อ):**

*Identity & Session:* (1) เลือกตัวตนที่ seed ไว้จาก switcher แทนการ login จริง (2) ตัวตนปัจจุบัน persist ข้าม refresh (3) สลับตัวตนได้ตลอดเวลาเพื่อจำลอง collaboration บนเครื่องเดียว

*Board list:* (4) เห็นเฉพาะ Board ที่ตนเป็น owner/member (5) Board ที่ไม่มีสิทธิ์ถูกซ่อน (6) สร้าง Board ใหม่ด้วยชื่อ (7) owner แก้ชื่อ Board ได้ (8) owner ลบ Board ได้ (9) member ที่ไม่ใช่ owner ไม่เห็นปุ่มลบ

*Membership & invitation:* (10) owner เชิญ user ที่ seed ไว้ด้วย email (11) owner เอาสมาชิกออกได้ (12) สมาชิกที่ถูกเชิญเห็น Board ในลิสต์เมื่อสลับเป็นตัวตนนั้น (13) เห็น avatar สมาชิกทั้งหมดใน top bar

*Columns:* (14) สร้าง Column ด้วยชื่อเอง (15) แก้ชื่อ Column (16) ลบ Column พร้อม confirm เมื่อยังมี Card (17) ลาก reorder Column (18) หัว Column แสดงจำนวน Card (19) Board ว่างแสดง empty state ชวนเพิ่ม Column แรก

*Cards:* (20) สร้าง Card ด้วย title ใน Column (21) เปิด Card ใน side-panel เห็น Board อยู่ด้านหลัง (22) แก้ description (23) ลบ Card (24) Column ว่างแสดง empty state ชวนเพิ่ม Card แรก

*Drag-and-drop & ordering:* (25) ลาก Card ข้าม Column (26) reorder Card ในคอลัมน์เดิม (27) Card ที่ย้ายปรากฏทันที (optimistic) (28) มี placeholder/ghost ชัดเจนตอนลาก (29) Card อยู่ตำแหน่งที่ drop หลัง refresh (30) บันทึกล้มเหลว → Card เด้งกลับพร้อม error (31) ลากด้วยคีย์บอร์ดได้ (accessibility)

*Collaboration fields:* (32) มอบหมาย Card ให้เพื่อนร่วมทีมคนเดียว (33) สร้าง Label สีระดับ Board (34) ติด/ถอด Label บน Card (35) Card แสดงแถบสี Label, avatar ผู้รับผิดชอบ, due date เพื่อ scan เร็ว (36) ตั้ง due date บน Card (37) Card เกินกำหนด highlight ด้วยสี + icon/ข้อความ (ไม่ใช้สีอย่างเดียว)

*Sync & reconcile:* (38) เห็นการเปลี่ยนแปลงจากแท็บอื่น (ตัวตนอื่น) (39) refresh เงียบไม่กระพริบทั้งหน้า (40) Card ที่ถูกคนอื่นลบ หายไปจาก view (41) ถูกถอดออกจาก Board ขณะเปิดอยู่ → เด้งออกพร้อมข้อความในรอบ sync ถัดไป

*Robustness toggle (dev/demo):* (42) มี toggle บังคับ mock-backend fail เพื่อ demo optimistic rollback

**Implementation Decisions:**

*Scope & architecture* (locked — ดู §1.6): สร้าง React frontend เท่านั้น หนุนหลังด้วย mock backend (localStorage) ไม่มี Node/PostgreSQL รอบนี้ Layering: **UI components → Zustand store (optimistic, persisted) → API client (รูปแบบ method ตาม §1.3) → mockBackend** API client เป็น seam ที่ *shallow* โดยตั้งใจ (จุดสลับ) — method ชื่อ/semantics ตรงกับ §1.3 เพื่อให้สลับไปเป็น `fetch()` จริงได้โดยไม่ต้องแก้ผู้เรียก

*Deep modules* (ยืนยันกับผู้ใช้ — build/test แยกเดี่ยว): **`domain/ordering`** — pure function สำหรับ fractional float ordering: `positionBetween(prevPos, nextPos)`, `needsRebalance(positions)`, `rebalance(items)` **`domain/validation`** — pure validators ตามกฎ §1.3 **`api/mockBackend`** — "server": เก็บ canonical state, apply mutation, enforce authorization, cascade delete, จำลอง latency/forced failure, persist+broadcast ข้ามแท็บ

*Shallow/coupled modules* (ไม่ unit-test แยก): `store/useBoardStore` (orchestrate optimistic update), `api/client` (thin adapter), React components/routes (verify ผ่าน manual flow)

*Card move contract:* `moveCard(cardId, { columnId, position })` เดียวครอบคลุมทั้งย้ายข้าม Column และ reorder ในคอลัมน์เดิม mockBackend assign position สุดท้ายเสมอ ป้องกัน 2 การย้ายพร้อมกันชนกันที่ position เดียว

*Tech choices:* react-router-dom, dnd-kit (`@dnd-kit/core`+`@dnd-kit/sortable`) รวมคีย์บอร์ด, CSS Modules, uuid, seed data "Project Phoenix"

**Testing Decisions:** เทสต์ที่ดีคือยืนยัน behavior ภายนอกผ่าน public interface ไม่ใช่ internal representation **Modules ที่ unit-test:** `domain/ordering` เท่านั้น — insert หัว/ท้าย/กลาง ต้องเรียงถูกช่อง, `rebalance` กระจาย position ใหม่โดยรักษาลำดับเดิม, `needsRebalance` คืน true เมื่อ precision หมด **ไม่ unit-test รอบนี้:** `domain/validation`, mockBackend authz, store rollback — ครอบคลุมด้วย manual acceptance flow แทน (ยังเป็นเป้าหมาย test ในอนาคตได้)

**Out of Scope:** Real backend (Node/Express/Fastify), PostgreSQL, JWT/bcrypt จริง; multi-user/multi-device จริง, WebSocket, presence/cursor; role ละเอียดกว่า owner/member; sub-checklist, ไฟล์แนบใหญ่, notification, automation, swimlanes, cross-board search ขั้นสูง, mobile native app, analytics dashboard; invite user ที่ยังไม่ seed; unit test สำหรับ validation/mockBackend authz/store rollback รอบนี้

**Further Notes:** Trade-off ที่ยอมรับตรงไปตรงมา (§1.6) — auth จำลอง, collaboration single-machine ผ่าน user-switcher+cross-tab sync ส่วนที่เหลือทำงานจริงและ demo ได้ครบ (CRUD, drag-and-drop+ordering, optimistic+rollback, persistence, label/due-date/assignee, authorization, edge cases) Domain glossary ฉบับแรกอยู่ที่ root `CONTEXT.md` (ปัจจุบันเนื้อหาถูกขยายไปมากแล้ว ดู [CONTEXT.md](../CONTEXT.md))

---

## 2. Column Header Colors (Superseded by ADR-0001)

> **หัวข้อนี้ถูกแทนที่แล้วโดย [ADR-0001](../docs/adr/0001-column-accent-model.md)** โมเดล "ทาสีเฉพาะแถบ header" ด้านล่างถูกแทนที่ด้วยโมเดล column **Accent** (title chip + wash ทั้งคอลัมน์) Schema ฝั่ง backend (`color VARCHAR(7)`), validation, และ persistence ยังใช้ต่อ — มีแค่ส่วน frontend rendering ที่อธิบายในหัวข้อนี้ที่ล้าสมัยแล้ว (ดูโมเดลปัจจุบันในหัวข้อ 6 "Column Accent" ตาม ADR-0001)

**สถานะ:** Superseded

### Problem Statement

Columns on the board all look identical — the same gray header regardless of their meaning or stage in the workflow. Users who manage boards with many columns have no visual way to distinguish them at a glance or convey status through color (e.g., red for "Blocked", green for "Done"). Setting a color currently requires manually editing the database.

### Solution (โมเดลเดิม — ล้าสมัยแล้ว)

Allow board members to assign a background color to any column header directly from the board UI. Clicking the existing edit (✏️) button opens an inline form that includes both the column name field and a row of pastel color swatches. When a color is set, the column header renders with that color as its background. When no color is set, the header remains the default gray. A clear option ("✕" swatch) removes the color at any time. Colors are persisted to the database so they survive page reloads.

### User Stories (เดิม)

1. As a board member, I want to set a background color on a column header, so that I can visually distinguish columns at a glance without reading the name.
2. As a board member, I want to choose from 8 pastel preset swatches, so that I can assign a color in one click without thinking about hex codes.
3. As a board member, I want the color picker to appear inside the existing rename form, so that I do not need to open a separate panel just to change the color.
4. As a board member, I want the selected swatch to have a visible ring around it, so that I always know which color is currently chosen.
5. As a board member, I want a "+" swatch as a ninth option, so that I can still choose a custom color if none of the presets suits my needs.
6. As a board member, I want a "✕" swatch to clear the color, so that I can restore the default gray header if I no longer want a color.
7. As a board member, I want the column header background to change immediately when I save, so that the result is visible without needing to reload the page.
8. As a board member, I want the color to persist after a page reload, so that the board looks the same every time I open it.
9. As a board member, I want columns without a color to display the default gray header, so that the board does not look unfinished when I have not set colors yet.
10. As a board member, I want the column name and card count to remain readable against any pastel background, so that the header is functional as well as colorful.
11. As a board owner, I want column colors to be visible to all board members, so that the visual structure I set up is shared across the team.
12. As a board member, I want the color swatches to use the same palette as label colors, so that the board has a visually consistent color language.
13. As a board member, I want clicking the "+" swatch to open the native color picker, so that I can pick any color without leaving the panel.
14. As a board member, I want the "+" swatch to reflect the custom color I picked, so that I can see which custom color is active at a glance.
15. As a board member dragging a column, I want the drag overlay to also show the column's color, so that the dragged column looks correct mid-drag.

### Implementation Decisions (เดิม — ส่วน backend/schema ยังใช้จริง ส่วน frontend rendering ล้าสมัยแล้ว)

**Backend (kanban-board-api) — ยังใช้จริง:** เพิ่มคอลัมน์ `color VARCHAR(7) NULL` (nullable) ให้ตาราง `columns` ผ่าน migration ใหม่ รับค่า `NULL` (ไม่มีสี) หรือ hex 6 หลักที่ valid (`#rrggbb`) ไม่มีค่า default — แถวเดิมได้ `NULL` **API changes:** `PATCH /columns/:id` รับฟิลด์ `color` (optional) validate ว่าเป็น `null` หรือ hex ที่ valid แล้ว persist; `GET /boards/:id` (board snapshot) คืน `color` ในแต่ละ column object ไม่มี endpoint ใหม่

**Frontend (kanban-board) — rendering ส่วนนี้ล้าสมัยแล้ว ดูหัวข้อ 6 แทน:**
- API client normalization: เพิ่ม `color` ในการ flatten column mapping
- Store: `renameColumn` รับ `{ name, color }` แทน `{ name }` เดียว optimistic update ทั้งสองฟิลด์
- Column component: `RenameForm` รับ `color` ปัจจุบันของ column render swatch row ใต้ name input (เหมือน label color picker: 8 preset + "+" custom + "✕" clear) บันทึกแล้วเรียก `onSave(name, color)` **หัว column `div` ใช้ `style={{ background: column.color }}`** เมื่อมีสี — นี่คือส่วนที่ถูกแทนที่ด้วยโมเดล Accent (ทาทั้งคอลัมน์ ไม่ใช่แค่ header) ใน ADR-0001
- Preset palette (เดิม 8 สี เดียวกับ LabelPicker): `#fca5a5 #fdba74 #fde047 #86efac #67e8f9 #93c5fd #c4b5fd #f9a8d4`
- Validation: reuse `validateLabelColor()` เดิม "✕" clear ส่ง `color: null` ข้าม validation (บันทึกแค่ชื่อ)
- Text contrast: preset ทั้ง 8 เป็น pastel อ่อน ตัวหนังสือ header เข้ม (`#1e293b`) อ่านได้ชัดกับทุก preset ไม่มี dynamic contrast logic สีที่ผู้ใช้ตั้งเองผู้ใช้รับผิดชอบเอง

### Testing Decisions (เดิม)

Test observable behavior ผ่าน public interface ไม่ใช่ internal state สำหรับ E2E ยืนยันว่า header background เปลี่ยนหลังบันทึก และสียังอยู่หลัง reload ไม่มี unit test ใหม่ (`validateLabelColor()` unit-test อยู่แล้วใน `domain/validation.test.js`) E2E เดิม: เปิด board → คลิก ✏️ บน column → เห็น 10 swatches (8 preset + "+" + "✕") → คลิก preset → save → header มีสีตามที่เลือก → reload → สียังอยู่ *(E2E นี้ถูกปรับปรุงภายหลังตาม ADR-0001 — target เปลี่ยนจาก header background ไปเป็น title chip)*

### Out of Scope (เดิม)

Per-column text color (ไม่มี auto-contrast); Column background (card area) color — เดิมตั้งใจให้เฉพาะแถบ header เท่านั้น *(ข้อนี้เองที่ ADR-0001 พลิกกลับ — ตอนนี้ wash ทั้งคอลัมน์แล้ว)*; animated color transition; สีที่มองเห็นได้โดยไม่ login; bulk color assignment; column color ใน card side-panel

### Further Notes (เดิม)

`✕` clear swatch ส่ง `color: null` ไป `PATCH /columns/:id` backend ต้องรับ `null` ตรงๆ และเก็บเป็น `NULL` ใน DB (ไม่ใช่ empty string) form บันทึกตอน submit เท่านั้น สีบันทึกพร้อม submit เดียวกับชื่อ ไม่มี PATCH ระหว่างเลือก swatch drag overlay ได้ `color` มาจาก store โดยอัตโนมัติไม่ต้อง prop เพิ่ม

---

## 3. User Profile

**สถานะ:** Implemented
**ขอบเขต:** New Feature — ต่อจาก Kanban Board MVP
**วันที่:** 4 มิถุนายน 2026

### Problem Statement

ปัจจุบัน user ไม่มีทางดูหรือแก้ไขข้อมูลบัญชีของตนเองได้เลย — ทั้ง display name, email และ password ถูกกำหนดตอน register แล้วเปลี่ยนไม่ได้ ทำให้ user ที่พิมพ์ชื่อผิด, ต้องการเปลี่ยน email, หรืออยากเปลี่ยน password ต้องสร้างบัญชีใหม่หรือติดต่อ admin

### Solution

เพิ่มหน้า **Profile** ที่ให้ user แก้ไขข้อมูลส่วนตัวได้ โดยแบ่งเป็น 2 ส่วนในหน้าเดียว: (1) แก้ `displayName` และ `email` (2) เปลี่ยน password (ต้องยืนยัน current password ก่อน) เข้าถึงได้จาก dropdown ใน TopBar และ route `/profile` โดยตรง การแก้ไขสำเร็จจะอัปเดต TopBar ทันทีโดยไม่ต้อง refresh หน้า

### User Stories

1. As a registered user, I want to view my current display name and email on a profile page, so that I can verify my account details.
2. As a registered user, I want to edit my display name, so that teammates see the correct name on the board.
3. As a registered user, I want to change my email address, so that I can keep my login credentials up to date.
4. As a registered user, I want to be notified immediately if the new email is already taken, so that I can try a different email without waiting.
5. As a registered user, I want to change my password by confirming my current password first, so that my account stays secure even if someone else accesses my session.
6. As a registered user, I want to confirm the new password by typing it twice, so that I don't accidentally set a typo as my new password.
7. As a registered user, I want to see a success notification after saving, so that I know the change was applied.
8. As a registered user, I want to navigate to the profile page from the top bar, so that I can access it from anywhere in the app.
9. As a registered user, I want the top bar to reflect my updated display name immediately after saving, so that the UI stays consistent without needing a page refresh.
10. As a registered user, I want inline error messages on specific fields (e.g. email conflict), so that I know exactly what needs to be corrected.

### Implementation Decisions

**Backend (สร้างก่อน):** เพิ่ม 3 endpoints ใน User module ของ `kanban-board-api`:

```
GET    /users/me                → คืน { id, displayName, email }
PATCH  /users/me                → แก้ displayName / email; คืน 409 ถ้า email ซ้ำ
PATCH  /users/me/password       → body: { currentPassword, newPassword }; คืน 400 ถ้า currentPassword ผิด
```

ทุก endpoint ต้อง auth (Bearer token) `PATCH /users/me/password` ตรวจ `currentPassword` ด้วย bcrypt ก่อน hash `newPassword` ใหม่ `PATCH /users/me` คืน user object ที่อัปเดตแล้ว เพื่อให้ frontend sync state ได้ใน response เดียว

*(หมายเหตุ: endpoint จริงที่ implement ใช้ path `/auth/me` และ `/auth/me/password` ไม่ใช่ `/users/me` — ดู [CLAUDE.md](../CLAUDE.md) "Profile endpoints")*

**Frontend — Session Store:** เพิ่ม `displayName` และ `email` เข้า `useSession` store โหลด `GET /auth/me` ครั้งแรกหลัง token valid (app start / after login) `PATCH /auth/me` สำเร็จ → update store ทันที → TopBar re-render อัตโนมัติ

**Frontend — Routing:** เพิ่ม route `/profile` ที่ต้องผ่าน auth guard (เช่นเดียวกับ `/boards`)

**Frontend — TopBar Dropdown:** เพิ่ม dropdown เมื่อคลิก avatar/ชื่อใน TopBar มีรายการ: Profile, Logout

**Frontend — Profile Page Layout:**

*Section 1 — ข้อมูลส่วนตัว:* Field `displayName` (non-empty, ≤ 100 chars), Field `email` (valid email format), inline error ใต้ field `email` เมื่อ backend คืน 409, ปุ่ม "บันทึก" submit เฉพาะ section นี้

*Section 2 — เปลี่ยนรหัสผ่าน:* Field `currentPassword`, Field `newPassword` (≥ 8 ตัวอักษร), Field `confirmPassword`, client-side validate `newPassword === confirmPassword` และ length ≥ 8 ก่อนส่ง API, inline error ถ้า `currentPassword` ผิด (backend 400), ปุ่ม "เปลี่ยนรหัสผ่าน" submit เฉพาะ section นี้

**Validation:**

| Field | Rule |
|---|---|
| `displayName` | non-empty, ≤ 100 chars (client + backend) |
| `email` | valid format (client), unique (backend 409) |
| `newPassword` | ≥ 8 chars (client + backend) |
| `confirmPassword` | === `newPassword` (client only) |

**Feedback Pattern:** สำเร็จ → toast notification (เหมือน pattern ที่ใช้ใน app) Field error (409 email, 400 wrong password) → inline error ใต้ field นั้น

### Testing Decisions

**หลักการ:** test พฤติกรรมที่ user มองเห็น ไม่ test implementation detail

**Backend Unit / Integration Tests:** `GET /auth/me` คืน user ที่ถูกต้อง, 401 ถ้าไม่มี token; `PATCH /auth/me` อัปเดต displayName สำเร็จ, คืน 409 ถ้า email ซ้ำ; `PATCH /auth/me/password` เปลี่ยนได้เมื่อ currentPassword ถูก, คืน 400 ถ้าผิด

**Frontend Unit Tests:** Validation logic — `confirmPassword`, password length — pure function test เหมือน `src/domain/`

**E2E Tests (Playwright)** ใน `e2e/profile.spec.js`: เปลี่ยน displayName → TopBar แสดงชื่อใหม่ทันที, persist หลัง refresh; พยายามเปลี่ยน email เป็นที่ซ้ำ → เห็น inline error; เปลี่ยน password ด้วย current password ถูก → login ด้วย password ใหม่ได้; พยายามเปลี่ยน password ด้วย current password ผิด → เห็น error

Prior art: `e2e/auth.spec.js`, `e2e/board.spec.js`

### Out of Scope

Avatar upload / รูปโปรไฟล์; การลบบัญชี; Notification preferences; Two-factor authentication; OAuth / social login; Admin ดูหรือแก้ไข profile ของ user คนอื่น

### Further Notes

Backend ต้องสร้างก่อน frontend — ไม่ใช้ mock API เพื่อหลีกเลี่ยง rework `GET /auth/me` ควรถูกเรียกตอน app start (หลัง token validate) ไม่ใช่เฉพาะตอนเปิดหน้า Profile เพื่อให้ TopBar แสดงชื่อได้ถูกต้องตั้งแต่แรก

---

## 4. Subtasks (Checklist)

**สถานะ:** Implemented
**ขอบเขต:** New Feature — ต่อจาก Kanban Board MVP
**วันที่:** 5 มิถุนายน 2026

### Problem Statement

ปัจจุบัน card แต่ละใบมีแค่ title, description, assignee, due date และ labels — ไม่มีวิธีแตก card ใบหนึ่งเป็น step ย่อยๆ ที่ track ได้ ทีมต้องใช้ description แบบ freetext เพื่อจดรายการงาน ซึ่ง track ความคืบหน้าได้ยาก และมองจาก board view ไม่เห็นเลยว่างานใน card นั้นทำไปถึงไหนแล้ว

### Solution

เพิ่ม **subtask checklist** ใน card แต่ละใบ โดยแสดงรายการงานย่อยพร้อม checkbox ใน CardPanel และแสดง progress summary (`✓ checked / total`) บน card preview บน board เพื่อให้ทีมเห็น status ของงานได้ในทันทีโดยไม่ต้องเปิด panel

### User Stories

1. As a board member, I want to see a subtask checklist section inside a card's panel, so that I can view all the steps needed to complete the card.
2. As a board member, I want to add a subtask by clicking "+ Add subtask" and typing in an inline input, so that I can quickly build up a checklist without leaving the card panel.
3. As a board member, I want to confirm a new subtask by pressing Enter, so that I can add multiple subtasks in rapid succession.
4. As a board member, I want to cancel adding a subtask by pressing Escape, so that I can dismiss the input without creating an unwanted subtask.
5. As a board member, I want to tick a subtask checkbox to mark it as done, so that I can track which steps have been completed.
6. As a board member, I want the checkbox state to update instantly without waiting for a server round-trip, so that the checklist feels responsive.
7. As a board member, I want a ticked subtask to visually distinguish itself (e.g. strikethrough title), so that done items are clearly separated from pending ones.
8. As a board member, I want to click an existing subtask title to edit it inline, so that I can fix typos without deleting and recreating the subtask.
9. As a board member, I want to confirm an edited subtask title by pressing Enter, so that my change is saved immediately.
10. As a board member, I want to cancel an edit by pressing Escape, so that my original title is preserved if I change my mind.
11. As a board member, I want to reorder subtasks using up/down buttons next to each item, so that I can arrange the steps in logical order.
12. As a board member, I want to delete a subtask with a delete button, so that I can remove steps that are no longer needed.
13. As a board member, I want to see a progress indicator (`✓ 3 / 5`) on the card preview on the board, so that I can gauge how complete a card is without opening the panel.
14. As a board member, I want the progress indicator to update immediately when I tick a checkbox, so that the board view always reflects the current state.
15. As a board member, I want the subtask list to sync with what other teammates are doing (via board polling), so that I see their changes within 10 seconds without refreshing.
16. As a board member, I want to be warned if I try to add more than 20 subtasks, so that I know to break the work into multiple cards instead.
17. As a board member, I want each subtask title to be validated (non-empty, ≤ 100 characters), so that I get clear feedback if my input is invalid.
18. As a board member, I want subtasks to persist after a page reload, so that no work is lost when I close and reopen the browser.
19. As a board member, I want subtasks to be deleted automatically when their parent card is deleted, so that no orphaned data accumulates.
20. As a board member, I want the subtask section to appear only when the card has at least one subtask or I am viewing the card's panel, so that the board is not cluttered for cards with no subtasks.

### Implementation Decisions

**Schema** — เพิ่ม table `subtasks` ใน migration ใหม่:

```
subtasks (
  id          UUID PK,
  card_id     UUID FK → cards(id) ON DELETE CASCADE,
  title       TEXT NOT NULL,
  checked     BOOLEAN NOT NULL DEFAULT false,
  position    DOUBLE PRECISION NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
)
```

`position` ใช้ fractional float เหมือน `cards.position` และ `columns.position` เพื่อ reuse `positionBetween` utility ไม่มี `updated_at` เพราะ subtask ไม่ต้องการ audit trail

**API Endpoints:**

```
POST   /cards/:cardId/subtasks      body: { title }         → 201 subtask
PATCH  /subtasks/:id                body: { title?, checked?, position? } → 200 subtask
DELETE /subtasks/:id                                         → 204
```

ทุก endpoint ต้อง auth (Bearer token) และตรวจว่า user เป็น board member ผ่าน card → column → board chain เหมือนที่ cards route ทำอยู่ `POST` validate title (non-empty, ≤ 100 chars) และ count ≤ 20 ต่อ card `PATCH` รับ partial patch (title เท่านั้น หรือ checked เท่านั้น หรือ position เท่านั้น ก็ได้)

**Board Snapshot:** `GET /boards/:id` เพิ่ม subtasks ต่อ card ใน nested shape (`columns[].cards[].subtasks: [{ id, title, checked, position }]`) Frontend flatten ใน `client.js` เหมือนกับ `cardLabels` — store `subtasks[]` แบน indexed by `cardId`

**Ordering:** Reuse `positionBetween(prev, next)` จาก `domain/ordering` — เมื่อกด ↑ หรือ ↓ คำนวณ position ใหม่ระหว่าง adjacent items แล้ว PATCH ตัวนั้นตัวเดียว (ไม่ต้อง reorder ทั้งหมด) เหมือน card move

**Optimistic Update Pattern:** Checkbox toggle ใช้ pattern เดียวกับ `useBoardStore` ทั้งหมด: (1) Snapshot state ปัจจุบัน (2) Apply เปลี่ยน `checked` ใน store ทันที (3) PATCH ไป API (4) Rollback ถ้า API ตอบ error Create/delete/rename ก็ใช้ optimistic pattern เดียวกัน

**Validation (client-side)** — เพิ่มฟังก์ชันใน `domain/validation`: `validateSubtaskTitle(title)` (non-empty, ≤ 100 chars), `validateSubtaskCount(currentCount)` (error ถ้า count ≥ 20) รันฝั่ง client เพื่อ UX และ backend enforce เป็น authoritative

**Card Preview:** บน card preview (board view) แสดง `✓ checked / total` เมื่อ card มี subtask อย่างน้อย 1 ตัว วาง metadata row เดียวกับ due date และ assignee avatar ถ้า total = 0 ไม่แสดงอะไร *(ภายหลังใน editorial redesign หัวข้อ 6 เปลี่ยนเป็น adaptive segments/mini-bar ผ่าน `domain/progress.js`)*

**CardPanel UI:** ส่วน subtask แสดงหลัง DueDateField รายการ subtask แต่ละตัว: `[ checkbox ] [ title / inline-input ] [ ↑ ] [ ↓ ] [ ✕ ]` กด title → เปิด inline edit (Enter=save, Escape=cancel) "+ Add subtask" ด้านล่าง → inline input (Enter=save, Escape=dismiss) ถ้า count ถึง 20: ซ่อน button + แสดง hint "Maximum 20 subtasks per card"

### Testing Decisions

**หลักการ:** Test external behavior เท่านั้น — ไม่ test internal state หรือ implementation details ใน store ยกเว้น module ที่เป็น pure function

**Modules ที่ Unit Test:** `domain/validation` (pure function ที่ test ง่ายและมีค่ามาก) — `validateSubtaskTitle` กับ input ขอบเขตต่างๆ (empty, 100 chars, 101 chars, whitespace only), `validateSubtaskCount` กับ 0, 19, 20, 21 Prior art: `src/domain/validation.test.js`

**Modules ที่ Integration Test (Backend):** Subtasks route ผ่าน supertest เหมือน `cards.test.js` — `POST /cards/:id/subtasks` (happy path, title validation, count limit, member check, 404), `PATCH /subtasks/:id` (toggle checked, rename, move position, non-member → 403), `DELETE /subtasks/:id` (happy path, non-member → 403) Prior art: `src/routes/cards.test.js`

**Modules ที่ไม่ Unit Test:** `useBoardStore` subtask actions, CardPanel component, Card progress indicator — ครอบคลุมโดย E2E

**E2E Tests (Playwright)** ใน `e2e/subtask.spec.js`: สร้าง subtask → persist หลัง reload; tick checkbox → progress indicator อัปเดต; rename subtask → เห็นชื่อใหม่; reorder ด้วย ↑/↓ → ลำดับ persist หลัง reload; ลบ subtask → หายจาก list; สร้างครบ 20 → "+ Add subtask" ซ่อน

### Out of Scope

Subtask assignee หรือ due date (subtask คือ checklist ไม่ใช่ mini-card); Drag-and-drop reorder (ใช้ up/down button แทน); Subtask-level notifications หรือ activity log; Cross-card subtask search/filter; Subtask templates หรือ copy from another card; Completion percentage บน board list page

### Further Notes

ถ้า card ถูก delete, subtasks cascade delete อัตโนมัติผ่าน `ON DELETE CASCADE` — ไม่ต้อง handle ใน application layer `positionBetween` จาก `domain/ordering` reuse ได้ตรงๆ สำหรับ ↑/↓ reorder — backend ไม่ต้อง rebalance เพราะ up/down move ทีละ 1 ไม่ทำให้ gap แคบขนาด < 1e-9 ยกเว้น edge case ที่ list ยาวมาก (> 50 moves ในตำแหน่งเดิม) ซึ่งต่ำกว่า limit 20 subtasks มาก Progress indicator บน card preview ต้องการแค่ `subtask_count` และ `checked_count` — แต่เนื่องจาก board snapshot รวม subtask objects ทั้งหมดแล้ว ให้คำนวณ count ใน frontend แทนที่จะส่ง count แยก

---

## 5. Card Color Bands (Superseded by Card Editorial Redesign)

> **หัวข้อนี้ถูกแทนที่แล้วโดยหัวข้อ 6 (Card "Editorial" Redesign) และ [ADR-0002](../docs/adr/0002-card-editorial-model.md)** โมเดล "แถบสีบนสุด = label แรก" ด้านล่างถูกแทนที่ด้วยโมเดล **Category** (label ที่เลือกเป็นตัวหลัก แสดงเป็นจุดสี + ชื่อพิมพ์ใหญ่ ไม่ใช่แถบเต็มความกว้าง)

**สถานะ:** Superseded

### Problem Statement

The Kanban board currently displays all cards with a uniform white background and small 6px-tall colored label dots. This makes the board visually flat — users cannot quickly distinguish cards by category or priority at a glance. The board lacks the visual richness needed to scan a busy board efficiently.

### Solution (โมเดลเดิม — ล้าสมัยแล้ว)

Extend the existing label system so that a card's first label color is promoted into a full-width colored band at the top of the card. Cards with no labels remain unchanged. Remaining labels (2nd onward) continue to display as small dots below the band. No database changes are required — this is a pure frontend visual enhancement.

### User Stories (เดิม)

1. As a board member, I want cards with labels to display a colored band at the top, so that I can identify a card's category at a glance without reading its title.
2. As a board member, I want the color of the band to match the card's first label color, so that the existing label system I already understand continues to drive the visual encoding.
3. As a board member, I want cards without any labels to look the same as before (no band), so that the layout does not feel broken for unlabeled cards.
4. As a board member, I want to see remaining labels (2nd, 3rd, etc.) as small dots below the colored band, so that I do not lose visibility of secondary labels.
5. As a board member, I want the colored band to span the full width of the card, so that the color accent is immediately visible even when scanning quickly.
6. As a board member, I want columns to remain visually neutral (no color treatment), so that the card colors are the clear focal point of color on the board.
7. As a board member, I want the colored band to be consistent across all views where the card preview is shown (board view), so that the visual encoding is reliable.
8. As a board member dragging a card, I want the colored band to remain visible on the drag overlay, so that the card is still recognizable while being moved.

### Implementation Decisions (เดิม)

**Module: Card component (frontend only)** — module เดียวที่เปลี่ยนคือ Card preview component และ stylesheet ไม่มี store, API, หรือ database เปลี่ยน

**Rendering logic (เดิม):** ถ้า `card.labels` มีอย่างน้อย 1 รายการ render แถบสีเต็มความกว้างด้านบนของ card โดยใช้ `labels[0].color` เป็นพื้นหลัง ถ้า `card.labels` ว่างหรือ undefined ไม่ render แถบ (card หน้าตาเหมือนเดิมทุกประการ) `labelBar` (จุดสีเล็ก) แก้ให้ render เฉพาะ label ที่ index 1 ขึ้นไป ถ้ามี label เดียวไม่แสดง dot bar เลย

**Band visual spec (เดิม):** เต็มความกว้าง card, สูง ~10px, border-radius มุมบนซ้าย-ขวาให้ตรงกับ border-radius ของ card เอง ไม่มี text/icon — เป็นแค่ decorative

**Drag overlay (เดิม):** `.overlay` class ครอบ card ทั้งใบอยู่แล้ว ไม่ต้องจัดการพิเศษ แถบ render อยู่ข้างในโดยธรรมชาติ

**Overdue state (เดิม):** overdue treatment (ขอบซ้ายแดง + พื้นหลังแดงอ่อน) เป็นอิสระจาก color band ทั้งสองอยู่ด้วยกันได้ — band อยู่บนสุด overdue border อยู่ซ้าย

**ไม่แตะ:** `useBoardStore.js`, `client.js`, `CardPanel.jsx`, `Column.jsx`/`BoardPage.jsx`, database schema

### Testing Decisions (เดิม)

Test rendered output สำหรับ label configuration ต่างๆ — ไม่ test internal state Assert DOM structure และ inline styles Card component rendering logic ครอบคลุมโดย E2E (Playwright) ไม่ใช่ unit test ไม่มี unit test ใหม่ — logic (`labels.length`, slice `labels[1..]`) เป็นเรื่องเล็กน้อยและถูกคลุมโดย E2E ครบแล้ว

### Out of Scope (เดิม)

Column colors (คอลัมน์ยังเป็นกลาง — ข้อนี้เองที่ ADR-0001 พลิกกลับภายหลัง); Per-card custom color อิสระ; Card body tinting; Colored header with card ID; Color picker changes; Database/API changes; Dark mode

### Further Notes (เดิม)

Label order บน card ตามลำดับใน `cardLabels[]` จาก store ซึ่งสะท้อนลำดับที่ label ถูกติด "label แรก" คือ `labels[0]` ใน array นี้ — ไม่มี sorting/priority logic เพิ่ม ฟีเจอร์นี้เป็น cosmetic ล้วนๆ ไม่กระทบ drag-and-drop, polling, optimistic update หรือระบบพฤติกรรมอื่น

---

## 6. Card "Editorial" Redesign (Option C)

**สถานะ:** Implemented
**Design source:** [card_ui_spec.md](card_ui_spec.md) · artboard: [Option C - Editorial.png](Option%20C%20-%20Editorial.png)
**Decisions of record:** [ADR-0002](../docs/adr/0002-card-editorial-model.md) (redesign นี้), [ADR-0001](../docs/adr/0001-column-accent-model.md) (column accent, ไม่เปลี่ยน)
**Glossary:** [CONTEXT.md](../CONTEXT.md) — คำว่า **Category**, **Card Accent**, **Assignee** (ตอนนี้มีได้หลายคน)

### Problem Statement

การ์ด Kanban เดิมใช้งานได้แต่ดูแบนราบทางสายตา — แถบสีที่มาจาก label "แรก" แบบสุ่มๆ, title ธรรมดา, และข้อความ `✓ n / total` ผู้ใช้บอกไม่ได้ในแวบแรกว่างานชนิดไหน บอร์ดขาดการจัดกลุ่มทางสายตา และการ์ดหนึ่งใบแสดง assignee ได้แค่คนเดียวแม้จะมีหลายคนช่วยกันทำ ทีมต้องการบอร์ดที่สงบตากว่า อ่านง่ายกว่า เน้นประเภทงาน ("editorial") อ่านลื่นทั้งภาษาไทยและอังกฤษ สื่อสาร category และ progress ได้ทันที และสะท้อนว่างานมักถูกแชร์กันทำ

### Solution

รีดีไซน์การ์ดและ board shell ให้เป็นภาษาดีไซน์ "Option C / Editorial":

- แต่ละการ์ดนำด้วย **Category ตัวพิมพ์ใหญ่** (จุดสี + label) — Category คือ **Label หลัก** ที่การ์ดเลือกไว้ ไม่ได้เพิ่ม concept การแท็กใหม่
- **accent ของการ์ด** (จุด, ข้อความ category, แถบ progress) คือสีของ Category label เอง ทำให้บอร์ดยังคงจัดกลุ่มทางสายตาได้ — category เดียวกัน = สีเดียวกัน
- **foot ที่คั่นด้วยเส้นบาง (hairline)** แสดง due date (มี "ไม่มีกำหนด" สีจางเมื่อไม่มี) ทางซ้าย และ **adaptive checklist progress** ทางขวา (segment แยกชิ้นสำหรับ list สั้น, mini-bar ต่อเนื่องสำหรับ list ยาว)
- แถวบนสุดมี **assignee avatar ซ้อนกัน** (สูงสุด 3 แล้ว `+N`) สะท้อนว่าการ์ดหนึ่งใบมี **หลาย assignee** ได้แล้ว
- Column ยังคง **Accent** ที่ผู้ใช้ตั้งเอง (ADR-0001) แต่ปรับให้เข้ากับ editorial palette: wash อ่อนทั้งคอลัมน์, name pill, และตัวนับ Typography เปลี่ยนเป็น **IBM Plex Sans Thai**

พฤติกรรมเดิมทั้งหมด (drag-and-drop, optimistic update, polling, card detail `CardPanel`, การจัดการ label, subtasks, due-date picker) ยังคงเดิม

### User Stories

1. As a board member, I want each card to show an uppercase Category with a colored dot, so that I can tell at a glance what kind of work it is.
2. As a board member, I want cards of the same Category to share the same accent color, so that the board reads as visually grouped.
3. As a board member, I want to choose which of a card's labels is its Category, so that the most meaningful label is the one featured on the card face.
4. As a board member, I want a card with no Category to fall back to a neutral gray accent, so that uncategorized cards still look intentional.
5. As a board member, I want to keep attaching multiple labels to a card, so that I don't lose multi-tagging when only one is shown on the face.
6. As a board member, I want the non-category labels to remain visible and editable in the card detail panel, so that the extra labels are still useful.
7. As a board member, I want the card title to be the visual hero (large, legible), so that I can scan tasks quickly.
8. As a Thai-speaking user, I want Thai and Latin text to render cleanly without clipped descenders, so that the board is comfortable to read.
9. As a board member, I want the card to show a due date with a calendar icon, so that I know when work is due.
10. As a board member, I want an overdue card's due date shown in red, so that late work stands out.
11. As a board member, I want a card with no due date to show a muted "ไม่มีกำหนด", so that the absence of a deadline is explicit rather than blank.
12. As a board member, I want the due date shown in Thai Buddhist-era format (e.g. 15 มิ.ย. 2569), so that it matches local conventions.
13. As a board member, I want a checklist with ≤ 8 subtasks shown as discrete segments, so that I can see exactly how many are done.
14. As a board member, I want a checklist with > 8 subtasks shown as a continuous mini-bar, so that the indicator never overflows the card.
15. As a board member, I want the progress count (done/total) always shown, so that the exact numbers are available.
16. As a board member, I want the count to turn green when all subtasks are complete, so that finished work is obvious.
17. As a board member, I want to assign more than one member to a card, so that shared work is represented accurately.
18. As a board member, I want assignee avatars stacked with overlap on the card face, so that multiple owners fit compactly.
19. As a board member, I want at most three avatars then a "+N" chip, so that a heavily-assigned card stays readable.
20. As a board member, I want to add and remove assignees from the card detail panel, so that I can manage ownership over time.
21. As an existing user, I want my current single assignee preserved after the upgrade, so that no ownership data is lost in the migration.
22. As a board member, I want each column tinted by its accent across the whole column, so that columns are visually distinct (per ADR-0001).
23. As a board member, I want a column with no accent to use a neutral gray, so that uncolored columns look clean.
24. As a board member, I want the column header to show a name pill and card count, so that I can orient quickly.
25. As a board member, I want the "+ New card" composer and "+ Add column" affordances retained, so that creating work still flows as before.
26. As a board member, I want to drag cards between columns exactly as before, so that the redesign doesn't regress drag-and-drop.
27. As a board member, I want clicking a card to open the existing detail panel, so that editing behavior is unchanged.
28. As a board member, I want the top bar restyled (back link, board name, current-user avatar, Invite), so that the shell matches the editorial look.
29. As a board member, I want a subtle hover lift on cards, so that the card feels interactive.
30. As a board member, I want my optimistic edits (category, assignees) to roll back on server error, so that the UI never lies about saved state.

### Implementation Decisions

**Domain model (ดู [ADR-0002](../docs/adr/0002-card-editorial-model.md)):**

- **Category = Label หลักของการ์ด** — FK ใหม่ `category_label_id` (nullable, `ON DELETE SET NULL`) บน `cards` ไม่มี entity Category แยกต่างหาก Labels ยังเป็น many-to-many หน้าการ์ดโชว์แค่ Category ที่เหลืออยู่ใน `CardPanel`
- **Card Accent = สีของ Category label** ไม่มีฟิลด์สีแยกต่อการ์ด derive shade ด้วย CSS `color-mix` (solid = hex ตรงๆ; text = `color-mix(hex, black ~35%)`) ตามแนวทางเดียวกับ column ใน ADR-0001 ไม่มี category → เทากลาง
- **Multiple assignees** แทนที่ `assignee_id` เดี่ยว — join table ใหม่ `card_assignees`; `assignee_id` เดิม backfill เข้า table นี้แล้ว drop คอลัมน์
- **due date แดง = overdue** (`isOverdue` เดิม) บวกสถานะ "ไม่มีกำหนด" สีจาง ไม่มี concept "ใกล้ครบกำหนด"
- **Column ไม่เปลี่ยน model** (ADR-0001 ยังใช้) มีแค่ค่า `color-mix` ที่ปรับใหม่

**Modules ที่ build/modify:**

- `domain/progress.js` *(ใหม่, deep, pure)* — `progressView(done, total)` → `{ mode: 'segments' | 'minibar', segments: boolean[], pct, complete }` `SEG_MAX = 8`
- `domain/accent.js` *(ใหม่, deep, pure)* — resolve Category label ของการ์ดจาก `categoryLabelId` + labels ของบอร์ด คืนสีหรือ fallback กลาง
- `domain/colors.js` — refresh `PRESET_COLORS` เป็น editorial pastel ตามสเปก (OKLCH แปลงเป็น hex) ยังรองรับ custom color
- `domain/dates.js` — formatting ไม่เปลี่ยน; สถานะ "ไม่มีกำหนด" render ที่ component
- `store/useBoardStore.js` — action optimistic ใหม่ `setCardCategory(cardId, labelId|null)`, `attachAssignee(cardId, userId)`, `detachAssignee(cardId, userId)` ใช้ helper `optimistic()` เดิม (snapshot → apply → commit → settle → rollback) เอา single-assignee patch path เดิมออก
- `api/client.js` — `normalizeCard()` เพิ่ม `categoryLabelId` และ `assignees[]`; `cardPatchToApi()` เพิ่ม `category_label_id`; `attachAssignee`/`detachAssignee` ใหม่ (คล้าย `attachLabel`/`detachLabel`); board snapshot normalization รวมฟิลด์ใหม่
- Components — `Card.jsx` (เขียนใหม่เป็น editorial DOM: top row, title, hairline, foot), `Column.jsx` (ปรับ tint/pill), `CardPanel.jsx` (เลือก Category + multi-assignee), `AssigneePicker.jsx` (single → multi-select), `AvatarStack` ใหม่ (ซ้อน + `+N`), `LabelPicker.jsx` (ทำเครื่องหมายว่า label ไหนเป็น Category), `TopBar.jsx`/board shell restyle `data-testid` เดิมยังอยู่
- Typography — โหลด IBM Plex Sans Thai + IBM Plex Sans (weight 400/500/600/700), ตั้ง `--font` และ antialiasing

**Backend (`kanban-board-api`):** Migration เพิ่ม `cards.category_label_id` (nullable FK, `ON DELETE SET NULL`) Migration สร้าง join `card_assignees (card_id, user_id)`; backfill จาก `assignee_id`; drop `assignee_id` API: `PUT /cards/:id/assignees/:userId`, `DELETE /cards/:id/assignees/:userId` (คล้าย labels); `PATCH /cards/:id` รับ `category_label_id` (id หรือ null); board snapshot คืน `category_label_id` และ `assignees` array ต่อการ์ด Authorization ไม่เปลี่ยน (board membership)

### Testing Decisions

เทสต์ที่ดี = ยืนยัน **พฤติกรรมภายนอก** ไม่ใช่ implementation detail: ให้ input แล้ว assert ค่าที่คืน/state ที่ได้ ไม่ assert internal call หรือ DOM structure เกินกว่า `data-testid`/role hook ที่คงที่

- **`domain/progress.js`** — unit-test ตรงๆ: boundary ที่ `total = 8` vs `9` (segments vs mini-bar), `done = 0`, `done = total` (complete flag), `pct` rounding, `total = 0` Prior art: `domain/validation.test.js`, `domain/dates.test.js`
- **`domain/accent.js`** — unit-test: resolve category จาก `categoryLabelId`, missing/deleted category id → fallback กลาง, ไม่มี label → fallback Prior art: pure-domain test เดียวกัน
- **Store actions (`setCardCategory`, `attachAssignee`, `detachAssignee`)** — unit-test ผ่าน `useBoardStore.getState()` กับ `jest.mock('../api/client')` assert optimistic apply → settle และ rollback เมื่อ reject Prior art: `store/useBoardStore.test.js`
- **E2E (Playwright)** — อัปเดต `card.spec.js`, `dnd.spec.js`, `subtask.spec.js`, `column-color.spec.js` ให้ตรงกับ DOM ของการ์ดใหม่ เพิ่ม coverage สำหรับเลือก Category (accent ปรากฏบนหน้าการ์ด) และเพิ่ม assignee คนที่สอง (avatar ซ้อน) Selector อิง `data-testid` เดิม

ไม่ unit-test: presentational component (ครอบคลุมโดย E2E), CSS `color-mix` derivation (เชิง visual, ครอบคลุมโดย E2E chip/accent assertion)

### Out of Scope

Category เป็น entity แยกต่างหาก (Category คือ primary Label — ดู ADR-0002); ยุบ label ให้เลือกได้ตัวเดียว (multi-tagging ยังอยู่); สีต่อการ์ดอิสระจาก Category; concept "ใกล้ครบกำหนด / due within N days" (มีแค่ overdue + no-due); จำกัด label color ให้เหลือ 6 hue OKLCH ตามสเปก (custom hex ยังใช้ได้); โชว์ label ที่ไม่ใช่ category บนหน้าการ์ด (อยู่ใน `CardPanel` เท่านั้น); default tint ต่อตำแหน่งคอลัมน์ที่ไม่มี accent (ใช้เทากลางแทน); เปลี่ยน auth, polling, subtasks behavior, หรือ board-snapshot transport เกินกว่าฟิลด์ใหม่

### Further Notes

หัวข้อนี้แทนที่การตัดสินใจ "แถบสีการ์ด = label แรก" (หัวข้อ 5) Artboard ที่มี 4 คอลัมน์ตายตัว (ideas/todo/doing/done) และฟิลด์ `assignees[]`/`color`/`label` เป็น **demo data** ไม่ใช่ data model จริง — model จริงกำหนดในหัวข้อนี้และ ADR-0002 `formatDueDate` ให้ปีพุทธศักราชผ่าน `th-TH` อยู่แล้ว ไม่ต้องแก้ date logic Migration ต้องรันก่อน frontend deploy เพราะ `normalizeCard` จะอ่านฟิลด์ใหม่

---

## 7. Label Color Picker — Pastel Presets

**สถานะ:** Implemented

### Problem Statement

เมื่อสร้าง label ผู้ใช้ต้องพิมพ์ hex color code เองหรือใช้ native color picker widget ซึ่งยุ่งยาก — ผู้ใช้ส่วนใหญ่ต้องการแค่ชุดสีที่แตกต่างและอ่านง่ายจำนวนน้อย ตัว picker แบบ free-form เดิมไม่มีคำแนะนำใดๆ ผลคือสี label ไม่สม่ำเสมอและเพิ่ม friction ให้ workflow ที่ควรง่าย

### Solution

แทนที่ color picker แบบ free-form เดิม (native `<input type="color">` + ช่องกรอก hex) ด้วยแถว swatch สี pastel 8 สี แต่ละ swatch เป็นวงกลม 24px แตะเลือกได้ทันที swatch ที่ 9 เป็น "+" เปิด native color picker สำหรับผู้ที่ต้องการสีกำหนดเอง ไม่มีช่องกรอก hex text แสดง

### User Stories

1. As a board member, I want to see 8 pastel color swatches when creating a label, so that I can pick a color in one click without thinking about hex codes.
2. As a board member, I want the swatches to be pastel tones, so that label colors look soft and consistent on cards rather than harsh or saturated.
3. As a board member, I want the selected swatch to have a visible ring around it, so that I always know which color is currently chosen.
4. As a board member, I want the ring indicator to appear outside the swatch circle, so that the swatch color itself is fully visible and not obscured.
5. As a board member, I want a "+" swatch as the ninth option, so that I can still choose a custom color if none of the presets suits my needs.
6. As a board member, I want clicking "+" to open the native color picker, so that I can pick any color without leaving the panel.
7. As a board member, I want the "+" swatch to reflect the custom color I picked, so that I can see which custom color is active at a glance.
8. As a board member, I want no hex text input to be visible by default, so that the label creation form is clean and fast to use.
9. As a board member, I want a preset swatch to be pre-selected when I open the create form, so that I can submit immediately without having to make a color choice first.
10. As a board member, I want the color swatches to be large enough to tap easily, so that I can use the picker comfortably on a laptop trackpad or touchscreen.
11. As a board member editing an existing label, I want the correct swatch to be highlighted if the label's current color matches a preset, so that I know which preset was used.
12. As a board member editing an existing label, I want the "+" swatch to be highlighted if the label's current color is a custom (non-preset) value, so that I can see it was customised.

### Implementation Decisions

**Module: LabelPicker component (frontend only)** — เปลี่ยนแค่ LabelPicker component และ stylesheet ไม่มี store, API, หรือ database เปลี่ยน — field `color` ของ label ยังเก็บเป็น hex string (`#rrggbb`) เหมือนเดิม

**Preset palette (8 สี):**
```
#fca5a5  (pastel red/pink)
#fdba74  (pastel orange)
#fde047  (pastel yellow)
#86efac  (pastel green)
#67e8f9  (pastel cyan)
#93c5fd  (pastel blue)
#c4b5fd  (pastel purple)
#f9a8d4  (pastel rose)
```

**Swatch row layout:** 9 swatch เรียงแถวแนวนอน gap สม่ำเสมอ swatch 1–8: วงกลมทึบ 24px หนึ่งสีต่อ preset swatch 9: วงกลม 24px สไตล์ปุ่ม "+" เติมด้วยสี custom ปัจจุบันถ้าเลือกไว้ ไม่งั้นเทากลาง

**Selection ring:** swatch ที่เลือกได้ `outline` ring rendered ด้านนอกวงกลม (ไม่ใช่ด้านใน เพื่อไม่บังสี) เลือกได้ทีละ 1 เท่านั้น คลิก preset → อัปเดตสีทันที คลิก "+" → เปิด hidden `<input type="color">` ผ่าน `.click()` แบบ programmatic แล้วอัปเดตสีตามที่ผู้ใช้เลือก

**Default selected color:** ตอนเปิดฟอร์มสร้างใหม่ preset แรก (`#fca5a5`) ถูกเลือกไว้ล่วงหน้า ตอนเปิดฟอร์มของ label เดิม swatch ที่ตรงกับสีปัจจุบันจะถูก highlight ถ้าไม่ตรง preset ไหนเลย "+" จะถูก highlight แทน

**Removed elements:** `<input type="color">` เดิมที่เคยโชว์ในฟอร์มถูกแทนด้วย trigger "+" (native picker ยังใช้อยู่ แต่เป็น hidden element ที่ trigger ผ่านคลิก "+") ช่องกรอก hex text ถูกเอาออกทั้งหมด

**Validation:** เรียก `validateLabelColor()` เดิมก่อน submit เหมือนเดิม ไม่เปลี่ยน validation logic

### Testing Decisions

Test rendered output สำหรับ color input ต่างๆ — ไม่ test internal state transition assert ว่า swatch ที่ถูกต้องได้ selection-ring class และฟอร์ม submit ด้วยค่า hex ที่ถูกต้อง LabelPicker rendering ครอบคลุมโดย E2E (Playwright) สอดคล้องกับการตัดสินใจไม่ unit-test React component แยกเดี่ยว

E2E ที่เกี่ยวข้อง: เปิด card → คลิก "+ Create label" → assert เห็น 9 swatch → คลิก preset → assert ได้ ring → submit → assert label ถูกสร้างด้วยสีที่ถูกต้อง ไม่มี unit test ใหม่ — preset array เป็น constant ธรรมดา และ `validateLabelColor()` ที่ guard เส้นทาง submit unit-test อยู่แล้วใน `domain/validation.test.js`

### Out of Scope

การเพิ่ม/เปลี่ยน 8 preset สี (palette ตายตัว); โชว์ hex readout; แก้สีของ label ที่มีอยู่แล้ว (PRD นี้ครอบคลุมแค่ตอนสร้างใหม่); custom palette ต่อบอร์ด (8 preset เป็น global); database/API changes

### Further Notes

`validateLabelColor()` เดิมรับทั้ง `#rgb` และ `#rrggbb` ที่ valid ทั้ง 8 preset เป็น hex 6 หลักผ่าน validation โดยไม่ต้องแก้ swatch "+" trigger hidden `<input type="color">` — หลีกเลี่ยง dependency กับ third-party color picker library สำหรับ custom path ค่า default ที่เลือกไว้ล่วงหน้า (`#fca5a5`) ทำให้ฟอร์มอยู่ในสถานะ valid เสมอตอนเปิด — submit ได้ทันทีหลังพิมพ์ชื่อ

---

## 8. Card Completion (Per-card Done State)

**สถานะ:** Implemented (#35–#37)
**ขอบเขต:** New Feature — ต่อจาก Editorial card redesign
**วันที่:** 15 มิถุนายน 2026
**Tracking:** [issue #34](https://github.com/khthana/kanban-board/issues/34) · [ADR-0003](../docs/adr/0003-card-completion-model.md)

### Problem Statement

เมื่อทีมทำงานใน card ใบหนึ่งเสร็จ ปัจจุบันยังไม่มีวิธีบอกว่า *card ใบนั้นเอง* เสร็จแล้ว board สื่อ "เสร็จ" ได้แค่โดยอ้อม — คือ card ไปอยู่คอลัมน์ "Done" — แต่ card หนึ่งใบเสร็จได้ไม่ว่าจะอยู่คอลัมน์ไหน สมาชิกจึงดูไม่ออกในแวบเดียวว่า card ใดเสร็จแล้ว vs ยังทำอยู่ และไม่มีการบันทึกว่า card เสร็จ *เมื่อไหร่*

### Solution

ให้ card ทุกใบมีสถานะ **เสร็จ (completion)** ที่เป็นอิสระจากคอลัมน์ สมาชิกกดทำเครื่องหมายว่าเสร็จ (หรือยกเลิก) ได้จาก panel รายละเอียดของ card; card ที่เสร็จจะถูกลดความเด่นบน board ด้วย badge ✓ และความจาง และ foot ของมันจะแสดง **วันที่ทำเสร็จ** แทน due date สถานะนี้เป็นคุณสมบัติระดับ card (ไม่ใช่ระดับคอลัมน์), persist ข้าม reload, และสมาชิกทุกคนเห็นเหมือนกัน

### User Stories

1. As a board member, I want to mark a card as completed from its detail panel, so that I can record that the work is finished.
2. As a board member, I want to un-mark a completed card, so that I can correct a mistake or reopen work.
3. As a board member, I want a completed card to show a check badge on the board, so that I can tell at a glance it is done.
4. As a board member, I want a completed card to appear faded/de-emphasised, so that finished work visually recedes behind work still in progress.
5. As a board member, I want a completed card to show the date it was completed in its footer, so that I know when the work finished.
6. As a board member, I want the completion date to replace the due date on the card face once done, so that the footer shows the date that now matters.
7. As a board member, I want a completed card to stop showing the overdue (red) styling, so that a finished-but-late card no longer looks like it needs attention.
8. As a board member, I want a completed card to keep its subtask progress indicator visible, so that I can still see how many subtasks the card had.
9. As a board member, I want the completion state to be independent of which column the card is in, so that I can mark any card done without moving it.
10. As a board member, I want a completed card to stay in its current position (not move or hide), so that the board layout I arranged is preserved.
11. As a board member, when I try to mark a card done while it still has unchecked subtasks, I want to be warned with the count of incomplete subtasks and asked to confirm, so that I do not accidentally close out unfinished work.
12. As a board member, I want to be able to override that warning and complete the card anyway, so that I am not blocked when some subtasks are no longer relevant.
13. As a board member, I want a card with no subtasks to be markable as done with no warning, so that the guard does not get in my way when it is irrelevant.
14. As a board member, I want un-marking a completed card to happen immediately with no confirmation, so that reopening is friction-free.
15. As a board member, I want the completion toggle to appear prominently at the top of the card panel, so that I can see and reach it without scrolling.
16. As a board member, I want the toggle button label to reflect the current state ("Mark as done" vs "Done on <date>"), so that the action and status are always clear.
17. As a board member, I want my completion change to appear instantly (optimistic), so that the UI feels responsive even before the server confirms.
18. As a board member, I want a failed completion update to roll back to the previous state, so that the board never shows a false "done" state.
19. As a board member, I want the completion state to persist after a page reload, so that the record is durable.
20. As another board member, I want to see completion states set by my teammates after the board refreshes, so that the whole team shares one view of what is done.
21. As a board member, I want the card face to remain clean and free of new controls, so that the editorial card design is preserved (the toggle lives only in the panel).

### Implementation Decisions

**Model:**

- **Per-card flag ไม่ใช่ column-level concept** — card มีสถานะเสร็จของตัวเอง ไม่ขึ้นกับ `column_id`; กดเสร็จไม่ย้าย card และไม่ต้องมีคอลัมน์ "Done"
- เก็บเป็น **`completed_at DATE NULL`** บน `cards` — `null` = ยังไม่เสร็จ, มีค่า = เสร็จวันนั้น boolean "done" **คำนวณจาก** `completed_at !== null` ไม่เก็บแยก
- **`DATE` ไม่ใช่ `TIMESTAMP`** — แสดงแค่ *วันที่* และ codebase มี plumbing `YYYY-MM-DD` แบบ timezone-safe เลียนแบบ `due_date` อยู่แล้ว เวลานาที/`"เสร็จเมื่อ N ชม.ก่อน"`/sort ตามเวลาจริง = deferred (ดู [ADR-0003](../docs/adr/0003-card-completion-model.md))
- **client ประทับวันที่** ส่ง `patchCard({ completedAt: toYMD(new Date()) })` ผ่าน generic `PATCH /cards/:id`; ยกเลิก = `{ completedAt: null }` ไม่มี endpoint พิเศษ ไม่ stamp `now()` ฝั่ง server

**Module ใหม่ — `domain/completion.js`** (deep module, pure, unit-tested เดี่ยว): `isDone(card)` → `!!card.completedAt`; `completionPatch(done)` → `{ completedAt: done ? toYMD(new Date()) : null }`; `incompleteSubtasks(subtasks)` → จำนวน subtask ที่ยังไม่ติ๊ก (ใช้ขับ confirm guard) reuse `domain/dates.js`; รวม logic "done" ไว้ที่เดียว ทั้ง store และ component ไม่ถือ logic นี้เอง

**Store / Client:** ไม่มี action ใหม่ — reuse `patchCard` + optimistic path เดิม (snapshot → apply → rollback); `createCard` placeholder เติม `completedAt: null` `normalizeCard` map `completed_at` → `completedAt` (slice 10 ตัว); `cardPatchToApi` map `completedAt` → `completed_at` (ส่ง `null` ผ่านเพื่อ clear)

**UI:**
- **`CardPanel`** — ปุ่มเต็มกว้างบนสุดของ body เหนือ LabelPicker ยังไม่เสร็จ: "✓ ทำเครื่องหมายว่าเสร็จ" | เสร็จแล้ว: "✓ เสร็จเมื่อ <วันที่>" + ปุ่มเล็ก "เลิกทำเครื่องหมาย" **confirm guard (soft warn):** กดเสร็จขณะ `incompleteSubtasks > 0` → `window.confirm` บอกจำนวนที่ยังไม่ครบ; ไม่มี subtask → ไม่เตือน; เลิกทำเครื่องหมาย → ไม่เตือน เป็น **client-side UX เท่านั้น**
- **`Card` (สะท้อนสถานะ ไม่ใช่ปุ่ม)** — badge ✓ ที่แถวบน + จางทั้งใบ (opacity ~0.6); foot ตอนเสร็จ: ซ้าย = วันที่เสร็จแทน due (ไม่มี overdue styling), ขวา = progress คงไว้; card อยู่ที่เดิม ไม่ย้าย/ซ่อน

**Backend (`kanban-board-api`):** migration `007_card_completed_at.sql`: `ALTER TABLE cards ADD COLUMN IF NOT EXISTS completed_at DATE NULL` `PATCH /cards/:id`: รับ `completed_at` (date string หรือ `null`) ใน dynamic SET + RETURNING; ไม่เช็ค subtask ฝั่ง server `GET /boards/:id` snapshot: คืน `completed_at` ต่อ card

### Testing Decisions

เทสต์ที่ดี = ยืนยัน **พฤติกรรมภายนอกผ่าน public interface** ไม่ใช่ implementation detail

- **`domain/completion.test.js`** (ใหม่, unit): `isDone` กรณี set/unset; `completionPatch(true)` ได้ `YYYY-MM-DD` วันนี้, `completionPatch(false)` ได้ `null`; `incompleteSubtasks` นับถูกในเคส mixed/empty/all-checked — prior art: `dates.test.js`, `accent.test.js`, `progress.test.js`
- **`useBoardStore.test.js`** (เพิ่ม, unit): `patchCard({ completedAt })` ตาม optimistic apply → settle และ rollback เมื่อ API error — prior art: เคส optimistic เดิมในไฟล์เดียวกัน
- **`cards.test.js`** (API, เพิ่ม, integration): `PATCH /cards/:id` set `completed_at` + clear กลับเป็น `null`; round-trip ผ่าน snapshot — prior art: เทสต์ `category_label_id` / `due_date` เดิม
- **`completion.spec.js`** (ใหม่, E2E): mark done จาก panel → board โชว์ ✓ + จาง + วันที่เสร็จใน foot → reload คงอยู่ → unmark กลับปกติ — prior art: `category.spec.js`, `column-color.spec.js` (component ไม่ unit test → E2E ครอบ flow ที่ render จริง)

### Out of Scope

Column-based "done" (กำหนดทั้งคอลัมน์เป็น Done); ปุ่ม one-click complete บน card face (toggle อยู่ใน panel เท่านั้น); Filter / ซ่อน / พับ / auto-sort card ที่เสร็จ (เช่นปุ่ม "แสดง card ที่เสร็จแล้ว") — deferred; โมเดลเปิดทางไว้; จม card ที่เสร็จลงล่างคอลัมน์อัตโนมัติ; auto-ติ๊ก subtask ตอนเสร็จ / auto-เสร็จเมื่อ subtask ครบ (สอง concept แยกกัน); เก็บ/แสดง *เวลา* ทำเสร็จ (นาที), "เสร็จเมื่อ N ชม.ก่อน", sort ตามเวลาเสร็จจริง; บังคับ subtask-completeness ฝั่ง server; ประวัติว่าใครกดเสร็จเมื่อไหร่ (เก็บแค่วันที่)

### Further Notes

การตัดสินใจผ่าน grilling session กับผู้ใช้; จุดกลับลำสำคัญ: โมเดล boolean เริ่มต้น ถูกอัปเป็น stored date เมื่อ "แสดงวันที่ทำเสร็จ" กลายเป็น requirement แล้วแคบจาก TIMESTAMP → DATE เพราะแสดงแค่วันที่ แสดงวันที่ทำเสร็จ reuse `formatDueDate` (th-TH) + `fromYMD`/`toYMD` ใน `domain/dates.js` เพราะ completion ไหลผ่าน generic `patchCard` จึงได้พฤติกรรม polling/`reconcileBoard` มาฟรี — การเปลี่ยนของเพื่อนร่วมทีมโผล่ตอน snapshot refresh ถัดไป ลำดับ implement แนะนำ: (1) migration + backend + API tests → (2) `domain/completion.js` + client + store + unit → (3) CardPanel + Card UI → (4) E2E → (5) ADR-0003 + CLAUDE.md

---

## 9. Card Title Edit (Inline ใน CardPanel)

**สถานะ:** Implemented (#38)
**Tracking issue:** [#38](https://github.com/khthana/kanban-board/issues/38) · Label: `ready-for-agent`

### Problem Statement

เมื่อเปิด side panel ของ card (CardPanel) ผู้ใช้แก้ description, labels, assignees, due date, subtasks, และ completion ได้ — แต่แก้ **title ของ card ไม่ได้** title แสดงเป็น heading นิ่งๆ ที่หัว panel เท่านั้น การจะเปลี่ยนชื่อ card ไม่มีช่องทางใน panel เลย ซึ่งเป็นช่องโหว่ชัดเจนเมื่อ title คือฟิลด์ที่สำคัญที่สุดของ card

### Solution

ทำให้ title ของ card แก้ **inline** ใน header ของ CardPanel ได้ โดยใช้ interaction click-to-edit แบบเดียวกับที่ panel ใช้กับ subtask title อยู่แล้ว คลิกที่ title มันจะกลายเป็น text input ที่ select ข้อความเดิมทั้งหมดไว้ล่วงหน้า พิมพ์ชื่อใหม่ แล้วบันทึกด้วย Enter หรือคลิกออกจาก field (blur) Escape ยกเลิก title ว่างหรือยาวเกินถูก reject พร้อม error inline card ยังอยู่ตำแหน่งเดิม title ใหม่ปรากฏทุกที่ที่ card ถูกแสดง

### User Stories

1. As a board member, I want to click the card title in the side panel and have it turn into an editable input, so that I can rename the card without leaving the panel.
2. As a board member, I want the title text fully selected when I enter edit mode, so that I can type a brand-new name without first clearing the old one.
3. As a board member, I want to press Enter to save my new title, so that I can confirm the rename quickly with the keyboard.
4. As a board member, I want clicking away (blur) to save my new title when it is valid, so that I do not lose my edit just because I clicked elsewhere.
5. As a board member, I want pressing Escape to cancel the edit and restore the original title, so that I can back out of a mistaken edit.
6. As a board member, I want a blank or whitespace-only title that I try to commit with Enter to be rejected with a visible error while the input stays open, so that I understand why it did not save and can fix it.
7. As a board member, I want a title longer than 255 characters that I try to commit with Enter to be rejected with a visible error while the input stays open, so that I know the limit and can shorten it.
8. As a board member, I want clicking away (blur) with a blank or invalid title to silently revert to the original title, so that I never end up with an empty card name by accident.
9. As a board member, I want a hover state (subtle background + text cursor) and a "click to edit" tooltip on the title, so that I can discover the title is editable.
10. As a board member, I want my renamed title to persist after a page reload, so that I trust the change was saved to the backend.
11. As a board member, I want my renamed title to appear immediately on the card face on the board, so that I get instant feedback without refreshing.
12. As a board member, I want the rename to roll back to the previous title if the server rejects it, so that the UI never lies about what was saved.
13. As a board member, I want to rename a card even after it has been marked done, so that completion does not lock me out of fixing its name.
14. As a board member editing a title, I want switching to a different card (or closing the panel) to discard any half-typed unsaved edit, so that an in-progress edit never leaks onto the wrong card.
15. As a board member, I want committing an unchanged title (same as before) to simply close the editor without a redundant save call, so that no needless write hits the server.

### Implementation Decisions

**Module ใหม่ (deep) — title commit decision (`domain/`):** ดึง pure function ที่ตัดสินว่า commit attempt ควรทำอะไร โดยรับ trigger, ค่าที่พิมพ์, และ title ปัจจุบัน:

```
resolveTitleCommit({ trigger, value, current }) ->
  { action: 'error', message }   // trigger === 'enter' && invalid
  { action: 'revert' }           // trigger === 'blur'  && invalid
  { action: 'revert' }           // valid && trimmed === current (no-op)
  { action: 'save', title }      // valid && changed
```

`trigger` เป็น `'enter'` หรือ `'blur'` ความ valid ใช้ `validateCardTitle` เดิม (non-empty, ≤ 255) แยก save/revert/error branching ออกจาก React เพื่อให้ unit-test ได้ ตามแนวทางเดียวกับ `domain/completion.js` และ `domain/accent.js`

**CardPanel (modify):** แทนที่ title `<h2>` นิ่งๆ ด้วย click-to-edit affordance reuse pattern subtask-rename เดิม (`editingId`/`editInput`/`editError`-style local state สโคปเฉพาะ title) เข้า edit mode ตอนคลิก: render `<input>` ที่ `autoFocus` และ select-all ตอน focus คีย์บอร์ด: Enter commit ด้วย trigger `'enter'`; Escape ยกเลิกและคืนค่าเดิม Blur commit ด้วย trigger `'blur'` เมื่อ `action: 'save'` เรียก `onSave({ title })` เดิม (ไม่มี store action ใหม่) เมื่อ `action: 'error'` โชว์ message inline และเปิด input ค้างไว้ เมื่อ `action: 'revert'` ปิด editor และคืน title เดิม **ไม่** ตั้ง `maxLength` บน input — ให้ `validateCardTitle` เป็นคนอธิบาย error กรณีเกิน limit แทนที่จะตัดเงียบๆ (สอดคล้องกับ field description) reset การแก้ title ที่ค้างอยู่เมื่อ active card เปลี่ยน (effect keyed on `card.id`)

**Save path (ไม่เปลี่ยน):** reuse `patchCard` optimistic update + rollback เดิม `cardPatchToApi` map `title` อยู่แล้ว header อ่าน `card.title` จาก store ดังนั้น optimistic apply/rollback สะท้อนอัตโนมัติ

**Styling (modify):** title hover state: background wash จาง + `cursor: text` บวก tooltip "click to edit" edit-mode input จัดวางใน header โดยไม่มี layout shift

**Scope of editability:** แก้ได้ **เฉพาะใน side panel** หน้าการ์ดบน board ยังอ่านอย่างเดียว การ mark card done ไม่ปิดกั้นการแก้ title

### Testing Decisions

เทสต์ที่ดียืนยัน external behavior ไม่ใช่ implementation detail — input/output ที่ user หรือ caller สังเกตได้ ไม่ใช่ internal React state

**Unit test — title-commit domain module ใหม่:** ครอบคลุม decision table เต็ม: Enter + empty → error; Enter + over-255 → error; blur + empty → revert; valid + changed → save พร้อม title ที่ trim แล้ว; valid + unchanged → revert (no-op) Prior art: `src/domain/completion.test.js` และ `src/domain/accent.test.js` — pure-function test ไม่มี React

**E2E — rename persists:** เพิ่มใน `e2e/card.spec.js` (reuse setup column+card เดิม): เปิด card panel, คลิก title, แทนที่, commit ด้วย Enter, รอ PATCH 200, reload, assert title ใหม่ขึ้นบนหน้าการ์ด Prior art: flow create-card-persists เดิมในไฟล์เดียวกัน, และ subtask reorder/rename wait ใน `subtask.spec.js`

Component ไม่ unit-test ในโปรเจกต์นี้ (ครอบคลุมโดย E2E) ดังนั้นการเปลี่ยนใน CardPanel เองถูกทดสอบผ่าน E2E flow เท่านั้น

### Out of Scope

Inline title editing บนหน้าการ์ดบน board (Card.jsx) — เฉพาะ panel เท่านั้น; แก้ field อื่นที่ยังแก้ไม่ได้; Backend changes (`PATCH /cards/:id` รับ `title` อยู่แล้ว; `validateCardTitle` และ `cardPatchToApi` มีอยู่แล้ว); Rich text / multi-line title — title ยังเป็น single-line plain string; Undo/history ของการเปลี่ยน title เกินกว่า in-edit Escape cancel; แปล error message ของ validation (reuse ข้อความ `validateCardTitle` เดิม)

### Further Notes

สรุป interaction ที่ตกลงกันตอน grilling: click-to-edit inline; Enter save; Escape cancel; blur save เมื่อ valid / revert เมื่อ invalid; Enter บน invalid โชว์ error inline และเปิด input ค้าง; select-all ตอนเข้า edit mode; hover affordance + tooltip; card ที่เสร็จแล้วยังแก้ title ได้; ไม่มี `maxLength` ข้อนี้ต่างจาก subtask rename ตรงที่: subtask rename ไม่ทำอะไรตอน blur ในขณะที่ title save ตอน blur (valid) / revert (invalid) เพราะ title เป็นฟิลด์สำคัญที่สุดของ card commit-on-blur จึงตรงกับความคาดหวังผู้ใช้ (สไตล์ Trello/Notion)

---

## 10. Monorepo Migration (รวม API เข้า Frontend Repo)

**สถานะ:** Implemented

### Problem Statement

โปรเจกต์เดิมอยู่คนละ Git repository — `kanban-board` (React frontend) และ `kanban-board-api` (Node.js/Express backend) นักพัฒนาที่ทำฟีเจอร์ full-stack ต้องเปิด editor 2 หน้าต่าง สลับ terminal 2 ไดเรกทอรี และดูแล GitHub repo 2 ที่ (แต่ละที่มี CI workflow ของตัวเอง) การสลับบริบทตลอดเวลานี้สร้าง friction ที่ไม่จำเป็นสำหรับนักพัฒนาคนเดียว

### Solution

ย้ายโค้ด API เข้ามาเป็น subdirectory แบบแบน (`api/`) ภายใน repository `kanban-board` เดิม ผลลัพธ์คือโฟลเดอร์เดียวที่มีทั้ง React frontend (`src/`) และ Node.js backend (`api/src/`) เปิดใน VS Code ครั้งเดียว Docker Compose ยังเป็น dev workflow หลัก ต้องแก้แค่ path ไม่ต้องเปลี่ยน tooling ใดๆ GitHub repo เก่า `kanban-board-api` ถูกลบหลังย้ายเสร็จ

### User Stories

1. As a developer, I want to open one folder in VS Code and see both the frontend and backend source code, so that I can work on full-stack features without switching windows.
2. As a developer, I want to run `docker compose up` once and have the full stack start — database, API, and frontend — so that I don't need to manage multiple terminal sessions.
3. As a developer, I want a single `git log` that shows both frontend and backend changes in chronological order, so that I can trace full-stack changes together.
4. As a developer, I want a single GitHub repository to track issues, PRDs, and CI results for the whole project, so that I don't have to manage two issue trackers.
5. As a developer, I want the backend integration tests (requiring PostgreSQL) to run automatically in CI when I push to `main`, so that API regressions are caught alongside frontend regressions.
6. As a developer, I want `CLAUDE.md`, `README.md`, and `.gitignore` to describe the full project in one file each, so that context is never split across repos.
7. As a developer, I want to delete the `kanban.code-workspace` multi-root workspace file, so that there is no stale artifact left over from the two-repo setup.
8. As a developer, I want the migration to preserve all existing frontend (`src/`) and backend (`api/src/`) import paths, so that no application code needs to change.
9. As a developer, I want the React dev proxy (`src/setupProxy.js`) to continue targeting `localhost:4000` unchanged, so that local non-Docker development also works without edits.

### Implementation Decisions

**โครงสร้าง repository หลังย้าย:**

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

**กลยุทธ์ git history:** copy ไฟล์โดยไม่ merge git history ของ `kanban-board-api` commit เดียว `chore: absorb api into monorepo` วางไฟล์ API ทั้งหมดที่ `api/` git history ของ API เก่ายังเข้าถึงได้บน GitHub จนกว่า repo จะถูกลบ (ช่วงเวลาระหว่างย้ายกับลบ) ตั้งใจแบบนี้ — trade-off ของการเสีย backend history ยอมรับได้สำหรับโปรเจกต์คนเดียวที่ DX สำคัญกว่า

**การเปลี่ยน `docker-compose.yml`:** เปลี่ยน path 2 จุดเท่านั้น ไม่มีการเปลี่ยนโครงสร้าง: `api.build.context`: `../kanban-board-api` → `./api`; `api.volumes[0]`: `../kanban-board-api:/app` → `./api:/app`

**การเปลี่ยน CI workflow:** job เดิมใน `ci.yml` (frontend unit tests, ไม่มี external service) คงไว้เหมือนเดิม เปลี่ยนชื่อเป็น `test-frontend` เพิ่ม job ที่สอง `test-api`: ใช้ `services: postgres` (config เดียวกับ CI workflow เดิมของ `kanban-board-api`), รัน `cd api && npm ci && npm test`, ตั้ง env `TEST_DATABASE_URL` และ `JWT_SECRET`, ทั้งสอง job รันพร้อมกันตอน push/PR ไป `main`

**กลยุทธ์รวมเอกสาร:** `CLAUDE.md`: เพิ่ม section API ต่อท้าย `## API` หลังเนื้อหา frontend เดิม ครอบคลุม command เฉพาะ API (`npm run dev`, `npm run migrate`, `npm test`), key files, และ environment variables `README.md`: ปรับใหม่ให้อธิบาย monorepo layout, Docker quick-start ใหม่, และ feature list เต็มทั้ง frontend/backend `.gitignore` (root): union ของทั้งสอง `.gitignore` เดิม — ครอบคลุม `build/`, `node_modules`, `.env`, test artifacts ของทั้งสอง workspace `api/.gitignore`: เก็บไว้สำหรับ backend-specific ignore (เช่น `.env`) ที่ tooling `cd api && npm install` คาดหวังใน subtree

**ไฟล์ที่ลบ:** `kanban.code-workspace` — multi-root workspace file ที่ `C:\Users\Terry\Desktop\Code\kanban.code-workspace` ไม่จำเป็นอีกเมื่อทั้งสอง workspace อยู่โฟลเดอร์เดียว

**การเก็บกวาด GitHub repository:** `khthana/kanban-board-api` ถูกลบหลังยืนยันว่าย้ายสำเร็จ (CI เขียวทั้งหมด)

**ไม่มี shared code layer:** ไม่มี `packages/` หรือ `libs/` directory frontend และ backend ยัง install แยกอิสระ (`npm install` จาก root สำหรับ frontend; `cd api && npm install` สำหรับ backend) monorepo เป็นแค่ flat co-location ไม่ใช่ workspace-linked setup จะทบทวนใหม่ก็ต่อเมื่อ shared validation/type layer มีค่าคุ้มพอ

**ไม่มี root-level convenience scripts:** root `package.json` ยังเป็น package descriptor ของ frontend ไม่มี `concurrently`-based `npm run dev` script ที่ root Docker Compose เป็น dev workflow หลัก การไม่มี root dev-runner เป็นความตั้งใจ

### Testing Decisions

การย้ายนี้ไม่เพิ่ม application logic ใหม่ จึงไม่มี unit หรือ E2E test ใหม่

**การย้ายถือว่าถูกต้องเมื่อ test เดิมทั้งหมดผ่านโดยไม่ต้องแก้:** 111 frontend unit tests (`npm test -- --watchAll=false` จาก root), 113 backend integration tests (`cd api && npm test`), 28 Playwright E2E tests (`docker compose up` แล้ว `npm run test:e2e`)

`test-api` CI job ใหม่เป็นตัวป้องกัน regression หลัก CI เขียวบน commit ที่ย้ายคือเกณฑ์ตรวจรับ

Prior art สำหรับ postgres CI service config: copy ตรงจาก `kanban-board-api/.github/workflows/ci.yml` (service block เหมือนกัน)

### Out of Scope

npm workspaces / Turborepo / Nx — ไม่ถูกนำมาใช้ เพราะโปรเจกต์ไม่แชร์โค้ดระหว่าง package จึง workspace tooling เพิ่มความซับซ้อนโดยไม่ได้ประโยชน์; Shared validation หรือ type layer — `domain/validation.js` (frontend) และ validation ฝั่ง backend ที่เทียบเท่ายังแยกกัน การรวมเป็นการตัดสินใจในอนาคต; Deploy ไป Railway/Render/Vercel เป็นโครงการแยกที่ไม่กระทบโดยการย้ายนี้; เพิ่ม E2E test เข้า CI pipeline เป็น backlog เดิมอยู่แล้ว การย้ายนี้ไม่ได้เพิ่มหรือลด; WebSocket / real-time — นอกขอบเขตทั้งหมด

### Further Notes

`src/api/client.js` proxy ยังชี้ไป `localhost:4000` ตอน local dev (non-Docker) ไม่แก้ `src/setupProxy.js` ไฟล์ `api/.env` ต้องถูกเติมโดย developer เองหลังย้าย (copy จาก `api/.env.example`) Docker Compose inject env var ตรงๆ ไม่อ่าน `.env` จึง Docker workflow ไม่กระทบ backend `node_modules` อยู่ที่ `api/node_modules/` — ถูก exclude โดย Docker volume mount ของ `api/` อยู่แล้ว (`/app/node_modules` anonymous volume) จึงไม่ต้องแก้ Dockerfile repo `kanban-board-api` บน GitHub ควรถูก **ลบ** (ไม่ใช่ archive) เพื่อไม่ให้สับสนว่า canonical source อยู่ที่ไหน

---

## 11. Board "List View"

**สถานะ:** ready-for-agent (ยังไม่ implement) — [issue #44](https://github.com/khthana/kanban-board/issues/44)
**Decisions of record:** ฟีเจอร์นี้ reuse [ADR-0001](../docs/adr/0001-column-accent-model.md) (Column Accent), [ADR-0002](../docs/adr/0002-card-editorial-model.md) (editorial Card), [ADR-0003](../docs/adr/0003-card-completion-model.md) (Card completion) — **ทั้งหมดไม่เปลี่ยน** ไม่มี ADR ใหม่ — List view เป็นแค่ presentation layer เหนือ data model เดิม
**Glossary:** [CONTEXT.md](../CONTEXT.md) — คำว่า **Board**, **Column**, **Card**, **Category**, **Card Accent**, **Accent**, **Position**, **Overdue** ไม่มีคำศัพท์ใหม่ — List view เป็น *มุมมอง* ใหม่ของ entity เดิม ไม่ใช่ entity ใหม่

### Problem Statement

ปัจจุบัน board มีมุมมองเดียว: **Board view** แนวนอน — Column เรียงข้างกัน แต่ละ Column มี Card เรียงแนวตั้งของตัวเอง การจะตอบว่า "บน board นี้มีอะไรบ้าง" สมาชิกต้อง scroll แนวนอนผ่านทุก Column ไม่เคยเห็น Card มากกว่า 1 Column พร้อมกัน ไม่มีทางอ่าน Card ทุกใบในการกวาดสายตาแนวตั้งครั้งเดียว ทำให้การ scan, triage, และ review ทำได้ไม่สะดวกสำหรับ board ที่มีหลาย Column

ทีมต้องการมุมมองที่สอง เน้นการอ่าน ที่แสดง **Card ทุกใบบน board เป็น list แนวตั้งเดียวที่หนาแน่น** จัดกลุ่มตาม Column เพื่อให้อ่านทั้ง board จากบนลงล่างได้โดยไม่ต้อง scroll แนวนอน และไม่หลุดว่า Card อยู่ Column ไหนระหว่าง scroll พฤติกรรมแก้ไขเดิมทั้งหมด (`CardPanel`, optimistic update, polling, drag-and-drop) ต้องคงเดิมทุกประการ — มุมมองใหม่เป็นแค่ *วิธีมอง* ข้อมูลเดิม ไม่ใช่วิธี model ข้อมูลใหม่

### Solution

เพิ่ม **List view** ให้ `BoardPage` สลับได้จาก `TopBar` ผ่าน segmented control `[ Board | List ]`:

- Route ยังเป็น `/boards/:boardId` เดิม — มุมมองที่ active อยู่ใน local state ของ `BoardPage` (`view: 'board' | 'list'`) default เป็น `'board'` **ไม่ persist** — reload กลับไป Board view เสมอ
- Toggle อยู่ในกลุ่มซ้ายของ `TopBar` ต่อจากชื่อ board ทันที เป็น `role="tablist"` ที่เข้าถึงได้ (สอง `role="tab"` button, `aria-selected` บนตัวที่ active, เลื่อนด้วยลูกศรคีย์บอร์ด) วางไว้ซ้าย — ห่างจากขอบขวาที่ `CardPanel` เลื่อนเข้ามา — จึงเข้าถึงได้เสมอและไม่รกไม่ว่า panel จะเปิดอยู่หรือไม่
- ใน List view Column ของ board render เรียงต่อกันเป็น **section** แต่ละ section มี **sticky header** (name pill + จำนวน card ทาสีด้วย Column **Accent** ตาม ADR-0001) ที่ pin อยู่บนสุดของ scroll region ขณะ row ของ section นั้น scroll ผ่านด้านล่าง แล้วค่อยให้ทางกับ header ของ section ถัดไป ทำให้ยังเห็นว่ากำลังอ่าน Column ไหนอยู่เสมอ ไม่ว่า list จะยาวแค่ไหน
- **row** เป็น **เส้นเดียวแนวนอนที่หนาแน่น** — ไม่ใช่ editorial Card face แนวตั้งที่ยืดเต็มความกว้าง เรียงซ้ายไปขวา: จุดสี Category + label พิมพ์ใหญ่ (หรือเทากลางถ้าไม่มี Category), title (flex-grow, ตัดด้วย ellipsis), due date, adaptive subtask progress (segment ≤ 8 subtask / mini-bar > 8 ตาม ADR-0002), assignee avatar Card ที่เสร็จแล้วโชว์ badge ✓, opacity แถวลดเหลือ ~0.6, และวันที่เสร็จแทน due date (ADR-0003) due date ที่เกินกำหนดขึ้นสีแดงเหมือน Board view ไม่มี indicator "สถานะ" แยกต่างหากบน row — section header บอกชื่อ Column อยู่แล้ว จึงไม่ต้องมีอะไรเพิ่มตรงนั้น
- Column ที่**ไม่มี Card** ยังโชว์ section (ว่าง) ของตัวเอง เหมือน Board view ที่ยัง render Column ว่าง
- **ไม่มี drag-and-drop** ใน List view Row เป็น read/select-only เท่านั้น: คลิก row (หรือกด Enter/Space) เปิด `CardPanel` เดิม ซึ่งเลื่อนเข้าจากขวาและหด list ลง 380px เหมือน Board view ทุกการแก้ไขยังผ่าน panel เหมือนเดิม
- สร้าง Card ได้: แต่ละ section มี affordance **"+ New card"** ที่ท้าย section — `CardComposer` เดิม reuse ตรงๆ (label ปุ่มเดียวกัน ฟอร์มเดียวกัน) Card ใหม่ปรากฏที่ท้าย section (optimistic update) เหมือน Board view
- สลับ view จะ **ปิด `CardPanel` ที่เปิดอยู่** (`activeCard` → `null`) เพื่อไม่ให้ state ค้างข้าม view
- **Polling** ยังทำงานต่อ (10s `GET /boards/:id`) — List view ใช้ store เดียวกับ Board view จึงได้ cross-tab reconciliation มาฟรี

Empty-board state เหมือน Board view ทุกประการ: ถ้ายังไม่มี Column จะโชว์ `ColumnComposer` เพื่อสร้าง Column แรก

### User Stories

1. As a board member, I want to switch my board between Board view and List view from the top bar, so that I can choose the perspective that fits the task.
2. As a board member, I want the view toggle to stay reachable in the top bar whether or not a Card panel is open, so that switching views never requires me to close what I'm doing first.
3. As a board member, I want List view to default to Board view on reload, so that the familiar board is what I see first.
4. As a board member, I want every Card on the board shown in one vertical list, so that I can read the whole board without horizontal scrolling.
5. As a board member, I want the list grouped by Column with each Column's name and card count as a section header, so that I can tell which stage each Card is in.
6. As a board member, I want each section's header to stay pinned at the top while I scroll through that section's Cards, so that I never lose track of which Column I'm reading on a long board.
7. As a board member, I want each section header tinted by its Column's Accent, so that List view feels consistent with Board view (ADR-0001).
8. As a board member, I want a Column with no Cards to still show its section, so that empty Columns are visible and consistent with Board view.
9. As a board member, I want Cards within a section ordered by their position, so that the list mirrors the order I set in Board view.
10. As a board member, I want each row rendered as a single dense line (category, title, due date, progress, assignees), so that I can scan many Cards quickly without excess vertical space per Card.
11. As a board member, I want a Card with no Category to use the neutral gray accent, so that uncategorized rows look intentional.
12. As a board member, I want a done Card's row to show the ✓ badge, fade, and completion date in place of the due date, so that completed work reads the same as in Board view (ADR-0003).
13. As a board member, I want an overdue Card's due date shown in red, so that late work stands out the same way it does in Board view.
14. As a board member, I want clicking (or activating via keyboard) a row to open the existing Card detail panel, so that I can edit a Card from List view with no change to how editing works.
15. As a board member, I want the open Card panel to push the list left (380px) exactly as it does in Board view, so that the panel never covers Card content.
16. As a board member, I want switching the view to close any open Card panel, so that I never end up with a panel pointing at the wrong view.
17. As a board member, I want a "+ New card" affordance at the foot of each section, so that I can add a Card directly to a chosen Column without switching back to Board view.
18. As a board member, I want a newly created Card to appear at the foot of its section immediately, so that the optimistic update feels the same as in Board view.
19. As a board member, I want the list to keep syncing while I view it, so that changes from other tabs appear in List view too (polling unchanged).
20. As a board member, I want List view to show the Column composer when the board has no Columns yet, so that the empty state matches Board view.

### Implementation Decisions

**Data model (ไม่เปลี่ยน):** ไม่มีการเปลี่ยน schema, API, transport, หรือ store shape List view อ่าน `board` shape เดียวกัน (`board`, `columns`, `cards`, `labels`, `members`, `cardLabels`, `cardAssignees`, `subtasks`) ที่ Board view ใช้จาก `useBoardStore` อยู่แล้ว **ไม่มี domain module ใหม่** — List view เป็น presentation concern ล้วนๆ logic ของ row/section ทั้งหมด reuse domain helper เดิมที่อยู่เบื้องหลัง ADR-0001/0002/0003 (accent derivation, date formatting/overdue check, progress view, completion state)

**Routing & state:** Route ยังเป็น `/boards/:boardId` เดิม `BoardPage` มี local state สำหรับ view ที่ active, default เป็น Board view, ไม่ persist ข้าม reload หรือ navigation State และพฤติกรรมที่ทั้งสอง view ใช้ร่วมกัน — board fetch, polling, reconciliation, optimistic mutation actions, active-Card panel, invite dialog, mutation-error banner — คงเดิมทุกประการ มีแค่การ render ของ board body ที่แยกตาม view ที่ active drag-and-drop context (sensors, drag-start/drag-end handler, drag overlay) mount เฉพาะใน Board view เท่านั้น — ไม่ render เลยใน List view เพราะ List view ไม่มี drag-and-drop สลับ view จะ clear active Card ด้วย เพื่อไม่ให้ panel ที่เปิดใน view หนึ่งค้างไปอีก view (user story 16) TopBar มี view toggle ตามที่อธิบายข้างต้น (segmented control, กลุ่มซ้าย, tablist semantics)

**Modules ที่ build/modify:**

- **`ListRow`** *(component ใหม่)* — row ของ Card หนึ่งใบใน List view render เป็นเส้นเดียวแนวนอนที่หนาแน่น แทนที่จะเป็น editorial Card face แนวตั้ง **ตั้งใจ duplicate** presentational logic ของ Card face component เดิม (จุด/label category, due date, adaptive progress, done state) แทนที่จะแชร์ component เดียวกัน เพราะ Card face เดิมผูกกับ drag-and-drop (มันสร้าง sortable drag source) ซึ่ง List view ไม่ใช้และไม่ต้องการสร้างขึ้นมา `ListRow` reuse domain helper ตัวเดียวกับ Card face (accent derivation, date/overdue formatting, progress view, completion state) เพื่อให้ทั้งสอง view สอดคล้องกันทาง logic แม้ JSX จะแยกกัน รับ Card พร้อม labels, assignees, และ subtasks (ถูก filter มาจากผู้เรียกแล้ว) และเรียก callback เพื่อเปิด Card panel เดิมเมื่อคลิก/Enter/Space **Trade-off ที่ยอมรับ**: เพราะ row duplicate markup แทนที่จะแชร์กับ Card face การเปลี่ยน visual ของ Card face ในอนาคต (Board view) ต้อง apply กับ `ListRow` แยกต่างหาก ไม่งั้นทั้งสอง view จะ drift — ยอมรับ trade-off นี้เพราะเป็นทางที่ง่ายกว่าเมื่อเทียบกับความผูกพันกับ drag-and-drop ข้างต้น
- **`ListView`** *(component ใหม่)* — วนลูป Column ของ board ตามลำดับ position สำหรับแต่ละ Column render sticky section header (name pill + จำนวน card ทาสีด้วย Column Accent ด้วย derivation เดียวกับ header ของ Column ใน Board view) ตามด้วย Card ของ Column นั้นเป็น `ListRow` เรียงตาม position แล้วตามด้วย affordance เพิ่ม Card ที่ท้าย section render Column composer แทนเมื่อ board ยังไม่มี Column เลย (empty-board state) รับ mutation callback เดียวกับที่ `BoardPage` wire เข้า Column/Card-add/Card-panel ของ Board view อยู่แล้ว เพื่อให้ List view เข้าร่วม optimistic-update flow เดียวกัน
- **`TopBar`** *(modify)* — เพิ่ม view state และ change-handler prop ที่ต้องใช้ render/ขับ segmented control `[ Board | List ]` ข้างต้น
- **`BoardPage`** *(modify)* — เพิ่ม view state, gate drag-and-drop context ไว้เฉพาะ Board view, render `ListView` ใน List view, clear active Card เมื่อ view เปลี่ยน, และส่ง mutation callback เดียวกับที่ส่งให้ Board view's Column rendering ไปให้ `ListView` ด้วย
- Card face component เดิม, Card-add composer, และ Column component ที่ Board view ใช้ **ไม่เปลี่ยนทั้งหมด** — การ render และพฤติกรรมของ Board view ไม่ถูกแตะโดยฟีเจอร์นี้

**สิ่งที่ตั้งใจ *ไม่* build:** ไม่มี `domain/list*` module — List view เป็น presentation ไม่ใช่ logic; ไม่มี store action ใหม่, ไม่มี API client function ใหม่, ไม่มี backend route หรือ migration ใหม่; ไม่มี route ใหม่, ไม่ persist view, ไม่มี URL query param สำหรับ view; ไม่มี component ที่แชร์ระหว่าง Card face กับ `ListRow` (ดู trade-off ข้างต้น)

### Testing Decisions

เทสต์ที่ดียืนยัน **พฤติกรรมภายนอก** ไม่ใช่ implementation detail

- **ไม่มี pure-domain module ใหม่** → ไม่มี unit test ใหม่สำหรับ domain logic domain-layer test เดิม (accent, progress, dates, completion) ครอบคลุม helper ทุกตัวที่ `ListRow` reuse อยู่แล้ว List view ไม่เพิ่ม logic ใหม่ให้ต้องมี coverage เพิ่ม
- **ไม่มี component-level unit test ใหม่** — สอดคล้องกับ pattern เดิมของโปรเจกต์ที่ presentational component ครอบคลุมด้วย E2E ไม่ใช่ unit test และ store action (ไม่เปลี่ยนในฟีเจอร์นี้) เป็นสิ่งเดียวที่ unit-test นอกเหนือจาก domain layer
- **Store actions** → ไม่เปลี่ยน จึงไม่ต้องแก้ test เดิมของ store
- **E2E (Playwright)** — เพิ่ม spec ใหม่สำหรับ List view รันแบบ serial (`--workers=1`) เหมือน E2E suite ที่เหลือ เพราะทุก test แชร์ Postgres instance เดียวกัน coverage:
  - สลับ Board → List แล้วกลับ; assert ว่า section header ตรงกับ Column ของ board ตามลำดับ และ row ของแต่ละ section ตรงกับ Card ของ Column นั้นด้วยชื่อ
  - Section header มี Column Accent (ใช้ assertion pattern เดียวกับที่มีอยู่แล้วสำหรับ column color ใน E2E spec เดิม)
  - Card ที่เสร็จแล้วโชว์ badge ✓ + จางใน row ของ List view (ใช้ assertion pattern เดียวกับ completion E2E spec เดิม)
  - คลิก row เปิด Card panel (assert panel ปรากฏ), และสลับ view ขณะ panel เปิดอยู่ทำให้ panel ปิด
  - "+ New card" ที่ท้าย section สร้าง Card ที่ปรากฏที่ท้าย section นั้น (รอ request สร้างเสร็จก่อน assert ตาม wait pattern เดียวกับที่ใช้ใน subtask E2E spec เพื่อเลี่ยง tempId race)
  - Reload กลับไป Board view (default, ไม่ persist)

### Out of Scope

Drag-and-drop หรือ inline reorder ใน List view (row เป็น read/select-only); แก้ field ใดๆ inline บน row (การแก้ไขทั้งหมดผ่าน Card panel); ผู้ใช้เลือก sort field/ทิศทางเอง (fixed: ลำดับ Column → Card position); Filter, ซ่อน, หรือค้นหา Card (รวมถึงปุ่ม "ซ่อน card ที่เสร็จแล้ว"); Collapsible section (section header เป็น sticky แต่ไม่ collapsible/interactive); route หรือ URL param แยกสำหรับ view (เป็น local state ของ `BoardPage`); persist view ที่ active ข้าม reload หรือข้าม board; มุมมอง "Card ของฉันทั้งหมดข้าม board" (List view นี้ scope แค่ board เดียว); เปลี่ยน data model, API, store, Card face component, หรือ Column component ใดๆ; component ที่แชร์ระหว่าง Card face กับ `ListRow` (ยอมรับ duplication — ดู Implementation Decisions); responsive/narrow-viewport reflow ของ single-line row — แอปนี้เป็น desktop-first สอดคล้องกับ Board view ที่ scroll แนวนอนเองอยู่แล้ว; เพิ่มคำว่า "Task" หรือ "List view" ลง `CONTEXT.md` (คำว่า **Card** / **Column** ใน glossary reuse ตรงๆ)

### Further Notes

List view ตั้งใจสะท้อน visual/behavioral contract ของ Board view (Accent theming ตาม ADR-0001, ข้อมูล editorial Card ตาม ADR-0002, done state ตาม ADR-0003, optimistic update, polling) เพื่อให้สมาชิกสลับ view ได้โดยไม่ต้องเรียนรู้ใหม่ แม้ layout ของ row เอง (เส้นเดียวหนาแน่น vs การ์ดแนวตั้ง) จะตั้งใจต่างจาก Card face ของ Board view — นั่นสะท้อนว่าทั้งสอง view รับใช้โหมดการอ่านที่ต่างกัน (scan vs. มองการ์ดทีละใบ) ไม่ใช่ความขัดแย้งกัน

sticky section header คือสิ่งที่แก้ปัญหา "กำลังดู Column ไหนอยู่" บน list ยาวได้จริง header แบบ static (ไม่ sticky) จะทำตามตัวอักษรของ "จัดกลุ่มตาม Column" ได้ก็จริง แต่ไม่ตอบโจทย์เป้าหมายที่แท้จริงคือการอ่านทั้ง board โดยไม่หลุดบริบท

เพราะทั้งสอง view ใช้ store เดียวกัน Card ที่ถูกสร้าง/แก้/ย้ายใน view หนึ่งจะสะท้อนในอีก view ทันทีตอน render หรือ poll ถัดไป — ไม่ต้อง wiring เพิ่ม

Toggle อยู่บน `TopBar` (ไม่ใช่ sub-toolbar แยก) วางห่างจากขอบที่ panel เลื่อนเข้ามา จึงเข้าถึงได้เสมอและไม่รก ไม่ว่า Card panel จะเปิดอยู่หรือไม่
