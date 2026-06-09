import { useEffect } from 'react';
import { TOAST_DURATION_MS } from '../../constants';
import styles from './Toast.module.css';

export default function Toast({ message, onDone }) {
  useEffect(() => {
    const t = setTimeout(onDone, TOAST_DURATION_MS);
    return () => clearTimeout(t);
  }, [onDone]);

  return <div className={styles.toast}>{message}</div>;
}
