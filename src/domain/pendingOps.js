// Pending-ops board (#72, design in #69): the open board is the last server
// board plus the mutations still in flight, replayed on top of it.
//
//   state = { server, pending: [op…], clock, serverAt }
//   view  = pending.reduce((b, op) => op.apply(b), server)
//
// An op is { id, keys, creates?, apply(b), settle?(b, result), gone?(server) }:
// - keys: the record ids it touches; it commits only once every earlier
//   pending op sharing a key has finished (per-record queues). Ops with
//   disjoint keys commit — and fold into server — in any order, so an op's
//   apply must only touch records its keys cover.
// - creates: the ids it creates; if it fails, every later op keyed on one of
//   them fails with it (transitively — a Card in a failed Column, its edits…).
// - apply / settle must be replay-safe (upsert, ensure-present, ensure-absent):
//   they run on every view and again on a newer server after a poll.
// - gone: on a 404, removes the vanished record from server.
// enqueue adds `started` (false until the store starts committing it).
//
// `clock` orders writes to server: each commit, 404 and poll start ticks it,
// and `serverAt` is the tick of the data now in server. A poll older than that
// (sent before a commit/404 landed, or before a newer poll) is discarded.
//
// Pure: no React, Zustand or API client. The store commits the ops `ready()`
// hands it and reports back with succeed / fail / receivePoll.

// `prev`: the state this one replaces (another board opened). Its clock carries
// on, so a poll still in flight from it is older than the new server board.
export function init(server, prev) {
  const clock = prev ? prev.clock + 1 : 0;
  return { server, pending: [], clock, serverAt: clock };
}

export function enqueue(state, op) {
  return { ...state, pending: [...state.pending, { creates: [], ...op, started: false }] };
}

const touchesAny = (op, ids) => op.keys.some(k => ids.includes(k));

// Not started, and no earlier unfinished op shares a key.
export function ready(state) {
  return state.pending.filter((op, i) =>
    !op.started && !state.pending.slice(0, i).some(earlier => touchesAny(earlier, op.keys)));
}

export function start(state, opId) {
  return { ...state, pending: state.pending.map(op => (op.id === opId ? { ...op, started: true } : op)) };
}

// A write to server from this client: newer than any poll already in flight.
const written = (state, server, pending) =>
  ({ server, pending, clock: state.clock + 1, serverAt: state.clock + 1 });

// Folds the op into server: settle(apply(server), result). Unknown id → no-op.
export function succeed(state, opId, result) {
  const op = state.pending.find(o => o.id === opId);
  if (!op) return state;
  const applied = op.apply(state.server);
  return written(state, op.settle ? op.settle(applied, result) : applied, state.pending.filter(o => o !== op));
}

// → { state, failed: [opId…] } — the op itself plus, for a failed create,
// the later ops keyed on what it would have created. Unknown id → no-op.
export function fail(state, opId, err) {
  const index = state.pending.findIndex(o => o.id === opId);
  if (index === -1) return { state, failed: [] };
  const op = state.pending[index];
  const lostIds = [...op.creates];
  const failed = [op];
  for (const later of state.pending.slice(index + 1)) {
    if (touchesAny(later, lostIds)) {
      failed.push(later);
      lostIds.push(...later.creates);
    }
  }
  const pending = state.pending.filter(o => !failed.includes(o));
  const next = err?.status === 404 && op.gone
    ? written(state, op.gone(state.server), pending)
    : { ...state, pending };
  return { state: next, failed: failed.map(o => o.id) };
}

// Call as the poll request goes out; hand `mark` back to receivePoll with its data.
export function startPoll(state) {
  const mark = state.clock + 1;
  return { state: { ...state, clock: mark }, mark };
}

// Replaces server (pending ops replay on it) unless the poll is older than
// the data server already holds.
export function receivePoll(state, data, mark) {
  return mark < state.serverAt ? state : { ...state, server: data, serverAt: mark };
}

export function view(state) {
  return state.pending.reduce((b, op) => op.apply(b), state.server);
}
