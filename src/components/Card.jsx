import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { formatDueDate } from '../domain/dates';
import AvatarStack from './common/AvatarStack';
import styles from './Card.module.css';

function CalIcon() {
  return (
    <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor"
         strokeWidth="2" strokeLinecap="round">
      <rect x="3" y="4.5" width="18" height="17" rx="3" />
      <path d="M3 9h18M8 2.5v4M16 2.5v4" />
    </svg>
  );
}

function CheckIcon() {
  return (
    <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor"
         strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M20 6 9 17l-5-5" />
    </svg>
  );
}

export default function Card({ card, face, onClick, dragOverlay = false }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: card.id,
    data: { type: 'card', card, columnId: card.columnId },
  });

  // Face data (Category + accent, done/overdue, assignees, progress) comes from
  // domain/cardView.js — this component only renders it.
  const { category, accent, done: cardDone, overdue, date, assignees, progress } = face;

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0 : (cardDone ? 0.6 : 1),
  };

  return (
    <div
      ref={setNodeRef}
      style={dragOverlay ? {} : style}
      {...attributes}
      {...listeners}
      className={`${styles.card} ${dragOverlay ? styles.overlay : ''}`}
      onClick={() => { if (!isDragging) onClick?.(card); }}
      onKeyDown={e => {
        if (!isDragging && (e.key === 'Enter' || e.key === ' ')) {
          e.preventDefault();
          onClick?.(card);
        }
      }}
      role="button"
      tabIndex={0}
    >
      <div className={styles.top}>
        <span className={styles.topLeft}>
          {cardDone && <span className={styles.doneBadge} data-testid="card-done-badge" title="เสร็จแล้ว">✓</span>}
          {category && (
            <span className={styles.label} style={{ color: accent.text }} data-testid="card-category">
              <span className={styles.dot} style={{ background: accent.solid }} />
              {category.name}
            </span>
          )}
        </span>
        <AvatarStack users={assignees} size={24} />
      </div>

      <p className={styles.title}>{card.title}</p>

      <div className={styles.rule} />

      <div className={styles.foot}>
        {date.kind === 'completed' ? (
          <span className={`${styles.due} ${styles.completed}`} data-testid="card-completed">
            <CheckIcon />
            เสร็จ {formatDueDate(date.ymd)}
          </span>
        ) : date.kind === 'due' ? (
          <span className={`${styles.due} ${overdue ? styles.overdueDue : ''}`} data-testid="card-due">
            <CalIcon />
            {formatDueDate(date.ymd)}
          </span>
        ) : (
          <span className={`${styles.due} ${styles.muted}`}>ไม่มีกำหนด</span>
        )}

        {progress && (
          <span className={styles.check} data-testid="card-progress">
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
      </div>
    </div>
  );
}
