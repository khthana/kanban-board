// Hiding done Subtasks in the Card panel (PRD §12): which rows show, and which
// row ↑/↓ swaps with when checked Subtasks are hidden.

const byPosition = (a, b) => a.position - b.position;

// One Card's Subtasks as the panel lists them: position order, minus the
// checked ones while they're hidden.
export function visibleSubtasks(cardSubtasks, { hideDone }) {
  return cardSubtasks
    .filter(s => !(hideDone && s.checked))
    .sort(byPosition);
}

// The visible Subtask that `subtaskId` swaps with on ↑ (dir -1) / ↓ (dir +1),
// or null at the edge. `subtasks` may hold every Card's Subtasks; only the
// moving Subtask's own Card counts.
export function visibleNeighbour(subtasks, subtaskId, dir, { hideDone }) {
  const moving = subtasks.find(s => s.id === subtaskId);
  if (!moving) return null;
  const visible = visibleSubtasks(subtasks.filter(s => s.cardId === moving.cardId), { hideDone });
  const idx = visible.findIndex(s => s.id === subtaskId);
  if (idx < 0) return null; // the moving Subtask is itself hidden
  return visible[idx + dir] ?? null;
}
