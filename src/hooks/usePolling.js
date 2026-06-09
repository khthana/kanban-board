import { useEffect } from 'react';
import { getBoard } from '../api/client';
import { POLLING_INTERVAL_MS } from '../constants';

export function usePolling({ boardId, userId, intervalMs = POLLING_INTERVAL_MS, onReconcile, onForbidden, onNotFound }) {
  useEffect(() => {
    async function reconcile() {
      try {
        const data = await getBoard(boardId, userId);
        onReconcile?.(data);
      } catch (err) {
        if (err.status === 403) onForbidden?.();
        else if (err.status === 404) onNotFound?.();
      }
    }

    const timer = setInterval(reconcile, intervalMs);
    return () => clearInterval(timer);
  }, [boardId, userId, intervalMs, onReconcile, onForbidden, onNotFound]);
}
