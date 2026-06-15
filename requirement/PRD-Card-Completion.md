# PRD — Card Completion (Per-card Done State)

**สถานะ:** Draft v1.0 — _planned, ยังไม่ implement_
**ขอบเขต:** New Feature — ต่อจาก Editorial card redesign
**วันที่:** 15 มิถุนายน 2026
**Tracking:** [issue #34](https://github.com/khthana/kanban-board/issues/34) · [ADR-0003](../docs/adr/0003-card-completion-model.md)

---

## Problem Statement

เมื่อทีมทำงานใน card ใบหนึ่งเสร็จ ปัจจุบันยังไม่มีวิธีบอกว่า *card ใบนั้นเอง* เสร็จแล้ว board สื่อ "เสร็จ" ได้แค่โดยอ้อม — คือ card ไปอยู่คอลัมน์ "Done" — แต่ card หนึ่งใบเสร็จได้ไม่ว่าจะอยู่คอลัมน์ไหน สมาชิกจึงดูไม่ออกในแวบเดียวว่า card ใดเสร็จแล้ว vs ยังทำอยู่ และไม่มีการบันทึกว่า card เสร็จ *เมื่อไหร่*

---

## Solution

ให้ card ทุกใบมีสถานะ **เสร็จ (completion)** ที่เป็นอิสระจากคอลัมน์ สมาชิกกดทำเครื่องหมายว่าเสร็จ (หรือยกเลิก) ได้จาก panel รายละเอียดของ card; card ที่เสร็จจะถูกลดความเด่นบน board ด้วย badge ✓ และความจาง และ foot ของมันจะแสดง **วันที่ทำเสร็จ** แทน due date สถานะนี้เป็นคุณสมบัติระดับ card (ไม่ใช่ระดับคอลัมน์), persist ข้าม reload, และสมาชิกทุกคนเห็นเหมือนกัน

---

## User Stories

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

---

## Implementation Decisions

### Model

- **Per-card flag, ไม่ใช่ column-level concept.** card มีสถานะเสร็จของตัวเอง ไม่ขึ้นกับ `column_id`; กดเสร็จไม่ย้าย card และไม่ต้องมีคอลัมน์ "Done"
- เก็บเป็น **`completed_at DATE NULL`** บน `cards` — `null` = ยังไม่เสร็จ, มีค่า = เสร็จวันนั้น boolean "done" **คำนวณจาก** `completed_at !== null` ไม่เก็บแยก
- **`DATE` ไม่ใช่ `TIMESTAMP`** — แสดงแค่ *วันที่* และ codebase มี plumbing `YYYY-MM-DD` แบบ timezone-safe เลียนแบบ `due_date` อยู่แล้ว เวลานาที/`"เสร็จเมื่อ N ชม.ก่อน"`/sort ตามเวลาจริง = deferred (ดู [ADR-0003](../docs/adr/0003-card-completion-model.md))
- **client ประทับวันที่** ส่ง `patchCard({ completedAt: toYMD(new Date()) })` ผ่าน generic `PATCH /cards/:id`; ยกเลิก = `{ completedAt: null }` ไม่มี endpoint พิเศษ ไม่ stamp `now()` ฝั่ง server

### Module ใหม่ — `domain/completion.js` (deep module, pure, unit-tested เดี่ยว)

- `isDone(card)` → `!!card.completedAt`
- `completionPatch(done)` → `{ completedAt: done ? toYMD(new Date()) : null }`
- `incompleteSubtasks(subtasks)` → จำนวน subtask ที่ยังไม่ติ๊ก (ใช้ขับ confirm guard)
- reuse `domain/dates.js`; รวม logic "done" ไว้ที่เดียว ทั้ง store และ component ไม่ถือ logic นี้เอง

### Store / Client

- **ไม่มี action ใหม่** — reuse `patchCard` + optimistic path เดิม (snapshot → apply → rollback); `createCard` placeholder เติม `completedAt: null`
- `normalizeCard` map `completed_at` → `completedAt` (slice 10 ตัว); `cardPatchToApi` map `completedAt` → `completed_at` (ส่ง `null` ผ่านเพื่อ clear)

### UI

- **`CardPanel`** — ปุ่มเต็มกว้างบนสุดของ body เหนือ LabelPicker
  - ยังไม่เสร็จ: "✓ ทำเครื่องหมายว่าเสร็จ" | เสร็จแล้ว: "✓ เสร็จเมื่อ <วันที่>" + ปุ่มเล็ก "เลิกทำเครื่องหมาย"
  - **confirm guard (soft warn):** กดเสร็จขณะ `incompleteSubtasks > 0` → `window.confirm` บอกจำนวนที่ยังไม่ครบ; ไม่มี subtask → ไม่เตือน; เลิกทำเครื่องหมาย → ไม่เตือน เป็น **client-side UX เท่านั้น**
- **`Card` (สะท้อนสถานะ ไม่ใช่ปุ่ม)** — badge ✓ ที่แถวบน + จางทั้งใบ (opacity ~0.6); foot ตอนเสร็จ: ซ้าย = วันที่เสร็จแทน due (ไม่มี overdue styling), ขวา = progress คงไว้; card อยู่ที่เดิม ไม่ย้าย/ซ่อน

### Backend (`kanban-board-api`)

- migration `007_card_completed_at.sql`: `ALTER TABLE cards ADD COLUMN IF NOT EXISTS completed_at DATE NULL`
- `PATCH /cards/:id`: รับ `completed_at` (date string หรือ `null`) ใน dynamic SET + RETURNING; ไม่เช็ค subtask ฝั่ง server
- `GET /boards/:id` snapshot: คืน `completed_at` ต่อ card

---

## Testing Decisions

เทสต์ที่ดี = ยืนยัน **พฤติกรรมภายนอกผ่าน public interface** ไม่ใช่ implementation detail

- **`domain/completion.test.js`** (ใหม่, unit): `isDone` กรณี set/unset; `completionPatch(true)` ได้ `YYYY-MM-DD` วันนี้, `completionPatch(false)` ได้ `null`; `incompleteSubtasks` นับถูกในเคส mixed/empty/all-checked — prior art: `dates.test.js`, `accent.test.js`, `progress.test.js`
- **`useBoardStore.test.js`** (เพิ่ม, unit): `patchCard({ completedAt })` ตาม optimistic apply → settle และ rollback เมื่อ API error — prior art: เคส optimistic เดิมในไฟล์เดียวกัน
- **`cards.test.js`** (API, เพิ่ม, integration): `PATCH /cards/:id` set `completed_at` + clear กลับเป็น `null`; round-trip ผ่าน snapshot — prior art: เทสต์ `category_label_id` / `due_date` เดิม
- **`completion.spec.js`** (ใหม่, E2E): mark done จาก panel → board โชว์ ✓ + จาง + วันที่เสร็จใน foot → reload คงอยู่ → unmark กลับปกติ — prior art: `category.spec.js`, `column-color.spec.js` (component ไม่ unit test → E2E ครอบ flow ที่ render จริง)

---

## Out of Scope

- Column-based "done" (กำหนดทั้งคอลัมน์เป็น Done)
- ปุ่ม one-click complete บน card face (toggle อยู่ใน panel เท่านั้น)
- Filter / ซ่อน / พับ / auto-sort card ที่เสร็จ (เช่นปุ่ม "แสดง card ที่เสร็จแล้ว") — deferred; โมเดลเปิดทางไว้
- จม card ที่เสร็จลงล่างคอลัมน์อัตโนมัติ
- auto-ติ๊ก subtask ตอนเสร็จ / auto-เสร็จเมื่อ subtask ครบ (สอง concept แยกกัน)
- เก็บ/แสดง *เวลา* ทำเสร็จ (นาที), "เสร็จเมื่อ N ชม.ก่อน", sort ตามเวลาเสร็จจริง
- บังคับ subtask-completeness ฝั่ง server
- ประวัติว่าใครกดเสร็จเมื่อไหร่ (เก็บแค่วันที่)

---

## Further Notes

- การตัดสินใจผ่าน grilling session กับผู้ใช้; จุดกลับลำสำคัญ: โมเดล boolean เริ่มต้น ถูกอัปเป็น stored date เมื่อ "แสดงวันที่ทำเสร็จ" กลายเป็น requirement แล้วแคบจาก TIMESTAMP → DATE เพราะแสดงแค่วันที่
- แสดงวันที่ทำเสร็จ reuse `formatDueDate` (th-TH) + `fromYMD`/`toYMD` ใน `domain/dates.js`
- เพราะ completion ไหลผ่าน generic `patchCard` จึงได้พฤติกรรม polling/`reconcileBoard` มาฟรี — การเปลี่ยนของเพื่อนร่วมทีมโผล่ตอน snapshot refresh ถัดไป
- ลำดับ implement แนะนำ: (1) migration + backend + API tests → (2) `domain/completion.js` + client + store + unit → (3) CardPanel + Card UI → (4) E2E → (5) ADR-0003 + CLAUDE.md
