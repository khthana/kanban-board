const pool = require('../db/pool');

// Resolves board_id from req.params.boardId (or req.boardId set by caller),
// checks board_members, and attaches req.memberRole ('owner' | 'member').
// Usage: router.use('/:boardId/...', requireMembership('boardId'))
//   or set req.boardId before calling and use requireMembership()
function requireMembership(paramName = 'boardId') {
  return async (req, res, next) => {
    const boardId = req.params[paramName] ?? req.boardId;
    if (!boardId) return res.status(400).json({ error: 'board id required' });

    const { rows } = await pool.query(
      `SELECT role FROM board_members WHERE board_id = $1 AND user_id = $2`,
      [boardId, req.user.id]
    );
    if (rows.length === 0) return res.status(403).json({ error: 'forbidden' });

    req.memberRole = rows[0].role;
    req.boardId = boardId;
    next();
  };
}

function requireOwner(paramName = 'boardId') {
  return async (req, res, next) => {
    const boardId = req.params[paramName] ?? req.boardId;
    if (!boardId) return res.status(400).json({ error: 'board id required' });

    const { rows } = await pool.query(
      `SELECT role FROM board_members WHERE board_id = $1 AND user_id = $2`,
      [boardId, req.user.id]
    );
    if (rows.length === 0) return res.status(403).json({ error: 'forbidden' });
    if (rows[0].role !== 'owner') return res.status(403).json({ error: 'owner only' });

    req.memberRole = 'owner';
    req.boardId = boardId;
    next();
  };
}

module.exports = { requireMembership, requireOwner };
