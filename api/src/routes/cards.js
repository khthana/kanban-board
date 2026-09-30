import express from 'express';
import pool from '../db/pool.js';
import requireAuth from '../middleware/requireAuth.js';
import { needsRebalance, rebalance } from '../../../src/domain/ordering.js';
import { resolveAttach, resolveDetach } from '../../../src/domain/category.js';

const router = express.Router();
router.use(requireAuth);

async function getMembershipViaCard(cardId, userId) {
  const { rows } = await pool.query(
    `SELECT c.id, c.column_id, col.board_id
     FROM cards c
     JOIN columns col ON col.id = c.column_id
     WHERE c.id = $1`,
    [cardId]
  );
  if (rows.length === 0) return { card: null };
  const card = rows[0];
  const { rows: membership } = await pool.query(
    `SELECT 1 FROM board_members WHERE board_id = $1 AND user_id = $2`,
    [card.board_id, userId]
  );
  return { card, isMember: membership.length > 0 };
}

router.patch('/:id', async (req, res) => {
  const { id } = req.params;
  const { title, description, due_date, column_id, position, category_label_id, completed_at } = req.body;

  const { card, isMember } = await getMembershipViaCard(id, req.user.id);
  if (!card) return res.status(404).json({ error: 'card not found' });
  if (!isMember) return res.status(403).json({ error: 'forbidden' });

  if (title !== undefined) {
    if (typeof title !== 'string' || !title.trim()) return res.status(400).json({ error: 'title is required' });
    if (title.trim().length > 255) return res.status(400).json({ error: 'title too long' });
  }
  if (description != null && description.length > 5000) {
    return res.status(400).json({ error: 'description too long' });
  }

  if (column_id !== undefined) {
    const { rows: targetCol } = await pool.query(
      `SELECT board_id FROM columns WHERE id = $1`, [column_id]
    );
    if (targetCol.length === 0 || targetCol[0].board_id !== card.board_id) {
      return res.status(400).json({ error: 'target column not on same board' });
    }
  }

  if (category_label_id !== undefined && category_label_id !== null) {
    const { rows: label } = await pool.query(
      `SELECT board_id FROM labels WHERE id = $1`, [category_label_id]
    );
    if (label.length === 0 || label[0].board_id !== card.board_id) {
      return res.status(400).json({ error: 'category label not on same board' });
    }
  }

  const sets = [];
  const values = [];
  if (title !== undefined) { sets.push(`title = $${sets.length + 1}`); values.push(title.trim()); }
  if (description !== undefined) { sets.push(`description = $${sets.length + 1}`); values.push(description); }
  if (due_date !== undefined) { sets.push(`due_date = $${sets.length + 1}`); values.push(due_date); }
  if (column_id !== undefined) { sets.push(`column_id = $${sets.length + 1}`); values.push(column_id); }
  if (position !== undefined) { sets.push(`position = $${sets.length + 1}`); values.push(position); }
  if (category_label_id !== undefined) { sets.push(`category_label_id = $${sets.length + 1}`); values.push(category_label_id); }
  if (completed_at !== undefined) { sets.push(`completed_at = $${sets.length + 1}`); values.push(completed_at); }

  if (sets.length === 0) return res.status(400).json({ error: 'no fields to update' });

  sets.push(`updated_at = now()`);
  values.push(id);

  const outcome = await inTransaction(async client => {
    if (category_label_id !== undefined && category_label_id !== null) {
      // Lock the card before checking, so a concurrent detach can't orphan the Category (#55).
      if (!await lockCard(client, id)) return { updated: null };
      const { rows: attached } = await client.query(
        `SELECT 1 FROM card_labels WHERE card_id = $1 AND label_id = $2`, [id, category_label_id]
      );
      if (attached.length === 0) return { error: 'category label is not attached to the card' };
    }
    const { rows } = await client.query(
      `UPDATE cards SET ${sets.join(', ')} WHERE id = $${values.length}
       RETURNING id, column_id, title, description, due_date, position, category_label_id, completed_at`,
      values
    );
    return { updated: rows[0] ?? null };
  });
  if (outcome.error) return res.status(400).json({ error: outcome.error });
  const { updated } = outcome;
  if (!updated) return res.status(404).json({ error: 'card not found' });

  if (position !== undefined) {
    const targetColumnId = column_id ?? updated.column_id;
    const { rows: siblings } = await pool.query(
      `SELECT id, position FROM cards WHERE column_id = $1 ORDER BY position`,
      [targetColumnId]
    );
    if (needsRebalance(siblings.map(r => r.position))) {
      const rebalanced = rebalance(siblings);
      const client = await pool.connect();
      try {
        await client.query('BEGIN');
        for (const r of rebalanced) {
          await client.query(
            `UPDATE cards SET position = $1, updated_at = now() WHERE id = $2`,
            [r.position, r.id]
          );
        }
        await client.query('COMMIT');
      } catch (err) {
        await client.query('ROLLBACK');
        throw err;
      } finally {
        client.release();
      }
    }
  }

  return res.json(updated);
});

async function inTransaction(fn) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await fn(client);
    await client.query('COMMIT');
    return result;
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

// Locks the card row for the rest of the caller's transaction and returns it,
// or null when the card is gone. Every Category path takes this lock *first* —
// taking it after an INSERT into card_labels (whose FK check holds KEY SHARE on
// the card) deadlocks two concurrent attaches (#55).
async function lockCard(client, cardId) {
  const { rows } = await client.query(
    `SELECT category_label_id FROM cards WHERE id = $1 FOR UPDATE`, [cardId]
  );
  return rows[0] ?? null;
}

// Applies an ADR-0002 Category rule inside the caller's transaction, so the
// attach/detach and its Category change land (or fail) together (#55).
async function updateCategory(client, cardId, current, next) {
  if (next !== current) {
    await client.query(
      `UPDATE cards SET category_label_id = $1, updated_at = now() WHERE id = $2`, [next, cardId]
    );
  }
  return next;
}

router.put('/:id/labels/:labelId', async (req, res) => {
  const { id, labelId } = req.params;

  const { card, isMember } = await getMembershipViaCard(id, req.user.id);
  if (!card) return res.status(404).json({ error: 'card not found' });
  if (!isMember) return res.status(403).json({ error: 'forbidden' });

  const { rows: label } = await pool.query(
    `SELECT board_id FROM labels WHERE id = $1`, [labelId]
  );
  if (label.length === 0 || label[0].board_id !== card.board_id) {
    return res.status(400).json({ error: 'label not on same board' });
  }

  const result = await inTransaction(async client => {
    const locked = await lockCard(client, id);
    if (!locked) return null;
    await client.query(
      `INSERT INTO card_labels (card_id, label_id) VALUES ($1, $2) ON CONFLICT DO NOTHING`,
      [id, labelId]
    );
    const current = locked.category_label_id;
    return { categoryLabelId: await updateCategory(client, id, current, resolveAttach(current, labelId)) };
  });
  if (!result) return res.status(404).json({ error: 'card not found' });
  return res.json({ card_id: id, label_id: labelId, category_label_id: result.categoryLabelId });
});

router.delete('/:id/labels/:labelId', async (req, res) => {
  const { id, labelId } = req.params;

  const { card, isMember } = await getMembershipViaCard(id, req.user.id);
  if (!card) return res.status(404).json({ error: 'card not found' });
  if (!isMember) return res.status(403).json({ error: 'forbidden' });

  const result = await inTransaction(async client => {
    const locked = await lockCard(client, id);
    if (!locked) return null;
    const { rows: before } = await client.query(
      `SELECT cl.label_id FROM card_labels cl JOIN labels l ON l.id = cl.label_id
       WHERE cl.card_id = $1 ORDER BY l.created_at, l.id`,
      [id]
    );
    await client.query(
      `DELETE FROM card_labels WHERE card_id = $1 AND label_id = $2`, [id, labelId]
    );
    const current = locked.category_label_id;
    const next = resolveDetach(before.map(r => r.label_id), labelId, current);
    return { categoryLabelId: await updateCategory(client, id, current, next) };
  });
  if (!result) return res.status(404).json({ error: 'card not found' });
  return res.json({ card_id: id, label_id: labelId, category_label_id: result.categoryLabelId });
});

router.put('/:id/assignees/:userId', async (req, res) => {
  const { id, userId } = req.params;

  const { card, isMember } = await getMembershipViaCard(id, req.user.id);
  if (!card) return res.status(404).json({ error: 'card not found' });
  if (!isMember) return res.status(403).json({ error: 'forbidden' });

  const { rows: target } = await pool.query(
    `SELECT 1 FROM board_members WHERE board_id = $1 AND user_id = $2`,
    [card.board_id, userId]
  );
  if (target.length === 0) {
    return res.status(400).json({ error: 'assignee is not a board member' });
  }

  await pool.query(
    `INSERT INTO card_assignees (card_id, user_id) VALUES ($1, $2) ON CONFLICT DO NOTHING`,
    [id, userId]
  );
  return res.json({ card_id: id, user_id: userId });
});

router.delete('/:id/assignees/:userId', async (req, res) => {
  const { id, userId } = req.params;

  const { card, isMember } = await getMembershipViaCard(id, req.user.id);
  if (!card) return res.status(404).json({ error: 'card not found' });
  if (!isMember) return res.status(403).json({ error: 'forbidden' });

  await pool.query(
    `DELETE FROM card_assignees WHERE card_id = $1 AND user_id = $2`, [id, userId]
  );
  return res.sendStatus(204);
});

router.delete('/:id', async (req, res) => {
  const { id } = req.params;
  const { card, isMember } = await getMembershipViaCard(id, req.user.id);
  if (!card) return res.status(404).json({ error: 'card not found' });
  if (!isMember) return res.status(403).json({ error: 'forbidden' });

  await pool.query(`DELETE FROM cards WHERE id = $1`, [id]);
  return res.sendStatus(204);
});

export default router;
