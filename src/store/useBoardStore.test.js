import useBoardStore from './useBoardStore';
import * as client from '../api/client';

jest.mock('../api/client');

function makeBoard() {
  return {
    board: { id: 'b1', name: 'Board' },
    columns: [{ id: 'c1', name: 'Todo', position: 1 }],
    cards: [{ id: 'card1', columnId: 'c1', title: 'Old', position: 1 }],
    labels: [],
    members: [{ userId: 'u1', role: 'owner', user: {} }, { userId: 'u2', role: 'member', user: {} }],
    cardLabels: [],
    cardAssignees: [],
    subtasks: [
      { id: 's1', cardId: 'card1', title: 'A', checked: false, position: 1 },
      { id: 's2', cardId: 'card1', title: 'B', checked: false, position: 2 },
      { id: 's3', cardId: 'card1', title: 'C', checked: false, position: 3 },
    ],
  };
}

beforeEach(() => {
  jest.clearAllMocks();
  useBoardStore.setState({ boards: [], board: makeBoard(), loading: false, error: null });
});

describe('patchLabel', () => {
  function withLabel() {
    useBoardStore.setState({
      board: {
        ...useBoardStore.getState().board,
        labels: [{ id: 'l1', boardId: 'b1', name: 'Old', color: '#fca5a5' }],
      },
    });
  }

  test('updates the label optimistically and settles with the server record', async () => {
    withLabel();
    client.patchLabel.mockResolvedValue({ id: 'l1', name: 'New', color: '#93c5fd' });

    await useBoardStore.getState().patchLabel('l1', 'u1', { name: 'New', color: '#93c5fd' });

    expect(useBoardStore.getState().board.labels[0]).toMatchObject({ name: 'New', color: '#93c5fd' });
    expect(client.patchLabel).toHaveBeenCalledWith('l1', 'u1', { name: 'New', color: '#93c5fd' });
  });

  test('rolls back on API failure', async () => {
    withLabel();
    client.patchLabel.mockRejectedValue(new Error('boom'));

    await expect(useBoardStore.getState().patchLabel('l1', 'u1', { name: 'New' })).rejects.toThrow('boom');

    expect(useBoardStore.getState().board.labels[0].name).toBe('Old');
  });
});

describe('attachAssignee', () => {
  test('adds the assignee optimistically and commits', async () => {
    client.attachAssignee.mockResolvedValue({ card_id: 'card1', user_id: 'u2' });

    await useBoardStore.getState().attachAssignee('card1', 'u2');

    expect(useBoardStore.getState().board.cardAssignees).toContainEqual({ cardId: 'card1', userId: 'u2' });
    expect(client.attachAssignee).toHaveBeenCalledWith('card1', 'u2');
  });

  test('rolls back on API failure', async () => {
    client.attachAssignee.mockRejectedValue(new Error('boom'));

    await expect(useBoardStore.getState().attachAssignee('card1', 'u2')).rejects.toThrow('boom');

    expect(useBoardStore.getState().board.cardAssignees).toEqual([]);
  });
});

describe('detachAssignee', () => {
  test('removes the assignee optimistically', async () => {
    useBoardStore.setState({
      board: { ...useBoardStore.getState().board, cardAssignees: [{ cardId: 'card1', userId: 'u2' }] },
    });
    client.detachAssignee.mockResolvedValue(null);

    await useBoardStore.getState().detachAssignee('card1', 'u2');

    expect(useBoardStore.getState().board.cardAssignees).toEqual([]);
    expect(client.detachAssignee).toHaveBeenCalledWith('card1', 'u2');
  });
});

describe('patchCard', () => {
  test('applies optimistically then settles with server record', async () => {
    client.patchCard.mockResolvedValue({ id: 'card1', columnId: 'c1', title: 'Server', position: 1 });

    const result = await useBoardStore.getState().patchCard('card1', 'u1', { title: 'New' });

    expect(result).toMatchObject({ title: 'Server' });
    expect(useBoardStore.getState().board.cards[0].title).toBe('Server');
    expect(useBoardStore.getState().error).toBeNull();
  });

  test('rolls back and rethrows on API failure', async () => {
    client.patchCard.mockRejectedValue(new Error('boom'));

    await expect(useBoardStore.getState().patchCard('card1', 'u1', { title: 'New' }))
      .rejects.toThrow('boom');

    expect(useBoardStore.getState().board.cards[0].title).toBe('Old');
    expect(useBoardStore.getState().error).toBe('boom');
  });
});

describe('card completion', () => {
  test('marking done applies completedAt optimistically and settles with the server card', async () => {
    client.patchCard.mockResolvedValue({ id: 'card1', columnId: 'c1', title: 'Old', position: 1, completedAt: '2026-06-15' });

    await useBoardStore.getState().patchCard('card1', 'u1', { completedAt: '2026-06-15' });

    expect(useBoardStore.getState().board.cards[0].completedAt).toBe('2026-06-15');
    expect(client.patchCard).toHaveBeenCalledWith('card1', 'u1', { completedAt: '2026-06-15' });
  });

  test('a newly created card starts not completed', async () => {
    client.createCard.mockResolvedValue({ id: 'real', columnId: 'c1', title: 'X', position: 2, completedAt: null });

    await useBoardStore.getState().createCard('c1', 'u1', { title: 'X' });

    const created = useBoardStore.getState().board.cards.find(c => c.id === 'real');
    expect(created.completedAt).toBeNull();
  });
});

describe('deleteColumn', () => {
  test('removes column and its cards, rolls back on failure', async () => {
    client.deleteColumn.mockRejectedValue(new Error('nope'));

    await expect(useBoardStore.getState().deleteColumn('c1', 'u1')).rejects.toThrow('nope');

    expect(useBoardStore.getState().board.columns).toHaveLength(1);
    expect(useBoardStore.getState().board.cards).toHaveLength(1);
  });
});

describe('createCard', () => {
  test('replaces the temp placeholder with the server card', async () => {
    client.createCard.mockResolvedValue({ id: 'real', columnId: 'c1', title: 'X', position: 2 });

    await useBoardStore.getState().createCard('c1', 'u1', { title: 'X' });

    const ids = useBoardStore.getState().board.cards.map(c => c.id);
    expect(ids).toContain('real');
    expect(ids.some(id => id !== 'card1' && id !== 'real')).toBe(false);
  });
});

describe('moveSubtask', () => {
  test('moveSubtaskDown puts a position between its new neighbours', async () => {
    client.patchSubtask.mockImplementation((id, patch) => Promise.resolve({ ...patch, id, cardId: 'card1', title: 'A', checked: false }));

    await useBoardStore.getState().moveSubtaskDown('s1');

    const s1 = useBoardStore.getState().board.subtasks.find(s => s.id === 's1');
    expect(s1.position).toBeGreaterThan(2);
    expect(s1.position).toBeLessThan(3);
  });

  test('does NOT rethrow on failure (fire-and-forget), but rolls back', async () => {
    client.patchSubtask.mockRejectedValue(new Error('fail'));

    await expect(useBoardStore.getState().moveSubtaskDown('s1')).resolves.toBeUndefined();

    expect(useBoardStore.getState().board.subtasks.find(s => s.id === 's1').position).toBe(1);
    expect(useBoardStore.getState().error).toBe('fail');
  });

  test('is a no-op at the boundary (first item cannot move up)', async () => {
    await useBoardStore.getState().moveSubtaskUp('s1');
    expect(client.patchSubtask).not.toHaveBeenCalled();
  });

  test('reorders within the subtask’s own card, ignoring other cards’ subtasks', async () => {
    // A second card whose subtask positions overlap card1's (1, 2). The global
    // list interleaves them; neighbours for s1 must come from card1 only.
    useBoardStore.setState({
      board: {
        ...useBoardStore.getState().board,
        subtasks: [
          { id: 's1', cardId: 'card1', title: 'A', checked: false, position: 1 },
          { id: 's2', cardId: 'card1', title: 'B', checked: false, position: 2 },
          { id: 's3', cardId: 'card1', title: 'C', checked: false, position: 3 },
          { id: 'o1', cardId: 'card2', title: 'X', checked: false, position: 1 },
          { id: 'o2', cardId: 'card2', title: 'Y', checked: false, position: 2 },
        ],
      },
    });
    client.patchSubtask.mockImplementation((id, patch) => Promise.resolve({ ...patch, id, cardId: 'card1', title: 'A', checked: false }));

    await useBoardStore.getState().moveSubtaskDown('s1');

    // Must land between card1's s2 (2) and s3 (3) — NOT next to card2's subtasks.
    const s1 = useBoardStore.getState().board.subtasks.find(s => s.id === 's1');
    expect(s1.position).toBeGreaterThan(2);
    expect(s1.position).toBeLessThan(3);
  });
});

describe('toggleSubtask', () => {
  test('flips checked and does not rethrow on failure', async () => {
    client.patchSubtask.mockRejectedValue(new Error('x'));

    await expect(useBoardStore.getState().toggleSubtask('s1')).resolves.toBeUndefined();

    expect(useBoardStore.getState().board.subtasks.find(s => s.id === 's1').checked).toBe(false);
    expect(useBoardStore.getState().error).toBe('x');
  });
});

describe('removeMember', () => {
  test('removes member optimistically', async () => {
    client.removeMember.mockResolvedValue(undefined);

    await useBoardStore.getState().removeMember('b1', 'u1', { memberId: 'u2' });

    expect(useBoardStore.getState().board.members.map(m => m.userId)).toEqual(['u1']);
  });
});
