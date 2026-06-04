# PRD — User Profile Page

**สถานะ:** Draft v1.0
**ขอบเขต:** New Feature — ต่อจาก Kanban Board MVP
**วันที่:** 4 มิถุนายน 2026

---

## Problem Statement

ปัจจุบัน user ไม่มีทางดูหรือแก้ไขข้อมูลบัญชีของตนเองได้เลย — ทั้ง display name, email และ password ถูกกำหนดตอน register แล้วเปลี่ยนไม่ได้ ทำให้ user ที่พิมพ์ชื่อผิด, ต้องการเปลี่ยน email, หรืออยากเปลี่ยน password ต้องสร้างบัญชีใหม่หรือติดต่อ admin

---

## Solution

เพิ่มหน้า **Profile** ที่ให้ user แก้ไขข้อมูลส่วนตัวได้ โดยแบ่งเป็น 2 ส่วนในหน้าเดียว:
1. แก้ `displayName` และ `email`
2. เปลี่ยน password (ต้องยืนยัน current password ก่อน)

เข้าถึงได้จาก dropdown ใน TopBar และ route `/profile` โดยตรง การแก้ไขสำเร็จจะอัปเดต TopBar ทันทีโดยไม่ต้อง refresh หน้า

---

## User Stories

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

---

## Implementation Decisions

### Backend (สร้างก่อน)

เพิ่ม 3 endpoints ใน User module ของ `kanban-board-api`:

```
GET    /users/me                → คืน { id, displayName, email }
PATCH  /users/me                → แก้ displayName / email; คืน 409 ถ้า email ซ้ำ
PATCH  /users/me/password       → body: { currentPassword, newPassword }; คืน 400 ถ้า currentPassword ผิด
```

- ทุก endpoint ต้อง auth (Bearer token)
- `PATCH /users/me/password` ตรวจ `currentPassword` ด้วย bcrypt ก่อน hash `newPassword` ใหม่
- `PATCH /users/me` คืน user object ที่อัปเดตแล้ว เพื่อให้ frontend sync state ได้ใน response เดียว

### Frontend — Session Store

เพิ่ม `displayName` และ `email` เข้า `useSession` store:

- โหลด `GET /users/me` ครั้งแรกหลัง token valid (app start / after login)
- `PATCH /users/me` สำเร็จ → update store ทันที → TopBar re-render อัตโนมัติ

### Frontend — Routing

เพิ่ม route `/profile` ที่ต้องผ่าน auth guard (เช่นเดียวกับ `/boards`)

### Frontend — TopBar Dropdown

เพิ่ม dropdown เมื่อคลิก avatar/ชื่อใน TopBar มีรายการ:
- Profile
- Logout

### Frontend — Profile Page Layout

**Section 1 — ข้อมูลส่วนตัว**
- Field: `displayName` (non-empty, ≤ 100 chars)
- Field: `email` (valid email format)
- Inline error ใต้ field `email` เมื่อ backend คืน 409
- ปุ่ม "บันทึก" — submit เฉพาะ section นี้

**Section 2 — เปลี่ยนรหัสผ่าน**
- Field: `currentPassword`
- Field: `newPassword` (≥ 8 ตัวอักษร)
- Field: `confirmPassword`
- Client-side validate: `newPassword === confirmPassword` และ length ≥ 8 ก่อนส่ง API
- Inline error ถ้า `currentPassword` ผิด (backend 400)
- ปุ่ม "เปลี่ยนรหัสผ่าน" — submit เฉพาะ section นี้

### Validation

| Field | Rule |
|---|---|
| `displayName` | non-empty, ≤ 100 chars (client + backend) |
| `email` | valid format (client), unique (backend 409) |
| `newPassword` | ≥ 8 chars (client + backend) |
| `confirmPassword` | === `newPassword` (client only) |

### Feedback Pattern

- สำเร็จ → toast notification (เหมือน pattern ที่ใช้ใน app)
- Field error (409 email, 400 wrong password) → inline error ใต้ field นั้น

---

## Testing Decisions

**หลักการ:** test พฤติกรรมที่ user มองเห็น ไม่ test implementation detail

### Backend Unit / Integration Tests
- `GET /users/me` — คืน user ที่ถูกต้อง, 401 ถ้าไม่มี token
- `PATCH /users/me` — อัปเดต displayName สำเร็จ, คืน 409 ถ้า email ซ้ำ
- `PATCH /users/me/password` — เปลี่ยนได้เมื่อ currentPassword ถูก, คืน 400 ถ้าผิด

### Frontend Unit Tests
- `positionBetween` และ domain logic อื่นๆ ที่เกี่ยวข้อง (ถ้ามี)
- Validation logic: `confirmPassword`, password length — เขียน pure function test เหมือน `src/domain/`

### E2E Tests (Playwright)
เพิ่มใน `e2e/profile.spec.js`:
- เปลี่ยน displayName → TopBar แสดงชื่อใหม่ทันที, persist หลัง refresh
- พยายามเปลี่ยน email เป็นที่ซ้ำ → เห็น inline error
- เปลี่ยน password ด้วย current password ถูก → login ด้วย password ใหม่ได้
- พยายามเปลี่ยน password ด้วย current password ผิด → เห็น error

Prior art: ดู `e2e/auth.spec.js` และ `e2e/board.spec.js` เป็นแนวทาง

---

## Out of Scope

- Avatar upload / รูปโปรไฟล์
- การลบบัญชี
- Notification preferences
- Two-factor authentication
- OAuth / social login
- Admin ดูหรือแก้ไข profile ของ user คนอื่น

---

## Further Notes

- Backend ต้องสร้างก่อน frontend — ไม่ใช้ mock API เพื่อหลีกเลี่ยง rework
- `GET /users/me` ควรถูกเรียกตอน app start (หลัง token validate) ไม่ใช่เฉพาะตอนเปิดหน้า Profile เพื่อให้ TopBar แสดงชื่อได้ถูกต้องตั้งแต่แรก
