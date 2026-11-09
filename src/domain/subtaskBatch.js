// Batch add of Subtasks (PRD §12): a pasted multi-line text becomes one Subtask
// per non-blank line. Shared with the API so both sides apply the same rules.
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

export function describeSubtaskBatchError(err) {
  switch (err.reason) {
    case 'empty':     return 'ไม่มีรายการให้เพิ่ม';
    case 'blank':     return `บรรทัดที่ ${err.line} ว่าง`;
    case 'tooLong':   return `บรรทัดที่ ${err.line} ยาวเกิน ${MAX_SUBTASK_TITLE_LENGTH} ตัวอักษร`;
    case 'overLimit': return `วาง ${err.count} รายการจะเกินลิมิต ${MAX_SUBTASKS_PER_CARD} (เพิ่มได้อีก ${err.room})`;
    default:          return 'เพิ่มรายการไม่สำเร็จ';
  }
}
