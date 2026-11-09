// Adding Subtasks (PRD §12): a pasted multi-line text becomes one Subtask per
// non-blank line, and a single typed title is a batch of one (#67) — so the
// limit check and the error wording exist once. Shared with the API.
import { MAX_SUBTASKS_PER_CARD, MAX_SUBTASK_TITLE_LENGTH } from './validation.js';

// Pasted text → [{ line, title }]: trimmed, blank lines skipped, `line` is the
// 1-based line number in the pasted text (so errors can point at it).
export function splitSubtaskLines(text) {
  return text
    .split(/\r?\n/)
    .map((raw, i) => ({ line: i + 1, title: raw.trim() }))
    .filter(item => item.title !== '');
}

// All-or-nothing check of a batch about to be added to a card that already has
// `existingCount` Subtasks. Returns null when every item can be added, else the
// first reason none can:
//   { reason: 'empty' } | { reason: 'blank', line } | { reason: 'tooLong', line }
//   | { reason: 'overLimit', count, room }
// Items are { line?, title }; a single typed title has no line, and its errors
// then carry none.
export function checkSubtaskBatch(items, existingCount) {
  if (items.length === 0) return { reason: 'empty' };
  for (const { line, title } of items) {
    if (title.trim() === '') return { reason: 'blank', line };
    if (title.trim().length > MAX_SUBTASK_TITLE_LENGTH) return { reason: 'tooLong', line };
  }
  const room = Math.max(0, MAX_SUBTASKS_PER_CARD - existingCount);
  if (items.length > room) return { reason: 'overLimit', count: items.length, room };
  return null;
}

// The hint shown instead of "+ Add subtask" on a full card — worded as the
// error an add would get there, so both say the same thing.
export const cardFullMessage = existingCount =>
  existingCount >= MAX_SUBTASKS_PER_CARD ? describeSubtaskBatchError({ reason: 'overLimit', count: 1, room: 0 }) : null;

export function describeSubtaskBatchError(err) {
  const subject = err.line === undefined ? 'ชื่อ Subtask' : `บรรทัดที่ ${err.line}`;
  switch (err.reason) {
    case 'empty':     return 'ไม่มีรายการให้เพิ่ม';
    case 'blank':     return `${subject} ว่าง`;
    case 'tooLong':   return `${subject} ยาวเกิน ${MAX_SUBTASK_TITLE_LENGTH} ตัวอักษร`;
    case 'overLimit': return err.room === 0
      ? `Subtask ครบลิมิต ${MAX_SUBTASKS_PER_CARD} แล้ว`
      : `วาง ${err.count} รายการจะเกินลิมิต ${MAX_SUBTASKS_PER_CARD} (เพิ่มได้อีก ${err.room})`;
    default:          return 'เพิ่มรายการไม่สำเร็จ';
  }
}
