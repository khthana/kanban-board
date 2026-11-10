import { useEffect } from 'react';
import { getBoard } from '../api/client';
import { POLLING_INTERVAL_MS } from '../constants';

// `poll(boardId)` fetches the snapshot — the board store's pollBoard, which
// also writes it into the pending-ops board (#73); getBoard by default.
export function usePolling({ boardId, intervalMs = POLLING_INTERVAL_MS, poll = getBoard, onForbidden, onNotFound }) {
  useEffect(() => {
    async function reconcile() {
      try {
        await poll(boardId);
      } catch (err) {
        if (err.status === 403) onForbidden?.();
        else if (err.status === 404) onNotFound?.();
      }
    }

    const timer = setInterval(reconcile, intervalMs);
    return () => clearInterval(timer);
  }, [boardId, intervalMs, poll, onForbidden, onNotFound]);
}
