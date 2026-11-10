import { useRef, useState } from 'react';
import { validateSubtaskTitle } from '../domain/validation';
import { splitSubtaskLines, checkSubtaskBatch, describeSubtaskBatchError, cardFullMessage } from '../domain/subtaskBatch';
import { visibleSubtasks } from '../domain/subtaskVisibility';
import { subtaskProgress } from '../domain/progress';
import styles from './SubtaskSection.module.css';

// The Subtask checklist inside the Card panel: rows (toggle / inline rename /
// ↑ ↓ ✕) plus the "+ Add subtask" input — pasting several lines there turns it
// into a batch box (PRD §12); a typed title is added as a batch of one (#67).
// Done Subtasks are hidden until revealed by the `✓ N` switch in the header
// (#83), and start hidden on every mount (the Card panel keys this by Card); the
// switch is gone while nothing is done, but keeps its state for when it
// returns. Owns only its own UI state; every mutation goes through the board
// actions (#68) — add and rename reject on failure (shown inline), the rest
// report to the banner.
export default function SubtaskSection({ cardId, subtasks = [], actions }) {
  const [adding, setAdding]         = useState(false);
  const [input, setInput]           = useState('');
  const [inputError, setInputError] = useState(null);
  // Text of a pasted multi-line batch; null while in single-line mode.
  const [batchText, setBatchText]   = useState(null);
  const [editingId, setEditingId]   = useState(null);
  const [editInput, setEditInput]   = useState('');
  const [editError, setEditError]   = useState(null);
  // Guards against a second Enter while an add's POST is in flight (would add it twice).
  const submitting = useRef(false);
  const [hideDone, setHideDone]     = useState(true);
  const doneCount = subtaskProgress(subtasks).done;
  const visible = visibleSubtasks(subtasks, { hideDone });
  // A row being renamed that just got hidden (ticked here or by another tab):
  // drop the draft so it doesn't reappear in edit mode on reveal.
  if (editingId !== null && !visible.some(s => s.id === editingId)) setEditingId(null);

  async function handleAddKeyDown(e) {
    if (e.key === 'Escape') { setAdding(false); setInput(''); setInputError(null); return; }
    if (e.key !== 'Enter') return;
    e.preventDefault();
    if (submitting.current) return;
    const invalid = checkSubtaskBatch([{ title: input }], subtasks.length);
    if (invalid) { setInputError(describeSubtaskBatchError(invalid)); return; }
    submitting.current = true;
    try {
      await actions.createSubtasks(cardId, [input.trim()]);
      setInput('');
      setInputError(null);
    } catch (err) {
      setInputError(err.message);
    } finally {
      submitting.current = false;
    }
  }

  const limitMessage = cardFullMessage(subtasks.length);

  function handleAddPaste(e) {
    const pasted = e.clipboardData.getData('text/plain');
    if (splitSubtaskLines(pasted).length < 2) return; // single line: the browser pastes it as usual
    e.preventDefault();
    // Insert at the caret / over the selection, as a normal paste would.
    const { selectionStart: start = input.length, selectionEnd: end = input.length } = e.target;
    setBatchText(input.slice(0, start) + pasted + input.slice(end));
    setInputError(null);
  }

  function leaveBatch() {
    setBatchText(null);
    setInput('');
    setInputError(null);
  }

  async function handleBatchKeyDown(e) {
    if (e.key === 'Escape') { leaveBatch(); return; }
    if (e.key !== 'Enter' || e.shiftKey) return; // Shift+Enter adds a line
    e.preventDefault();
    if (submitting.current) return;
    const items = splitSubtaskLines(batchText);
    const invalid = checkSubtaskBatch(items, subtasks.length);
    if (invalid) { setInputError(describeSubtaskBatchError(invalid)); return; }
    submitting.current = true;
    try {
      await actions.createSubtasks(cardId, items.map(item => item.title));
      leaveBatch();
    } catch (err) {
      setInputError(err.message); // keep the text so it can be fixed and retried
    } finally {
      submitting.current = false;
    }
  }

  async function handleEditKeyDown(e, subtaskId) {
    if (e.key === 'Escape') { setEditingId(null); setEditError(null); return; }
    if (e.key !== 'Enter') return;
    e.preventDefault();
    const err = validateSubtaskTitle(editInput);
    if (err) { setEditError(err); return; }
    try {
      await actions.renameSubtask(subtaskId, editInput.trim());
      setEditingId(null);
      setEditError(null);
    } catch (err) {
      setEditError(err.message);
    }
  }

  return (
    <div className={styles.section}>
      <div className={styles.header}>
        <p className={styles.label}>Subtasks {subtasks.length > 0 && <span className={styles.count}>({subtasks.length})</span>}</p>
        {doneCount > 0 && (
          <button
            type="button"
            role="switch"
            aria-checked={!hideDone}
            aria-label={`แสดงที่เสร็จแล้ว ✓ ${doneCount}`}
            title="แสดงที่เสร็จแล้ว"
            className={styles.doneSwitch}
            data-testid="subtask-done-toggle"
            onClick={() => setHideDone(v => !v)}
          >
            <span data-testid="subtask-done-count">✓ {doneCount}</span>
            <span className={styles.track} aria-hidden="true"><span className={styles.thumb} /></span>
          </button>
        )}
      </div>

      {visible.map((s, idx, arr) => (
        <div key={s.id} className={styles.row} data-testid="subtask-row">
          <input
            type="checkbox"
            className={styles.check}
            checked={s.checked}
            onChange={() => actions.toggleSubtask(s.id)}
          />
          {editingId === s.id ? (
            <div className={styles.editRow}>
              <input
                className={styles.input}
                autoFocus
                value={editInput}
                onChange={e => { setEditInput(e.target.value); setEditError(null); }}
                onKeyDown={e => handleEditKeyDown(e, s.id)}
              />
              {editError && <p className={styles.fieldError}>{editError}</p>}
            </div>
          ) : (
            <span
              className={styles.title}
              data-testid="subtask-title"
              style={s.checked ? { textDecoration: 'line-through', color: '#94a3b8' } : undefined}
              onClick={() => { setEditingId(s.id); setEditInput(s.title); setEditError(null); }}
              title="Click to edit"
            >{s.title}</span>
          )}
          <div className={styles.actions}>
            <button
              className={styles.moveBtn}
              disabled={idx === 0}
              onClick={() => actions.moveSubtaskUp(s.id, { hideDone })}
              title="Move up"
            >↑</button>
            <button
              className={styles.moveBtn}
              disabled={idx === arr.length - 1}
              onClick={() => actions.moveSubtaskDown(s.id, { hideDone })}
              title="Move down"
            >↓</button>
            <button
              className={styles.deleteBtn}
              onClick={() => actions.deleteSubtask(s.id)}
              title="Delete subtask"
            >✕</button>
          </div>
        </div>
      ))}

      {adding && batchText !== null ? (
        <div className={styles.inputRow}>
          <textarea
            className={`${styles.input} ${styles.batchInput}`}
            data-testid="subtask-batch-input"
            autoFocus
            rows={Math.min(Math.max(batchText.split('\n').length, 2), 8)}
            value={batchText}
            onChange={e => { setBatchText(e.target.value); setInputError(null); }}
            onKeyDown={handleBatchKeyDown}
          />
          <p className={styles.batchHint} data-testid="subtask-batch-hint">
            Enter เพื่อเพิ่ม {splitSubtaskLines(batchText).length} รายการ · Esc ยกเลิก
          </p>
          {inputError && <p className={styles.fieldError}>{inputError}</p>}
        </div>
      ) : adding ? (
        <div className={styles.inputRow}>
          <input
            className={styles.input}
            autoFocus
            value={input}
            placeholder="Subtask title…"
            onChange={e => { setInput(e.target.value); setInputError(null); }}
            onKeyDown={handleAddKeyDown}
            onPaste={handleAddPaste}
          />
          {inputError && <p className={styles.fieldError}>{inputError}</p>}
        </div>
      ) : (
        limitMessage
          ? <p className={styles.limit}>{limitMessage}</p>
          : <button className={styles.addBtn} onClick={() => setAdding(true)}>+ Add subtask</button>
      )}
    </div>
  );
}
