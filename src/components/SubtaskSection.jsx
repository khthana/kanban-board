import { useState } from 'react';
import { validateSubtaskTitle, validateSubtaskCount } from '../domain/validation';
import styles from './SubtaskSection.module.css';

// The Subtask checklist inside the Card panel: rows (toggle / inline rename /
// ↑ ↓ ✕) plus the "+ Add subtask" input. Owns only its own editing state;
// every mutation goes through the callbacks, which may reject (shown inline).
export default function SubtaskSection({
  subtasks = [],
  onCreate,
  onToggle,
  onRename,
  onDelete,
  onMoveUp,
  onMoveDown,
}) {
  const [adding, setAdding]         = useState(false);
  const [input, setInput]           = useState('');
  const [inputError, setInputError] = useState(null);
  const [editingId, setEditingId]   = useState(null);
  const [editInput, setEditInput]   = useState('');
  const [editError, setEditError]   = useState(null);

  async function handleAddKeyDown(e) {
    if (e.key === 'Escape') { setAdding(false); setInput(''); setInputError(null); return; }
    if (e.key !== 'Enter') return;
    e.preventDefault();
    const titleErr = validateSubtaskTitle(input);
    if (titleErr) { setInputError(titleErr); return; }
    const countErr = validateSubtaskCount(subtasks.length);
    if (countErr) { setInputError(countErr); return; }
    try {
      await onCreate(input.trim());
      setInput('');
      setInputError(null);
    } catch (err) {
      setInputError(err.message);
    }
  }

  const limitMessage = validateSubtaskCount(subtasks.length);

  async function handleEditKeyDown(e, subtaskId) {
    if (e.key === 'Escape') { setEditingId(null); setEditError(null); return; }
    if (e.key !== 'Enter') return;
    e.preventDefault();
    const err = validateSubtaskTitle(editInput);
    if (err) { setEditError(err); return; }
    try {
      await onRename?.(subtaskId, editInput.trim());
      setEditingId(null);
      setEditError(null);
    } catch (err) {
      setEditError(err.message);
    }
  }

  return (
    <div className={styles.section}>
      <p className={styles.label}>Subtasks {subtasks.length > 0 && <span className={styles.count}>({subtasks.length})</span>}</p>

      {[...subtasks].sort((a, b) => a.position - b.position).map((s, idx, arr) => (
        <div key={s.id} className={styles.row}>
          <input
            type="checkbox"
            className={styles.check}
            checked={s.checked}
            onChange={() => onToggle?.(s.id)}
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
              style={s.checked ? { textDecoration: 'line-through', color: '#94a3b8' } : undefined}
              onClick={() => { setEditingId(s.id); setEditInput(s.title); setEditError(null); }}
              title="Click to edit"
            >{s.title}</span>
          )}
          <div className={styles.actions}>
            <button
              className={styles.moveBtn}
              disabled={idx === 0}
              onClick={() => onMoveUp?.(s.id)}
              title="Move up"
            >↑</button>
            <button
              className={styles.moveBtn}
              disabled={idx === arr.length - 1}
              onClick={() => onMoveDown?.(s.id)}
              title="Move down"
            >↓</button>
            <button
              className={styles.deleteBtn}
              onClick={() => onDelete?.(s.id)}
              title="Delete subtask"
            >✕</button>
          </div>
        </div>
      ))}

      {adding ? (
        <div className={styles.inputRow}>
          <input
            className={styles.input}
            autoFocus
            value={input}
            placeholder="Subtask title…"
            onChange={e => { setInput(e.target.value); setInputError(null); }}
            onKeyDown={handleAddKeyDown}
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
