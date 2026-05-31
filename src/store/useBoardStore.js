import { create } from 'zustand';
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
}));

export default useBoardStore;
