import { cardView } from '../domain/cardView';
import { columnViews } from '../domain/columnView';
import ListRow from './ListRow';
import ColumnComposer from './ColumnComposer';
import CardComposer from './CardComposer';
import styles from './ListView.module.css';

export default function ListView({ board, onAddColumn, onCardClick, onAddCard, style }) {
  const views = columnViews(board);
  return (
    <div className={styles.list} data-testid="list-view" style={style}>
      {views.length === 0 && <ColumnComposer onAdd={onAddColumn} />}
      {views.map(({ column, accent, cards, count }) => (
        <section key={column.id} className={styles.section} data-testid="list-section">
          <div className={styles.sectionHeader} style={accent ? { '--accent': accent } : undefined}>
            <span
              className={`${styles.chip} ${accent ? styles.accented : ''}`}
              data-testid="column-chip"
            >
              {column.name}
            </span>
            <span className={styles.count} data-testid="list-section-count">{count}</span>
          </div>
          {cards.map(card => (
            <ListRow key={card.id} card={card} face={cardView(board, card)} onClick={onCardClick} />
          ))}
          <CardComposer accent={accent} onAdd={title => onAddCard(column.id, title)} />
        </section>
      ))}
    </div>
  );
}
