import * as client from './client';
import * as auth from './auth';

jest.mock('./auth');

const hasSnakeKey = obj => Object.keys(obj).some(k => k.includes('_'));

beforeEach(() => jest.clearAllMocks());

describe('entity responses are normalized to camelCase', () => {
  test('createBoard', async () => {
    auth.apiFetch.mockResolvedValue({ id: 'b1', name: 'B', owner_id: 'u1', created_at: '2026-09-30T00:00:00Z' });

    const board = await client.createBoard('u1', { name: 'B' });

    expect(board).toEqual({ id: 'b1', name: 'B', ownerId: 'u1', createdAt: '2026-09-30T00:00:00Z' });
  });

  test('getBoards and patchBoard share the board shape', async () => {
    const raw = { id: 'b1', name: 'B', owner_id: 'u1', created_at: '2026-09-30T00:00:00Z' };
    auth.apiFetch.mockResolvedValueOnce([raw]).mockResolvedValueOnce(raw);

    const [listed] = await client.getBoards();
    const patched = await client.patchBoard('b1', 'u1', { name: 'B' });

    expect(patched).toEqual(listed);
    expect(hasSnakeKey(listed)).toBe(false);
  });

  test('createColumn and patchColumn', async () => {
    const raw = { id: 'c1', board_id: 'b1', name: 'Todo', position: 1, color: null };
    auth.apiFetch.mockResolvedValue(raw);

    const expected = { id: 'c1', boardId: 'b1', name: 'Todo', position: 1, color: null };
    expect(await client.createColumn('b1', 'u1', { name: 'Todo' })).toEqual(expected);
    expect(await client.patchColumn('c1', 'u1', { name: 'Todo' })).toEqual(expected);
  });

  test('createLabel and patchLabel', async () => {
    const raw = { id: 'l1', board_id: 'b1', name: 'Bug', color: '#fca5a5' };
    auth.apiFetch.mockResolvedValue(raw);

    const expected = { id: 'l1', boardId: 'b1', name: 'Bug', color: '#fca5a5' };
    expect(await client.createLabel('b1', 'u1', { name: 'Bug', color: '#fca5a5' })).toEqual(expected);
    expect(await client.patchLabel('l1', 'u1', { name: 'Bug' })).toEqual(expected);
  });

  test('attachLabel and attachAssignee return the store join shape', async () => {
    auth.apiFetch.mockResolvedValueOnce({ card_id: 'k1', label_id: 'l1' })
      .mockResolvedValueOnce({ card_id: 'k1', user_id: 'u2' });

    expect(await client.attachLabel('k1', 'l1', 'u1')).toEqual({ cardId: 'k1', labelId: 'l1' });
    expect(await client.attachAssignee('k1', 'u2')).toEqual({ cardId: 'k1', userId: 'u2' });
  });
});

describe('auth calls', () => {
  test('login and register return the API body without storing tokens', async () => {
    auth.apiFetch.mockResolvedValue({ token: 't', refreshToken: 'r' });

    expect(await client.login('a@b.c', 'pw')).toEqual({ token: 't', refreshToken: 'r' });
    expect(await client.register('a@b.c', 'pw', 'A')).toEqual({ token: 't', refreshToken: 'r' });

    expect(auth.setToken).not.toHaveBeenCalled();
    expect(auth.setRefreshToken).not.toHaveBeenCalled();
  });
});
