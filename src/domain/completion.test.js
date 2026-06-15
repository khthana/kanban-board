import { isDone, completionPatch } from './completion';
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
