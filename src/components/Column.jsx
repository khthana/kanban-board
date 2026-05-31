import { useState } from 'react';
import { validateColumnName } from '../domain/validation';
import Card from './Card';
import CardComposer from './CardComposer';
import styles from './Column.module.css';

function RenameForm({ column, onSave, onCancel }) {
  const [name, setName]   = useState(column.name);
  const [error, setError] = useState(null);

  function handleSubmit(e) {
    e.preventDefault();
    const err = validateColumnName(name);
    if (err) { setError(err); return; }
    onSave(name);
  }

  return (
    <form className={styles.renameForm} onSubmit={handleSubmit}>
      <input
        className={styles.renameInput}
        value={name}
        autoFocus
        maxLength={101}
        onChange={e => { setName(e.target.value); setError(null); }}
      />
      {error && <span className={styles.fieldError}>{error}</span>}
      <div className={styles.renameRow}>
        <button className={styles.btnSave} type="submit">Save</button>
        <button className={styles.btnCancel} type="button" onClick={onCancel}>Cancel</button>
      </div>
    </form>
  );
}

export default function Column({ column, cards, onRename, onDelete, onCardClick, onAddCard }) {
  const [renaming, setRenaming] = useState(false);

  function handleDelete() {
    if (cards.length > 0) {
      if (!window.confirm(`Delete "${column.name}"? Its ${cards.length} card(s) will also be deleted.`)) return;
    }
    onDelete(column.id);
  }

  return (
    <div className={styles.column}>
      <div className={styles.header}>
        {renaming ? (
          <RenameForm
            column={column}
            onSave={name => { onRename(column.id, name); setRenaming(false); }}
            onCancel={() => setRenaming(false)}
          />
        ) : (
          <>
            <span className={styles.name}>{column.name}</span>
            <div className={styles.headerRight}>
              <span className={styles.count}>{cards.length}</span>
              <button className={styles.btnIcon} title="Rename column" onClick={() => setRenaming(true)}>✏️</button>
              <button className={`${styles.btnIcon} ${styles.btnDanger}`} title="Delete column" onClick={handleDelete}>🗑️</button>
            </div>
          </>
        )}
      </div>

      <div className={styles.cards}>
        {cards.length === 0 && (
          <p className={styles.empty}>No cards yet.</p>
        )}
        {cards.map(card => (
          <Card key={card.id} card={card} onClick={onCardClick} />
        ))}
        <CardComposer onAdd={title => onAddCard(column.id, title)} />
      </div>
    </div>
  );
}
