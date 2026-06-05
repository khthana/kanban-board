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

  reconcileBoard: (data) => {
    set({ board: data });
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

  moveCard: async (cardId, userId, { columnId, position }) => {
    const snapshot = get().board;
    set(s => ({
      board: { ...s.board, cards: s.board.cards.map(c => c.id === cardId ? { ...c, columnId, position } : c) },
      error: null,
    }));
    try {
      const card = await client.moveCard(cardId, userId, { columnId, position });
      set(s => ({ board: { ...s.board, cards: s.board.cards.map(c => c.id === cardId ? card : c) } }));
      return card;
    } catch (err) {
      set({ board: snapshot, error: err.message });
      throw err;
    }
  },

  moveColumn: async (columnId, userId, { position }) => {
    const snapshot = get().board;
    set(s => ({
      board: { ...s.board, columns: s.board.columns.map(c => c.id === columnId ? { ...c, position } : c) },
      error: null,
    }));
    try {
      const col = await client.patchColumn(columnId, userId, { position });
      set(s => ({ board: { ...s.board, columns: s.board.columns.map(c => c.id === columnId ? col : c) } }));
      return col;
    } catch (err) {
      set({ board: snapshot, error: err.message });
      throw err;
    }
  },

  // ── labels ───────────────────────────────────────────────────────────────────

  createLabel: async (boardId, userId, { name, color }) => {
    const snapshot = get().board;
    const tempId = uuidv4();
    set(s => ({ board: { ...s.board, labels: [...s.board.labels, { id: tempId, boardId, name, color }] }, error: null }));
    try {
      const label = await client.createLabel(boardId, userId, { name, color });
      set(s => ({ board: { ...s.board, labels: s.board.labels.map(l => l.id === tempId ? label : l) } }));
      return label;
    } catch (err) {
      set({ board: snapshot, error: err.message });
      throw err;
    }
  },

  deleteLabel: async (labelId, userId) => {
    const snapshot = get().board;
    set(s => ({
      board: {
        ...s.board,
        labels: s.board.labels.filter(l => l.id !== labelId),
        cardLabels: s.board.cardLabels.filter(cl => cl.labelId !== labelId),
      },
      error: null,
    }));
    try {
      await client.deleteLabel(labelId, userId);
    } catch (err) {
      set({ board: snapshot, error: err.message });
      throw err;
    }
  },

  attachLabel: async (cardId, labelId, userId) => {
    const snapshot = get().board;
    set(s => ({
      board: { ...s.board, cardLabels: [...s.board.cardLabels, { cardId, labelId }] },
      error: null,
    }));
    try {
      await client.attachLabel(cardId, labelId, userId);
    } catch (err) {
      set({ board: snapshot, error: err.message });
      throw err;
    }
  },

  detachLabel: async (cardId, labelId, userId) => {
    const snapshot = get().board;
    set(s => ({
      board: { ...s.board, cardLabels: s.board.cardLabels.filter(cl => !(cl.cardId === cardId && cl.labelId === labelId)) },
      error: null,
    }));
    try {
      await client.detachLabel(cardId, labelId, userId);
    } catch (err) {
      set({ board: snapshot, error: err.message });
      throw err;
    }
  },

  // ── members ──────────────────────────────────────────────────────────────────

  addMember: async (boardId, userId, { email }) => {
    // optimistic not possible without knowing the invitee's id upfront —
    // refetch after success instead
    try {
      await client.addMember(boardId, userId, { email });
      const data = await client.getBoard(boardId, userId);
      set({ board: data, error: null });
    } catch (err) {
      set(s => ({ error: err.message }));
      throw err;
    }
  },

  removeMember: async (boardId, userId, { memberId }) => {
    const snapshot = get().board;
    set(s => ({
      board: {
        ...s.board,
        members: s.board.members.filter(m => m.userId !== memberId),
      },
      error: null,
    }));
    try {
      await client.removeMember(boardId, userId, { memberId });
    } catch (err) {
      set({ board: snapshot, error: err.message });
      throw err;
    }
  },

  // ── subtasks ─────────────────────────────────────────────────────────────────

  moveSubtaskUp: async (subtaskId) => {
    const subtasks = get().board?.subtasks ?? [];
    const sorted = [...subtasks].sort((a, b) => a.position - b.position);
    const idx = sorted.findIndex(s => s.id === subtaskId);
    if (idx <= 0) return;

    const prev = sorted[idx - 2] ?? null;
    const target = sorted[idx - 1];
    const newPos = positionBetween(prev?.position ?? null, target.position);

    const snapshot = get().board;
    set(s => ({
      board: {
        ...s.board,
        subtasks: s.board.subtasks.map(st => st.id === subtaskId ? { ...st, position: newPos } : st),
      },
      error: null,
    }));
    try {
      const updated = await client.patchSubtask(subtaskId, { position: newPos });
      set(s => ({
        board: { ...s.board, subtasks: s.board.subtasks.map(st => st.id === subtaskId ? updated : st) },
      }));
    } catch (err) {
      set({ board: snapshot, error: err.message });
    }
  },

  moveSubtaskDown: async (subtaskId) => {
    const subtasks = get().board?.subtasks ?? [];
    const sorted = [...subtasks].sort((a, b) => a.position - b.position);
    const idx = sorted.findIndex(s => s.id === subtaskId);
    if (idx < 0 || idx >= sorted.length - 1) return;

    const target = sorted[idx + 1];
    const next = sorted[idx + 2] ?? null;
    const newPos = positionBetween(target.position, next?.position ?? null);

    const snapshot = get().board;
    set(s => ({
      board: {
        ...s.board,
        subtasks: s.board.subtasks.map(st => st.id === subtaskId ? { ...st, position: newPos } : st),
      },
      error: null,
    }));
    try {
      const updated = await client.patchSubtask(subtaskId, { position: newPos });
      set(s => ({
        board: { ...s.board, subtasks: s.board.subtasks.map(st => st.id === subtaskId ? updated : st) },
      }));
    } catch (err) {
      set({ board: snapshot, error: err.message });
    }
  },

  toggleSubtask: async (subtaskId) => {
    const current = get().board?.subtasks?.find(s => s.id === subtaskId);
    if (!current) return;
    const newChecked = !current.checked;
    const snapshot = get().board;
    set(s => ({
      board: { ...s.board, subtasks: s.board.subtasks.map(st => st.id === subtaskId ? { ...st, checked: newChecked } : st) },
      error: null,
    }));
    try {
      const updated = await client.patchSubtask(subtaskId, { checked: newChecked });
      set(s => ({
        board: { ...s.board, subtasks: s.board.subtasks.map(st => st.id === subtaskId ? updated : st) },
      }));
    } catch (err) {
      set({ board: snapshot, error: err.message });
    }
  },

  renameSubtask: async (subtaskId, title) => {
    const snapshot = get().board;
    set(s => ({
      board: { ...s.board, subtasks: s.board.subtasks.map(st => st.id === subtaskId ? { ...st, title } : st) },
      error: null,
    }));
    try {
      const updated = await client.patchSubtask(subtaskId, { title });
      set(s => ({
        board: { ...s.board, subtasks: s.board.subtasks.map(st => st.id === subtaskId ? updated : st) },
      }));
    } catch (err) {
      set({ board: snapshot, error: err.message });
      throw err;
    }
  },

  deleteSubtask: async (subtaskId) => {
    const snapshot = get().board;
    set(s => ({
      board: { ...s.board, subtasks: s.board.subtasks.filter(st => st.id !== subtaskId) },
      error: null,
    }));
    try {
      await client.deleteSubtask(subtaskId);
    } catch (err) {
      set({ board: snapshot, error: err.message });
    }
  },

  createSubtask: async (cardId, { title }) => {
    const tempId = uuidv4();
    const currentSubtasks = get().board?.subtasks ?? [];
    const cardSubtasks = currentSubtasks.filter(s => s.cardId === cardId);
    const maxPos = cardSubtasks.length > 0 ? Math.max(...cardSubtasks.map(s => s.position)) : 0;
    const placeholder = { id: tempId, cardId, title, checked: false, position: maxPos + 1 };
    const snapshot = get().board;
    set(s => ({ board: { ...s.board, subtasks: [...(s.board.subtasks ?? []), placeholder] }, error: null }));
    try {
      const subtask = await client.createSubtask(cardId, { title });
      set(s => ({
        board: {
          ...s.board,
          subtasks: s.board.subtasks.map(st => st.id === tempId ? subtask : st),
        },
      }));
      return subtask;
    } catch (err) {
      set({ board: snapshot, error: err.message });
      throw err;
    }
  },
}));

export default useBoardStore;
