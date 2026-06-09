import { useState, useEffect } from 'react';
import { validateCardDescription, validateSubtaskTitle, validateSubtaskCount } from '../domain/validation';
import LabelPicker from './LabelPicker';
import AssigneePicker from './AssigneePicker';
import DueDateField from './DueDateField';
import styles from './CardPanel.module.css';

export default function CardPanel({
  card, allLabels, cardLabels, members, boardId,
  onSave, onDelete, onClose,
  onCreateLabel, onDeleteLabel, onAttachLabel, onDetachLabel,
  userId,
  subtasks = [],
  onCreateSubtask,
  onToggleSubtask,
  onRenameSubtask,
  onDeleteSubtask,
  onMoveSubtaskUp,
  onMoveSubtaskDown,
}) {
  const [desc, setDesc]           = useState(card.description ?? '');
  const [dirty, setDirty]         = useState(false);
  const [error, setError]         = useState(null);
  const [addingSubtask, setAddingSubtask]   = useState(false);
  const [subtaskInput, setSubtaskInput]     = useState('');
  const [subtaskError, setSubtaskError]     = useState(null);
  const [editingId, setEditingId]           = useState(null);
  const [editInput, setEditInput]           = useState('');
  const [editError, setEditError]           = useState(null);

  useEffect(() => {
    setDesc(card.description ?? '');
    setDirty(false);
    setError(null);
  }, [card.id, card.description]);

  function handleDescChange(e) {
    const val = e.target.value;
    setDesc(val);
    setDirty(true);
    setError(validateCardDescription(val));
  }

  function handleSave() {
    const err = validateCardDescription(desc);
    if (err) { setError(err); return; }
    onSave({ description: desc });
    setDirty(false);
  }

  async function handleSubtaskKeyDown(e) {
    if (e.key === 'Escape') { setAddingSubtask(false); setSubtaskInput(''); setSubtaskError(null); return; }
    if (e.key !== 'Enter') return;
    e.preventDefault();
    const titleErr = validateSubtaskTitle(subtaskInput);
    if (titleErr) { setSubtaskError(titleErr); return; }
    const countErr = validateSubtaskCount(subtasks.length);
    if (countErr) { setSubtaskError(countErr); return; }
    try {
      await onCreateSubtask(subtaskInput.trim());
      setSubtaskInput('');
      setSubtaskError(null);
    } catch (err) {
      setSubtaskError(err.message);
    }
  }

  async function handleEditKeyDown(e, subtaskId) {
    if (e.key === 'Escape') { setEditingId(null); setEditError(null); return; }
    if (e.key !== 'Enter') return;
    e.preventDefault();
    const err = validateSubtaskTitle(editInput);
    if (err) { setEditError(err); return; }
    try {
      await onRenameSubtask?.(subtaskId, editInput.trim());
      setEditingId(null);
      setEditError(null);
    } catch (err) {
      setEditError(err.message);
    }
  }

  function handleDelete() {
    if (!window.confirm(`Delete "${card.title}"?`)) return;
    onDelete(card.id);
    onClose();
  }

  const attachedIds = new Set(cardLabels.filter(cl => cl.cardId === card.id).map(cl => cl.labelId));

  return (
    <aside className={styles.panel}>
      <div className={styles.header}>
        <h2 className={styles.title}>{card.title}</h2>
        <button className={styles.closeBtn} onClick={onClose} title="Close panel">✕</button>
      </div>

      <div className={styles.body}>
        <LabelPicker
          boardId={boardId}
          userId={userId}
          allLabels={allLabels}
          attachedLabelIds={attachedIds}
          categoryLabelId={card.categoryLabelId}
          onAttach={labelId => onAttachLabel(card.id, labelId, userId)}
          onDetach={labelId => {
            onDetachLabel(card.id, labelId, userId);
            if (labelId === card.categoryLabelId) onSave({ categoryLabelId: null });
          }}
          onSetCategory={labelId => onSave({ categoryLabelId: labelId })}
          onCreateLabel={onCreateLabel}
          onDeleteLabel={onDeleteLabel}
        />

        <AssigneePicker
          members={members}
          assigneeId={card.assigneeId}
          onChange={assigneeId => onSave({ assigneeId })}
        />

        <DueDateField
          dueDate={card.dueDate}
          onChange={dueDate => onSave({ dueDate })}
        />

        <div className={styles.subtaskSection}>
          <p className={styles.label}>Subtasks {subtasks.length > 0 && <span className={styles.subtaskCount}>({subtasks.length})</span>}</p>

          {[...subtasks].sort((a, b) => a.position - b.position).map((s, idx, arr) => (
            <div key={s.id} className={styles.subtaskRow}>
              <input
                type="checkbox"
                className={styles.subtaskCheck}
                checked={s.checked}
                onChange={() => onToggleSubtask?.(s.id)}
              />
              {editingId === s.id ? (
                <div className={styles.subtaskEditRow}>
                  <input
                    className={styles.subtaskInput}
                    autoFocus
                    value={editInput}
                    onChange={e => { setEditInput(e.target.value); setEditError(null); }}
                    onKeyDown={e => handleEditKeyDown(e, s.id)}
                  />
                  {editError && <p className={styles.fieldError}>{editError}</p>}
                </div>
              ) : (
                <span
                  className={styles.subtaskTitle}
                  style={s.checked ? { textDecoration: 'line-through', color: '#94a3b8' } : undefined}
                  onClick={() => { setEditingId(s.id); setEditInput(s.title); setEditError(null); }}
                  title="Click to edit"
                >{s.title}</span>
              )}
              <div className={styles.subtaskActions}>
                <button
                  className={styles.subtaskMoveBtn}
                  disabled={idx === 0}
                  onClick={() => onMoveSubtaskUp?.(s.id)}
                  title="Move up"
                >↑</button>
                <button
                  className={styles.subtaskMoveBtn}
                  disabled={idx === arr.length - 1}
                  onClick={() => onMoveSubtaskDown?.(s.id)}
                  title="Move down"
                >↓</button>
                <button
                  className={styles.subtaskDeleteBtn}
                  onClick={() => onDeleteSubtask?.(s.id)}
                  title="Delete subtask"
                >✕</button>
              </div>
            </div>
          ))}

          {addingSubtask ? (
            <div className={styles.subtaskInputRow}>
              <input
                className={styles.subtaskInput}
                autoFocus
                value={subtaskInput}
                placeholder="Subtask title…"
                onChange={e => { setSubtaskInput(e.target.value); setSubtaskError(null); }}
                onKeyDown={handleSubtaskKeyDown}
              />
              {subtaskError && <p className={styles.fieldError}>{subtaskError}</p>}
            </div>
          ) : (
            validateSubtaskCount(subtasks.length)
              ? <p className={styles.subtaskLimit}>Maximum 20 subtasks per card</p>
              : <button className={styles.addSubtaskBtn} onClick={() => setAddingSubtask(true)}>+ Add subtask</button>
          )}
        </div>

        <div className={styles.descSection}>
          <label className={styles.label} htmlFor="card-desc">Description</label>
          <textarea
            id="card-desc"
            className={styles.textarea}
            value={desc}
            rows={6}
            maxLength={5001}
            placeholder="Add a description…"
            onChange={handleDescChange}
          />
          {error && <p className={styles.fieldError}>{error}</p>}
          {dirty && !error && (
            <button className={styles.saveBtn} onClick={handleSave}>Save</button>
          )}
        </div>
      </div>

      <div className={styles.footer}>
        <button className={styles.deleteBtn} onClick={handleDelete}>Delete card</button>
      </div>
    </aside>
  );
}
