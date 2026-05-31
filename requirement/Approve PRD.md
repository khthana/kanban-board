# Approved PRD — Kanban Board (Frontend + Mock Backend Build)

**สถานะ:** Approved v1.0
**อ้างอิงจาก:** [Kanban-Board-PRD.md](./Kanban-Board-PRD.md) (Draft v1.0)
**ขอบเขตรอบนี้:** Frontend-only + Mock backend ในเบราว์เซอร์
**วันที่อนุมัติ:** 31 พฤษภาคม 2026

---

## 0. ที่มาของเอกสารฉบับนี้

PRD ต้นฉบับออกแบบระบบเป็น full-stack (React + Node.js + PostgreSQL) แต่ repository ปัจจุบันเป็นเพียง Create React App scaffold เปล่า (React 19, ยังไม่มี backend/DB/router/state)

จากการ grill ข้อกำหนดร่วมกัน ได้ข้อสรุปว่า **รอบนี้จะสร้างเฉพาะ frontend** โดยมี **mock API client** ที่เลียนแบบ REST contract ใน PRD ต้นฉบับ (§3.7) คุยกับ "server จำลอง" ที่เก็บ state ใน localStorage เป้าหมายคือได้ Kanban ที่กดเล่นได้จริงในเบราว์เซอร์ทันที และเปลี่ยนไปต่อ Node backend จริงในอนาคตได้โดยแก้แค่ไส้ในของ API client ชั้นเดียว — ไม่ต้องแตะ UI, state หรือ data model

เอกสารนี้บันทึก **เฉพาะการตัดสินใจที่ override หรือเพิ่มเติมจาก PRD ต้นฉบับ** ส่วนที่ไม่กล่าวถึงให้ยึดตาม PRD ต้นฉบับ

---

## 1. การตัดสินใจที่อนุมัติแล้ว (Locked Decisions)

| หัวข้อ | ตัดสินใจ | override PRD เดิม? |
|---|---|---|
| **ขอบเขต** | Frontend + mock API client + localStorage persistence | ใช่ — เลื่อน Node/PostgreSQL ออกไป Phase ถัดไป |
| **Identity / Auth** | **User-switcher** — seed ผู้ใช้หลายคน (Alice/Bob/…) มี dropdown เลือกว่า "ตอนนี้เราเป็นใคร" ไม่มีหน้า login จริง | ใช่ — §3.3 JWT/bcrypt เป็นของจริงไม่ได้เพราะไม่มี server |
| **State management** | **Zustand** + `persist` middleware (localStorage) | เลือก 1 ใน option ที่ §3.8 เปิดไว้ |
| **Mock fidelity** | เต็มรูปแบบ — async Promise + หน่วงเวลา, toggle บังคับ fail (โชว์ rollback), cross-tab sync ผ่าน `storage` event (จำลอง polling ~10s) | เพิ่มเติม — วิธีจำลองพฤติกรรม §3.1/§3.8 บนเครื่องเดียว |
| **Styling** | **CSS Modules** (มากับ CRA ไม่ต้องตั้ง build config) | เพิ่มเติม |
| **Card detail** | **Side-panel** เลื่อนเข้าจากขวา (board ยังเห็นด้านหลัง) | เลือกจาก "modal หรือ side-panel" ที่ §4.2 เปิดไว้ |
| **Drag-and-drop** | **dnd-kit** (`@dnd-kit/core` + `@dnd-kit/sortable`) | ยึดตาม §3.8 |
| **Ordering** | **Fractional float `position`** | ยึดตาม §3.5 |
| **Routing** | **react-router-dom** | เพิ่มเติม |
| **Seed data** | บอร์ดตัวอย่าง "Project Phoenix" ตาม mockup §4.7 | เพิ่มเติม |

---

## 2. Trade-offs ที่ยอมรับ

เนื่องจากไม่มี server จริงในรอบนี้:

- **Auth เป็นของจำลอง** — ไม่มี password hashing/JWT จริง การ "เป็นใคร" มาจาก user-switcher
- **Collaboration เป็น single-machine** — invite teammate, assignee, polling refresh จาก "คนอื่น" จำลองด้วย user-switcher + cross-tab sync (เปิดหลายแท็บ) ไม่ใช่ multi-user ข้ามเครื่องจริง
- **ปริมาณข้อมูล** — เก็บใน localStorage เหมาะกับ card หลักร้อยใบตามข้อสมมติ §5.5

ส่วนที่ยังคงทำงาน *จริง* และ demo ได้ครบ: board/column/card CRUD, drag-and-drop + fractional ordering, optimistic update + rollback, persist ข้าม refresh, label/due-date/assignee, owner-vs-member authorization, edge cases (404/403/cascade)

---

## 3. สถาปัตยกรรม (Seam สำหรับสลับ backend ภายหลัง)

```
UI components ─► Zustand store (optimistic, persisted) ─► API client (รูปแบบ method ตาม PRD §3.7)
                                                                │
                                                        mockBackend ("server" จำลอง:
                                                        canonical state ใน localStorage,
                                                        latency, failure toggle,
                                                        membership/authz checks,
                                                        broadcast การเปลี่ยนข้ามแท็บ)
```

**จุดสลับ (swap point)** คือ API client — method (`getBoards`, `getBoard`, `createBoard`, `patchCard`, `moveCard`, `addMember`, …) มีชื่อและ semantics ตรงตาม PRD §3.7 วันนี้เรียก `mockBackend`; วันหน้าเปลี่ยนเป็น `fetch()` ยิง Node API จริงโดยผู้เรียกไม่ต้องแก้

**Authorization** อยู่ใน `mockBackend` เสมอ (ไม่เชื่อ caller): ทุก operation ตรวจว่า current user เป็นสมาชิกของ board ที่เกี่ยวข้อง; การลบ board / จัดการสมาชิก ตรวจ role `owner`

---

## 4. Domain Glossary (ภาษากลางของระบบ)

> ใช้คำเหล่านี้ให้สม่ำเสมอทั้งในโค้ดและการสื่อสาร

- **Board** — workspace ที่มี User หนึ่งคนเป็น owner ภายในมี Column และ Label และมี Member
- **Column** — stage ของ workflow ที่เรียงลำดับภายใน Board (เช่น To Do) ภายในมี Card
- **Card** — งานหนึ่งชิ้นภายใน Column มี title, description (optional), assignee, due date, labels และ `position`
- **Member** — User ที่เข้าถึง Board ได้ role เป็น **owner** (ผู้สร้าง — ลบ board / จัดการสมาชิกได้) หรือ **member** (CRUD column/card ได้ทั้งหมด แต่ลบ board ไม่ได้)
- **Assignee** — Member คนเดียวที่รับผิดชอบ Card (คนละความหมายกับผู้สร้าง card)
- **Position** — ค่า ordering แบบ fractional float แทรกระหว่าง A(1.0) กับ B(2.0) ได้ 1.5 ไม่ใช่ index ต่อเนื่อง
- **Current User** — ในโหมด mock คือ identity ที่เลือกผ่าน user-switcher ใช้เป็น "เราเป็นใคร" ในการตรวจ auth/authz
- **Overdue** — Card ที่ due date เลยวันปัจจุบันไปแล้ว

---

## 5. โครงไฟล์ที่วางแผนไว้

```
src/
  index.js                      (เดิม — ครอบด้วย BrowserRouter)
  App.js                        (เขียนใหม่ — routes + session)
  routes/
    BoardListPage.jsx           GET /boards
    BoardPage.jsx               GET /boards/:id (full snapshot)
  api/
    client.js                   API surface ตาม PRD §3.7 (จุดสลับ)
    mockBackend.js              "server" บน localStorage: authz, latency, failure toggle, cross-tab broadcast
  domain/
    ordering.js                 positionBetween, needsRebalance, rebalance — pure, unit-tested
    validation.js               กฎ §3.10
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
CONTEXT.md  (root)              glossary ข้อ 4
```

Dependencies ที่ต้องเพิ่ม: `zustand`, `react-router-dom`, `@dnd-kit/core`, `@dnd-kit/sortable`, `@dnd-kit/utilities`, `uuid`

---

## 6. Milestones (แต่ละอันรันได้จริง)

- **M0 — Scaffold & seam:** ลง deps; เขียน `CONTEXT.md`; routing; โครง `mockBackend` + `client`; `useSession` + UserSwitcher; `seed.js`; ต่อ persist → boot แล้วเห็น board list ของ user ที่ seed
- **M1 — Boards:** board list, create/rename/delete (owner-only), membership; authz ใน `mockBackend`
- **M2 — Columns:** create/rename/delete + empty states; column ordering ผ่าน `domain/ordering`
- **M3 — Cards:** create/edit/delete; CardPanel side-panel (title/description); ตัวนับ card ที่หัว column
- **M4 — Drag-and-drop + ordering:** dnd-kit ย้าย/reorder card + reorder column; fractional `position`; optimistic + rollback เมื่อบังคับ fail; placeholder/ghost; รองรับคีย์บอร์ด
- **M5 — Collaboration fields:** assignee picker, label สี (ระดับ board + ผูก card), due date + overdue highlight (สี + icon/ข้อความ ตาม WCAG), invite dialog (เฉพาะ user ที่ seed ไว้)
- **M6 — Polling/reconcile + edge cases:** `usePolling` cross-tab reconcile (last-write-wins); card ถูกลบ → เอาออกจาก state (404); member ถูกถอด → เด้งออก (403); ลบ column → ยืนยัน + cascade
- **M7 — Polish:** loading/empty states ไม่กระพริบทั้งหน้า, responsive (column แคบ + scroll แนวนอน, touch target ≥44px), neutral palette ให้ label เป็นตัวเดินสี

---

## 7. Verification (เกณฑ์ตรวจรับ)

**Unit tests** (`npm test -- --watchAll=false`): `ordering.test.js` (แทรกหัว/ท้าย/กลาง + rebalance), `validation.test.js` (กฎ §3.10), authz checks ใน mockBackend

**Manual** (`npm start`) — เดินตาม acceptance flow ของ PRD §5.2:

1. สลับเป็น user ที่ seed → เห็น "Project Phoenix" ใน board list
2. สร้าง board → เพิ่ม column → เพิ่ม card
3. ลาก card A→B: ปรากฏใน B ทันที; refresh แล้วยังอยู่ B (localStorage persist)
4. เปิด toggle บังคับ fail → ลาก card → เด้งกลับพร้อม error (rollback)
5. เปิด 2 แท็บเป็นคนละ user; ย้าย card ในแท็บหนึ่ง → อีกแท็บเห็นตาม (cross-tab polling)
6. invite user ที่ seed (ในฐานะ owner) → สลับเป็น user นั้น → เห็น board ใน list, แก้ card ได้ แต่ลบ board ไม่ได้ (owner-only)
7. ตั้ง due date ในอดีต → card highlight overdue (สี + icon/ข้อความ)
8. ลบ column ที่มี card → ยืนยัน → cascade ลบ card ในนั้น
