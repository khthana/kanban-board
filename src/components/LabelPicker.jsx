import { useRef, useState } from 'react';
import { validateLabelColor, validateBoardName } from '../domain/validation';
import LabelChip from './LabelChip';
import styles from './LabelPicker.module.css';

const PRESET_COLORS = [
  '#fca5a5', '#fdba74', '#fde047', '#86efac',
  '#67e8f9', '#93c5fd', '#c4b5fd', '#f9a8d4',
];

export default function LabelPicker({ boardId, userId, allLabels, attachedLabelIds, onAttach, onDetach, onCreateLabel, onDeleteLabel }) {
  const [creating, setCreating]     = useState(false);
  const [name, setName]             = useState('');
  const [color, setColor]           = useState(PRESET_COLORS[0]);
  const [nameErr, setNameErr]       = useState(null);
  const colorInputRef               = useRef(null);

  function handleCreate(e) {
    e.preventDefault();
    const ne = validateBoardName(name);
    const ce = validateLabelColor(color);
    if (ne) { setNameErr(ne); return; }
    if (ce) return;
    onCreateLabel(boardId, userId, { name, color });
    setName(''); setColor(PRESET_COLORS[0]); setCreating(false);
  }

  const isPreset = PRESET_COLORS.includes(color);

  return (
    <div className={styles.wrapper}>
      <p className={styles.sectionLabel}>Labels</p>

      <div className={styles.list}>
        {allLabels.map(label => {
          const attached = attachedLabelIds.has(label.id);
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
              <button className={styles.deleteLabel} title="Delete label" onClick={() => onDeleteLabel(label.id, userId)}>✕</button>
            </div>
          );
        })}
      </div>

      {creating ? (
        <form className={styles.createForm} onSubmit={handleCreate}>
          <input className={styles.input} placeholder="Label name" value={name}
            onChange={e => { setName(e.target.value); setNameErr(null); }} maxLength={101} />
          {nameErr && <span className={styles.err}>{nameErr}</span>}

          <div className={styles.swatchRow}>
            {PRESET_COLORS.map(c => (
              <button
                key={c}
                type="button"
                className={`${styles.swatch} ${color === c ? styles.swatchSelected : ''}`}
                style={{ background: c }}
                onClick={() => setColor(c)}
                title={c}
              />
            ))}
            <button
              type="button"
              className={`${styles.swatch} ${styles.swatchCustom} ${!isPreset ? styles.swatchSelected : ''}`}
              style={!isPreset ? { background: color } : {}}
              onClick={() => colorInputRef.current?.click()}
              title="Custom color"
            >
              {isPreset && '+'}
            </button>
            <input
              ref={colorInputRef}
              type="color"
              value={color}
              onChange={e => setColor(e.target.value)}
              className={styles.hiddenColorInput}
            />
          </div>

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
