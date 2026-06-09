const { test, expect } = require('@playwright/test');
const { uid, register, pointerDrag } = require('./helpers');

const PW = 'password1';

test('drag card cross-column → persist on refresh', async ({ page }) => {
  await register(page, `user-${uid()}@test.com`, PW, 'Test User');

  await page.fill('input[placeholder="New board name…"]', 'DnD Board');
  await page.click('button:has-text("Create Board")');
  await page.getByRole('link', { name: 'DnD Board' }).click();

  // Create two columns
  await page.click('text=+ Add column');
  await page.fill('input[placeholder="Column name…"]', 'Column A');
  await page.getByRole('button', { name: 'Add', exact: true }).click();

  await page.click('text=+ Add column');
  await page.fill('input[placeholder="Column name…"]', 'Column B');
  await page.getByRole('button', { name: 'Add', exact: true }).click();

  // Add card to Column A
  const colA = page.locator('[data-testid="column"]').filter({ hasText: 'Column A' });
  await colA.getByText('+ New card').click();
  await page.fill('textarea[placeholder="Card title…"]', 'Drag Me');
  await page.getByRole('button', { name: 'Add card', exact: true }).click();
  await expect(colA.getByText('Drag Me')).toBeVisible();

  // Drag card from Column A to Column B's card drop zone
  const card = colA.getByRole('button', { name: 'Drag Me' });
  const colB = page.locator('[data-testid="column"]').filter({ hasText: 'Column B' });
  const colBCards = colB.locator('[class*="cards"]');
  await pointerDrag(page, card, colBCards);

  // Verify move (optimistic)
  await expect(colB.getByText('Drag Me')).toBeVisible();
  await expect(colA.getByText('Drag Me')).not.toBeVisible();

  // Refresh — verify persist
  await page.reload();
  await expect(page.locator('[data-testid="column"]').filter({ hasText: 'Column B' }).getByText('Drag Me')).toBeVisible();
});
