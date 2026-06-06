import DatePicker from 'react-datepicker';
import 'react-datepicker/dist/react-datepicker.css';
import styles from './DueDateField.module.css';

function toDate(str) {
  if (!str) return null;
  const [y, m, d] = str.split('-').map(Number);
  if (isNaN(y) || isNaN(m) || isNaN(d)) return null;
  return new Date(y, m - 1, d);
}

function toStr(date) {
  if (!date) return null;
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export default function DueDateField({ dueDate, onChange }) {
  const selected = toDate(dueDate);

  return (
    <div className={styles.wrapper}>
      <p className={styles.label}>Due date</p>
      <div className={styles.pickerWrap}>
        <DatePicker
          selected={selected}
          onChange={date => onChange(toStr(date))}
          dateFormat="dd/MM/yyyy"
          placeholderText="เลือกวันที่..."
          className={dueDate ? `${styles.input} ${styles.inputWithClear}` : styles.input}
        />
        {dueDate && (
          <button className={styles.clear} onClick={() => onChange(null)} title="Clear">✕</button>
        )}
      </div>
    </div>
  );
}
