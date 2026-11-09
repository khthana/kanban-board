import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  DndContext, DragOverlay, closestCenter, PointerSensor,
  KeyboardSensor, useSensor, useSensors,
} from '@dnd-kit/core';
import { SortableContext, horizontalListSortingStrategy, sortableKeyboardCoordinates } from '@dnd-kit/sortable';
import useSession from '../store/useSession';
import useBoardStore from '../store/useBoardStore';
import { useBoardActions } from '../hooks/useBoardActions';
import { usePolling } from '../hooks/usePolling';
import { resolveDrag } from '../domain/dragDrop';
import { cardView } from '../domain/cardView';
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
  const { board, loading, error, failedCreate, fetchBoard, pollBoard } = useBoardStore();

  const [activeCard, setActiveCard]   = useState(null);
  const [inviteOpen, setInviteOpen]   = useState(false);
  const [activeDrag, setActiveDrag]   = useState(null);
  const [opError, setOpError]         = useState(null);
  const [view, setView]               = useState('board');
  // Every board mutation and its error policy (#68): failures land in the
  // op-error banner, or close the Card panel when the Card is gone.
  const actions = useBoardActions(boardId, { opError: setOpError, closeCard: () => setActiveCard(null) });

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: DND_ACTIVATION_DISTANCE } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  useEffect(() => {
    fetchBoard(boardId);
  }, [boardId, fetchBoard]);

  usePolling({
    boardId,
    poll: pollBoard,
    onReconcile: handleReconcile,
    onForbidden: () => navigate('/boards', { state: { ejected: true } }),
    onNotFound:  () => navigate('/boards', { replace: true }),
  });

  useEffect(() => {
    if (activeCard && board) {
      const updated = board.cards.find(c => c.id === activeCard.id);
      // Gone from the board (e.g. its column was deleted): close the panel.
      // Deletions by another member are announced where they're detected —
      // handleReconcile and the board actions' card-gone policy.
      setActiveCard(updated ?? null);
    }
  }, [board?.cards, board?.cardLabels]); // eslint-disable-line react-hooks/exhaustive-deps

  // only navigate away for fetch/auth errors (403/404, or the Board's create
  // failed), not mutation errors. A failed create's error goes along, since
  // the list's fetch on mount clears the store's (#76).
  useEffect(() => {
    if (error && (loading === false && !board)) {
      navigate('/boards', { replace: true, state: failedCreate ? { error: failedCreate } : undefined });
    }
  }, [error, failedCreate, loading, board, navigate]);

  // Polling (pollBoard has already written the snapshot into the store): if
  // the open card is now missing from the board, another member deleted it.
  // Read the board, not the raw snapshot — a poll may predate a Card still
  // being created, and a stale poll is ignored.
  function handleReconcile() {
    const cards = useBoardStore.getState().board?.cards ?? [];
    if (activeCard && !cards.some(c => c.id === activeCard.id)) actions.cardDeleted();
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
      actions.moveColumn(outcome.columnId, { position: outcome.position });
    } else {
      actions.moveCard(outcome.cardId, { columnId: outcome.toColumnId, position: outcome.position });
    }
  }

  if (loading || !board) {
    return <div className={styles.loading}>Loading…</div>;
  }

  const { board: boardData, columns, cards, members } = board;
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
        onRemoveMember={actions.removeMember}
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
                    board={board}
                    onRename={(colId, name, color) => actions.renameColumn(colId, { name, color })}
                    onDelete={actions.deleteColumn}
                    onCardClick={setActiveCard}
                    onAddCard={actions.createCard}
                  />
                ))}
                <ColumnComposer onAdd={actions.createColumn} />
              </div>
            </SortableContext>

            <DragOverlay>
              {activeCardData && (
                <Card card={activeCardData} face={cardView(board, activeCardData)} dragOverlay />
              )}
              {activeColData && (
                <Column column={activeColData}
                  cards={cards.filter(c => c.columnId === activeColData.id).sort((a, b) => a.position - b.position)}
                  board={board}
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
            board={board}
            onAddColumn={actions.createColumn}
            onCardClick={setActiveCard}
            onAddCard={actions.createCard}
            style={activeCard ? { marginRight: 380 } : {}}
          />
        )}
      </main>

      {inviteOpen && (
        <InviteDialog
          members={members}
          onInvite={actions.addMember}
          onClose={() => setInviteOpen(false)}
        />
      )}

      {activeCard && (
        <CardPanel
          card={activeCard}
          board={board}
          actions={actions}
          onClose={() => setActiveCard(null)}
        />
      )}
    </div>
  );
}
