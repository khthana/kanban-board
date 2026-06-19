const { needsRebalance, rebalance } = require('./ordering');

describe('needsRebalance', () => {
  it('evenly-spaced positions → false', () => {
    expect(needsRebalance([1.0, 2.0, 3.0])).toBe(false);
  });

  it('empty list → false', () => {
    expect(needsRebalance([])).toBe(false);
  });

  it('single item → false', () => {
    expect(needsRebalance([1.0])).toBe(false);
  });

  it('gap < 1e-9 → true', () => {
    expect(needsRebalance([1.0, 1.0 + 5e-10])).toBe(true);
  });

  it('gap exactly 1e-9 → false (threshold is exclusive)', () => {
    expect(needsRebalance([1.0, 1.0 + 1e-9])).toBe(false);
  });
});

describe('rebalance', () => {
  it('reassigns positions starting at 1.0, incrementing by 1', () => {
    const items = [
      { id: 'a', position: 0.5 },
      { id: 'b', position: 0.5 + 5e-10 },
      { id: 'c', position: 3.7 },
    ];
    const result = rebalance(items);
    expect(result[0]).toEqual({ id: 'a', position: 1.0 });
    expect(result[1]).toEqual({ id: 'b', position: 2.0 });
    expect(result[2]).toEqual({ id: 'c', position: 3.0 });
  });

  it('preserves input order (caller must sort before calling)', () => {
    const items = [{ id: 'x', position: 99.0 }, { id: 'y', position: 100.0 }];
    const result = rebalance(items);
    expect(result[0].id).toBe('x');
    expect(result[0].position).toBe(1.0);
    expect(result[1].id).toBe('y');
    expect(result[1].position).toBe(2.0);
  });
});
