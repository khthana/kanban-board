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
  // Footer shows the completion date in place of the due date
  await expect(page.locator('[data-testid="card-completed"]')).toContainText('เสร็จ');
  await expect(page.locator('[data-testid="card-due"]')).toHaveCount(0);

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
  // Footer reverts: no completion date, the "no due date" placeholder is back
  await expect(page.locator('[data-testid="card-completed"]')).toHaveCount(0);
});

test('warns before completing a card with unchecked subtasks', async ({ page }) => {
  await register(page, `warn-${uid()}@test.com`, PW, 'Warn User');

  await page.fill('input[placeholder="New board name…"]', 'Warn Board');
  await Promise.all([
    page.waitForResponse(r => r.url().includes('/boards') && r.request().method() === 'POST' && r.status() === 201),
    page.click('button:has-text("Create Board")'),
  ]);
  await page.getByRole('link', { name: 'Warn Board' }).click();
  await expect(page).toHaveURL(/\/boards\//);

  await page.click('text=+ Add column');
  await page.fill('input[placeholder="Column name…"]', 'Todo');
  await Promise.all([
    page.waitForResponse(r => r.url().includes('/columns') && r.request().method() === 'POST' && r.status() === 201),
    page.getByRole('button', { name: 'Add', exact: true }).click(),
  ]);

  await page.click('text=+ New card');
  await page.fill('textarea[placeholder="Card title…"]', 'Guarded task');
  await Promise.all([
    page.waitForResponse(r => r.url().includes('/cards') && r.request().method() === 'POST' && r.status() === 201),
    page.getByRole('button', { name: 'Add card', exact: true }).click(),
  ]);

  // Add one unchecked subtask
  await page.getByText('Guarded task').click();
  await page.locator('button:has-text("+ Add subtask")').click();
  await page.locator('input[placeholder="Subtask title…"]').fill('Step one');
  await Promise.all([
    page.waitForResponse(r => r.url().includes('/subtasks') && r.request().method() === 'POST' && r.status() === 201),
    page.locator('input[placeholder="Subtask title…"]').press('Enter'),
  ]);
  await page.keyboard.press('Escape');

  // Cancel: the confirm reports the count; dismissing leaves the card not done
  let dialogMessage;
  page.once('dialog', d => { dialogMessage = d.message(); d.dismiss(); });
  await page.locator('[data-testid="complete-toggle"]').click();
  expect(dialogMessage).toContain('1/1');
  await page.locator('button[title="Close panel"]').click();
  await expect(page.locator('[data-testid="card-done-badge"]')).toHaveCount(0);

  // Accept: confirming completes the card
  await page.getByText('Guarded task').click();
  page.once('dialog', d => d.accept());
  await Promise.all([
    page.waitForResponse(r => /\/cards\/[^/]+$/.test(r.url()) && r.request().method() === 'PATCH' && r.status() === 200),
    page.locator('[data-testid="complete-toggle"]').click(),
  ]);
  await page.locator('button[title="Close panel"]').click();
  await expect(page.locator('[data-testid="card-done-badge"]')).toBeVisible();
});
