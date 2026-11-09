import { create } from 'zustand';
import { v4 as uuidv4 } from 'uuid';
import * as client from '../api/client';
import { positionBetween } from '../domain/ordering';
import { resolveAttach, resolveDetach } from '../domain/category';
import { visibleNeighbour } from '../domain/subtaskVisibility';
import { init, enqueue, ready, start, succeed, fail, startPoll, receivePoll, view } from '../domain/pendingOps';

// The open board is a pending-ops board (#73, design in #69, model in
// domain/pendingOps.js): `ops` holds the last server board plus the mutations
// in flight, and `board` is always view(ops) — the server board with every
// pending op replayed on it. Each mutation is an op:
//   { keys, creates?, apply(b), commit(), settle?(b, result), gone?(server) }
// - keys: the record ids it touches. Ops sharing a key commit one after
//   another (a Card added to a Column still being created waits for it); ops
//   with disjoint keys run in parallel.
// - apply / settle are replay-safe (upsert / ensure-present / ensure-absent):
//   they run again on every newer server board a poll brings.
// - New records get a client-chosen id (#71), so a placeholder is the record.
// A failure removes just that op (and, for a create, the ops waiting on it);
// a 404 runs `gone` on the server board. The caller's promise resolves with
// the commit's result or rejects with its error, and `error` is set.

// position after the last item in a collection (or first slot when empty)
const nextPosition = (items, getPos = i => i.position) =>
  positionBetween(items.length > 0 ? Math.max(...items.map(getPos)) : null, null);

const mapById = (arr, id, fn) => arr.map(x => x.id === id ? fn(x) : x);
const hasId = (arr, id) => arr.some(x => x.id === id);
const addIfAbsent = (arr, rec) => (hasId(arr, rec.id) ? arr : [...arr, rec]);
// replace a placeholder (by its id) with the server's record
const replaceWith = (arr, placeholderId, rec) => [...arr.filter(x => x.id !== placeholderId && x.id !== rec.id), rec];

// board with one card's Category recomputed from that card
const withCategory = (b, cardId, resolve) => ({
  ...b,
  cards: mapById(b.cards, cardId, c => ({ ...c, categoryLabelId: resolve(c) })),
});

const isAttached = (b, cardId, labelId) => b.cardLabels.some(cl => cl.cardId === cardId && cl.labelId === labelId);
const isAssigned = (b, cardId, userId) => b.cardAssignees.some(ca => ca.cardId === cardId && ca.userId === userId);
const columnCardIds = (b, columnId) => b.cards.filter(c => c.columnId === columnId).map(c => c.id);

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

// A 404 on a card op means another member deleted the card: it leaves the
// server board with everything hanging off it (PRD §1.5).
const cardGone = cardId => server => withoutCards(server, [cardId]);

// Ops that fail with a failed create never reached the server: they get its
// message but not its status (a Card create's 404 must not read as "card deleted").
const dependantError = err => new Error(err.message);

const useBoardStore = create((set, get) => {
  const setOps = (ops, extra) => set({ ops, board: view(ops), ...extra });

  // Each pending op's caller, by op id: { resolve, reject }.
  const callers = new Map();
  const answer = (opId, how, value) => {
    callers.get(opId)?.[how](value);
    callers.delete(opId);
  };
  const isPending = opId => get().ops?.pending.some(o => o.id === opId);

  // Commit every op the queue allows; on each outcome, report and go again.
  // An op whose board was closed meanwhile only answers its caller.
  const pump = () => {
    for (const op of ready(get().ops)) {
      setOps(start(get().ops, op.id));
      new Promise(resolve => resolve(op.commit())).then(
        result => {
          if (isPending(op.id)) setOps(succeed(get().ops, op.id, result));
          answer(op.id, 'resolve', result);
          pump();
        },
        err => {
          if (!isPending(op.id)) return answer(op.id, 'reject', err);
          const { state, failed } = fail(get().ops, op.id, err);
          setOps(state, { error: err.message });
          failed.filter(id => id !== op.id).forEach(id => answer(id, 'reject', dependantError(err)));
          answer(op.id, 'reject', err);
          pump();
        },
      );
    }
  };

  // Another board opened: ops of the old one that never started won't run.
  const closeBoard = () => {
    for (const op of get().ops?.pending ?? []) {
      if (!op.started) answer(op.id, 'reject', new Error('The board was closed.'));
    }
  };

  const run = op => {
    const ops = get().ops;
    if (!ops) return Promise.reject(new Error('no board is open'));
    const id = uuidv4();
    const done = new Promise((resolve, reject) => callers.set(id, { resolve, reject }));
    setOps(enqueue(ops, { ...op, id }), { error: null });
    pump();
    return done;
  };

  // New Boards whose POST is still in flight, by their client-chosen id (#75):
  // the placeholder is the real Board, so anything sent about it (open, poll,
  // rename, delete) first waits for the create. Resolves with the create's
  // error if it failed (the Board never existed), else null.
  const boardCreates = new Map();
  const awaitBoardCreate = id => (boardCreates.get(id) ?? Promise.resolve()).then(() => null, err => err);

  // Renames of a Board still in flight, by Board id (#76). The latest rename
  // owns the name: an earlier one's answer never overwrites it, and if the
  // latest fails the list falls back to the last name the server confirmed.
  // { latest: token, latestName, latestDone: null | 'ok' | 'failed', confirmed, pending }
  const boardRenames = new Map();
  // Boards whose DELETE is in flight → { board }: what a failed delete puts back.
  const boardDeletes = new Map();
  const setBoardName = (id, name) => {
    const deleting = boardDeletes.get(id);
    if (deleting) deleting.board = { ...deleting.board, name };   // a failed delete restores this name
    set(s => ({ boards: mapById(s.boards, id, b => ({ ...b, name })) }));
  };
  // A fetched /boards list with the list's in-flight creates, renames and
  // deletes kept on top.
  const withPendingBoards = (fetched, current) => [
    ...fetched
      .filter(b => !boardDeletes.has(b.id))
      .map(b => {
        const rename = boardRenames.get(b.id);
        return rename?.latestDone === null ? { ...b, name: rename.latestName } : b;
      }),
    ...current.filter(b => boardCreates.has(b.id) && !fetched.some(f => f.id === b.id)),
  ];

  return {
    boards: [],
    ops: null,
    board: null,
    loading: false,
    error: null,
    failedCreate: null,   // the error of a just-opened Board whose create failed (#76)

    // ── boards ──────────────────────────────────────────────────────────────────

    fetchBoards: async () => {
      set({ loading: true, error: null });
      try {
        const boards = await client.getBoards();
        set(s => ({ boards: withPendingBoards(boards, s.boards), loading: false }));
      } catch (err) {
        set({ error: err.message, loading: false });
      }
    },

    // Opens a board. The board already open (e.g. back from /boards) takes the
    // snapshot like a poll, keeping its pending ops; another board starts a
    // fresh pending-ops board whose clock carries on, so an old poll is stale.
    fetchBoard: async (boardId) => {
      set({ loading: true, error: null, failedCreate: null });
      const createFailed = await awaitBoardCreate(boardId);
      if (createFailed) {                    // nothing to open: keep the create's error
        closeBoard();
        const error = createFailed.message;
        set({ ops: null, board: null, error, failedCreate: error, loading: false });
        return;
      }
      const sent = get().ops && startPoll(get().ops);
      if (sent) set({ ops: sent.state });
      try {
        const data = await client.getBoard(boardId);
        const ops = get().ops;
        if (ops && ops.server.board?.id === boardId) {
          setOps(receivePoll(ops, data, sent.mark), { loading: false });
        } else {
          closeBoard();
          setOps(init(data, ops), { loading: false });
        }
      } catch (err) {
        set({ error: err.message, loading: false });
      }
    },

    // A poll: replaces the server board unless a commit (or a newer poll) landed
    // after it went out; pending ops replay on top. Resolves with the snapshot,
    // rejects with the fetch error (usePolling routes 403/404).
    pollBoard: async (boardId) => {
      const createFailed = await awaitBoardCreate(boardId);
      if (createFailed) throw Object.assign(new Error(createFailed.message), { status: 404 });
      const sent = get().ops && startPoll(get().ops);
      if (sent) setOps(sent.state);
      const data = await client.getBoard(boardId);
      const ops = get().ops;
      if (sent && ops?.server.board?.id === boardId) setOps(receivePoll(ops, data, sent.mark));
      return data;
    },

    // The /boards list stays optimistic with rollback (#69 decision 6), but a
    // new Board's id is client-chosen (#75), so its placeholder is the record.
    // ownerId: the current user, so the placeholder shows owner-only controls.
    createBoard: async (ownerId, { name }) => {
      const id = uuidv4();
      set(s => ({ boards: [...s.boards, { id, name, ownerId }], error: null }));
      const post = client.createBoard({ name, id });
      boardCreates.set(id, post);
      try {
        const board = await post;
        // A rename sent meanwhile owns the name; the create only confirms its own.
        const renaming = boardRenames.get(id);
        if (renaming) renaming.confirmed = board.name;
        set(s => ({ boards: mapById(s.boards, id, b => (renaming ? { ...board, name: b.name } : board)) }));
        return board;
      } catch (err) {
        set(s => ({ boards: s.boards.filter(b => b.id !== id), error: err.message }));
        throw err;
      } finally {
        boardCreates.delete(id);
      }
    },

    renameBoard: async (boardId, { name }) => {
      const rename = boardRenames.get(boardId)
        ?? { confirmed: get().boards.find(b => b.id === boardId)?.name, pending: 0 };
      const mine = {};
      Object.assign(rename, { latest: mine, latestName: name, latestDone: null, pending: rename.pending + 1 });
      boardRenames.set(boardId, rename);
      set({ error: null });
      setBoardName(boardId, name);
      try {
        if (await awaitBoardCreate(boardId)) return undefined;   // never created: nothing to rename
        const board = await client.patchBoard(boardId, { name });
        if (rename.latest === mine) {
          rename.latestDone = 'ok';
          rename.confirmed = board.name;
          setBoardName(boardId, board.name);
        } else if (rename.latestDone !== 'ok') {
          rename.confirmed = board.name;                         // a later rename still owns the name…
          if (rename.latestDone === 'failed') setBoardName(boardId, board.name);   // …unless it failed
        }
        return board;
      } catch (err) {
        if (rename.latest === mine) {
          rename.latestDone = 'failed';
          setBoardName(boardId, rename.confirmed);
          if (!boardDeletes.has(boardId)) set({ error: err.message });   // a delete was asked for since
        }
        throw err;
      } finally {
        if (--rename.pending === 0) boardRenames.delete(boardId);
      }
    },

    deleteBoard: async (boardId) => {
      const index = get().boards.findIndex(b => b.id === boardId);
      const deleting = { board: get().boards[index] };
      boardDeletes.set(boardId, deleting);
      set(s => ({ boards: s.boards.filter(b => b.id !== boardId), error: null }));
      try {
        if (await awaitBoardCreate(boardId)) return undefined;   // never created: already gone
        await client.deleteBoard(boardId);
      } catch (err) {
        // Put just this Board back — with any name a rename settled meanwhile —
        // so a create that landed meanwhile stays.
        const { board } = deleting;
        set(s => ({
          boards: !board || s.boards.some(b => b.id === boardId) ? s.boards
            : [...s.boards.slice(0, index), board, ...s.boards.slice(index)],
          error: err.message,
        }));
        throw err;
      } finally {
        boardDeletes.delete(boardId);
      }
    },

    // ── columns ─────────────────────────────────────────────────────────────────

    createColumn: async (boardId, { name }) => {
      const id = uuidv4();
      const position = nextPosition(get().board?.columns ?? []);
      return run({
        keys: [id], creates: [id],
        apply: b => ({ ...b, columns: addIfAbsent(b.columns, { id, boardId, name, position }) }),
        commit: () => client.createColumn(boardId, { id, name, position }),
        settle: (b, col) => ({ ...b, columns: replaceWith(b.columns, id, col) }),
      });
    },

    renameColumn: async (columnId, { name, color }) => {
      const patch = { name };
      if (color !== undefined) patch.color = color;
      return run({
        keys: [columnId],
        apply: b => ({ ...b, columns: mapById(b.columns, columnId, c => ({ ...c, name, color: color !== undefined ? color : c.color })) }),
        commit: () => client.patchColumn(columnId, patch),
        settle: (b, col) => ({ ...b, columns: mapById(b.columns, columnId, c => ({ ...c, ...col })) }),
      });
    },

    // The Column's Cards go with it, and so do their labels, assignees and
    // Subtasks (#63) — so the op is keyed on them too.
    deleteColumn: async (columnId) => run({
      keys: [columnId, ...columnCardIds(get().board, columnId)],
      apply: b => ({ ...withoutCards(b, columnCardIds(b, columnId)), columns: b.columns.filter(c => c.id !== columnId) }),
      commit: () => client.deleteColumn(columnId),
    }),

    moveColumn: async (columnId, { position }) => run({
      keys: [columnId],
      apply: b => ({ ...b, columns: mapById(b.columns, columnId, c => ({ ...c, position })) }),
      commit: () => client.patchColumn(columnId, { position }),
      settle: (b, col) => ({ ...b, columns: mapById(b.columns, columnId, () => col) }),
    }),

    // ── cards ────────────────────────────────────────────────────────────────────

    createCard: async (columnId, { title }) => {
      const id = uuidv4();
      const position = nextPosition(get().board?.cards.filter(c => c.columnId === columnId) ?? []);
      const placeholder = { id, columnId, title, description: '', categoryLabelId: null, dueDate: null, completedAt: null, position };
      return run({
        keys: [id, columnId], creates: [id],
        apply: b => ({ ...b, cards: addIfAbsent(b.cards, placeholder) }),
        commit: () => client.createCard(columnId, { id, title, position }),
        settle: (b, card) => ({ ...b, cards: replaceWith(b.cards, id, card) }),
      });
    },

    patchCard: async (cardId, patch) => run({
      keys: [cardId],
      apply: b => ({ ...b, cards: mapById(b.cards, cardId, c => ({ ...c, ...patch })) }),
      commit: () => client.patchCard(cardId, patch),
      settle: (b, card) => ({ ...b, cards: mapById(b.cards, cardId, () => card) }),
      gone: cardGone(cardId),
    }),

    deleteCard: async (cardId) => run({
      keys: [cardId],
      apply: b => withoutCards(b, [cardId]),
      commit: () => client.deleteCard(cardId),
      gone: cardGone(cardId),
    }),

    moveCard: async (cardId, { columnId, position }) => {
      const from = get().board.cards.find(c => c.id === cardId)?.columnId;
      return run({
        keys: [cardId, columnId, ...(from && from !== columnId ? [from] : [])],
        apply: b => ({ ...b, cards: mapById(b.cards, cardId, c => ({ ...c, columnId, position })) }),
        commit: () => client.moveCard(cardId, { columnId, position }),
        settle: (b, card) => ({ ...b, cards: mapById(b.cards, cardId, () => card) }),
        gone: cardGone(cardId),
      });
    },

    // ── labels ───────────────────────────────────────────────────────────────────

    createLabel: async (boardId, { name, color }) => {
      const id = uuidv4();
      return run({
        keys: [id], creates: [id],
        apply: b => ({ ...b, labels: addIfAbsent(b.labels, { id, boardId, name, color }) }),
        commit: () => client.createLabel(boardId, { id, name, color }),
        settle: (b, label) => ({ ...b, labels: replaceWith(b.labels, id, label) }),
      });
    },

    patchLabel: async (labelId, patch) => run({
      keys: [labelId],
      apply: b => ({ ...b, labels: mapById(b.labels, labelId, l => ({ ...l, ...patch })) }),
      commit: () => client.patchLabel(labelId, patch),
      settle: (b, label) => ({ ...b, labels: mapById(b.labels, labelId, l => ({ ...l, ...label })) }),
    }),

    // Cards whose Category it was lose it, as the server's ON DELETE SET NULL does.
    deleteLabel: async (labelId) => run({
      keys: [labelId],
      apply: b => ({
        ...b,
        labels: b.labels.filter(l => l.id !== labelId),
        cardLabels: b.cardLabels.filter(cl => cl.labelId !== labelId),
        cards: b.cards.map(c => (c.categoryLabelId === labelId ? { ...c, categoryLabelId: null } : c)),
      }),
      commit: () => client.deleteLabel(labelId),
    }),

    // Attach/detach carry the card's Category with them (ADR-0002): one op
    // applies both, the server applies the same rule atomically, and settle
    // takes the server's Category — so a failure never splits the two (#55).
    // A ★ (patchCard, keyed on the card) queues behind them and replays on top.
    attachLabel: async (cardId, labelId) => run({
      keys: [cardId, labelId],
      apply: b => (!hasId(b.cards, cardId) || isAttached(b, cardId, labelId) ? b : withCategory(
        { ...b, cardLabels: [...b.cardLabels, { cardId, labelId }] }, cardId,
        c => resolveAttach(c.categoryLabelId ?? null, labelId))),
      commit: () => client.attachLabel(cardId, labelId),
      settle: (b, r) => withCategory(b, cardId, () => r.categoryLabelId),
    }),

    detachLabel: async (cardId, labelId) => run({
      keys: [cardId, labelId],
      apply: b => (!isAttached(b, cardId, labelId) ? b : withCategory(
        { ...b, cardLabels: b.cardLabels.filter(cl => !(cl.cardId === cardId && cl.labelId === labelId)) }, cardId,
        c => resolveDetach(attachedInLabelOrder(b, cardId), labelId, c.categoryLabelId ?? null))),
      commit: () => client.detachLabel(cardId, labelId),
      settle: (b, r) => withCategory(b, cardId, () => r.categoryLabelId),
    }),

    // ── assignees ────────────────────────────────────────────────────────────────

    attachAssignee: async (cardId, userId) => run({
      keys: [cardId, userId],
      apply: b => (isAssigned(b, cardId, userId) ? b : { ...b, cardAssignees: [...b.cardAssignees, { cardId, userId }] }),
      commit: () => client.attachAssignee(cardId, userId),
    }),

    detachAssignee: async (cardId, userId) => run({
      keys: [cardId, userId],
      apply: b => ({ ...b, cardAssignees: b.cardAssignees.filter(ca => !(ca.cardId === cardId && ca.userId === userId)) }),
      commit: () => client.detachAssignee(cardId, userId),
    }),

    // ── members ──────────────────────────────────────────────────────────────────

    // Not optimistic — the invitee's id isn't known until the server resolves
    // the email — so on success it polls the board like the timer does. A failed
    // poll doesn't fail the invite (it went through; the next poll catches up).
    addMember: async (boardId, { email }) => {
      try {
        await client.addMember(boardId, { email });
      } catch (err) {
        set({ error: err.message });
        throw err;
      }
      set({ error: null });
      await get().pollBoard(boardId).catch(() => {});
    },

    removeMember: async (boardId, { memberId }) => run({
      keys: [memberId],
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

      return run({
        keys: [subtaskId],
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
      return run({
        keys: [subtaskId],
        apply: b => ({ ...b, subtasks: mapById(b.subtasks, subtaskId, st => ({ ...st, checked: newChecked })) }),
        commit: () => client.patchSubtask(subtaskId, { checked: newChecked }),
        settle: (b, updated) => ({ ...b, subtasks: mapById(b.subtasks, subtaskId, () => updated) }),
      });
    },

    renameSubtask: async (subtaskId, title) => run({
      keys: [subtaskId],
      apply: b => ({ ...b, subtasks: mapById(b.subtasks, subtaskId, st => ({ ...st, title })) }),
      commit: () => client.patchSubtask(subtaskId, { title }),
      settle: (b, updated) => ({ ...b, subtasks: mapById(b.subtasks, subtaskId, () => updated) }),
    }),

    deleteSubtask: async (subtaskId) => run({
      keys: [subtaskId],
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
      const ids = placeholders.map(p => p.id);
      return run({
        keys: [cardId, ...ids], creates: ids,
        apply: b => ({ ...b, subtasks: placeholders.reduce(addIfAbsent, b.subtasks ?? []) }),
        commit: () => client.createSubtasks(cardId, titles, ids),
        settle: (b, created) => {
          const replaced = new Set([...ids, ...created.map(s => s.id)]);
          return { ...b, subtasks: [...b.subtasks.filter(s => !replaced.has(s.id)), ...created] };
        },
      });
    },
  };
});

export default useBoardStore;
