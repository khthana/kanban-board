CREATE TABLE IF NOT EXISTS card_assignees (
  card_id UUID NOT NULL REFERENCES cards(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  PRIMARY KEY (card_id, user_id)
);

INSERT INTO card_assignees (card_id, user_id)
  SELECT id, assignee_id FROM cards WHERE assignee_id IS NOT NULL
  ON CONFLICT DO NOTHING;

ALTER TABLE cards DROP COLUMN IF EXISTS assignee_id;
