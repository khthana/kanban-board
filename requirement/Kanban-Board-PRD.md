# Product Requirements Document — Kanban Board Application

**สถานะ:** Draft v1.0
**ขอบเขต:** Team MVP (ทีมเล็ก 2–15 คน)
**Tech Stack:** Web — React (frontend), Node.js (backend), PostgreSQL (database)
**วันที่:** 30 พฤษภาคม 2026

---

## 1. Solution

### 1.1 ภาพรวม

Kanban Board เป็น web application สำหรับทีมเล็ก (2–15 คน) ใช้บริหารงานแบบ visual board โดยจัดงานเป็น card ที่เคลื่อนผ่าน column ต่างๆ ตามสถานะของงาน (เช่น To Do → In Progress → Done) ผู้ใช้ลากการ์ด (drag-and-drop) ข้าม column ได้ และมองเห็นภาพรวมความคืบหน้าของทีมในหน้าจอเดียว

เป้าหมายของ MVP คือทำให้ flow หลัก — สร้าง board, สร้าง card, ลากย้าย card, มอบหมายงาน — ทำงานได้ลื่นไหลและเชื่อถือได้ก่อน โดย**ตัด** real-time collaborative editing แบบ live cursor และระบบ permission ที่ซับซ้อนออกไปเป็น Phase ถัดไป

### 1.2 ปัญหาที่แก้

ทีมเล็กมักจัดการงานกระจัดกระจายในแชท สเปรดชีต และอีเมล ทำให้ไม่มีจุดเดียวที่เห็นสถานะงานทั้งหมด ไม่รู้ว่าใครทำอะไรอยู่ และงานตกหล่น Kanban Board รวมศูนย์ข้อมูลงานให้เห็นเป็นภาพ พร้อมสถานะและผู้รับผิดชอบที่ชัดเจน

### 1.3 ขอบเขต MVP (In Scope)

ระบบประกอบด้วยการจัดการบัญชีผู้ใช้และ authentication, การสร้างและจัดการ board, การจัดการ column ภายใน board, การจัดการ card (สร้าง/แก้ไข/ลบ/ลากย้าย), การมอบหมายงานให้สมาชิก, การติด label และกำหนด due date, การเชิญสมาชิกเข้า board, และการ sync ข้อมูลเมื่อผู้ใช้รีเฟรชหรือเปิดหน้าใหม่ (polling-based refresh ไม่ใช่ live websocket)

### 1.4 นอกขอบเขต MVP (Out of Scope — Phase ถัดไป)

Real-time live sync ผ่าน WebSocket พร้อม presence/cursor ของผู้ใช้คนอื่น, ระบบ role/permission แบบละเอียด (เช่น viewer/editor/admin ต่อ board), checklist ย่อยใน card, ไฟล์แนบขนาดใหญ่, การแจ้งเตือนผ่านอีเมล/push, automation rules, swimlanes, การค้นหาขั้นสูงข้าม board, mobile native app และ analytics dashboard

### 1.5 Non-Functional Requirements

หน้า board ที่มี card ไม่เกิน 500 ใบควรโหลดเสร็จภายใน 2 วินาทีบนเครือข่ายปกติ การลากย้าย card ต้องตอบสนองทันที (optimistic UI) และ persist ลง backend ภายใน 1 วินาที ระบบต้องรองรับผู้ใช้พร้อมกันต่อ board อย่างน้อย 15 คน รหัสผ่านต้อง hash ด้วย bcrypt/argon2 และทุก API ต้องผ่าน authentication ยกเว้น endpoint สำหรับ login/register UI ต้องใช้งานได้บน desktop browser รุ่นใหม่ (Chrome, Firefox, Safari, Edge) และ responsive พอใช้บนแท็บเล็ต

---

## 2. User Stories

รูปแบบ: *As a [role], I want [feature], so that [benefit]*

### Authentication & Account

- As a new user, I want to register with email and password, so that I can create my own account and start using the board.
- As a registered user, I want to log in and stay logged in across sessions, so that I don't have to re-enter credentials every time.
- As a user, I want to log out, so that my account is secure on shared computers.

### Board Management

- As a user, I want to create a new board with a name, so that I can organize work for a specific project.
- As a user, I want to see a list of all boards I own or am a member of, so that I can switch between projects easily.
- As a board owner, I want to rename or delete a board, so that I can keep my workspace tidy.
- As a board owner, I want to invite teammates to a board by email, so that we can collaborate on the same project.

### Column Management

- As a board member, I want to create columns with custom names, so that I can model my team's workflow stages.
- As a board member, I want to reorder columns by dragging, so that the board reflects the real sequence of work.
- As a board member, I want to rename or delete a column, so that I can adjust the workflow as it evolves.

### Card Management

- As a board member, I want to create a card with a title inside a column, so that I can capture a task quickly.
- As a board member, I want to open a card to edit its description, assignee, due date, and labels, so that I can capture full task detail.
- As a board member, I want to drag a card to another column or reorder it within a column, so that I can update its status visually.
- As a board member, I want to delete a card, so that I can remove tasks that are no longer relevant.

### Collaboration & Visibility

- As a board member, I want to assign a card to a teammate, so that responsibility is clear.
- As a board member, I want to add colored labels to cards, so that I can categorize tasks (e.g., bug, feature, urgent).
- As a board member, I want to set a due date on a card and see overdue cards highlighted, so that I don't miss deadlines.
- As a board member, I want the board to reflect recent changes when I refresh or reopen it, so that I see up-to-date status from my teammates.

---

## 3. Implementation Decisions

> หมายเหตุ: ส่วนนี้บันทึก **การตัดสินใจเชิงสถาปัตยกรรมและสัญญา (contracts)** ไม่ใช่ source code หรือ file path เพื่อให้คงทนต่อการเปลี่ยนแปลง

### 3.1 Architecture & Tech Stack

ระบบเป็น web application แบบ client-server แยกชั้นชัดเจน Frontend เป็น React single-page application (SPA) สื่อสารกับ backend ผ่าน REST API (JSON) Backend เป็น Node.js (แนะนำ Express หรือ Fastify) ทำหน้าที่ business logic และ authentication ฐานข้อมูลเป็น PostgreSQL การ deploy คาดว่าเป็น stateless backend หลาย instance หลัง load balancer โดยเก็บ session state ไว้ใน token ไม่ใช่ในหน่วยความจำ server

การ sync ข้อมูลใน MVP ใช้รูปแบบ **polling** — frontend ดึงสถานะ board ใหม่เมื่อเปิดหน้า/รีเฟรช และ poll ซ้ำทุก ~10 วินาทีขณะเปิดอยู่ (ออกแบบ API ให้รองรับการเปลี่ยนไปใช้ WebSocket ใน Phase ถัดไปได้โดยไม่ต้องเปลี่ยน data model)

### 3.2 Modules ที่จะสร้าง

Backend แบ่งเป็น module ตาม domain ดังนี้: **Auth module** (register, login, token issuance/verification), **User module** (โปรไฟล์ผู้ใช้, ค้นหาผู้ใช้สำหรับ invite/assign), **Board module** (CRUD board + membership), **Column module** (CRUD column + reordering), **Card module** (CRUD card + การย้าย/reorder ข้าม column), และ **Label module** (CRUD label ระดับ board + ผูก label กับ card)

Frontend แบ่งเป็น: **Auth views** (login/register), **Board list view**, **Board detail view** (แสดง column + card พร้อม drag-and-drop), **Card detail modal/panel**, และ **shared API client + state store**

### 3.3 Authentication Contract

ใช้ JWT (JSON Web Token) แบบ stateless ผู้ใช้ login แล้วได้รับ access token (อายุสั้น เช่น 15–60 นาที) เก็บฝั่ง client ทุก request ที่ต้อง auth ส่ง token ผ่าน header `Authorization: Bearer <token>` Backend ตรวจสอบ token ทุก request และดึง `user_id` จาก payload รหัสผ่าน hash ด้วย bcrypt (cost ≥ 10) หรือ argon2 ก่อนเก็บลง DB **ห้าม**เก็บ plaintext password ในกรณีต้องการ "stay logged in" ระยะยาว ให้ออกแบบ refresh token แยก (optional ใน MVP)

### 3.4 Authorization Model (MVP — แบบเรียบง่าย)

MVP ใช้โมเดล authorization 2 ระดับเท่านั้น: **owner** (ผู้สร้าง board — ลบ board / จัดการสมาชิกได้) และ **member** (สมาชิกที่ถูกเชิญ — สร้าง/แก้ไข/ลบ column และ card ได้ทั้งหมด แต่ลบ board ไม่ได้) ผู้ที่ไม่ใช่ owner หรือ member ของ board เข้าถึง board นั้นไม่ได้เลย การ enforce ทำที่ backend ทุก endpoint โดยตรวจว่า `user_id` เป็นสมาชิกของ board ที่เกี่ยวข้องก่อนเสมอ (ไม่เชื่อถือ client) ระบบ role ละเอียด (viewer/editor/admin) เลื่อนไป Phase ถัดไป

### 3.5 Ordering Strategy (สำคัญ)

ลำดับของ column ภายใน board และ card ภายใน column เก็บด้วยฟิลด์ `position` แบบ **fractional/float** (หรือ lexicographic rank string) ไม่ใช่ integer index ต่อเนื่อง เพื่อให้การย้าย 1 รายการไม่ต้อง re-write ทุก record ในคอลัมน์ เมื่อย้าย card ไปแทรกระหว่าง card A (position 1.0) และ B (position 2.0) ระบบกำหนด position ใหม่เป็นค่ากึ่งกลาง (1.5) Backend ทำ periodic rebalancing เมื่อ precision เริ่มตัน แนวทางนี้รองรับ drag-and-drop ที่ตอบสนองเร็วโดยอัปเดต record เดียว

### 3.6 Data Model / Schema (เชิงตรรกะ)

ตารางหลักและความสัมพันธ์ (ใช้ UUID เป็น primary key, มี `created_at` / `updated_at` ทุกตาราง):

- **users** — `id`, `email` (unique), `password_hash`, `display_name`
- **boards** — `id`, `name`, `owner_id` (→ users)
- **board_members** — `id`, `board_id` (→ boards), `user_id` (→ users), `role` (`owner` | `member`); unique (board_id, user_id) — ตารางเชื่อม many-to-many สำหรับสมาชิก board
- **columns** — `id`, `board_id` (→ boards), `name`, `position` (float)
- **cards** — `id`, `column_id` (→ columns), `title`, `description` (nullable), `assignee_id` (→ users, nullable), `due_date` (nullable), `position` (float)
- **labels** — `id`, `board_id` (→ boards), `name`, `color`
- **card_labels** — `card_id` (→ cards), `label_id` (→ labels); composite PK — เชื่อม card กับ label แบบ many-to-many

กฎ cascade: ลบ board → ลบ column, card, label, membership ที่เกี่ยวข้อง; ลบ column → ลบ card ในนั้น; ลบ label → ลบ row ใน card_labels เท่านั้น (ไม่ลบ card) ใส่ index บน foreign key ที่ query บ่อย: `columns.board_id`, `cards.column_id`, `board_members.user_id`

### 3.7 API Contract (REST)

ทุก endpoint (ยกเว้น auth) ต้องมี valid token และผ่านการตรวจ membership ของ board ที่เกี่ยวข้อง ใช้ HTTP status มาตรฐาน (200/201 สำเร็จ, 400 input ผิด, 401 ไม่ได้ auth, 403 ไม่มีสิทธิ์, 404 ไม่พบ, 409 conflict)

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

### 3.8 Frontend State & Optimistic UI

Frontend โหลด full board snapshot จาก `GET /boards/:id` ครั้งเดียวเก็บใน client state store (เช่น Redux/Zustand/React Query) การ render board อิงจาก state นี้ การลาก-ย้าย card ใช้ **optimistic update**: อัปเดต UI ทันทีที่ผู้ใช้ drop แล้วยิง `PATCH /cards/:id` เบื้องหลัง หาก API ล้มเหลวให้ rollback state กลับและแจ้ง error การ poll ทุก ~10 วินาทีดึง snapshot ใหม่มา reconcile (last-write-wins ใน MVP — ยังไม่ทำ conflict merge ละเอียด)

ไลบรารี drag-and-drop แนะนำเป็น library ที่ดูแลต่อเนื่องและรองรับ accessibility/keyboard (เช่น dnd-kit) — ตัดสินใจหลีกเลี่ยง library ที่หยุด maintain แล้ว

### 3.9 Concurrency & Conflict (MVP)

เนื่องจาก MVP ใช้ polling + last-write-wins การแก้ field เดียวกันพร้อมกันจาก 2 คน ผลลัพธ์คือคนที่บันทึกทีหลังชนะ ถือว่ายอมรับได้สำหรับทีมเล็ก สำหรับการย้าย card ที่ position ชนกัน backend จะ assign position ใหม่ให้เสมอ ดังนั้นจะไม่เกิด card ทับซ้อนที่ position เดียวกัน

### 3.10 Validation Rules (ระดับ contract)

`board.name` และ `column.name` ต้องไม่ว่างและยาวไม่เกิน 100 ตัวอักษร, `card.title` ต้องไม่ว่าง ยาวไม่เกิน 255, `card.description` ไม่เกิน ~5,000 ตัวอักษร, `label.color` ต้องเป็นค่า hex color ที่ valid, การเชิญสมาชิกต้องเป็น email ที่มี user อยู่ในระบบแล้ว (MVP ยังไม่ทำ invite ผู้ที่ยังไม่สมัคร) Validation ทำทั้งฝั่ง client (UX) และ backend (authoritative)

---

## 4. UI/UX Guidelines

### 4.1 Layout & Hierarchy

หน้า board เป็น column วางเรียงแนวนอนและ scroll แนวนอนได้ ความกว้าง column คงที่ ~280–320px card สูงตามเนื้อหา ใช้ whitespace และเส้นแบ่งบางแทนกรอบหนา เพื่อให้สายตาโฟกัสที่ card หัวแต่ละ column แสดงชื่อพร้อมตัวนับจำนวน card ช่วยให้เห็นภาระงานทันที แถบบนสุด (top bar) แสดงชื่อ board, avatar สมาชิก และปุ่ม invite

### 4.2 Card Design

หน้า card แสดงเฉพาะข้อมูลที่ scan เร็ว ได้แก่ แถบ label สีด้านบน, title, avatar ผู้รับผิดชอบ และ due date เป็น chip รายละเอียดเต็ม (description, การจัดการ label, assignee) เปิดใน modal หรือ side-panel เมื่อคลิก card — ไม่ยัดทุกอย่างลงบนหน้า card

### 4.3 Drag-and-Drop Affordance

จุดสำคัญที่สุดของ Kanban ขณะลากต้องมี placeholder/ghost ชี้ตำแหน่ง drop ชัดเจน card ที่ลากยกขึ้นด้วย shadow และเอียงเล็กน้อย column เป้าหมาย highlight ระหว่าง hover ต้องรองรับการลากด้วยคีย์บอร์ด (accessibility)

### 4.4 Color & State

สีพื้นเป็น neutral ให้ label และสถานะเป็นตัวเดินสี ใช้สีเชิงความหมายสม่ำเสมอ (overdue = แดง, ใกล้ครบกำหนด = เหลือง) และ**ห้าม**สื่อความหมายด้วยสีอย่างเดียว ต้องเติม icon หรือข้อความกำกับด้วยเสมอ (รองรับผู้ใช้ตาบอดสี ตาม WCAG)

### 4.5 Empty & Loading States

board ที่ยังไม่มี column และ column ที่ยังไม่มี card ต้องมี empty state ที่ชวนลงมือ (เช่น "+ เพิ่ม column แรก") การ poll refresh ต้องเงียบ ไม่กระพริบทั้งหน้า — อัปเดตเฉพาะส่วนที่เปลี่ยน

### 4.6 Responsive

บนแท็บเล็ตให้ column แคบลงและ scroll แนวนอนได้ บนจอเล็กพิจารณาแสดงทีละ column พร้อมตัวสลับ touch target ทุกปุ่มอย่างน้อย 44×44px

### 4.7 ASCII Mockup — Board Detail View

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

### 4.8 ASCII Mockup — Card Detail Panel

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

---

## 5. ข้อมูลเสริมสำหรับการพัฒนา

### 5.1 ลำดับการพัฒนาแนะนำ (Milestones)

เริ่มจาก Auth + User (รากฐาน) → Board CRUD + membership → Column CRUD → Card CRUD → Drag-and-drop + ordering → Labels + due date + assignee → Polling refresh → ขัดเกลา UX และ validation ปลายทาง แต่ละ milestone ควรมี API ใช้งานได้จริงก่อนต่อ frontend

### 5.2 Acceptance Criteria ตัวอย่าง (flow หลัก)

การลากย้าย card ถือว่าผ่านเมื่อ: ผู้ใช้ลาก card จาก column A ไป column B แล้ว card ปรากฏใน B ทันที, รีเฟรชหน้าแล้ว card ยังอยู่ที่ B (persist สำเร็จ), และถ้า API ล้มเหลว card เด้งกลับ A พร้อมข้อความ error การเชิญสมาชิกถือว่าผ่านเมื่อ: owner กรอก email ของ user ที่มีอยู่ → สมาชิกเห็น board ใน list ของตนเมื่อ login และแก้ card ได้ แต่ลบ board ไม่ได้

### 5.3 Edge Cases ที่ต้องจัดการ

ลบ column ที่มี card อยู่ (ต้องยืนยันและ cascade), ย้าย card ขณะมีคนอื่นลบ card นั้นไปแล้ว (คืน 404, frontend ลบออกจาก state), board ว่าง (ไม่มี column) ต้องแสดง empty state ที่ชวนสร้าง column แรก, due date ในอดีตต้อง highlight เป็น overdue, สมาชิกถูกถอดออกจาก board ขณะเปิดอยู่ (poll ครั้งถัดไปได้ 403 → เด้งออกพร้อมข้อความ)

### 5.4 Testing Strategy (สรุป)

Unit test สำหรับ business logic (โดยเฉพาะ position/ordering algorithm และ authorization check), integration test สำหรับทุก API endpoint รวม happy path + auth failure + permission failure, และ end-to-end test สำหรับ flow หลัก: register → สร้าง board → สร้าง column/card → ลากย้าย → รีเฟรชแล้วข้อมูลคงอยู่ ควรมี test เฉพาะสำหรับ ordering edge case (แทรกหัว/ท้าย/กลาง และ rebalancing)

### 5.5 ข้อสมมติ (Assumptions)

ถือว่าทีมขนาดเล็กและปริมาณ card ต่อ board ไม่เกินหลักร้อย จึงโหลด full snapshot ได้ ถ้าในอนาคต board ใหญ่ขึ้นมากต้องเพิ่ม pagination/lazy-load ต่อ column ถือว่าผู้ใช้ทุกคนสมัครสมาชิกก่อน จึง assign/invite ด้วย email ที่มีในระบบเท่านั้น และถือว่า MVP ยังไม่ต้องรองรับ offline mode
