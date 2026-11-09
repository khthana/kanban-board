import { useState, useEffect, useRef } from 'react';
import { validateCardDescription } from '../domain/validation';
import { resolveTitleCommit } from '../domain/titleEdit';
import { isDone, completionPatch } from '../domain/completion';
import { cardView } from '../domain/cardView';
import { formatDueDate } from '../domain/dates';
import LabelPicker from './LabelPicker';
import AssigneePicker from './AssigneePicker';
import DueDateField from './DueDateField';
import SubtaskSection from './SubtaskSection';
import styles from './CardPanel.module.css';

// The Card panel: the open Card plus the board actions (#68), which own every
// mutation and what its failure means — no per-mutation callbacks.
export default function CardPanel({ card, board, actions, onClose }) {
  const [desc, setDesc]           = useState(card.description ?? '');
  const [dirty, setDirty]         = useState(false);
  const [error, setError]         = useState(null);
  const [editingTitle, setEditingTitle]   = useState(false);
  const [titleInput, setTitleInput]       = useState(card.title);
  const [titleError, setTitleError]       = useState(null);
  // A keyboard commit (Enter/Escape) closes the editor, which unmounts the
  // focused input and can fire onBlur — skip that follow-up blur commit.
  const skipTitleBlur = useRef(false);
  const { labels: allLabels = [], members = [] } = board;
  const { labelIds: attachedIds, assigneeIds, subtasks, progress } = cardView(board, card);
  const saveCard = patch => actions.patchCard(card.id, patch);

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
    if (result.action === 'save') saveCard({ title: result.title });
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
    saveCard({ description: desc });
    setDirty(false);
  }

  function handleDelete() {
    if (!window.confirm(`Delete "${card.title}"?`)) return;
    actions.deleteCard(card.id);
    onClose();
  }

  function handleComplete() {
    const remaining = progress ? progress.total - progress.done : 0;
    if (remaining > 0 &&
        !window.confirm(`ยังมี subtask ที่ยังไม่เสร็จ ${remaining}/${progress.total} — ทำเครื่องหมายว่าเสร็จเลยไหม?`)) {
      return;
    }
    saveCard(completionPatch(true));
  }

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
              onClick={() => saveCard(completionPatch(false))}
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
          cardId={card.id}
          allLabels={allLabels}
          attachedLabelIds={attachedIds}
          categoryLabelId={card.categoryLabelId}
          actions={actions}
        />

        <AssigneePicker
          cardId={card.id}
          members={members}
          assigneeIds={assigneeIds}
          actions={actions}
        />

        <DueDateField
          dueDate={card.dueDate}
          onChange={dueDate => saveCard({ dueDate })}
        />

        <SubtaskSection
          key={card.id}
          cardId={card.id}
          subtasks={subtasks}
          actions={actions}
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
