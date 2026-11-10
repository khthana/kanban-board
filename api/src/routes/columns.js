import express from 'express';
import pool from '../db/pool.js';
import requireAuth from '../middleware/requireAuth.js';
import requireAccess from '../middleware/requireAccess.js';
import isParentGone from '../db/isParentGone.js';
import { isClientId, isIdTaken, CLIENT_ID_ERROR, ID_TAKEN_ERROR } from '../db/clientId.js';
import inTransaction from '../db/inTransaction.js';
import { moveColumn } from '../db/reposition.js';
import { card, column, checkFields, columnList, updateRow } from '../db/entities.js';

const router = express.Router();
router.use(requireAuth);

router.patch('/:id', requireAccess('column'), async (req, res) => {
  const { id } = req.params;
  const { error, values } = checkFields(column, req.body);
  if (error) return res.status(400).json({ error });

  const updateColumn = client => updateRow(client, column, id, values);
  // A move re-spaces the board's Columns in the same transaction (#66).
  const updated = await inTransaction(client => values.position === undefined
    ? updateColumn(client)
    : moveColumn(client, req.access.board_id, updateColumn));
  if (!updated) return res.status(404).json({ error: 'column not found' });

  return res.json(updated);
});

router.post('/:id/cards', requireAccess('column'), async (req, res) => {
  const { id } = req.params;
  const { error, values } = checkFields(card, req.body, { only: ['title', 'description', 'due_date'], required: ['title'] });
  if (error) return res.status(400).json({ error });
  const { id: clientId } = req.body;
  if (!isClientId(clientId)) return res.status(400).json({ error: CLIENT_ID_ERROR });

  const { rows: maxRows } = await pool.query(
    `SELECT COALESCE(MAX(position), 0) AS max_pos FROM cards WHERE column_id = $1`, [id]
  );
  const position = maxRows[0].max_pos + 1.0;

  let rows;
  try {
    ({ rows } = await pool.query(
      `INSERT INTO cards (id, column_id, title, description, due_date, position)
       VALUES (COALESCE($6::uuid, gen_random_uuid()), $1, $2, $3, $4, $5)
       RETURNING ${columnList(card)}`,
      [id, values.title, values.description ?? null, values.due_date ?? null, position, clientId ?? null]
    ));
  } catch (err) {
    if (isParentGone(err)) return res.status(404).json({ error: 'column not found' });
    if (isIdTaken(err)) return res.status(409).json({ error: ID_TAKEN_ERROR });
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
