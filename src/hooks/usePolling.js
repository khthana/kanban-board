import { useEffect } from 'react';
import { getBoard } from '../api/client';

export function usePolling({ boardId, userId, intervalMs = 10_000, onReconcile, onForbidden, onNotFound }) {
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
