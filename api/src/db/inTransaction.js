import pool from './pool.js';

// Runs fn(client) inside BEGIN/COMMIT on one pooled client; rolls back and
// rethrows if fn throws.
export default async function inTransaction(fn) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await fn(client);
    await client.query('COMMIT');
    return result;
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}
