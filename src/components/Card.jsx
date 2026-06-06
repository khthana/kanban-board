import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import Avatar from './Avatar';
import styles from './Card.module.css';

function isOverdue(dueDate) {
  if (!dueDate) return false;
  return new Date(dueDate) < new Date(new Date().toDateString());
}

function formatDueDate(dateStr) {
  if (!dateStr) return null;
  const [y, m, d] = dateStr.split('-').map(Number);
  return new Date(y, m - 1, d).toLocaleDateString('th-TH', { day: 'numeric', month: 'short', year: 'numeric' });
}

export default function Card({ card, onClick, labels = [], members = [], subtasks = [], dragOverlay = false }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: card.id,
    data: { type: 'card', card, columnId: card.columnId },
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0 : 1,
  };

  const overdue      = isOverdue(card.dueDate);
  const assignee     = members.find(m => m.userId === card.assigneeId)?.user ?? null;
  const checkedCount = subtasks.filter(s => s.checked).length;
  const totalCount   = subtasks.length;

  return (
    <div
      ref={setNodeRef}
      style={dragOverlay ? {} : style}
      {...attributes}
      {...listeners}
      className={`${styles.card} ${overdue ? styles.overdue : ''} ${dragOverlay ? styles.overlay : ''}`}
      onClick={e => { if (!isDragging) onClick?.(card); }}
      role="button"
      tabIndex={0}
    >
      {labels.length > 0 && (
        <div className={styles.colorBand} style={{ background: labels[0].color }} />
      )}

      <div className={styles.cardBody}>
        {labels.length > 1 && (
          <div className={styles.labelBar}>
            {labels.slice(1).map(l => (
              <span key={l.id} className={styles.labelDot} style={{ background: l.color }} title={l.name} />
            ))}
          </div>
        )}

        <p className={styles.title}>{card.title}</p>

        {(assignee || card.dueDate || totalCount > 0) && (
          <div className={styles.meta}>
            {card.dueDate && (
              <span className={`${styles.dueChip} ${overdue ? styles.overdueChip : ''}`}>
                {overdue && <span className={styles.overdueIcon} aria-label="Overdue">⚠</span>}
                {formatDueDate(card.dueDate)}
                {overdue && <span className={styles.overdueText}> · Overdue</span>}
              </span>
            )}
            {totalCount > 0 && (
              <span className={styles.subtaskProgress}>
                ✓ {checkedCount} / {totalCount}
              </span>
            )}
            {assignee && <Avatar user={assignee} size="sm" />}
          </div>
        )}
      </div>
    </div>
  );
}
