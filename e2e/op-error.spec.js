const { test, expect } = require('@playwright/test');
const { uid, register } = require('./helpers');

const PW = 'password1';

// Make every `method` request matching `url` fail with 500; let everything else through.
async function failRequests(page, url, method) {
  await page.route(url, route =>
    route.request().method() === method
      ? route.fulfill({ status: 500, contentType: 'application/json', body: JSON.stringify({ error: 'Server error' }) })
      : route.continue()
  );
}

async function registerAndCreateBoard(page, name) {
  await register(page, `user-${uid()}@test.com`, PW, 'Test User');
  await page.fill('input[placeholder="New board name…"]', name);
  await Promise.all([
    page.waitForResponse(r => r.url().includes('/boards') && r.request().method() === 'POST' && r.status() === 201),
    page.click('button:has-text("Create Board")'),
  ]);
}

async function openBoardWithColumn(page) {
  await registerAndCreateBoard(page, 'Error Board');
  await page.getByRole('link', { name: 'Error Board' }).click();
  await expect(page).toHaveURL(/\/boards\//);

  await page.click('text=+ Add column');
  await page.fill('input[placeholder="Column name…"]', 'To Do');
  await Promise.all([
    page.waitForResponse(r => r.url().includes('/columns') && r.request().method() === 'POST' && r.status() === 201),
    page.getByRole('button', { name: 'Add', exact: true }).click(),
  ]);
  await expect(page.locator('[data-testid="column-chip"]')).toHaveText('To Do');
}

test('a failed column rename rolls back and shows the error banner', async ({ page }) => {
  await openBoardWithColumn(page);
  await failRequests(page, '**/columns/*', 'PATCH');

  await page.click('button[title="Rename column"]');
  await page.locator('[data-testid="column"] input').first().fill('Renamed');
  await page.click('button:has-text("Save")');

  await expect(page.getByText('Dismiss')).toBeVisible();
  await expect(page.locator('[data-testid="column-chip"]')).toHaveText('To Do');
});

test('a failed subtask toggle rolls back and shows the error banner', async ({ page }) => {
  await openBoardWithColumn(page);

  const cardTitle = `Task-${uid()}`;
  await page.click('text=+ New card');
  await page.fill('textarea[placeholder="Card title…"]', cardTitle);
  await Promise.all([
    page.waitForResponse(r => r.url().includes('/cards') && r.request().method() === 'POST' && r.status() === 201),
    page.getByRole('button', { name: 'Add card', exact: true }).click(),
  ]);
  await page.getByText(cardTitle, { exact: true }).click();
  await expect(page.locator('aside')).toBeVisible();

  await page.click('button:has-text("+ Add subtask")');
  const input = page.locator('input[placeholder="Subtask title…"]');
  await input.fill('Step one');
  await Promise.all([
    page.waitForResponse(r => r.url().includes('/subtasks') && r.request().method() === 'POST' && r.status() === 201),
    input.press('Enter'),
  ]);
  await page.keyboard.press('Escape');

  await failRequests(page, '**/subtasks/*', 'PATCH');
  await page.locator('aside input[type="checkbox"]').click();

  await expect(page.getByText('Dismiss')).toBeVisible();
  await expect(page.locator('aside input[type="checkbox"]')).not.toBeChecked();
});

test('a failed board rename rolls back, closes the form, and shows the error', async ({ page }) => {
  const errors = [];
  page.on('pageerror', err => errors.push(err.message));

  await registerAndCreateBoard(page, 'Keep Me');
  await failRequests(page, '**/boards/*', 'PATCH');

  await page.click('button[title="Rename"]');
  await page.fill('input[value="Keep Me"]', 'Should Not Stick');
  await page.click('button:has-text("Save")');

  await expect(page.getByText('Server error')).toBeVisible();
  await expect(page.getByRole('link', { name: 'Keep Me' })).toBeVisible();
  await expect(page.locator('input[value="Should Not Stick"]')).toHaveCount(0);
  expect(errors).toEqual([]);
});
