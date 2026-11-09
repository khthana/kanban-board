import request from 'supertest';
import app from '../app.js';
import pool from '../db/pool.js';
import { createUser, clearDb } from '../test/helpers.js';

// The 404/403 matrix for every route that reaches a board through a Card,
// Subtask, Column or Label id (#65): unknown or malformed id → 404, a non-member
// → 403 even when the body is invalid (membership is checked before the body).

beforeAll(clearDb);
beforeEach(clearDb);

const MISSING = '00000000-0000-4000-8000-000000000000';

async function setup() {
  const owner = await createUser();
  const stranger = await createUser({ email: 'mallory@example.com', displayName: 'Mallory' });
  const auth = u => ({ Authorization: `Bearer ${u.token}` });
  const board = (await request(app).post('/boards').set(auth(owner)).send({ name: 'B' })).body;
  const column = (await request(app).post(`/boards/${board.id}/columns`).set(auth(owner)).send({ name: 'C' })).body;
  const card = (await request(app).post(`/columns/${column.id}/cards`).set(auth(owner)).send({ title: 'T' })).body;
  const label = (await request(app).post(`/boards/${board.id}/labels`).set(auth(owner)).send({ name: 'L', color: '#f00' })).body;
  const [subtask] = (await request(app).post(`/cards/${card.id}/subtasks/batch`).set(auth(owner)).send({ titles: ['S'] })).body;
  return { owner, stranger, auth, ids: { card: card.id, column: column.id, label: label.id, subtask: subtask.id } };
}

// [name, id the route resolves access through, method, path(ids), invalid body]
const ROUTES = [
  ['PATCH card',         'card', 'patch',  i => `/cards/${i.card}`,                  { title: '' }],
  ['DELETE card',        'card', 'delete', i => `/cards/${i.card}`,                  undefined],
  ['PUT card label',     'card', 'put',    i => `/cards/${i.card}/labels/${i.label}`, undefined],
  ['DELETE card label',  'card', 'delete', i => `/cards/${i.card}/labels/${i.label}`, undefined],
  ['PUT assignee',       'card', 'put',    i => `/cards/${i.card}/assignees/${MISSING}`, undefined],
  ['DELETE assignee',    'card', 'delete', i => `/cards/${i.card}/assignees/${MISSING}`, undefined],
  ['POST subtask batch', 'card', 'post',   i => `/cards/${i.card}/subtasks/batch`,    { titles: 'nope' }],
  ['PATCH subtask',      'subtask', 'patch',  i => `/subtasks/${i.subtask}`,             {}],
  ['DELETE subtask',     'subtask', 'delete', i => `/subtasks/${i.subtask}`,             undefined],
  ['PATCH column',       'column', 'patch',  i => `/columns/${i.column}`,               {}],
  ['POST column card',   'column', 'post',   i => `/columns/${i.column}/cards`,         { title: '' }],
  ['DELETE column',      'column', 'delete', i => `/columns/${i.column}`,               undefined],
  ['PATCH label',        'label', 'patch',  i => `/labels/${i.label}`,                 { name: '' }],
  ['DELETE label',       'label', 'delete', i => `/labels/${i.label}`,                 undefined],
];

describe.each(ROUTES)('%s', (_name, key, method, path, invalidBody) => {
  const pathWith = (ids, replacement) => path({ ...ids, [key]: replacement });

  it('non-member → 403, even with an invalid body', async () => {
    const { stranger, auth, ids } = await setup();
    const res = await request(app)[method](path(ids)).set(auth(stranger)).send(invalidBody ?? {});
    expect(res.status).toBe(403);
  });

  it('unknown id → 404', async () => {
    const { owner, auth, ids } = await setup();
    const res = await request(app)[method](pathWith(ids, MISSING)).set(auth(owner)).send(invalidBody ?? {});
    expect(res.status).toBe(404);
  });

  it('malformed id → 404, not a 500', async () => {
    const { owner, auth, ids } = await setup();
    const res = await request(app)[method](pathWith(ids, 'not-a-uuid')).set(auth(owner)).send(invalidBody ?? {});
    expect(res.status).toBe(404);
  });
});

// The 403 the ticket mentions came from a race (Subtask found, then its Card
// deleted before the membership query); one access query closes it. This pins
// the observable answer once the Card is gone.
describe('a Subtask whose Card is gone', () => {
  it('PATCH and DELETE → 404', async () => {
    const { owner, auth, ids } = await setup();
    await pool.query('DELETE FROM cards WHERE id = $1', [ids.card]);

    const patch = await request(app).patch(`/subtasks/${ids.subtask}`).set(auth(owner)).send({ checked: true });
    expect(patch.status).toBe(404);
    const del = await request(app).delete(`/subtasks/${ids.subtask}`).set(auth(owner));
    expect(del.status).toBe(404);
  });
});
