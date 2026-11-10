// #82: every route that returns an entity row returns the same shape —
// create, PATCH and the GET /boards/:id snapshot alike — driven by one row
// description per entity (db/entities.js).
import request from 'supertest';
import app from '../app.js';
import { createUser, clearDb } from '../test/helpers.js';
import * as entities from '../db/entities.js';

beforeAll(clearDb);
beforeEach(clearDb);

const keys = row => Object.keys(row).sort();
const expectShape = (row, entity) => expect(keys(row)).toEqual([...entity.returns].sort());

async function world() {
  const user = await createUser();
  const as = req => req.set('Authorization', `Bearer ${user.token}`);
  const board = await as(request(app).post('/boards')).send({ name: 'B' });
  const column = await as(request(app).post(`/boards/${board.body.id}/columns`)).send({ name: 'Col' });
  const card = await as(request(app).post(`/columns/${column.body.id}/cards`)).send({ title: 'Card' });
  const label = await as(request(app).post(`/boards/${board.body.id}/labels`)).send({ name: 'L', color: '#fca5a5' });
  const subtasks = await as(request(app).post(`/cards/${card.body.id}/subtasks/batch`)).send({ titles: ['S'] });
  return { as, board, column, card, label, subtasks };
}

describe('row shapes (#82)', () => {
  it('Board: create, PATCH and snapshot return the Board row', async () => {
    const { as, board } = await world();
    expectShape(board.body, entities.board);
    expectShape((await as(request(app).patch(`/boards/${board.body.id}`)).send({ name: 'B2' })).body, entities.board);
    const snap = (await as(request(app).get(`/boards/${board.body.id}`))).body;
    const { columns, labels, members, ...own } = snap;
    expectShape(own, entities.board);
  });

  it('Column: create, PATCH and snapshot return the Column row', async () => {
    const { as, board, column } = await world();
    expectShape(column.body, entities.column);
    expectShape((await as(request(app).patch(`/columns/${column.body.id}`)).send({ name: 'C2' })).body, entities.column);
    const { cards, ...snapCol } = (await as(request(app).get(`/boards/${board.body.id}`))).body.columns[0];
    expectShape(snapCol, entities.column);
  });

  it('Card: create (incl. category_label_id, completed_at), PATCH and snapshot return the Card row', async () => {
    const { as, board, card } = await world();
    expectShape(card.body, entities.card);
    expect(card.body.category_label_id).toBeNull();
    expect(card.body.completed_at).toBeNull();
    expectShape((await as(request(app).patch(`/cards/${card.body.id}`)).send({ title: 'K2' })).body, entities.card);
    const { label_ids, assignees, subtasks, ...snapCard } =
      (await as(request(app).get(`/boards/${board.body.id}`))).body.columns[0].cards[0];
    expectShape(snapCard, entities.card);
  });

  it('Label: create, PATCH and snapshot return the Label row', async () => {
    const { as, board, label } = await world();
    expectShape(label.body, entities.label);
    expectShape((await as(request(app).patch(`/labels/${label.body.id}`)).send({ name: 'L2' })).body, entities.label);
    expectShape((await as(request(app).get(`/boards/${board.body.id}`))).body.labels[0], entities.label);
  });

  it('Subtask: batch create, PATCH and snapshot return the Subtask row', async () => {
    const { as, board, subtasks } = await world();
    expectShape(subtasks.body[0], entities.subtask);
    expectShape((await as(request(app).patch(`/subtasks/${subtasks.body[0].id}`)).send({ checked: true })).body, entities.subtask);
    const snapSub = (await as(request(app).get(`/boards/${board.body.id}`))).body.columns[0].cards[0].subtasks[0];
    expectShape(snapSub, entities.subtask);
  });

  it('a name over the limit only by its surrounding spaces is accepted, trimmed', async () => {
    const { as, column } = await world();
    const res = await as(request(app).patch(`/columns/${column.body.id}`)).send({ name: ` ${'x'.repeat(100)} ` });
    expect(res.status).toBe(200);
    expect(res.body.name).toBe('x'.repeat(100));
  });

  it('a PATCH validates with the shared domain validators', async () => {
    const { as, card, column, label, subtasks } = await world();
    const bad = async (path, body) => (await as(request(app).patch(path)).send(body));
    let res = await bad(`/cards/${card.body.id}`, { title: '   ' });
    expect(res.status).toBe(400);
    expect(res.body.error).toBe('Card title is required');
    res = await bad(`/columns/${column.body.id}`, { name: 'x'.repeat(101) });
    expect(res.body.error).toBe('Column name must be 100 characters or fewer');
    res = await bad(`/labels/${label.body.id}`, { color: 'red' });
    expect(res.status).toBe(400);
    res = await bad(`/subtasks/${subtasks.body[0].id}`, { title: 42 });
    expect(res.body.error).toBe('Subtask title is required');
    res = await bad(`/cards/${card.body.id}`, {});
    expect(res.status).toBe(400);
  });
});
