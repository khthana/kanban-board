// Resolves a card's assignee user ids to the { userId, displayName } shape
// AvatarStack renders, in assignment order. Ids of users who are no longer
// board members are skipped.
export function assigneeUsers(assigneeIds, members) {
  return assigneeIds
    .map(uid => {
      const user = members.find(m => m.userId === uid)?.user;
      return user && { userId: uid, displayName: user.displayName };
    })
    .filter(Boolean);
}
