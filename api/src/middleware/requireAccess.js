import pool from '../db/pool.js';
import { isUuid } from '../lib/validation.js';

// Access to anything that lives on a board, reached by its own id (#65).
// One query resolves the entity to its board and checks the user's membership,
// so every route answers the same way, *before* it looks at the body:
//   404 — no such entity (malformed id included, or deleted in the meantime)
//   403 — the user is not a member of its board
// On success req.access holds the resolved row ({ id, board_id, ... }).
const memberColumn = boardId =>
  `EXISTS (SELECT 1 FROM board_members bm WHERE bm.board_id = ${boardId} AND bm.user_id = $2) AS is_member`;

const KINDS = {
  card: {
    sql: `SELECT c.id, c.column_id, col.board_id, ${memberColumn('col.board_id')}
          FROM cards c JOIN columns col ON col.id = c.column_id WHERE c.id = $1`,
    notFound: 'card not found',
  },
  subtask: {
    sql: `SELECT s.id, s.card_id, col.board_id, ${memberColumn('col.board_id')}
          FROM subtasks s JOIN cards c ON c.id = s.card_id JOIN columns col ON col.id = c.column_id
          WHERE s.id = $1`,
    notFound: 'subtask not found',
  },
  column: {
    sql: `SELECT col.id, col.board_id, ${memberColumn('col.board_id')} FROM columns col WHERE col.id = $1`,
    notFound: 'column not found',
  },
  label: {
    sql: `SELECT l.id, l.board_id, ${memberColumn('l.board_id')} FROM labels l WHERE l.id = $1`,
    notFound: 'label not found',
  },
};

// Returns { status: 404 | 403, error } or { access: row }.
async function resolveAccess(kind, id, userId) {
  const { sql, notFound } = KINDS[kind];
  if (!isUuid(id)) return { status: 404, error: notFound };
  const { rows } = await pool.query(sql, [id, userId]);
  if (rows.length === 0) return { status: 404, error: notFound };
  const { is_member, ...access } = rows[0];
  if (!is_member) return { status: 403, error: 'forbidden' };
  return { access };
}

// Route middleware: requireAccess('card', 'cardId') reads req.params.cardId.
export default function requireAccess(kind, param = 'id') {
  if (!KINDS[kind]) throw new Error(`unknown access kind: ${kind}`);
  return async (req, res, next) => {
    const result = await resolveAccess(kind, req.params[param], req.user.id);
    if (result.status) return res.status(result.status).json({ error: result.error });
    req.access = result.access;
    next();
  };
}
