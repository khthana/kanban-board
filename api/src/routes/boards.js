import express from 'express';
import pool from '../db/pool.js';
import inTransaction from '../db/inTransaction.js';
import requireAuth from '../middleware/requireAuth.js';
import { requireMembership, requireOwner } from '../middleware/requireMembership.js';
import * as entity from '../db/entities.js';
import { isClientId, isIdTaken, CLIENT_ID_ERROR, ID_TAKEN_ERROR } from '../db/clientId.js';

const router = express.Router();
router.use(requireAuth);

router.post('/', async (req, res) => {
  const { error, values } = entity.checkFields(entity.board, req.body, { required: ['name'] });
  if (error) return res.status(400).json({ error });
  const { id: clientId } = req.body;
  if (!isClientId(clientId)) return res.status(400).json({ error: CLIENT_ID_ERROR });

  try {
    const board = await inTransaction(async client => {
      const { rows } = await client.query(
        `INSERT INTO boards (id, name, owner_id) VALUES (COALESCE($3::uuid, gen_random_uuid()), $1, $2)
         RETURNING ${entity.columnList(entity.board)}`,
        [values.name, req.user.id, clientId ?? null]
      );
      await client.query(
        `INSERT INTO board_members (board_id, user_id, role) VALUES ($1, $2, 'owner')`,
        [rows[0].id, req.user.id]
      );
      return rows[0];
    });
    return res.status(201).json(board);
  } catch (err) {
    if (isIdTaken(err)) return res.status(409).json({ error: ID_TAKEN_ERROR });
    throw err;
  }
});

router.get('/', async (req, res) => {
  const { rows } = await pool.query(
    `SELECT ${entity.columnList(entity.board, 'b')}
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
    `SELECT ${entity.columnList(entity.board)} FROM boards WHERE id = $1`, [id]
  );
  if (boards.length === 0) return res.status(404).json({ error: 'board not found' });

  const { rows: columns } = await pool.query(
    `SELECT ${entity.columnList(entity.column)} FROM columns WHERE board_id = $1 ORDER BY position`, [id]
  );

  const { rows: cards } = await pool.query(
    `SELECT ${entity.columnList(entity.card, 'c')}
     FROM cards c
     JOIN columns col ON col.id = c.column_id
     WHERE col.board_id = $1
     ORDER BY c.position`,
    [id]
  );

  const { rows: labels } = await pool.query(
    `SELECT ${entity.columnList(entity.label)} FROM labels WHERE board_id = $1 ORDER BY created_at, id`, [id]
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
     JOIN labels l ON l.id = cl.label_id
     WHERE col.board_id = $1
     ORDER BY l.created_at, l.id`,
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
    `SELECT ${entity.columnList(entity.subtask, 's')}
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
    subtasksByCard[s.card_id].push(s);
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
  const { error, values } = entity.checkFields(entity.board, req.body, { required: ['name'] });
  if (error) return res.status(400).json({ error });

  const updated = await entity.updateRow(pool, entity.board, id, values);
  if (!updated) return res.status(404).json({ error: 'board not found' });
  return res.json(updated);
});

router.delete('/:id', requireOwner('id'), async (req, res) => {
  await pool.query(`DELETE FROM boards WHERE id = $1`, [req.boardId]);
  return res.sendStatus(204);
});

router.post('/:id/columns', requireMembership('id'), async (req, res) => {
  const id = req.boardId;
  const { error, values } = entity.checkFields(entity.column, req.body, { only: ['name'], required: ['name'] });
  if (error) return res.status(400).json({ error });
  const { id: clientId } = req.body;
  if (!isClientId(clientId)) return res.status(400).json({ error: CLIENT_ID_ERROR });

  const { rows: maxRows } = await pool.query(
    `SELECT COALESCE(MAX(position), 0) AS max_pos FROM columns WHERE board_id = $1`, [id]
  );
  const position = maxRows[0].max_pos + 1.0;

  let rows;
  try {
    ({ rows } = await pool.query(
      `INSERT INTO columns (id, board_id, name, position) VALUES (COALESCE($4::uuid, gen_random_uuid()), $1, $2, $3)
       RETURNING ${entity.columnList(entity.column)}`,
      [id, values.name, position, clientId ?? null]
    ));
  } catch (err) {
    if (isIdTaken(err)) return res.status(409).json({ error: ID_TAKEN_ERROR });
    throw err;
  }
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
  const { error, values } = entity.checkFields(entity.label, req.body, { required: ['name', 'color'] });
  if (error) return res.status(400).json({ error });
  const { id: clientId } = req.body;
  if (!isClientId(clientId)) return res.status(400).json({ error: CLIENT_ID_ERROR });

  let rows;
  try {
    ({ rows } = await pool.query(
      `INSERT INTO labels (id, board_id, name, color) VALUES (COALESCE($4::uuid, gen_random_uuid()), $1, $2, $3)
       RETURNING ${entity.columnList(entity.label)}`,
      [id, values.name, values.color, clientId ?? null]
    ));
  } catch (err) {
    if (isIdTaken(err)) return res.status(409).json({ error: ID_TAKEN_ERROR });
    throw err;
  }
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
