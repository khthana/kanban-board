import { PRESET_COLORS } from '../../domain/colors';
import styles from './AvatarStack.module.css';

// Stable per-user hue so the same member always gets the same avatar color.
function colorFor(key) {
  const s = String(key ?? '');
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
  return PRESET_COLORS[h % PRESET_COLORS.length];
}

function initialOf(name) {
  return (name || '?').trim().charAt(0).toUpperCase() || '?';
}

// Overlapping assignee avatars: up to `max` shown, then a "+N" chip.
export default function AvatarStack({ users = [], size = 24, max = 3 }) {
  if (users.length === 0) return null;

  const visible = users.slice(0, max);
  const overflow = users.length - visible.length;
  const style = { '--sz': `${size}px` };

  return (
    <div className={styles.stack} style={style} data-testid="avatar-stack">
      {visible.map((u, i) => (
        <div
          key={u.userId ?? u.id ?? i}
          className={styles.avatar}
          style={{ background: `color-mix(in oklab, ${colorFor(u.userId ?? u.id ?? u.displayName)}, black 16%)` }}
          title={u.displayName ?? ''}
        >
          {initialOf(u.displayName)}
        </div>
      ))}
      {overflow > 0 && (
        <div className={`${styles.avatar} ${styles.more}`} title={`+${overflow} more`}>
          +{overflow}
        </div>
      )}
    </div>
  );
}
