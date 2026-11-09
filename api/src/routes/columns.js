import express from 'express';
import pool from '../db/pool.js';
import requireAuth from '../middleware/requireAuth.js';
import requireAccess from '../middleware/requireAccess.js';
import isParentGone from '../db/isParentGone.js';
import { MAX_NAME_LENGTH, MAX_CARD_TITLE_LENGTH, MAX_CARD_DESCRIPTION_LENGTH } from '../../../src/domain/validation.js';
import inTransaction from '../db/inTransaction.js';
import { moveColumn } from '../db/reposition.js';
import { isValidHex } from '../lib/validation.js';

const router = express.Router();
router.use(requireAuth);

router.patch('/:id', requireAccess('column'), async (req, res) => {
  const { id } = req.params;
  const { name, position, color } = req.body;
  if (name === undefined && position === undefined && color === undefined) {
    return res.status(400).json({ error: 'name, position, or color required' });
  }
  if (name !== undefined) {
    if (typeof name !== 'string' || !name.trim()) return res.status(400).json({ error: 'name is required' });
    if (name.trim().length > MAX_NAME_LENGTH) return res.status(400).json({ error: 'name too long' });
  }
  if (color !== undefined && color !== null && !isValidHex(color)) {
    return res.status(400).json({ error: 'color must be a valid hex color' });
  }

  const sets = [];
  const values = [];
  if (name !== undefined) { sets.push(`name = $${sets.length + 1}`); values.push(name.trim()); }
  if (position !== undefined) { sets.push(`position = $${sets.length + 1}`); values.push(position); }
  if (color !== undefined) { sets.push(`color = $${sets.length + 1}`); values.push(color); }
  sets.push(`updated_at = now()`);
  values.push(id);

  const updateColumn = async client => (await client.query(
    `UPDATE columns SET ${sets.join(', ')} WHERE id = $${values.length} RETURNING id, name, position, color, board_id`,
    values
  )).rows[0] ?? null;
  // A move re-spaces the board's Columns in the same transaction (#66).
  const updated = await inTransaction(client => position === undefined
    ? updateColumn(client)
    : moveColumn(client, req.access.board_id, updateColumn));
  if (!updated) return res.status(404).json({ error: 'column not found' });

  return res.json({ ...updated, color: updated.color ?? null });
});

router.post('/:id/cards', requireAccess('column'), async (req, res) => {
  const { id } = req.params;
  const { title, description, due_date } = req.body;
  if (!title || !title.trim()) return res.status(400).json({ error: 'title is required' });
  if (title.trim().length > MAX_CARD_TITLE_LENGTH) return res.status(400).json({ error: 'title too long' });
  if (description != null && description.length > MAX_CARD_DESCRIPTION_LENGTH) return res.status(400).json({ error: 'description too long' });

  const { rows: maxRows } = await pool.query(
    `SELECT COALESCE(MAX(position), 0) AS max_pos FROM cards WHERE column_id = $1`, [id]
  );
  const position = maxRows[0].max_pos + 1.0;

  let rows;
  try {
    ({ rows } = await pool.query(
      `INSERT INTO cards (column_id, title, description, due_date, position)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING id, column_id, title, description, due_date, position`,
      [id, title.trim(), description ?? null, due_date ?? null, position]
    ));
  } catch (err) {
    if (isParentGone(err)) return res.status(404).json({ error: 'column not found' });
    throw err;
  }
  return res.status(201).json(rows[0]);
});

router.delete('/:id', requireAccess('column'), async (req, res) => {
  const { id } = req.params;

  await pool.query(`DELETE FROM columns WHERE id = $1`, [id]);
  return res.sendStatus(204);
});

export default router;
