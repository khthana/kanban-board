import { migrate } from '../db/migrate.js';

export default async function () {
  process.env.NODE_ENV = 'test';
  const url = process.env.TEST_DATABASE_URL || 'postgres://postgres:@127.0.0.1:5432/kanban_test';
  await migrate(url);
}
