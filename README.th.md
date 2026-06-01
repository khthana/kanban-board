# Kanban Board

แอปพลิเคชัน Kanban Board สำหรับทีมขนาดเล็ก (2–15 คน) ลาก-วางการ์ดข้ามคอลัมน์ มอบหมายงาน กำหนดวันครบกำหนด และเพิ่มป้ายกำกับ — ซิงค์แบบ real-time ผ่าน polling

## เทคโนโลยีที่ใช้

- **React 19** — UI
- **Zustand** — จัดการ state พร้อม optimistic updates
- **dnd-kit** — drag-and-drop (รองรับทั้ง pointer และคีย์บอร์ด)
- **React Router v7** — client-side routing

## สิ่งที่ต้องติดตั้งก่อน

- Node.js 18+
- Backend [kanban-board-api](https://github.com/khthana/kanban-board-api) ที่รันอยู่บน port 4000

## เริ่มต้นใช้งาน

```bash
npm install
npm start        # dev server ที่ http://localhost:3000
```

CRA proxy จะส่ง API request ทั้งหมดไปยัง `http://localhost:4000` โดยอัตโนมัติ ไม่ต้องตั้งค่า CORS เพิ่มเติมในการพัฒนา

## Environment Variables

```bash
# .env.development.local (ไม่บังคับ — ค่าเริ่มต้นคือ http://localhost:4000)
REACT_APP_API_URL=http://localhost:4000
```

สำหรับ production ให้กำหนด `REACT_APP_API_URL` เป็น URL ของ backend ก่อน build

## คำสั่งที่ใช้ได้

```bash
npm start                        # dev server
npm test                         # watch mode
npm test -- --watchAll=false     # CI mode (42 tests)
npm run build                    # production build
```

## สถาปัตยกรรม

```
src/
├── api/
│   └── client.js          # fetch client — JWT header, จัดการ 401, แปลง snake_case→camelCase
├── store/
│   ├── useSession.js       # JWT auth (login / register / logout)
│   └── useBoardStore.js    # board state + optimistic mutations
├── hooks/
│   └── usePolling.js       # polling ทุก 10 วินาทีสำหรับ cross-tab sync
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
    ├── CardPanel.jsx        # side-panel รายละเอียดการ์ด
    ├── TopBar.jsx           # avatar สมาชิก + ปุ่ม invite
    └── InviteDialog.jsx
```

### การตัดสินใจทางสถาปัตยกรรม

**Fractional float positions** — ตำแหน่งของการ์ดและคอลัมน์เก็บเป็น float (`1.0`, `1.5`, `1.25` …) การลาก-วางอัปเดตเพียง record เดียว Backend จะ rebalance ตำแหน่งเมื่อความแม่นยำหมด (ช่องว่าง < 1e-9)

**Optimistic UI** — ทุก mutation จะ snapshot state, อัปเดต local ทันที แล้วเรียก API ถ้าเกิด error จะ restore snapshot และแสดง error banner

**JWT auth** — token เก็บใน `localStorage` ทุก request แนบ `Authorization: Bearer <token>` ถ้าได้รับ 401 จะล้าง token และ redirect ไป `/login`

**Polling** — เรียก `GET /boards/:id` ทุก 10 วินาทีเพื่อ sync ข้อมูลระหว่าง tab ถ้าได้รับ 403 จะกลับไปหน้ารายการ board ถ้าได้รับ 404 จะนำทางออก

## ฟีเจอร์

- สมัครสมาชิก / เข้าสู่ระบบ / ออกจากระบบ
- สร้าง, เปลี่ยนชื่อ, ลบ board (เฉพาะเจ้าของ)
- สร้าง, เปลี่ยนชื่อ, ลบคอลัมน์
- สร้าง, แก้ไข, ลบการ์ด พร้อมชื่อ, รายละเอียด, ผู้รับผิดชอบ, วันครบกำหนด
- ลากการ์ดภายในและข้ามคอลัมน์
- ลากคอลัมน์เพื่อจัดลำดับ
- ป้ายกำกับ — สร้างด้วยสีเป็น hex, แนบ/ถอดออกต่อการ์ด
- เชิญสมาชิกด้วย email, ลบสมาชิก (เฉพาะเจ้าของ)
- ไฮไลต์การ์ดที่เลยกำหนด (ขอบแดง + ไอคอน ⚠)
- sync ข้ามแท็บผ่าน polling (~10 วินาที)
