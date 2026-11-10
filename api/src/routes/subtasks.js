import express from 'express';
import pool from '../db/pool.js';
import inTransaction from '../db/inTransaction.js';
import lockCard from '../db/lockCard.js';
import { isIdTaken, ID_TAKEN_ERROR } from '../db/clientId.js';
import { isUuid } from '../lib/validation.js';
import requireAuth from '../middleware/requireAuth.js';
import requireAccess from '../middleware/requireAccess.js';
import { MAX_SUBTASKS_PER_CARD, MAX_SUBTASK_TITLE_LENGTH } from '../../../src/domain/validation.js';
import { subtask, checkFields, columnList, updateRow } from '../db/entities.js';
import { checkSubtaskBatch } from '../../../src/domain/subtaskBatch.js';

const router = express.Router();
router.use(requireAuth);

const BATCH_ERRORS = {
  empty:     () => 'titles must be a non-empty array',
  blank:     e => `title ${e.line} is required`,
  tooLong:   e => `title ${e.line} must be ${MAX_SUBTASK_TITLE_LENGTH} characters or fewer`,
  overLimit: e => `maximum ${MAX_SUBTASKS_PER_CARD} subtasks per card (room for ${e.room})`,
};

// The one way to add Subtasks (PRD §12; a single add is a batch of one, #67):
// all titles are added, in array order after the card's existing Subtasks, or
// none are. The card row is locked first so concurrent adds count and insert
// one at a time — otherwise two requests can both see room and overshoot 50.
router.post('/cards/:cardId/subtasks/batch', requireAccess('card', 'cardId'), async (req, res) => {
  const { cardId } = req.params;
  const { titles, ids } = req.body;

  if (!Array.isArray(titles) || titles.some(t => typeof t !== 'string')) {
    return res.status(400).json({ error: 'titles must be an array of strings' });
  }
  if (ids !== undefined && (!Array.isArray(ids) || ids.length !== titles.length || !ids.every(isUuid))) {
    return res.status(400).json({ error: 'ids must be an array of UUIDs, one per title' });
  }
  const items = titles.map((title, i) => ({ line: i + 1, title: title.trim() }));
  const invalid = checkSubtaskBatch(items, 0);
  if (invalid) return res.status(400).json({ error: BATCH_ERRORS[invalid.reason](invalid) });

  const result = await inTransaction(async client => {
    if (!await lockCard(client, cardId)) return { status: 404, body: { error: 'card not found' } };

    const { rows: [{ cnt, max_pos }] } = await client.query(
      'SELECT COUNT(*) AS cnt, COALESCE(MAX(position), 0) AS max_pos FROM subtasks WHERE card_id = $1',
      [cardId]
    );
    const overLimit = checkSubtaskBatch(items, parseInt(cnt, 10));
    if (overLimit) return { status: 400, body: { error: BATCH_ERRORS[overLimit.reason](overLimit) } };

    const { rows } = await client.query(
      `INSERT INTO subtasks (id, card_id, title, position)
       SELECT COALESCE(t.id, gen_random_uuid()), $1, t.title, $3::float8 + t.ord
       FROM unnest($2::text[], $4::uuid[]) WITH ORDINALITY AS t(title, id, ord)
       RETURNING ${columnList(subtask)}`,
      [cardId, items.map(i => i.title), parseFloat(max_pos), ids ?? items.map(() => null)]
    );
    return { status: 201, body: rows.sort((a, b) => a.position - b.position) };
  }).catch(err => {
    if (isIdTaken(err)) return { status: 409, body: { error: ID_TAKEN_ERROR } };
    throw err;
  });

  return res.status(result.status).json(result.body);
});

router.patch('/subtasks/:id', requireAccess('subtask'), async (req, res) => {
  const { id } = req.params;
  const { error, values } = checkFields(subtask, req.body);
  if (error) return res.status(400).json({ error });

  const updated = await updateRow(pool, subtask, id, values);
  // Gone between the access check and the update (e.g. its Card was deleted).
  if (!updated) return res.status(404).json({ error: 'subtask not found' });
  return res.json(updated);
});

router.delete('/subtasks/:id', requireAccess('subtask'), async (req, res) => {
  const { id } = req.params;

  const { rowCount } = await pool.query('DELETE FROM subtasks WHERE id = $1', [id]);
  if (rowCount === 0) return res.status(404).json({ error: 'subtask not found' });
  return res.sendStatus(204);
});

export default router;
