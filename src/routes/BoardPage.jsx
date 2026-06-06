import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  DndContext, DragOverlay, closestCenter, PointerSensor,
  KeyboardSensor, useSensor, useSensors,
} from '@dnd-kit/core';
import { SortableContext, horizontalListSortingStrategy, sortableKeyboardCoordinates, arrayMove } from '@dnd-kit/sortable';
import useSession from '../store/useSession';
import useBoardStore from '../store/useBoardStore';
import { usePolling } from '../hooks/usePolling';
import { positionBetween } from '../domain/ordering';
import TopBar from '../components/TopBar';
import Column from '../components/Column';
import ColumnComposer from '../components/ColumnComposer';
import CardPanel from '../components/CardPanel';
import Card from '../components/Card';
import InviteDialog from '../components/InviteDialog';
import styles from './BoardPage.module.css';

export default function BoardPage() {
  const { boardId } = useParams();
  const navigate    = useNavigate();
  const { currentUserId } = useSession();
  const {
    board, loading, error,
    fetchBoard, reconcileBoard,
    createColumn, renameColumn, deleteColumn, moveColumn,
    createCard, patchCard, deleteCard, moveCard,
    createLabel, deleteLabel, attachLabel, detachLabel,
    addMember, removeMember,
    createSubtask, toggleSubtask, renameSubtask, deleteSubtask, moveSubtaskUp, moveSubtaskDown,
  } = useBoardStore();

  const [activeCard, setActiveCard]   = useState(null);
  const [inviteOpen, setInviteOpen]   = useState(false);
  const [activeDrag, setActiveDrag]   = useState(null);
  const [opError, setOpError]         = useState(null);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  useEffect(() => {
    fetchBoard(boardId, currentUserId);
  }, [boardId, currentUserId, fetchBoard]);

  usePolling({
    boardId,
    userId: currentUserId,
    onReconcile: reconcileBoard,
    onForbidden: () => navigate('/boards', { state: { ejected: true } }),
    onNotFound:  () => navigate('/boards', { replace: true }),
  });

  useEffect(() => {
    if (activeCard && board) {
      const updated = board.cards.find(c => c.id === activeCard.id);
      if (updated) setActiveCard(updated);
    }
  }, [board?.cards, board?.cardLabels]); // eslint-disable-line react-hooks/exhaustive-deps

  // only navigate away for fetch/auth errors (403/404), not mutation errors
  useEffect(() => {
    if (error && (loading === false && !board)) navigate('/boards', { replace: true });
  }, [error, loading, board, navigate]);

  function handleDragStart({ active }) {
    setActiveDrag(active.data.current ?? null);
    setActiveCard(null); // close panel during drag
  }

  function handleDragEnd({ active, over }) {
    setActiveDrag(null);
    if (!over || active.id === over.id) return;

    const { columns, cards } = board;
    const sortedCols = [...columns].sort((a, b) => a.position - b.position);

    const activeType = active.data.current?.type;

    // ── Column reorder ────────────────────────────────────────────────────────
    if (activeType === 'column') {
      const fromIdx = sortedCols.findIndex(c => c.id === active.id);

      // over.id may be a column id, a col:xxx droppable, or a card id (dropped on card in target column)
      let toIdx = sortedCols.findIndex(c => c.id === over.id);
      if (toIdx < 0) {
        const overCard = board.cards.find(c => c.id === over.id);
        if (overCard) toIdx = sortedCols.findIndex(c => c.id === overCard.columnId);
      }
      if (toIdx < 0 && typeof over.id === 'string' && over.id.startsWith('col:')) {
        toIdx = sortedCols.findIndex(c => c.id === over.id.slice(4));
      }
      if (fromIdx < 0 || toIdx < 0 || fromIdx === toIdx) return;

      const reordered = arrayMove(sortedCols, fromIdx, toIdx);
      const newIdx = reordered.findIndex(c => c.id === active.id);
      const prev = reordered[newIdx - 1];
      const next = reordered[newIdx + 1];
      const position = positionBetween(prev?.position ?? null, next?.position ?? null);
      moveColumn(active.id, currentUserId, { position }).catch(err => setOpError(err.message));
      return;
    }

    // ── Card move ─────────────────────────────────────────────────────────────
    if (activeType === 'card') {
      const overType = over.data.current?.type;

      // Determine target column
      let targetColumnId;
      if (overType === 'column') {
        targetColumnId = over.id;
      } else if (overType === 'card') {
        targetColumnId = over.data.current.columnId;
      } else if (typeof over.id === 'string' && over.id.startsWith('col:')) {
        targetColumnId = over.id.slice(4); // useDroppable id format
      } else {
        return;
      }

      // Cards in target column excluding the active card, sorted
      const colCards = cards
        .filter(c => c.columnId === targetColumnId && c.id !== active.id)
        .sort((a, b) => a.position - b.position);

      let position;
      if (overType === 'column' || (typeof over.id === 'string' && over.id.startsWith('col:'))) {
        position = positionBetween(colCards.at(-1)?.position ?? null, null);
      } else {
        const overIdx = colCards.findIndex(c => c.id === over.id);
        position = positionBetween(
          colCards[overIdx - 1]?.position ?? null,
          colCards[overIdx]?.position ?? null,
        );
      }

      moveCard(active.id, currentUserId, { columnId: targetColumnId, position })
        .catch(err => setOpError(err.message));
    }
  }

  if (loading || !board) {
    return <div className={styles.loading}>Loading…</div>;
  }

  const { board: boardData, columns, cards, labels, members, cardLabels, subtasks: allSubtasks = [] } = board;
  const sortedColumns = [...columns].sort((a, b) => a.position - b.position);

  // Active drag overlay data
  const activeCardData = activeDrag?.type === 'card'
    ? cards.find(c => c.id === activeDrag.card?.id) ?? activeDrag.card
    : null;
  const activeColData = activeDrag?.type === 'column'
    ? columns.find(c => c.id === activeDrag.col?.id) ?? activeDrag.col
    : null;

  return (
    <div className={styles.page}>
      <TopBar
        board={boardData}
        members={members}
        currentUserId={currentUserId}
        onInvite={() => setInviteOpen(true)}
        onRemoveMember={memberId => removeMember(boardId, currentUserId, { memberId })}
      />

      {opError && (
        <div className={styles.opError}>
          ✕ {opError}
          <button className={styles.opErrorClose} onClick={() => setOpError(null)}>Dismiss</button>
        </div>
      )}

      <main className={styles.main}>
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragStart={handleDragStart}
          onDragEnd={handleDragEnd}
        >
          <SortableContext items={sortedColumns.map(c => c.id)} strategy={horizontalListSortingStrategy}>
            <div className={styles.columns} style={activeCard ? { marginRight: 380 } : {}}>
              {sortedColumns.map(col => (
                <Column
                  key={col.id}
                  column={col}
                  cards={cards.filter(c => c.columnId === col.id).sort((a, b) => a.position - b.position)}
                  labels={labels}
                  cardLabels={cardLabels}
                  members={members}
                  subtasks={allSubtasks}
                  onRename={(colId, name, color) => renameColumn(colId, currentUserId, { name, color })}
                  onDelete={(colId) => deleteColumn(colId, currentUserId)}
                  onCardClick={setActiveCard}
                  onAddCard={(colId, title) => createCard(colId, currentUserId, { title })}
                />
              ))}
              <ColumnComposer onAdd={name => createColumn(boardId, currentUserId, { name })} />
            </div>
          </SortableContext>

          <DragOverlay>
            {activeCardData && (
              <Card card={activeCardData} dragOverlay
                labels={labels.filter(l =>
                  new Set(cardLabels.filter(cl => cl.cardId === activeCardData.id).map(cl => cl.labelId)).has(l.id)
                )}
                members={members}
              />
            )}
            {activeColData && (
              <Column column={activeColData}
                cards={cards.filter(c => c.columnId === activeColData.id).sort((a, b) => a.position - b.position)}
                labels={labels} cardLabels={cardLabels} members={members}
                onRename={() => {}} onDelete={() => {}} onCardClick={() => {}} onAddCard={() => {}}
                dragOverlay
              />
            )}
          </DragOverlay>
        </DndContext>
      </main>

      {inviteOpen && (
        <InviteDialog
          members={members}
          onInvite={email => addMember(boardId, currentUserId, { email })}
          onClose={() => setInviteOpen(false)}
        />
      )}

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
          subtasks={(board?.subtasks ?? []).filter(s => s.cardId === activeCard?.id)}
          onCreateSubtask={title => createSubtask(activeCard.id, { title })}
          onToggleSubtask={toggleSubtask}
          onRenameSubtask={renameSubtask}
          onDeleteSubtask={deleteSubtask}
          onMoveSubtaskUp={moveSubtaskUp}
          onMoveSubtaskDown={moveSubtaskDown}
        />
      )}
    </div>
  );
}
