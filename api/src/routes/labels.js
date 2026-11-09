import express from 'express';
import pool from '../db/pool.js';
import requireAuth from '../middleware/requireAuth.js';
import requireAccess from '../middleware/requireAccess.js';
import { MAX_NAME_LENGTH } from '../../../src/domain/validation.js';
import { isValidHex } from '../lib/validation.js';

const router = express.Router();
router.use(requireAuth);

router.patch('/:id', requireAccess('label'), async (req, res) => {
  const { id } = req.params;
  const { name, color } = req.body;

  if (name !== undefined) {
    if (typeof name !== 'string' || !name.trim()) return res.status(400).json({ error: 'name is required' });
    if (name.trim().length > MAX_NAME_LENGTH) return res.status(400).json({ error: 'name too long' });
  }
  if (color !== undefined && !isValidHex(color)) {
    return res.status(400).json({ error: 'color must be a valid hex color' });
  }

  const sets = [];
  const values = [];
  if (name !== undefined) { sets.push(`name = $${sets.length + 1}`); values.push(name.trim()); }
  if (color !== undefined) { sets.push(`color = $${sets.length + 1}`); values.push(color); }
  if (sets.length === 0) return res.status(400).json({ error: 'name or color required' });

  sets.push(`updated_at = now()`);
  values.push(id);

  const { rows } = await pool.query(
    `UPDATE labels SET ${sets.join(', ')} WHERE id = $${values.length} RETURNING id, board_id, name, color`,
    values
  );
  if (rows.length === 0) return res.status(404).json({ error: 'label not found' });
  return res.json(rows[0]);
});

router.delete('/:id', requireAccess('label'), async (req, res) => {
  const { id } = req.params;

  await pool.query(`DELETE FROM labels WHERE id = $1`, [id]);
  return res.sendStatus(204);
});

export default router;
