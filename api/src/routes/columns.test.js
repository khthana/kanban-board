const request = require('supertest');
const app = require('../app');
const pool = require('../db/pool');
const { createUser, clearDb } = require('../test/helpers');

beforeAll(clearDb);
beforeEach(clearDb);

async function setup() {
  const user = await createUser();
  const boardRes = await request(app)
    .post('/boards')
    .set('Authorization', `Bearer ${user.token}`)
    .send({ name: 'Test Board' });
  return { user, board: boardRes.body };
}

async function createColumn(token, boardId, name = 'To Do') {
  const res = await request(app)
    .post(`/boards/${boardId}/columns`)
    .set('Authorization', `Bearer ${token}`)
    .send({ name });
  if (res.status !== 201) throw new Error(`createColumn failed: ${res.status} ${JSON.stringify(res.body)}`);
  return res.body;
}

describe('authorization — non-member → 403', () => {
  it('POST /boards/:id/columns → 403', async () => {
    const { board } = await setup();
    const outsider = await createUser({ email: 'outsider@example.com', displayName: 'Outsider' });

    const res = await request(app)
      .post(`/boards/${board.id}/columns`)
      .set('Authorization', `Bearer ${outsider.token}`)
      .send({ name: 'To Do' });

    expect(res.status).toBe(403);
  });

  it('PATCH /columns/:id → 403', async () => {
    const { user, board } = await setup();
    const outsider = await createUser({ email: 'outsider@example.com', displayName: 'Outsider' });
    const col = await createColumn(user.token, board.id);

    const res = await request(app)
      .patch(`/columns/${col.id}`)
      .set('Authorization', `Bearer ${outsider.token}`)
      .send({ name: 'Hacked' });

    expect(res.status).toBe(403);
  });

  it('DELETE /columns/:id → 403', async () => {
    const { user, board } = await setup();
    const outsider = await createUser({ email: 'outsider@example.com', displayName: 'Outsider' });
    const col = await createColumn(user.token, board.id);

    const res = await request(app)
      .delete(`/columns/${col.id}`)
      .set('Authorization', `Bearer ${outsider.token}`);

    expect(res.status).toBe(403);
  });
});

describe('DELETE /columns/:id', () => {
  it('deletes column and cascades cards → 204', async () => {
    const { user, board } = await setup();
    const col = await createColumn(user.token, board.id);

    // seed a card directly via SQL to verify cascade
    await pool.query(
      `INSERT INTO cards (column_id, title, position) VALUES ($1, 'Task 1', 1.0)`,
      [col.id]
    );

    const res = await request(app)
      .delete(`/columns/${col.id}`)
      .set('Authorization', `Bearer ${user.token}`);

    expect(res.status).toBe(204);

    // board snapshot should show no columns
    const snapshot = await request(app)
      .get(`/boards/${board.id}`)
      .set('Authorization', `Bearer ${user.token}`);
    expect(snapshot.body.columns).toHaveLength(0);
  });
});

describe('PATCH /columns/:id — color', () => {
  it('set color → 200, color returned', async () => {
    const { user, board } = await setup();
    const col = await createColumn(user.token, board.id, 'To Do');

    const res = await request(app)
      .patch(`/columns/${col.id}`)
      .set('Authorization', `Bearer ${user.token}`)
      .send({ color: '#fca5a5' });

    expect(res.status).toBe(200);
    expect(res.body.color).toBe('#fca5a5');
  });

  it('invalid color → 400', async () => {
    const { user, board } = await setup();
    const col = await createColumn(user.token, board.id, 'To Do');

    const res = await request(app)
      .patch(`/columns/${col.id}`)
      .set('Authorization', `Bearer ${user.token}`)
      .send({ color: 'notacolor' });

    expect(res.status).toBe(400);
  });

  it('clear color with null → 200, color is null', async () => {
    const { user, board } = await setup();
    const col = await createColumn(user.token, board.id, 'To Do');

    await request(app)
      .patch(`/columns/${col.id}`)
      .set('Authorization', `Bearer ${user.token}`)
      .send({ color: '#fca5a5' });

    const res = await request(app)
      .patch(`/columns/${col.id}`)
      .set('Authorization', `Bearer ${user.token}`)
      .send({ color: null });

    expect(res.status).toBe(200);
    expect(res.body.color).toBeNull();
  });

  it('board snapshot includes color on column', async () => {
    const { user, board } = await setup();
    const col = await createColumn(user.token, board.id, 'To Do');

    await request(app)
      .patch(`/columns/${col.id}`)
      .set('Authorization', `Bearer ${user.token}`)
      .send({ color: '#86efac' });

    const snapshot = await request(app)
      .get(`/boards/${board.id}`)
      .set('Authorization', `Bearer ${user.token}`);

    const snapshotCol = snapshot.body.columns.find(c => c.id === col.id);
    expect(snapshotCol.color).toBe('#86efac');
  });
});

describe('PATCH /columns/:id', () => {
  it('rename column → 200, name updated', async () => {
    const { user, board } = await setup();
    const col = await createColumn(user.token, board.id, 'To Do');

    const res = await request(app)
      .patch(`/columns/${col.id}`)
      .set('Authorization', `Bearer ${user.token}`)
      .send({ name: 'Backlog' });

    expect(res.status).toBe(200);
    expect(res.body.name).toBe('Backlog');
    expect(res.body.position).toBe(1.0);
  });

  it('reposition column → 200, position updated', async () => {
    const { user, board } = await setup();
    const col = await createColumn(user.token, board.id, 'To Do');

    const res = await request(app)
      .patch(`/columns/${col.id}`)
      .set('Authorization', `Bearer ${user.token}`)
      .send({ position: 1.5 });

    expect(res.status).toBe(200);
    expect(res.body.position).toBe(1.5);
    expect(res.body.name).toBe('To Do');
  });
});

describe('POST /boards/:id/columns', () => {
  it('second column appends position', async () => {
    const { user, board } = await setup();
    await createColumn(user.token, board.id, 'To Do');

    const res = await request(app)
      .post(`/boards/${board.id}/columns`)
      .set('Authorization', `Bearer ${user.token}`)
      .send({ name: 'In Progress' });

    expect(res.status).toBe(201);
    expect(res.body.position).toBe(2.0);
  });

  it('first column gets position 1.0 → 201', async () => {
    const { user, board } = await setup();

    const res = await request(app)
      .post(`/boards/${board.id}/columns`)
      .set('Authorization', `Bearer ${user.token}`)
      .send({ name: 'To Do' });

    expect(res.status).toBe(201);
    expect(res.body.name).toBe('To Do');
    expect(res.body.position).toBe(1.0);
  });
});
