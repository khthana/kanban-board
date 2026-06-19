import express from 'express';
import pool from '../db/pool.js';
import requireAuth from '../middleware/requireAuth.js';
import { requireMembership, requireOwner } from '../middleware/requireMembership.js';
import { isValidHex } from '../lib/validation.js';

const router = express.Router();
router.use(requireAuth);

router.post('/', async (req, res) => {
  const { name } = req.body;
  if (!name || !name.trim()) return res.status(400).json({ error: 'name is required' });
  if (name.trim().length > 100) return res.status(400).json({ error: 'name too long' });

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const { rows } = await client.query(
      `INSERT INTO boards (name, owner_id) VALUES ($1, $2) RETURNING id, name, owner_id, created_at`,
      [name.trim(), req.user.id]
    );
    const board = rows[0];
    await client.query(
      `INSERT INTO board_members (board_id, user_id, role) VALUES ($1, $2, 'owner')`,
      [board.id, req.user.id]
    );
    await client.query('COMMIT');
    return res.status(201).json(board);
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
});

router.get('/', async (req, res) => {
  const { rows } = await pool.query(
    `SELECT b.id, b.name, b.owner_id, b.created_at
     FROM boards b
     JOIN board_members bm ON bm.board_id = b.id
     WHERE bm.user_id = $1
     ORDER BY b.created_at DESC`,
    [req.user.id]
  );
  return res.json(rows);
});

router.get('/:id', requireMembership('id'), async (req, res) => {
  const id = req.boardId;

  const { rows: boards } = await pool.query(
    `SELECT id, name, owner_id, created_at FROM boards WHERE id = $1`, [id]
  );
  if (boards.length === 0) return res.status(404).json({ error: 'board not found' });

  const { rows: columns } = await pool.query(
    `SELECT id, name, position, color FROM columns WHERE board_id = $1 ORDER BY position`, [id]
  );

  const { rows: cards } = await pool.query(
    `SELECT c.id, c.column_id, c.title, c.description,
            c.due_date, c.position, c.category_label_id, c.completed_at
     FROM cards c
     JOIN columns col ON col.id = c.column_id
     WHERE col.board_id = $1
     ORDER BY c.position`,
    [id]
  );

  const { rows: labels } = await pool.query(
    `SELECT id, name, color FROM labels WHERE board_id = $1`, [id]
  );

  const { rows: memberRows } = await pool.query(
    `SELECT bm.user_id, bm.role, u.email, u.display_name
     FROM board_members bm
     JOIN users u ON u.id = bm.user_id
     WHERE bm.board_id = $1`,
    [id]
  );
  const members = memberRows.map(r => ({
    boardId: id,
    userId: r.user_id,
    role: r.role,
    user: { id: r.user_id, email: r.email, displayName: r.display_name ?? '' },
  }));

  const { rows: cardLabels } = await pool.query(
    `SELECT cl.card_id, cl.label_id
     FROM card_labels cl
     JOIN cards c ON c.id = cl.card_id
     JOIN columns col ON col.id = c.column_id
     WHERE col.board_id = $1`,
    [id]
  );

  const labelIdsByCard = {};
  for (const { card_id, label_id } of cardLabels) {
    if (!labelIdsByCard[card_id]) labelIdsByCard[card_id] = [];
    labelIdsByCard[card_id].push(label_id);
  }

  const { rows: cardAssignees } = await pool.query(
    `SELECT ca.card_id, ca.user_id
     FROM card_assignees ca
     JOIN cards c ON c.id = ca.card_id
     JOIN columns col ON col.id = c.column_id
     WHERE col.board_id = $1`,
    [id]
  );

  const assigneesByCard = {};
  for (const { card_id, user_id } of cardAssignees) {
    if (!assigneesByCard[card_id]) assigneesByCard[card_id] = [];
    assigneesByCard[card_id].push(user_id);
  }

  const { rows: subtaskRows } = await pool.query(
    `SELECT s.id, s.card_id, s.title, s.checked, s.position
     FROM subtasks s
     JOIN cards c ON c.id = s.card_id
     JOIN columns col ON col.id = c.column_id
     WHERE col.board_id = $1
     ORDER BY s.position`,
    [id]
  );

  const subtasksByCard = {};
  for (const s of subtaskRows) {
    if (!subtasksByCard[s.card_id]) subtasksByCard[s.card_id] = [];
    subtasksByCard[s.card_id].push({ id: s.id, card_id: s.card_id, title: s.title, checked: s.checked, position: s.position });
  }

  const columnMap = columns.map(col => ({
    ...col,
    cards: cards
      .filter(c => c.column_id === col.id)
      .map(c => ({ ...c, label_ids: labelIdsByCard[c.id] ?? [], assignees: assigneesByCard[c.id] ?? [], subtasks: subtasksByCard[c.id] ?? [] })),
  }));

  return res.json({ ...boards[0], columns: columnMap, labels, members });
});

router.patch('/:id', requireOwner('id'), async (req, res) => {
  const id = req.boardId;
  const { name } = req.body;
  if (!name || !name.trim()) return res.status(400).json({ error: 'name is required' });

  const { rows } = await pool.query(
    `UPDATE boards SET name = $1, updated_at = now() WHERE id = $2 RETURNING id, name, owner_id`,
    [name.trim(), id]
  );
  if (rows.length === 0) return res.status(404).json({ error: 'board not found' });
  return res.json(rows[0]);
});

router.delete('/:id', requireOwner('id'), async (req, res) => {
  await pool.query(`DELETE FROM boards WHERE id = $1`, [req.boardId]);
  return res.sendStatus(204);
});

router.post('/:id/columns', requireMembership('id'), async (req, res) => {
  const id = req.boardId;
  const { name } = req.body;
  if (!name || !name.trim()) return res.status(400).json({ error: 'name is required' });
  if (name.trim().length > 100) return res.status(400).json({ error: 'name too long' });

  const { rows: maxRows } = await pool.query(
    `SELECT COALESCE(MAX(position), 0) AS max_pos FROM columns WHERE board_id = $1`, [id]
  );
  const position = maxRows[0].max_pos + 1.0;

  const { rows } = await pool.query(
    `INSERT INTO columns (board_id, name, position) VALUES ($1, $2, $3) RETURNING id, name, position`,
    [id, name.trim(), position]
  );
  return res.status(201).json(rows[0]);
});

router.post('/:id/members', requireOwner('id'), async (req, res) => {
  const id = req.boardId;
  const { email } = req.body;

  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return res.status(400).json({ error: 'valid email is required' });
  }

  const { rows: users } = await pool.query(
    `SELECT id FROM users WHERE email = $1`, [email.toLowerCase().trim()]
  );
  if (users.length === 0) return res.status(404).json({ error: 'user not found' });

  try {
    await pool.query(
      `INSERT INTO board_members (board_id, user_id, role) VALUES ($1, $2, 'member')`,
      [id, users[0].id]
    );
    return res.status(201).json({ message: 'member added' });
  } catch (err) {
    if (err.code === '23505') return res.status(409).json({ error: 'already a member' });
    throw err;
  }
});

router.post('/:id/labels', requireMembership('id'), async (req, res) => {
  const id = req.boardId;
  const { name, color } = req.body;
  if (!name || !name.trim()) return res.status(400).json({ error: 'name is required' });
  if (!color || !isValidHex(color)) return res.status(400).json({ error: 'color must be a valid hex color' });

  const { rows } = await pool.query(
    `INSERT INTO labels (board_id, name, color) VALUES ($1, $2, $3) RETURNING id, name, color`,
    [id, name.trim(), color]
  );
  return res.status(201).json(rows[0]);
});

router.delete('/:id/members/:userId', requireOwner('id'), async (req, res) => {
  const { userId } = req.params;
  if (userId === req.user.id) return res.status(400).json({ error: 'owner cannot remove themselves' });

  await pool.query(
    `DELETE FROM board_members WHERE board_id = $1 AND user_id = $2`, [req.boardId, userId]
  );
  return res.sendStatus(204);
});

export default router;
