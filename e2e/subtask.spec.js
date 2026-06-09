const { test, expect } = require('@playwright/test');
const { uid, register } = require('./helpers');

const PW = 'password1';

async function setupBoard(page) {
  const cardTitle = `Task-${uid()}`;
  await register(page, `user-${uid()}@test.com`, PW, 'Test User');

  await page.fill('input[placeholder="New board name…"]', 'Subtask Board');
  // Wait for board creation to confirm so link has real UUID (not optimistic tempId)
  await Promise.all([
    page.waitForResponse(r => r.url().includes('/boards') && r.request().method() === 'POST' && r.status() === 201),
    page.click('button:has-text("Create Board")'),
  ]);
  await page.getByRole('link', { name: 'Subtask Board' }).click();
  await expect(page).toHaveURL(/\/boards\//);

  // Wait for column creation to confirm before adding a card
  await page.click('text=+ Add column');
  await page.fill('input[placeholder="Column name…"]', 'To Do');
  await Promise.all([
    page.waitForResponse(r => r.url().includes('/columns') && r.request().method() === 'POST' && r.status() === 201),
    page.getByRole('button', { name: 'Add', exact: true }).click(),
  ]);

  // Wait for card creation to confirm so activeCard has real UUID
  await page.click('text=+ New card');
  await page.fill('textarea[placeholder="Card title…"]', cardTitle);
  await Promise.all([
    page.waitForResponse(r => r.url().includes('/cards') && r.request().method() === 'POST' && r.status() === 201),
    page.getByRole('button', { name: 'Add card', exact: true }).click(),
  ]);
  await expect(page.getByText(cardTitle)).toBeVisible();

  return { cardTitle };
}

// Click the card title <p> directly — avoids strict-mode conflict with Column's role="button"
async function openCard(page, cardTitle) {
  await page.getByText(cardTitle, { exact: true }).click();
  await expect(page.locator('aside')).toBeVisible();
}

// Add one subtask and wait for the POST to confirm (real id in store before returning)
async function addSubtask(page, title) {
  const btn = page.locator('button:has-text("+ Add subtask")');
  if (await btn.isVisible()) await btn.click();
  const input = page.locator('input[placeholder="Subtask title…"]');
  await input.fill(title);
  await Promise.all([
    page.waitForResponse(r => r.url().includes('/subtasks') && r.request().method() === 'POST' && r.status() === 201),
    input.press('Enter'),
  ]);
  await expect(page.locator('aside').getByText(title)).toBeVisible();
  await page.keyboard.press('Escape'); // close add-input so panel is clean
}

test('create subtask → persists after reload', async ({ page }) => {
  const { cardTitle } = await setupBoard(page);
  await openCard(page, cardTitle);

  await addSubtask(page, 'Write tests');

  await page.reload();
  await openCard(page, cardTitle);
  await expect(page.locator('aside').getByText('Write tests')).toBeVisible();
});

test('toggle checkbox → card preview shows n/total → persists after reload', async ({ page }) => {
  const { cardTitle } = await setupBoard(page);
  await openCard(page, cardTitle);
  await addSubtask(page, 'Step one');

  // Wait for PATCH to confirm so checked state persists on reload
  await Promise.all([
    page.waitForResponse(r => r.url().includes('/subtasks') && r.request().method() === 'PATCH' && r.status() === 200),
    page.locator('aside input[type="checkbox"]').check(),
  ]);

  await page.locator('button[title="Close panel"]').click();
  await expect(page.locator('[data-testid="card-progress"]').getByText('1/1')).toBeVisible();

  await page.reload();
  await expect(page.locator('[data-testid="card-progress"]').getByText('1/1')).toBeVisible();

  await openCard(page, cardTitle);
  await expect(page.locator('aside input[type="checkbox"]')).toBeChecked();
});

test('rename subtask inline — new title persists after reload', async ({ page }) => {
  const { cardTitle } = await setupBoard(page);
  await openCard(page, cardTitle);
  await addSubtask(page, 'Original title');

  // Click title span → inline edit input appears (autofocused)
  await page.locator('aside').getByText('Original title', { exact: true }).click();
  const editInput = page.locator('aside input:focus');
  await editInput.fill('Renamed title');
  await Promise.all([
    page.waitForResponse(r => r.url().includes('/subtasks') && r.request().method() === 'PATCH' && r.status() === 200),
    editInput.press('Enter'),
  ]);
  await expect(page.locator('aside').getByText('Renamed title')).toBeVisible();
  await expect(page.locator('aside').getByText('Original title')).not.toBeVisible();

  await page.reload();
  await openCard(page, cardTitle);
  await expect(page.locator('aside').getByText('Renamed title')).toBeVisible();
});

test('reorder subtasks with ↑ button → order persists after reload', async ({ page }) => {
  const { cardTitle } = await setupBoard(page);
  await openCard(page, cardTitle);
  await addSubtask(page, 'Subtask A');
  await addSubtask(page, 'Subtask B');

  const panel = page.locator('aside');

  // Initial order: A above B
  const aBoxBefore = await panel.getByText('Subtask A', { exact: true }).boundingBox();
  const bBoxBefore = await panel.getByText('Subtask B', { exact: true }).boundingBox();
  expect(aBoxBefore.y).toBeLessThan(bBoxBefore.y);

  // Move B up — wait for PATCH to confirm
  await Promise.all([
    page.waitForResponse(r => r.url().includes('/subtasks') && r.request().method() === 'PATCH' && r.status() === 200),
    panel.locator('button[title="Move up"]:not([disabled])').click(),
  ]);

  // Verify B is now above A (retry to handle render delay)
  await expect(async () => {
    const bBox = await panel.getByText('Subtask B', { exact: true }).boundingBox();
    const aBox = await panel.getByText('Subtask A', { exact: true }).boundingBox();
    expect(bBox.y).toBeLessThan(aBox.y);
  }).toPass({ timeout: 3000 });

  // Reload — order persists
  await page.reload();
  await openCard(page, cardTitle);
  const panelAfter = page.locator('aside');
  const bBoxReload = await panelAfter.getByText('Subtask B', { exact: true }).boundingBox();
  const aBoxReload = await panelAfter.getByText('Subtask A', { exact: true }).boundingBox();
  expect(bBoxReload.y).toBeLessThan(aBoxReload.y);
});

test('delete subtask → removed from list, progress indicator disappears', async ({ page }) => {
  const { cardTitle } = await setupBoard(page);
  await openCard(page, cardTitle);
  await addSubtask(page, 'Step to delete');

  // Wait for DELETE to confirm so rollback doesn't restore the subtask
  await Promise.all([
    page.waitForResponse(r => r.url().includes('/subtasks') && r.request().method() === 'DELETE' && r.status() === 204),
    page.locator('button[title="Delete subtask"]').click(),
  ]);
  await expect(page.locator('aside').getByText('Step to delete')).not.toBeVisible();

  await page.locator('button[title="Close panel"]').click();
  await expect(page.locator('[data-testid="card-progress"]')).not.toBeVisible();
});

test('max 20 subtasks — add button hidden, hint shown', async ({ page }) => {
  const { cardTitle } = await setupBoard(page);
  await openCard(page, cardTitle);

  // Add 20 subtasks — wait for each POST to confirm so count is exact in the store
  await page.locator('button:has-text("+ Add subtask")').click();
  for (let i = 1; i <= 20; i++) {
    const input = page.locator('input[placeholder="Subtask title…"]');
    await input.fill(`Step ${i}`);
    await Promise.all([
      page.waitForResponse(r => r.url().includes('/subtasks') && r.status() === 201),
      input.press('Enter'),
    ]);
  }

  await page.keyboard.press('Escape');

  await expect(page.locator('button:has-text("+ Add subtask")')).not.toBeVisible();
  await expect(page.getByText('Maximum 20 subtasks per card')).toBeVisible();
});
