import styles from './AssigneePicker.module.css';

export default function AssigneePicker({ members, assigneeId, onChange }) {
  return (
    <div className={styles.wrapper}>
      <p className={styles.label}>Assignee</p>
      <select
        className={styles.select}
        value={assigneeId ?? ''}
        onChange={e => onChange(e.target.value || null)}
      >
        <option value="">— Unassigned —</option>
        {members.map(m => (
          <option key={m.userId} value={m.userId}>{m.user.displayName}</option>
        ))}
      </select>
    </div>
  );
}
