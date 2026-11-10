import { create } from 'zustand';
import { v4 as uuidv4 } from 'uuid';
import * as client from '../api/client';
import { positionBetween } from '../domain/ordering';
import { resolveAttach, resolveDetach } from '../domain/category';
import { visibleNeighbour } from '../domain/subtaskVisibility';
import { cardsGone } from '../domain/openCard';
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
// the commit's result or rejects with its error — that rejection is the only
// report; the board actions decide what the user sees (#68, #79).
//
// Status (#79), one home per meaning:
// - boardStatus: the last Board load — { state: 'idle' } or { state, boardId }
//   with state 'loading' | 'open', or 'failed' plus `error` (fetch 403/404, or
//   its create failed). Keyed on the Board, so a status left from another
//   Board (e.g. the one that just failed) never speaks for this one.
// - listError: a /boards list op failed. Kept until the next list op or until
//   a Board opens, so a failed create still shows after the eject to /boards.
// - listFetchError / listLoading: the /boards list fetch.

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
  // A pending-ops queue over one slice of the store: `opsKey` holds the
  // pendingOps state, `viewKey` its view. Two adapters (#78): the open board
  // (ops → board) and the /boards list (listOps → boards). `errorKey`, if
  // given, holds the last op failure (cleared when an op is enqueued).
  const opQueue = (opsKey, viewKey, errorKey) => {
    const errorOf = message => (errorKey ? { [errorKey]: message } : undefined);
    const state = () => get()[opsKey];
    const setOps = (ops, extra) => set({ [opsKey]: ops, [viewKey]: view(ops), ...extra });

    // Each pending op's caller, by op id: { resolve, reject, done }.
    const callers = new Map();
    const answer = (opId, how, value) => {
      callers.get(opId)?.[how](value);
      callers.delete(opId);
    };
    const isPending = opId => state()?.pending.some(o => o.id === opId);

    // Commit every op the queue allows; on each outcome, report and go again.
    // An op whose state was replaced meanwhile only answers its caller.
    const pump = () => {
      for (const op of ready(state())) {
        setOps(start(state(), op.id));
        new Promise(resolve => resolve(op.commit())).then(
          result => {
            if (isPending(op.id)) setOps(succeed(state(), op.id, result));
            answer(op.id, 'resolve', result);
            pump();
          },
          err => {
            if (!isPending(op.id)) return answer(op.id, 'reject', err);
            const { state: next, failed } = fail(state(), op.id, err);
            // `quiet`: the failure no longer matters to the user (a rename of a
            // Board they have since asked to delete) — drop it without a banner.
            setOps(next, op.quiet?.(next) ? undefined : errorOf(err.message));
            failed.filter(id => id !== op.id).forEach(id => answer(id, 'reject', dependantError(err)));
            answer(op.id, 'reject', err);
            pump();
          },
        );
      }
    };

    const run = op => {
      const ops = state();
      if (!ops) return Promise.reject(new Error('no board is open'));
      const id = uuidv4();
      let resolve, reject;
      const done = new Promise((res, rej) => { resolve = res; reject = rej; });
      callers.set(id, { resolve, reject, done });
      setOps(enqueue(ops, { ...op, id }), errorOf(null));
      pump();
      return done;
    };

    // Resolves once the pending op creating `id` (if any) has finished: with
    // its error if it failed, else null.
    const created = id => {
      const op = state()?.pending.find(o => o.creates.includes(id));
      const done = op && callers.get(op.id)?.done;
      return done ? done.then(() => null, err => err) : Promise.resolve(null);
    };

    // The state is being replaced: ops that never started won't run.
    const dropUnstarted = message => {
      for (const op of state()?.pending ?? []) {
        if (!op.started) answer(op.id, 'reject', new Error(message));
      }
    };

    // A fetch of the server data as a poll: replaces the server data unless a
    // commit landed after it went out — then fetch again, so nothing is lost
    // (unless a newer poll is already on its way: it will bring fresh data).
    let newestPoll = null;
    const poll = async fetch => {
      const sent = startPoll(state());
      newestPoll = sent.mark;
      setOps(sent.state);
      const data = await fetch();
      const next = receivePoll(state(), data, sent.mark);
      if (next !== state()) setOps(next);
      else if (newestPoll === sent.mark) return poll(fetch);
      return data;
    };

    return { setOps, run, created, dropUnstarted, poll };
  };

  // The open board (#73) and the /boards list (#78).
  const open = opQueue('ops', 'board');
  const list = opQueue('listOps', 'boards', 'listError');
  const { setOps, run } = open;
  const closeBoard = () => open.dropUnstarted('The board was closed.');
  // Board `boardId` opened: the list's last op error has had its moment.
  const openedPatch = boardId => ({ boardStatus: { state: 'open', boardId }, listError: null });

  return {
    listOps: init([]),
    boards: [],
    ops: null,
    board: null,
    boardStatus: { state: 'idle' },
    // The ids of the Cards the last poll took off the board (#81), worked out
    // as the poll is written: the open-Card decision announces "deleted by
    // another member" only for these, and closes silently for a Card gone
    // through a local action — whatever order React renders the writes in.
    polledGone: [],
    listError: null,
    listFetchError: null,
    listLoading: false,

    // ── boards ──────────────────────────────────────────────────────────────────
    // The /boards list is a pending-ops list (#78, re-deciding #69 decision 6):
    // Board create / rename / delete are ops keyed on the Board id, so renames
    // of one Board go out one at a time and the latest wins; a failure drops
    // just its op (a failed create takes the ops waiting on it along); and the
    // list fetch is a poll that pending ops replay on.

    fetchBoards: async () => {
      set({ listLoading: true, listFetchError: null });
      try {
        await list.poll(() => client.getBoards());
        set({ listLoading: false });
      } catch (err) {
        set({ listFetchError: err.message, listLoading: false });
      }
    },

    // Opens a board. The board already open (e.g. back from /boards) takes the
    // snapshot like a poll, keeping its pending ops; another board starts a
    // fresh pending-ops board whose clock carries on, so an old poll is stale.
    // A Board whose create is still pending is opened once the create lands.
    fetchBoard: async (boardId) => {
      set({ boardStatus: { state: 'loading', boardId } });
      const createFailed = await list.created(boardId);
      if (createFailed) {                    // nothing to open (listError keeps the message)
        closeBoard();
        set({ ops: null, board: null, boardStatus: { state: 'failed', boardId, error: createFailed.message } });
        return;
      }
      const sent = get().ops && startPoll(get().ops);
      if (sent) set({ ops: sent.state });
      try {
        const data = await client.getBoard(boardId);
        const ops = get().ops;
        if (ops && ops.server.board?.id === boardId) {
          // Sent with nothing open, and another fetch opened it meanwhile (e.g.
          // StrictMode's double effect): no mark to order it by — that one's
          // snapshot stands.
          setOps(sent ? receivePoll(ops, data, sent.mark) : ops, openedPatch(boardId));
        } else {
          closeBoard();
          setOps(init(data, ops), { ...openedPatch(boardId), polledGone: [] });
        }
      } catch (err) {
        set({ boardStatus: { state: 'failed', boardId, error: err.message } });
      }
    },

    // A poll: replaces the server board unless a commit (or a newer poll) landed
    // after it went out; pending ops replay on top. Resolves with the snapshot,
    // rejects with the fetch error (usePolling routes 403/404).
    pollBoard: async (boardId) => {
      const createFailed = await list.created(boardId);
      if (createFailed) throw Object.assign(new Error(createFailed.message), { status: 404 });
      const sent = get().ops && startPoll(get().ops);
      if (sent) setOps(sent.state);
      const data = await client.getBoard(boardId);
      const ops = get().ops;
      if (sent && ops?.server.board?.id === boardId) {
        const next = receivePoll(ops, data, sent.mark);
        setOps(next, { polledGone: cardsGone(get().board, view(next)) });
      }
      return data;
    },

    // A new Board's id is client-chosen (#75), so its placeholder is the record.
    // ownerId: the current user, so the placeholder shows owner-only controls.
    createBoard: async (ownerId, { name }) => {
      const id = uuidv4();
      return list.run({
        keys: [id], creates: [id],
        apply: bs => addIfAbsent(bs, { id, name, ownerId }),
        commit: () => client.createBoard({ name, id }),
        settle: (bs, board) => mapById(bs, id, () => board),
      });
    },

    renameBoard: async (boardId, { name }) => list.run({
      keys: [boardId],
      apply: bs => mapById(bs, boardId, b => ({ ...b, name })),
      commit: () => client.patchBoard(boardId, { name }),
      settle: (bs, board) => mapById(bs, boardId, () => board),
      quiet: s => s.pending.some(o => o.deletesBoard === boardId),   // the user asked to delete it since
    }),

    deleteBoard: async (boardId) => list.run({
      keys: [boardId],
      deletesBoard: boardId,
      apply: bs => bs.filter(b => b.id !== boardId),
      commit: () => client.deleteBoard(boardId),
    }),

    // ── columns ─────────────────────────────────────────────────────────────────

    createColumn: async (boardId, { name }) => {
      const id = uuidv4();
      const position = nextPosition(get().board?.columns ?? []);
      return run({
        keys: [id], creates: [id],
        apply: b => ({ ...b, columns: addIfAbsent(b.columns, { id, boardId, name, position }) }),
        // The placeholder's position is a guess; the server assigns MAX + 1 (#53, #82).
        commit: () => client.createColumn(boardId, { id, name }),
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
        commit: () => client.createCard(columnId, { id, title }),
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
      await client.addMember(boardId, { email });   // a failure rejects: InviteDialog shows it
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
