import { positionBetween, needsRebalance, rebalance } from './ordering';

describe('positionBetween', () => {
  test('insert at head sorts before existing first item', () => {
    const pos = positionBetween(null, 1.0);
    expect(pos).toBeLessThan(1.0);
  });

  test('insert at tail sorts after existing last item', () => {
    const pos = positionBetween(2.0, null);
    expect(pos).toBeGreaterThan(2.0);
  });

  test('insert in middle sorts between its neighbours', () => {
    const pos = positionBetween(1.0, 2.0);
    expect(pos).toBeGreaterThan(1.0);
    expect(pos).toBeLessThan(2.0);
  });

  test('first insert into empty list returns a valid starting position', () => {
    const pos = positionBetween(null, null);
    expect(typeof pos).toBe('number');
    expect(isFinite(pos)).toBe(true);
  });
});

describe('needsRebalance', () => {
  test('returns false when gaps are healthy', () => {
    expect(needsRebalance([1.0, 2.0, 3.0])).toBe(false);
  });

  test('returns true when adjacent gap is below precision threshold', () => {
    expect(needsRebalance([1.0, 1.0 + 5e-10])).toBe(true);
  });
});

describe('rebalance', () => {
  test('returns same number of items', () => {
    const items = [{ id: 'a', position: 1.0 }, { id: 'b', position: 1.5 }, { id: 'c', position: 2.0 }];
    expect(rebalance(items)).toHaveLength(3);
  });

  test('preserves existing visual order after rebalancing', () => {
    const items = [
      { id: 'a', position: 1.0 },
      { id: 'b', position: 1.0 + 5e-10 },
      { id: 'c', position: 1.0 + 1e-9 },
    ];
    const result = rebalance(items);
    expect(result[0].id).toBe('a');
    expect(result[1].id).toBe('b');
    expect(result[2].id).toBe('c');
    expect(result[0].position).toBeLessThan(result[1].position);
    expect(result[1].position).toBeLessThan(result[2].position);
  });

  test('resulting positions have healthy gaps (no longer need rebalance)', () => {
    const items = [
      { id: 'a', position: 1.0 },
      { id: 'b', position: 1.0 + 5e-10 },
    ];
    const result = rebalance(items);
    const positions = result.map(item => item.position);
    expect(needsRebalance(positions)).toBe(false);
  });
});
