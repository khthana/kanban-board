import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { openCardAfter, openCardOf } from '../domain/openCard';

// The open Card (#81) — which Card the Card panel shows — held as an id only;
// the decision is domain/openCard.js. On every store board change the open
// Card is checked against it: taken off by a poll (`polledGone`, recorded by
// the store as the poll is written, so render timing doesn't matter) →
// another member deleted it → `onDeletedByOther()`; gone any other way →
// closed silently.
//
// Returns { card, open(card), close() }; `card` is derived from `board`, so it
// is never a stale copy.
export function useOpenCard(board, polledGone, onDeletedByOther) {
  const [id, setId] = useState(null);
  const announceRef = useRef(onDeletedByOther);
  useLayoutEffect(() => { announceRef.current = onDeletedByOther; });

  useEffect(() => {
    if (!board) return;
    const next = openCardAfter(id, { type: 'boardChanged', board, goneByPoll: polledGone });
    if (next.id === id) return;
    setId(next.id);
    if (next.announce) announceRef.current();
  }, [board, polledGone, id]);

  const open  = useCallback(card => setId(cur => openCardAfter(cur, { type: 'open', id: card.id }).id), []);
  const close = useCallback(() => setId(cur => openCardAfter(cur, { type: 'close' }).id), []);

  return { card: openCardOf(board, id), open, close };
}
