const { migrate } = require('../db/migrate');

module.exports = async () => {
  process.env.NODE_ENV = 'test';
  const url = process.env.TEST_DATABASE_URL || 'postgres://postgres:@127.0.0.1:5432/kanban_test';
  await migrate(url);
};
