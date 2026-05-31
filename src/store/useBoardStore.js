import { create } from 'zustand';
import { v4 as uuidv4 } from 'uuid';
import * as client from '../api/client';
import { positionBetween } from '../domain/ordering';

const useBoardStore = create((set, get) => ({
  boards: [],
  board: null,
  loading: false,
  error: null,

  // ── boards ──────────────────────────────────────────────────────────────────

  fetchBoards: async (userId) => {
    set({ loading: true, error: null });
    try {
      const boards = await client.getBoards(userId);
      set({ boards, loading: false });
    } catch (err) {
      set({ error: err.message, loading: false });
    }
  },

  fetchBoard: async (boardId, userId) => {
    set({ loading: true, error: null });
    try {
      const data = await client.getBoard(boardId, userId);
      set({ board: data, loading: false });
    } catch (err) {
      set({ error: err.message, loading: false });
    }
  },

  createBoard: async (userId, { name }) => {
    const tempId = uuidv4();
    const placeholder = { id: tempId, name, ownerId: userId };
    const snapshot = get().boards;
    set({ boards: [...snapshot, placeholder], error: null });
    try {
      const board = await client.createBoard(userId, { name });
      set(s => ({ boards: s.boards.map(b => b.id === tempId ? board : b) }));
      return board;
    } catch (err) {
      set({ boards: snapshot, error: err.message });
      throw err;
    }
  },

  renameBoard: async (boardId, userId, { name }) => {
    const snapshot = get().boards;
    set(s => ({ boards: s.boards.map(b => b.id === boardId ? { ...b, name } : b), error: null }));
    try {
      const board = await client.patchBoard(boardId, userId, { name });
      set(s => ({ boards: s.boards.map(b => b.id === boardId ? board : b) }));
      return board;
    } catch (err) {
      set({ boards: snapshot, error: err.message });
      throw err;
    }
  },

  deleteBoard: async (boardId, userId) => {
    const snapshot = get().boards;
    set(s => ({ boards: s.boards.filter(b => b.id !== boardId), error: null }));
    try {
      await client.deleteBoard(boardId, userId);
    } catch (err) {
      set({ boards: snapshot, error: err.message });
      throw err;
    }
  },

  // ── columns ─────────────────────────────────────────────────────────────────

  createColumn: async (boardId, userId, { name }) => {
    const cols = get().board?.columns ?? [];
    const lastPos = cols.length > 0
      ? Math.max(...cols.map(c => c.position))
      : null;
    const position = positionBetween(lastPos, null);

    const tempId = uuidv4();
    const placeholder = { id: tempId, boardId, name, position };
    const snapshot = get().board;
    set(s => ({ board: { ...s.board, columns: [...(s.board?.columns ?? []), placeholder] }, error: null }));
    try {
      const col = await client.createColumn(boardId, userId, { name, position });
      set(s => ({
        board: { ...s.board, columns: s.board.columns.map(c => c.id === tempId ? col : c) },
      }));
      return col;
    } catch (err) {
      set({ board: snapshot, error: err.message });
      throw err;
    }
  },

  renameColumn: async (columnId, userId, { name }) => {
    const snapshot = get().board;
    set(s => ({
      board: { ...s.board, columns: s.board.columns.map(c => c.id === columnId ? { ...c, name } : c) },
      error: null,
    }));
    try {
      const col = await client.patchColumn(columnId, userId, { name });
      set(s => ({
        board: { ...s.board, columns: s.board.columns.map(c => c.id === columnId ? col : c) },
      }));
      return col;
    } catch (err) {
      set({ board: snapshot, error: err.message });
      throw err;
    }
  },

  deleteColumn: async (columnId, userId) => {
    const snapshot = get().board;
    set(s => ({
      board: {
        ...s.board,
        columns: s.board.columns.filter(c => c.id !== columnId),
        cards: s.board.cards.filter(c => c.columnId !== columnId),
      },
      error: null,
    }));
    try {
      await client.deleteColumn(columnId, userId);
    } catch (err) {
      set({ board: snapshot, error: err.message });
      throw err;
    }
  },

  // ── cards ────────────────────────────────────────────────────────────────────

  createCard: async (columnId, userId, { title }) => {
    const cards = get().board?.cards.filter(c => c.columnId === columnId) ?? [];
    const lastPos = cards.length > 0 ? Math.max(...cards.map(c => c.position)) : null;
    const position = positionBetween(lastPos, null);

    const tempId = uuidv4();
    const placeholder = { id: tempId, columnId, title, description: '', assigneeId: null, dueDate: null, position };
    const snapshot = get().board;
    set(s => ({ board: { ...s.board, cards: [...s.board.cards, placeholder] }, error: null }));
    try {
      const card = await client.createCard(columnId, userId, { title, position });
      set(s => ({ board: { ...s.board, cards: s.board.cards.map(c => c.id === tempId ? card : c) } }));
      return card;
    } catch (err) {
      set({ board: snapshot, error: err.message });
      throw err;
    }
  },

  patchCard: async (cardId, userId, patch) => {
    const snapshot = get().board;
    set(s => ({
      board: { ...s.board, cards: s.board.cards.map(c => c.id === cardId ? { ...c, ...patch } : c) },
      error: null,
    }));
    try {
      const card = await client.patchCard(cardId, userId, patch);
      set(s => ({ board: { ...s.board, cards: s.board.cards.map(c => c.id === cardId ? card : c) } }));
      return card;
    } catch (err) {
      set({ board: snapshot, error: err.message });
      throw err;
    }
  },

  deleteCard: async (cardId, userId) => {
    const snapshot = get().board;
    set(s => ({ board: { ...s.board, cards: s.board.cards.filter(c => c.id !== cardId) }, error: null }));
    try {
      await client.deleteCard(cardId, userId);
    } catch (err) {
      set({ board: snapshot, error: err.message });
      throw err;
    }
  },
}));

export default useBoardStore;
