const MIN_GAP = 1e-9;

function needsRebalance(positions) {
  for (let i = 1; i < positions.length; i++) {
    if (positions[i] - positions[i - 1] < MIN_GAP) return true;
  }
  return false;
}

function rebalance(items) {
  return items.map((item, i) => ({ ...item, position: i + 1.0 }));
}

module.exports = { needsRebalance, rebalance };
