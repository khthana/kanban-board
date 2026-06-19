const request = require('supertest');
const app = require('../app');
const { createUser, clearDb } = require('../test/helpers');

beforeAll(clearDb);
beforeEach(clearDb);

async function setup() {
  const user = await createUser();
  const boardRes = await request(app)
    .post('/boards')
    .set('Authorization', `Bearer ${user.token}`)
    .send({ name: 'Test Board' });
  const colRes = await request(app)
    .post(`/boards/${boardRes.body.id}/columns`)
    .set('Authorization', `Bearer ${user.token}`)
    .send({ name: 'To Do' });
  return { user, board: boardRes.body, column: colRes.body };
}

async function createCard(token, columnId, title = 'Task 1') {
  const res = await request(app)
    .post(`/columns/${columnId}/cards`)
    .set('Authorization', `Bearer ${token}`)
    .send({ title });
  if (res.status !== 201) throw new Error(`createCard failed: ${res.status} ${JSON.stringify(res.body)}`);
  return res.body;
}

describe('POST /columns/:id/cards', () => {
  it('first card gets position 1.0 → 201', async () => {
    const { user, column } = await setup();

    const res = await request(app)
      .post(`/columns/${column.id}/cards`)
      .set('Authorization', `Bearer ${user.token}`)
      .send({ title: 'Task 1' });

    expect(res.status).toBe(201);
    expect(res.body.title).toBe('Task 1');
    expect(res.body.position).toBe(1.0);
    expect(res.body.id).toBeTruthy();
  });

  it('second card appends position 2.0', async () => {
    const { user, column } = await setup();
    await request(app)
      .post(`/columns/${column.id}/cards`)
      .set('Authorization', `Bearer ${user.token}`)
      .send({ title: 'Task 1' });

    const res = await request(app)
      .post(`/columns/${column.id}/cards`)
      .set('Authorization', `Bearer ${user.token}`)
      .send({ title: 'Task 2' });

    expect(res.status).toBe(201);
    expect(res.body.position).toBe(2.0);
  });

  it('missing title → 400', async () => {
    const { user, column } = await setup();

    const res = await request(app)
      .post(`/columns/${column.id}/cards`)
      .set('Authorization', `Bearer ${user.token}`)
      .send({ description: 'no title' });

    expect(res.status).toBe(400);
  });

  it('non-member → 403', async () => {
    const { column } = await setup();
    const outsider = await createUser({ email: 'outsider@example.com', displayName: 'Outsider' });

    const res = await request(app)
      .post(`/columns/${column.id}/cards`)
      .set('Authorization', `Bearer ${outsider.token}`)
      .send({ title: 'Hack' });

    expect(res.status).toBe(403);
  });
});

describe('PATCH /cards/:id', () => {
  it('title only → 200, other fields unchanged', async () => {
    const { user, column } = await setup();
    const card = await createCard(user.token, column.id, 'Original');

    const res = await request(app)
      .patch(`/cards/${card.id}`)
      .set('Authorization', `Bearer ${user.token}`)
      .send({ title: 'Updated' });

    expect(res.status).toBe(200);
    expect(res.body.title).toBe('Updated');
    expect(res.body.column_id).toBe(column.id);
    expect(res.body.position).toBe(1.0);
  });

  it('move to another column in same board → 200, card in new column', async () => {
    const { user, board, column } = await setup();
    const card = await createCard(user.token, column.id);
    const col2Res = await request(app)
      .post(`/boards/${board.id}/columns`)
      .set('Authorization', `Bearer ${user.token}`)
      .send({ name: 'In Progress' });
    const col2 = col2Res.body;

    const res = await request(app)
      .patch(`/cards/${card.id}`)
      .set('Authorization', `Bearer ${user.token}`)
      .send({ column_id: col2.id, position: 1.5 });

    expect(res.status).toBe(200);
    expect(res.body.column_id).toBe(col2.id);
    expect(res.body.position).toBe(1.5);
  });

  it('move to column in different board → 400', async () => {
    const { user, column } = await setup();
    const card = await createCard(user.token, column.id);

    const otherBoard = await request(app)
      .post('/boards')
      .set('Authorization', `Bearer ${user.token}`)
      .send({ name: 'Other Board' });
    const otherCol = await request(app)
      .post(`/boards/${otherBoard.body.id}/columns`)
      .set('Authorization', `Bearer ${user.token}`)
      .send({ name: 'Col' });

    const res = await request(app)
      .patch(`/cards/${card.id}`)
      .set('Authorization', `Bearer ${user.token}`)
      .send({ column_id: otherCol.body.id, position: 1.0 });

    expect(res.status).toBe(400);
  });

  it('non-member → 403', async () => {
    const { user, column } = await setup();
    const outsider = await createUser({ email: 'outsider@example.com', displayName: 'Outsider' });
    const card = await createCard(user.token, column.id);

    const res = await request(app)
      .patch(`/cards/${card.id}`)
      .set('Authorization', `Bearer ${outsider.token}`)
      .send({ title: 'Hacked' });

    expect(res.status).toBe(403);
  });
});

describe('DELETE /cards/:id', () => {
  it('member deletes card → 204, card gone from board snapshot', async () => {
    const { user, board, column } = await setup();
    const card = await createCard(user.token, column.id);

    const res = await request(app)
      .delete(`/cards/${card.id}`)
      .set('Authorization', `Bearer ${user.token}`);

    expect(res.status).toBe(204);

    const snapshot = await request(app)
      .get(`/boards/${board.id}`)
      .set('Authorization', `Bearer ${user.token}`);
    expect(snapshot.body.columns[0].cards).toHaveLength(0);
  });

  it('non-member → 403', async () => {
    const { user, column } = await setup();
    const outsider = await createUser({ email: 'outsider@example.com', displayName: 'Outsider' });
    const card = await createCard(user.token, column.id);

    const res = await request(app)
      .delete(`/cards/${card.id}`)
      .set('Authorization', `Bearer ${outsider.token}`);

    expect(res.status).toBe(403);
  });
});

describe('PATCH /cards/:id category_label_id', () => {
  async function createLabel(token, boardId, color = '#fca5a5', name = 'Category') {
    const res = await request(app)
      .post(`/boards/${boardId}/labels`)
      .set('Authorization', `Bearer ${token}`)
      .send({ name, color });
    return res.body;
  }

  it('sets the category to a board label and returns it', async () => {
    const { user, board, column } = await setup();
    const card = await createCard(user.token, column.id);
    const label = await createLabel(user.token, board.id);

    const res = await request(app)
      .patch(`/cards/${card.id}`)
      .set('Authorization', `Bearer ${user.token}`)
      .send({ category_label_id: label.id });

    expect(res.status).toBe(200);
    expect(res.body.category_label_id).toBe(label.id);
  });
});

describe('PATCH /cards/:id category_label_id — clear and validation', () => {
  async function createLabel(token, boardId, color = '#fca5a5', name = 'Category') {
    const res = await request(app)
      .post(`/boards/${boardId}/labels`)
      .set('Authorization', `Bearer ${token}`)
      .send({ name, color });
    return res.body;
  }

  it('clears the category when set to null', async () => {
    const { user, board, column } = await setup();
    const card = await createCard(user.token, column.id);
    const label = await createLabel(user.token, board.id);
    await request(app)
      .patch(`/cards/${card.id}`)
      .set('Authorization', `Bearer ${user.token}`)
      .send({ category_label_id: label.id });

    const res = await request(app)
      .patch(`/cards/${card.id}`)
      .set('Authorization', `Bearer ${user.token}`)
      .send({ category_label_id: null });

    expect(res.status).toBe(200);
    expect(res.body.category_label_id).toBeNull();
  });

  it('rejects a label from another board → 400', async () => {
    const { user, column } = await setup();
    const card = await createCard(user.token, column.id);
    const board2 = (await request(app)
      .post('/boards')
      .set('Authorization', `Bearer ${user.token}`)
      .send({ name: 'Other Board' })).body;
    const otherLabel = await createLabel(user.token, board2.id);

    const res = await request(app)
      .patch(`/cards/${card.id}`)
      .set('Authorization', `Bearer ${user.token}`)
      .send({ category_label_id: otherLabel.id });

    expect(res.status).toBe(400);
  });
});

describe('PATCH /cards/:id completed_at', () => {
  it('marks a card done with a date and the snapshot reflects it', async () => {
    const { user, board, column } = await setup();
    const card = await createCard(user.token, column.id);

    const res = await request(app)
      .patch(`/cards/${card.id}`)
      .set('Authorization', `Bearer ${user.token}`)
      .send({ completed_at: '2026-06-15' });

    expect(res.status).toBe(200);
    expect(String(res.body.completed_at).slice(0, 10)).toBe('2026-06-15');

    const snapshot = await request(app)
      .get(`/boards/${board.id}`).set('Authorization', `Bearer ${user.token}`);
    expect(String(snapshot.body.columns[0].cards[0].completed_at).slice(0, 10)).toBe('2026-06-15');
  });

  it('clears completion when set back to null', async () => {
    const { user, column } = await setup();
    const card = await createCard(user.token, column.id);
    await request(app)
      .patch(`/cards/${card.id}`)
      .set('Authorization', `Bearer ${user.token}`)
      .send({ completed_at: '2026-06-15' });

    const res = await request(app)
      .patch(`/cards/${card.id}`)
      .set('Authorization', `Bearer ${user.token}`)
      .send({ completed_at: null });

    expect(res.status).toBe(200);
    expect(res.body.completed_at).toBeNull();
  });

  it('a freshly created card is not completed', async () => {
    const { user, board, column } = await setup();
    await createCard(user.token, column.id);

    const snapshot = await request(app)
      .get(`/boards/${board.id}`).set('Authorization', `Bearer ${user.token}`);
    expect(snapshot.body.columns[0].cards[0].completed_at).toBeNull();
  });
});

describe('PUT/DELETE /cards/:id/assignees/:userId', () => {
  it('assigns a board member and the snapshot reflects it', async () => {
    const { user, board, column } = await setup();
    const card = await createCard(user.token, column.id);
    const snap = await request(app)
      .get(`/boards/${board.id}`).set('Authorization', `Bearer ${user.token}`);
    const uid = snap.body.members[0].userId;

    const res = await request(app)
      .put(`/cards/${card.id}/assignees/${uid}`)
      .set('Authorization', `Bearer ${user.token}`);
    expect(res.status).toBe(200);

    const snap2 = await request(app)
      .get(`/boards/${board.id}`).set('Authorization', `Bearer ${user.token}`);
    expect(snap2.body.columns[0].cards[0].assignees).toContain(uid);
  });

  it('unassigns a member on DELETE', async () => {
    const { user, board, column } = await setup();
    const card = await createCard(user.token, column.id);
    const snap = await request(app)
      .get(`/boards/${board.id}`).set('Authorization', `Bearer ${user.token}`);
    const uid = snap.body.members[0].userId;
    await request(app)
      .put(`/cards/${card.id}/assignees/${uid}`).set('Authorization', `Bearer ${user.token}`);

    const res = await request(app)
      .delete(`/cards/${card.id}/assignees/${uid}`).set('Authorization', `Bearer ${user.token}`);
    expect(res.status).toBe(204);

    const snap2 = await request(app)
      .get(`/boards/${board.id}`).set('Authorization', `Bearer ${user.token}`);
    expect(snap2.body.columns[0].cards[0].assignees).toEqual([]);
  });

  it('rejects a user who is not a board member → 400', async () => {
    const { user, column } = await setup();
    const card = await createCard(user.token, column.id);
    const outsider = await createUser({ email: 'nonmember@example.com', displayName: 'NM' });
    const meRes = await request(app).get('/auth/me').set('Authorization', `Bearer ${outsider.token}`);

    const res = await request(app)
      .put(`/cards/${card.id}/assignees/${meRes.body.id}`)
      .set('Authorization', `Bearer ${user.token}`);
    expect(res.status).toBe(400);
  });
});
