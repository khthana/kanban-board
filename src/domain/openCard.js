// Open Card (#81): which Card the Card panel shows, held as an id only — the
// Card itself is derived from the store board (`openCardOf`), so the panel is
// never a stale copy. `openCardAfter` is the whole open / close / announce
// decision (PRD §1.5):
//
//   { type: 'open', id }   a Card clicked (Board or List view)
//   { type: 'close' }      panel ✕, view switch, drag start, the board
//                          actions' card-gone policy — silently
//   { type: 'boardChanged', board, goneByPoll }
//                          the store board changed. The open Card gone from it
//                          → close; announce only if a poll removed it
//                          (`goneByPoll`: the ids the last poll took off the
//                          board — another member deleted them). Gone any
//                          other way (e.g. its Column deleted here) → silent.
//
// `board` is the store's board (server + pending ops), not a raw snapshot, so
// a Card still being created stays on it through a poll that predates it.

const onBoard = (board, id) => (board?.cards ?? []).some(c => c.id === id);

export function openCardAfter(id, event) {
  switch (event.type) {
    case 'open':
      return { id: event.id, announce: false };
    case 'close':
      return { id: null, announce: false };
    case 'boardChanged':
      if (id === null || onBoard(event.board, id)) return { id, announce: false };
      return { id: null, announce: (event.goneByPoll ?? []).includes(id) };
    default:
      return { id, announce: false };
  }
}

export function openCardOf(board, id) {
  if (id === null || !board) return null;
  return board.cards.find(c => c.id === id) ?? null;
}

// The ids of the Cards on `before` that aren't on `after` — what one write
// (the store's poll) took off the board.
export function cardsGone(before, after) {
  return (before?.cards ?? []).filter(c => !onBoard(after, c.id)).map(c => c.id);
}
