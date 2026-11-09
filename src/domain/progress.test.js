import { progressView, subtaskProgress } from './progress';

describe('progressView', () => {
  test('renders one segment per subtask when total <= 8, first `done` marked complete', () => {
    const v = progressView(2, 5);
    expect(v.mode).toBe('segments');
    expect(v.segments).toEqual([true, true, false, false, false]);
  });

  test('switches to a mini-bar with rounded percent when total > 8', () => {
    const v = progressView(7, 18);
    expect(v.mode).toBe('minibar');
    expect(v.pct).toBe(39);
  });

  test('total of exactly 8 stays segments (boundary)', () => {
    expect(progressView(3, 8).mode).toBe('segments');
    expect(progressView(3, 9).mode).toBe('minibar');
  });

  test('complete is true only when done equals total (both modes)', () => {
    expect(progressView(5, 5).complete).toBe(true);
    expect(progressView(2, 5).complete).toBe(false);
    expect(progressView(18, 18).complete).toBe(true);
    expect(progressView(7, 18).complete).toBe(false);
  });

  test('empty checklist (total 0) yields no segments and is not complete', () => {
    const v = progressView(0, 0);
    expect(v.mode).toBe('segments');
    expect(v.segments).toEqual([]);
    expect(v.complete).toBe(false);
  });
});

describe('subtaskProgress', () => {
  test('counts done of total, view only when there are Subtasks', () => {
    expect(subtaskProgress([])).toEqual({ done: 0, total: 0, view: null });
    const p = subtaskProgress([{ checked: true }, { checked: false }, { checked: true }]);
    expect(p).toMatchObject({ done: 2, total: 3 });
    expect(p.view.mode).toBe('segments');
  });
});
