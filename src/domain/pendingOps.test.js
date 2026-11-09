import { init, enqueue, ready, start, succeed, fail, startPoll, receivePoll, view } from './pendingOps';

// A toy board: items by id, in order. Ops are replay-safe (upsert / ensure-absent).
const board = (...items) => ({ items });
const ids = b => b.items.map(i => i.id);
const titles = b => b.items.map(i => `${i.id}:${i.title}`);

const upsertItem = (b, item) => b.items.some(i => i.id === item.id)
  ? { items: b.items.map(i => (i.id === item.id ? { ...i, ...item } : i)) }
  : { items: [...b.items, item] };

const createOp = (opId, id, keys = [id]) => ({
  id: opId, keys, creates: [id],
  apply: b => upsertItem(b, { id, title: 'new' }),
  settle: (b, result) => upsertItem(b, result),
});
const renameOp = (opId, id, title) => ({
  id: opId, keys: [id],
  apply: b => (b.items.some(i => i.id === id) ? upsertItem(b, { id, title }) : b),
  gone: s => ({ items: s.items.filter(i => i.id !== id) }),
});
const notFound = Object.assign(new Error('nf'), { status: 404 });
const boom = Object.assign(new Error('boom'), { status: 500 });

const readyIds = s => ready(s).map(op => op.id);
// A poll that goes out and comes back with nothing in between.
const poll = (s, data) => { const { state, mark } = startPoll(s); return receivePoll(state, data, mark); };

describe('view', () => {
  it('is the server board with every pending op applied in issue order', () => {
    let s = init(board({ id: 'a', title: 'A' }));
    s = enqueue(s, renameOp('o1', 'a', 'A1'));
    s = enqueue(s, renameOp('o2', 'a', 'A2'));
    expect(titles(view(s))).toEqual(['a:A2']);
    expect(titles(s.server)).toEqual(['a:A']);
  });
});

describe('succeed', () => {
  it('removes the op and folds it into server, settled with the result', () => {
    let s = init(board());
    s = start(enqueue(s, createOp('o1', 'x')), 'o1');
    s = succeed(s, 'o1', { id: 'x', title: 'from server', position: 7 });
    expect(s.pending).toEqual([]);
    expect(s.server.items).toEqual([{ id: 'x', title: 'from server', position: 7 }]);
  });

  it('without a settle, folds apply alone', () => {
    let s = init(board({ id: 'a', title: 'A' }));
    s = succeed(start(enqueue(s, renameOp('o1', 'a', 'B')), 'o1'), 'o1', undefined);
    expect(titles(s.server)).toEqual(['a:B']);
  });
});

describe('fail', () => {
  it('A fails while B is in flight → only A’s effect disappears; B’s stays', () => {
    let s = init(board({ id: 'a', title: 'A' }, { id: 'b', title: 'B' }));
    s = enqueue(s, renameOp('A', 'a', 'A1'));
    s = enqueue(s, renameOp('B', 'b', 'B1'));
    s = start(start(s, 'A'), 'B');

    const r = fail(s, 'A', boom);

    expect(r.failed).toEqual(['A']);
    expect(titles(view(r.state))).toEqual(['a:A', 'b:B1']);
  });

  it('a failure after a poll does not bring back pre-poll data', () => {
    let s = init(board({ id: 'a', title: 'old' }));
    s = start(enqueue(s, renameOp('o1', 'a', 'mine')), 'o1');
    s = poll(s, board({ id: 'a', title: 'polled' }, { id: 'p', title: 'P' }));

    const r = fail(s, 'o1', boom);

    expect(titles(view(r.state))).toEqual(['a:polled', 'p:P']);
  });

  it('a 404 runs gone on server', () => {
    let s = init(board({ id: 'a', title: 'A' }, { id: 'b', title: 'B' }));
    s = start(enqueue(s, renameOp('o1', 'a', 'A1')), 'o1');

    const r = fail(s, 'o1', notFound);

    expect(ids(r.state.server)).toEqual(['b']);
    expect(ids(view(r.state))).toEqual(['b']);
  });

  it('a non-404 failure does not run gone', () => {
    let s = init(board({ id: 'a', title: 'A' }));
    s = start(enqueue(s, renameOp('o1', 'a', 'A1')), 'o1');
    expect(ids(fail(s, 'o1', boom).state.server)).toEqual(['a']);
  });

  it('a failed create fails every later op sharing its key, transitively', () => {
    let s = init(board());
    s = enqueue(s, createOp('col', 'c'));
    s = enqueue(s, createOp('card', 'k', ['k', 'c']));   // a Card in the new Column
    s = enqueue(s, renameOp('edit', 'k', 'K'));          // an edit of that Card
    s = enqueue(s, renameOp('other', 'z', 'Z'));         // unrelated
    s = start(s, 'col');

    const r = fail(s, 'col', boom);

    expect(r.failed).toEqual(['col', 'card', 'edit']);
    expect(r.state.pending.map(op => op.id)).toEqual(['other']);
  });

  it('a failed create spares later ops that share only a key it did not create', () => {
    let s = init(board({ id: 'c', title: 'C' }));
    s = enqueue(s, createOp('card', 'k', ['k', 'c']));   // a Card into an existing Column
    s = enqueue(s, renameOp('col', 'c', 'C1'));          // a rename of that Column
    s = start(s, 'card');

    const r = fail(s, 'card', boom);

    expect(r.failed).toEqual(['card']);
    expect(readyIds(r.state)).toEqual(['col']);
  });

  it('a failed non-create lets later same-key ops proceed', () => {
    let s = init(board({ id: 'a', title: 'A' }));
    s = enqueue(s, renameOp('o1', 'a', 'A1'));
    s = enqueue(s, renameOp('o2', 'a', 'A2'));
    s = start(s, 'o1');

    const r = fail(s, 'o1', boom);

    expect(r.failed).toEqual(['o1']);
    expect(readyIds(r.state)).toEqual(['o2']);
    expect(titles(view(r.state))).toEqual(['a:A2']);
  });
});

describe('ready — per-key queues', () => {
  it('same-key ops wait for the earlier one; disjoint-key ops are ready together', () => {
    let s = init(board());
    s = enqueue(s, renameOp('a1', 'a', '1'));
    s = enqueue(s, renameOp('b1', 'b', '1'));
    s = enqueue(s, renameOp('a2', 'a', '2'));
    expect(readyIds(s)).toEqual(['a1', 'b1']);
  });

  it('a started op is no longer ready, but still blocks its key', () => {
    let s = init(board());
    s = enqueue(s, renameOp('a1', 'a', '1'));
    s = enqueue(s, renameOp('a2', 'a', '2'));
    s = start(s, 'a1');
    expect(readyIds(s)).toEqual([]);
    s = succeed(s, 'a1', undefined);
    expect(readyIds(s)).toEqual(['a2']);
  });

  it('an op sharing any one key with an earlier op waits (a Card into a pending Column)', () => {
    let s = init(board());
    s = enqueue(s, createOp('col', 'c'));
    s = enqueue(s, createOp('card', 'k', ['k', 'c']));
    expect(readyIds(s)).toEqual(['col']);
  });
});

describe('receivePoll', () => {
  it('a poll while a create is pending keeps the placeholder', () => {
    let s = init(board({ id: 'a', title: 'A' }));
    s = start(enqueue(s, createOp('o1', 'x')), 'o1');
    s = poll(s, board({ id: 'a', title: 'A' }));
    expect(ids(view(s))).toEqual(['a', 'x']);
  });

  it('a poll that already contains the record (same id) shows it once', () => {
    let s = init(board());
    s = start(enqueue(s, createOp('o1', 'x')), 'o1');
    s = poll(s, board({ id: 'x', title: 'new' }));
    expect(ids(view(s))).toEqual(['x']);
  });

  it('a stale poll (started before a successful commit) is ignored', () => {
    let s = init(board({ id: 'a', title: 'A' }));
    s = start(enqueue(s, renameOp('o1', 'a', 'B')), 'o1');
    const sent = startPoll(s);                // poll request goes out…
    s = succeed(sent.state, 'o1', undefined); // …the rename commits…
    s = receivePoll(s, board({ id: 'a', title: 'A' }), sent.mark);  // …the poll lands with old data
    expect(titles(view(s))).toEqual(['a:B']);
  });

  it('a poll started after the commit is taken', () => {
    let s = init(board({ id: 'a', title: 'A' }));
    s = succeed(start(enqueue(s, renameOp('o1', 'a', 'B')), 'o1'), 'o1', undefined);
    s = poll(s, board({ id: 'a', title: 'C' }));
    expect(titles(view(s))).toEqual(['a:C']);
  });

  it('a failure does not make an in-flight poll stale', () => {
    let s = init(board({ id: 'a', title: 'A' }));
    s = start(enqueue(s, renameOp('o1', 'a', 'B')), 'o1');
    const sent = startPoll(s);
    s = fail(sent.state, 'o1', boom).state;
    s = receivePoll(s, board({ id: 'a', title: 'C' }), sent.mark);
    expect(titles(view(s))).toEqual(['a:C']);
  });

  it('a poll sent before a 404 cannot bring the vanished record back', () => {
    let s = init(board({ id: 'a', title: 'A' }));
    s = start(enqueue(s, renameOp('o1', 'a', 'B')), 'o1');
    const sent = startPoll(s);
    s = fail(sent.state, 'o1', notFound).state;
    s = receivePoll(s, board({ id: 'a', title: 'A' }), sent.mark);
    expect(ids(view(s))).toEqual([]);
  });

  it('of two overlapping polls, the older one landing last is ignored', () => {
    let s = init(board());
    const older = startPoll(s);
    const newer = startPoll(older.state);
    s = receivePoll(newer.state, board({ id: 'n', title: 'new' }), newer.mark);
    s = receivePoll(s, board({ id: 'o', title: 'old' }), older.mark);
    expect(ids(view(s))).toEqual(['n']);
  });
});

describe('init after another board', () => {
  it('carries the clock on, so a poll sent from the previous state is stale', () => {
    let s = init(board({ id: 'a', title: 'first visit' }));
    const sent = startPoll(s);
    s = init(board({ id: 'a', title: 'reopened' }), sent.state);
    s = receivePoll(s, board({ id: 'a', title: 'first visit' }), sent.mark);
    expect(titles(view(s))).toEqual(['a:reopened']);
  });
});

describe('unknown op ids (already failed with its create, or reported twice)', () => {
  it('succeed and fail leave the state unchanged', () => {
    const s = init(board({ id: 'a', title: 'A' }));
    expect(succeed(s, 'nope', {})).toBe(s);
    expect(fail(s, 'nope', boom)).toEqual({ state: s, failed: [] });
  });
});
