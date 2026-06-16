# Kanban Board

[🇬🇧 Read in English](README.md)

แอปพลิเคชัน Kanban Board สำหรับทีมขนาดเล็ก (2–15 คน) ลาก-วางการ์ดข้ามคอลัมน์ มอบหมายผู้รับผิดชอบได้หลายคน กำหนดวันครบกำหนด จัดระเบียบด้วยป้ายกำกับและ **category** หลัก ติดตามงานด้วยงานย่อย และทำเครื่องหมายว่าการ์ดเสร็จแล้ว — ซิงค์แบบเกือบ real-time ผ่าน polling

## เทคโนโลยีที่ใช้

- **React 19** — UI
- **Zustand** — จัดการ state พร้อม optimistic updates
- **dnd-kit** — drag-and-drop (รองรับทั้ง pointer และคีย์บอร์ด)
- **React Router v7** — client-side routing
- **react-datepicker** — ตัวเลือกวันครบกำหนด (`dd/MM/yyyy`)

Backend ([kanban-board-api](https://github.com/khthana/kanban-board-api)) เป็นบริการแยกต่างหาก Node.js + Express + PostgreSQL รันบน port 4000

## สิ่งที่ต้องติดตั้งก่อน

- Node.js 18+
- Docker (แนะนำสำหรับ dev แบบ full-stack) **หรือ** backend [kanban-board-api](https://github.com/khthana/kanban-board-api) ที่รันอยู่บน port 4000

## เริ่มต้นใช้งาน

### ตัวเลือก A — Docker (full stack)

รัน postgres + api + frontend พร้อมกัน frontend เปิดที่ **port 3600**

```bash
# ครั้งแรกเท่านั้น
npm install && npx playwright install chromium

docker compose up           # postgres + api + frontend (http://localhost:3600)
docker compose down         # หยุดทั้งหมด
docker compose down -v      # หยุดและลบ volume ของฐานข้อมูล
```

### ตัวเลือก B — frontend อย่างเดียว

ต้องมี backend รันอยู่บน port 4000 แล้ว

```bash
npm install
npm start                   # dev server ที่ http://localhost:3000
```

ในโหมด dev `src/setupProxy.js` จะส่ง API request ไปยัง `http://localhost:4000` โดยอัตโนมัติ — ไม่ต้องตั้งค่า CORS เพิ่มเติม

## Environment Variables

```bash
# .env.development.local (ไม่บังคับ — ค่าเริ่มต้นคือ http://localhost:4000)
REACT_APP_API_URL=http://localhost:4000
```

สำหรับ production ให้กำหนด `REACT_APP_API_URL` เป็น URL ของ backend ก่อน build

## คำสั่งที่ใช้ได้

```bash
npm start                                # dev server (http://localhost:3000)
npm test                                 # watch mode
npm test -- --watchAll=false             # รัน unit tests ครั้งเดียว (111 tests)
npm test -- --testPathPattern="polling"  # รัน test ไฟล์เดียว
npm run build                            # production build
npm run test:e2e                         # Playwright E2E (28 tests, ต้องใช้ full stack)
```

E2E tests มีโอกาส flaky เมื่อรันแบบ parallel (Postgres ตัวเดียวร่วมกัน → contention) ใช้ `npx playwright test --workers=1` เพื่อให้ผ่านแบบแน่นอน หรือ `npx playwright test --ui` สำหรับโหมด interactive

## สถาปัตยกรรม

`src/` แบ่งเป็นชั้น — logic บริสุทธิ์อยู่ใน `domain/`, network อยู่ใน `api/`, state อยู่ใน `store/`, และ component ฟีเจอร์อยู่ใน `components/` ไฟล์ CSS modules และ `.test.js` วางคู่กับ source

```
src/
├── api/
│   └── client.js          # fetch client — JWT header, 401 silent refresh, แปลง snake_case↔camelCase
├── store/
│   ├── useSession.js      # JWT auth (login / register / logout / profile)
│   └── useBoardStore.js   # board state + optimistic mutations (ตัวช่วย optimistic())
├── hooks/
│   └── usePolling.js      # polling ทุก 10 วินาทีสำหรับ cross-tab sync
├── domain/                # logic บริสุทธิ์ มี unit test
│   ├── ordering.js        # positionBetween, needsRebalance, rebalance
│   ├── validation.js      # client-side field validation
│   ├── dates.js           # ตัวช่วยวันที่ YYYY-MM-DD แบบ timezone-safe, ตรวจ overdue
│   ├── colors.js          # ชุดสี swatch สำเร็จรูป
│   ├── progress.js        # มุมมองความคืบหน้างานย่อยแบบ adaptive
│   ├── accent.js          # แปลง category ของการ์ด → สี accent
│   ├── completion.js      # สถานะ done ต่อการ์ด (isDone / completionPatch)
│   └── titleEdit.js       # การตัดสินใจ commit ชื่อการ์ด inline (save / revert / error)
├── routes/
│   ├── LoginPage.jsx
│   ├── RegisterPage.jsx
│   ├── BoardListPage.jsx
│   ├── BoardPage.jsx      # drag-and-drop board
│   ├── ProfilePage.jsx
│   └── RequireAuth.jsx    # auth guard
└── components/
    ├── Column.jsx          # คอลัมน์ รองรับ accent theming
    ├── Card.jsx            # หน้าการ์ดแบบ editorial (category, ชื่อ, วันครบกำหนด, ความคืบหน้า)
    ├── CardPanel.jsx       # side-panel รายละเอียดการ์ด
    ├── CardComposer.jsx
    ├── LabelPicker.jsx     # แนบ/สร้าง/แก้ป้ายกำกับ, ตั้ง category (★)
    ├── AssigneePicker.jsx  # toggle ผู้รับผิดชอบหลายคน
    ├── DueDateField.jsx
    ├── TopBar.jsx          # avatar สมาชิก + ปุ่ม invite
    ├── InviteDialog.jsx
    └── common/             # Avatar, AvatarStack, Toast, ColorPicker
```

### การตัดสินใจทางสถาปัตยกรรม

**Fractional float positions** — ตำแหน่งของการ์ด, คอลัมน์, และงานย่อยเก็บเป็น float (`1.0`, `1.5`, `1.25` …) การลาก-วางและจัดลำดับอัปเดตเพียง record เดียว Backend จะ rebalance เมื่อความแม่นยำหมด (ช่องว่าง < 1e-9)

**Optimistic UI** — ทุก mutation จะ snapshot state, อัปเดต local ทันที แล้วเรียก API ถ้าเกิด error จะ restore snapshot

**JWT auth with refresh tokens** — access token 60 นาที + refresh token 7 วัน เก็บใน `localStorage` เมื่อได้รับ 401 จะ refresh เงียบๆ (single in-flight) ถ้าล้มเหลวจะล้างทั้งสอง token และ redirect ไป `/login`

**Polling** — เรียก `GET /boards/:id` ทุก 10 วินาทีเพื่อ sync ข้อมูลระหว่าง tab ถ้าได้รับ 403 จะกลับไปหน้ารายการ board ถ้า 404 จะนำทางออก

**Editorial card** ([ADR-0002](docs/adr/0002-card-editorial-model.md)) — หน้าการ์ดแบบ type-forward: จุด category + ชื่อพิมพ์ใหญ่, ชื่อเรื่องเด่น, วันครบกำหนด, และความคืบหน้างานย่อยแบบ adaptive

**Category** ([ADR-0002](docs/adr/0002-card-editorial-model.md)) — ป้ายกำกับหนึ่งตัวต่อการ์ดเป็น **category** ซึ่งเป็นป้ายเดียวที่แสดงบนหน้าการ์ด และสีของมันกลายเป็นสี accent ของการ์ด ส่วนป้ายอื่นจัดการใน panel

**Column accent** ([ADR-0001](docs/adr/0001-column-accent-model.md)) — สี (optional) ที่ธีมทั้งคอลัมน์ (chip, พื้นจาง, ตัวเลขนับ, ปุ่มเพิ่มการ์ด) ไม่ใช่แค่แถบ header

**Card completion** ([ADR-0003](docs/adr/0003-card-completion-model.md)) — สถานะ done ต่อการ์ด เก็บเป็น `completed_at DATE` แยกจากคอลัมน์ สลับใน panel หน้าการ์ดแสดงป้าย ✓ และวันที่เสร็จ

**Subtasks** — สูงสุด 20 ต่อการ์ด เก็บด้วย float position รองรับ toggle, แก้ชื่อ inline, จัดลำดับ, ลบ มีความคืบหน้าแบบ adaptive (segment ≤ 8, mini-bar > 8) บนหน้าการ์ด

## ฟีเจอร์

- สมัครสมาชิก / เข้าสู่ระบบ / ออกจากระบบ ด้วย refresh tokens
- สร้าง, เปลี่ยนชื่อ, ลบ board (เฉพาะเจ้าของ)
- สร้าง, เปลี่ยนชื่อ, ลบคอลัมน์ — **สี accent ของคอลัมน์** ธีมทั้งคอลัมน์
- สร้าง, แก้ไข, ลบการ์ด — **แก้ชื่อ inline ใน panel**, รายละเอียด, วันครบกำหนด
- **Category** — เลื่อนป้ายกำกับหนึ่งตัวขึ้นหน้าการ์ด, จัดการป้ายทั้งหมดใน panel
- **ผู้รับผิดชอบหลายคน** ต่อการ์ด แสดงเป็น avatar ซ้อนกัน
- **งานย่อย** — เพิ่ม, ติ๊ก, แก้ชื่อ inline, จัดลำดับ, ลบ + ตัวบ่งชี้ความคืบหน้าบนการ์ด
- **การทำเครื่องหมายว่าเสร็จ** — mark/un-mark done; ป้าย ✓, จางลง, และวันที่เสร็จบนการ์ด
- ลากการ์ดภายในและข้ามคอลัมน์; ลากคอลัมน์เพื่อจัดลำดับ
- ป้ายกำกับ — สร้างและแก้ไข (ชื่อ + สี hex), แนบ/ถอดออกต่อการ์ด
- เชิญสมาชิกด้วย email, ลบสมาชิก (เฉพาะเจ้าของ)
- โปรไฟล์ผู้ใช้ — แก้ไข display name, email, เปลี่ยนรหัสผ่าน
- ไฮไลต์การ์ดที่เลยกำหนด
- sync ข้ามแท็บผ่าน polling (~10 วินาที)

## เอกสาร

- **Product requirements**: [requirement/](requirement/) — PRD แยกตามฟีเจอร์
- **Architecture decisions**: [docs/adr/](docs/adr/)
- **Domain glossary**: [CONTEXT.md](CONTEXT.md)
- **คู่มือ contributor / agent**: [CLAUDE.md](CLAUDE.md)
