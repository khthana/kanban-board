import { visibleSubtasks, visibleNeighbour } from './subtaskVisibility';

const st = (id, position, checked = false, cardId = 'c1') => ({ id, cardId, title: id, checked, position });

// c1 in real order: a(1) b(2, done) c(3, done) d(4) e(5)
const subtasks = [
  st('d', 4), st('b', 2, true), st('a', 1), st('e', 5), st('c', 3, true),
  st('x', 2.5, false, 'c2'), st('y', 3.5, false, 'c2'),
];
const c1 = subtasks.filter(s => s.cardId === 'c1');

describe('visibleSubtasks', () => {
  test('hidden mode: only unchecked, in position order', () => {
    expect(visibleSubtasks(c1, { hideDone: true }).map(s => s.id)).toEqual(['a', 'd', 'e']);
  });

  test('revealed mode: every Subtask in position order', () => {
    expect(visibleSubtasks(c1, { hideDone: false }).map(s => s.id)).toEqual(['a', 'b', 'c', 'd', 'e']);
  });
});

describe('visibleNeighbour', () => {
  test('hidden mode: ↑ skips checked Subtasks', () => {
    expect(visibleNeighbour(subtasks, 'd', -1, { hideDone: true }).id).toBe('a');
  });

  test('hidden mode: ↓ skips checked Subtasks', () => {
    expect(visibleNeighbour(subtasks, 'a', 1, { hideDone: true }).id).toBe('d');
  });

  test('top and bottom edges have no neighbour', () => {
    expect(visibleNeighbour(subtasks, 'a', -1, { hideDone: true })).toBeNull();
    expect(visibleNeighbour(subtasks, 'e', 1, { hideDone: true })).toBeNull();
  });

  test('revealed mode: the true adjacent Subtask, checked or not', () => {
    expect(visibleNeighbour(subtasks, 'd', -1, { hideDone: false }).id).toBe('c');
    expect(visibleNeighbour(subtasks, 'a', 1, { hideDone: false }).id).toBe('b');
  });

  test("other Cards' Subtasks are ignored", () => {
    // c2's x (2.5) and y (3.5) sit between c1 positions but must never be picked.
    expect(visibleNeighbour(subtasks, 'd', -1, { hideDone: false }).id).toBe('c');
    expect(visibleNeighbour(subtasks, 'x', 1, { hideDone: true }).id).toBe('y');
  });

  test('unknown or hidden Subtask → null', () => {
    expect(visibleNeighbour(subtasks, 'nope', 1, { hideDone: true })).toBeNull();
    expect(visibleNeighbour(subtasks, 'b', 1, { hideDone: true })).toBeNull();
  });
});
