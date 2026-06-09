const { test, expect } = require('@playwright/test');
const { uid, register } = require('./helpers');

const PW = 'password1';

test('set a label as category → card face shows the category', async ({ page }) => {
  await register(page, `cat-${uid()}@test.com`, PW, 'Cat User');

  await page.fill('input[placeholder="New board name…"]', 'Cat Board');
  await page.click('button:has-text("Create Board")');
  await page.getByRole('link', { name: 'Cat Board' }).click();
  await expect(page).toHaveURL(/\/boards\//);

  await page.click('text=+ Add column');
  await page.fill('input[placeholder="Column name…"]', 'Todo');
  await page.getByRole('button', { name: 'Add', exact: true }).click();

  await page.click('text=+ New card');
  await page.fill('textarea[placeholder="Card title…"]', 'Categorized task');
  await Promise.all([
    page.waitForResponse(r => /\/cards/.test(r.url()) && r.request().method() === 'POST' && r.status() === 201),
    page.getByRole('button', { name: 'Add card', exact: true }).click(),
  ]);

  await page.getByText('Categorized task').click();

  // Create a label (default color)
  await page.click('button:has-text("+ Create label")');
  await page.fill('input[placeholder="Label name"]', 'Backend');
  await Promise.all([
    page.waitForResponse(r => /\/labels/.test(r.url()) && r.request().method() === 'POST' && r.status() === 201),
    page.getByRole('button', { name: 'Create', exact: true }).click(),
  ]);

  // Attach it to the card
  await Promise.all([
    page.waitForResponse(r => /\/labels\//.test(r.url()) && r.request().method() === 'PUT' && r.status() === 200),
    page.locator('aside button', { hasText: 'Backend' }).first().click(),
  ]);

  // Mark it as the category, waiting for the category PATCH to persist
  await Promise.all([
    page.waitForResponse(r => /\/cards\/[^/]+$/.test(r.url()) && r.request().method() === 'PATCH'),
    page.locator('[data-testid="set-category"]').click(),
  ]);

  await page.locator('button[title="Close panel"]').click();
  await expect(page.locator('[data-testid="card-category"]')).toContainText('Backend');

  // Persists after reload
  await page.reload();
  await expect(page.locator('[data-testid="card-category"]')).toContainText('Backend');
});
