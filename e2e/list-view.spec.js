const { test, expect } = require('@playwright/test');
const { uid, register, login, pointerDrag } = require('./helpers');

const PW = 'password1';

async function setupBoard(page) {
  await register(page, `user-${uid()}@test.com`, PW, 'Test User');

  await page.fill('input[placeholder="New board name…"]', 'List Board');
  await Promise.all([
    page.waitForResponse(r => r.url().includes('/boards') && r.request().method() === 'POST' && r.status() === 201),
    page.click('button:has-text("Create Board")'),
  ]);
  await page.getByRole('link', { name: 'List Board' }).click();
  await expect(page).toHaveURL(/\/boards\//);

  await page.click('text=+ Add column');
  await page.fill('input[placeholder="Column name…"]', 'To Do');
  await Promise.all([
    page.waitForResponse(r => r.url().includes('/columns') && r.request().method() === 'POST' && r.status() === 201),
    page.getByRole('button', { name: 'Add', exact: true }).click(),
  ]);
  await expect(page.locator('[data-testid="column"]')).toBeVisible();
}

async function addColumn(page, name) {
  await page.click('text=+ Add column');
  await page.fill('input[placeholder="Column name…"]', name);
  await Promise.all([
    page.waitForResponse(r => r.url().includes('/columns') && r.request().method() === 'POST' && r.status() === 201),
    page.getByRole('button', { name: 'Add', exact: true }).click(),
  ]);
}

// Creates a card via Board view's composer (List view doesn't add cards yet — that's a later slice).
async function addCard(page, title) {
  await page.click('text=+ New card');
  await page.fill('textarea[placeholder="Card title…"]', title);
  await Promise.all([
    page.waitForResponse(r => r.url().includes('/cards') && r.request().method() === 'POST' && r.status() === 201),
    page.getByRole('button', { name: 'Add card', exact: true }).click(),
  ]);
}

test('clicking List switches to List view; clicking Board switches back', async ({ page }) => {
  await setupBoard(page);

  await expect(page.locator('[data-testid="column"]')).toBeVisible();
  await expect(page.locator('[data-testid="list-view"]')).not.toBeVisible();

  await page.getByRole('tab', { name: 'List' }).click();

  await expect(page.locator('[data-testid="list-view"]')).toBeVisible();
  await expect(page.locator('[data-testid="column"]')).toHaveCount(0);

  await page.getByRole('tab', { name: 'Board' }).click();

  await expect(page.locator('[data-testid="column"]')).toBeVisible();
  await expect(page.locator('[data-testid="list-view"]')).toHaveCount(0);
});

test('List view renders one section per column, in position order, with name and card count', async ({ page }) => {
  await setupBoard(page);
  await addColumn(page, 'Doing');

  await page.getByRole('tab', { name: 'List' }).click();

  const sections = page.locator('[data-testid="list-section"]');
  await expect(sections).toHaveCount(2);

  await expect(sections.nth(0).locator('[data-testid="column-chip"]')).toHaveText('To Do');
  await expect(sections.nth(0).locator('[data-testid="list-section-count"]')).toHaveText('0');

  await expect(sections.nth(1).locator('[data-testid="column-chip"]')).toHaveText('Doing');
  await expect(sections.nth(1).locator('[data-testid="list-section-count"]')).toHaveText('0');
});

test('cards within a section render as rows, sorted by position', async ({ page }) => {
  await setupBoard(page);
  await addCard(page, 'First Card');
  await addCard(page, 'Second Card');

  await page.getByRole('tab', { name: 'List' }).click();

  const rows = page.locator('[data-testid="list-row"]');
  await expect(rows).toHaveCount(2);
  await expect(rows.nth(0)).toContainText('First Card');
  await expect(rows.nth(1)).toContainText('Second Card');

  const section = page.locator('[data-testid="list-section"]').first();
  await expect(section.locator('[data-testid="list-section-count"]')).toHaveText('2');
});

test('a board with no columns shows the column composer in List view', async ({ page }) => {
  await register(page, `user-${uid()}@test.com`, PW, 'Test User');

  await page.fill('input[placeholder="New board name…"]', 'Empty Board');
  await Promise.all([
    page.waitForResponse(r => r.url().includes('/boards') && r.request().method() === 'POST' && r.status() === 201),
    page.click('button:has-text("Create Board")'),
  ]);
  await page.getByRole('link', { name: 'Empty Board' }).click();
  await expect(page).toHaveURL(/\/boards\//);

  await page.getByRole('tab', { name: 'List' }).click();

  await expect(page.locator('[data-testid="list-section"]')).toHaveCount(0);
  await expect(page.getByText('+ Add column')).toBeVisible();
});

test('row shows the Category dot+label when set, and no category chip when unset', async ({ page }) => {
  await setupBoard(page);
  await addCard(page, 'Categorized');
  await addCard(page, 'Uncategorized');

  await page.getByText('Categorized', { exact: true }).click();
  await page.click('button:has-text("+ Create label")');
  await page.fill('input[placeholder="Label name"]', 'Backend');
  await Promise.all([
    page.waitForResponse(r => /\/labels/.test(r.url()) && r.request().method() === 'POST' && r.status() === 201),
    page.getByRole('button', { name: 'Create', exact: true }).click(),
  ]);
  await Promise.all([
    page.waitForResponse(r => /\/cards\/[^/]+$/.test(r.url()) && r.request().method() === 'PATCH'),
    page.locator('aside button', { hasText: 'Backend' }).first().click(),
  ]);
  await page.locator('button[title="Close panel"]').click();

  await page.getByRole('tab', { name: 'List' }).click();

  const rows = page.locator('[data-testid="list-row"]');
  const categorized = rows.filter({ hasText: 'Categorized' }).first();
  const uncategorized = rows.filter({ hasText: 'Uncategorized' }).first();

  await expect(categorized.locator('[data-testid="list-row-category"]')).toContainText('Backend');
  await expect(uncategorized.locator('[data-testid="list-row-category"]')).toHaveCount(0);
});

test('row shows the due date, and renders it in the overdue color when the date has passed', async ({ page }) => {
  await setupBoard(page);
  await addCard(page, 'Overdue Task');

  await page.getByText('Overdue Task', { exact: true }).click();
  await page.getByPlaceholder('เลือกวันที่...').fill('01/01/2020');
  await Promise.all([
    page.waitForResponse(r => /\/cards\/[^/]+$/.test(r.url()) && r.request().method() === 'PATCH'),
    page.getByPlaceholder('เลือกวันที่...').press('Enter'),
  ]);
  await page.locator('button[title="Close panel"]').click();

  await page.getByRole('tab', { name: 'List' }).click();

  const row = page.locator('[data-testid="list-row"]').filter({ hasText: 'Overdue Task' }).first();
  const dueEl = row.locator('[data-testid="list-row-due"]');
  await expect(dueEl).toBeVisible();

  const expectedColor = await page.evaluate(() => {
    const el = document.createElement('div');
    el.style.color = 'var(--due-overdue)';
    document.body.appendChild(el);
    const c = getComputedStyle(el).color;
    document.body.removeChild(el);
    return c;
  });
  const actualColor = await dueEl.evaluate(el => getComputedStyle(el).color);
  expect(actualColor).toBe(expectedColor);
});

test('row shows subtask progress', async ({ page }) => {
  await setupBoard(page);
  await addCard(page, 'Checklist Task');

  await page.getByText('Checklist Task', { exact: true }).click();
  for (const title of ['Step one', 'Step two']) {
    const btn = page.locator('button:has-text("+ Add subtask")');
    if (await btn.isVisible()) await btn.click();
    const input = page.locator('input[placeholder="Subtask title…"]');
    await input.fill(title);
    await Promise.all([
      page.waitForResponse(r => r.url().includes('/subtasks') && r.request().method() === 'POST' && r.status() === 201),
      input.press('Enter'),
    ]);
  }
  await page.keyboard.press('Escape');
  await Promise.all([
    page.waitForResponse(r => r.url().includes('/subtasks') && r.request().method() === 'PATCH' && r.status() === 200),
    page.locator('aside input[type="checkbox"]').first().check(),
  ]);
  await page.locator('button[title="Close panel"]').click();

  await page.getByRole('tab', { name: 'List' }).click();

  const row = page.locator('[data-testid="list-row"]').filter({ hasText: 'Checklist Task' }).first();
  await expect(row.locator('[data-testid="list-row-progress"]')).toContainText('1/2');
});

test('a done card row shows the check badge, fades, and shows the completion date instead of due date', async ({ page }) => {
  await setupBoard(page);
  await addCard(page, 'Finish Me');

  await page.getByText('Finish Me', { exact: true }).click();
  await Promise.all([
    page.waitForResponse(r => /\/cards\/[^/]+$/.test(r.url()) && r.request().method() === 'PATCH' && r.status() === 200),
    page.locator('[data-testid="complete-toggle"]').click(),
  ]);
  await page.locator('button[title="Close panel"]').click();

  await page.getByRole('tab', { name: 'List' }).click();

  const row = page.locator('[data-testid="list-row"]').filter({ hasText: 'Finish Me' }).first();
  await expect(row.locator('[data-testid="list-row-done-badge"]')).toBeVisible();
  await expect(row.locator('[data-testid="list-row-completed"]')).toContainText('เสร็จ');
  await expect(row.locator('[data-testid="list-row-due"]')).toHaveCount(0);

  const opacity = await row.evaluate(el => getComputedStyle(el).opacity);
  expect(Number(opacity)).toBeLessThan(1);
});

test('reloading the page while in List view returns to Board view', async ({ page }) => {
  await setupBoard(page);

  await page.getByRole('tab', { name: 'List' }).click();
  await expect(page.locator('[data-testid="list-view"]')).toBeVisible();

  await page.reload();

  await expect(page.locator('[data-testid="column"]')).toBeVisible();
  await expect(page.locator('[data-testid="list-view"]')).toHaveCount(0);
});

test('there is no drag-and-drop in List view — row order does not change and no move request fires', async ({ page }) => {
  await setupBoard(page);
  await addCard(page, 'Row A');
  await addCard(page, 'Row B');

  await page.getByRole('tab', { name: 'List' }).click();

  const rows = page.locator('[data-testid="list-row"]');
  await expect(rows).toHaveCount(2);

  let moveRequestFired = false;
  page.on('request', r => {
    if (/\/cards\/[^/]+$/.test(r.url()) && r.method() === 'PATCH') moveRequestFired = true;
  });

  await pointerDrag(page, rows.nth(0), rows.nth(1));
  await page.waitForTimeout(500);

  expect(moveRequestFired).toBe(false);
  await expect(rows.nth(0)).toContainText('Row A');
  await expect(rows.nth(1)).toContainText('Row B');
});

test('polling reflects a change made in another tab', async ({ page, browser }) => {
  const email = `poll-${uid()}@test.com`;
  await register(page, email, PW, 'Poll User');

  await page.fill('input[placeholder="New board name…"]', 'Poll Board');
  await Promise.all([
    page.waitForResponse(r => r.url().includes('/boards') && r.request().method() === 'POST' && r.status() === 201),
    page.click('button:has-text("Create Board")'),
  ]);
  await page.getByRole('link', { name: 'Poll Board' }).click();
  await expect(page).toHaveURL(/\/boards\//);
  const boardUrl = page.url();

  await page.click('text=+ Add column');
  await page.fill('input[placeholder="Column name…"]', 'To Do');
  await Promise.all([
    page.waitForResponse(r => r.url().includes('/columns') && r.request().method() === 'POST' && r.status() === 201),
    page.getByRole('button', { name: 'Add', exact: true }).click(),
  ]);

  // A second tab, same user, viewing the same board in List view
  const ctx2 = await browser.newContext();
  const page2 = await ctx2.newPage();
  await login(page2, email, PW);
  await page2.goto(boardUrl);
  await page2.getByRole('tab', { name: 'List' }).click();
  await expect(page2.locator('[data-testid="list-row"]')).toHaveCount(0);

  // Create a card from the first tab
  await addCard(page, 'Polled In');

  // The second tab's List view should pick it up on the next poll, with no manual reload
  await expect(page2.locator('[data-testid="list-row"]')).toContainText('Polled In', { timeout: 12_000 });

  await ctx2.close();
});
