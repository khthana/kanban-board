import { useState, useEffect } from 'react';
import { validateCardDescription } from '../domain/validation';
import styles from './CardPanel.module.css';

export default function CardPanel({ card, onSave, onDelete, onClose }) {
  const [desc, setDesc]   = useState(card.description ?? '');
  const [dirty, setDirty] = useState(false);
  const [error, setError] = useState(null);

  // reset when card changes
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

  return (
    <aside className={styles.panel}>
      <div className={styles.header}>
        <h2 className={styles.title}>{card.title}</h2>
        <button className={styles.closeBtn} onClick={onClose} title="Close panel">✕</button>
      </div>

      <div className={styles.body}>
        <label className={styles.label} htmlFor="card-desc">Description</label>
        <textarea
          id="card-desc"
          className={styles.textarea}
          value={desc}
          rows={8}
          maxLength={5001}
          placeholder="Add a description…"
          onChange={handleDescChange}
        />
        {error && <p className={styles.fieldError}>{error}</p>}
        {dirty && !error && (
          <button className={styles.saveBtn} onClick={handleSave}>Save</button>
        )}
      </div>

      <div className={styles.footer}>
        <button className={styles.deleteBtn} onClick={handleDelete}>Delete card</button>
      </div>
    </aside>
  );
}
