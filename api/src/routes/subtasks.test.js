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
  const cardRes = await request(app)
    .post(`/columns/${colRes.body.id}/cards`)
    .set('Authorization', `Bearer ${user.token}`)
    .send({ title: 'Task 1' });
  return { user, board: boardRes.body, column: colRes.body, card: cardRes.body };
}

describe('POST /cards/:id/subtasks', () => {
  it('happy path → 201 with subtask object', async () => {
    const { user, card } = await setup();

    const res = await request(app)
      .post(`/cards/${card.id}/subtasks`)
      .set('Authorization', `Bearer ${user.token}`)
      .send({ title: 'Write unit tests' });

    expect(res.status).toBe(201);
    expect(res.body.id).toBeTruthy();
    expect(res.body.card_id).toBe(card.id);
    expect(res.body.title).toBe('Write unit tests');
    expect(res.body.checked).toBe(false);
    expect(res.body.position).toBeGreaterThan(0);
  });

  it('empty title → 400', async () => {
    const { user, card } = await setup();
    const res = await request(app)
      .post(`/cards/${card.id}/subtasks`)
      .set('Authorization', `Bearer ${user.token}`)
      .send({ title: '' });
    expect(res.status).toBe(400);
  });

  it('title longer than 100 chars → 400', async () => {
    const { user, card } = await setup();
    const res = await request(app)
      .post(`/cards/${card.id}/subtasks`)
      .set('Authorization', `Bearer ${user.token}`)
      .send({ title: 'a'.repeat(101) });
    expect(res.status).toBe(400);
  });

  it('non-member → 403', async () => {
    const { card } = await setup();
    const stranger = await createUser({ email: 'stranger@example.com' });
    const res = await request(app)
      .post(`/cards/${card.id}/subtasks`)
      .set('Authorization', `Bearer ${stranger.token}`)
      .send({ title: 'Sneaky subtask' });
    expect(res.status).toBe(403);
  });

  it('non-existent card → 404', async () => {
    const { user } = await setup();
    const res = await request(app)
      .post('/cards/00000000-0000-0000-0000-000000000000/subtasks')
      .set('Authorization', `Bearer ${user.token}`)
      .send({ title: 'Ghost subtask' });
    expect(res.status).toBe(404);
  });

  it('21st subtask → 400', async () => {
    const { user, card } = await setup();
    for (let i = 0; i < 20; i++) {
      await request(app)
        .post(`/cards/${card.id}/subtasks`)
        .set('Authorization', `Bearer ${user.token}`)
        .send({ title: `Step ${i + 1}` });
    }
    const res = await request(app)
      .post(`/cards/${card.id}/subtasks`)
      .set('Authorization', `Bearer ${user.token}`)
      .send({ title: 'One too many' });
    expect(res.status).toBe(400);
  });
});

describe('PATCH /subtasks/:id', () => {
  async function createSubtask(token, cardId, title = 'Step') {
    const res = await request(app)
      .post(`/cards/${cardId}/subtasks`)
      .set('Authorization', `Bearer ${token}`)
      .send({ title });
    if (res.status !== 201) throw new Error(`createSubtask failed: ${res.status}`);
    return res.body;
  }

  it('updates title → 200 with new title', async () => {
    const { user, card } = await setup();
    const sub = await createSubtask(user.token, card.id, 'Old title');

    const res = await request(app)
      .patch(`/subtasks/${sub.id}`)
      .set('Authorization', `Bearer ${user.token}`)
      .send({ title: 'New title' });

    expect(res.status).toBe(200);
    expect(res.body.title).toBe('New title');
  });

  it('empty title → 400', async () => {
    const { user, card } = await setup();
    const sub = await createSubtask(user.token, card.id, 'Step');

    const res = await request(app)
      .patch(`/subtasks/${sub.id}`)
      .set('Authorization', `Bearer ${user.token}`)
      .send({ title: '' });

    expect(res.status).toBe(400);
  });

  it('title longer than 100 chars → 400', async () => {
    const { user, card } = await setup();
    const sub = await createSubtask(user.token, card.id, 'Step');

    const res = await request(app)
      .patch(`/subtasks/${sub.id}`)
      .set('Authorization', `Bearer ${user.token}`)
      .send({ title: 'a'.repeat(101) });

    expect(res.status).toBe(400);
  });

  it('checked: true → 200 with checked true', async () => {
    const { user, card } = await setup();
    const sub = await createSubtask(user.token, card.id, 'Step');

    const res = await request(app)
      .patch(`/subtasks/${sub.id}`)
      .set('Authorization', `Bearer ${user.token}`)
      .send({ checked: true });

    expect(res.status).toBe(200);
    expect(res.body.checked).toBe(true);
  });

  it('checked: false → 200 toggles back', async () => {
    const { user, card } = await setup();
    const sub = await createSubtask(user.token, card.id, 'Step');
    await request(app)
      .patch(`/subtasks/${sub.id}`)
      .set('Authorization', `Bearer ${user.token}`)
      .send({ checked: true });

    const res = await request(app)
      .patch(`/subtasks/${sub.id}`)
      .set('Authorization', `Bearer ${user.token}`)
      .send({ checked: false });

    expect(res.status).toBe(200);
    expect(res.body.checked).toBe(false);
  });

  it('updates position → 200 with updated subtask', async () => {
    const { user, card } = await setup();
    const s1 = await createSubtask(user.token, card.id, 'First');
    const s2 = await createSubtask(user.token, card.id, 'Second');

    const res = await request(app)
      .patch(`/subtasks/${s2.id}`)
      .set('Authorization', `Bearer ${user.token}`)
      .send({ position: 0.5 });

    expect(res.status).toBe(200);
    expect(res.body.id).toBe(s2.id);
    expect(res.body.position).toBe(0.5);
  });

  it('non-member → 403', async () => {
    const { user, card } = await setup();
    const sub = await createSubtask(user.token, card.id, 'Step');
    const stranger = await createUser({ email: 'stranger2@example.com' });

    const res = await request(app)
      .patch(`/subtasks/${sub.id}`)
      .set('Authorization', `Bearer ${stranger.token}`)
      .send({ position: 0.5 });

    expect(res.status).toBe(403);
  });

  it('non-existent subtask → 404', async () => {
    const { user } = await setup();
    const res = await request(app)
      .patch('/subtasks/00000000-0000-0000-0000-000000000000')
      .set('Authorization', `Bearer ${user.token}`)
      .send({ position: 0.5 });

    expect(res.status).toBe(404);
  });
});

describe('DELETE /subtasks/:id', () => {
  async function createSubtask(token, cardId, title = 'Step') {
    const res = await request(app)
      .post(`/cards/${cardId}/subtasks`)
      .set('Authorization', `Bearer ${token}`)
      .send({ title });
    if (res.status !== 201) throw new Error(`createSubtask failed: ${res.status}`);
    return res.body;
  }

  it('happy path → 204', async () => {
    const { user, card } = await setup();
    const sub = await createSubtask(user.token, card.id, 'Step');

    const res = await request(app)
      .delete(`/subtasks/${sub.id}`)
      .set('Authorization', `Bearer ${user.token}`);

    expect(res.status).toBe(204);
  });

  it('non-member → 403', async () => {
    const { user, card } = await setup();
    const sub = await createSubtask(user.token, card.id, 'Step');
    const stranger = await createUser({ email: 'stranger3@example.com' });

    const res = await request(app)
      .delete(`/subtasks/${sub.id}`)
      .set('Authorization', `Bearer ${stranger.token}`);

    expect(res.status).toBe(403);
  });

  it('non-existent → 404', async () => {
    const { user } = await setup();
    const res = await request(app)
      .delete('/subtasks/00000000-0000-0000-0000-000000000000')
      .set('Authorization', `Bearer ${user.token}`);

    expect(res.status).toBe(404);
  });
});

describe('GET /boards/:id — snapshot includes subtasks', () => {
  it('card in snapshot has subtasks array', async () => {
    const { user, board, card } = await setup();
    await request(app)
      .post(`/cards/${card.id}/subtasks`)
      .set('Authorization', `Bearer ${user.token}`)
      .send({ title: 'Subtask A' });

    const res = await request(app)
      .get(`/boards/${board.id}`)
      .set('Authorization', `Bearer ${user.token}`);

    expect(res.status).toBe(200);
    const cards = res.body.columns.flatMap(col => col.cards);
    const found = cards.find(c => c.id === card.id);
    expect(found).toBeTruthy();
    expect(Array.isArray(found.subtasks)).toBe(true);
    expect(found.subtasks).toHaveLength(1);
    expect(found.subtasks[0].title).toBe('Subtask A');
    expect(found.subtasks[0].checked).toBe(false);
  });

  it('card with no subtasks has empty subtasks array', async () => {
    const { user, board, card } = await setup();

    const res = await request(app)
      .get(`/boards/${board.id}`)
      .set('Authorization', `Bearer ${user.token}`);

    const cards = res.body.columns.flatMap(col => col.cards);
    const found = cards.find(c => c.id === card.id);
    expect(found.subtasks).toEqual([]);
  });
});
