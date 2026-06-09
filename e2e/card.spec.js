const { test, expect } = require('@playwright/test');
const { uid, register } = require('./helpers');

const PW = 'password1';

test('create column + card → persist on refresh', async ({ page }) => {
  await register(page, `user-${uid()}@test.com`, PW, 'Test User');

  await page.fill('input[placeholder="New board name…"]', 'Test Board');
  await page.click('button:has-text("Create Board")');
  await page.getByRole('link', { name: 'Test Board' }).click();
  await expect(page).toHaveURL(/\/boards\//);

  // Add column
  await page.click('text=+ Add column');
  await page.fill('input[placeholder="Column name…"]', 'Todo');
  await page.getByRole('button', { name: 'Add', exact: true }).click();
  await expect(page.getByText('Todo')).toBeVisible();

  // Add card
  await page.click('text=+ New card');
  await page.fill('textarea[placeholder="Card title…"]', 'My Task');
  await page.getByRole('button', { name: 'Add card', exact: true }).click();
  await expect(page.getByText('My Task')).toBeVisible();

  // Refresh — verify both persist
  await page.reload();
  await expect(page.getByText('Todo')).toBeVisible();
  await expect(page.getByText('My Task')).toBeVisible();
});
