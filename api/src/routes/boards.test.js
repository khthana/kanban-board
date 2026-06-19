import request from 'supertest';
import app from '../app.js';
import pool from '../db/pool.js';
import { createUser, clearDb } from '../test/helpers.js';

beforeAll(clearDb);
beforeEach(clearDb);

async function createBoard(token, name = 'Project Phoenix') {
  const res = await request(app)
    .post('/boards')
    .set('Authorization', `Bearer ${token}`)
    .send({ name });
  if (res.status !== 201) throw new Error(`createBoard failed: ${res.status}`);
  return res.body;
}

describe('POST /boards', () => {
  it('creates a board and makes creator the owner → 201', async () => {
    const { token } = await createUser();

    const res = await request(app)
      .post('/boards')
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'Project Phoenix' });

    expect(res.status).toBe(201);
    expect(res.body.id).toBeTruthy();
    expect(res.body.name).toBe('Project Phoenix');
  });
});

describe('GET /boards/:id', () => {
  it('returns full snapshot (board + columns + cards + labels) for member', async () => {
    const { token } = await createUser();
    const board = await createBoard(token);

    const res = await request(app)
      .get(`/boards/${board.id}`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.id).toBe(board.id);
    expect(res.body.name).toBe('Project Phoenix');
    expect(Array.isArray(res.body.columns)).toBe(true);
    expect(Array.isArray(res.body.labels)).toBe(true);
  });

  it('non-member → 403', async () => {
    const alice = await createUser({ email: 'alice@example.com' });
    const bob = await createUser({ email: 'bob@example.com', displayName: 'Bob' });
    const board = await createBoard(alice.token);

    const res = await request(app)
      .get(`/boards/${board.id}`)
      .set('Authorization', `Bearer ${bob.token}`);

    expect(res.status).toBe(403);
  });
});

describe('PATCH /boards/:id', () => {
  it('owner can rename board → 200', async () => {
    const { token } = await createUser();
    const board = await createBoard(token);

    const res = await request(app)
      .patch(`/boards/${board.id}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'New Name' });

    expect(res.status).toBe(200);
    expect(res.body.name).toBe('New Name');
  });

  it('non-owner → 403', async () => {
    const alice = await createUser({ email: 'alice@example.com' });
    const bob = await createUser({ email: 'bob@example.com', displayName: 'Bob' });
    const board = await createBoard(alice.token);
    // invite bob as member
    await request(app)
      .post(`/boards/${board.id}/members`)
      .set('Authorization', `Bearer ${alice.token}`)
      .send({ email: 'bob@example.com' });

    const res = await request(app)
      .patch(`/boards/${board.id}`)
      .set('Authorization', `Bearer ${bob.token}`)
      .send({ name: 'Hacked' });

    expect(res.status).toBe(403);
  });
});

describe('DELETE /boards/:id', () => {
  it('owner can delete board → 204', async () => {
    const { token } = await createUser();
    const board = await createBoard(token);

    const res = await request(app)
      .delete(`/boards/${board.id}`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(204);

    const get = await request(app)
      .get(`/boards/${board.id}`)
      .set('Authorization', `Bearer ${token}`);
    expect(get.status).toBe(403); // no longer a member — board is gone
  });

  it('non-owner → 403', async () => {
    const alice = await createUser({ email: 'alice@example.com' });
    const bob = await createUser({ email: 'bob@example.com', displayName: 'Bob' });
    const board = await createBoard(alice.token);
    await request(app)
      .post(`/boards/${board.id}/members`)
      .set('Authorization', `Bearer ${alice.token}`)
      .send({ email: 'bob@example.com' });

    const res = await request(app)
      .delete(`/boards/${board.id}`)
      .set('Authorization', `Bearer ${bob.token}`);

    expect(res.status).toBe(403);
  });
});

describe('POST /boards/:id/members', () => {
  it('owner invites by email → 201, invitee sees board in their list', async () => {
    const alice = await createUser({ email: 'alice@example.com' });
    const bob = await createUser({ email: 'bob@example.com', displayName: 'Bob' });
    const board = await createBoard(alice.token);

    const res = await request(app)
      .post(`/boards/${board.id}/members`)
      .set('Authorization', `Bearer ${alice.token}`)
      .send({ email: 'bob@example.com' });

    expect(res.status).toBe(201);

    const bobBoards = await request(app)
      .get('/boards')
      .set('Authorization', `Bearer ${bob.token}`);
    expect(bobBoards.body).toHaveLength(1);
  });

  it('unknown email → 404', async () => {
    const { token } = await createUser();
    const board = await createBoard(token);

    const res = await request(app)
      .post(`/boards/${board.id}/members`)
      .set('Authorization', `Bearer ${token}`)
      .send({ email: 'nobody@example.com' });

    expect(res.status).toBe(404);
  });

  it('already a member → 409', async () => {
    const alice = await createUser({ email: 'alice@example.com' });
    await createUser({ email: 'bob@example.com', displayName: 'Bob' });
    const board = await createBoard(alice.token);
    await request(app)
      .post(`/boards/${board.id}/members`)
      .set('Authorization', `Bearer ${alice.token}`)
      .send({ email: 'bob@example.com' });

    const res = await request(app)
      .post(`/boards/${board.id}/members`)
      .set('Authorization', `Bearer ${alice.token}`)
      .send({ email: 'bob@example.com' });

    expect(res.status).toBe(409);
  });
});

describe('DELETE /boards/:id/members/:userId', () => {
  it('owner can remove a member → 204, member no longer sees board', async () => {
    const alice = await createUser({ email: 'alice@example.com' });
    const bob = await createUser({ email: 'bob@example.com', displayName: 'Bob' });
    const board = await createBoard(alice.token);
    const inviteRes = await request(app)
      .post(`/boards/${board.id}/members`)
      .set('Authorization', `Bearer ${alice.token}`)
      .send({ email: 'bob@example.com' });
    expect(inviteRes.status).toBe(201);

    // get bob's user id from his boards list
    const bobBoards = await request(app).get('/boards').set('Authorization', `Bearer ${bob.token}`);
    const bobId = bobBoards.body[0] ? (
      await pool.query('SELECT user_id FROM board_members WHERE board_id = $1 AND role = $2', [board.id, 'member'])
    ).rows[0].user_id : null;

    const res = await request(app)
      .delete(`/boards/${board.id}/members/${bobId}`)
      .set('Authorization', `Bearer ${alice.token}`);

    expect(res.status).toBe(204);

    const bobBoardsAfter = await request(app).get('/boards').set('Authorization', `Bearer ${bob.token}`);
    expect(bobBoardsAfter.body).toHaveLength(0);
  });
});

describe('GET /boards', () => {
  it('returns only boards the user belongs to', async () => {
    const alice = await createUser({ email: 'alice@example.com' });
    const bob = await createUser({ email: 'bob@example.com', displayName: 'Bob' });
    await createBoard(alice.token, 'Alice Board');
    await createBoard(bob.token, 'Bob Board');

    const res = await request(app)
      .get('/boards')
      .set('Authorization', `Bearer ${alice.token}`);

    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(1);
    expect(res.body[0].name).toBe('Alice Board');
  });
});

describe('GET /boards/:id — card category_label_id', () => {
  it('includes each card\'s category_label_id in the snapshot', async () => {
    const { token } = await createUser();
    const board = await createBoard(token);
    const auth = { Authorization: `Bearer ${token}` };

    const column = (await request(app)
      .post(`/boards/${board.id}/columns`).set(auth).send({ name: 'To Do' })).body;
    const card = (await request(app)
      .post(`/columns/${column.id}/cards`).set(auth).send({ title: 'Task' })).body;
    const label = (await request(app)
      .post(`/boards/${board.id}/labels`).set(auth).send({ name: 'Cat', color: '#fca5a5' })).body;
    await request(app)
      .patch(`/cards/${card.id}`).set(auth).send({ category_label_id: label.id });

    const res = await request(app).get(`/boards/${board.id}`).set(auth);

    expect(res.status).toBe(200);
    const snapCard = res.body.columns[0].cards.find(c => c.id === card.id);
    expect(snapCard.category_label_id).toBe(label.id);
  });
});
