import { assigneeUsers } from './assignees';

const members = [
  { userId: 'u1', role: 'owner', user: { displayName: 'Ann' } },
  { userId: 'u2', role: 'member', user: { displayName: 'Bob' } },
];

describe('assigneeUsers', () => {
  test('resolves assignee ids to display users in assignment order', () => {
    expect(assigneeUsers(['u2', 'u1'], members)).toEqual([
      { userId: 'u2', displayName: 'Bob' },
      { userId: 'u1', displayName: 'Ann' },
    ]);
  });

  test('skips ids that are no longer board members', () => {
    expect(assigneeUsers(['u1', 'gone'], members)).toEqual([{ userId: 'u1', displayName: 'Ann' }]);
  });

  test('returns an empty list when nobody is assigned', () => {
    expect(assigneeUsers([], members)).toEqual([]);
  });
});
