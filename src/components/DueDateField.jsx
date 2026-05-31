import styles from './DueDateField.module.css';

export default function DueDateField({ dueDate, onChange }) {
  return (
    <div className={styles.wrapper}>
      <p className={styles.label}>Due date</p>
      <div className={styles.row}>
        <input
          className={styles.input}
          type="date"
          value={dueDate ?? ''}
          onChange={e => onChange(e.target.value || null)}
        />
        {dueDate && (
          <button className={styles.clear} onClick={() => onChange(null)} title="Clear due date">✕</button>
        )}
      </div>
    </div>
  );
}
