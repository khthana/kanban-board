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

// #66 — move and rebalance commit together, and concurrent moves serialise on
// the scope, so positions always end up strictly ordered.
const MIN_GAP = 1e-9;
const strictlyOrdered = positions =>
  positions.every((p, i) => i === 0 || p - positions[i - 1] >= MIN_GAP);

async function cardPositions(token, boardId, columnId) {
  const snap = await request(app).get(`/boards/${boardId}`).set('Authorization', `Bearer ${token}`);
  return snap.body.columns.find(c => c.id === columnId).cards
    .slice().sort((a, b) => a.position - b.position);
}

describe('reposition (#66)', () => {
  it('a move that triggers a rebalance keeps the moved order, strictly spaced', async () => {
    const { user, board, column } = await setup();
    const a = await createCard(user.token, column.id, 'A');
    const b = await createCard(user.token, column.id, 'B');
    const c = await createCard(user.token, column.id, 'C');

    // C squeezed in just after A → A, C, B
    const res = await request(app).patch(`/cards/${c.id}`)
      .set('Authorization', `Bearer ${user.token}`).send({ position: 1.0 + 5e-10 });
    expect(res.status).toBe(200);

    const cards = await cardPositions(user.token, board.id, column.id);
    expect(cards.map(x => x.id)).toEqual([a.id, c.id, b.id]);
    expect(strictlyOrdered(cards.map(x => x.position))).toBe(true);
  });

  it('concurrent card moves into the same gap end up strictly ordered', async () => {
    const { user, board, column } = await setup();
    await createCard(user.token, column.id, 'A');   // 1
    await createCard(user.token, column.id, 'B');   // 2
    const movers = [];
    for (let i = 0; i < 6; i++) movers.push(await createCard(user.token, column.id, `M${i}`));

    // every mover lands on the same proposed position between A and B
    const results = await Promise.all(movers.map(m =>
      request(app).patch(`/cards/${m.id}`).set('Authorization', `Bearer ${user.token}`).send({ position: 1.5 })));
    expect(results.map(r => r.status)).toEqual(movers.map(() => 200));

    const positions = (await cardPositions(user.token, board.id, column.id)).map(x => x.position);
    expect(positions).toHaveLength(8);
    expect(strictlyOrdered(positions)).toBe(true);
  });

  it('concurrent column moves into the same gap end up strictly ordered', async () => {
    const { user, board } = await setup();   // column at 1
    const auth = { Authorization: `Bearer ${user.token}` };
    await request(app).post(`/boards/${board.id}/columns`).set(auth).send({ name: 'Two' });  // 2
    const movers = [];
    for (let i = 0; i < 6; i++) {
      movers.push((await request(app).post(`/boards/${board.id}/columns`).set(auth).send({ name: `M${i}` })).body);
    }

    const results = await Promise.all(movers.map(m =>
      request(app).patch(`/columns/${m.id}`).set(auth).send({ position: 1.5 })));
    expect(results.map(r => r.status)).toEqual(movers.map(() => 200));

    const snap = await request(app).get(`/boards/${board.id}`).set(auth);
    const positions = snap.body.columns.map(c => c.position).sort((x, y) => x - y);
    expect(positions).toHaveLength(8);
    expect(strictlyOrdered(positions)).toBe(true);
  });
});

describe('reposition — cross-column moves (#66)', () => {
  it('concurrent swaps between two crowded columns neither deadlock nor misplace cards', async () => {
    const { user, board, column: colC } = await setup();
    const auth = { Authorization: `Bearer ${user.token}` };
    const colD = (await request(app).post(`/boards/${board.id}/columns`).set(auth).send({ name: 'D' })).body;
    const inC = [], inD = [];
    for (let i = 0; i < 4; i++) {
      inC.push(await createCard(user.token, colC.id, `C${i}`));
      inD.push(await createCard(user.token, colD.id, `D${i}`));
    }

    // every C card moves to D and every D card to C, all landing on 1.5 → each move rebalances
    const moves = [
      ...inC.map(c => ({ id: c.id, column_id: colD.id })),
      ...inD.map(c => ({ id: c.id, column_id: colC.id })),
    ];
    const results = await Promise.all(moves.map(m =>
      request(app).patch(`/cards/${m.id}`).set(auth).send({ column_id: m.column_id, position: 1.5 })));
    expect(results.map(r => r.status)).toEqual(moves.map(() => 200));

    const snap = await request(app).get(`/boards/${board.id}`).set(auth);
    const col = id => snap.body.columns.find(c => c.id === id).cards;
    expect(col(colC.id).map(c => c.id).sort()).toEqual(inD.map(c => c.id).sort());
    expect(col(colD.id).map(c => c.id).sort()).toEqual(inC.map(c => c.id).sort());
    for (const id of [colC.id, colD.id]) {
      expect(strictlyOrdered(col(id).map(c => c.position).sort((a, b) => a - b))).toBe(true);
    }
  });

  it('a move with an unattached Category is rejected and changes no positions', async () => {
    const { user, board, column } = await setup();
    const auth = { Authorization: `Bearer ${user.token}` };
    const a = await createCard(user.token, column.id, 'A');
    const b = await createCard(user.token, column.id, 'B');
    const label = (await request(app).post(`/boards/${board.id}/labels`).set(auth).send({ name: 'L', color: '#f00' })).body;

    const res = await request(app).patch(`/cards/${b.id}`).set(auth)
      .send({ position: 1.0 + 5e-10, category_label_id: label.id });
    expect(res.status).toBe(400);

    const cards = await cardPositions(user.token, board.id, column.id);
    expect(cards.map(c => [c.id, c.position])).toEqual([[a.id, 1], [b.id, 2]]);
  });
});
