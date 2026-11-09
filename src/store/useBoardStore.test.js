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

describe('label attach/detach carries the Category (ADR-0002, #55)', () => {
  function withLabels({ cardLabels = [], categoryLabelId = null } = {}) {
    const b = useBoardStore.getState().board;
    useBoardStore.setState({
      board: {
        ...b,
        cards: b.cards.map(c => ({ ...c, categoryLabelId })),
        labels: [{ id: 'l1', name: 'Bug', color: '#f00' }, { id: 'l2', name: 'UI', color: '#0f0' }],
        cardLabels,
      },
    });
  }
  const card = () => useBoardStore.getState().board.cards[0];

  test('attaching the first label sets it as the Category optimistically, then settles with the server', async () => {
    withLabels();
    let resolve;
    client.attachLabel.mockReturnValue(new Promise(r => { resolve = r; }));

    const pending = useBoardStore.getState().attachLabel('card1', 'l1', 'u1');
    expect(card().categoryLabelId).toBe('l1');
    expect(useBoardStore.getState().board.cardLabels).toEqual([{ cardId: 'card1', labelId: 'l1' }]);

    resolve({ cardId: 'card1', labelId: 'l1', categoryLabelId: 'l1' });
    await pending;
    expect(card().categoryLabelId).toBe('l1');
    expect(client.patchCard).not.toHaveBeenCalled();
  });

  test('settling an attach keeps a Category the user changed while it was in flight (★)', async () => {
    withLabels({ cardLabels: [{ cardId: 'card1', labelId: 'l2' }], categoryLabelId: 'l2' });
    let resolve;
    client.attachLabel.mockReturnValue(new Promise(r => { resolve = r; }));

    const pending = useBoardStore.getState().attachLabel('card1', 'l1', 'u1');
    const b = useBoardStore.getState().board;
    useBoardStore.setState({ board: { ...b, cards: b.cards.map(c => ({ ...c, categoryLabelId: 'l1' })) } });

    resolve({ cardId: 'card1', labelId: 'l1', categoryLabelId: 'l2' });
    await pending;
    expect(card().categoryLabelId).toBe('l1');
  });

  test('a failed attach rolls back both the label and the Category', async () => {
    withLabels();
    client.attachLabel.mockRejectedValue(new Error('boom'));

    await expect(useBoardStore.getState().attachLabel('card1', 'l1', 'u1')).rejects.toThrow('boom');

    expect(useBoardStore.getState().board.cardLabels).toEqual([]);
    expect(card().categoryLabelId).toBeNull();
  });

  test('detaching the Category promotes the next attached label in board label order', async () => {
    withLabels({
      cardLabels: [{ cardId: 'card1', labelId: 'l2' }, { cardId: 'card1', labelId: 'l1' }],
      categoryLabelId: 'l1',
    });
    let resolve;
    client.detachLabel.mockReturnValue(new Promise(r => { resolve = r; }));

    const pending = useBoardStore.getState().detachLabel('card1', 'l1', 'u1');
    expect(card().categoryLabelId).toBe('l2');

    resolve({ cardId: 'card1', labelId: 'l1', categoryLabelId: 'l2' });
    await pending;
    expect(card().categoryLabelId).toBe('l2');
  });

  test('a failed detach rolls back both the label and the Category', async () => {
    withLabels({ cardLabels: [{ cardId: 'card1', labelId: 'l1' }], categoryLabelId: 'l1' });
    client.detachLabel.mockRejectedValue(new Error('boom'));

    await expect(useBoardStore.getState().detachLabel('card1', 'l1', 'u1')).rejects.toThrow('boom');

    expect(useBoardStore.getState().board.cardLabels).toEqual([{ cardId: 'card1', labelId: 'l1' }]);
    expect(card().categoryLabelId).toBe('l1');
  });

  test('the server’s Category wins over the optimistic guess', async () => {
    withLabels({ cardLabels: [{ cardId: 'card1', labelId: 'l1' }], categoryLabelId: 'l1' });
    client.detachLabel.mockResolvedValue({ cardId: 'card1', labelId: 'l1', categoryLabelId: 'l2' });

    await useBoardStore.getState().detachLabel('card1', 'l1', 'u1');

    expect(card().categoryLabelId).toBe('l2');
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

  describe("drops the deleted Column's Card records too (#63)", () => {
    // c1 holds card1, c2 holds card2; each Card has a label, an assignee and a Subtask.
    beforeEach(() => {
      useBoardStore.setState({
        board: {
          ...makeBoard(),
          columns: [{ id: 'c1', name: 'Todo', position: 1 }, { id: 'c2', name: 'Done', position: 2 }],
          cards: [
            { id: 'card1', columnId: 'c1', title: 'One', position: 1 },
            { id: 'card2', columnId: 'c2', title: 'Two', position: 1 },
          ],
          cardLabels:    [{ cardId: 'card1', labelId: 'l1' }, { cardId: 'card2', labelId: 'l1' }],
          cardAssignees: [{ cardId: 'card1', userId: 'u1' }, { cardId: 'card2', userId: 'u1' }],
          subtasks: [
            { id: 's1', cardId: 'card1', title: 'A', checked: false, position: 1 },
            { id: 's2', cardId: 'card2', title: 'B', checked: false, position: 1 },
          ],
        },
      });
    });
    const cardIdsIn = key => useBoardStore.getState().board[key].map(r => r.cardId);

    test("removes the Column's Cards' labels, assignees and Subtasks; other Columns untouched", async () => {
      client.deleteColumn.mockResolvedValue(undefined);

      await useBoardStore.getState().deleteColumn('c1', 'u1');

      expect(useBoardStore.getState().board.cards.map(c => c.id)).toEqual(['card2']);
      expect(cardIdsIn('cardLabels')).toEqual(['card2']);
      expect(cardIdsIn('cardAssignees')).toEqual(['card2']);
      expect(cardIdsIn('subtasks')).toEqual(['card2']);
    });

    test('a failed delete restores Columns, Cards and their records together', async () => {
      client.deleteColumn.mockRejectedValue(new Error('nope'));

      await expect(useBoardStore.getState().deleteColumn('c1', 'u1')).rejects.toThrow('nope');

      expect(useBoardStore.getState().board.columns).toHaveLength(2);
      expect(useBoardStore.getState().board.cards).toHaveLength(2);
      expect(cardIdsIn('cardLabels')).toEqual(['card1', 'card2']);
      expect(cardIdsIn('cardAssignees')).toEqual(['card1', 'card2']);
      expect(cardIdsIn('subtasks')).toEqual(['card1', 'card2']);
    });
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

  test('rolls back and rethrows on failure', async () => {
    client.patchSubtask.mockRejectedValue(new Error('fail'));

    await expect(useBoardStore.getState().moveSubtaskDown('s1')).rejects.toThrow('fail');

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

describe('moveSubtask with done Subtasks hidden (PRD §12)', () => {
  // card1 real order: a(1) b(2, done) c(3, done) d(4)
  beforeEach(() => {
    useBoardStore.setState({
      board: {
        ...useBoardStore.getState().board,
        subtasks: [
          { id: 'a', cardId: 'card1', title: 'a', checked: false, position: 1 },
          { id: 'b', cardId: 'card1', title: 'b', checked: true,  position: 2 },
          { id: 'c', cardId: 'card1', title: 'c', checked: true,  position: 3 },
          { id: 'd', cardId: 'card1', title: 'd', checked: false, position: 4 },
        ],
      },
    });
    client.patchSubtask.mockImplementation((id, patch) => Promise.resolve({ id, cardId: 'card1', title: id, checked: false, ...patch }));
  });
  const pos = id => useBoardStore.getState().board.subtasks.find(s => s.id === id).position;

  test('↑ lands before the visible neighbour, past the hidden ones; hidden positions untouched', async () => {
    await useBoardStore.getState().moveSubtaskUp('d', { hideDone: true });

    expect(pos('d')).toBeLessThan(1); // above a
    expect(pos('b')).toBe(2);
    expect(pos('c')).toBe(3);
    expect(client.patchSubtask).toHaveBeenCalledTimes(1);
  });

  test('↓ lands between the visible neighbour and the next item in real order', async () => {
    await useBoardStore.getState().moveSubtaskDown('a', { hideDone: true });

    expect(pos('a')).toBeGreaterThan(4); // after d, nothing follows
    expect(pos('b')).toBe(2);
    expect(pos('c')).toBe(3);
  });

  test('revealed mode swaps with the true neighbour', async () => {
    await useBoardStore.getState().moveSubtaskUp('d', { hideDone: false });

    expect(pos('d')).toBeGreaterThan(2);
    expect(pos('d')).toBeLessThan(3); // between b and c
  });

  test('rolls back and rethrows on failure', async () => {
    client.patchSubtask.mockRejectedValue(new Error('fail'));

    await expect(useBoardStore.getState().moveSubtaskUp('d', { hideDone: true })).rejects.toThrow('fail');

    expect(pos('d')).toBe(4);
  });
});

describe('createSubtasks (the one way to add Subtasks: PRD §12, #67)', () => {
  const card1Subtasks = () => useBoardStore.getState().board.subtasks
    .filter(s => s.cardId === 'card1')
    .sort((a, b) => a.position - b.position);

  test('shows the whole batch at once, after the existing subtasks, then settles to server rows', async () => {
    let resolve;
    client.createSubtasks.mockReturnValue(new Promise(r => { resolve = r; }));

    const pending = useBoardStore.getState().createSubtasks('card1', ['D', 'E']);

    expect(card1Subtasks().map(s => s.title)).toEqual(['A', 'B', 'C', 'D', 'E']);
    expect(client.createSubtasks).toHaveBeenCalledWith('card1', ['D', 'E']);

    resolve([
      { id: 'real-d', cardId: 'card1', title: 'D', checked: false, position: 4 },
      { id: 'real-e', cardId: 'card1', title: 'E', checked: false, position: 5 },
    ]);
    await pending;

    expect(card1Subtasks().map(s => s.id)).toEqual(['s1', 's2', 's3', 'real-d', 'real-e']);
  });

  test('a failed batch rolls back every placeholder and rethrows', async () => {
    client.createSubtasks.mockRejectedValue(new Error('maximum 50 subtasks per card'));

    await expect(useBoardStore.getState().createSubtasks('card1', ['D', 'E', 'F']))
      .rejects.toThrow('maximum 50 subtasks per card');

    expect(card1Subtasks().map(s => s.id)).toEqual(['s1', 's2', 's3']);
    expect(useBoardStore.getState().error).toBe('maximum 50 subtasks per card');
  });

  test('a single typed title is a batch of one, placed last', async () => {
    client.createSubtasks.mockResolvedValue([{ id: 'real-d', cardId: 'card1', title: 'D', checked: false, position: 4 }]);

    await useBoardStore.getState().createSubtasks('card1', ['D']);

    expect(client.createSubtasks).toHaveBeenCalledWith('card1', ['D']);
    expect(card1Subtasks().map(s => s.id)).toEqual(['s1', 's2', 's3', 'real-d']);
  });
});

describe('toggleSubtask', () => {
  test('rolls back and rethrows on failure', async () => {
    client.patchSubtask.mockRejectedValue(new Error('x'));

    await expect(useBoardStore.getState().toggleSubtask('s1')).rejects.toThrow('x');

    expect(useBoardStore.getState().board.subtasks.find(s => s.id === 's1').checked).toBe(false);
    expect(useBoardStore.getState().error).toBe('x');
  });
});

describe('deleteSubtask', () => {
  test('rolls back and rethrows on failure', async () => {
    client.deleteSubtask.mockRejectedValue(new Error('gone'));

    await expect(useBoardStore.getState().deleteSubtask('s1')).rejects.toThrow('gone');

    expect(useBoardStore.getState().board.subtasks.map(s => s.id)).toContain('s1');
    expect(useBoardStore.getState().error).toBe('gone');
  });
});

describe('removeMember', () => {
  test('removes member optimistically', async () => {
    client.removeMember.mockResolvedValue(undefined);

    await useBoardStore.getState().removeMember('b1', 'u1', { memberId: 'u2' });

    expect(useBoardStore.getState().board.members.map(m => m.userId)).toEqual(['u1']);
  });
});

describe('card deleted by another member (404)', () => {
  const notFound = () => Object.assign(new Error('card not found'), { status: 404 });

  beforeEach(() => {
    useBoardStore.setState({
      board: {
        ...makeBoard(),
        labels: [{ id: 'l1', name: 'Bug', color: '#f00' }],
        cardLabels: [{ cardId: 'card1', labelId: 'l1' }],
        cardAssignees: [{ cardId: 'card1', userId: 'u2' }],
      },
    });
  });

  test('moveCard removes the card and its labels, assignees, and subtasks, then rethrows', async () => {
    client.moveCard.mockRejectedValue(notFound());

    await expect(useBoardStore.getState().moveCard('card1', 'u1', { columnId: 'c1', position: 5 }))
      .rejects.toThrow('card not found');

    const b = useBoardStore.getState().board;
    expect(b.cards).toEqual([]);
    expect(b.cardLabels).toEqual([]);
    expect(b.cardAssignees).toEqual([]);
    expect(b.subtasks).toEqual([]);
    expect(b.labels).toHaveLength(1); // board-level labels are untouched
  });

  test('moveCard still rolls back on other errors', async () => {
    client.moveCard.mockRejectedValue(Object.assign(new Error('boom'), { status: 500 }));

    await expect(useBoardStore.getState().moveCard('card1', 'u1', { columnId: 'c1', position: 5 }))
      .rejects.toThrow('boom');

    expect(useBoardStore.getState().board.cards).toEqual([
      { id: 'card1', columnId: 'c1', title: 'Old', position: 1 },
    ]);
  });

  test('deleteCard keeps the card gone on 404 instead of restoring it', async () => {
    client.deleteCard.mockRejectedValue(notFound());

    await expect(useBoardStore.getState().deleteCard('card1', 'u1')).rejects.toThrow('card not found');

    const b = useBoardStore.getState().board;
    expect(b.cards).toEqual([]);
    expect(b.cardLabels).toEqual([]);
    expect(b.subtasks).toEqual([]);
  });

  test('deleteCard still restores the card on other errors', async () => {
    client.deleteCard.mockRejectedValue(Object.assign(new Error('boom'), { status: 500 }));

    await expect(useBoardStore.getState().deleteCard('card1', 'u1')).rejects.toThrow('boom');

    expect(useBoardStore.getState().board.cards.map(c => c.id)).toEqual(['card1']);
    expect(useBoardStore.getState().board.cardLabels).toHaveLength(1);
  });

  test('patchCard removes the card on 404', async () => {
    client.patchCard.mockRejectedValue(notFound());

    await expect(useBoardStore.getState().patchCard('card1', 'u1', { title: 'New' }))
      .rejects.toThrow('card not found');

    expect(useBoardStore.getState().board.cards).toEqual([]);
  });
});
