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
import { useOpenCard } from '../hooks/useOpenCard';
import { resolveDrag } from '../domain/dragDrop';
import { columnView, columnViews } from '../domain/columnView';
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
  const { board, boardStatus, polledGone, fetchBoard, pollBoard } = useBoardStore();

  const [inviteOpen, setInviteOpen]   = useState(false);
  const [activeDrag, setActiveDrag]   = useState(null);
  const [opError, setOpError]         = useState(null);
  const [view, setView]               = useState('board');
  // Every board mutation and its error policy (#68): failures land in the
  // op-error banner, or close the Card panel when the Card is gone.
  // The Card panel's Card, held as an id (#81): open / close / "deleted by
  // another member" are decided in one place. (The announce callback reads
  // `actions` only when called — from an effect, after both are set up.)
  const openCard = useOpenCard(board, polledGone, () => actions.cardDeleted());
  const activeCard = openCard.card;
  const actions = useBoardActions(boardId, { opError: setOpError, closeCard: openCard.close });

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
    onForbidden: () => navigate('/boards', { state: { ejected: true } }),
    onNotFound:  () => navigate('/boards', { replace: true }),
  });

  // The Board didn't open (fetch 403/404, or its create failed): back to the
  // list. A failed create's error is the list's own `listError`, so it shows
  // there without being carried along (#76, #79).
  // Only this Board's status counts: one left failed by the Board before must
  // not eject this one.
  const status = boardStatus.boardId === boardId ? boardStatus.state : 'loading';
  useEffect(() => {
    if (status === 'failed') navigate('/boards', { replace: true });
  }, [status, navigate]);

  function handleDragStart({ active }) {
    setActiveDrag(active.data.current ?? null);
    openCard.close(); // close panel during drag
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

  if (status !== 'open' || !board) {
    return <div className={styles.loading}>Loading…</div>;
  }

  const { board: boardData, columns, cards, members } = board;
  const colViews = columnViews(board);

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
        onViewChange={v => { setView(v); openCard.close(); }}
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
            <SortableContext items={colViews.map(v => v.column.id)} strategy={horizontalListSortingStrategy}>
              <div className={styles.columns} style={activeCard ? { marginRight: 380 } : {}}>
                {colViews.map(colView => (
                  <Column
                    key={colView.column.id}
                    view={colView}
                    board={board}
                    onRename={(colId, name, color) => actions.renameColumn(colId, { name, color })}
                    onDelete={actions.deleteColumn}
                    onCardClick={openCard.open}
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
                <Column view={columnView(board, activeColData)}
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
            board={board}
            onAddColumn={actions.createColumn}
            onCardClick={openCard.open}
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
          onClose={openCard.close}
        />
      )}
    </div>
  );
}
