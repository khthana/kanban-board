import { useState } from 'react';
import { validateColumnName } from '../domain/validation';
import styles from './ColumnComposer.module.css';

export default function ColumnComposer({ onAdd }) {
  const [open, setOpen]   = useState(false);
  const [name, setName]   = useState('');
  const [error, setError] = useState(null);

  function handleSubmit(e) {
    e.preventDefault();
    const err = validateColumnName(name);
    if (err) { setError(err); return; }
    onAdd(name);
    setName('');
    setError(null);
    setOpen(false);
  }

  if (!open) {
    return (
      <button className={styles.addBtn} onClick={() => setOpen(true)}>
        + Add column
      </button>
    );
  }

  return (
    <form className={styles.form} onSubmit={handleSubmit}>
      <input
        className={styles.input}
        placeholder="Column name…"
        value={name}
        autoFocus
        maxLength={101}
        onChange={e => { setName(e.target.value); setError(null); }}
      />
      {error && <span className={styles.fieldError}>{error}</span>}
      <div className={styles.row}>
        <button className={styles.btn} type="submit">Add</button>
        <button className={styles.btnCancel} type="button" onClick={() => { setOpen(false); setName(''); setError(null); }}>
          Cancel
        </button>
      </div>
    </form>
  );
}
