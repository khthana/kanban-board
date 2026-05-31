import { useState } from 'react';
import { validateCardTitle } from '../domain/validation';
import styles from './CardComposer.module.css';

export default function CardComposer({ onAdd }) {
  const [open, setOpen]   = useState(false);
  const [title, setTitle] = useState('');
  const [error, setError] = useState(null);

  function handleSubmit(e) {
    e.preventDefault();
    const err = validateCardTitle(title);
    if (err) { setError(err); return; }
    onAdd(title);
    setTitle('');
    setError(null);
    setOpen(false);
  }

  if (!open) {
    return (
      <button className={styles.addBtn} onClick={() => setOpen(true)}>
        + Add card
      </button>
    );
  }

  return (
    <form className={styles.form} onSubmit={handleSubmit}>
      <textarea
        className={styles.input}
        placeholder="Card title…"
        value={title}
        autoFocus
        maxLength={256}
        rows={2}
        onChange={e => { setTitle(e.target.value); setError(null); }}
      />
      {error && <span className={styles.fieldError}>{error}</span>}
      <div className={styles.row}>
        <button className={styles.btn} type="submit">Add card</button>
        <button className={styles.btnCancel} type="button"
          onClick={() => { setOpen(false); setTitle(''); setError(null); }}>
          Cancel
        </button>
      </div>
    </form>
  );
}
