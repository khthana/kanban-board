// Locks the card row for the rest of the caller's transaction and returns
// { id, category_label_id }, or null when the card is gone. Take this lock
// *first*: taking it after an INSERT into a child table whose FK points at the
// card (card_labels, subtasks — the FK check holds KEY SHARE on the card)
// deadlocks two concurrent requests (#55). Serialising on it is also what keeps
// per-card counts (the Subtask limit, #59) from being overshot concurrently.
export default async function lockCard(client, cardId) {
  const { rows } = await client.query(
    `SELECT id, category_label_id FROM cards WHERE id = $1 FOR UPDATE`, [cardId]
  );
  return rows[0] ?? null;
}
