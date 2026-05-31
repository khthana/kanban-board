import styles from './LabelChip.module.css';

export default function LabelChip({ label, onRemove }) {
  return (
    <span className={styles.chip} style={{ background: label.color }} title={label.name}>
      {label.name}
      {onRemove && (
        <button className={styles.remove} onClick={() => onRemove(label.id)} title="Remove label">✕</button>
      )}
    </span>
  );
}
