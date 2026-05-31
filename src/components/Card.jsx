import styles from './Card.module.css';

export default function Card({ card, onClick }) {
  return (
    <div className={styles.card} onClick={() => onClick(card)} role="button" tabIndex={0}
      onKeyDown={e => e.key === 'Enter' && onClick(card)}>
      <p className={styles.title}>{card.title}</p>
    </div>
  );
}
