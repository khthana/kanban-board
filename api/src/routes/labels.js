import express from 'express';
import pool from '../db/pool.js';
import requireAuth from '../middleware/requireAuth.js';
import { isValidHex } from '../lib/validation.js';

const router = express.Router();
router.use(requireAuth);

router.patch('/:id', async (req, res) => {
  const { id } = req.params;
  const { name, color } = req.body;

  if (color !== undefined && !isValidHex(color)) {
    return res.status(400).json({ error: 'color must be a valid hex color' });
  }

  const { rows: labels } = await pool.query(
    `SELECT board_id FROM labels WHERE id = $1`, [id]
  );
  if (labels.length === 0) return res.status(404).json({ error: 'label not found' });

  const { rows: membership } = await pool.query(
    `SELECT 1 FROM board_members WHERE board_id = $1 AND user_id = $2`,
    [labels[0].board_id, req.user.id]
  );
  if (membership.length === 0) return res.status(403).json({ error: 'forbidden' });

  const sets = [];
  const values = [];
  if (name !== undefined) { sets.push(`name = $${sets.length + 1}`); values.push(name.trim()); }
  if (color !== undefined) { sets.push(`color = $${sets.length + 1}`); values.push(color); }
  if (sets.length === 0) return res.status(400).json({ error: 'name or color required' });

  sets.push(`updated_at = now()`);
  values.push(id);

  const { rows } = await pool.query(
    `UPDATE labels SET ${sets.join(', ')} WHERE id = $${values.length} RETURNING id, name, color`,
    values
  );
  return res.json(rows[0]);
});

router.delete('/:id', async (req, res) => {
  const { id } = req.params;

  const { rows: labels } = await pool.query(
    `SELECT board_id FROM labels WHERE id = $1`, [id]
  );
  if (labels.length === 0) return res.status(404).json({ error: 'label not found' });

  const { rows: membership } = await pool.query(
    `SELECT 1 FROM board_members WHERE board_id = $1 AND user_id = $2`,
    [labels[0].board_id, req.user.id]
  );
  if (membership.length === 0) return res.status(403).json({ error: 'forbidden' });

  await pool.query(`DELETE FROM labels WHERE id = $1`, [id]);
  return res.sendStatus(204);
});

export default router;
