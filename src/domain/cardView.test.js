import { cardView } from './cardView';

const labels = [
  { id: 'l1', name: 'Bug', color: '#fca5a5' },
  { id: 'l2', name: 'Feature', color: '#93c5fd' },
];
const members = [
  { userId: 'u1', user: { displayName: 'Ann' } },
  { userId: 'u2', user: { displayName: 'Bob' } },
  { userId: 'u3', user: { displayName: 'Cat' } },
];

function board(overrides = {}) {
  return { labels, members, cardLabels: [], cardAssignees: [], subtasks: [], ...overrides };
}
const card = (overrides = {}) => ({
  id: 'c1', title: 'T', categoryLabelId: null, dueDate: null, completedAt: null, ...overrides,
});

describe('cardView — Category', () => {
  test('resolves the Category among the attached labels, with its accent', () => {
    const v = cardView(
      board({ cardLabels: [{ cardId: 'c1', labelId: 'l1' }, { cardId: 'c1', labelId: 'l2' }] }),
      card({ categoryLabelId: 'l2' }),
    );
    expect(v.category).toEqual(labels[1]);
    expect(v.accent.solid).toBe('#93c5fd');
    expect(v.labelIds).toEqual(new Set(['l1', 'l2']));
  });

  test('no Category → null and a neutral accent', () => {
    const v = cardView(board(), card());
    expect(v.category).toBeNull();
    expect(v.accent.neutral).toBe(true);
    expect(v.labelIds).toEqual(new Set());
  });

  test('a Category that is no longer attached is ignored', () => {
    const v = cardView(board({ cardLabels: [{ cardId: 'c1', labelId: 'l1' }] }), card({ categoryLabelId: 'l2' }));
    expect(v.category).toBeNull();
  });

  test('only this card’s label attachments count', () => {
    const v = cardView(board({ cardLabels: [{ cardId: 'c2', labelId: 'l1' }] }), card({ categoryLabelId: 'l1' }));
    expect(v.category).toBeNull();
    expect(v.labelIds.size).toBe(0);
  });
});

describe('cardView — done / due', () => {
  test('done card: done, never overdue even with a past due date', () => {
    const v = cardView(board(), card({ completedAt: '2026-01-02', dueDate: '2000-01-01' }));
    expect(v.done).toBe(true);
    expect(v.overdue).toBe(false);
  });

  test('past due date on an open card is overdue', () => {
    const v = cardView(board(), card({ dueDate: '2000-01-01' }));
    expect(v.done).toBe(false);
    expect(v.overdue).toBe(true);
  });

  test('date: completion date on a done card, else the due date, else none', () => {
    expect(cardView(board(), card({ completedAt: '2026-01-02', dueDate: '2000-01-01' })).date)
      .toEqual({ kind: 'completed', ymd: '2026-01-02' });
    expect(cardView(board(), card({ dueDate: '2000-01-01' })).date).toEqual({ kind: 'due', ymd: '2000-01-01' });
    expect(cardView(board(), card()).date).toEqual({ kind: 'none', ymd: null });
  });

  test('future or missing due date is not overdue', () => {
    expect(cardView(board(), card({ dueDate: '2999-12-31' })).overdue).toBe(false);
    expect(cardView(board(), card()).overdue).toBe(false);
  });
});

describe('cardView — assignees', () => {
  test('keeps assignment order, skips non-members and other cards', () => {
    const v = cardView(board({
      cardAssignees: [
        { cardId: 'c1', userId: 'u3' },
        { cardId: 'c2', userId: 'u2' },
        { cardId: 'c1', userId: 'gone' },
        { cardId: 'c1', userId: 'u1' },
      ],
    }), card());
    expect(v.assigneeIds).toEqual(['u3', 'gone', 'u1']);
    expect(v.assignees).toEqual([
      { userId: 'u3', displayName: 'Cat' },
      { userId: 'u1', displayName: 'Ann' },
    ]);
  });
});

describe('cardView — Subtask progress', () => {
  const sub = (id, checked, cardId = 'c1') => ({ id, cardId, checked, position: Number(id.slice(1)) });

  test('no Subtasks → no progress', () => {
    const v = cardView(board({ subtasks: [sub('s1', true, 'c2')] }), card());
    expect(v.subtasks).toEqual([]);
    expect(v.progress).toBeNull();
  });

  test('none done', () => {
    const v = cardView(board({ subtasks: [sub('s1', false), sub('s2', false)] }), card());
    expect(v.progress).toMatchObject({ done: 0, total: 2 });
    expect(v.progress.view.complete).toBe(false);
  });

  test('some done, other cards’ Subtasks excluded', () => {
    const v = cardView(board({ subtasks: [sub('s1', true), sub('s2', false), sub('s3', true, 'c2')] }), card());
    expect(v.subtasks.map(s => s.id)).toEqual(['s1', 's2']);
    expect(v.progress).toMatchObject({ done: 1, total: 2 });
    expect(v.progress.view.segments).toEqual([true, false]);
  });

  test('all done → complete', () => {
    const v = cardView(board({ subtasks: [sub('s1', true), sub('s2', true)] }), card());
    expect(v.progress).toMatchObject({ done: 2, total: 2 });
    expect(v.progress.view.complete).toBe(true);
  });

  test('tolerates a board without join arrays', () => {
    const v = cardView({ labels: [], members: [] }, card());
    expect(v).toMatchObject({ category: null, assignees: [], subtasks: [], progress: null });
  });
});
