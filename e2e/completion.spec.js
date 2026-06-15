const { test, expect } = require('@playwright/test');
const { uid, register } = require('./helpers');

const PW = 'password1';

test('mark a card done → badge + persists → unmark', async ({ page }) => {
  await register(page, `done-${uid()}@test.com`, PW, 'Done User');

  await page.fill('input[placeholder="New board name…"]', 'Done Board');
  await page.click('button:has-text("Create Board")');
  await page.getByRole('link', { name: 'Done Board' }).click();
  await expect(page).toHaveURL(/\/boards\//);

  await page.click('text=+ Add column');
  await page.fill('input[placeholder="Column name…"]', 'Todo');
  await page.getByRole('button', { name: 'Add', exact: true }).click();

  await page.click('text=+ New card');
  await page.fill('textarea[placeholder="Card title…"]', 'Finish me');
  await Promise.all([
    page.waitForResponse(r => /\/cards/.test(r.url()) && r.request().method() === 'POST' && r.status() === 201),
    page.getByRole('button', { name: 'Add card', exact: true }).click(),
  ]);

  // Open the panel and mark the card done
  await page.getByText('Finish me').click();
  await Promise.all([
    page.waitForResponse(r => /\/cards\/[^/]+$/.test(r.url()) && r.request().method() === 'PATCH' && r.status() === 200),
    page.locator('[data-testid="complete-toggle"]').click(),
  ]);

  await page.locator('button[title="Close panel"]').click();
  await expect(page.locator('[data-testid="card-done-badge"]')).toBeVisible();

  // Persists after reload
  await page.reload();
  await expect(page.locator('[data-testid="card-done-badge"]')).toBeVisible();

  // Un-mark → badge gone
  await page.getByText('Finish me').click();
  await Promise.all([
    page.waitForResponse(r => /\/cards\/[^/]+$/.test(r.url()) && r.request().method() === 'PATCH' && r.status() === 200),
    page.locator('[data-testid="complete-toggle"]').click(),
  ]);
  await page.locator('button[title="Close panel"]').click();
  await expect(page.locator('[data-testid="card-done-badge"]')).toHaveCount(0);
});
