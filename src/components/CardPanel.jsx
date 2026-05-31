import { useState, useEffect } from 'react';
import { validateCardDescription } from '../domain/validation';
import LabelPicker from './LabelPicker';
import AssigneePicker from './AssigneePicker';
import DueDateField from './DueDateField';
import styles from './CardPanel.module.css';

export default function CardPanel({
  card, allLabels, cardLabels, members, boardId,
  onSave, onDelete, onClose,
  onCreateLabel, onDeleteLabel, onAttachLabel, onDetachLabel,
  userId,
}) {
  const [desc, setDesc]   = useState(card.description ?? '');
  const [dirty, setDirty] = useState(false);
  const [error, setError] = useState(null);

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
          onAttach={labelId => onAttachLabel(card.id, labelId, userId)}
          onDetach={labelId => onDetachLabel(card.id, labelId, userId)}
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
