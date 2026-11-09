import useBoardStore from './useBoardStore';
import * as client from '../api/client';
import { init } from '../domain/pendingOps';

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

// Opens a board the way the app does: fetchBoard on a mocked snapshot.
async function openBoard({ board }) {
  client.getBoard.mockResolvedValueOnce(board);
  await useBoardStore.getState().fetchBoard(board.board.id);
}

// A client call that stays pending until the test settles it.
function held() {
  let resolve, reject;
  const promise = new Promise((res, rej) => { resolve = res; reject = rej; });
  return { promise, resolve, reject };
}
// The /boards list as the server last sent it (a pending-ops list, #78).
const listBoards = boards => useBoardStore.setState({ listOps: init(boards), boards });
const flush = () => new Promise(r => setTimeout(r, 0));
const board = () => useBoardStore.getState().board;

beforeEach(async () => {
  jest.clearAllMocks();
  useBoardStore.setState({ listOps: init([]), boards: [], ops: null, board: null, loading: false, error: null, failedCreate: null });
  await openBoard({ board: makeBoard() });
});

describe('patchLabel', () => {
  async function withLabel() {
    await openBoard({
      board: {
        ...useBoardStore.getState().board,
        labels: [{ id: 'l1', boardId: 'b1', name: 'Old', color: '#fca5a5' }],
      },
    });
  }

  test('updates the label optimistically and settles with the server record', async () => {
    await withLabel();
    client.patchLabel.mockResolvedValue({ id: 'l1', name: 'New', color: '#93c5fd' });

    await useBoardStore.getState().patchLabel('l1', { name: 'New', color: '#93c5fd' });

    expect(useBoardStore.getState().board.labels[0]).toMatchObject({ name: 'New', color: '#93c5fd' });
    expect(client.patchLabel).toHaveBeenCalledWith('l1', { name: 'New', color: '#93c5fd' });
  });

  test('rolls back on API failure', async () => {
    await withLabel();
    client.patchLabel.mockRejectedValue(new Error('boom'));

    await expect(useBoardStore.getState().patchLabel('l1', { name: 'New' })).rejects.toThrow('boom');

    expect(useBoardStore.getState().board.labels[0].name).toBe('Old');
  });
});

describe('label attach/detach carries the Category (ADR-0002, #55)', () => {
  async function withLabels({ cardLabels = [], categoryLabelId = null } = {}) {
    const b = useBoardStore.getState().board;
    await openBoard({
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
    await withLabels();
    let resolve;
    client.attachLabel.mockReturnValue(new Promise(r => { resolve = r; }));

    const pending = useBoardStore.getState().attachLabel('card1', 'l1');
    expect(card().categoryLabelId).toBe('l1');
    expect(useBoardStore.getState().board.cardLabels).toEqual([{ cardId: 'card1', labelId: 'l1' }]);

    resolve({ cardId: 'card1', labelId: 'l1', categoryLabelId: 'l1' });
    await pending;
    expect(card().categoryLabelId).toBe('l1');
    expect(client.patchCard).not.toHaveBeenCalled();
  });

  test('a ★ pressed while an attach is in flight waits for it, then wins', async () => {
    await withLabels({ cardLabels: [{ cardId: 'card1', labelId: 'l2' }], categoryLabelId: 'l2' });
    const attach = held();
    client.attachLabel.mockReturnValue(attach.promise);
    client.patchCard.mockImplementation((id, patch) => Promise.resolve({ ...card(), ...patch }));

    const attaching = useBoardStore.getState().attachLabel('card1', 'l1');
    const starring = useBoardStore.getState().patchCard('card1', { categoryLabelId: 'l1' });
    expect(card().categoryLabelId).toBe('l1');
    expect(client.patchCard).not.toHaveBeenCalled();     // queued behind the attach

    attach.resolve({ cardId: 'card1', labelId: 'l1', categoryLabelId: 'l2' });
    await attaching;
    await starring;

    expect(client.patchCard).toHaveBeenCalledWith('card1', { categoryLabelId: 'l1' });
    expect(card().categoryLabelId).toBe('l1');
  });

  test('a failed attach rolls back both the label and the Category', async () => {
    await withLabels();
    client.attachLabel.mockRejectedValue(new Error('boom'));

    await expect(useBoardStore.getState().attachLabel('card1', 'l1')).rejects.toThrow('boom');

    expect(useBoardStore.getState().board.cardLabels).toEqual([]);
    expect(card().categoryLabelId).toBeNull();
  });

  test('detaching the Category promotes the next attached label in board label order', async () => {
    await withLabels({
      cardLabels: [{ cardId: 'card1', labelId: 'l2' }, { cardId: 'card1', labelId: 'l1' }],
      categoryLabelId: 'l1',
    });
    let resolve;
    client.detachLabel.mockReturnValue(new Promise(r => { resolve = r; }));

    const pending = useBoardStore.getState().detachLabel('card1', 'l1');
    expect(card().categoryLabelId).toBe('l2');

    resolve({ cardId: 'card1', labelId: 'l1', categoryLabelId: 'l2' });
    await pending;
    expect(card().categoryLabelId).toBe('l2');
  });

  test('a failed detach rolls back both the label and the Category', async () => {
    await withLabels({ cardLabels: [{ cardId: 'card1', labelId: 'l1' }], categoryLabelId: 'l1' });
    client.detachLabel.mockRejectedValue(new Error('boom'));

    await expect(useBoardStore.getState().detachLabel('card1', 'l1')).rejects.toThrow('boom');

    expect(useBoardStore.getState().board.cardLabels).toEqual([{ cardId: 'card1', labelId: 'l1' }]);
    expect(card().categoryLabelId).toBe('l1');
  });

  test('the server’s Category wins over the optimistic guess', async () => {
    await withLabels({ cardLabels: [{ cardId: 'card1', labelId: 'l1' }], categoryLabelId: 'l1' });
    client.detachLabel.mockResolvedValue({ cardId: 'card1', labelId: 'l1', categoryLabelId: 'l2' });

    await useBoardStore.getState().detachLabel('card1', 'l1');

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
    await openBoard({
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

    const result = await useBoardStore.getState().patchCard('card1', { title: 'New' });

    expect(result).toMatchObject({ title: 'Server' });
    expect(useBoardStore.getState().board.cards[0].title).toBe('Server');
    expect(useBoardStore.getState().error).toBeNull();
  });

  test('rolls back and rethrows on API failure', async () => {
    client.patchCard.mockRejectedValue(new Error('boom'));

    await expect(useBoardStore.getState().patchCard('card1', { title: 'New' }))
      .rejects.toThrow('boom');

    expect(useBoardStore.getState().board.cards[0].title).toBe('Old');
    expect(useBoardStore.getState().error).toBe('boom');
  });
});

describe('card completion', () => {
  test('marking done applies completedAt optimistically and settles with the server card', async () => {
    client.patchCard.mockResolvedValue({ id: 'card1', columnId: 'c1', title: 'Old', position: 1, completedAt: '2026-06-15' });

    await useBoardStore.getState().patchCard('card1', { completedAt: '2026-06-15' });

    expect(useBoardStore.getState().board.cards[0].completedAt).toBe('2026-06-15');
    expect(client.patchCard).toHaveBeenCalledWith('card1', { completedAt: '2026-06-15' });
  });

  test('a newly created card starts not completed', async () => {
    client.createCard.mockResolvedValue({ id: 'real', columnId: 'c1', title: 'X', position: 2, completedAt: null });

    await useBoardStore.getState().createCard('c1', { title: 'X' });

    const created = useBoardStore.getState().board.cards.find(c => c.id === 'real');
    expect(created.completedAt).toBeNull();
  });
});

describe('deleteColumn', () => {
  test('removes column and its cards, rolls back on failure', async () => {
    client.deleteColumn.mockRejectedValue(new Error('nope'));

    await expect(useBoardStore.getState().deleteColumn('c1')).rejects.toThrow('nope');

    expect(useBoardStore.getState().board.columns).toHaveLength(1);
    expect(useBoardStore.getState().board.cards).toHaveLength(1);
  });

  describe("drops the deleted Column's Card records too (#63)", () => {
    // c1 holds card1, c2 holds card2; each Card has a label, an assignee and a Subtask.
    beforeEach(async () => {
      await openBoard({
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

      await useBoardStore.getState().deleteColumn('c1');

      expect(useBoardStore.getState().board.cards.map(c => c.id)).toEqual(['card2']);
      expect(cardIdsIn('cardLabels')).toEqual(['card2']);
      expect(cardIdsIn('cardAssignees')).toEqual(['card2']);
      expect(cardIdsIn('subtasks')).toEqual(['card2']);
    });

    test('a failed delete restores Columns, Cards and their records together', async () => {
      client.deleteColumn.mockRejectedValue(new Error('nope'));

      await expect(useBoardStore.getState().deleteColumn('c1')).rejects.toThrow('nope');

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

    await useBoardStore.getState().createCard('c1', { title: 'X' });

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
    await openBoard({
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
  beforeEach(async () => {
    await openBoard({
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
    expect(client.createSubtasks).toHaveBeenCalledWith('card1', ['D', 'E'], expect.any(Array));

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

    expect(client.createSubtasks).toHaveBeenCalledWith('card1', ['D'], expect.any(Array));
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

    await useBoardStore.getState().removeMember('b1', { memberId: 'u2' });

    expect(useBoardStore.getState().board.members.map(m => m.userId)).toEqual(['u1']);
  });
});

describe('card deleted by another member (404)', () => {
  const notFound = () => Object.assign(new Error('card not found'), { status: 404 });

  beforeEach(async () => {
    await openBoard({
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

    await expect(useBoardStore.getState().moveCard('card1', { columnId: 'c1', position: 5 }))
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

    await expect(useBoardStore.getState().moveCard('card1', { columnId: 'c1', position: 5 }))
      .rejects.toThrow('boom');

    expect(useBoardStore.getState().board.cards).toEqual([
      { id: 'card1', columnId: 'c1', title: 'Old', position: 1 },
    ]);
  });

  test('deleteCard keeps the card gone on 404 instead of restoring it', async () => {
    client.deleteCard.mockRejectedValue(notFound());

    await expect(useBoardStore.getState().deleteCard('card1')).rejects.toThrow('card not found');

    const b = useBoardStore.getState().board;
    expect(b.cards).toEqual([]);
    expect(b.cardLabels).toEqual([]);
    expect(b.subtasks).toEqual([]);
  });

  test('deleteCard still restores the card on other errors', async () => {
    client.deleteCard.mockRejectedValue(Object.assign(new Error('boom'), { status: 500 }));

    await expect(useBoardStore.getState().deleteCard('card1')).rejects.toThrow('boom');

    expect(useBoardStore.getState().board.cards.map(c => c.id)).toEqual(['card1']);
    expect(useBoardStore.getState().board.cardLabels).toHaveLength(1);
  });

  test('patchCard removes the card on 404', async () => {
    client.patchCard.mockRejectedValue(notFound());

    await expect(useBoardStore.getState().patchCard('card1', { title: 'New' }))
      .rejects.toThrow('card not found');

    expect(useBoardStore.getState().board.cards).toEqual([]);
  });
});

describe('pending-ops board (#73)', () => {
  test('when A fails while B is in flight, only A rolls back', async () => {
    const a = held(), b = held();
    client.patchCard.mockReturnValueOnce(a.promise);
    client.patchColumn.mockReturnValueOnce(b.promise);

    const pa = useBoardStore.getState().patchCard('card1', { title: 'A!' });
    const pb = useBoardStore.getState().renameColumn('c1', { name: 'B!' });
    a.reject(new Error('boom'));
    await expect(pa).rejects.toThrow('boom');

    expect(board().cards[0].title).toBe('Old');
    expect(board().columns[0].name).toBe('B!');

    b.resolve({ id: 'c1', name: 'B!', position: 1 });
    await pb;
    expect(board().columns[0].name).toBe('B!');
  });

  test('a poll arriving while a create is in flight does not drop the new item', async () => {
    const create = held();
    client.createCard.mockReturnValueOnce(create.promise);

    const pending = useBoardStore.getState().createCard('c1', { title: 'New' });
    client.getBoard.mockResolvedValueOnce(makeBoard());          // the poll predates the card
    await useBoardStore.getState().pollBoard('b1');

    expect(board().cards.map(c => c.title)).toEqual(['Old', 'New']);

    const [, data] = client.createCard.mock.calls[0];
    create.resolve({ ...data, columnId: 'c1' });
    await pending;
    expect(board().cards.map(c => c.title)).toEqual(['Old', 'New']);
  });

  test('a poll that already holds the new item (same id) shows it once', async () => {
    const create = held();
    client.createCard.mockReturnValueOnce(create.promise);

    useBoardStore.getState().createCard('c1', { title: 'New' });
    const [, { id }] = client.createCard.mock.calls[0];
    client.getBoard.mockResolvedValueOnce({ ...makeBoard(), cards: [...makeBoard().cards, { id, columnId: 'c1', title: 'New', position: 2 }] });
    await useBoardStore.getState().pollBoard('b1');

    expect(board().cards.map(c => c.id)).toEqual(['card1', id]);
  });

  test('a rollback after a poll does not restore pre-poll data', async () => {
    const patch = held();
    client.patchCard.mockReturnValueOnce(patch.promise);

    const pending = useBoardStore.getState().patchCard('card1', { title: 'Mine' });
    client.getBoard.mockResolvedValueOnce({ ...makeBoard(), columns: [{ id: 'c1', name: 'Renamed elsewhere', position: 1 }] });
    await useBoardStore.getState().pollBoard('b1');
    patch.reject(new Error('boom'));
    await expect(pending).rejects.toThrow('boom');

    expect(board().columns[0].name).toBe('Renamed elsewhere');
    expect(board().cards[0].title).toBe('Old');
  });

  test('a poll sent before a commit landed is ignored', async () => {
    const poll = held();
    client.getBoard.mockReturnValueOnce(poll.promise);
    client.patchCard.mockImplementation((id, p) => Promise.resolve({ id, columnId: 'c1', position: 1, ...p }));

    const polling = useBoardStore.getState().pollBoard('b1');
    await useBoardStore.getState().patchCard('card1', { title: 'Saved' });
    poll.resolve(makeBoard());                                    // still says 'Old'
    await polling;

    expect(board().cards[0].title).toBe('Saved');
  });

  test('a Card added to a Column whose create is pending waits for it, then posts with the Column id', async () => {
    const col = held();
    client.createColumn.mockReturnValueOnce(col.promise);
    client.createCard.mockImplementation((columnId, data) => Promise.resolve({ ...data, columnId }));

    const creatingColumn = useBoardStore.getState().createColumn('b1', { name: 'New col' });
    const [, { id: columnId }] = client.createColumn.mock.calls[0];
    const creatingCard = useBoardStore.getState().createCard(columnId, { title: 'In it' });

    await flush();
    expect(client.createCard).not.toHaveBeenCalled();
    expect(board().cards.map(c => c.title)).toEqual(['Old', 'In it']);

    col.resolve({ id: columnId, boardId: 'b1', name: 'New col', position: 2 });
    await creatingColumn;
    await creatingCard;

    expect(client.createCard).toHaveBeenCalledWith(columnId, expect.objectContaining({ title: 'In it' }));
    expect(board().cards.find(c => c.title === 'In it').columnId).toBe(columnId);
  });

  test('a failed Column create fails the Card waiting on it, which is never posted', async () => {
    client.createColumn.mockRejectedValueOnce(new Error('nope'));

    const creatingColumn = useBoardStore.getState().createColumn('b1', { name: 'New col' });
    const [, { id: columnId }] = client.createColumn.mock.calls[0];
    const creatingCard = useBoardStore.getState().createCard(columnId, { title: 'In it' });

    await expect(creatingColumn).rejects.toThrow('nope');
    await expect(creatingCard).rejects.toThrow('nope');
    expect(client.createCard).not.toHaveBeenCalled();
    expect(board().columns.map(c => c.id)).toEqual(['c1']);
    expect(board().cards.map(c => c.id)).toEqual(['card1']);
  });

  test('new records carry a client-chosen id that is sent to the API', async () => {
    client.createLabel.mockImplementation((boardId, data) => Promise.resolve({ ...data, boardId }));

    await useBoardStore.getState().createLabel('b1', { name: 'Bug', color: '#f00' });

    const [, sent] = client.createLabel.mock.calls[0];
    expect(sent.id).toMatch(/^[0-9a-f-]{36}$/);
    expect(board().labels.map(l => l.id)).toEqual([sent.id]);
  });

  test('addMember polls the board after the invite succeeds', async () => {
    client.addMember.mockResolvedValue(undefined);
    client.getBoard.mockResolvedValueOnce({ ...makeBoard(), members: [...makeBoard().members, { userId: 'u3', role: 'member', user: {} }] });

    await useBoardStore.getState().addMember('b1', { email: 'c@x.com' });

    expect(board().members.map(m => m.userId)).toEqual(['u1', 'u2', 'u3']);
  });
});

describe('pending-ops board — edges (#73 review)', () => {
  test('an op waiting on a failed create is rejected without the create’s status', async () => {
    client.createCard.mockRejectedValueOnce(Object.assign(new Error('column not found'), { status: 404 }));

    const creating = useBoardStore.getState().createCard('c1', { title: 'New' });
    const [, { id }] = client.createCard.mock.calls[0];
    const patching = useBoardStore.getState().patchCard(id, { title: 'Renamed' });

    await expect(creating).rejects.toMatchObject({ status: 404 });
    const err = await patching.catch(e => e);
    expect(err.message).toBe('column not found');
    expect(err.status).toBeUndefined();
  });

  test('reopening the same board keeps its pending ops', async () => {
    const patch = held();
    client.patchCard.mockReturnValueOnce(patch.promise);

    useBoardStore.getState().patchCard('card1', { title: 'Mine' });
    await openBoard({ board: makeBoard() });

    expect(board().cards[0].title).toBe('Mine');
  });

  test('opening another board rejects the old board’s queued ops and keeps the new board clean', async () => {
    const first = held();
    client.patchCard.mockReturnValueOnce(first.promise);

    const inFlight = useBoardStore.getState().patchCard('card1', { title: 'One' });
    const queued = useBoardStore.getState().patchCard('card1', { title: 'Two' });
    await openBoard({ board: { ...makeBoard(), board: { id: 'b2', name: 'Other' } } });

    await expect(queued).rejects.toThrow('The board was closed.');
    first.reject(new Error('late failure'));
    await expect(inFlight).rejects.toThrow('late failure');
    expect(useBoardStore.getState().error).toBeNull();
    expect(board().board.id).toBe('b2');
  });

  test('addMember resolves when the invite succeeds even if the follow-up poll fails', async () => {
    client.addMember.mockResolvedValue(undefined);
    client.getBoard.mockRejectedValueOnce(new Error('offline'));

    await expect(useBoardStore.getState().addMember('b1', { email: 'c@x.com' })).resolves.toBeUndefined();
  });

  test('deleting a label clears it as the Category of the cards that had it', async () => {
    await openBoard({ board: {
      ...makeBoard(),
      cards: [{ id: 'card1', columnId: 'c1', title: 'Old', position: 1, categoryLabelId: 'l1' }],
      labels: [{ id: 'l1', name: 'Bug', color: '#f00' }],
      cardLabels: [{ cardId: 'card1', labelId: 'l1' }],
    } });
    client.deleteLabel.mockResolvedValue(undefined);

    await useBoardStore.getState().deleteLabel('l1');

    expect(board().cards[0].categoryLabelId).toBeNull();
  });
});

// #75: a new Board's placeholder carries a client-chosen id, so it is the real
// Board; opening (or renaming/deleting) it while its POST is in flight waits
// for the create instead of hitting the server with an id it doesn't know yet.
describe('createBoard with a client-chosen id (#75)', () => {
  const snapshot = id => ({ ...makeBoard(), board: { id, name: 'New' } });
  beforeEach(() => client.getBoard.mockClear());   // the outer beforeEach opened b1

  it('sends the placeholder id and keeps it once the server answers', async () => {
    client.createBoard.mockImplementation(async ({ name, id }) => ({ id, name, ownerId: 'u1' }));
    const created = await useBoardStore.getState().createBoard('u1', { name: 'New' });
    const [[sent]] = client.createBoard.mock.calls;
    expect(sent.id).toMatch(/^[0-9a-f-]{36}$/);
    expect(created.id).toBe(sent.id);
    expect(useBoardStore.getState().boards.map(b => b.id)).toEqual([sent.id]);
  });

  it('opening the Board while its POST is in flight waits for the create', async () => {
    const post = held();
    client.createBoard.mockReturnValueOnce(post.promise);
    const creating = useBoardStore.getState().createBoard('u1', { name: 'New' });
    const { id } = useBoardStore.getState().boards[0];

    client.getBoard.mockResolvedValueOnce(snapshot(id));
    const opening = useBoardStore.getState().fetchBoard(id);
    await flush();
    expect(client.getBoard).not.toHaveBeenCalled();

    post.resolve({ id, name: 'New', ownerId: 'u1' });
    await Promise.all([creating, opening]);
    expect(client.getBoard).toHaveBeenCalledWith(id);
    expect(board().board.id).toBe(id);
  });

  it('a poll of the Board while its POST is in flight waits too', async () => {
    const post = held();
    client.createBoard.mockReturnValueOnce(post.promise);
    useBoardStore.getState().createBoard('u1', { name: 'New' });
    const { id } = useBoardStore.getState().boards[0];

    client.getBoard.mockResolvedValueOnce(snapshot(id));
    const polling = useBoardStore.getState().pollBoard(id);
    await flush();
    expect(client.getBoard).not.toHaveBeenCalled();
    post.resolve({ id, name: 'New', ownerId: 'u1' });
    await polling;
    expect(client.getBoard).toHaveBeenCalledWith(id);
  });

  it('renaming or deleting it while the POST is in flight is sent after the create', async () => {
    const post = held();
    client.createBoard.mockReturnValueOnce(post.promise);
    client.patchBoard.mockImplementation(async (id, { name }) => ({ id, name, ownerId: 'u1' }));
    client.deleteBoard.mockResolvedValue(undefined);
    useBoardStore.getState().createBoard('u1', { name: 'New' });
    const { id } = useBoardStore.getState().boards[0];

    const renaming = useBoardStore.getState().renameBoard(id, { name: 'Renamed' });
    expect(useBoardStore.getState().boards[0].name).toBe('Renamed');   // still optimistic
    await flush();
    expect(client.patchBoard).not.toHaveBeenCalled();

    post.resolve({ id, name: 'New', ownerId: 'u1' });
    await renaming;
    expect(client.patchBoard).toHaveBeenCalledWith(id, { name: 'Renamed' });
    expect(useBoardStore.getState().boards[0].name).toBe('Renamed');   // the create's answer doesn't undo it
  });

  it('a failed create rolls back just its placeholder and shows the error (#49)', async () => {
    listBoards([{ id: 'old', name: 'Old', ownerId: 'u1' }]);
    client.createBoard.mockRejectedValueOnce(new Error('boom'));
    await expect(useBoardStore.getState().createBoard('u1', { name: 'New' })).rejects.toThrow('boom');
    expect(useBoardStore.getState().boards.map(b => b.id)).toEqual(['old']);
    expect(useBoardStore.getState().error).toBe('boom');
  });

  it('a failed create: opening it sends no GET, closes the open board and keeps the create error', async () => {
    const post = held();
    client.createBoard.mockReturnValueOnce(post.promise);
    const creating = useBoardStore.getState().createBoard('u1', { name: 'New' }).catch(() => {});
    const { id } = useBoardStore.getState().boards[0];

    const opening = useBoardStore.getState().fetchBoard(id);
    const polling = useBoardStore.getState().pollBoard(id);
    post.reject(new Error('boom'));
    await Promise.all([creating, opening]);
    await expect(polling).rejects.toMatchObject({ status: 404 });   // usePolling navigates away
    expect(client.getBoard).not.toHaveBeenCalled();
    expect(useBoardStore.getState().boards).toEqual([]);
    expect(board()).toBeNull();                                       // b1 no longer shows under the new URL
    expect(useBoardStore.getState().error).toBe('boom');
  });

  it('a failed delete puts back only that Board, not a list that went stale meanwhile', async () => {
    listBoards([{ id: 'x', name: 'X', ownerId: 'u1' }]);
    const del = held();
    client.deleteBoard.mockReturnValueOnce(del.promise);
    const deleting = useBoardStore.getState().deleteBoard('x').catch(() => {});
    client.createBoard.mockImplementation(async ({ name, id }) => ({ id, name, ownerId: 'u1' }));
    const created = await useBoardStore.getState().createBoard('u1', { name: 'New' });

    del.reject(new Error('nope'));
    await deleting;
    expect(useBoardStore.getState().boards.map(b => b.id)).toEqual(['x', created.id]);
  });
});

// #76: /boards list renames — the latest rename owns the name.
describe('renameBoard: the latest rename owns the name (#76; queued per Board since #78)', () => {
  const names = () => useBoardStore.getState().boards.map(b => b.name);

  it('a rename during an in-flight create: the create landing keeps the renamed name (no flicker)', async () => {
    const post = held();
    const patch = held();
    client.createBoard.mockReturnValueOnce(post.promise);
    client.patchBoard.mockReturnValueOnce(patch.promise);
    const creating = useBoardStore.getState().createBoard('u1', { name: 'New' });
    const { id } = useBoardStore.getState().boards[0];
    const renaming = useBoardStore.getState().renameBoard(id, { name: 'Renamed' });

    post.resolve({ id, name: 'New', ownerId: 'u1' });
    await creating;
    expect(names()).toEqual(['Renamed']);
    patch.resolve({ id, name: 'Renamed', ownerId: 'u1' });
    await renaming;
    expect(names()).toEqual(['Renamed']);
  });

  it('an earlier rename failing while a later one is in flight leaves the later name', async () => {
    listBoards([{ id: 'x', name: 'Orig', ownerId: 'u1' }]);
    const a = held(), b = held();
    client.patchBoard.mockReturnValueOnce(a.promise).mockReturnValueOnce(b.promise);
    const ra = useBoardStore.getState().renameBoard('x', { name: 'A' }).catch(() => {});
    const rb = useBoardStore.getState().renameBoard('x', { name: 'B' });
    await flush();

    a.reject(new Error('nope'));
    await ra;
    expect(names()).toEqual(['B']);
    b.resolve({ id: 'x', name: 'B', ownerId: 'u1' });
    await rb;
    expect(names()).toEqual(['B']);
  });

  it('the latest rename failing restores the last name the server confirmed', async () => {
    listBoards([{ id: 'x', name: 'Orig', ownerId: 'u1' }]);
    const a = held(), b = held();
    client.patchBoard.mockReturnValueOnce(a.promise).mockReturnValueOnce(b.promise);
    const ra = useBoardStore.getState().renameBoard('x', { name: 'A' });
    const rb = useBoardStore.getState().renameBoard('x', { name: 'B' }).catch(() => {});
    await flush();

    a.resolve({ id: 'x', name: 'A', ownerId: 'u1' });
    await ra;
    expect(names()).toEqual(['B']);                 // A's answer doesn't undo the pending B
    b.reject(new Error('nope'));
    await rb;
    expect(names()).toEqual(['A']);
    expect(useBoardStore.getState().error).toBe('nope');
  });

  // #78: renames of one Board are queued on its id — the second PATCH goes
  // out only once the first is answered (overlapping renames are gone).
  it('renames of one Board go out one at a time; the latest still shows meanwhile', async () => {
    listBoards([{ id: 'x', name: 'Orig', ownerId: 'u1' }]);
    const a = held(), b = held();
    client.patchBoard.mockReturnValueOnce(a.promise).mockReturnValueOnce(b.promise);
    const ra = useBoardStore.getState().renameBoard('x', { name: 'A' });
    const rb = useBoardStore.getState().renameBoard('x', { name: 'B' });
    await flush();
    expect(client.patchBoard).toHaveBeenCalledTimes(1);
    expect(names()).toEqual(['B']);

    a.resolve({ id: 'x', name: 'A', ownerId: 'u1' });
    await ra;
    await flush();
    expect(client.patchBoard).toHaveBeenLastCalledWith('x', { name: 'B' });
    b.resolve({ id: 'x', name: 'B', ownerId: 'u1' });
    await rb;
    expect(names()).toEqual(['B']);
  });

  it('both failing → back to the original name', async () => {
    listBoards([{ id: 'x', name: 'Orig', ownerId: 'u1' }]);
    const a = held(), b = held();
    client.patchBoard.mockReturnValueOnce(a.promise).mockReturnValueOnce(b.promise);
    const ra = useBoardStore.getState().renameBoard('x', { name: 'A' }).catch(() => {});
    const rb = useBoardStore.getState().renameBoard('x', { name: 'B' }).catch(() => {});
    await flush();
    a.reject(new Error('a'));
    await ra;
    expect(names()).toEqual(['B']);
    await flush();
    b.reject(new Error('b'));
    await rb;
    expect(names()).toEqual(['Orig']);
  });
});

describe('/boards list: renames, deletes and a list fetch in flight together (#76 review)', () => {
  const names = () => useBoardStore.getState().boards.map(b => b.name);
  const ids = () => useBoardStore.getState().boards.map(b => b.id);

  it('delete with a rename pending; the rename then the delete fail → back under the confirmed name', async () => {
    listBoards([{ id: 'x', name: 'Orig', ownerId: 'u1' }]);
    const patch = held(), del = held();
    client.patchBoard.mockReturnValueOnce(patch.promise);
    client.deleteBoard.mockReturnValueOnce(del.promise);
    const renaming = useBoardStore.getState().renameBoard('x', { name: 'A' }).catch(() => {});
    const deleting = useBoardStore.getState().deleteBoard('x').catch(() => {});
    await flush();
    expect(client.deleteBoard).not.toHaveBeenCalled();     // queued behind the rename (#78)

    patch.reject(new Error('rename failed'));
    await renaming;
    await flush();
    expect(names()).toEqual([]);                          // the delete still pending
    expect(useBoardStore.getState().error).toBeNull();    // the user asked to delete it
    del.reject(new Error('delete failed'));
    await deleting;
    expect(names()).toEqual(['Orig']);
    expect(useBoardStore.getState().error).toBe('delete failed');
  });

  it('a list fetch landing mid-flight: pending creates, renames and deletes replay on top', async () => {
    listBoards([{ id: 'x', name: 'X', ownerId: 'u1' }, { id: 'y', name: 'Y', ownerId: 'u1' }]);
    client.createBoard.mockReturnValueOnce(held().promise);
    client.patchBoard.mockReturnValueOnce(held().promise);
    client.deleteBoard.mockReturnValueOnce(held().promise);
    useBoardStore.getState().createBoard('u1', { name: 'New' });
    useBoardStore.getState().renameBoard('x', { name: 'X2' });
    useBoardStore.getState().deleteBoard('y');
    const newId = ids()[ids().length - 1];
    await flush();

    client.getBoards.mockResolvedValueOnce([
      { id: 'x', name: 'X', ownerId: 'u1' }, { id: 'y', name: 'Y', ownerId: 'u1' }, { id: 'z', name: 'Z', ownerId: 'u2' },
    ]);
    await useBoardStore.getState().fetchBoards();
    expect(useBoardStore.getState().boards.map(b => [b.id, b.name])).toEqual([['x', 'X2'], ['z', 'Z'], [newId, 'New']]);
  });

  it('opening a Board whose create failed flags it, so the eject can carry the error to /boards', async () => {
    client.createBoard.mockRejectedValueOnce(new Error('boom'));
    const creating = useBoardStore.getState().createBoard('u1', { name: 'New' }).catch(() => {});
    const { id } = useBoardStore.getState().boards[0];
    await Promise.all([creating, useBoardStore.getState().fetchBoard(id)]);
    expect(useBoardStore.getState().failedCreate).toBe('boom');

    await openBoard({ board: makeBoard() });
    expect(useBoardStore.getState().failedCreate).toBeNull();
  });
});

describe('the /boards list is a pending-ops list (#78)', () => {
  const ids = () => useBoardStore.getState().boards.map(b => b.id);

  it('a list fetch sent before a Board op committed is ignored, and fetched again', async () => {
    listBoards([]);
    const post = held(), first = held();
    client.createBoard.mockReturnValueOnce(post.promise);
    client.getBoards.mockReturnValueOnce(first.promise);
    const creating = useBoardStore.getState().createBoard('u1', { name: 'New' });
    const { id } = useBoardStore.getState().boards[0];
    const fetching = useBoardStore.getState().fetchBoards();

    post.resolve({ id, name: 'New', ownerId: 'u1' });
    await creating;
    client.getBoards.mockResolvedValueOnce([{ id: 'old', name: 'Old', ownerId: 'u1' }, { id, name: 'New', ownerId: 'u1' }]);
    first.resolve([{ id: 'old', name: 'Old', ownerId: 'u1' }]);   // predates the create
    await fetching;
    expect(client.getBoards).toHaveBeenCalledTimes(2);
    expect(ids()).toEqual(['old', id]);
    expect(useBoardStore.getState().loading).toBe(false);
  });

  it('overlapping list fetches: an older one landing after a newer one is dropped, not fetched again', async () => {
    const older = held(), newer = held();
    client.getBoards.mockReturnValueOnce(older.promise).mockReturnValueOnce(newer.promise);
    const a = useBoardStore.getState().fetchBoards();
    const b = useBoardStore.getState().fetchBoards();
    newer.resolve([{ id: 'n', name: 'N', ownerId: 'u1' }]);
    await b;
    older.resolve([{ id: 'o', name: 'O', ownerId: 'u1' }]);
    await a;
    expect(client.getBoards).toHaveBeenCalledTimes(2);
    expect(ids()).toEqual(['n']);
  });

  it('a failed create fails the rename and delete waiting on it; neither reaches the server', async () => {
    const post = held();
    client.createBoard.mockReturnValueOnce(post.promise);
    const creating = useBoardStore.getState().createBoard('u1', { name: 'New' }).catch(e => e);
    const { id } = useBoardStore.getState().boards[0];
    const renaming = useBoardStore.getState().renameBoard(id, { name: 'R' }).catch(e => e);
    const deleting = useBoardStore.getState().deleteBoard(id).catch(e => e);

    post.reject(new Error('boom'));
    const [c, r, d] = await Promise.all([creating, renaming, deleting]);
    expect([c.message, r.message, d.message]).toEqual(['boom', 'boom', 'boom']);
    expect(client.patchBoard).not.toHaveBeenCalled();
    expect(client.deleteBoard).not.toHaveBeenCalled();
    expect(ids()).toEqual([]);
    expect(useBoardStore.getState().error).toBe('boom');
  });
});
