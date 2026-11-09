// Card view: everything a Card's face shows (plus the joins the Card panel needs:
// labelIds, assigneeIds, subtasks), derived from the board in one place.
// Board view's Card, List view's row, the drag overlay and the Card panel all
// read it, so none of them joins cardLabels / cardAssignees / subtasks by card id.

import { categoryLabel, cardAccent } from './accent';
import { isOverdue } from './dates';
import { isDone } from './completion';
import { assigneeUsers } from './assignees';
import { subtaskProgress } from './progress';

// board: the store's board shape ({ labels, members, cardLabels, cardAssignees, subtasks }).
export function cardView(board, card) {
  const labelIds = new Set(
    (board.cardLabels ?? []).filter(cl => cl.cardId === card.id).map(cl => cl.labelId));
  const category = categoryLabel(card.categoryLabelId, (board.labels ?? []).filter(l => labelIds.has(l.id)));
  const done = isDone(card);
  const assigneeIds = (board.cardAssignees ?? []).filter(ca => ca.cardId === card.id).map(ca => ca.userId);
  const subtasks = (board.subtasks ?? []).filter(s => s.cardId === card.id);
  const progress = subtaskProgress(subtasks);

  return {
    labelIds,
    category,
    accent: cardAccent(category?.color ?? null),
    done,
    // A done card shows its completion date instead, so it's never overdue.
    overdue: !done && isOverdue(card.dueDate),
    // Which date the foot shows: the completion date on a done card, else the due date.
    date: done ? { kind: 'completed', ymd: card.completedAt }
      : card.dueDate ? { kind: 'due', ymd: card.dueDate }
      : { kind: 'none', ymd: null },
    assigneeIds,
    assignees: assigneeUsers(assigneeIds, board.members ?? []),
    subtasks,
    progress: progress.total > 0 ? progress : null,
  };
}
