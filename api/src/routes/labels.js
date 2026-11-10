import express from 'express';
import pool from '../db/pool.js';
import requireAuth from '../middleware/requireAuth.js';
import requireAccess from '../middleware/requireAccess.js';
import { label, checkFields, updateRow } from '../db/entities.js';

const router = express.Router();
router.use(requireAuth);

router.patch('/:id', requireAccess('label'), async (req, res) => {
  const { id } = req.params;
  const { error, values } = checkFields(label, req.body);
  if (error) return res.status(400).json({ error });

  const updated = await updateRow(pool, label, id, values);
  if (!updated) return res.status(404).json({ error: 'label not found' });
  return res.json(updated);
});

router.delete('/:id', requireAccess('label'), async (req, res) => {
  const { id } = req.params;

  await pool.query(`DELETE FROM labels WHERE id = $1`, [id]);
  return res.sendStatus(204);
});

export default router;
