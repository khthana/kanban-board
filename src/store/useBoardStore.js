import { create } from 'zustand';
import { v4 as uuidv4 } from 'uuid';
import * as client from '../api/client';
import { positionBetween } from '../domain/ordering';
import { resolveAttach, resolveDetach } from '../domain/category';
import { visibleNeighbour } from '../domain/subtaskVisibility';

// Optimistic-update helper for mutations on the active `board`:
//   1. snapshot current board
//   2. apply(board) optimistically
//   3. await commit() — the API call
//   4. settle(board, result) to replace placeholders / merge server data
//   5. on error, roll back to the snapshot and rethrow
// Returns the commit() result so callers can return server records.
async function optimistic(get, set, { apply, commit, settle }) {
  const snapshot = get().board;
  set(s => ({ board: apply(s.board), error: null }));
  try {
    const result = await commit();
    if (settle) set(s => ({ board: settle(s.board, result) }));
    return result;
  } catch (err) {
    set({ board: snapshot, error: err.message });
    throw err;
  }
}

// position after the last item in a collection (or first slot when empty)
const nextPosition = (items, getPos = i => i.position) =>
  positionBetween(items.length > 0 ? Math.max(...items.map(getPos)) : null, null);

const mapById = (arr, id, fn) => arr.map(x => x.id === id ? fn(x) : x);

// board with one card's Category recomputed from that card
const withCategory = (b, cardId, resolve) => ({
  ...b,
  cards: mapById(b.cards, cardId, c => ({ ...c, categoryLabelId: resolve(c) })),
});

// settle an attach/detach to the server's Category — unless the card's Category
// changed since apply predicted it (e.g. ★ pressed while the request was in flight)
const settleCategory = (b, cardId, predicted, server) =>
  withCategory(b, cardId, c => ((c.categoryLabelId ?? null) === predicted ? server : c.categoryLabelId));

// a card's attached label ids in board label order (label creation order, as the
// server returns them) — the order the server uses to promote the next Category
const attachedInLabelOrder = (b, cardId) => {
  const attached = new Set(b.cardLabels.filter(cl => cl.cardId === cardId).map(cl => cl.labelId));
  return b.labels.filter(l => attached.has(l.id)).map(l => l.id);
};

// board without these cards and everything that hangs off them
const withoutCards = (b, cardIds) => {
  const gone = new Set(cardIds);
  return {
    ...b,
    cards:         b.cards.filter(c => !gone.has(c.id)),
    cardLabels:    (b.cardLabels ?? []).filter(cl => !gone.has(cl.cardId)),
    cardAssignees: (b.cardAssignees ?? []).filter(ca => !gone.has(ca.cardId)),
    subtasks:      (b.subtasks ?? []).filter(s => !gone.has(s.cardId)),
  };
};

// A 404 on a card mutation means another member deleted the card: drop it
// instead of restoring it from the rollback snapshot (PRD §1.5). Still rethrows.
async function dropCardIfGone(set, cardId, pending) {
  try {
    return await pending;
  } catch (err) {
    if (err.status === 404) set(s => ({ board: withoutCards(s.board, [cardId]) }));
    throw err;
  }
}

const useBoardStore = create((set, get) => ({
  boards: [],
  board: null,
  loading: false,
  error: null,

  // ── boards ──────────────────────────────────────────────────────────────────

  fetchBoards: async () => {
    set({ loading: true, error: null });
    try {
      const boards = await client.getBoards();
      set({ boards, loading: false });
    } catch (err) {
      set({ error: err.message, loading: false });
    }
  },

  fetchBoard: async (boardId) => {
    set({ loading: true, error: null });
    try {
      const data = await client.getBoard(boardId);
      set({ board: data, loading: false });
    } catch (err) {
      set({ error: err.message, loading: false });
    }
  },

  reconcileBoard: (data) => {
    set({ board: data });
  },

  // ownerId: the current user, so the placeholder shows owner-only controls.
  createBoard: async (ownerId, { name }) => {
    const tempId = uuidv4();
    const placeholder = { id: tempId, name, ownerId };
    const snapshot = get().boards;
    set({ boards: [...snapshot, placeholder], error: null });
    try {
      const board = await client.createBoard({ name });
      set(s => ({ boards: mapById(s.boards, tempId, () => board) }));
      return board;
    } catch (err) {
      set({ boards: snapshot, error: err.message });
      throw err;
    }
  },

  renameBoard: async (boardId, { name }) => {
    const snapshot = get().boards;
    set(s => ({ boards: mapById(s.boards, boardId, b => ({ ...b, name })), error: null }));
    try {
      const board = await client.patchBoard(boardId, { name });
      set(s => ({ boards: mapById(s.boards, boardId, () => board) }));
      return board;
    } catch (err) {
      set({ boards: snapshot, error: err.message });
      throw err;
    }
  },

  deleteBoard: async (boardId) => {
    const snapshot = get().boards;
    set(s => ({ boards: s.boards.filter(b => b.id !== boardId), error: null }));
    try {
      await client.deleteBoard(boardId);
    } catch (err) {
      set({ boards: snapshot, error: err.message });
      throw err;
    }
  },

  // ── columns ─────────────────────────────────────────────────────────────────

  createColumn: async (boardId, { name }) => {
    const position = nextPosition(get().board?.columns ?? []);
    const tempId = uuidv4();
    const placeholder = { id: tempId, boardId, name, position };
    return optimistic(get, set, {
      apply: b => ({ ...b, columns: [...(b?.columns ?? []), placeholder] }),
      commit: () => client.createColumn(boardId, { name, position }),
      settle: (b, col) => ({ ...b, columns: mapById(b.columns, tempId, () => col) }),
    });
  },

  renameColumn: async (columnId, { name, color }) => {
    const patch = { name };
    if (color !== undefined) patch.color = color;
    return optimistic(get, set, {
      apply: b => ({ ...b, columns: mapById(b.columns, columnId, c => ({ ...c, name, color: color !== undefined ? color : c.color })) }),
      commit: () => client.patchColumn(columnId, patch),
      settle: (b, col) => ({ ...b, columns: mapById(b.columns, columnId, c => ({ ...c, ...col })) }),
    });
  },

  deleteColumn: async (columnId) => optimistic(get, set, {
    // The Column's Cards go with it, and so do their labels, assignees and Subtasks (#63).
    apply: b => {
      const columnCardIds = b.cards.filter(c => c.columnId === columnId).map(c => c.id);
      return { ...withoutCards(b, columnCardIds), columns: b.columns.filter(c => c.id !== columnId) };
    },
    commit: () => client.deleteColumn(columnId),
  }),

  // ── cards ────────────────────────────────────────────────────────────────────

  createCard: async (columnId, { title }) => {
    const position = nextPosition(get().board?.cards.filter(c => c.columnId === columnId) ?? []);
    const tempId = uuidv4();
    const placeholder = { id: tempId, columnId, title, description: '', categoryLabelId: null, dueDate: null, completedAt: null, position };
    return optimistic(get, set, {
      apply: b => ({ ...b, cards: [...b.cards, placeholder] }),
      commit: () => client.createCard(columnId, { title, position }),
      settle: (b, card) => ({ ...b, cards: mapById(b.cards, tempId, () => card) }),
    });
  },

  patchCard: async (cardId, patch) => dropCardIfGone(set, cardId, optimistic(get, set, {
    apply: b => ({ ...b, cards: mapById(b.cards, cardId, c => ({ ...c, ...patch })) }),
    commit: () => client.patchCard(cardId, patch),
    settle: (b, card) => ({ ...b, cards: mapById(b.cards, cardId, () => card) }),
  })),

  deleteCard: async (cardId) => dropCardIfGone(set, cardId, optimistic(get, set, {
    apply: b => withoutCards(b, [cardId]),
    commit: () => client.deleteCard(cardId),
  })),

  moveCard: async (cardId, { columnId, position }) => dropCardIfGone(set, cardId, optimistic(get, set, {
    apply: b => ({ ...b, cards: mapById(b.cards, cardId, c => ({ ...c, columnId, position })) }),
    commit: () => client.moveCard(cardId, { columnId, position }),
    settle: (b, card) => ({ ...b, cards: mapById(b.cards, cardId, () => card) }),
  })),

  moveColumn: async (columnId, { position }) => optimistic(get, set, {
    apply: b => ({ ...b, columns: mapById(b.columns, columnId, c => ({ ...c, position })) }),
    commit: () => client.patchColumn(columnId, { position }),
    settle: (b, col) => ({ ...b, columns: mapById(b.columns, columnId, () => col) }),
  }),

  // ── labels ───────────────────────────────────────────────────────────────────

  createLabel: async (boardId, { name, color }) => {
    const tempId = uuidv4();
    return optimistic(get, set, {
      apply: b => ({ ...b, labels: [...b.labels, { id: tempId, boardId, name, color }] }),
      commit: () => client.createLabel(boardId, { name, color }),
      settle: (b, label) => ({ ...b, labels: mapById(b.labels, tempId, () => label) }),
    });
  },

  patchLabel: async (labelId, patch) => optimistic(get, set, {
    apply: b => ({ ...b, labels: mapById(b.labels, labelId, l => ({ ...l, ...patch })) }),
    commit: () => client.patchLabel(labelId, patch),
    settle: (b, label) => ({ ...b, labels: mapById(b.labels, labelId, l => ({ ...l, ...label })) }),
  }),

  deleteLabel: async (labelId) => optimistic(get, set, {
    apply: b => ({
      ...b,
      labels: b.labels.filter(l => l.id !== labelId),
      cardLabels: b.cardLabels.filter(cl => cl.labelId !== labelId),
    }),
    commit: () => client.deleteLabel(labelId),
  }),

  // Attach/detach carry the card's Category with them (ADR-0002): one optimistic
  // step applies both, the server applies the same rule atomically, and settle
  // takes the server's Category — so a failure never splits the two (#55).
  attachLabel: async (cardId, labelId) => {
    let predicted;
    return optimistic(get, set, {
      apply: b => withCategory({ ...b, cardLabels: [...b.cardLabels, { cardId, labelId }] }, cardId,
        c => (predicted = resolveAttach(c.categoryLabelId ?? null, labelId))),
      commit: () => client.attachLabel(cardId, labelId),
      settle: (b, r) => settleCategory(b, cardId, predicted, r.categoryLabelId),
    });
  },

  detachLabel: async (cardId, labelId) => {
    let predicted;
    return optimistic(get, set, {
      apply: b => withCategory(
        { ...b, cardLabels: b.cardLabels.filter(cl => !(cl.cardId === cardId && cl.labelId === labelId)) }, cardId,
        c => (predicted = resolveDetach(attachedInLabelOrder(b, cardId), labelId, c.categoryLabelId ?? null))),
      commit: () => client.detachLabel(cardId, labelId),
      settle: (b, r) => settleCategory(b, cardId, predicted, r.categoryLabelId),
    });
  },

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

  addMember: async (boardId, { email }) => {
    // optimistic not possible without knowing the invitee's id upfront —
    // refetch after success instead
    try {
      await client.addMember(boardId, { email });
      const data = await client.getBoard(boardId);
      set({ board: data, error: null });
    } catch (err) {
      set(s => ({ error: err.message }));
      throw err;
    }
  },

  removeMember: async (boardId, { memberId }) => optimistic(get, set, {
    apply: b => ({ ...b, members: b.members.filter(m => m.userId !== memberId) }),
    commit: () => client.removeMember(boardId, { memberId }),
  }),

  // ── subtasks ─────────────────────────────────────────────────────────────────

  // dir: -1 moves up, +1 moves down. Recomputes a float position from neighbours.
  // `hideDone`: the panel is hiding checked Subtasks, so swap with the next
  // *visible* one (PRD §12); hidden Subtasks keep their positions.
  moveSubtask: async (subtaskId, dir, { hideDone = false } = {}) => {
    const all = get().board?.subtasks ?? [];
    const target = visibleNeighbour(all, subtaskId, dir, { hideDone });
    if (!target) return;
    // Real order of the card (hidden ones included) — board.subtasks holds every
    // card's subtasks, whose positions overlap (each card starts at 1).
    const sorted = all
      .filter(s => s.cardId === target.cardId)
      .sort((a, b) => a.position - b.position);
    const t = sorted.indexOf(target);
    // Land just past the target: between it and its real-order neighbour beyond.
    const newPos = dir < 0
      ? positionBetween(sorted[t - 1]?.position ?? null, target.position)
      : positionBetween(target.position, sorted[t + 1]?.position ?? null);

    return optimistic(get, set, {
      apply: b => ({ ...b, subtasks: mapById(b.subtasks, subtaskId, st => ({ ...st, position: newPos })) }),
      commit: () => client.patchSubtask(subtaskId, { position: newPos }),
      settle: (b, updated) => ({ ...b, subtasks: mapById(b.subtasks, subtaskId, () => updated) }),
    });
  },

  moveSubtaskUp: (subtaskId, opts) => get().moveSubtask(subtaskId, -1, opts),
  moveSubtaskDown: (subtaskId, opts) => get().moveSubtask(subtaskId, 1, opts),

  toggleSubtask: async (subtaskId) => {
    const current = get().board?.subtasks?.find(s => s.id === subtaskId);
    if (!current) return;
    const newChecked = !current.checked;
    return optimistic(get, set, {
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
    apply: b => ({ ...b, subtasks: b.subtasks.filter(st => st.id !== subtaskId) }),
    commit: () => client.deleteSubtask(subtaskId),
  }),

  // The one way to add Subtasks (PRD §12): a pasted batch, or a single typed
  // title as a batch of one (#67). The whole batch appears at once and lands or
  // rolls back as one — the server adds all titles or none.
  createSubtasks: async (cardId, titles) => {
    const cardSubtasks = (get().board?.subtasks ?? []).filter(s => s.cardId === cardId);
    const placeholders = [];
    for (const title of titles) {
      const position = nextPosition([...cardSubtasks, ...placeholders]);
      placeholders.push({ id: uuidv4(), cardId, title, checked: false, position });
    }
    const tempIds = new Set(placeholders.map(p => p.id));
    return optimistic(get, set, {
      apply: b => ({ ...b, subtasks: [...(b.subtasks ?? []), ...placeholders] }),
      commit: () => client.createSubtasks(cardId, titles),
      settle: (b, created) => ({ ...b, subtasks: [...b.subtasks.filter(s => !tempIds.has(s.id)), ...created] }),
    });
  },
}));

export default useBoardStore;
