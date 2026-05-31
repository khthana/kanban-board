import { useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import useSession from '../store/useSession';
import useBoardStore from '../store/useBoardStore';
import TopBar from '../components/TopBar';
import Column from '../components/Column';
import styles from './BoardPage.module.css';

export default function BoardPage() {
  const { boardId } = useParams();
  const navigate    = useNavigate();
  const { currentUserId } = useSession();
  const { board, loading, error, fetchBoard } = useBoardStore();

  useEffect(() => {
    fetchBoard(boardId, currentUserId);
  }, [boardId, currentUserId, fetchBoard]);

  // 403 / not a member → back to board list
  useEffect(() => {
    if (error) navigate('/boards', { replace: true });
  }, [error, navigate]);

  if (loading || !board) {
    return <div className={styles.loading}>Loading…</div>;
  }

  const { board: boardData, columns, cards, members } = board;
  const sortedColumns = [...columns].sort((a, b) => a.position - b.position);

  return (
    <div className={styles.page}>
      <TopBar board={boardData} members={members} />

      <main className={styles.main}>
        {sortedColumns.length === 0 ? (
          <div className={styles.emptyBoard}>
            <p className={styles.emptyMsg}>No columns yet.</p>
            <p className={styles.emptyHint}>Add the first column to get started.</p>
          </div>
        ) : (
          <div className={styles.columns}>
            {sortedColumns.map(col => (
              <Column
                key={col.id}
                column={col}
                cards={cards
                  .filter(c => c.columnId === col.id)
                  .sort((a, b) => a.position - b.position)}
              />
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
