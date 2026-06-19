const { Pool, types } = require('pg');

// DATE (OID 1082): return the raw 'YYYY-MM-DD' string instead of a JS Date.
// node-pg's default parses to a Date at the server's local midnight, which JSON
// serializes back to UTC and shifts the calendar day for non-UTC servers
// (e.g. UTC+7). Keeping the string makes due_date / completed_at timezone-safe.
types.setTypeParser(1082, v => v);

const isTest = process.env.NODE_ENV === 'test';
const url = isTest ? process.env.TEST_DATABASE_URL : process.env.DATABASE_URL;

if (!url) {
  throw new Error(`${isTest ? 'TEST_DATABASE_URL' : 'DATABASE_URL'} is not set`);
}

const pool = new Pool({ connectionString: url });

module.exports = pool;
