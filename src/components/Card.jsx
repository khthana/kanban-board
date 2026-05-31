import styles from './Card.module.css';

export default function Card({ card }) {
  return (
    <div className={styles.card}>
      <p className={styles.title}>{card.title}</p>
    </div>
  );
}
