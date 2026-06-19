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
  return { user, board: boardRes.body };
}

async function createLabel(token, boardId, name = 'Bug', color = '#ff0000') {
  const res = await request(app)
    .post(`/boards/${boardId}/labels`)
    .set('Authorization', `Bearer ${token}`)
    .send({ name, color });
  if (res.status !== 201) throw new Error(`createLabel failed: ${res.status} ${JSON.stringify(res.body)}`);
  return res.body;
}

describe('POST /boards/:id/labels', () => {
  it('creates label → 201, returns id/name/color', async () => {
    const { user, board } = await setup();

    const res = await request(app)
      .post(`/boards/${board.id}/labels`)
      .set('Authorization', `Bearer ${user.token}`)
      .send({ name: 'Bug', color: '#ff0000' });

    expect(res.status).toBe(201);
    expect(res.body.id).toBeTruthy();
    expect(res.body.name).toBe('Bug');
    expect(res.body.color).toBe('#ff0000');
  });

  it('accepts 3-char hex shorthand (#f00) → 201', async () => {
    const { user, board } = await setup();
    const res = await request(app)
      .post(`/boards/${board.id}/labels`)
      .set('Authorization', `Bearer ${user.token}`)
      .send({ name: 'Urgent', color: '#f00' });
    expect(res.status).toBe(201);
    expect(res.body.color).toBe('#f00');
  });

  it.each([
    ['#xyz123', 'non-hex chars'],
    ['#fffff', '5 chars'],
    ['ff0000', 'missing #'],
    ['', 'empty string'],
  ])('invalid hex color (%s) → 400', async (color) => {
    const { user, board } = await setup();
    const res = await request(app)
      .post(`/boards/${board.id}/labels`)
      .set('Authorization', `Bearer ${user.token}`)
      .send({ name: 'Bug', color });
    expect(res.status).toBe(400);
  });

  it('non-member → 403', async () => {
    const { board } = await setup();
    const outsider = await createUser({ email: 'outsider@example.com', displayName: 'Out' });
    const res = await request(app)
      .post(`/boards/${board.id}/labels`)
      .set('Authorization', `Bearer ${outsider.token}`)
      .send({ name: 'Bug', color: '#ff0000' });
    expect(res.status).toBe(403);
  });
});

describe('PATCH /labels/:id', () => {
  it('rename label → 200, name updated, color unchanged', async () => {
    const { user, board } = await setup();
    const label = await createLabel(user.token, board.id);

    const res = await request(app)
      .patch(`/labels/${label.id}`)
      .set('Authorization', `Bearer ${user.token}`)
      .send({ name: 'Feature' });

    expect(res.status).toBe(200);
    expect(res.body.name).toBe('Feature');
    expect(res.body.color).toBe('#ff0000');
  });

  it('update color with invalid hex → 400', async () => {
    const { user, board } = await setup();
    const label = await createLabel(user.token, board.id);

    const res = await request(app)
      .patch(`/labels/${label.id}`)
      .set('Authorization', `Bearer ${user.token}`)
      .send({ color: 'not-a-color' });

    expect(res.status).toBe(400);
  });

  it('non-member → 403', async () => {
    const { user, board } = await setup();
    const label = await createLabel(user.token, board.id);
    const outsider = await createUser({ email: 'outsider@example.com', displayName: 'Out' });

    const res = await request(app)
      .patch(`/labels/${label.id}`)
      .set('Authorization', `Bearer ${outsider.token}`)
      .send({ name: 'Hacked' });

    expect(res.status).toBe(403);
  });
});

describe('PUT /cards/:id/labels/:labelId', () => {
  async function setupWithCard() {
    const { user, board } = await setup();
    const colRes = await request(app)
      .post(`/boards/${board.id}/columns`)
      .set('Authorization', `Bearer ${user.token}`)
      .send({ name: 'To Do' });
    const cardRes = await request(app)
      .post(`/columns/${colRes.body.id}/cards`)
      .set('Authorization', `Bearer ${user.token}`)
      .send({ title: 'Task' });
    return { user, board, column: colRes.body, card: cardRes.body };
  }

  it('attaches label → label_id appears in card snapshot', async () => {
    const { user, board, card } = await setupWithCard();
    const label = await createLabel(user.token, board.id);

    const res = await request(app)
      .put(`/cards/${card.id}/labels/${label.id}`)
      .set('Authorization', `Bearer ${user.token}`);

    expect(res.status).toBe(200);

    const snapshot = await request(app)
      .get(`/boards/${board.id}`)
      .set('Authorization', `Bearer ${user.token}`);
    const cardSnap = snapshot.body.columns[0].cards[0];
    expect(cardSnap.label_ids).toContain(label.id);
  });

  it('idempotent — second PUT returns 200, no error', async () => {
    const { user, board, card } = await setupWithCard();
    const label = await createLabel(user.token, board.id);

    await request(app)
      .put(`/cards/${card.id}/labels/${label.id}`)
      .set('Authorization', `Bearer ${user.token}`);
    const res = await request(app)
      .put(`/cards/${card.id}/labels/${label.id}`)
      .set('Authorization', `Bearer ${user.token}`);

    expect(res.status).toBe(200);
  });

  it('label from different board → 400', async () => {
    const { user, board, card } = await setupWithCard();
    const otherBoard = await request(app)
      .post('/boards')
      .set('Authorization', `Bearer ${user.token}`)
      .send({ name: 'Other' });
    const foreignLabel = await createLabel(user.token, otherBoard.body.id, 'Foreign', '#00ff00');

    const res = await request(app)
      .put(`/cards/${card.id}/labels/${foreignLabel.id}`)
      .set('Authorization', `Bearer ${user.token}`);

    expect(res.status).toBe(400);
  });

  it('non-member → 403', async () => {
    const { user, board, card } = await setupWithCard();
    const label = await createLabel(user.token, board.id);
    const outsider = await createUser({ email: 'outsider@example.com', displayName: 'Out' });

    const res = await request(app)
      .put(`/cards/${card.id}/labels/${label.id}`)
      .set('Authorization', `Bearer ${outsider.token}`);

    expect(res.status).toBe(403);
  });
});

describe('DELETE /cards/:id/labels/:labelId', () => {
  it('detaches label → label_id gone from card snapshot', async () => {
    const { user, board } = await setup();
    const colRes = await request(app)
      .post(`/boards/${board.id}/columns`)
      .set('Authorization', `Bearer ${user.token}`)
      .send({ name: 'To Do' });
    const cardRes = await request(app)
      .post(`/columns/${colRes.body.id}/cards`)
      .set('Authorization', `Bearer ${user.token}`)
      .send({ title: 'Task' });
    const card = cardRes.body;
    const label = await createLabel(user.token, board.id);

    await request(app)
      .put(`/cards/${card.id}/labels/${label.id}`)
      .set('Authorization', `Bearer ${user.token}`);

    const res = await request(app)
      .delete(`/cards/${card.id}/labels/${label.id}`)
      .set('Authorization', `Bearer ${user.token}`);

    expect(res.status).toBe(204);

    const snapshot = await request(app)
      .get(`/boards/${board.id}`)
      .set('Authorization', `Bearer ${user.token}`);
    expect(snapshot.body.columns[0].cards[0].label_ids).toEqual([]);
  });
});

describe('DELETE /labels/:id', () => {
  it('deletes label → 204, gone from board snapshot', async () => {
    const { user, board } = await setup();
    const label = await createLabel(user.token, board.id);

    const res = await request(app)
      .delete(`/labels/${label.id}`)
      .set('Authorization', `Bearer ${user.token}`);

    expect(res.status).toBe(204);

    const snapshot = await request(app)
      .get(`/boards/${board.id}`)
      .set('Authorization', `Bearer ${user.token}`);
    expect(snapshot.body.labels).toHaveLength(0);
  });

  it('cascade removes card_labels but card itself remains', async () => {
    const { user, board } = await setup();
    const label = await createLabel(user.token, board.id);
    const colRes = await request(app)
      .post(`/boards/${board.id}/columns`)
      .set('Authorization', `Bearer ${user.token}`)
      .send({ name: 'To Do' });
    const cardRes = await request(app)
      .post(`/columns/${colRes.body.id}/cards`)
      .set('Authorization', `Bearer ${user.token}`)
      .send({ title: 'Task' });
    const card = cardRes.body;

    // attach label
    await request(app)
      .put(`/cards/${card.id}/labels/${label.id}`)
      .set('Authorization', `Bearer ${user.token}`);

    // delete label
    await request(app)
      .delete(`/labels/${label.id}`)
      .set('Authorization', `Bearer ${user.token}`);

    // card should still be in snapshot, with empty label_ids
    const snapshot = await request(app)
      .get(`/boards/${board.id}`)
      .set('Authorization', `Bearer ${user.token}`);
    const cards = snapshot.body.columns[0].cards;
    expect(cards).toHaveLength(1);
    expect(cards[0].id).toBe(card.id);
    expect(cards[0].label_ids).toEqual([]);
  });
});
