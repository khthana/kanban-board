import { useLayoutEffect, useMemo, useRef } from 'react';
import useBoardStore from '../store/useBoardStore';
import { createBoardActions } from '../store/boardActions';

// The board actions (#68) for the open board, bound to the board store.
// `report` ({ opError, closeCard }) may change every render; the actions object
// stays stable per board and always reports through the latest one.
export function useBoardActions(boardId, report) {
  const reportRef = useRef(report);
  useLayoutEffect(() => { reportRef.current = report; });
  return useMemo(() => createBoardActions({
    store: useBoardStore.getState(),
    boardId,
    report: {
      opError:   message => reportRef.current.opError(message),
      closeCard: () => reportRef.current.closeCard(),
    },
  }), [boardId]);
}
