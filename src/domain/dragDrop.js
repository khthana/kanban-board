import { positionBetween } from './ordering';

function moveInArray(arr, fromIdx, toIdx) {
  const result = [...arr];
  const [item] = result.splice(fromIdx, 1);
  result.splice(toIdx, 0, item);
  return result;
}

function resolveColumnTarget(sortedCols, cards, overId, overData) {
  let toIdx = sortedCols.findIndex(c => c.id === overId);
  if (toIdx < 0) {
    const overCard = cards.find(c => c.id === overId);
    if (overCard) toIdx = sortedCols.findIndex(c => c.id === overCard.columnId);
  }
  if (toIdx < 0 && typeof overId === 'string' && overId.startsWith('col:')) {
    toIdx = sortedCols.findIndex(c => c.id === overId.slice(4));
  }
  return toIdx;
}

function resolveCardTarget(overId, overData) {
  const overType = overData?.type;
  if (overType === 'column') return overId;
  if (overType === 'card') return overData.columnId;
  if (typeof overId === 'string' && overId.startsWith('col:')) return overId.slice(4);
  return null;
}

export function resolveDrag({ columns, cards }, { active, over }) {
  if (!over || active.id === over.id) return null;

  const sortedCols = [...columns].sort((a, b) => a.position - b.position);
  const activeType = active.data.current?.type;

  if (activeType === 'column') {
    const fromIdx = sortedCols.findIndex(c => c.id === active.id);
    const toIdx = resolveColumnTarget(sortedCols, cards, over.id, over.data.current);
    if (fromIdx < 0 || toIdx < 0 || fromIdx === toIdx) return null;

    const reordered = moveInArray(sortedCols, fromIdx, toIdx);
    const newIdx = reordered.findIndex(c => c.id === active.id);
    const position = positionBetween(
      reordered[newIdx - 1]?.position ?? null,
      reordered[newIdx + 1]?.position ?? null,
    );
    return { type: 'column', columnId: active.id, position };
  }

  if (activeType === 'card') {
    const toColumnId = resolveCardTarget(over.id, over.data.current);
    if (!toColumnId) return null;

    const colCards = cards
      .filter(c => c.columnId === toColumnId && c.id !== active.id)
      .sort((a, b) => a.position - b.position);

    const overType = over.data.current?.type;
    let position;
    if (overType === 'column' || (typeof over.id === 'string' && over.id.startsWith('col:'))) {
      position = positionBetween(colCards.at(-1)?.position ?? null, null);
    } else {
      const overIdx = colCards.findIndex(c => c.id === over.id);
      position = positionBetween(
        colCards[overIdx - 1]?.position ?? null,
        colCards[overIdx]?.position ?? null,
      );
    }
    return { type: 'card', cardId: active.id, toColumnId, position };
  }

  return null;
}
