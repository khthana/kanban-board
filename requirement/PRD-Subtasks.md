# PRD — Card Subtasks (Checklist)

**สถานะ:** Draft v1.0
**ขอบเขต:** New Feature — ต่อจาก Kanban Board MVP
**วันที่:** 5 มิถุนายน 2026

---

## Problem Statement

ปัจจุบัน card แต่ละใบมีแค่ title, description, assignee, due date และ labels — ไม่มีวิธีแตก card ใบหนึ่งเป็น step ย่อยๆ ที่ track ได้ ทีมต้องใช้ description แบบ freetext เพื่อจดรายการงาน ซึ่ง track ความคืบหน้าได้ยาก และมองจาก board view ไม่เห็นเลยว่างานใน card นั้นทำไปถึงไหนแล้ว

---

## Solution

เพิ่ม **subtask checklist** ใน card แต่ละใบ โดยแสดงรายการงานย่อยพร้อม checkbox ใน CardPanel และแสดง progress summary (`✓ checked / total`) บน card preview บน board เพื่อให้ทีมเห็น status ของงานได้ในทันทีโดยไม่ต้องเปิด panel

---

## User Stories

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

---

## Implementation Decisions

### Schema

เพิ่ม table `subtasks` ใน migration ใหม่:

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

- `position` ใช้ fractional float เหมือน `cards.position` และ `columns.position` เพื่อ reuse `positionBetween` utility
- ไม่มี `updated_at` เพราะ subtask ไม่ต้องการ audit trail

### API Endpoints

เพิ่ม subtasks router ใหม่:

```
POST   /cards/:cardId/subtasks      body: { title }         → 201 subtask
PATCH  /subtasks/:id                body: { title?, checked?, position? } → 200 subtask
DELETE /subtasks/:id                                         → 204
```

- ทุก endpoint ต้อง auth (Bearer token) และตรวจว่า user เป็น board member ผ่าน card → column → board chain เหมือนที่ cards route ทำอยู่
- `POST` validate title (non-empty, ≤ 100 chars) และ count ≤ 20 ต่อ card
- `PATCH` รับ partial patch (title เท่านั้น หรือ checked เท่านั้น หรือ position เท่านั้น ก็ได้)

### Board Snapshot

`GET /boards/:id` เพิ่ม subtasks ต่อ card ใน nested shape:

```
columns: [{
  cards: [{
    ...card fields,
    subtasks: [{ id, title, checked, position }]  ← เพิ่มใหม่
  }]
}]
```

Frontend flatten ใน `client.js` เหมือนกับ `cardLabels` — store `subtasks[]` แบน indexed by `cardId`

### Ordering

Reuse `positionBetween(prev, next)` จาก `domain/ordering` — เมื่อกด ↑ หรือ ↓ คำนวณ position ใหม่ระหว่าง adjacent items แล้ว PATCH ตัวนั้นตัวเดียว (ไม่ต้อง reorder ทั้งหมด) เหมือน card move

### Optimistic Update Pattern

Checkbox toggle ใช้ pattern เดียวกับ `useBoardStore` ทั้งหมด:
1. Snapshot state ปัจจุบัน
2. Apply เปลี่ยน `checked` ใน store ทันที
3. PATCH ไป API
4. Rollback ถ้า API ตอบ error

Create/delete/rename ก็ใช้ optimistic pattern เดียวกัน

### Validation (client-side)

เพิ่มฟังก์ชันใน `domain/validation`:
- `validateSubtaskTitle(title)` — non-empty, ≤ 100 chars
- `validateSubtaskCount(currentCount)` — error ถ้า count ≥ 20

Validation รัน client-side เพื่อ UX และ backend enforce เป็น authoritative เหมือน pattern ปัจจุบัน

### Card Preview

บน card preview (board view) แสดง `✓ checked / total` เมื่อ card มี subtask อย่างน้อย 1 ตัว วาง metadata row เดียวกับ due date และ assignee avatar ถ้า total = 0 ไม่แสดงอะไร

### CardPanel UI

ส่วน subtask ใน CardPanel แสดงหลัง DueDateField:
- รายการ subtask แต่ละตัว: `[ checkbox ] [ title / inline-input ] [ ↑ ] [ ↓ ] [ ✕ ]`
- กด title → เปิด inline edit; Enter = save, Escape = cancel
- "+ Add subtask" button ด้านล่าง → แสดง inline input; Enter = save, Escape = dismiss
- ถ้า count ถึง 20: ซ่อน button + แสดง hint "Maximum 20 subtasks per card"

---

## Testing Decisions

### หลักการ

Test external behavior เท่านั้น — ไม่ test internal state หรือ implementation details ใน store ยกเว้น module ที่เป็น pure function

### Modules ที่ Unit Test

**`domain/validation`** — เป็น pure function ที่ test ง่ายและมีค่ามาก:
- `validateSubtaskTitle` กับ input ขอบเขตต่างๆ (empty, 100 chars, 101 chars, whitespace only)
- `validateSubtaskCount` กับ 0, 19, 20, 21

Prior art: `src/domain/validation.test.js` ที่มีอยู่แล้ว — pattern เดียวกัน

### Modules ที่ Integration Test (Backend)

**Subtasks route** — ทดสอบทุก endpoint ผ่าน supertest เหมือน `cards.test.js`:
- `POST /cards/:id/subtasks` — happy path, title validation, count limit (20), member check, 404
- `PATCH /subtasks/:id` — toggle checked, rename title, move position, non-member → 403
- `DELETE /subtasks/:id` — happy path, non-member → 403

Prior art: `src/routes/cards.test.js`

### Modules ที่ไม่ Unit Test

- `useBoardStore` subtask actions — covered โดย E2E
- CardPanel component — covered โดย E2E
- Card progress indicator — covered โดย E2E

### E2E Tests (Playwright)

เพิ่มไฟล์ `e2e/subtask.spec.js`:
- สร้าง subtask → persist หลัง reload
- tick checkbox → progress indicator อัปเดต
- rename subtask → เห็นชื่อใหม่
- reorder ด้วย ↑/↓ → ลำดับ persist หลัง reload
- ลบ subtask → หายจาก list
- สร้างครบ 20 → "+ Add subtask" ซ่อน

---

## Out of Scope

- **Subtask assignee หรือ due date** — subtask คือ checklist ไม่ใช่ mini-card
- **Drag-and-drop reorder** — ใช้ up/down button แทนเพื่อ scope เล็กกว่า
- **Subtask-level notifications หรือ activity log**
- **Cross-card subtask search/filter**
- **Subtask templates หรือ copy from another card**
- **Completion percentage บน board list page**

---

## Further Notes

- ถ้า card ถูก delete, subtasks cascade delete อัตโนมัติผ่าน `ON DELETE CASCADE` — ไม่ต้อง handle ใน application layer
- `positionBetween` จาก `domain/ordering` reuse ได้ตรงๆ สำหรับ ↑/↓ reorder — backend ไม่ต้อง rebalance เพราะ up/down move ทีละ 1 ไม่ทำให้ gap แคบขนาด < 1e-9 ยกเว้น edge case ที่ list ยาวมาก (> 50 moves ในตำแหน่งเดิม) ซึ่งต่ำกว่า limit 20 subtasks มาก
- Progress indicator บน card preview ต้องการแค่ `subtask_count` และ `checked_count` — แต่เนื่องจาก board snapshot รวม subtask objects ทั้งหมดแล้ว ให้คำนวณ count ใน frontend แทนที่จะส่ง count แยก
