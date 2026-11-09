import request from 'supertest';
import app from '../app.js';
import pool from '../db/pool.js';
import { createUser, clearDb } from '../test/helpers.js';

// Client-chosen ids (#71, decision 3 of #69): the four creates of the open
// board accept an optional id, so an optimistic placeholder's id is already the
// real one. Malformed → 400, taken → 409, nothing inserted; omitted → the
// server picks one, as before.

beforeAll(clearDb);
beforeEach(clearDb);

const ID_A = '11111111-1111-4111-8111-111111111111';
const ID_B = '22222222-2222-4222-8222-222222222222';

async function setup() {
  const owner = await createUser();
  const stranger = await createUser({ email: 'mallory@example.com', displayName: 'Mallory' });
  const auth = u => ({ Authorization: `Bearer ${u.token}` });
  const board = (await request(app).post('/boards').set(auth(owner)).send({ name: 'B' })).body;
  const column = (await request(app).post(`/boards/${board.id}/columns`).set(auth(owner)).send({ name: 'C' })).body;
  const card = (await request(app).post(`/columns/${column.id}/cards`).set(auth(owner)).send({ title: 'T' })).body;
  return { owner, stranger, auth, ids: { board: board.id, column: column.id, card: card.id } };
}

const count = async (table, id) =>
  parseInt((await pool.query(`SELECT COUNT(*) AS n FROM ${table} WHERE id = $1`, [id])).rows[0].n, 10);

// [name, table, path(ids), body(id), the created row in the response]
const CREATES = [
  ['POST column',         'columns',  i => `/boards/${i.board}/columns`,       id => ({ name: 'New', id }),            b => b],
  ['POST card',           'cards',    i => `/columns/${i.column}/cards`,       id => ({ title: 'New', id }),           b => b],
  ['POST label',          'labels',   i => `/boards/${i.board}/labels`,        id => ({ name: 'L', color: '#f00', id }), b => b],
  ['POST subtask batch',  'subtasks', i => `/cards/${i.card}/subtasks/batch`,  id => ({ titles: ['S'], ids: [id] }), b => b[0]],
];

describe.each(CREATES)('%s — client-chosen id', (_name, table, path, body, created) => {
  it('creates the record with the supplied id and returns it', async () => {
    const { owner, auth, ids } = await setup();
    const res = await request(app).post(path(ids)).set(auth(owner)).send(body(ID_A));
    expect(res.status).toBe(201);
    expect(created(res.body).id).toBe(ID_A);
    expect(await count(table, ID_A)).toBe(1);
  });

  it('malformed id → 400, nothing inserted', async () => {
    const { owner, auth, ids } = await setup();
    for (const bad of ['nope', 42, null, '11111111-1111-4111-8111-11111111111']) {
      const before = (await pool.query(`SELECT COUNT(*) AS n FROM ${table}`)).rows[0].n;
      const res = await request(app).post(path(ids)).set(auth(owner)).send(body(bad));
      expect(res.status).toBe(400);
      expect((await pool.query(`SELECT COUNT(*) AS n FROM ${table}`)).rows[0].n).toBe(before);
    }
  });

  it('an id that is already taken → 409, nothing inserted', async () => {
    const { owner, auth, ids } = await setup();
    await request(app).post(path(ids)).set(auth(owner)).send(body(ID_A));
    const res = await request(app).post(path(ids)).set(auth(owner)).send(body(ID_A));
    expect(res.status).toBe(409);
    expect(await count(table, ID_A)).toBe(1);
  });

  it('membership is checked before the id: a stranger with a malformed id → 403', async () => {
    const { stranger, auth, ids } = await setup();
    const res = await request(app).post(path(ids)).set(auth(stranger)).send(body('nope'));
    expect(res.status).toBe(403);
  });
});

describe('POST subtask batch — ids[]', () => {
  const post = (ctx, payload) =>
    request(app).post(`/cards/${ctx.ids.card}/subtasks/batch`).set(ctx.auth(ctx.owner)).send(payload);

  it('each title gets the id at the same index, in order', async () => {
    const ctx = await setup();
    const res = await post(ctx, { titles: ['a', 'b'], ids: [ID_A, ID_B] });
    expect(res.status).toBe(201);
    expect(res.body.map(s => [s.title, s.id])).toEqual([['a', ID_A], ['b', ID_B]]);
  });

  it('ids of the wrong length, not an array, or with a non-string → 400', async () => {
    const ctx = await setup();
    for (const ids of [[ID_A], [ID_A, ID_B, ID_A], ID_A, [ID_A, null]]) {
      const res = await post(ctx, { titles: ['a', 'b'], ids });
      expect(res.status).toBe(400);
    }
    expect(await count('subtasks', ID_A)).toBe(0);
  });

  it('one taken id → 409 and none of the batch is added', async () => {
    const ctx = await setup();
    await post(ctx, { titles: ['first'], ids: [ID_B] });
    const res = await post(ctx, { titles: ['a', 'b'], ids: [ID_A, ID_B] });
    expect(res.status).toBe(409);
    expect(await count('subtasks', ID_A)).toBe(0);
  });

  it('the same id twice in one batch → 409, nothing added', async () => {
    const ctx = await setup();
    const res = await post(ctx, { titles: ['a', 'b'], ids: [ID_A, ID_A] });
    expect(res.status).toBe(409);
    expect(await count('subtasks', ID_A)).toBe(0);
  });
});

// #75: a new Board's id can be chosen by the client too, so the /boards list's
// placeholder is the real Board and a link clicked early points at it.
describe('POST /boards — client-chosen id', () => {
  const post = (user, body) =>
    request(app).post('/boards').set({ Authorization: `Bearer ${user.token}` }).send(body);

  it('creates the Board (and its owner membership) with the supplied id', async () => {
    const owner = await createUser();
    const res = await post(owner, { name: 'B', id: ID_A });
    expect(res.status).toBe(201);
    expect(res.body.id).toBe(ID_A);
    expect(await count('boards', ID_A)).toBe(1);
    const open = await request(app).get(`/boards/${ID_A}`).set({ Authorization: `Bearer ${owner.token}` });
    expect(open.status).toBe(200);
  });

  it('omitted → the server picks the id', async () => {
    const owner = await createUser();
    const res = await post(owner, { name: 'B' });
    expect(res.status).toBe(201);
    expect(await count('boards', res.body.id)).toBe(1);
  });

  it('malformed id → 400, nothing inserted', async () => {
    const owner = await createUser();
    for (const bad of ['nope', 42, null, '11111111-1111-4111-8111-11111111111']) {
      const res = await post(owner, { name: 'B', id: bad });
      expect(res.status).toBe(400);
    }
    expect((await pool.query('SELECT COUNT(*) AS n FROM boards')).rows[0].n).toBe('0');
  });

  it('an id that is already taken → 409, nothing inserted', async () => {
    const owner = await createUser();
    const other = await createUser({ email: 'mallory@example.com', displayName: 'Mallory' });
    await post(owner, { name: 'B', id: ID_A });
    const res = await post(other, { name: 'Mine', id: ID_A });
    expect(res.status).toBe(409);
    expect((await pool.query('SELECT COUNT(*) AS n FROM boards')).rows[0].n).toBe('1');
    expect((await pool.query('SELECT COUNT(*) AS n FROM board_members WHERE board_id = $1', [ID_A])).rows[0].n).toBe('1');
  });
});
