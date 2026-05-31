import { useState } from 'react';
import { useSortable, SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { useDroppable } from '@dnd-kit/core';
import { CSS } from '@dnd-kit/utilities';
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

export default function Column({
  column, cards, labels = [], cardLabels = [], members = [],
  onRename, onDelete, onCardClick, onAddCard,
  dragOverlay = false,
}) {
  const [renaming, setRenaming] = useState(false);

  // Column itself is sortable (for column reordering)
  const {
    attributes, listeners, setNodeRef: setSortableRef,
    transform, transition, isDragging,
  } = useSortable({ id: column.id, data: { type: 'column', col: column } });

  // Column body is a drop zone for cards (even when empty)
  const { setNodeRef: setDropRef } = useDroppable({ id: `col:${column.id}` });

  const style = dragOverlay ? {} : {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.4 : 1,
  };

  function handleDelete() {
    if (cards.length > 0) {
      if (!window.confirm(`Delete "${column.name}"? Its ${cards.length} card(s) will also be deleted.`)) return;
    }
    onDelete(column.id);
  }

  const cardIds = cards.map(c => c.id);

  return (
    <div ref={setSortableRef} className={styles.column} style={style} {...attributes}>
      <div className={styles.header}>
        {renaming ? (
          <RenameForm
            column={column}
            onSave={name => { onRename(column.id, name); setRenaming(false); }}
            onCancel={() => setRenaming(false)}
          />
        ) : (
          <>
            <div className={styles.dragHandle} {...listeners} title="Drag to reorder column">⋮⋮</div>
            <span className={styles.name}>{column.name}</span>
            <div className={styles.headerRight}>
              <span className={styles.count}>{cards.length}</span>
              {!dragOverlay && (
                <>
                  <button className={styles.btnIcon} title="Rename column" onClick={() => setRenaming(true)}>✏️</button>
                  <button className={`${styles.btnIcon} ${styles.btnDanger}`} title="Delete column" onClick={handleDelete}>🗑️</button>
                </>
              )}
            </div>
          </>
        )}
      </div>

      <div ref={setDropRef} className={styles.cards}>
        <SortableContext items={cardIds} strategy={verticalListSortingStrategy}>
          {cards.length === 0 && (
            <p className={styles.empty}>No cards yet.</p>
          )}
          {cards.map(card => {
            const attachedIds = new Set(cardLabels.filter(cl => cl.cardId === card.id).map(cl => cl.labelId));
            const cardLabelObjs = labels.filter(l => attachedIds.has(l.id));
            return (
              <Card key={card.id} card={card} onClick={onCardClick}
                labels={cardLabelObjs} members={members} />
            );
          })}
        </SortableContext>
        {!dragOverlay && <CardComposer onAdd={title => onAddCard(column.id, title)} />}
      </div>
    </div>
  );
}
