import ListRow from './ListRow';
import ColumnComposer from './ColumnComposer';
import styles from './ListView.module.css';

export default function ListView({ sortedColumns, cards, labels = [], subtasks = [], onAddColumn, onCardClick, style }) {
  if (sortedColumns.length === 0) {
    return (
      <div className={styles.list} data-testid="list-view" style={style}>
        <ColumnComposer onAdd={onAddColumn} />
      </div>
    );
  }

  return (
    <div className={styles.list} data-testid="list-view" style={style}>
      {sortedColumns.map(col => {
        const colCards = cards.filter(c => c.columnId === col.id).sort((a, b) => a.position - b.position);
        const accent = col.color || null;
        return (
          <section key={col.id} className={styles.section} data-testid="list-section">
            <div className={styles.sectionHeader} style={accent ? { '--accent': accent } : undefined}>
              <span
                className={`${styles.chip} ${accent ? styles.accented : ''}`}
                data-testid="column-chip"
              >
                {col.name}
              </span>
              <span className={styles.count} data-testid="list-section-count">{colCards.length}</span>
            </div>
            {colCards.map(card => (
              <ListRow key={card.id} card={card} labels={labels}
                subtasks={subtasks.filter(s => s.cardId === card.id)}
                onClick={onCardClick} />
            ))}
          </section>
        );
      })}
    </div>
  );
}
