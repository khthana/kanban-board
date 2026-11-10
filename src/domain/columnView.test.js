import { columnViews, columnView } from './columnView';

const board = {
  columns: [
    { id: 'c2', name: 'Doing', position: 2, color: null },
    { id: 'c1', name: 'Todo',  position: 1, color: '#fca5a5' },
    { id: 'c3', name: 'Done',  position: 3 },
  ],
  cards: [
    { id: 'k3', columnId: 'c1', position: 3 },
    { id: 'k1', columnId: 'c1', position: 1 },
    { id: 'k9', columnId: 'c2', position: 1 },
    { id: 'k2', columnId: 'c1', position: 2 },
  ],
};

describe('columnViews', () => {
  it('lists the Columns in position order', () => {
    expect(columnViews(board).map(v => v.column.id)).toEqual(['c1', 'c2', 'c3']);
  });

  it("gives each Column its own Cards, in position order, and their count", () => {
    const [todo, doing] = columnViews(board);
    expect(todo.cards.map(c => c.id)).toEqual(['k1', 'k2', 'k3']);
    expect(todo.count).toBe(3);
    expect(doing.cards.map(c => c.id)).toEqual(['k9']);
  });

  it('an empty Column has no Cards and a count of 0', () => {
    const done = columnViews(board)[2];
    expect(done.cards).toEqual([]);
    expect(done.count).toBe(0);
  });

  it("the Accent is the Column's color when set, neutral (null) when not", () => {
    expect(columnViews(board).map(v => v.accent)).toEqual(['#fca5a5', null, null]);
    expect(columnView(board, { id: 'x', position: 0, color: '' }).accent).toBeNull();
  });

  it('a board with no Columns has no Column views', () => {
    expect(columnViews({ columns: [], cards: [] })).toEqual([]);
  });
});

describe('columnView', () => {
  it('derives one Column (e.g. the dragged one, which may be gone from the board)', () => {
    const v = columnView(board, { id: 'c1', name: 'Todo', position: 1, color: '#fca5a5' });
    expect(v.cards.map(c => c.id)).toEqual(['k1', 'k2', 'k3']);
    expect(v.accent).toBe('#fca5a5');
  });
});
