const MIN_GAP = 1e-9;

export function positionBetween(prevPos, nextPos) {
  if (prevPos === null && nextPos === null) return 1.0;
  if (prevPos === null) return nextPos / 2;
  if (nextPos === null) return prevPos + 1.0;
  return (prevPos + nextPos) / 2;
}

export function needsRebalance(positions) {
  for (let i = 1; i < positions.length; i++) {
    if (positions[i] - positions[i - 1] < MIN_GAP) return true;
  }
  return false;
}

export function rebalance(items) {
  return items.map((item, i) => ({ ...item, position: i + 1.0 }));
}
