import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import Avatar from './common/Avatar';
import useSession from '../store/useSession';
import styles from './TopBar.module.css';

export default function TopBar({ board, members, currentUserId, onInvite, onRemoveMember }) {
  const isOwner = board.ownerId === currentUserId;
  const { displayName, logout } = useSession();
  const navigate = useNavigate();
  const [dropdownOpen, setDropdownOpen] = useState(false);

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
                  aria-label={`Remove ${m.user.displayName}`}
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

        {displayName && (
          <div className={styles.userMenu}>
            <button
              className={styles.userBtn}
              onClick={() => setDropdownOpen(o => !o)}
            >
              {displayName} ▾
            </button>
            {dropdownOpen && (
              <div className={styles.dropdown}>
                <button className={styles.dropdownItem} onClick={() => { setDropdownOpen(false); navigate('/profile'); }}>
                  Profile
                </button>
                <button className={styles.dropdownItem} onClick={() => { logout(); navigate('/login'); }}>
                  Logout
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </header>
  );
}
