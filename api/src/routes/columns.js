const router = require('express').Router();
const pool = require('../db/pool');
const requireAuth = require('../middleware/requireAuth');
const { needsRebalance, rebalance } = require('../domain/ordering');
const { isValidHex } = require('../lib/validation');

router.use(requireAuth);

router.patch('/:id', async (req, res) => {
  const { id } = req.params;
  const { name, position, color } = req.body;
  if (name === undefined && position === undefined && color === undefined) {
    return res.status(400).json({ error: 'name, position, or color required' });
  }
  if (color !== undefined && color !== null && !isValidHex(color)) {
    return res.status(400).json({ error: 'color must be a valid hex color' });
  }

  const { rows: cols } = await pool.query(
    `SELECT board_id FROM columns WHERE id = $1`, [id]
  );
  if (cols.length === 0) return res.status(404).json({ error: 'column not found' });

  const { rows: membership } = await pool.query(
    `SELECT 1 FROM board_members WHERE board_id = $1 AND user_id = $2`,
    [cols[0].board_id, req.user.id]
  );
  if (membership.length === 0) return res.status(403).json({ error: 'forbidden' });

  const sets = [];
  const values = [];
  if (name !== undefined) { sets.push(`name = $${sets.length + 1}`); values.push(name.trim()); }
  if (position !== undefined) { sets.push(`position = $${sets.length + 1}`); values.push(position); }
  if (color !== undefined) { sets.push(`color = $${sets.length + 1}`); values.push(color); }
  sets.push(`updated_at = now()`);
  values.push(id);

  const { rows } = await pool.query(
    `UPDATE columns SET ${sets.join(', ')} WHERE id = $${values.length} RETURNING id, name, position, color, board_id`,
    values
  );
  const updated = rows[0];

  if (position !== undefined) {
    const { rows: siblings } = await pool.query(
      `SELECT id, position FROM columns WHERE board_id = $1 ORDER BY position`,
      [updated.board_id]
    );
    if (needsRebalance(siblings.map(r => r.position))) {
      const rebalanced = rebalance(siblings);
      const client = await pool.connect();
      try {
        await client.query('BEGIN');
        for (const r of rebalanced) {
          await client.query(
            `UPDATE columns SET position = $1, updated_at = now() WHERE id = $2`,
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

  const { board_id: _, ...responseCol } = updated;
  return res.json({ ...responseCol, color: responseCol.color ?? null });
});
router.post('/:id/cards', async (req, res) => {
  const { id } = req.params;
  const { title, description, due_date } = req.body;
  if (!title || !title.trim()) return res.status(400).json({ error: 'title is required' });

  const { rows: cols } = await pool.query(
    `SELECT board_id FROM columns WHERE id = $1`, [id]
  );
  if (cols.length === 0) return res.status(404).json({ error: 'column not found' });

  const { rows: membership } = await pool.query(
    `SELECT 1 FROM board_members WHERE board_id = $1 AND user_id = $2`,
    [cols[0].board_id, req.user.id]
  );
  if (membership.length === 0) return res.status(403).json({ error: 'forbidden' });

  const { rows: maxRows } = await pool.query(
    `SELECT COALESCE(MAX(position), 0) AS max_pos FROM cards WHERE column_id = $1`, [id]
  );
  const position = maxRows[0].max_pos + 1.0;

  const { rows } = await pool.query(
    `INSERT INTO cards (column_id, title, description, due_date, position)
     VALUES ($1, $2, $3, $4, $5)
     RETURNING id, column_id, title, description, due_date, position`,
    [id, title.trim(), description ?? null, due_date ?? null, position]
  );
  return res.status(201).json(rows[0]);
});

router.delete('/:id', async (req, res) => {
  const { id } = req.params;

  const { rows: cols } = await pool.query(
    `SELECT board_id FROM columns WHERE id = $1`, [id]
  );
  if (cols.length === 0) return res.status(404).json({ error: 'column not found' });

  const { rows: membership } = await pool.query(
    `SELECT 1 FROM board_members WHERE board_id = $1 AND user_id = $2`,
    [cols[0].board_id, req.user.id]
  );
  if (membership.length === 0) return res.status(403).json({ error: 'forbidden' });

  await pool.query(`DELETE FROM columns WHERE id = $1`, [id]);
  return res.sendStatus(204);
});

module.exports = router;
