// API client — swap seam (PRD §3.7)
// Callers never import mockBackend directly; swap this file to use a real fetch-based backend.
import * as backend from './mockBackend';

export const getUsers   = ()                            => backend.getUsers();
export const getBoards  = (userId)                      => backend.getBoards(userId);
export const getBoard   = (boardId, userId)             => backend.getBoard(boardId, userId);
export const createBoard  = (userId, data)              => backend.createBoard(userId, data);
export const patchBoard   = (boardId, userId, patch)    => backend.patchBoard(boardId, userId, patch);
export const deleteBoard  = (boardId, userId)           => backend.deleteBoard(boardId, userId);
export const addMember    = (boardId, userId, data)     => backend.addMember(boardId, userId, data);
export const removeMember = (boardId, userId, data)     => backend.removeMember(boardId, userId, data);
export const createColumn = (boardId, userId, data)     => backend.createColumn(boardId, userId, data);
export const patchColumn  = (columnId, userId, patch)   => backend.patchColumn(columnId, userId, patch);
export const deleteColumn = (columnId, userId)          => backend.deleteColumn(columnId, userId);
export const createCard   = (columnId, userId, data)    => backend.createCard(columnId, userId, data);
export const patchCard    = (cardId, userId, patch)     => backend.patchCard(cardId, userId, patch);
export const moveCard     = (cardId, userId, data)      => backend.moveCard(cardId, userId, data);
export const deleteCard   = (cardId, userId)            => backend.deleteCard(cardId, userId);
export const createLabel  = (boardId, userId, data)     => backend.createLabel(boardId, userId, data);
export const patchLabel   = (labelId, userId, patch)    => backend.patchLabel(labelId, userId, patch);
export const deleteLabel  = (labelId, userId)           => backend.deleteLabel(labelId, userId);
export const attachLabel  = (cardId, labelId, userId)   => backend.attachLabel(cardId, labelId, userId);
export const detachLabel  = (cardId, labelId, userId)   => backend.detachLabel(cardId, labelId, userId);

export { setForceFailNext } from './mockBackend';
