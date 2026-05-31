import Card from './Card';
import styles from './Column.module.css';

export default function Column({ column, cards }) {
  return (
    <div className={styles.column}>
      <div className={styles.header}>
        <span className={styles.name}>{column.name}</span>
        <span className={styles.count}>{cards.length}</span>
      </div>

      <div className={styles.cards}>
        {cards.length === 0 ? (
          <p className={styles.empty}>No cards yet. Add one below.</p>
        ) : (
          cards.map(card => <Card key={card.id} card={card} />)
        )}
      </div>
    </div>
  );
}
