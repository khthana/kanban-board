import { resolveDrag } from './dragDrop';

const col1 = { id: 'c1', position: 1.0 };
const col2 = { id: 'c2', position: 2.0 };
const col3 = { id: 'c3', position: 3.0 };

const card1 = { id: 'k1', columnId: 'c1', position: 1.0 };
const card2 = { id: 'k2', columnId: 'c1', position: 2.0 };
const card3 = { id: 'k3', columnId: 'c2', position: 1.0 };

const board = { columns: [col1, col2, col3], cards: [card1, card2, card3] };

function colDrag(activeId, overId) {
  return {
    active: { id: activeId, data: { current: { type: 'column' } } },
    over:   { id: overId,   data: { current: { type: 'column' } } },
  };
}

function cardOnCard(activeId, overId, overColumnId) {
  return {
    active: { id: activeId, data: { current: { type: 'card' } } },
    over:   { id: overId,   data: { current: { type: 'card', columnId: overColumnId } } },
  };
}

function cardOnColumn(activeId, overId) {
  return {
    active: { id: activeId, data: { current: { type: 'card' } } },
    over:   { id: overId,   data: { current: { type: 'column' } } },
  };
}

function cardOnDroppable(activeId, columnId) {
  return {
    active: { id: activeId, data: { current: { type: 'card' } } },
    over:   { id: `col:${columnId}`, data: { current: null } },
  };
}

// ── no-op cases ──────────────────────────────────────────────────────────────

describe('no-op cases → null', () => {
  it('no over target', () => {
    expect(resolveDrag(board, { active: { id: 'c1', data: { current: { type: 'column' } } }, over: null })).toBeNull();
  });

  it('active.id === over.id (same position)', () => {
    expect(resolveDrag(board, colDrag('c1', 'c1'))).toBeNull();
  });

  it('unknown activeType', () => {
    const drag = { active: { id: 'x', data: { current: { type: 'overlay' } } }, over: { id: 'c1', data: { current: null } } };
    expect(resolveDrag(board, drag)).toBeNull();
  });
});

// ── column reorder ────────────────────────────────────────────────────────────

describe('column reorder', () => {
  it('c3 moved before c1 → position between null and 1.0 (= 0.5)', () => {
    const outcome = resolveDrag(board, colDrag('c3', 'c1'));
    expect(outcome).toMatchObject({ type: 'column', columnId: 'c3' });
    expect(outcome.position).toBeCloseTo(0.5);
  });

  it('c1 moved after c3 → position = 4.0', () => {
    const outcome = resolveDrag(board, colDrag('c1', 'c3'));
    expect(outcome).toMatchObject({ type: 'column', columnId: 'c1' });
    expect(outcome.position).toBe(4.0);
  });

  it('c1 moved to c2 → position between 2.0 and 3.0 (= 2.5)', () => {
    const outcome = resolveDrag(board, colDrag('c1', 'c2'));
    expect(outcome).toMatchObject({ type: 'column', columnId: 'c1' });
    expect(outcome.position).toBeCloseTo(2.5);
  });

  it("over.id is a card id → resolves to that card's column", () => {
    // card1 is in c1; drag c3 over card1 → c3 moves before c1
    const drag = {
      active: { id: 'c3', data: { current: { type: 'column' } } },
      over:   { id: 'k1', data: { current: { type: 'card', columnId: 'c1' } } },
    };
    const outcome = resolveDrag(board, drag);
    expect(outcome).toMatchObject({ type: 'column', columnId: 'c3' });
    expect(outcome.position).toBeCloseTo(0.5);
  });

  it('over.id is col: droppable format → resolves to that column', () => {
    const drag = {
      active: { id: 'c3', data: { current: { type: 'column' } } },
      over:   { id: 'col:c1', data: { current: null } },
    };
    const outcome = resolveDrag(board, drag);
    expect(outcome).toMatchObject({ type: 'column', columnId: 'c3' });
  });
});

// ── card move ────────────────────────────────────────────────────────────────

describe('card move', () => {
  it('card dropped on empty column → end of that column', () => {
    const outcome = resolveDrag(board, cardOnColumn('k1', 'c2'));
    expect(outcome).toMatchObject({ type: 'card', cardId: 'k1', toColumnId: 'c2' });
    // c2 has card3 at position 1.0; end = 1.0 + 1.0 = 2.0
    expect(outcome.position).toBe(2.0);
  });

  it('card dropped on col: droppable → end of that column', () => {
    const outcome = resolveDrag(board, cardOnDroppable('k1', 'c2'));
    expect(outcome).toMatchObject({ type: 'card', cardId: 'k1', toColumnId: 'c2' });
    expect(outcome.position).toBe(2.0);
  });

  it('card dropped before another card in same column', () => {
    // k2 moved before k1 in c1: colCards without k2 = [k1 @1.0]; overIdx=0 → position between null and 1.0 = 0.5
    const outcome = resolveDrag(board, cardOnCard('k2', 'k1', 'c1'));
    expect(outcome).toMatchObject({ type: 'card', cardId: 'k2', toColumnId: 'c1' });
    expect(outcome.position).toBeCloseTo(0.5);
  });

  it('card dropped on card in different column → moves to that column', () => {
    const outcome = resolveDrag(board, cardOnCard('k1', 'k3', 'c2'));
    expect(outcome).toMatchObject({ type: 'card', cardId: 'k1', toColumnId: 'c2' });
  });

  it('unrecognised over type → null', () => {
    const drag = {
      active: { id: 'k1', data: { current: { type: 'card' } } },
      over:   { id: 'x',  data: { current: { type: 'overlay' } } },
    };
    expect(resolveDrag(board, drag)).toBeNull();
  });
});
