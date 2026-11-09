// Adaptive checklist-progress view model for the Editorial card (ADR-0002, spec §3.4).

export const SEG_MAX = 8;

export function progressView(done, total) {
  const complete = total > 0 && done === total;
  if (total > SEG_MAX) {
    return {
      mode: 'minibar',
      pct: Math.round((done / total) * 100),
      complete,
    };
  }
  return {
    mode: 'segments',
    segments: Array.from({ length: total }, (_, i) => i < done),
    complete,
  };
}

// A card's Subtask progress: how many are done out of how many, plus the
// adaptive view (null when the card has no Subtasks). The one place the done
// count is computed — the card face, List row and Subtask section all use it.
export function subtaskProgress(subtasks = []) {
  const total = subtasks.length;
  const done = subtasks.filter(s => s.checked).length;
  return { done, total, view: total > 0 ? progressView(done, total) : null };
}
