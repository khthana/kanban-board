import { Link } from 'react-router-dom';
import Avatar from './Avatar';
import UserSwitcher from './UserSwitcher';
import styles from './TopBar.module.css';

export default function TopBar({ board, members }) {
  return (
    <header className={styles.bar}>
      <div className={styles.left}>
        <Link to="/boards" className={styles.back}>← Boards</Link>
        <h1 className={styles.name}>{board.name}</h1>
      </div>
      <div className={styles.right}>
        <div className={styles.avatars}>
          {members.map(m => (
            <Avatar key={m.userId} user={m.user} size="sm" />
          ))}
        </div>
        <UserSwitcher />
      </div>
    </header>
  );
}
