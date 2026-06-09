import { useState } from 'react';
import { validateLabelColor, validateLabelName } from '../domain/validation';
import { PRESET_COLORS } from '../domain/colors';
import ColorPicker from './common/ColorPicker';
import styles from './LabelPicker.module.css';

export default function LabelPicker({ boardId, userId, allLabels, attachedLabelIds, categoryLabelId, onAttach, onDetach, onSetCategory, onCreateLabel, onDeleteLabel }) {
  const [creating, setCreating]     = useState(false);
  const [name, setName]             = useState('');
  const [color, setColor]           = useState(PRESET_COLORS[0]);
  const [nameErr, setNameErr]       = useState(null);

  function handleCreate(e) {
    e.preventDefault();
    const ne = validateLabelName(name);
    const ce = validateLabelColor(color);
    if (ne) { setNameErr(ne); return; }
    if (ce) return;
    onCreateLabel(boardId, userId, { name, color });
    setName(''); setColor(PRESET_COLORS[0]); setCreating(false);
  }

  return (
    <div className={styles.wrapper}>
      <p className={styles.sectionLabel}>Labels</p>

      <div className={styles.list}>
        {allLabels.map(label => {
          const attached = attachedLabelIds.has(label.id);
          const isCategory = attached && categoryLabelId === label.id;
          return (
            <div key={label.id} className={styles.row}>
              <button
                className={`${styles.labelBtn} ${attached ? styles.attached : ''}`}
                style={{ borderColor: label.color }}
                onClick={() => attached ? onDetach(label.id) : onAttach(label.id)}
              >
                <span className={styles.dot} style={{ background: label.color }} />
                {label.name}
                {attached && <span className={styles.check}>✓</span>}
              </button>
              {attached && (
                <button
                  className={`${styles.star} ${isCategory ? styles.starActive : ''}`}
                  title={isCategory ? 'Category (click to clear)' : 'Set as category'}
                  aria-label={isCategory ? `Clear ${label.name} as category` : `Set ${label.name} as category`}
                  data-testid="set-category"
                  onClick={() => onSetCategory(isCategory ? null : label.id)}
                >{isCategory ? '★' : '☆'}</button>
              )}
              <button className={styles.deleteLabel} title="Delete label" aria-label={`Delete label ${label.name}`} onClick={() => onDeleteLabel(label.id, userId)}>✕</button>
            </div>
          );
        })}
      </div>

      {creating ? (
        <form className={styles.createForm} onSubmit={handleCreate}>
          <input className={styles.input} placeholder="Label name" value={name}
            onChange={e => { setName(e.target.value); setNameErr(null); }} maxLength={101} />
          {nameErr && <span className={styles.err}>{nameErr}</span>}

          <ColorPicker value={color} onChange={setColor} />

          <div className={styles.btnRow}>
            <button className={styles.btnCreate} type="submit">Create</button>
            <button className={styles.btnCancel} type="button" onClick={() => { setCreating(false); setName(''); setColor(PRESET_COLORS[0]); }}>Cancel</button>
          </div>
        </form>
      ) : (
        <button className={styles.addLabelBtn} onClick={() => setCreating(true)}>+ Create label</button>
      )}
    </div>
  );
}
