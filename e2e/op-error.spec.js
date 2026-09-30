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

// Adds a card to the first column and opens its Card panel.
async function openNewCard(page, title) {
  await page.click('text=+ New card');
  await page.fill('textarea[placeholder="Card title…"]', title);
  await Promise.all([
    page.waitForResponse(r => r.url().includes('/cards') && r.request().method() === 'POST' && r.status() === 201),
    page.getByRole('button', { name: 'Add card', exact: true }).click(),
  ]);
  await page.getByText(title, { exact: true }).click();
  await expect(page.locator('aside')).toBeVisible();
}

function collectPageErrors(page) {
  const errors = [];
  page.on('pageerror', err => errors.push(err.message));
  return errors;
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

  await openNewCard(page, `Task-${uid()}`);

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
  const errors = collectPageErrors(page);
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

test('a failed label create from the Card panel rolls back and shows the error banner', async ({ page }) => {
  const errors = collectPageErrors(page);
  await openBoardWithColumn(page);
  await openNewCard(page, 'Label Card');
  await failRequests(page, '**/boards/*/labels', 'POST');

  await page.click('button:has-text("+ Create label")');
  await page.fill('input[placeholder="Label name"]', 'Doomed');
  await page.getByRole('button', { name: 'Create', exact: true }).click();

  await expect(page.getByText('Server error')).toBeVisible();
  await expect(page.locator('aside').getByText('Doomed')).toHaveCount(0);
  expect(errors).toEqual([]);
});

test('a failed assignee toggle rolls back and shows the error banner', async ({ page }) => {
  const errors = collectPageErrors(page);
  await openBoardWithColumn(page);
  await openNewCard(page, 'Assign Card');
  await failRequests(page, '**/cards/*/assignees/*', 'PUT');

  const toggle = page.locator('[data-testid="assignee-toggle"]').first();
  await toggle.click();

  await expect(page.getByText('Server error')).toBeVisible();
  await expect(toggle).toHaveAttribute('aria-pressed', 'false');
  expect(errors).toEqual([]);
});

test('a failed card delete restores the card and shows the error banner', async ({ page }) => {
  const errors = collectPageErrors(page);
  await openBoardWithColumn(page);
  await openNewCard(page, 'Stubborn Card');
  await failRequests(page, '**/cards/*', 'DELETE');

  page.on('dialog', d => d.accept());
  await page.click('button:has-text("Delete card")');

  await expect(page.getByText('Server error')).toBeVisible();
  await expect(page.locator('[data-testid="column"]').getByText('Stubborn Card')).toBeVisible();
  expect(errors).toEqual([]);
});

test('a failed column create rolls back and shows the error banner', async ({ page }) => {
  const errors = collectPageErrors(page);
  await openBoardWithColumn(page);
  await failRequests(page, '**/boards/*/columns', 'POST');

  await page.click('text=+ Add column');
  await page.fill('input[placeholder="Column name…"]', 'Never Lands');
  await page.getByRole('button', { name: 'Add', exact: true }).click();

  await expect(page.getByText('Server error')).toBeVisible();
  await expect(page.locator('[data-testid="column"]')).toHaveCount(1);
  expect(errors).toEqual([]);
});

test('a failed label attach leaves no Category behind, even after reload (#55)', async ({ page }) => {
  const errors = collectPageErrors(page);
  await openBoardWithColumn(page);
  await openNewCard(page, 'Category Card');

  await page.click('button:has-text("+ Create label")');
  await page.fill('input[placeholder="Label name"]', 'Backend');
  await Promise.all([
    page.waitForResponse(r => /\/labels/.test(r.url()) && r.request().method() === 'POST' && r.status() === 201),
    page.getByRole('button', { name: 'Create', exact: true }).click(),
  ]);

  await failRequests(page, '**/cards/*/labels/*', 'PUT');
  await page.locator('aside button', { hasText: 'Backend' }).first().click();

  await expect(page.getByText('Server error')).toBeVisible();
  await expect(page.locator('[data-testid="set-category"]')).toHaveCount(0); // not attached
  await page.locator('button[title="Close panel"]').click();
  await expect(page.locator('[data-testid="card-category"]')).toHaveCount(0);

  // Board view only renders a Category that is among the card's attached labels,
  // so an orphaned category_label_id would hide there — check the server snapshot.
  const [snapshot] = await Promise.all([
    page.waitForResponse(r => /\/boards\/[^/]+$/.test(r.url()) && r.request().resourceType() === 'fetch' && r.status() === 200),
    page.reload(),
  ]);
  const { columns } = await snapshot.json();
  expect(columns.flatMap(c => c.cards).map(c => c.category_label_id)).toEqual([null]);
  await expect(page.getByText('Category Card', { exact: true })).toBeVisible();
  await expect(page.locator('[data-testid="card-category"]')).toHaveCount(0);
  expect(errors).toEqual([]);
});
