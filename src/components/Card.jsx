import Avatar from './Avatar';
import styles from './Card.module.css';

function isOverdue(dueDate) {
  if (!dueDate) return false;
  return new Date(dueDate) < new Date(new Date().toDateString());
}

export default function Card({ card, onClick, labels = [], members = [] }) {
  const overdue  = isOverdue(card.dueDate);
  const assignee = members.find(m => m.userId === card.assigneeId)?.user ?? null;

  return (
    <div
      className={`${styles.card} ${overdue ? styles.overdue : ''}`}
      onClick={() => onClick(card)}
      role="button"
      tabIndex={0}
      onKeyDown={e => e.key === 'Enter' && onClick(card)}
    >
      {labels.length > 0 && (
        <div className={styles.labelBar}>
          {labels.map(l => (
            <span key={l.id} className={styles.labelDot} style={{ background: l.color }} title={l.name} />
          ))}
        </div>
      )}

      <p className={styles.title}>{card.title}</p>

      {(assignee || card.dueDate) && (
        <div className={styles.meta}>
          {card.dueDate && (
            <span className={`${styles.dueChip} ${overdue ? styles.overdueChip : ''}`}>
              {overdue && <span className={styles.overdueIcon} aria-label="Overdue">⚠</span>}
              {card.dueDate}
              {overdue && <span className={styles.overdueText}> · Overdue</span>}
            </span>
          )}
          {assignee && <Avatar user={assignee} size="sm" />}
        </div>
      )}
    </div>
  );
}
