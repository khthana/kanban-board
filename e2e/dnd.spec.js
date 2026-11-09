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

test('dragged card shows the same Subtask progress and assignees as the resting card', async ({ page }) => {
  await register(page, `user-${uid()}@test.com`, PW, 'Test User');

  await page.fill('input[placeholder="New board name…"]', 'Overlay Board');
  await Promise.all([
    page.waitForResponse(r => r.url().includes('/boards') && r.request().method() === 'POST' && r.status() === 201),
    page.click('button:has-text("Create Board")'),
  ]);
  await page.getByRole('link', { name: 'Overlay Board' }).click();

  await page.click('text=+ Add column');
  await page.fill('input[placeholder="Column name…"]', 'Todo');
  await Promise.all([
    page.waitForResponse(r => r.url().includes('/columns') && r.request().method() === 'POST' && r.status() === 201),
    page.getByRole('button', { name: 'Add', exact: true }).click(),
  ]);
  await page.click('text=+ New card');
  await page.fill('textarea[placeholder="Card title…"]', 'Carry Me');
  await Promise.all([
    page.waitForResponse(r => r.url().includes('/cards') && r.request().method() === 'POST' && r.status() === 201),
    page.getByRole('button', { name: 'Add card', exact: true }).click(),
  ]);

  // Assign myself, add two Subtasks, tick one
  await page.getByText('Carry Me', { exact: true }).click();
  await Promise.all([
    page.waitForResponse(r => /\/assignees\//.test(r.url()) && r.request().method() === 'PUT' && r.status() === 200),
    page.locator('[data-testid="assignee-toggle"]').first().click(),
  ]);
  await page.locator('button:has-text("+ Add subtask")').click();
  const input = page.locator('input[placeholder="Subtask title…"]');
  for (const title of ['One', 'Two']) {
    await input.fill(title);
    await Promise.all([
      page.waitForResponse(r => r.url().includes('/subtasks') && r.request().method() === 'POST' && r.status() === 201),
      input.press('Enter'),
    ]);
  }
  await page.keyboard.press('Escape');
  await Promise.all([
    page.waitForResponse(r => r.url().includes('/subtasks/') && r.request().method() === 'PATCH' && r.status() === 200),
    page.locator('[data-testid="subtask-row"]').filter({ hasText: 'One' }).locator('input[type="checkbox"]').click(),
  ]);
  await page.locator('button[title="Close panel"]').click();

  const resting = page.locator('[data-testid="column"]').getByRole('button', { name: /Carry Me/ });
  await expect(resting.locator('[data-testid="card-progress"]')).toHaveText(/1\/2/);
  await expect(resting.locator('[data-testid="avatar-stack"] > div')).toHaveCount(1);

  // Pick the card up (past the 8px activation distance) and hold it mid-drag
  const box = await resting.boundingBox();
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width / 2 + 40, box.y + box.height / 2 + 40, { steps: 5 });

  const overlay = page.locator('[class*="overlay"]').filter({ hasText: 'Carry Me' });
  await expect(overlay).toBeVisible();
  await expect(overlay.locator('[data-testid="card-progress"]')).toHaveText(/1\/2/);
  await expect(overlay.locator('[data-testid="avatar-stack"] > div')).toHaveCount(1);

  await page.mouse.up();
});
