import { useState } from 'react';
import { validateCardTitle } from '../domain/validation';
import styles from './CardComposer.module.css';

export default function CardComposer({ onAdd, accent = null }) {
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
    const accentStyle = accent ? { color: `color-mix(in srgb, ${accent}, black 30%)` } : undefined;
    return (
      <button className={styles.addBtn} style={accentStyle} onClick={() => setOpen(true)}>
        + New card
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
