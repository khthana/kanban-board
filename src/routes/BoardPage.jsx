import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  DndContext, DragOverlay, closestCenter, PointerSensor,
  KeyboardSensor, useSensor, useSensors,
} from '@dnd-kit/core';
import { SortableContext, horizontalListSortingStrategy, sortableKeyboardCoordinates } from '@dnd-kit/sortable';
import useSession from '../store/useSession';
import useBoardStore from '../store/useBoardStore';
import { usePolling } from '../hooks/usePolling';
import { resolveDrag } from '../domain/dragDrop';
import { DND_ACTIVATION_DISTANCE } from '../constants';
import TopBar from '../components/TopBar';
import Column from '../components/Column';
import ColumnComposer from '../components/ColumnComposer';
import ListView from '../components/ListView';
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
    createLabel, patchLabel, deleteLabel, attachLabel, detachLabel,
    attachAssignee, detachAssignee,
    addMember, removeMember,
    createSubtask, toggleSubtask, renameSubtask, deleteSubtask, moveSubtaskUp, moveSubtaskDown,
  } = useBoardStore();

  const [activeCard, setActiveCard]   = useState(null);
  const [inviteOpen, setInviteOpen]   = useState(false);
  const [activeDrag, setActiveDrag]   = useState(null);
  const [opError, setOpError]         = useState(null);
  const [view, setView]               = useState('board');

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: DND_ACTIVATION_DISTANCE } }),
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
    const outcome = resolveDrag(board, { active, over });
    if (!outcome) return;
    if (outcome.type === 'column') {
      moveColumn(outcome.columnId, currentUserId, { position: outcome.position })
        .catch(err => setOpError(err.message));
    } else {
      moveCard(outcome.cardId, currentUserId, { columnId: outcome.toColumnId, position: outcome.position })
        .catch(err => setOpError(err.message));
    }
  }

  if (loading || !board) {
    return <div className={styles.loading}>Loading…</div>;
  }

  const { board: boardData, columns, cards, labels, members, cardLabels, cardAssignees = [], subtasks: allSubtasks = [] } = board;
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
        view={view}
        onViewChange={v => { setView(v); setActiveCard(null); }}
      />

      {opError && (
        <div className={styles.opError}>
          ✕ {opError}
          <button className={styles.opErrorClose} onClick={() => setOpError(null)}>Dismiss</button>
        </div>
      )}

      <main className={styles.main}>
        {view === 'board' && (
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
                    cardAssignees={cardAssignees}
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
                  assigneeIds={cardAssignees.filter(ca => ca.cardId === activeCardData.id).map(ca => ca.userId)}
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
        )}

        {view === 'list' && (
          <ListView
            sortedColumns={sortedColumns}
            cards={cards}
            labels={labels}
            subtasks={allSubtasks}
            onAddColumn={name => createColumn(boardId, currentUserId, { name })}
          />
        )}
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
          cardAssignees={cardAssignees}
          members={members}
          boardId={boardId}
          userId={currentUserId}
          onSave={patch => patchCard(activeCard.id, currentUserId, patch)}
          onDelete={cardId => deleteCard(cardId, currentUserId)}
          onClose={() => setActiveCard(null)}
          onCreateLabel={(bId, uId, data) => createLabel(bId, uId, data)}
          onPatchLabel={(labelId, uId, patch) => patchLabel(labelId, uId, patch)}
          onDeleteLabel={(labelId, uId) => deleteLabel(labelId, uId)}
          onAttachLabel={(cardId, labelId, uId) => attachLabel(cardId, labelId, uId)}
          onDetachLabel={(cardId, labelId, uId) => detachLabel(cardId, labelId, uId)}
          onAttachAssignee={(cardId, uId) => attachAssignee(cardId, uId)}
          onDetachAssignee={(cardId, uId) => detachAssignee(cardId, uId)}
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
