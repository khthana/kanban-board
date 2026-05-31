import useSession from '../store/useSession';
import styles from './UserSwitcher.module.css';

export default function UserSwitcher() {
  const { users, currentUserId, switchUser } = useSession();

  return (
    <div className={styles.wrapper}>
      <label className={styles.label} htmlFor="user-switcher">
        Acting as:
      </label>
      <select
        id="user-switcher"
        className={styles.select}
        value={currentUserId}
        onChange={e => switchUser(e.target.value)}
      >
        {users.map(u => (
          <option key={u.id} value={u.id}>
            {u.displayName}
          </option>
        ))}
      </select>
    </div>
  );
}
