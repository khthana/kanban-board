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
    onReconcile: handleReconcile,
    onForbidden: () => navigate('/boards', { state: { ejected: true } }),
    onNotFound:  () => navigate('/boards', { replace: true }),
  });

  useEffect(() => {
    if (activeCard && board) {
      const updated = board.cards.find(c => c.id === activeCard.id);
      // Gone from the board (e.g. its column was deleted): close the panel.
      // Deletions by another member are announced where they're detected —
      // handleReconcile and handleSaveCard.
      setActiveCard(updated ?? null);
    }
  }, [board?.cards, board?.cardLabels]); // eslint-disable-line react-hooks/exhaustive-deps

  // only navigate away for fetch/auth errors (403/404), not mutation errors
  useEffect(() => {
    if (error && (loading === false && !board)) navigate('/boards', { replace: true });
  }, [error, loading, board, navigate]);

  // Optimistic store actions roll back on failure; surface the reason in the op-error banner.
  function reportOpError(promise) {
    return promise.catch(err => setOpError(err.message));
  }

  function reportCardDeleted() {
    setActiveCard(null);
    setOpError('This card was deleted by another member.');
  }

  // Polling: if the open card is missing from the fresh snapshot, another member deleted it.
  function handleReconcile(data) {
    if (activeCard && !data.cards.some(c => c.id === activeCard.id)) reportCardDeleted();
    reconcileBoard(data);
  }

  function handleSaveCard(patch) {
    return patchCard(activeCard.id, currentUserId, patch).catch(err => {
      if (err.status === 404) reportCardDeleted();
      else setOpError(err.message);
    });
  }

  // A 404 means another member already deleted it — the card is gone either way.
  function handleDeleteCard(cardId) {
    return deleteCard(cardId, currentUserId).catch(err => {
      if (err.status !== 404) setOpError(err.message);
    });
  }

  function handleAddColumn(name) {
    return reportOpError(createColumn(boardId, currentUserId, { name }));
  }

  function handleAddCard(colId, title) {
    return reportOpError(createCard(colId, currentUserId, { title }));
  }

  function handleDragStart({ active }) {
    setActiveDrag(active.data.current ?? null);
    setActiveCard(null); // close panel during drag
  }

  function handleDragEnd({ active, over }) {
    setActiveDrag(null);
    const outcome = resolveDrag(board, { active, over });
    if (!outcome) return;
    if (outcome.type === 'column') {
      reportOpError(moveColumn(outcome.columnId, currentUserId, { position: outcome.position }));
    } else {
      reportOpError(moveCard(outcome.cardId, currentUserId, { columnId: outcome.toColumnId, position: outcome.position }));
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
        onRemoveMember={memberId => reportOpError(removeMember(boardId, currentUserId, { memberId }))}
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
                    onRename={(colId, name, color) => reportOpError(renameColumn(colId, currentUserId, { name, color }))}
                    onDelete={(colId) => reportOpError(deleteColumn(colId, currentUserId))}
                    onCardClick={setActiveCard}
                    onAddCard={handleAddCard}
                  />
                ))}
                <ColumnComposer onAdd={handleAddColumn} />
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
            members={members}
            cardAssignees={cardAssignees}
            onAddColumn={handleAddColumn}
            onCardClick={setActiveCard}
            onAddCard={handleAddCard}
            style={activeCard ? { marginRight: 380 } : {}}
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
          onSave={handleSaveCard}
          onDelete={handleDeleteCard}
          onClose={() => setActiveCard(null)}
          onCreateLabel={(bId, uId, data) => reportOpError(createLabel(bId, uId, data))}
          onPatchLabel={(labelId, uId, patch) => reportOpError(patchLabel(labelId, uId, patch))}
          onDeleteLabel={(labelId, uId) => reportOpError(deleteLabel(labelId, uId))}
          onAttachLabel={(cardId, labelId, uId) => reportOpError(attachLabel(cardId, labelId, uId))}
          onDetachLabel={(cardId, labelId, uId) => reportOpError(detachLabel(cardId, labelId, uId))}
          onAttachAssignee={(cardId, uId) => reportOpError(attachAssignee(cardId, uId))}
          onDetachAssignee={(cardId, uId) => reportOpError(detachAssignee(cardId, uId))}
          subtasks={(board?.subtasks ?? []).filter(s => s.cardId === activeCard?.id)}
          onCreateSubtask={title => createSubtask(activeCard.id, { title })}
          onToggleSubtask={id => reportOpError(toggleSubtask(id))}
          onRenameSubtask={renameSubtask}
          onDeleteSubtask={id => reportOpError(deleteSubtask(id))}
          onMoveSubtaskUp={id => reportOpError(moveSubtaskUp(id))}
          onMoveSubtaskDown={id => reportOpError(moveSubtaskDown(id))}
        />
      )}
    </div>
  );
}
