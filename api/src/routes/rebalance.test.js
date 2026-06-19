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

async function createCard(token, columnId, title = 'Task') {
  const res = await request(app)
    .post(`/columns/${columnId}/cards`)
    .set('Authorization', `Bearer ${token}`)
    .send({ title });
  if (res.status !== 201) throw new Error(`createCard failed: ${res.status}`);
  return res.body;
}

describe('card position rebalancing', () => {
  it('PATCH card with near-zero gap position → snapshot positions are evenly spaced', async () => {
    const { user, board, column } = await setup();
    const cardA = await createCard(user.token, column.id, 'A');  // position 1.0
    const cardB = await createCard(user.token, column.id, 'B');  // position 2.0

    // move B just above A — gap = 5e-10 < MIN_GAP (1e-9) → triggers rebalance
    await request(app)
      .patch(`/cards/${cardB.id}`)
      .set('Authorization', `Bearer ${user.token}`)
      .send({ position: 1.0 + 5e-10 });

    const snapshot = await request(app)
      .get(`/boards/${board.id}`)
      .set('Authorization', `Bearer ${user.token}`);

    const cards = snapshot.body.columns[0].cards;
    expect(cards).toHaveLength(2);
    const positions = cards.map(c => c.position).sort((a, b) => a - b);
    expect(positions[1] - positions[0]).toBeGreaterThanOrEqual(1e-9);
  });

  it('rebalance is idempotent — second near-zero PATCH yields same evenly-spaced result', async () => {
    const { user, board, column } = await setup();
    const cardA = await createCard(user.token, column.id, 'A');
    const cardB = await createCard(user.token, column.id, 'B');

    // first compact
    await request(app)
      .patch(`/cards/${cardB.id}`)
      .set('Authorization', `Bearer ${user.token}`)
      .send({ position: 1.0 + 5e-10 });

    // second compact — after rebalance positions are 1.0 and 2.0, so no gap issue;
    // compact again to force another rebalance cycle
    await request(app)
      .patch(`/cards/${cardB.id}`)
      .set('Authorization', `Bearer ${user.token}`)
      .send({ position: 1.0 + 5e-10 });

    const snapshot = await request(app)
      .get(`/boards/${board.id}`)
      .set('Authorization', `Bearer ${user.token}`);

    const positions = snapshot.body.columns[0].cards
      .map(c => c.position).sort((a, b) => a - b);
    expect(positions[1] - positions[0]).toBeGreaterThanOrEqual(1e-9);
  });

  it('rebalance is scoped to the touched column — other column cards unchanged', async () => {
    const { user, board, column } = await setup();
    // column 1: two cards that will be compacted
    const cardA = await createCard(user.token, column.id, 'A');
    const cardB = await createCard(user.token, column.id, 'B');

    // column 2: one card at known position
    const col2Res = await request(app)
      .post(`/boards/${board.id}/columns`)
      .set('Authorization', `Bearer ${user.token}`)
      .send({ name: 'Done' });
    const col2 = col2Res.body;
    const cardC = await createCard(user.token, col2.id, 'C');  // position 1.0

    // trigger rebalance in column 1
    await request(app)
      .patch(`/cards/${cardB.id}`)
      .set('Authorization', `Bearer ${user.token}`)
      .send({ position: 1.0 + 5e-10 });

    const snapshot = await request(app)
      .get(`/boards/${board.id}`)
      .set('Authorization', `Bearer ${user.token}`);

    const col2Snapshot = snapshot.body.columns.find(c => c.id === col2.id);
    expect(col2Snapshot.cards[0].id).toBe(cardC.id);
    expect(col2Snapshot.cards[0].position).toBe(1.0);
  });
});

describe('column position rebalancing', () => {
  it('PATCH column with near-zero gap position → board column positions are evenly spaced', async () => {
    const { user, board, column } = await setup();
    // create a second column — positions now 1.0, 2.0
    const col2Res = await request(app)
      .post(`/boards/${board.id}/columns`)
      .set('Authorization', `Bearer ${user.token}`)
      .send({ name: 'In Progress' });
    const col2 = col2Res.body;

    // move col2 just above col1 — gap = 5e-10 < MIN_GAP → triggers rebalance
    await request(app)
      .patch(`/columns/${col2.id}`)
      .set('Authorization', `Bearer ${user.token}`)
      .send({ position: 1.0 + 5e-10 });

    const snapshot = await request(app)
      .get(`/boards/${board.id}`)
      .set('Authorization', `Bearer ${user.token}`);

    const colPositions = snapshot.body.columns.map(c => c.position).sort((a, b) => a - b);
    expect(colPositions).toHaveLength(2);
    expect(colPositions[1] - colPositions[0]).toBeGreaterThanOrEqual(1e-9);
  });
});
