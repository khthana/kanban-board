import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import useSession from '../store/useSession';
import { validatePasswordChange } from '../domain/validation';
import { patchMePassword } from '../api/client';
import Toast from '../components/common/Toast';
import styles from './ProfilePage.module.css';

function isValidEmail(v) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);
}

export default function ProfilePage() {
  const { displayName: sessionName, email: sessionEmail, updateProfile } = useSession();

  const [displayName, setDisplayName] = useState(sessionName ?? '');
  const [email, setEmail] = useState(sessionEmail ?? '');
  const [profileError, setProfileError] = useState(null);

  // Sync form when session store populates async (e.g. after page reload + fetchProfile)
  useEffect(() => {
    if (sessionName) setDisplayName(sessionName);
    if (sessionEmail) setEmail(sessionEmail);
  }, [sessionName, sessionEmail]);
  const [saving, setSaving] = useState(false);

  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [pwError, setPwError] = useState(null);
  const [changingPw, setChangingPw] = useState(false);

  const [toast, setToast] = useState(null);

  async function handleProfileSubmit(e) {
    e.preventDefault();
    setProfileError(null);

    if (!displayName.trim()) return setProfileError({ field: 'displayName', message: 'ชื่อที่แสดงห้ามว่าง' });
    if (displayName.trim().length > 100) return setProfileError({ field: 'displayName', message: 'ชื่อที่แสดงยาวไม่เกิน 100 ตัวอักษร' });
    if (!isValidEmail(email)) return setProfileError({ field: 'email', message: 'รูปแบบ email ไม่ถูกต้อง' });

    setSaving(true);
    try {
      await updateProfile({ displayName: displayName.trim(), email: email.trim() });
      setToast('บันทึกแล้ว');
    } catch (err) {
      if (err.status === 409) {
        setProfileError({ field: 'email', message: 'Email นี้ถูกใช้งานแล้ว' });
      } else {
        setProfileError({ field: 'email', message: err.message });
      }
    } finally {
      setSaving(false);
    }
  }

  async function handlePasswordSubmit(e) {
    e.preventDefault();
    setPwError(null);

    const validationErr = validatePasswordChange({ newPassword, confirmPassword });
    if (validationErr) return setPwError(validationErr);

    setChangingPw(true);
    try {
      await patchMePassword({ currentPassword, newPassword });
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      setToast('เปลี่ยนรหัสผ่านแล้ว');
    } catch (err) {
      if (err.status === 400) {
        setPwError({ field: 'currentPassword', message: 'รหัสผ่านปัจจุบันไม่ถูกต้อง' });
      } else {
        setPwError({ field: 'currentPassword', message: err.message });
      }
    } finally {
      setChangingPw(false);
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
          <form onSubmit={handleProfileSubmit} className={styles.form}>
            <div className={styles.field}>
              <label className={styles.label} htmlFor="profile-displayName">ชื่อที่แสดง</label>
              <input
                id="profile-displayName"
                className={`${styles.input} ${profileError?.field === 'displayName' ? styles.inputError : ''}`}
                value={displayName}
                onChange={e => { setDisplayName(e.target.value); setProfileError(null); }}
                maxLength={101}
              />
              {profileError?.field === 'displayName' && (
                <span className={styles.fieldError}>{profileError.message}</span>
              )}
            </div>

            <div className={styles.field}>
              <label className={styles.label} htmlFor="profile-email">Email</label>
              <input
                id="profile-email"
                className={`${styles.input} ${profileError?.field === 'email' ? styles.inputError : ''}`}
                type="email"
                value={email}
                onChange={e => { setEmail(e.target.value); setProfileError(null); }}
              />
              {profileError?.field === 'email' && (
                <span className={styles.fieldError}>{profileError.message}</span>
              )}
            </div>

            <button className={styles.btn} type="submit" disabled={saving}>
              {saving ? 'กำลังบันทึก…' : 'บันทึก'}
            </button>
          </form>
        </section>

        <section className={styles.section}>
          <h2 className={styles.sectionTitle}>เปลี่ยนรหัสผ่าน</h2>
          <form onSubmit={handlePasswordSubmit} className={styles.form}>
            <div className={styles.field}>
              <label className={styles.label} htmlFor="current-password">รหัสผ่านปัจจุบัน</label>
              <input
                id="current-password"
                className={`${styles.input} ${pwError?.field === 'currentPassword' ? styles.inputError : ''}`}
                type="password"
                value={currentPassword}
                onChange={e => { setCurrentPassword(e.target.value); setPwError(null); }}
              />
              {pwError?.field === 'currentPassword' && (
                <span className={styles.fieldError}>{pwError.message}</span>
              )}
            </div>

            <div className={styles.field}>
              <label className={styles.label} htmlFor="new-password">รหัสผ่านใหม่</label>
              <input
                id="new-password"
                className={`${styles.input} ${pwError?.field === 'newPassword' ? styles.inputError : ''}`}
                type="password"
                value={newPassword}
                onChange={e => { setNewPassword(e.target.value); setPwError(null); }}
              />
              {pwError?.field === 'newPassword' && (
                <span className={styles.fieldError}>{pwError.message}</span>
              )}
            </div>

            <div className={styles.field}>
              <label className={styles.label} htmlFor="confirm-password">ยืนยันรหัสผ่านใหม่</label>
              <input
                id="confirm-password"
                className={`${styles.input} ${pwError?.field === 'confirmPassword' ? styles.inputError : ''}`}
                type="password"
                value={confirmPassword}
                onChange={e => { setConfirmPassword(e.target.value); setPwError(null); }}
              />
              {pwError?.field === 'confirmPassword' && (
                <span className={styles.fieldError}>{pwError.message}</span>
              )}
            </div>

            <button className={styles.btn} type="submit" disabled={changingPw}>
              {changingPw ? 'กำลังเปลี่ยน…' : 'เปลี่ยนรหัสผ่าน'}
            </button>
          </form>
        </section>
      </div>

      {toast && <Toast message={toast} onDone={() => setToast(null)} />}
    </div>
  );
}
