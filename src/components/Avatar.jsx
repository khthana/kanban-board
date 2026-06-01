import styles from './Avatar.module.css';

export default function Avatar({ user, size = 'md' }) {
  const initials = (user?.displayName || '?')
    .split(' ')
    .map(w => w[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();

  return (
    <div className={`${styles.avatar} ${styles[size]}`} title={user?.displayName ?? ''}>
      {initials}
    </div>
  );
}
