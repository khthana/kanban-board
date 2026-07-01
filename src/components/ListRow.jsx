import { categoryLabel, cardAccent } from '../domain/accent';
import { isOverdue, formatDueDate } from '../domain/dates';
import { progressView } from '../domain/progress';
import { isDone } from '../domain/completion';
import styles from './ListRow.module.css';

export default function ListRow({ card, labels = [], subtasks = [], onClick }) {
  const category = categoryLabel(card.categoryLabelId, labels);
  const accent = cardAccent(category?.color ?? null);
  const cardDone = isDone(card);
  const overdue = isOverdue(card.dueDate);

  const total = subtasks.length;
  const done = subtasks.filter(s => s.checked).length;
  const progress = total > 0 ? progressView(done, total) : null;

  return (
    <div
      className={styles.row}
      data-testid="list-row"
      style={cardDone ? { opacity: 0.6 } : undefined}
      role="button"
      tabIndex={0}
      onClick={() => onClick?.(card)}
      onKeyDown={e => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onClick?.(card);
        }
      }}
    >
      {cardDone && (
        <span className={styles.doneBadge} data-testid="list-row-done-badge" title="เสร็จแล้ว">✓</span>
      )}
      {category && (
        <span className={styles.category} style={{ color: accent.text }} data-testid="list-row-category">
          <span className={styles.dot} style={{ background: accent.solid }} />
          {category.name}
        </span>
      )}
      <p className={styles.title}>{card.title}</p>
      {cardDone ? (
        <span className={`${styles.due} ${styles.completed}`} data-testid="list-row-completed">
          เสร็จ {formatDueDate(card.completedAt)}
        </span>
      ) : card.dueDate ? (
        <span className={`${styles.due} ${overdue ? styles.overdueDue : ''}`} data-testid="list-row-due">
          {formatDueDate(card.dueDate)}
        </span>
      ) : (
        <span className={`${styles.due} ${styles.muted}`} data-testid="list-row-due">ไม่มีกำหนด</span>
      )}
      {progress && (
        <span className={styles.progress} data-testid="list-row-progress">
          {progress.mode === 'segments' ? (
            <span className={styles.segs}>
              {progress.segments.map((on, i) => (
                <span key={i} className={styles.seg} style={on ? { background: accent.solid } : undefined} />
              ))}
            </span>
          ) : (
            <span className={styles.minibar}>
              <span className={styles.minifill} style={{ width: `${progress.pct}%`, background: accent.solid }} />
            </span>
          )}
          <span className={`${styles.count} ${progress.complete ? styles.countDone : ''}`}>{done}/{total}</span>
        </span>
      )}
    </div>
  );
}
