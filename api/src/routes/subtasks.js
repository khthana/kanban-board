import express from 'express';
import pool from '../db/pool.js';
import inTransaction from '../db/inTransaction.js';
import lockCard from '../db/lockCard.js';
import requireAuth from '../middleware/requireAuth.js';
import { MAX_SUBTASKS_PER_CARD } from '../../../src/domain/validation.js';

const router = express.Router();
router.use(requireAuth);

async function getMembershipViaCard(cardId, userId) {
  const { rows } = await pool.query(
    `SELECT c.id, col.board_id
     FROM cards c
     JOIN columns col ON col.id = c.column_id
     WHERE c.id = $1`,
    [cardId]
  );
  if (rows.length === 0) return { found: false };
  const { board_id } = rows[0];
  const { rows: membership } = await pool.query(
    `SELECT 1 FROM board_members WHERE board_id = $1 AND user_id = $2`,
    [board_id, userId]
  );
  return { found: true, isMember: membership.length > 0 };
}

router.post('/cards/:cardId/subtasks', async (req, res) => {
  const { cardId } = req.params;
  const { title } = req.body;

  if (!title || !title.trim()) return res.status(400).json({ error: 'title is required' });
  if (title.trim().length > 100) return res.status(400).json({ error: 'title must be 100 characters or fewer' });

  const { found, isMember } = await getMembershipViaCard(cardId, req.user.id);
  if (!found) return res.status(404).json({ error: 'card not found' });
  if (!isMember) return res.status(403).json({ error: 'forbidden' });

  // Lock the card row first so concurrent adds count and insert one at a time —
  // otherwise two requests can both see room and push the card past the limit.
  const result = await inTransaction(async client => {
    if (!await lockCard(client, cardId)) return { status: 404, body: { error: 'card not found' } };

    const { rows: [{ cnt, max_pos }] } = await client.query(
      'SELECT COUNT(*) AS cnt, COALESCE(MAX(position), 0) AS max_pos FROM subtasks WHERE card_id = $1',
      [cardId]
    );
    if (parseInt(cnt, 10) >= MAX_SUBTASKS_PER_CARD) {
      return { status: 400, body: { error: `maximum ${MAX_SUBTASKS_PER_CARD} subtasks per card` } };
    }

    const { rows } = await client.query(
      `INSERT INTO subtasks (card_id, title, position)
       VALUES ($1, $2, $3)
       RETURNING id, card_id, title, checked, position, created_at`,
      [cardId, title.trim(), parseFloat(max_pos) + 1]
    );
    return { status: 201, body: rows[0] };
  });

  return res.status(result.status).json(result.body);
});

router.patch('/subtasks/:id', async (req, res) => {
  const { id } = req.params;
  const { title, position, checked } = req.body;

  if (title === undefined && position === undefined && checked === undefined) {
    return res.status(400).json({ error: 'no fields to update' });
  }

  if (title !== undefined) {
    if (!title || !title.trim()) return res.status(400).json({ error: 'title is required' });
    if (title.trim().length > 100) return res.status(400).json({ error: 'title must be 100 characters or fewer' });
  }

  const { rows: subtaskRows } = await pool.query(
    `SELECT s.id, c.id AS card_id FROM subtasks s JOIN cards c ON c.id = s.card_id WHERE s.id = $1`,
    [id]
  );
  if (subtaskRows.length === 0) return res.status(404).json({ error: 'subtask not found' });

  const { found, isMember } = await getMembershipViaCard(subtaskRows[0].card_id, req.user.id);
  if (!found || !isMember) return res.status(403).json({ error: 'forbidden' });

  const sets = [];
  const values = [];
  if (title !== undefined) { sets.push(`title = $${sets.length + 1}`); values.push(title.trim()); }
  if (position !== undefined) { sets.push(`position = $${sets.length + 1}`); values.push(position); }
  if (checked !== undefined) { sets.push(`checked = $${sets.length + 1}`); values.push(checked); }
  values.push(id);

  const { rows } = await pool.query(
    `UPDATE subtasks SET ${sets.join(', ')} WHERE id = $${values.length}
     RETURNING id, card_id, title, checked, position`,
    values
  );
  return res.json(rows[0]);
});

router.delete('/subtasks/:id', async (req, res) => {
  const { id } = req.params;

  const { rows } = await pool.query(
    `SELECT s.id, c.id AS card_id FROM subtasks s JOIN cards c ON c.id = s.card_id WHERE s.id = $1`,
    [id]
  );
  if (rows.length === 0) return res.status(404).json({ error: 'subtask not found' });

  const { found, isMember } = await getMembershipViaCard(rows[0].card_id, req.user.id);
  if (!found || !isMember) return res.status(403).json({ error: 'forbidden' });

  await pool.query('DELETE FROM subtasks WHERE id = $1', [id]);
  return res.sendStatus(204);
});

export default router;
