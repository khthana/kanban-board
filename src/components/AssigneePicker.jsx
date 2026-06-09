import styles from './AssigneePicker.module.css';

export default function AssigneePicker({ members, assigneeIds = [], onAttach, onDetach }) {
  const assigned = new Set(assigneeIds);

  return (
    <div className={styles.wrapper}>
      <p className={styles.label}>Assignees</p>
      <div className={styles.list}>
        {members.map(m => {
          const isAssigned = assigned.has(m.userId);
          return (
            <button
              key={m.userId}
              className={`${styles.memberBtn} ${isAssigned ? styles.assigned : ''}`}
              data-testid="assignee-toggle"
              aria-pressed={isAssigned}
              onClick={() => (isAssigned ? onDetach(m.userId) : onAttach(m.userId))}
            >
              {m.user.displayName}
              {isAssigned && <span className={styles.check}>✓</span>}
            </button>
          );
        })}
      </div>
    </div>
  );
}
