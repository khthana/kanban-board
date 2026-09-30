const { test, expect } = require('@playwright/test');
const { uid, register, pointerDrag } = require('./helpers');

const PW = 'password1';

async function openBoard(page) {
  await register(page, `user-${uid()}@test.com`, PW, 'Test User');
  await page.fill('input[placeholder="New board name…"]', 'Deleted Card Board');
  await Promise.all([
    page.waitForResponse(r => r.url().includes('/boards') && r.request().method() === 'POST' && r.status() === 201),
    page.click('button:has-text("Create Board")'),
  ]);
  await page.getByRole('link', { name: 'Deleted Card Board' }).click();
  await expect(page).toHaveURL(/\/boards\//);
}

async function addColumn(page, name) {
  await page.click('text=+ Add column');
  await page.fill('input[placeholder="Column name…"]', name);
  await Promise.all([
    page.waitForResponse(r => r.url().includes('/columns') && r.request().method() === 'POST' && r.status() === 201),
    page.getByRole('button', { name: 'Add', exact: true }).click(),
  ]);
}

// Adds a card to the named column and returns its server id.
async function addCard(page, columnName, title) {
  const col = page.locator('[data-testid="column"]').filter({ hasText: columnName });
  await col.getByText('+ New card').click();
  await page.fill('textarea[placeholder="Card title…"]', title);
  const [res] = await Promise.all([
    page.waitForResponse(r => r.url().includes('/cards') && r.request().method() === 'POST' && r.status() === 201),
    page.getByRole('button', { name: 'Add card', exact: true }).click(),
  ]);
  await expect(col.getByText(title)).toBeVisible();
  return (await res.json()).id;
}

// Delete a card server-side, as another member would, bypassing this tab's store.
async function deleteCardOnServer(page, cardId) {
  const status = await page.evaluate(async id => {
    const res = await fetch(`/cards/${id}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${localStorage.getItem('kanban_token')}` },
    });
    return res.status;
  }, cardId);
  expect(status).toBe(204);
}

test('dragging a card another member deleted removes it instead of snapping back', async ({ page }) => {
  await openBoard(page);
  await addColumn(page, 'Column A');
  await addColumn(page, 'Column B');
  const cardId = await addCard(page, 'Column A', 'Gone Card');
  await deleteCardOnServer(page, cardId);

  const colA = page.locator('[data-testid="column"]').filter({ hasText: 'Column A' });
  const colB = page.locator('[data-testid="column"]').filter({ hasText: 'Column B' });
  await Promise.all([
    page.waitForResponse(r => r.url().includes(`/cards/${cardId}`) && r.request().method() === 'PATCH' && r.status() === 404),
    pointerDrag(page, colA.getByRole('button', { name: 'Gone Card' }), colB.locator('[class*="cards"]')),
  ]);

  await expect(page.getByText('Gone Card')).toHaveCount(0);
  await expect(page.getByText('card not found')).toBeVisible();
});

test('the Card panel closes when polling finds its card was deleted', async ({ page }) => {
  await openBoard(page);
  await addColumn(page, 'To Do');
  const cardId = await addCard(page, 'To Do', 'Watched Card');

  await page.getByText('Watched Card', { exact: true }).click();
  await expect(page.locator('aside')).toBeVisible();

  await deleteCardOnServer(page, cardId);

  // Polling runs every 10s; allow one full interval plus slack.
  await expect(page.locator('aside')).toHaveCount(0, { timeout: 15000 });
  await expect(page.getByText('This card was deleted by another member.')).toBeVisible();
});

test('the Card panel opened from List view also closes when its card was deleted', async ({ page }) => {
  await openBoard(page);
  await addColumn(page, 'To Do');
  const cardId = await addCard(page, 'To Do', 'Listed Card');

  await page.getByRole('tab', { name: 'List' }).click();
  await page.locator('[data-testid="list-row"]').filter({ hasText: 'Listed Card' }).click();
  await expect(page.locator('aside')).toBeVisible();

  await deleteCardOnServer(page, cardId);

  await expect(page.locator('aside')).toHaveCount(0, { timeout: 15000 });
  await expect(page.locator('[data-testid="list-row"]')).toHaveCount(0);
  await expect(page.getByText('This card was deleted by another member.')).toBeVisible();
});
