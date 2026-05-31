import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import useSession from '../store/useSession';
import { validateEmail, validatePassword, validateDisplayName } from '../domain/validation';
import styles from './AuthPage.module.css';

export default function RegisterPage() {
  const { register } = useSession();
  const navigate = useNavigate();

  const [email, setEmail]               = useState('');
  const [password, setPassword]         = useState('');
  const [displayName, setDisplayName]   = useState('');
  const [errors, setErrors]             = useState({});
  const [apiError, setApiError]         = useState(null);
  const [loading, setLoading]           = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    const emailErr       = validateEmail(email);
    const passwordErr    = validatePassword(password);
    const displayNameErr = validateDisplayName(displayName);
    if (emailErr || passwordErr || displayNameErr) {
      setErrors({ email: emailErr, password: passwordErr, displayName: displayNameErr });
      return;
    }
    setErrors({});
    setApiError(null);
    setLoading(true);
    try {
      await register(email, password, displayName);
      navigate('/boards', { replace: true });
    } catch (err) {
      setApiError(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className={styles.page}>
      <div className={styles.card}>
        <h1 className={styles.title}>Create account</h1>

        {apiError && <p className={styles.apiError}>{apiError}</p>}

        <form className={styles.form} onSubmit={handleSubmit} noValidate>
          <div className={styles.field}>
            <label className={styles.label} htmlFor="displayName">Display name</label>
            <input
              id="displayName"
              className={`${styles.input} ${errors.displayName ? styles.inputError : ''}`}
              type="text"
              autoComplete="name"
              maxLength={101}
              value={displayName}
              onChange={e => { setDisplayName(e.target.value); setErrors(v => ({ ...v, displayName: null })); }}
            />
            {errors.displayName && <span className={styles.fieldError}>{errors.displayName}</span>}
          </div>

          <div className={styles.field}>
            <label className={styles.label} htmlFor="email">Email</label>
            <input
              id="email"
              className={`${styles.input} ${errors.email ? styles.inputError : ''}`}
              type="email"
              autoComplete="email"
              value={email}
              onChange={e => { setEmail(e.target.value); setErrors(v => ({ ...v, email: null })); }}
            />
            {errors.email && <span className={styles.fieldError}>{errors.email}</span>}
          </div>

          <div className={styles.field}>
            <label className={styles.label} htmlFor="password">Password</label>
            <input
              id="password"
              className={`${styles.input} ${errors.password ? styles.inputError : ''}`}
              type="password"
              autoComplete="new-password"
              value={password}
              onChange={e => { setPassword(e.target.value); setErrors(v => ({ ...v, password: null })); }}
            />
            {errors.password && <span className={styles.fieldError}>{errors.password}</span>}
          </div>

          <button className={styles.btn} type="submit" disabled={loading}>
            {loading ? 'Creating account…' : 'Create account'}
          </button>
        </form>

        <p className={styles.switchLink}>
          Already have an account? <Link to="/login">Sign in</Link>
        </p>
      </div>
    </div>
  );
}
