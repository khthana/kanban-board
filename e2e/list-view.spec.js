const { test, expect } = require('@playwright/test');
const { uid, register, login, pointerDrag } = require('./helpers');

const PW = 'password1';

async function openNewBoard(page, boardName, { email = `user-${uid()}@test.com`, displayName = 'Test User' } = {}) {
  await register(page, email, PW, displayName);

  await page.fill('input[placeholder="New board name…"]', boardName);
  await Promise.all([
    page.waitForResponse(r => r.url().includes('/boards') && r.request().method() === 'POST' && r.status() === 201),
    page.click('button:has-text("Create Board")'),
  ]);
  await page.getByRole('link', { name: boardName }).click();
  await expect(page).toHaveURL(/\/boards\//);
  return email;
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

async function setupBoard(page) {
  await openNewBoard(page, 'List Board');
  await addColumn(page, 'To Do');
  await expect(page.locator('[data-testid="column"]')).toBeVisible();
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
  await openNewBoard(page, 'Empty Board');

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
  await openNewBoard(page, 'Poll Board', { email, displayName: 'Poll User' });
  const boardUrl = page.url();

  await addColumn(page, 'To Do');

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

async function addCardToColumn(page, columnIndex, title) {
  const column = page.locator('[data-testid="column"]').nth(columnIndex);
  await column.locator('text=+ New card').click();
  await column.locator('textarea[placeholder="Card title…"]').fill(title);
  await Promise.all([
    page.waitForResponse(r => r.url().includes('/cards') && r.request().method() === 'POST' && r.status() === 201),
    column.getByRole('button', { name: 'Add card', exact: true }).click(),
  ]);
}

test('section headers stay pinned while scrolling their own section, and hand off to the next section', async ({ page }) => {
  await setupBoard(page); // "To Do"
  await addColumn(page, 'Doing');
  for (let i = 1; i <= 15; i++) await addCardToColumn(page, 0, `Todo Card ${i}`);
  for (let i = 1; i <= 15; i++) await addCardToColumn(page, 1, `Doing Card ${i}`);

  await page.getByRole('tab', { name: 'List' }).click();

  const list = page.locator('[data-testid="list-view"]');
  const sections = page.locator('[data-testid="list-section"]');
  const header1 = sections.nth(0).locator('[data-testid="column-chip"]');
  const header2 = sections.nth(1).locator('[data-testid="column-chip"]');

  // A tiny scroll is enough to pin the header at its stuck (top: 0) position — use that as baseline,
  // since the natural (unstuck) position includes the section's margin-top and isn't representative.
  await list.evaluate(el => el.scrollTo(0, 40));
  const stuckY = (await header1.boundingBox()).y;

  // Scroll further through "To Do"'s 20 rows — header should stay pinned at the same stuck Y.
  await list.evaluate(el => el.scrollTo(0, 300));
  const midScrollY = (await header1.boundingBox()).y;
  expect(Math.abs(midScrollY - stuckY)).toBeLessThan(2);

  // Scroll all the way past "To Do" into "Doing" — "Doing"'s header should now be the one pinned
  // at that same stuck Y, and "To Do"'s header should have scrolled up out of the stuck position.
  await list.evaluate(el => el.scrollTo(0, el.scrollHeight));
  const doingBox = await header2.boundingBox();
  expect(Math.abs(doingBox.y - stuckY)).toBeLessThan(2);

  const todoBox = await header1.boundingBox();
  expect(todoBox.y).toBeLessThan(stuckY - 5);
});

test('section header shows the Column Accent when set, neutral gray when not set', async ({ page }) => {
  await setupBoard(page); // "To Do" — no accent
  await addColumn(page, 'Doing');

  // Set an Accent on "Doing" via Board view's rename form.
  const doingHeader = page.locator('[data-testid="column"]').nth(1);
  await doingHeader.locator('button[title="Rename column"]').click();
  await page.click('button[data-swatch="#fca5a5"]');
  await Promise.all([
    page.waitForResponse(r => r.url().includes('/columns/') && r.request().method() === 'PATCH' && r.status() === 200),
    page.click('button:has-text("Save")'),
  ]);

  await page.getByRole('tab', { name: 'List' }).click();

  const sections = page.locator('[data-testid="list-section"]');
  const todoChip = sections.nth(0).locator('[data-testid="column-chip"]');
  const doingChip = sections.nth(1).locator('[data-testid="column-chip"]');

  // "To Do" has no Accent → neutral gray default (#e2e8f0), same as Board view.
  await expect(todoChip).toHaveCSS('background-color', 'rgb(226, 232, 240)');

  // "Doing" has Accent #fca5a5 → chip tinted to match.
  await expect(doingChip).toHaveCSS('background-color', 'rgb(252, 165, 165)');
});

test('clicking a List view row opens the Card panel', async ({ page }) => {
  await setupBoard(page);
  await addCard(page, 'Click Me');

  await page.getByRole('tab', { name: 'List' }).click();
  await page.locator('[data-testid="list-row"]').filter({ hasText: 'Click Me' }).click();

  await expect(page.locator('aside')).toBeVisible();
  await expect(page.locator('aside')).toContainText('Click Me');
});

test('pressing Enter on a focused List view row opens the Card panel', async ({ page }) => {
  await setupBoard(page);
  await addCard(page, 'Keyboard Card');

  await page.getByRole('tab', { name: 'List' }).click();
  await page.locator('[data-testid="list-row"]').filter({ hasText: 'Keyboard Card' }).focus();
  await page.keyboard.press('Enter');

  await expect(page.locator('aside')).toBeVisible();
  await expect(page.locator('aside')).toContainText('Keyboard Card');
});

test('the list container gets a 380px right margin while the Card panel is open', async ({ page }) => {
  await setupBoard(page);
  await addCard(page, 'Margin Card');

  await page.getByRole('tab', { name: 'List' }).click();
  const list = page.locator('[data-testid="list-view"]');
  await expect(list).toHaveCSS('margin-right', '0px');

  await page.locator('[data-testid="list-row"]').filter({ hasText: 'Margin Card' }).click();
  await expect(page.locator('aside')).toBeVisible();
  await expect(list).toHaveCSS('margin-right', '380px');
});

test('switching to Board view while the Card panel is open in List view closes it', async ({ page }) => {
  await setupBoard(page);
  await addCard(page, 'Close Me A');

  await page.getByRole('tab', { name: 'List' }).click();
  await page.locator('[data-testid="list-row"]').filter({ hasText: 'Close Me A' }).click();
  await expect(page.locator('aside')).toBeVisible();

  await page.getByRole('tab', { name: 'Board' }).click();

  await expect(page.locator('aside')).toHaveCount(0);
});

test('switching to List view while the Card panel is open in Board view closes it', async ({ page }) => {
  await setupBoard(page);
  await addCard(page, 'Close Me B');

  await page.getByText('Close Me B', { exact: true }).click();
  await expect(page.locator('aside')).toBeVisible();

  await page.getByRole('tab', { name: 'List' }).click();

  await expect(page.locator('aside')).toHaveCount(0);
});

test('the Board/List toggle stays visible while the Card panel is open', async ({ page }) => {
  await setupBoard(page);
  await addCard(page, 'Toggle Visible Card');

  await page.getByRole('tab', { name: 'List' }).click();
  await page.locator('[data-testid="list-row"]').filter({ hasText: 'Toggle Visible Card' }).click();
  await expect(page.locator('aside')).toBeVisible();

  await expect(page.getByRole('tab', { name: 'Board' })).toBeVisible();
  await expect(page.getByRole('tab', { name: 'List' })).toBeVisible();
});

test('each section shows a "+ New card" trigger at its foot', async ({ page }) => {
  await setupBoard(page); // "To Do"
  await addColumn(page, 'Doing');

  await page.getByRole('tab', { name: 'List' }).click();

  const sections = page.locator('[data-testid="list-section"]');
  await expect(sections.nth(0).getByText('+ New card')).toBeVisible();
  await expect(sections.nth(1).getByText('+ New card')).toBeVisible();
});

test('submitting the section-foot composer creates a card in that column, appearing at the foot immediately', async ({ page }) => {
  await setupBoard(page); // "To Do"
  await addColumn(page, 'Doing');
  await addCardToColumn(page, 0, 'Existing Todo Card');

  await page.getByRole('tab', { name: 'List' }).click();

  const doingSection = page.locator('[data-testid="list-section"]').nth(1);
  await doingSection.getByText('+ New card').click();
  await doingSection.locator('textarea[placeholder="Card title…"]').fill('New Doing Card');
  // Deliberately not waiting for the POST — this proves the row appears optimistically.
  await doingSection.getByRole('button', { name: 'Add card', exact: true }).click();

  const doingRows = doingSection.locator('[data-testid="list-row"]');
  await expect(doingRows).toHaveCount(1);
  await expect(doingRows.last()).toContainText('New Doing Card');

  // It landed in "Doing", not "To Do".
  const todoSection = page.locator('[data-testid="list-section"]').nth(0);
  await expect(todoSection.locator('[data-testid="list-row"]')).toHaveCount(1);
  await expect(todoSection.locator('[data-testid="list-row"]').first()).toContainText('Existing Todo Card');
});

test('a failed card creation from the section-foot composer rolls back and shows the error banner', async ({ page }) => {
  await setupBoard(page);
  await page.getByRole('tab', { name: 'List' }).click();

  await page.route('**/columns/*/cards', route =>
    route.fulfill({ status: 500, contentType: 'application/json', body: JSON.stringify({ error: 'Server error' }) })
  );

  const section = page.locator('[data-testid="list-section"]').first();
  await section.getByText('+ New card').click();
  await section.locator('textarea[placeholder="Card title…"]').fill('Should Fail');
  await section.getByRole('button', { name: 'Add card', exact: true }).click();

  await expect(page.locator('[data-testid="list-row"]').filter({ hasText: 'Should Fail' })).toHaveCount(0);
  await expect(page.getByText('Dismiss')).toBeVisible();
});
