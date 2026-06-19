import 'dotenv/config';
import { readFileSync, readdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import pg from 'pg';
const { Pool } = pg;

const __dirname = dirname(fileURLToPath(import.meta.url));

async function migrate(connectionString) {
  const pool = new Pool({ connectionString });
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS schema_migrations (
        filename TEXT PRIMARY KEY,
        applied_at TIMESTAMPTZ NOT NULL DEFAULT now()
      )
    `);

    const dir = join(__dirname, 'migrations');
    const files = readdirSync(dir).filter(f => f.endsWith('.sql')).sort();

    for (const file of files) {
      const { rows } = await pool.query(
        'SELECT 1 FROM schema_migrations WHERE filename = $1',
        [file]
      );
      if (rows.length > 0) continue;

      const sql = readFileSync(join(dir, file), 'utf8');
      await pool.query('BEGIN');
      try {
        await pool.query(sql);
        await pool.query('INSERT INTO schema_migrations(filename) VALUES($1)', [file]);
        await pool.query('COMMIT');
        console.log(`Applied: ${file}`);
      } catch (err) {
        await pool.query('ROLLBACK');
        throw err;
      }
    }
  } finally {
    await pool.end();
  }
}

const isMain = process.argv[1] === fileURLToPath(import.meta.url);
if (isMain) {
  const url = process.env.NODE_ENV === 'test'
    ? process.env.TEST_DATABASE_URL
    : process.env.DATABASE_URL;
  migrate(url).catch(err => { console.error(err); process.exit(1); });
}

export { migrate };
