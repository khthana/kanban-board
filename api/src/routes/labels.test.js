import request from 'supertest';
import app from '../app.js';
import { createUser, clearDb } from '../test/helpers.js';

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
    expect(res.body.board_id).toBe(board.id);
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
    expect(res.body.board_id).toBe(board.id);
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

    expect(res.status).toBe(200);

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

describe('label name validation', () => {
  it('POST name over 100 chars → 400, no label created', async () => {
    const { user, board } = await setup();

    const res = await request(app)
      .post(`/boards/${board.id}/labels`)
      .set('Authorization', `Bearer ${user.token}`)
      .send({ name: 'a'.repeat(101), color: '#ff0000' });

    expect(res.status).toBe(400);
    const snapshot = await request(app)
      .get(`/boards/${board.id}`)
      .set('Authorization', `Bearer ${user.token}`);
    expect(snapshot.body.labels).toHaveLength(0);
  });

  it.each([
    ['null', null],
    ['empty', ''],
    ['whitespace', '   '],
    ['101 chars', 'a'.repeat(101)],
  ])('PATCH invalid name (%s) → 400, name unchanged', async (_label, name) => {
    const { user, board } = await setup();
    const label = await createLabel(user.token, board.id, 'Bug');

    const res = await request(app)
      .patch(`/labels/${label.id}`)
      .set('Authorization', `Bearer ${user.token}`)
      .send({ name });

    expect(res.status).toBe(400);
    const snapshot = await request(app)
      .get(`/boards/${board.id}`)
      .set('Authorization', `Bearer ${user.token}`);
    expect(snapshot.body.labels[0].name).toBe('Bug');
  });
});

describe('Category follows label attach/detach (ADR-0002, #55)', () => {
  async function setupCard() {
    const { user, board } = await setup();
    const col = await request(app)
      .post(`/boards/${board.id}/columns`)
      .set('Authorization', `Bearer ${user.token}`)
      .send({ name: 'To Do' });
    const card = await request(app)
      .post(`/columns/${col.body.id}/cards`)
      .set('Authorization', `Bearer ${user.token}`)
      .send({ title: 'Task' });
    return { user, board, card: card.body };
  }
  const attach = (token, cardId, labelId) =>
    request(app).put(`/cards/${cardId}/labels/${labelId}`).set('Authorization', `Bearer ${token}`);
  const detach = (token, cardId, labelId) =>
    request(app).delete(`/cards/${cardId}/labels/${labelId}`).set('Authorization', `Bearer ${token}`);
  async function categoryOf(token, boardId) {
    const snap = await request(app).get(`/boards/${boardId}`).set('Authorization', `Bearer ${token}`);
    return snap.body.columns[0].cards[0].category_label_id;
  }

  it('concurrent attaches to one card both succeed (no deadlock) and leave one attached Category', async () => {
    const { user, board, card } = await setupCard();
    const labels = await Promise.all(['A', 'B', 'C', 'D'].map(n => createLabel(user.token, board.id, n)));

    for (let round = 0; round < 5; round++) {
      const res = await Promise.all(labels.map(l => attach(user.token, card.id, l.id)));
      expect(res.map(r => r.status)).toEqual([200, 200, 200, 200]);
      expect(labels.map(l => l.id)).toContain(await categoryOf(user.token, board.id));
      await Promise.all(labels.map(l => detach(user.token, card.id, l.id)));
    }
  });

  it('PATCH setting an attached Category and detaching it concurrently never orphans the Category', async () => {
    const { user, board, card } = await setupCard();
    const a = await createLabel(user.token, board.id, 'A');
    const b = await createLabel(user.token, board.id, 'B');

    for (let round = 0; round < 5; round++) {
      await attach(user.token, card.id, a.id);
      await attach(user.token, card.id, b.id);
      await Promise.all([
        request(app).patch(`/cards/${card.id}`).set('Authorization', `Bearer ${user.token}`).send({ category_label_id: b.id }),
        detach(user.token, card.id, b.id),
      ]);
      expect(await categoryOf(user.token, board.id)).toBe(a.id);
      await detach(user.token, card.id, a.id);
    }
  });

  it('attaching the first label makes it the Category, in the response and the snapshot', async () => {
    const { user, board, card } = await setupCard();
    const bug = await createLabel(user.token, board.id, 'Bug');

    const res = await attach(user.token, card.id, bug.id);

    expect(res.status).toBe(200);
    expect(res.body.category_label_id).toBe(bug.id);
    expect(await categoryOf(user.token, board.id)).toBe(bug.id);
  });

  it('attaching another label keeps the existing Category', async () => {
    const { user, board, card } = await setupCard();
    const bug = await createLabel(user.token, board.id, 'Bug');
    const ui = await createLabel(user.token, board.id, 'UI', '#00ff00');
    await attach(user.token, card.id, bug.id);

    const res = await attach(user.token, card.id, ui.id);

    expect(res.body.category_label_id).toBe(bug.id);
    expect(await categoryOf(user.token, board.id)).toBe(bug.id);
  });

  it('detaching the Category promotes a remaining label', async () => {
    const { user, board, card } = await setupCard();
    const bug = await createLabel(user.token, board.id, 'Bug');
    const ui = await createLabel(user.token, board.id, 'UI', '#00ff00');
    await attach(user.token, card.id, bug.id);
    await attach(user.token, card.id, ui.id);

    const res = await detach(user.token, card.id, bug.id);

    expect(res.status).toBe(200);
    expect(res.body.category_label_id).toBe(ui.id);
    expect(await categoryOf(user.token, board.id)).toBe(ui.id);
  });

  it('detaching the last label clears the Category', async () => {
    const { user, board, card } = await setupCard();
    const bug = await createLabel(user.token, board.id, 'Bug');
    await attach(user.token, card.id, bug.id);

    const res = await detach(user.token, card.id, bug.id);

    expect(res.body.category_label_id).toBeNull();
    expect(await categoryOf(user.token, board.id)).toBeNull();
  });

  it('detaching a non-Category label keeps the Category', async () => {
    const { user, board, card } = await setupCard();
    const bug = await createLabel(user.token, board.id, 'Bug');
    const ui = await createLabel(user.token, board.id, 'UI', '#00ff00');
    await attach(user.token, card.id, bug.id);
    await attach(user.token, card.id, ui.id);

    const res = await detach(user.token, card.id, ui.id);

    expect(res.body.category_label_id).toBe(bug.id);
  });

  it('PATCH rejects a Category that is not attached to the card → 400', async () => {
    const { user, board, card } = await setupCard();
    const bug = await createLabel(user.token, board.id, 'Bug');

    const res = await request(app)
      .patch(`/cards/${card.id}`)
      .set('Authorization', `Bearer ${user.token}`)
      .send({ category_label_id: bug.id });

    expect(res.status).toBe(400);
    expect(await categoryOf(user.token, board.id)).toBeNull();
  });
});
