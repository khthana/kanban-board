import { useState } from 'react';
import { validateInviteEmail } from '../domain/validation';
import styles from './InviteDialog.module.css';

export default function InviteDialog({ members, allUsers, onInvite, onClose }) {
  const [email, setEmail] = useState('');
  const [error, setError] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    const err = validateInviteEmail(email, allUsers);
    if (err) { setError(err); return; }
    const alreadyMember = members.some(m => m.user.email === email);
    if (alreadyMember) { setError('This user is already a member.'); return; }
    setSubmitting(true);
    try {
      await onInvite(email);
      setEmail('');
      setError(null);
    } catch (e) {
      setError(e.message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className={styles.overlay} onClick={e => e.target === e.currentTarget && onClose()}>
      <div className={styles.dialog} role="dialog" aria-label="Invite member">
        <div className={styles.header}>
          <h3 className={styles.title}>Invite member</h3>
          <button className={styles.closeBtn} onClick={onClose}>✕</button>
        </div>

        <form className={styles.form} onSubmit={handleSubmit}>
          <label className={styles.label} htmlFor="invite-email">Email address</label>
          <input
            id="invite-email"
            className={styles.input}
            type="email"
            placeholder="user@example.com"
            value={email}
            autoFocus
            onChange={e => { setEmail(e.target.value); setError(null); }}
          />
          {error && <p className={styles.error}>{error}</p>}
          <button className={styles.btn} type="submit" disabled={submitting}>
            {submitting ? 'Inviting…' : 'Invite'}
          </button>
        </form>

        <div className={styles.memberList}>
          <p className={styles.membersLabel}>Current members</p>
          {members.map(m => (
            <div key={m.userId} className={styles.memberRow}>
              <span className={styles.memberName}>{m.user.displayName}</span>
              <span className={styles.memberEmail}>{m.user.email}</span>
              <span className={`${styles.role} ${m.role === 'owner' ? styles.owner : ''}`}>{m.role}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
