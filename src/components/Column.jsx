import { useRef, useState } from 'react';
import { useSortable, SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { useDroppable } from '@dnd-kit/core';
import { CSS } from '@dnd-kit/utilities';
import { validateColumnName } from '../domain/validation';
import Card from './Card';
import CardComposer from './CardComposer';
import styles from './Column.module.css';

const PRESET_COLORS = [
  '#fca5a5', '#fdba74', '#fde047', '#86efac',
  '#67e8f9', '#93c5fd', '#c4b5fd', '#f9a8d4',
];

function RenameForm({ column, onSave, onCancel }) {
  const [name, setName]   = useState(column.name);
  const [color, setColor] = useState(column.color ?? null);
  const [error, setError] = useState(null);
  const colorInputRef     = useRef(null);

  const isPreset = color !== null && PRESET_COLORS.includes(color);

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

      <div className={styles.swatchRow}>
        {PRESET_COLORS.map(c => (
          <button
            key={c}
            type="button"
            data-swatch={c}
            className={`${styles.swatch} ${color === c ? styles.swatchSelected : ''}`}
            style={{ background: c }}
            onClick={() => setColor(c)}
            title={c}
          />
        ))}
        <button
          type="button"
          data-swatch="custom"
          className={`${styles.swatch} ${styles.swatchCustom} ${color !== null && !isPreset ? styles.swatchSelected : ''}`}
          style={color !== null && !isPreset ? { background: color } : {}}
          onClick={() => colorInputRef.current?.click()}
          title="Custom color"
        >
          {(color === null || isPreset) && '+'}
        </button>
        <button
          type="button"
          data-swatch="clear"
          className={`${styles.swatch} ${styles.swatchClear} ${color === null ? styles.swatchSelected : ''}`}
          onClick={() => setColor(null)}
          title="No color"
        >✕</button>
        <input
          ref={colorInputRef}
          type="color"
          value={color !== null && !isPreset ? color : '#ffffff'}
          onChange={e => setColor(e.target.value)}
          className={styles.hiddenColorInput}
        />
      </div>

      <div className={styles.renameRow}>
        <button className={styles.btnSave} type="submit">Save</button>
        <button className={styles.btnCancel} type="button" onClick={onCancel}>Cancel</button>
      </div>
    </form>
  );
}

export default function Column({
  column, cards, labels = [], cardLabels = [], members = [], subtasks = [],
  onRename, onDelete, onCardClick, onAddCard,
  dragOverlay = false,
}) {
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
    if (cards.length > 0) {
      if (!window.confirm(`Delete "${column.name}"? Its ${cards.length} card(s) will also be deleted.`)) return;
    }
    onDelete(column.id);
  }

  const cardIds = cards.map(c => c.id);
  const headerStyle = column.color ? { background: column.color } : {};

  return (
    <div ref={setSortableRef} className={styles.column} style={style} data-testid="column" {...attributes}>
      <div className={styles.header} style={headerStyle} data-testid="column-header">
        {renaming ? (
          <RenameForm
            column={column}
            onSave={(name, color) => { onRename(column.id, name, color); setRenaming(false); }}
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
                labels={cardLabelObjs} members={members}
                subtasks={subtasks.filter(s => s.cardId === card.id)} />
            );
          })}
        </SortableContext>
        {!dragOverlay && <CardComposer onAdd={title => onAddCard(column.id, title)} />}
      </div>
    </div>
  );
}
