import { useState } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import useSession from '../store/useSession';
import { validateEmail, validatePassword } from '../domain/validation';
import styles from './AuthPage.module.css';

export default function LoginPage() {
  const { login } = useSession();
  const navigate = useNavigate();
  const location = useLocation();
  const from = location.state?.from?.pathname ?? '/boards';

  const [email, setEmail]       = useState('');
  const [password, setPassword] = useState('');
  const [errors, setErrors]     = useState({});
  const [apiError, setApiError] = useState(null);
  const [loading, setLoading]   = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    const emailErr    = validateEmail(email);
    const passwordErr = validatePassword(password);
    if (emailErr || passwordErr) {
      setErrors({ email: emailErr, password: passwordErr });
      return;
    }
    setErrors({});
    setApiError(null);
    setLoading(true);
    try {
      await login(email, password);
      navigate(from, { replace: true });
    } catch (err) {
      setApiError(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className={styles.page}>
      <div className={styles.card}>
        <h1 className={styles.title}>Sign in</h1>

        {apiError && <p className={styles.apiError}>{apiError}</p>}

        <form className={styles.form} onSubmit={handleSubmit} noValidate>
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
              autoComplete="current-password"
              value={password}
              onChange={e => { setPassword(e.target.value); setErrors(v => ({ ...v, password: null })); }}
            />
            {errors.password && <span className={styles.fieldError}>{errors.password}</span>}
          </div>

          <button className={styles.btn} type="submit" disabled={loading}>
            {loading ? 'Signing in…' : 'Sign in'}
          </button>
        </form>

        <p className={styles.switchLink}>
          Don't have an account? <Link to="/register">Register</Link>
        </p>
      </div>
    </div>
  );
}
