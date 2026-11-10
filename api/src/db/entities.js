// One row description per entity (#82): the columns a route returns (`returns` —
// every create / PATCH RETURNING and the entity's own SELECT in the GET /boards/:id
// snapshot) and which request fields a PATCH may set, each with its validator.
// Adding a Card field = add it here (+ the migration and client.js's mapper).
// Joins and aggregations (label_ids, assignees, the board's members) stay
// hand-written in the routes.
import {
  validateBoardName, validateColumnName, validateLabelName, validateCardTitle,
  validateCardDescription, validateSubtaskTitle, validateLabelColor, validateDisplayName,
} from '../../../src/domain/validation.js';
import { isValidHex } from '../lib/validation.js';

const trim = v => v.trim();
// The shared validators expect a string; anything else is the same "required"
// error. They see the trimmed value — what is stored — so surrounding spaces
// don't count towards the length limit.
const text = validator => v => validator(typeof v === 'string' ? v.trim() : '');
const columnColor = v => (v === null || isValidHex(v) ? null : 'color must be a valid hex color');

// fields are keyed by DB column:
//   { from?: request body key (default: the column name),
//     validate?(value) → error | null, transform?(value) → stored value }
export const board = {
  table: 'boards',
  returns: ['id', 'name', 'owner_id', 'created_at'],
  fields: { name: { validate: text(validateBoardName), transform: trim } },
  touch: true,
};

export const column = {
  table: 'columns',
  returns: ['id', 'board_id', 'name', 'position', 'color'],
  fields: {
    name: { validate: text(validateColumnName), transform: trim },
    position: {},
    color: { validate: columnColor },
  },
  touch: true,
};

export const label = {
  table: 'labels',
  returns: ['id', 'board_id', 'name', 'color'],
  fields: {
    name: { validate: text(validateLabelName), transform: trim },
    color: { validate: validateLabelColor },
  },
  touch: true,
};

export const card = {
  table: 'cards',
  returns: ['id', 'column_id', 'title', 'description', 'due_date', 'position', 'category_label_id', 'completed_at'],
  fields: {
    title: { validate: text(validateCardTitle), transform: trim },
    description: { validate: v => (v === null || typeof v === 'string' ? validateCardDescription(v) : 'description must be a string') },
    due_date: {},
    column_id: {},
    position: {},
    category_label_id: {},
    completed_at: {},
  },
  touch: true,
};

// The signed-in user's own profile (PATCH /auth/me); the route answers in camelCase.
export const user = {
  table: 'users',
  returns: ['id', 'email', 'display_name'],
  fields: {
    display_name: { from: 'displayName', validate: text(validateDisplayName), transform: trim },
    email: {
      validate: v => (typeof v === 'string' && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v.trim()) ? null : 'invalid email'),
      transform: v => v.toLowerCase().trim(),
    },
  },
  touch: true,
};

export const subtask = {
  table: 'subtasks',
  returns: ['id', 'card_id', 'title', 'checked', 'position'],
  fields: {
    title: { validate: text(validateSubtaskTitle), transform: trim },
    position: {},
    checked: {},
  },
  touch: false, // subtasks have no updated_at
};

// The entity's returned columns, as a SELECT / RETURNING list (optionally
// qualified by a table alias).
export function columnList(entity, alias) {
  return entity.returns.map(c => (alias ? `${alias}.${c}` : c)).join(', ');
}

// Validates the entity's fields present in `body` → { error } or
// { values: { column: stored value } }. `only` limits which fields are read (a
// create takes fewer than a PATCH); `required` ones must be present. No fields
// at all → an error, so a PATCH can't be empty.
export function checkFields(entity, body, { only, required = [] } = {}) {
  const values = {};
  for (const [name, { from = name, validate, transform }] of Object.entries(entity.fields)) {
    if (only && !only.includes(name)) continue;
    const value = body?.[from];
    if (value === undefined) {
      if (required.includes(name)) return { error: validate?.(undefined) ?? `${from} is required` };
      continue;
    }
    const error = validate?.(value);
    if (error) return { error };
    values[name] = transform && value !== null ? transform(value) : value;
  }
  if (Object.keys(values).length === 0) {
    const names = Object.entries(entity.fields).filter(([n]) => !only || only.includes(n)).map(([n, f]) => f.from ?? n);
    return { error: `one of ${names.join(', ')} required` };
  }
  return { values };
}

// UPDATE … SET <values> WHERE id = $id RETURNING <the entity's columns> →
// the row, or null when it's gone. `values` comes from checkFields.
export async function updateRow(client, entity, id, values) {
  const names = Object.keys(values);
  const sets = names.map((name, i) => `${name} = $${i + 1}`);
  if (entity.touch) sets.push('updated_at = now()');
  const { rows } = await client.query(
    `UPDATE ${entity.table} SET ${sets.join(', ')} WHERE id = $${names.length + 1} RETURNING ${columnList(entity)}`,
    [...names.map(n => values[n]), id]
  );
  return rows[0] ?? null;
}
