import { useState } from 'react';
import { useSortable, SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { useDroppable } from '@dnd-kit/core';
import { CSS } from '@dnd-kit/utilities';
import { validateColumnName } from '../domain/validation';
import { cardView } from '../domain/cardView';
import Card from './Card';
import CardComposer from './CardComposer';
import ColorPicker from './common/ColorPicker';
import styles from './Column.module.css';

function RenameForm({ column, onSave, onCancel }) {
  const [name, setName]   = useState(column.name);
  const [color, setColor] = useState(column.color ?? null);
  const [error, setError] = useState(null);

  function handleSubmit(e) {
    e.preventDefault();
    const err = validateColumnName(name);
    if (err) { setError(err); return; }
    onSave(name, color);
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

      <ColorPicker value={color} onChange={setColor} allowClear />

      <div className={styles.renameRow}>
        <button className={styles.btnSave} type="submit">Save</button>
        <button className={styles.btnCancel} type="button" onClick={onCancel}>Cancel</button>
      </div>
    </form>
  );
}

// view: the Column view (domain/columnView.js) — the Column, its Accent and its
// Cards in position order. board: for each Card's Card view.
export default function Column({
  view, board,
  onRename, onDelete, onCardClick, onAddCard,
  dragOverlay = false,
}) {
  const { column, accent, cards, count } = view;
  const [renaming, setRenaming] = useState(false);

  const {
    attributes, listeners, setNodeRef: setSortableRef,
    transform, transition, isDragging,
  } = useSortable({ id: column.id, data: { type: 'column', col: column } });

  const { setNodeRef: setDropRef } = useDroppable({ id: `col:${column.id}` });

  const style = dragOverlay ? {} : {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.4 : 1,
  };

  function handleDelete() {
    if (count > 0) {
      if (!window.confirm(`Delete "${column.name}"? Its ${count} card(s) will also be deleted.`)) return;
    }
    onDelete(column.id);
  }

  const cardIds = cards.map(c => c.id);
  const rootClass = `${styles.column} ${accent ? styles.accented : ''}`;
  const rootStyle = accent ? { ...style, '--accent': accent } : style;

  return (
    <div ref={setSortableRef} className={rootClass} style={rootStyle} data-testid="column" {...attributes}>
      <div className={styles.header} data-testid="column-header">
        {renaming ? (
          <RenameForm
            column={column}
            onSave={(name, color) => { onRename(column.id, name, color); setRenaming(false); }}
            onCancel={() => setRenaming(false)}
          />
        ) : (
          <>
            <div className={styles.dragHandle} {...listeners} title="Drag to reorder column">⋮⋮</div>
            <span className={styles.nameChip} data-testid="column-chip">{column.name}</span>
            <span className={styles.count}>{count}</span>
            {!dragOverlay && (
              <div className={styles.headerRight}>
                <button className={styles.btnIcon} title="Rename column" aria-label={`Rename column ${column.name}`} onClick={() => setRenaming(true)}>✏️</button>
                <button className={`${styles.btnIcon} ${styles.btnDanger}`} title="Delete column" aria-label={`Delete column ${column.name}`} onClick={handleDelete}>🗑️</button>
              </div>
            )}
          </>
        )}
      </div>

      <div ref={setDropRef} className={styles.cards}>
        <SortableContext items={cardIds} strategy={verticalListSortingStrategy}>
          {count === 0 && (
            <p className={styles.empty}>No cards yet.</p>
          )}
          {cards.map(card => (
            <Card key={card.id} card={card} face={cardView(board, card)} onClick={onCardClick} />
          ))}
        </SortableContext>
        {!dragOverlay && <CardComposer accent={accent} onAdd={title => onAddCard(column.id, title)} />}
      </div>
    </div>
  );
}
