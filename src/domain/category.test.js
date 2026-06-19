import { resolveAttach, resolveDetach } from './category';

describe('resolveAttach', () => {
  it('auto-sets category when none is set', () => {
    expect(resolveAttach(null, 'l1')).toBe('l1');
  });

  it('auto-sets category when undefined', () => {
    expect(resolveAttach(undefined, 'l1')).toBe('l1');
  });

  it('leaves existing category unchanged when one is already set', () => {
    expect(resolveAttach('l1', 'l2')).toBe('l1');
  });
});

describe('resolveDetach', () => {
  const attached = new Set(['l1', 'l2', 'l3']);

  it('returns current category unchanged when a non-category label is detached', () => {
    expect(resolveDetach(attached, 'l2', 'l1')).toBe('l1');
  });

  it('promotes to first remaining label when the category label is detached', () => {
    // attached = {l1, l2, l3}; detach l1 (the category) → first remaining after filter
    const result = resolveDetach(attached, 'l1', 'l1');
    // remaining = [l2, l3]; first = l2
    expect(result).toBe('l2');
  });

  it('returns null when the last label (which is the category) is detached', () => {
    expect(resolveDetach(new Set(['l1']), 'l1', 'l1')).toBeNull();
  });

  it('returns null when detaching from empty set', () => {
    expect(resolveDetach(new Set(), 'l1', 'l1')).toBeNull();
  });

  it('handles Set order — first remaining is deterministic for a Set', () => {
    const s = new Set(['a', 'b', 'c']);
    expect(resolveDetach(s, 'a', 'a')).toBe('b');
  });
});
