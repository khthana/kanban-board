import { create } from 'zustand';
import { v4 as uuidv4 } from 'uuid';
import * as client from '../api/client';
import { positionBetween } from '../domain/ordering';

// Optimistic-update helper for mutations on the active `board`:
//   1. snapshot current board
//   2. apply(board) optimistically
//   3. await commit() — the API call
//   4. settle(board, result) to replace placeholders / merge server data
//   5. on error, roll back to the snapshot (and rethrow unless rethrow:false)
// Returns the commit() result so callers can return server records.
async function optimistic(get, set, { apply, commit, settle, rethrow = true }) {
  const snapshot = get().board;
  set(s => ({ board: apply(s.board), error: null }));
  try {
    const result = await commit();
    if (settle) set(s => ({ board: settle(s.board, result) }));
    return result;
  } catch (err) {
    set({ board: snapshot, error: err.message });
    if (rethrow) throw err;
  }
}

// position after the last item in a collection (or first slot when empty)
const nextPosition = (items, getPos = i => i.position) =>
  positionBetween(items.length > 0 ? Math.max(...items.map(getPos)) : null, null);

const mapById = (arr, id, fn) => arr.map(x => x.id === id ? fn(x) : x);

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
      set(s => ({ boards: mapById(s.boards, tempId, () => board) }));
      return board;
    } catch (err) {
      set({ boards: snapshot, error: err.message });
      throw err;
    }
  },

  renameBoard: async (boardId, userId, { name }) => {
    const snapshot = get().boards;
    set(s => ({ boards: mapById(s.boards, boardId, b => ({ ...b, name })), error: null }));
    try {
      const board = await client.patchBoard(boardId, userId, { name });
      set(s => ({ boards: mapById(s.boards, boardId, () => board) }));
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
    const position = nextPosition(get().board?.columns ?? []);
    const tempId = uuidv4();
    const placeholder = { id: tempId, boardId, name, position };
    return optimistic(get, set, {
      apply: b => ({ ...b, columns: [...(b?.columns ?? []), placeholder] }),
      commit: () => client.createColumn(boardId, userId, { name, position }),
      settle: (b, col) => ({ ...b, columns: mapById(b.columns, tempId, () => col) }),
    });
  },

  renameColumn: async (columnId, userId, { name, color }) => {
    const patch = { name };
    if (color !== undefined) patch.color = color;
    return optimistic(get, set, {
      apply: b => ({ ...b, columns: mapById(b.columns, columnId, c => ({ ...c, name, color: color !== undefined ? color : c.color })) }),
      commit: () => client.patchColumn(columnId, userId, patch),
      settle: (b, col) => ({ ...b, columns: mapById(b.columns, columnId, c => ({ ...c, ...col })) }),
    });
  },

  deleteColumn: async (columnId, userId) => optimistic(get, set, {
    apply: b => ({
      ...b,
      columns: b.columns.filter(c => c.id !== columnId),
      cards: b.cards.filter(c => c.columnId !== columnId),
    }),
    commit: () => client.deleteColumn(columnId, userId),
  }),

  // ── cards ────────────────────────────────────────────────────────────────────

  createCard: async (columnId, userId, { title }) => {
    const position = nextPosition(get().board?.cards.filter(c => c.columnId === columnId) ?? []);
    const tempId = uuidv4();
    const placeholder = { id: tempId, columnId, title, description: '', categoryLabelId: null, dueDate: null, completedAt: null, position };
    return optimistic(get, set, {
      apply: b => ({ ...b, cards: [...b.cards, placeholder] }),
      commit: () => client.createCard(columnId, userId, { title, position }),
      settle: (b, card) => ({ ...b, cards: mapById(b.cards, tempId, () => card) }),
    });
  },

  patchCard: async (cardId, userId, patch) => optimistic(get, set, {
    apply: b => ({ ...b, cards: mapById(b.cards, cardId, c => ({ ...c, ...patch })) }),
    commit: () => client.patchCard(cardId, userId, patch),
    settle: (b, card) => ({ ...b, cards: mapById(b.cards, cardId, () => card) }),
  }),

  deleteCard: async (cardId, userId) => optimistic(get, set, {
    apply: b => ({ ...b, cards: b.cards.filter(c => c.id !== cardId) }),
    commit: () => client.deleteCard(cardId, userId),
  }),

  moveCard: async (cardId, userId, { columnId, position }) => optimistic(get, set, {
    apply: b => ({ ...b, cards: mapById(b.cards, cardId, c => ({ ...c, columnId, position })) }),
    commit: () => client.moveCard(cardId, userId, { columnId, position }),
    settle: (b, card) => ({ ...b, cards: mapById(b.cards, cardId, () => card) }),
  }),

  moveColumn: async (columnId, userId, { position }) => optimistic(get, set, {
    apply: b => ({ ...b, columns: mapById(b.columns, columnId, c => ({ ...c, position })) }),
    commit: () => client.patchColumn(columnId, userId, { position }),
    settle: (b, col) => ({ ...b, columns: mapById(b.columns, columnId, () => col) }),
  }),

  // ── labels ───────────────────────────────────────────────────────────────────

  createLabel: async (boardId, userId, { name, color }) => {
    const tempId = uuidv4();
    return optimistic(get, set, {
      apply: b => ({ ...b, labels: [...b.labels, { id: tempId, boardId, name, color }] }),
      commit: () => client.createLabel(boardId, userId, { name, color }),
      settle: (b, label) => ({ ...b, labels: mapById(b.labels, tempId, () => label) }),
    });
  },

  patchLabel: async (labelId, userId, patch) => optimistic(get, set, {
    apply: b => ({ ...b, labels: mapById(b.labels, labelId, l => ({ ...l, ...patch })) }),
    commit: () => client.patchLabel(labelId, userId, patch),
    settle: (b, label) => ({ ...b, labels: mapById(b.labels, labelId, l => ({ ...l, ...label })) }),
  }),

  deleteLabel: async (labelId, userId) => optimistic(get, set, {
    apply: b => ({
      ...b,
      labels: b.labels.filter(l => l.id !== labelId),
      cardLabels: b.cardLabels.filter(cl => cl.labelId !== labelId),
    }),
    commit: () => client.deleteLabel(labelId, userId),
  }),

  attachLabel: async (cardId, labelId, userId) => optimistic(get, set, {
    apply: b => ({ ...b, cardLabels: [...b.cardLabels, { cardId, labelId }] }),
    commit: () => client.attachLabel(cardId, labelId, userId),
  }),

  detachLabel: async (cardId, labelId, userId) => optimistic(get, set, {
    apply: b => ({ ...b, cardLabels: b.cardLabels.filter(cl => !(cl.cardId === cardId && cl.labelId === labelId)) }),
    commit: () => client.detachLabel(cardId, labelId, userId),
  }),

  // ── assignees ────────────────────────────────────────────────────────────────

  attachAssignee: async (cardId, userId) => optimistic(get, set, {
    apply: b => ({ ...b, cardAssignees: [...b.cardAssignees, { cardId, userId }] }),
    commit: () => client.attachAssignee(cardId, userId),
  }),

  detachAssignee: async (cardId, userId) => optimistic(get, set, {
    apply: b => ({ ...b, cardAssignees: b.cardAssignees.filter(ca => !(ca.cardId === cardId && ca.userId === userId)) }),
    commit: () => client.detachAssignee(cardId, userId),
  }),

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

  removeMember: async (boardId, userId, { memberId }) => optimistic(get, set, {
    apply: b => ({ ...b, members: b.members.filter(m => m.userId !== memberId) }),
    commit: () => client.removeMember(boardId, userId, { memberId }),
  }),

  // ── subtasks ─────────────────────────────────────────────────────────────────

  // dir: -1 moves up, +1 moves down. Recomputes a float position from neighbours.
  moveSubtask: async (subtaskId, dir) => {
    const all = get().board?.subtasks ?? [];
    const moving = all.find(s => s.id === subtaskId);
    if (!moving) return;
    // Neighbours must come from the same card only — board.subtasks holds every
    // card's subtasks, whose positions overlap (each card starts at 1).
    const sorted = all
      .filter(s => s.cardId === moving.cardId)
      .sort((a, b) => a.position - b.position);
    const idx = sorted.findIndex(s => s.id === subtaskId);
    if (idx < 0) return;
    const swapIdx = idx + dir;
    if (swapIdx < 0 || swapIdx >= sorted.length) return;

    // neighbours of the slot we are moving into
    const lo = Math.min(idx, swapIdx);
    const before = sorted[lo - 1] ?? null;
    const target = sorted[swapIdx];
    const newPos = dir < 0
      ? positionBetween(before?.position ?? null, target.position)
      : positionBetween(target.position, sorted[swapIdx + 1]?.position ?? null);

    return optimistic(get, set, {
      rethrow: false,
      apply: b => ({ ...b, subtasks: mapById(b.subtasks, subtaskId, st => ({ ...st, position: newPos })) }),
      commit: () => client.patchSubtask(subtaskId, { position: newPos }),
      settle: (b, updated) => ({ ...b, subtasks: mapById(b.subtasks, subtaskId, () => updated) }),
    });
  },

  moveSubtaskUp: (subtaskId) => get().moveSubtask(subtaskId, -1),
  moveSubtaskDown: (subtaskId) => get().moveSubtask(subtaskId, 1),

  toggleSubtask: async (subtaskId) => {
    const current = get().board?.subtasks?.find(s => s.id === subtaskId);
    if (!current) return;
    const newChecked = !current.checked;
    return optimistic(get, set, {
      rethrow: false,
      apply: b => ({ ...b, subtasks: mapById(b.subtasks, subtaskId, st => ({ ...st, checked: newChecked })) }),
      commit: () => client.patchSubtask(subtaskId, { checked: newChecked }),
      settle: (b, updated) => ({ ...b, subtasks: mapById(b.subtasks, subtaskId, () => updated) }),
    });
  },

  renameSubtask: async (subtaskId, title) => optimistic(get, set, {
    apply: b => ({ ...b, subtasks: mapById(b.subtasks, subtaskId, st => ({ ...st, title })) }),
    commit: () => client.patchSubtask(subtaskId, { title }),
    settle: (b, updated) => ({ ...b, subtasks: mapById(b.subtasks, subtaskId, () => updated) }),
  }),

  deleteSubtask: async (subtaskId) => optimistic(get, set, {
    rethrow: false,
    apply: b => ({ ...b, subtasks: b.subtasks.filter(st => st.id !== subtaskId) }),
    commit: () => client.deleteSubtask(subtaskId),
  }),

  createSubtask: async (cardId, { title }) => {
    const tempId = uuidv4();
    const cardSubtasks = (get().board?.subtasks ?? []).filter(s => s.cardId === cardId);
    const position = nextPosition(cardSubtasks);
    const placeholder = { id: tempId, cardId, title, checked: false, position };
    return optimistic(get, set, {
      apply: b => ({ ...b, subtasks: [...(b.subtasks ?? []), placeholder] }),
      commit: () => client.createSubtask(cardId, { title }),
      settle: (b, subtask) => ({ ...b, subtasks: mapById(b.subtasks, tempId, () => subtask) }),
    });
  },
}));

export default useBoardStore;
