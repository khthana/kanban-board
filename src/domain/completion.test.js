import { isDone, completionPatch, incompleteSubtasks } from './completion';
import { toYMD } from './dates';

describe('isDone', () => {
  test('a card with a completedAt date is done', () => {
    expect(isDone({ completedAt: '2026-06-15' })).toBe(true);
  });

  test('a card with completedAt null is not done', () => {
    expect(isDone({ completedAt: null })).toBe(false);
  });

  test('a card with no completedAt field is not done', () => {
    expect(isDone({})).toBe(false);
  });
});

describe('completionPatch', () => {
  test('marking done stamps today as a YYYY-MM-DD date', () => {
    expect(completionPatch(true)).toEqual({ completedAt: toYMD(new Date()) });
  });

  test('un-marking clears the date to null', () => {
    expect(completionPatch(false)).toEqual({ completedAt: null });
  });
});

describe('incompleteSubtasks', () => {
  test('counts the unchecked subtasks', () => {
    const subtasks = [
      { checked: true },
      { checked: false },
      { checked: false },
    ];
    expect(incompleteSubtasks(subtasks)).toBe(2);
  });

  test('is zero when every subtask is checked', () => {
    expect(incompleteSubtasks([{ checked: true }, { checked: true }])).toBe(0);
  });

  test('is zero for a card with no subtasks', () => {
    expect(incompleteSubtasks([])).toBe(0);
    expect(incompleteSubtasks(undefined)).toBe(0);
  });
});
