const request = require('supertest');
const app = require('../app');
const pool = require('../db/pool');

async function createUser({ email = 'alice@example.com', password = 'secret123', displayName = 'Alice' } = {}) {
  const res = await request(app).post('/auth/register').send({ email, password, displayName });
  if (res.status !== 201) throw new Error(`createUser failed: ${res.status} ${JSON.stringify(res.body)}`);
  return { token: res.body.token, email, displayName };
}

async function clearDb() {
  await pool.query(
    'TRUNCATE users, boards, board_members, columns, cards, labels, card_labels, card_assignees RESTART IDENTITY CASCADE'
  );
}

module.exports = { createUser, clearDb };
