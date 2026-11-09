import { useState, useEffect, useRef } from 'react';
import { validateCardDescription } from '../domain/validation';
import { resolveTitleCommit } from '../domain/titleEdit';
import { isDone, completionPatch, incompleteSubtasks } from '../domain/completion';
import { formatDueDate } from '../domain/dates';
import LabelPicker from './LabelPicker';
import AssigneePicker from './AssigneePicker';
import DueDateField from './DueDateField';
import SubtaskSection from './SubtaskSection';
import styles from './CardPanel.module.css';

export default function CardPanel({
  card, allLabels, cardLabels, cardAssignees = [], members, boardId,
  onSave, onDelete, onClose,
  onCreateLabel, onPatchLabel, onDeleteLabel, onAttachLabel, onDetachLabel,
  onAttachAssignee, onDetachAssignee,
  userId,
  subtasks = [],
  onCreateSubtask,
  onCreateSubtasks,
  onToggleSubtask,
  onRenameSubtask,
  onDeleteSubtask,
  onMoveSubtaskUp,
  onMoveSubtaskDown,
}) {
  const [desc, setDesc]           = useState(card.description ?? '');
  const [dirty, setDirty]         = useState(false);
  const [error, setError]         = useState(null);
  const [editingTitle, setEditingTitle]   = useState(false);
  const [titleInput, setTitleInput]       = useState(card.title);
  const [titleError, setTitleError]       = useState(null);
  // A keyboard commit (Enter/Escape) closes the editor, which unmounts the
  // focused input and can fire onBlur — skip that follow-up blur commit.
  const skipTitleBlur = useRef(false);
  // Attaches still in flight, counted per `${cardId}:${labelId}` (a label can be
  // re-attached before its first PUT settles; the panel can switch cards). The
  // server rejects such a label as the Category until its attach commits, so
  // LabelPicker keeps its ☆/★ disabled meanwhile (#56).
  const [pendingAttaches, setPendingAttaches] = useState(() => new Map());
  const pendingLabelIds = new Set(
    allLabels.filter(l => pendingAttaches.has(`${card.id}:${l.id}`)).map(l => l.id));

  function countPending(key, delta) {
    setPendingAttaches(m => {
      const next = new Map(m);
      const n = (next.get(key) ?? 0) + delta;
      if (n > 0) next.set(key, n); else next.delete(key);
      return next;
    });
  }

  function handleAttachLabel(labelId) {
    const key = `${card.id}:${labelId}`;
    countPending(key, 1);
    onAttachLabel(card.id, labelId, userId).finally(() => countPending(key, -1));
  }

  useEffect(() => {
    setDesc(card.description ?? '');
    setDirty(false);
    setError(null);
  }, [card.id, card.description]);

  // Discard any half-typed title edit when switching to a different card.
  // (titleInput needs no reset here: startTitleEdit seeds it from card.title.)
  useEffect(() => {
    setEditingTitle(false);
    setTitleError(null);
  }, [card.id]);

  function startTitleEdit() {
    setTitleInput(card.title);
    setTitleError(null);
    setEditingTitle(true);
  }

  function commitTitle(trigger) {
    const result = resolveTitleCommit({ trigger, value: titleInput, current: card.title });
    if (result.action === 'error') { setTitleError(result.message); return; }
    if (result.action === 'save') onSave({ title: result.title });
    skipTitleBlur.current = true;
    setEditingTitle(false);
    setTitleError(null);
  }

  function handleTitleBlur() {
    if (skipTitleBlur.current) { skipTitleBlur.current = false; return; }
    commitTitle('blur');
  }

  function handleTitleKeyDown(e) {
    if (e.key === 'Enter') { e.preventDefault(); commitTitle('enter'); }
    else if (e.key === 'Escape') { skipTitleBlur.current = true; setEditingTitle(false); setTitleError(null); }
  }

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

  function handleComplete() {
    const remaining = incompleteSubtasks(subtasks);
    if (remaining > 0 &&
        !window.confirm(`ยังมี subtask ที่ยังไม่เสร็จ ${remaining}/${subtasks.length} — ทำเครื่องหมายว่าเสร็จเลยไหม?`)) {
      return;
    }
    onSave(completionPatch(true));
  }

  const attachedIds = new Set(cardLabels.filter(cl => cl.cardId === card.id).map(cl => cl.labelId));

  return (
    <aside className={styles.panel}>
      <div className={styles.header}>
        {editingTitle ? (
          <div className={styles.titleEditRow}>
            <input
              className={styles.titleInput}
              data-testid="card-title-input"
              autoFocus
              value={titleInput}
              onFocus={e => e.target.select()}
              onChange={e => { setTitleInput(e.target.value); setTitleError(null); }}
              onKeyDown={handleTitleKeyDown}
              onBlur={handleTitleBlur}
            />
            {titleError && <p className={styles.fieldError}>{titleError}</p>}
          </div>
        ) : (
          <h2
            className={styles.title}
            data-testid="card-title"
            onClick={startTitleEdit}
            title="คลิกเพื่อแก้ไข"
          >{card.title}</h2>
        )}
        <button className={styles.closeBtn} onClick={onClose} title="Close panel">✕</button>
      </div>

      <div className={styles.body}>
        {isDone(card) ? (
          <div className={styles.completionDone}>
            <span className={styles.completionLabel}>✓ เสร็จเมื่อ {formatDueDate(card.completedAt)}</span>
            <button
              className={styles.unmarkBtn}
              data-testid="complete-toggle"
              onClick={() => onSave(completionPatch(false))}
            >เลิกทำเครื่องหมาย</button>
          </div>
        ) : (
          <button
            className={styles.completeBtn}
            data-testid="complete-toggle"
            onClick={handleComplete}
          >✓ ทำเครื่องหมายว่าเสร็จ</button>
        )}

        <LabelPicker
          boardId={boardId}
          userId={userId}
          allLabels={allLabels}
          attachedLabelIds={attachedIds}
          categoryLabelId={card.categoryLabelId}
          pendingLabelIds={pendingLabelIds}
          // The Category follows attach/detach inside the store action (#55).
          onAttach={handleAttachLabel}
          onDetach={labelId => onDetachLabel(card.id, labelId, userId)}
          onSetCategory={labelId => onSave({ categoryLabelId: labelId })}
          onCreateLabel={onCreateLabel}
          onPatchLabel={onPatchLabel}
          onDeleteLabel={onDeleteLabel}
        />

        <AssigneePicker
          members={members}
          assigneeIds={cardAssignees.filter(ca => ca.cardId === card.id).map(ca => ca.userId)}
          onAttach={uid => onAttachAssignee(card.id, uid)}
          onDetach={uid => onDetachAssignee(card.id, uid)}
        />

        <DueDateField
          dueDate={card.dueDate}
          onChange={dueDate => onSave({ dueDate })}
        />

        <SubtaskSection
          key={card.id}
          subtasks={subtasks}
          onCreate={onCreateSubtask}
          onCreateMany={onCreateSubtasks}
          onToggle={onToggleSubtask}
          onRename={onRenameSubtask}
          onDelete={onDeleteSubtask}
          onMoveUp={onMoveSubtaskUp}
          onMoveDown={onMoveSubtaskDown}
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
