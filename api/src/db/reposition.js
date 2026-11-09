import { needsRebalance, rebalance } from '../../../src/domain/ordering.js';

// Reposition (#66): write a Card or Column at a client-proposed position and
// re-space its scope (the Column for Cards, the board for Columns) when any gap
// got too small — inside the caller's transaction, so the move and its
// rebalance commit (or roll back) together.
//
//   moveCard(client, cardId, targetColumnId, write)   // targetColumnId may be undefined
//   moveColumn(client, boardId, write)
//
// `write(client)` performs the UPDATE and returns the written row, or null when
// the row is gone (then nothing is rebalanced); to reject the request it throws,
// which rolls the whole transaction back.
//
// Locking — the order is the point of this module:
// 1. The scope rows (Columns / the board) are locked FOR NO KEY UPDATE, which
//    doesn't block FK checks of inserts into them. A Card move locks *both* its
//    source and target Column, in id order: locking only the target lets two
//    opposite cross-column moves each rebalance a row the other holds — a
//    deadlock, or a card renumbered in the wrong Column.
// 2. Only then the moved row is written and its siblings read, so concurrent
//    moves into one scope take turns and a collision (gap 0) is rebalanced by
//    whoever lands second.
// Scope locks always come before card row locks (lockCard), never after.

const lockScopes = (client, table, ids) =>
  client.query(`SELECT id FROM ${table} WHERE id = ANY($1) ORDER BY id FOR NO KEY UPDATE`, [[...new Set(ids)]]);

async function rebalanceScope(client, table, scopeColumn, scopeId) {
  const { rows: siblings } = await client.query(
    `SELECT id, position FROM ${table} WHERE ${scopeColumn} = $1 ORDER BY position, id`, [scopeId]
  );
  if (!needsRebalance(siblings.map(r => r.position))) return;
  for (const r of rebalance(siblings)) {
    await client.query(
      `UPDATE ${table} SET position = $1, updated_at = now() WHERE id = $2 AND ${scopeColumn} = $3`,
      [r.position, r.id, scopeId]
    );
  }
}

const currentColumn = async (client, cardId, lock = '') =>
  (await client.query(`SELECT column_id FROM cards WHERE id = $1 ${lock}`, [cardId])).rows[0]?.column_id ?? null;

export class MovedConcurrently extends Error {
  constructor() { super('card was moved by another request; retry'); this.status = 409; }
}

export async function moveCard(client, cardId, targetColumnId, write) {
  const from = await currentColumn(client, cardId);
  if (from === null) return write(client);            // gone → write finds no row
  const to = targetColumnId ?? from;
  await lockScopes(client, 'columns', [from, to]);
  const now = await currentColumn(client, cardId, 'FOR NO KEY UPDATE');
  if (now === null) return write(client);             // deleted meanwhile → no row
  // Moved elsewhere between the read and the lock: its real Column isn't locked.
  if (now !== from) throw new MovedConcurrently();

  const written = await write(client);
  if (written) await rebalanceScope(client, 'cards', 'column_id', to);
  return written;
}

export async function moveColumn(client, boardId, write) {
  await lockScopes(client, 'boards', [boardId]);
  const written = await write(client);
  if (written) await rebalanceScope(client, 'columns', 'board_id', boardId);
  return written;
}
