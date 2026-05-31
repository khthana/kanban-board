import { Link } from 'react-router-dom';
import Avatar from './Avatar';
import styles from './TopBar.module.css';

export default function TopBar({ board, members, currentUserId, onInvite, onRemoveMember }) {
  const isOwner = board.ownerId === currentUserId;
  const currentUser = members.find(m => m.userId === currentUserId)?.user;

  return (
    <header className={styles.bar}>
      <div className={styles.left}>
        <Link to="/boards" className={styles.back}>← Boards</Link>
        <h1 className={styles.name}>{board.name}</h1>
      </div>

      <div className={styles.right}>
        <div className={styles.avatars}>
          {members.map(m => (
            <div key={m.userId} className={styles.avatarWrap}>
              <Avatar user={m.user} size="sm" />
              {isOwner && m.role !== 'owner' && (
                <button
                  className={styles.removeBtn}
                  title={`Remove ${m.user.displayName}`}
                  onClick={() => onRemoveMember(m.userId)}
                >
                  ✕
                </button>
              )}
            </div>
          ))}
        </div>

        {isOwner && (
          <button className={styles.inviteBtn} onClick={onInvite} title="Invite member">
            + Invite
          </button>
        )}

        {currentUser && (
          <span className={styles.currentUser}>{currentUser.displayName}</span>
        )}
      </div>
    </header>
  );
}
