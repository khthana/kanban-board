import { useState } from 'react';
import { validateLabelColor, validateBoardName } from '../domain/validation';
import LabelChip from './LabelChip';
import styles from './LabelPicker.module.css';

export default function LabelPicker({ boardId, userId, allLabels, attachedLabelIds, onAttach, onDetach, onCreateLabel, onDeleteLabel }) {
  const [creating, setCreating] = useState(false);
  const [name, setName]   = useState('');
  const [color, setColor] = useState('#3b82f6');
  const [nameErr, setNameErr]   = useState(null);
  const [colorErr, setColorErr] = useState(null);

  function handleCreate(e) {
    e.preventDefault();
    const ne = validateBoardName(name);
    const ce = validateLabelColor(color);
    if (ne) { setNameErr(ne); return; }
    if (ce) { setColorErr(ce); return; }
    onCreateLabel(boardId, userId, { name, color });
    setName(''); setColor('#3b82f6'); setCreating(false);
  }

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
          <div className={styles.colorRow}>
            <input type="color" value={color} onChange={e => { setColor(e.target.value); setColorErr(null); }} />
            <input className={styles.input} value={color} placeholder="#rrggbb"
              onChange={e => { setColor(e.target.value); setColorErr(null); }} maxLength={7} />
          </div>
          {colorErr && <span className={styles.err}>{colorErr}</span>}
          <div className={styles.btnRow}>
            <button className={styles.btnCreate} type="submit">Create</button>
            <button className={styles.btnCancel} type="button" onClick={() => setCreating(false)}>Cancel</button>
          </div>
        </form>
      ) : (
        <button className={styles.addLabelBtn} onClick={() => setCreating(true)}>+ Create label</button>
      )}
    </div>
  );
}
