// Column view: a Column as Board view, List view, the drag overlay and
// drag-and-drop see it — its Accent and its own Cards in position order —
// derived from the board in one place (the Column-level sibling of cardView, #80).
// None of them sorts Columns or filters/sorts Cards by columnId itself.

const byPosition = (a, b) => a.position - b.position;

// board: the store's board shape ({ columns, cards }).
// accent: the Column's color, or null = neutral (ADR-0001). Components apply
// `.accented` + `--accent` from it.
export function columnView(board, column) {
  const cards = (board.cards ?? []).filter(c => c.columnId === column.id).sort(byPosition);
  return { column, accent: column.color || null, cards, count: cards.length };
}

// Every Column of the board, in position order.
export function columnViews(board) {
  return [...(board.columns ?? [])].sort(byPosition).map(column => columnView(board, column));
}
