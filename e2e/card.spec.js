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

test('edit card title inline in the panel → persist on refresh', async ({ page }) => {
  const title = `Task-${uid()}`;
  await register(page, `user-${uid()}@test.com`, PW, 'Test User');

  await page.fill('input[placeholder="New board name…"]', 'Title Board');
  await Promise.all([
    page.waitForResponse(r => r.url().includes('/boards') && r.request().method() === 'POST' && r.status() === 201),
    page.click('button:has-text("Create Board")'),
  ]);
  await page.getByRole('link', { name: 'Title Board' }).click();
  await expect(page).toHaveURL(/\/boards\//);

  await page.click('text=+ Add column');
  await page.fill('input[placeholder="Column name…"]', 'Todo');
  await Promise.all([
    page.waitForResponse(r => r.url().includes('/columns') && r.request().method() === 'POST' && r.status() === 201),
    page.getByRole('button', { name: 'Add', exact: true }).click(),
  ]);

  await page.click('text=+ New card');
  await page.fill('textarea[placeholder="Card title…"]', title);
  await Promise.all([
    page.waitForResponse(r => r.url().includes('/cards') && r.request().method() === 'POST' && r.status() === 201),
    page.getByRole('button', { name: 'Add card', exact: true }).click(),
  ]);
  await expect(page.getByText(title)).toBeVisible();

  // Open the panel, click the title, rename, commit with Enter
  await page.getByText(title, { exact: true }).click();
  await expect(page.locator('aside')).toBeVisible();
  await page.locator('[data-testid="card-title"]').click();
  const input = page.locator('[data-testid="card-title-input"]');
  await input.fill('Renamed Task');
  await Promise.all([
    page.waitForResponse(r => /\/cards\//.test(r.url()) && r.request().method() === 'PATCH' && r.status() === 200),
    input.press('Enter'),
  ]);

  // Reload — the new title persists on the card face
  await page.reload();
  await expect(page.getByText('Renamed Task')).toBeVisible();
  await expect(page.getByText(title)).toHaveCount(0);
});

test('a failed card creation rolls back and shows the error banner', async ({ page }) => {
  await register(page, `user-${uid()}@test.com`, PW, 'Test User');

  await page.fill('input[placeholder="New board name…"]', 'Fail Board');
  await Promise.all([
    page.waitForResponse(r => r.url().includes('/boards') && r.request().method() === 'POST' && r.status() === 201),
    page.click('button:has-text("Create Board")'),
  ]);
  await page.getByRole('link', { name: 'Fail Board' }).click();
  await expect(page).toHaveURL(/\/boards\//);

  await page.click('text=+ Add column');
  await page.fill('input[placeholder="Column name…"]', 'Todo');
  await Promise.all([
    page.waitForResponse(r => r.url().includes('/columns') && r.request().method() === 'POST' && r.status() === 201),
    page.getByRole('button', { name: 'Add', exact: true }).click(),
  ]);

  await page.route('**/columns/*/cards', route =>
    route.fulfill({ status: 500, contentType: 'application/json', body: JSON.stringify({ error: 'Server error' }) })
  );

  await page.click('text=+ New card');
  await page.fill('textarea[placeholder="Card title…"]', 'Should Fail');
  await page.getByRole('button', { name: 'Add card', exact: true }).click();

  await expect(page.getByText('Should Fail')).toHaveCount(0);
  await expect(page.getByText('Dismiss')).toBeVisible();
});
