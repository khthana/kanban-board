import { openCardAfter, openCardOf, cardsGone } from './openCard';

const card = (id, extra = {}) => ({ id, columnId: 'c1', title: id, position: 1, ...extra });
const boardWith = (...ids) => ({ cards: ids.map(id => card(id)) });
const changed = (board, goneByPoll = []) => ({ type: 'boardChanged', board, goneByPoll });

describe('openCardAfter', () => {
  it('open: the Card panel holds that Card id', () => {
    expect(openCardAfter(null, { type: 'open', id: 'k1' })).toEqual({ id: 'k1', announce: false });
    expect(openCardAfter('k1', { type: 'open', id: 'k2' })).toEqual({ id: 'k2', announce: false });
  });

  it('close (panel ✕, view switch, drag start, the card-gone policy): closes silently', () => {
    expect(openCardAfter('k1', { type: 'close' })).toEqual({ id: null, announce: false });
    expect(openCardAfter(null, { type: 'close' })).toEqual({ id: null, announce: false });
  });

  it('the open Card taken off the board by a poll → close and announce', () => {
    expect(openCardAfter('k1', changed(boardWith('k2'), ['k1']))).toEqual({ id: null, announce: true });
  });

  it('the open Card gone through a local change (e.g. its Column deleted) → close silently', () => {
    expect(openCardAfter('k1', changed(boardWith('k2')))).toEqual({ id: null, announce: false });
    // …even when a poll removed other Cards around the same time
    expect(openCardAfter('k1', changed(boardWith('k2'), ['k7']))).toEqual({ id: null, announce: false });
  });

  it('the open Card still on the board stays open; nothing open announces nothing', () => {
    expect(openCardAfter('k1', changed(boardWith('k1', 'k2')))).toEqual({ id: 'k1', announce: false });
    expect(openCardAfter(null, changed(boardWith(), ['k1']))).toEqual({ id: null, announce: false });
  });

  it('a Card still being created (its placeholder on the board) is not mistaken for deleted', () => {
    // The store's board replays pending ops, so a Card whose POST is in flight
    // stays on it even when the poll's raw snapshot predates it.
    expect(openCardAfter('k-new', changed(boardWith('k-new'), []))).toEqual({ id: 'k-new', announce: false });
  });
});

describe('openCardOf', () => {
  it('derives the open Card from the board — its latest state, never a stale copy', () => {
    const board = { cards: [card('k1', { title: 'Renamed' })] };
    expect(openCardOf(board, 'k1').title).toBe('Renamed');
  });

  it('no Card open, no board yet, or the Card not on the board → null', () => {
    expect(openCardOf(boardWith('k1'), null)).toBeNull();
    expect(openCardOf(null, 'k1')).toBeNull();
    expect(openCardOf(boardWith('k2'), 'k1')).toBeNull();
  });
});

describe('cardsGone', () => {
  it('the Cards on the board before a write and not after', () => {
    expect(cardsGone(boardWith('k1', 'k2', 'k3'), boardWith('k2', 'k4'))).toEqual(['k1', 'k3']);
    expect(cardsGone(boardWith('k1'), boardWith('k1'))).toEqual([]);
    expect(cardsGone(null, boardWith('k1'))).toEqual([]);
  });
});
