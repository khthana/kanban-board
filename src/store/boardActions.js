// Board actions (#68): every mutation of the open board, bound to it, together
// with its error policy — so components call `actions.attachLabel(cardId,
// labelId)` and never decide what a failure means.
//
// The store actions are optimistic and roll back + rethrow on failure; the
// policy decides where that failure goes:
//   banner  (default) → report.opError(message); the promise resolves
//   inline            → the promise rejects; the caller shows the error
//                       (Subtask add/rename, invite)
//   card gone         → saving a Card another member deleted (404) closes the
//                       Card panel with CARD_DELETED_MESSAGE (PRD §1.5)
//   delete-404        → deleting an already-deleted Card is swallowed
//
// `report` is { opError(message), closeCard() } — the page's banner and panel.

export const CARD_DELETED_MESSAGE = 'This card was deleted by another member.';

export function createBoardActions({ store, boardId, report }) {
  const banner = promise => promise.catch(err => { report.opError(err.message); });
  const cardDeleted = () => {
    report.closeCard();
    report.opError(CARD_DELETED_MESSAGE);
  };

  return {
    // columns
    createColumn: name => banner(store.createColumn(boardId, { name })),
    renameColumn: (columnId, { name, color }) => banner(store.renameColumn(columnId, { name, color })),
    deleteColumn: columnId => banner(store.deleteColumn(columnId)),
    moveColumn:   (columnId, { position }) => banner(store.moveColumn(columnId, { position })),

    // cards
    createCard: (columnId, title) => banner(store.createCard(columnId, { title })),
    moveCard: (cardId, { columnId, position }) => banner(store.moveCard(cardId, { columnId, position })),
    patchCard: (cardId, patch) => store.patchCard(cardId, patch).catch(err => {
      if (err.status === 404) cardDeleted();
      else report.opError(err.message);
    }),
    deleteCard: cardId => store.deleteCard(cardId).catch(err => {
      if (err.status !== 404) report.opError(err.message);
    }),
    // Polling found the open Card gone: the same announcement as a failed save.
    cardDeleted,

    // labels
    createLabel: ({ name, color }) => banner(store.createLabel(boardId, { name, color })),
    patchLabel:  (labelId, patch) => banner(store.patchLabel(labelId, patch)),
    deleteLabel: labelId => banner(store.deleteLabel(labelId)),
    attachLabel: (cardId, labelId) => banner(store.attachLabel(cardId, labelId)),
    detachLabel: (cardId, labelId) => banner(store.detachLabel(cardId, labelId)),

    // assignees
    attachAssignee: (cardId, userId) => banner(store.attachAssignee(cardId, userId)),
    detachAssignee: (cardId, userId) => banner(store.detachAssignee(cardId, userId)),

    // subtasks
    createSubtasks:  (cardId, titles) => store.createSubtasks(cardId, titles),      // inline
    renameSubtask:   (subtaskId, title) => store.renameSubtask(subtaskId, title),   // inline
    toggleSubtask:   subtaskId => banner(store.toggleSubtask(subtaskId)),
    deleteSubtask:   subtaskId => banner(store.deleteSubtask(subtaskId)),
    moveSubtaskUp:   (subtaskId, opts) => banner(store.moveSubtaskUp(subtaskId, opts)),
    moveSubtaskDown: (subtaskId, opts) => banner(store.moveSubtaskDown(subtaskId, opts)),

    // members
    addMember:    email => store.addMember(boardId, { email }),                    // inline
    removeMember: memberId => banner(store.removeMember(boardId, { memberId })),
  };
}
