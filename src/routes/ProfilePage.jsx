import { useState } from 'react';
import { Link } from 'react-router-dom';
import useSession from '../store/useSession';
import Toast from '../components/Toast';
import styles from './ProfilePage.module.css';

function isValidEmail(v) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);
}

export default function ProfilePage() {
  const { displayName: sessionName, email: sessionEmail, updateProfile } = useSession();

  const [displayName, setDisplayName] = useState(sessionName ?? '');
  const [email, setEmail] = useState(sessionEmail ?? '');
  const [fieldError, setFieldError] = useState(null);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState(null);

  async function handleSubmit(e) {
    e.preventDefault();
    setFieldError(null);

    if (!displayName.trim()) return setFieldError({ field: 'displayName', message: 'ชื่อที่แสดงห้ามว่าง' });
    if (displayName.trim().length > 100) return setFieldError({ field: 'displayName', message: 'ชื่อที่แสดงยาวไม่เกิน 100 ตัวอักษร' });
    if (!isValidEmail(email)) return setFieldError({ field: 'email', message: 'รูปแบบ email ไม่ถูกต้อง' });

    setSaving(true);
    try {
      await updateProfile({ displayName: displayName.trim(), email: email.trim() });
      setToast('บันทึกแล้ว');
    } catch (err) {
      if (err.status === 409) {
        setFieldError({ field: 'email', message: 'Email นี้ถูกใช้งานแล้ว' });
      } else {
        setFieldError({ field: 'email', message: err.message });
      }
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className={styles.page}>
      <div className={styles.container}>
        <div className={styles.header}>
          <Link to="/boards" className={styles.back}>← Boards</Link>
          <h1 className={styles.title}>โปรไฟล์</h1>
        </div>

        <section className={styles.section}>
          <h2 className={styles.sectionTitle}>ข้อมูลส่วนตัว</h2>
          <form onSubmit={handleSubmit} className={styles.form}>
            <div className={styles.field}>
              <label className={styles.label}>ชื่อที่แสดง</label>
              <input
                className={`${styles.input} ${fieldError?.field === 'displayName' ? styles.inputError : ''}`}
                value={displayName}
                onChange={e => { setDisplayName(e.target.value); setFieldError(null); }}
                maxLength={101}
              />
              {fieldError?.field === 'displayName' && (
                <span className={styles.fieldError}>{fieldError.message}</span>
              )}
            </div>

            <div className={styles.field}>
              <label className={styles.label}>Email</label>
              <input
                className={`${styles.input} ${fieldError?.field === 'email' ? styles.inputError : ''}`}
                type="email"
                value={email}
                onChange={e => { setEmail(e.target.value); setFieldError(null); }}
              />
              {fieldError?.field === 'email' && (
                <span className={styles.fieldError}>{fieldError.message}</span>
              )}
            </div>

            <button className={styles.btn} type="submit" disabled={saving}>
              {saving ? 'กำลังบันทึก…' : 'บันทึก'}
            </button>
          </form>
        </section>
      </div>

      {toast && <Toast message={toast} onDone={() => setToast(null)} />}
    </div>
  );
}
