import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { isOverdue, formatDueDate } from '../domain/dates';
import { progressView } from '../domain/progress';
import { cardAccent, categoryLabel } from '../domain/accent';
import { isDone } from '../domain/completion';
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

export default function Card({ card, onClick, labels = [], members = [], assigneeIds = [], subtasks = [], dragOverlay = false }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: card.id,
    data: { type: 'card', card, columnId: card.columnId },
  });

  const cardDone = isDone(card);

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0 : (cardDone ? 0.6 : 1),
  };

  // The Category is the label flagged by category_label_id; its color is the
  // card's accent. Falls back to neutral when unset (categoryLabel → null).
  const category = categoryLabel(card.categoryLabelId, labels);
  const accent   = cardAccent(category?.color ?? null);

  const overdue  = isOverdue(card.dueDate);
  const assignees = assigneeIds
    .map(uid => {
      const user = members.find(m => m.userId === uid)?.user;
      return user && { userId: uid, displayName: user.displayName };
    })
    .filter(Boolean);

  const total = subtasks.length;
  const done  = subtasks.filter(s => s.checked).length;
  const progress = total > 0 ? progressView(done, total) : null;

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
        {card.dueDate ? (
          <span className={`${styles.due} ${overdue ? styles.overdueDue : ''}`} data-testid="card-due">
            <CalIcon />
            {formatDueDate(card.dueDate)}
          </span>
        ) : (
          <span className={`${styles.due} ${styles.muted}`}>ไม่มีกำหนด</span>
        )}

        {progress && (
          <span className={styles.check} data-testid="card-progress">
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
    </div>
  );
}
