import { createBoardActions, CARD_DELETED_MESSAGE } from './boardActions';

// The board actions module (#68): every board mutation, bound to the open board,
// with its error policy — banner, inline (rejects to the caller), card-gone, and
// a swallowed delete-404. Tested against a fake store.

const fail = (message, status) => Promise.reject(Object.assign(new Error(message), { status }));

function setup(overrides = {}) {
  const store = new Proxy({}, {
    get: (target, name) => {
      if (!(name in target)) target[name] = jest.fn(overrides[name] ?? (() => Promise.resolve('ok')));
      return target[name];
    },
  });
  const report = { opError: jest.fn(), closeCard: jest.fn() };
  const actions = createBoardActions({ store, boardId: 'b1', report });
  return { store, report, actions };
}

describe('bound to the open board, no user id', () => {
  test('board-scoped actions pass the board id; the rest pass only what the server needs', async () => {
    const { store, actions } = setup();

    await actions.createColumn('Todo');
    await actions.createLabel({ name: 'Bug', color: '#fca5a5' });
    await actions.removeMember('u2');
    await actions.addMember('a@b.c');
    await actions.createCard('c1', 'Task');
    await actions.attachLabel('k1', 'l1');
    await actions.patchCard('k1', { title: 'T' });

    expect(store.createColumn).toHaveBeenCalledWith('b1', { name: 'Todo' });
    expect(store.createLabel).toHaveBeenCalledWith('b1', { name: 'Bug', color: '#fca5a5' });
    expect(store.removeMember).toHaveBeenCalledWith('b1', { memberId: 'u2' });
    expect(store.addMember).toHaveBeenCalledWith('b1', { email: 'a@b.c' });
    expect(store.createCard).toHaveBeenCalledWith('c1', { title: 'Task' });
    expect(store.attachLabel).toHaveBeenCalledWith('k1', 'l1');
    expect(store.patchCard).toHaveBeenCalledWith('k1', { title: 'T' });
  });

  test('a success resolves with the store result and reports nothing', async () => {
    const { report, actions } = setup({ attachLabel: () => Promise.resolve('attached') });
    await expect(actions.attachLabel('k1', 'l1')).resolves.toBe('attached');
    expect(report.opError).not.toHaveBeenCalled();
  });
});

describe('banner policy (the default)', () => {
  test.each([
    ['renameColumn', a => a.renameColumn('c1', { name: 'X', color: null })],
    ['deleteColumn', a => a.deleteColumn('c1')],
    ['moveColumn',   a => a.moveColumn('c1', { position: 2 })],
    ['createCard',   a => a.createCard('c1', 'T')],
    ['moveCard',     a => a.moveCard('k1', { columnId: 'c2', position: 1 })],
    ['patchLabel',   a => a.patchLabel('l1', { name: 'X' })],
    ['deleteLabel',  a => a.deleteLabel('l1')],
    ['detachLabel',  a => a.detachLabel('k1', 'l1')],
    ['attachAssignee', a => a.attachAssignee('k1', 'u2')],
    ['toggleSubtask', a => a.toggleSubtask('s1')],
    ['deleteSubtask', a => a.deleteSubtask('s1')],
    ['moveSubtaskUp', a => a.moveSubtaskUp('s1', { hideDone: true })],
  ])('%s: a failure goes to the banner and the promise still resolves', async (storeAction, call) => {
    const { report, actions } = setup({ [storeAction]: () => fail('boom') });
    await expect(call(actions)).resolves.toBeUndefined();
    expect(report.opError).toHaveBeenCalledWith('boom');
    expect(report.closeCard).not.toHaveBeenCalled();
  });

  test('a moved card that is gone shows the server reason (the store already dropped it)', async () => {
    const { report, actions } = setup({ moveCard: () => fail('card not found', 404) });
    await actions.moveCard('k1', { columnId: 'c2', position: 1 });
    expect(report.opError).toHaveBeenCalledWith('card not found');
    expect(report.closeCard).not.toHaveBeenCalled();
  });
});

describe('inline policy: the caller shows the error', () => {
  test.each([
    ['createSubtasks', a => a.createSubtasks('k1', ['A'])],
    ['renameSubtask',  a => a.renameSubtask('s1', 'New')],
    ['addMember',      a => a.addMember('a@b.c')],
  ])('%s: rejects with the error, no banner', async (storeAction, call) => {
    const { report, actions } = setup({ [storeAction]: () => fail('nope') });
    await expect(call(actions)).rejects.toThrow('nope');
    expect(report.opError).not.toHaveBeenCalled();
  });
});

describe('card gone (PRD §1.5)', () => {
  test('saving a card another member deleted closes the panel with a notice', async () => {
    const { report, actions } = setup({ patchCard: () => fail('card not found', 404) });
    await expect(actions.patchCard('k1', { title: 'T' })).resolves.toBeUndefined();
    expect(report.closeCard).toHaveBeenCalled();
    expect(report.opError).toHaveBeenCalledWith(CARD_DELETED_MESSAGE);
  });

  test('any other save failure is a plain banner', async () => {
    const { report, actions } = setup({ patchCard: () => fail('boom', 500) });
    await actions.patchCard('k1', { title: 'T' });
    expect(report.closeCard).not.toHaveBeenCalled();
    expect(report.opError).toHaveBeenCalledWith('boom');
  });

  test('cardDeleted() is the same announcement, for a deletion seen by polling', () => {
    const { report, actions } = setup();
    actions.cardDeleted();
    expect(report.closeCard).toHaveBeenCalled();
    expect(report.opError).toHaveBeenCalledWith(CARD_DELETED_MESSAGE);
  });
});

describe('deleting a card', () => {
  test('a 404 is swallowed — the card is gone, which is what was asked', async () => {
    const { report, actions } = setup({ deleteCard: () => fail('card not found', 404) });
    await expect(actions.deleteCard('k1')).resolves.toBeUndefined();
    expect(report.opError).not.toHaveBeenCalled();
    expect(report.closeCard).not.toHaveBeenCalled();
  });

  test('any other failure goes to the banner', async () => {
    const { report, actions } = setup({ deleteCard: () => fail('boom', 500) });
    await actions.deleteCard('k1');
    expect(report.opError).toHaveBeenCalledWith('boom');
  });
});
