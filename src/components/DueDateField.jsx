import DatePicker from 'react-datepicker';
import 'react-datepicker/dist/react-datepicker.css';
import { fromYMD, toYMD } from '../domain/dates';
import styles from './DueDateField.module.css';

export default function DueDateField({ dueDate, onChange }) {
  const selected = fromYMD(dueDate);

  return (
    <div className={styles.wrapper}>
      <p className={styles.label}>Due date</p>
      <div className={styles.pickerWrap}>
        <DatePicker
          selected={selected}
          onChange={date => onChange(toYMD(date))}
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
