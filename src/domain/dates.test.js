import { fromYMD, toYMD, formatDueDate, isOverdue } from './dates';

describe('fromYMD / toYMD', () => {
  test('round-trips a date string', () => {
    expect(toYMD(fromYMD('2026-03-09'))).toBe('2026-03-09');
  });

  test('pads single-digit month and day', () => {
    expect(toYMD(new Date(2026, 0, 5))).toBe('2026-01-05');
  });

  test('parses without timezone shift (local calendar day)', () => {
    const d = fromYMD('2026-03-09');
    expect(d.getFullYear()).toBe(2026);
    expect(d.getMonth()).toBe(2);
    expect(d.getDate()).toBe(9);
  });

  test('returns null for empty or invalid input', () => {
    expect(fromYMD('')).toBeNull();
    expect(fromYMD(null)).toBeNull();
    expect(fromYMD('not-a-date')).toBeNull();
    expect(toYMD(null)).toBeNull();
  });
});

describe('formatDueDate', () => {
  test('returns null for empty input', () => {
    expect(formatDueDate(null)).toBeNull();
  });

  test('formats a valid date to a non-empty string', () => {
    expect(typeof formatDueDate('2026-03-09')).toBe('string');
  });
});

describe('isOverdue', () => {
  test('false for empty input', () => {
    expect(isOverdue(null)).toBe(false);
  });

  test('true for a past date', () => {
    expect(isOverdue('2000-01-01')).toBe(true);
  });

  test('false for today (boundary)', () => {
    expect(isOverdue(toYMD(new Date()))).toBe(false);
  });

  test('false for a future date', () => {
    expect(isOverdue('2999-12-31')).toBe(false);
  });
});
