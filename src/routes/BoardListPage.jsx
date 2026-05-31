import { useEffect } from 'react';
import { Link } from 'react-router-dom';
import useSession from '../store/useSession';
import useBoardStore from '../store/useBoardStore';
import UserSwitcher from '../components/UserSwitcher';
import styles from './BoardListPage.module.css';

export default function BoardListPage() {
  const currentUserId = useSession(s => s.currentUserId);
  const { boards, loading, error, fetchBoards } = useBoardStore();

  useEffect(() => {
    fetchBoards(currentUserId);
  }, [currentUserId, fetchBoards]);

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <h1 className={styles.title}>Kanban Board</h1>
        <UserSwitcher />
      </header>

      <main className={styles.main}>
        {loading && <p className={styles.status}>Loading…</p>}
        {error   && <p className={styles.error}>{error}</p>}

        {!loading && !error && boards.length === 0 && (
          <p className={styles.empty}>No boards yet. Create one to get started.</p>
        )}

        {!loading && boards.length > 0 && (
          <ul className={styles.list}>
            {boards.map(board => (
              <li key={board.id} className={styles.item}>
                <Link to={`/boards/${board.id}`} className={styles.link}>
                  {board.name}
                </Link>
              </li>
            ))}
          </ul>
        )}
      </main>
    </div>
  );
}
