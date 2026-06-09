const { test, expect } = require('@playwright/test');
const { uid, register } = require('./helpers');

const PW = 'password1';

async function setupBoard(page) {
  await register(page, `user-${uid()}@test.com`, PW, 'Test User');

  await page.fill('input[placeholder="New board name…"]', 'Color Board');
  await Promise.all([
    page.waitForResponse(r => r.url().includes('/boards') && r.request().method() === 'POST' && r.status() === 201),
    page.click('button:has-text("Create Board")'),
  ]);
  await page.getByRole('link', { name: 'Color Board' }).click();
  await expect(page).toHaveURL(/\/boards\//);

  await page.click('text=+ Add column');
  await page.fill('input[placeholder="Column name…"]', 'To Do');
  await Promise.all([
    page.waitForResponse(r => r.url().includes('/columns') && r.request().method() === 'POST' && r.status() === 201),
    page.getByRole('button', { name: 'Add', exact: true }).click(),
  ]);
  await expect(page.locator('[data-testid="column"]')).toBeVisible();
}

test('edit form shows 10 color swatches', async ({ page }) => {
  await setupBoard(page);

  await page.click('button[title="Rename column"]');

  const swatches = page.locator('button[data-swatch]');
  await expect(swatches).toHaveCount(10);
});

// Accent model: column.color paints the title chip (pastel pill), not the header strip.
test('pick preset color → title chip background changes', async ({ page }) => {
  await setupBoard(page);

  await page.click('button[title="Rename column"]');
  await page.click('button[data-swatch="#fca5a5"]');

  await Promise.all([
    page.waitForResponse(r => r.url().includes('/columns/') && r.request().method() === 'PATCH' && r.status() === 200),
    page.click('button:has-text("Save")'),
  ]);

  const chip = page.locator('[data-testid="column-chip"]').first();
  const bg = await chip.evaluate(el => getComputedStyle(el).backgroundColor);
  // #fca5a5 = rgb(252, 165, 165)
  expect(bg).toBe('rgb(252, 165, 165)');
});

test('color persists after reload', async ({ page }) => {
  await setupBoard(page);

  await page.click('button[title="Rename column"]');
  await page.click('button[data-swatch="#fca5a5"]');
  await Promise.all([
    page.waitForResponse(r => r.url().includes('/columns/') && r.request().method() === 'PATCH' && r.status() === 200),
    page.click('button:has-text("Save")'),
  ]);

  await page.reload();
  await page.waitForSelector('[data-testid="column"]');

  const chip = page.locator('[data-testid="column-chip"]').first();
  const bg = await chip.evaluate(el => getComputedStyle(el).backgroundColor);
  expect(bg).toBe('rgb(252, 165, 165)');
});

test('clear color → chip reverts to neutral default', async ({ page }) => {
  await setupBoard(page);

  // Set color first
  await page.click('button[title="Rename column"]');
  await page.click('button[data-swatch="#fca5a5"]');
  await Promise.all([
    page.waitForResponse(r => r.url().includes('/columns/') && r.request().method() === 'PATCH' && r.status() === 200),
    page.click('button:has-text("Save")'),
  ]);

  // Clear it
  await page.click('button[title="Rename column"]');
  await page.click('button[data-swatch="clear"]');
  await Promise.all([
    page.waitForResponse(r => r.url().includes('/columns/') && r.request().method() === 'PATCH' && r.status() === 200),
    page.click('button:has-text("Save")'),
  ]);

  const chip = page.locator('[data-testid="column-chip"]').first();
  const bg = await chip.evaluate(el => getComputedStyle(el).backgroundColor);
  // No accent → chip falls back to the neutral gray #e2e8f0 = rgb(226, 232, 240)
  expect(bg).toBe('rgb(226, 232, 240)');
});
