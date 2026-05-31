import { create } from 'zustand';
import { v4 as uuidv4 } from 'uuid';
import * as client from '../api/client';

const useBoardStore = create((set, get) => ({
  boards: [],
  board: null,
  loading: false,
  error: null,

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
    // optimistic: add placeholder immediately
    const tempId = uuidv4();
    const placeholder = { id: tempId, name, ownerId: userId };
    const snapshot = get().boards;
    set({ boards: [...snapshot, placeholder], error: null });
    try {
      const board = await client.createBoard(userId, { name });
      // replace placeholder with server response
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
}));

export default useBoardStore;
