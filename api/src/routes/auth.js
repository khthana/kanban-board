const router = require('express').Router();
const bcrypt = require('bcrypt');
const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const rateLimit = require('express-rate-limit');
const pool = require('../db/pool');
const requireAuth = require('../middleware/requireAuth');

const BCRYPT_ROUNDS = 12;
const REFRESH_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

const authLimiter = ['test', 'development'].includes(process.env.NODE_ENV)
  ? (req, res, next) => next()
  : rateLimit({
      windowMs: 15 * 60 * 1000,
      max: 20,
      standardHeaders: true,
      legacyHeaders: false,
      message: { error: 'too many requests, please try again later' },
    });

function signToken(userId) {
  return jwt.sign({ sub: userId }, process.env.JWT_SECRET, { expiresIn: '60m' });
}

async function createRefreshToken(userId) {
  const raw = crypto.randomBytes(32).toString('hex');
  const hash = crypto.createHash('sha256').update(raw).digest('hex');
  const expiresAt = new Date(Date.now() + REFRESH_TTL_MS);
  await pool.query(
    'INSERT INTO refresh_tokens(user_id, token_hash, expires_at) VALUES($1, $2, $3)',
    [userId, hash, expiresAt]
  );
  return raw;
}

router.post('/register', authLimiter, async (req, res) => {
  const { email, password, displayName } = req.body;

  if (!email || !password || !displayName) {
    return res.status(400).json({ error: 'email, password, and displayName are required' });
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return res.status(400).json({ error: 'invalid email' });
  }
  if (password.length < 8) {
    return res.status(400).json({ error: 'password must be at least 8 characters' });
  }

  const passwordHash = await bcrypt.hash(password, BCRYPT_ROUNDS);

  try {
    const { rows } = await pool.query(
      `INSERT INTO users (email, password_hash, display_name)
       VALUES ($1, $2, $3)
       RETURNING id`,
      [email.toLowerCase().trim(), passwordHash, displayName.trim()]
    );
    const userId = rows[0].id;
    const token = signToken(userId);
    const refreshToken = await createRefreshToken(userId);
    return res.status(201).json({ token, refreshToken });
  } catch (err) {
    if (err.code === '23505') {
      return res.status(409).json({ error: 'email already registered' });
    }
    throw err;
  }
});

router.post('/login', authLimiter, async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) {
    return res.status(400).json({ error: 'email and password are required' });
  }

  const { rows } = await pool.query(
    'SELECT id, password_hash FROM users WHERE email = $1',
    [email.toLowerCase().trim()]
  );
  if (rows.length === 0) {
    return res.status(401).json({ error: 'invalid credentials' });
  }

  const match = await bcrypt.compare(password, rows[0].password_hash);
  if (!match) {
    return res.status(401).json({ error: 'invalid credentials' });
  }

  const userId = rows[0].id;
  const token = signToken(userId);
  const refreshToken = await createRefreshToken(userId);
  return res.status(200).json({ token, refreshToken });
});

router.post('/refresh', async (req, res) => {
  const { refreshToken } = req.body;
  if (!refreshToken) {
    return res.status(400).json({ error: 'refreshToken is required' });
  }

  const hash = crypto.createHash('sha256').update(refreshToken).digest('hex');
  const { rows } = await pool.query(
    'SELECT user_id FROM refresh_tokens WHERE token_hash = $1 AND expires_at > now()',
    [hash]
  );
  if (rows.length === 0) {
    return res.status(401).json({ error: 'invalid or expired refresh token' });
  }

  const token = signToken(rows[0].user_id);
  return res.json({ token });
});

router.patch('/me', requireAuth, async (req, res) => {
  const { displayName, email } = req.body;
  if (!displayName && !email) {
    return res.status(400).json({ error: 'displayName or email is required' });
  }

  const fields = [];
  const values = [];
  if (displayName) { fields.push(`display_name = $${fields.length + 1}`); values.push(displayName.trim()); }
  if (email) {
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return res.status(400).json({ error: 'invalid email' });
    }
    fields.push(`email = $${fields.length + 1}`); values.push(email.toLowerCase().trim());
  }
  values.push(req.user.id);

  try {
    const { rows } = await pool.query(
      `UPDATE users SET ${fields.join(', ')}, updated_at = now()
       WHERE id = $${values.length} RETURNING id, email, display_name`,
      values
    );
    const u = rows[0];
    return res.json({ id: u.id, email: u.email, displayName: u.display_name });
  } catch (err) {
    if (err.code === '23505') return res.status(409).json({ error: 'email already registered' });
    throw err;
  }
});

router.patch('/me/password', requireAuth, async (req, res) => {
  const { currentPassword, newPassword } = req.body;
  if (!currentPassword || !newPassword) {
    return res.status(400).json({ error: 'currentPassword and newPassword are required' });
  }
  if (newPassword.length < 8) {
    return res.status(400).json({ error: 'password must be at least 8 characters' });
  }

  const { rows } = await pool.query(
    'SELECT password_hash FROM users WHERE id = $1',
    [req.user.id]
  );
  const match = await bcrypt.compare(currentPassword, rows[0].password_hash);
  if (!match) return res.status(400).json({ error: 'current password is incorrect' });

  const newHash = await bcrypt.hash(newPassword, BCRYPT_ROUNDS);
  await pool.query(
    'UPDATE users SET password_hash = $1, updated_at = now() WHERE id = $2',
    [newHash, req.user.id]
  );
  return res.status(200).json({ message: 'password updated' });
});

router.get('/me', requireAuth, async (req, res) => {
  const { rows } = await pool.query(
    'SELECT email, display_name FROM users WHERE id = $1',
    [req.user.id]
  );
  if (rows.length === 0) return res.status(401).json({ error: 'user not found' });
  return res.json({ id: req.user.id, email: rows[0].email, displayName: rows[0].display_name });
});

module.exports = router;
