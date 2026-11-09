import { formatDueDate } from '../domain/dates';
import AvatarStack from './common/AvatarStack';
import styles from './ListRow.module.css';

// `face` is the Card view (domain/cardView.js) — the same face data as Card.jsx.
export default function ListRow({ card, face, onClick }) {
  const { category, accent, done: cardDone, overdue, date, assignees, progress } = face;

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
      {category ? (
        <span className={styles.category} style={{ color: accent.text }} data-testid="list-row-category">
          <span className={styles.dot} style={{ background: accent.solid }} />
          {category.name}
        </span>
      ) : (
        // Unlike the card face, a row with no Category still shows the neutral gray dot (PRD §11).
        <span className={styles.dot} style={{ background: accent.solid }} data-testid="list-row-category-none" />
      )}
      <p className={styles.title}>{card.title}</p>
      {date.kind === 'completed' ? (
        <span className={`${styles.due} ${styles.completed}`} data-testid="list-row-completed">
          เสร็จ {formatDueDate(date.ymd)}
        </span>
      ) : date.kind === 'due' ? (
        <span className={`${styles.due} ${overdue ? styles.overdueDue : ''}`} data-testid="list-row-due">
          {formatDueDate(date.ymd)}
        </span>
      ) : (
        <span className={`${styles.due} ${styles.muted}`} data-testid="list-row-due">ไม่มีกำหนด</span>
      )}
      {progress && (
        <span className={styles.progress} data-testid="list-row-progress">
          {progress.view.mode === 'segments' ? (
            <span className={styles.segs}>
              {progress.view.segments.map((on, i) => (
                <span key={i} className={styles.seg} style={on ? { background: accent.solid } : undefined} />
              ))}
            </span>
          ) : (
            <span className={styles.minibar}>
              <span className={styles.minifill} style={{ width: `${progress.view.pct}%`, background: accent.solid }} />
            </span>
          )}
          <span className={`${styles.count} ${progress.view.complete ? styles.countDone : ''}`}>{progress.done}/{progress.total}</span>
        </span>
      )}
      <AvatarStack users={assignees} size={24} />
    </div>
  );
}
