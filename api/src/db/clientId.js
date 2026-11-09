import { isUuid } from '../lib/validation.js';

// Client-chosen ids (#71): a create may name the new record's id, so the
// client's optimistic placeholder already carries the real one. Omitted → the
// server generates it; otherwise it must be a UUID (400), and one that is
// already taken fails the INSERT with a primary-key violation (409).
export const CLIENT_ID_ERROR = 'id must be a UUID';
export const ID_TAKEN_ERROR = 'id already exists';

export function isClientId(value) {
  return value === undefined || isUuid(value);
}

// 23505 = unique violation; only the primary key's (`<table>_pkey`) means the
// supplied id is taken, so a future unique constraint isn't misread as one.
export function isIdTaken(err) {
  return err?.code === '23505' && /_pkey$/.test(err.constraint ?? '');
}
