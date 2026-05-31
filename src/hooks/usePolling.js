import { useEffect } from 'react';
import { getBoard } from '../api/client';

const STORAGE_KEY = 'kanban_db';

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

    function onStorage(e) {
      if (e.key === STORAGE_KEY) reconcile();
    }

    window.addEventListener('storage', onStorage);
    const timer = setInterval(reconcile, intervalMs);

    return () => {
      window.removeEventListener('storage', onStorage);
      clearInterval(timer);
    };
  }, [boardId, userId, intervalMs, onReconcile, onForbidden, onNotFound]);
}
