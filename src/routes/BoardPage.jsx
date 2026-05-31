import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import useSession from '../store/useSession';
import useBoardStore from '../store/useBoardStore';
import TopBar from '../components/TopBar';
import Column from '../components/Column';
import ColumnComposer from '../components/ColumnComposer';
import CardPanel from '../components/CardPanel';
import styles from './BoardPage.module.css';

export default function BoardPage() {
  const { boardId } = useParams();
  const navigate    = useNavigate();
  const { currentUserId } = useSession();
  const {
    board, loading, error,
    fetchBoard,
    createColumn, renameColumn, deleteColumn,
    createCard, patchCard, deleteCard,
    createLabel, deleteLabel, attachLabel, detachLabel,
  } = useBoardStore();
  const [activeCard, setActiveCard] = useState(null);

  useEffect(() => {
    fetchBoard(boardId, currentUserId);
  }, [boardId, currentUserId, fetchBoard]);

  // keep activeCard in sync with store
  useEffect(() => {
    if (activeCard && board) {
      const updated = board.cards.find(c => c.id === activeCard.id);
      if (updated) setActiveCard(updated);
    }
  }, [board?.cards, board?.cardLabels]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (error) navigate('/boards', { replace: true });
  }, [error, navigate]);

  if (loading || !board) {
    return <div className={styles.loading}>Loading…</div>;
  }

  const { board: boardData, columns, cards, labels, members, cardLabels } = board;
  const sortedColumns = [...columns].sort((a, b) => a.position - b.position);

  function cardLabelsFor(cardId) {
    const attachedIds = new Set(cardLabels.filter(cl => cl.cardId === cardId).map(cl => cl.labelId));
    return labels.filter(l => attachedIds.has(l.id));
  }

  return (
    <div className={styles.page}>
      <TopBar board={boardData} members={members} />

      <main className={styles.main}>
        <div className={styles.columns} style={activeCard ? { marginRight: 380 } : {}}>
          {sortedColumns.map(col => (
            <Column
              key={col.id}
              column={col}
              cards={cards.filter(c => c.columnId === col.id).sort((a, b) => a.position - b.position)}
              labels={labels}
              cardLabels={cardLabels}
              members={members}
              onRename={(colId, name) => renameColumn(colId, currentUserId, { name })}
              onDelete={(colId) => deleteColumn(colId, currentUserId)}
              onCardClick={setActiveCard}
              onAddCard={(colId, title) => createCard(colId, currentUserId, { title })}
            />
          ))}
          <ColumnComposer onAdd={name => createColumn(boardId, currentUserId, { name })} />
        </div>
      </main>

      {activeCard && (
        <CardPanel
          card={activeCard}
          allLabels={labels}
          cardLabels={cardLabels}
          members={members}
          boardId={boardId}
          userId={currentUserId}
          onSave={patch => patchCard(activeCard.id, currentUserId, patch)}
          onDelete={cardId => deleteCard(cardId, currentUserId)}
          onClose={() => setActiveCard(null)}
          onCreateLabel={(bId, uId, data) => createLabel(bId, uId, data)}
          onDeleteLabel={(labelId, uId) => deleteLabel(labelId, uId)}
          onAttachLabel={(cardId, labelId, uId) => attachLabel(cardId, labelId, uId)}
          onDetachLabel={(cardId, labelId, uId) => detachLabel(cardId, labelId, uId)}
        />
      )}
    </div>
  );
}
