import ListRow from './ListRow';
import ColumnComposer from './ColumnComposer';
import styles from './ListView.module.css';

export default function ListView({ sortedColumns, cards, labels = [], subtasks = [], onAddColumn }) {
  if (sortedColumns.length === 0) {
    return (
      <div className={styles.list} data-testid="list-view">
        <ColumnComposer onAdd={onAddColumn} />
      </div>
    );
  }

  return (
    <div className={styles.list} data-testid="list-view">
      {sortedColumns.map(col => {
        const colCards = cards.filter(c => c.columnId === col.id).sort((a, b) => a.position - b.position);
        return (
          <section key={col.id} className={styles.section} data-testid="list-section">
            <div className={styles.sectionHeader}>
              <span className={styles.chip} data-testid="column-chip">{col.name}</span>
              <span className={styles.count} data-testid="list-section-count">{colCards.length}</span>
            </div>
            {colCards.map(card => (
              <ListRow key={card.id} card={card} labels={labels}
                subtasks={subtasks.filter(s => s.cardId === card.id)} />
            ))}
          </section>
        );
      })}
    </div>
  );
}
