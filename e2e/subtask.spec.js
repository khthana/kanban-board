const { test, expect } = require('@playwright/test');
const { uid, register } = require('./helpers');

const PW = 'password1';

async function setupBoard(page) {
  const cardTitle = `Task-${uid()}`;
  await register(page, `user-${uid()}@test.com`, PW, 'Test User');

  await page.fill('input[placeholder="New board name…"]', 'Subtask Board');
  await page.click('button:has-text("Create Board")');
  await page.getByRole('link', { name: 'Subtask Board' }).click();
  await expect(page).toHaveURL(/\/boards\//);

  await page.click('text=+ Add column');
  await page.fill('input[placeholder="Column name…"]', 'To Do');
  await page.getByRole('button', { name: 'Add', exact: true }).click();

  await page.click('text=+ Add card');
  await page.fill('textarea[placeholder="Card title…"]', cardTitle);
  await page.getByRole('button', { name: 'Add card', exact: true }).click();
  await expect(page.getByText(cardTitle)).toBeVisible();

  return { cardTitle };
}

// Click the card title <p> directly — avoids strict-mode conflict with Column's role="button"
async function openCard(page, cardTitle) {
  await page.getByText(cardTitle, { exact: true }).click();
  await expect(page.locator('aside')).toBeVisible();
}

// Add one subtask and press Escape to leave the input closed afterwards
async function addSubtask(page, title) {
  const btn = page.locator('button:has-text("+ Add subtask")');
  if (await btn.isVisible()) await btn.click();
  const input = page.locator('input[placeholder="Subtask title…"]');
  await input.fill(title);
  await input.press('Enter');
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

test('toggle checkbox → card preview shows ✓ n/total → persists after reload', async ({ page }) => {
  const { cardTitle } = await setupBoard(page);
  await openCard(page, cardTitle);
  await addSubtask(page, 'Step one');

  await page.locator('aside input[type="checkbox"]').check();

  await page.locator('button[title="Close panel"]').click();
  await expect(page.getByText('✓ 1 / 1')).toBeVisible();

  await page.reload();
  await expect(page.getByText('✓ 1 / 1')).toBeVisible();

  await openCard(page, cardTitle);
  await expect(page.locator('aside input[type="checkbox"]')).toBeChecked();
});

test('rename subtask inline — new title persists after reload', async ({ page }) => {
  const { cardTitle } = await setupBoard(page);
  await openCard(page, cardTitle);
  await addSubtask(page, 'Original title');

  // Click title span → edit input appears (no placeholder; exclude checkboxes)
  await page.locator('aside').getByText('Original title').click();
  const editInput = page.locator('aside input:not([type="checkbox"])');
  await editInput.fill('Renamed title');
  await editInput.press('Enter');
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

  // Subtask A should be above Subtask B initially
  const aBoxBefore = await panel.getByText('Subtask A').boundingBox();
  const bBoxBefore = await panel.getByText('Subtask B').boundingBox();
  expect(aBoxBefore.y).toBeLessThan(bBoxBefore.y);

  // Move Subtask B up (only one enabled ↑ button)
  await panel.locator('button[title="Move up"]:not([disabled])').click();

  // Subtask B should now be above Subtask A
  const aBoxAfter = await panel.getByText('Subtask A').boundingBox();
  const bBoxAfter = await panel.getByText('Subtask B').boundingBox();
  expect(bBoxAfter.y).toBeLessThan(aBoxAfter.y);

  // Reload — order persists
  await page.reload();
  await openCard(page, cardTitle);
  const panelAfter = page.locator('aside');
  const aBoxReload = await panelAfter.getByText('Subtask A').boundingBox();
  const bBoxReload = await panelAfter.getByText('Subtask B').boundingBox();
  expect(bBoxReload.y).toBeLessThan(aBoxReload.y);
});

test('delete subtask → removed from list, progress indicator disappears', async ({ page }) => {
  const { cardTitle } = await setupBoard(page);
  await openCard(page, cardTitle);
  await addSubtask(page, 'Step to delete');

  await page.locator('button[title="Delete subtask"]').click();
  await expect(page.locator('aside').getByText('Step to delete')).not.toBeVisible();

  await page.locator('button[title="Close panel"]').click();
  await expect(page.getByText(/✓ \d+ \/ \d+/)).not.toBeVisible();
});

test('max 20 subtasks — add button hidden, hint shown', async ({ page }) => {
  const { cardTitle } = await setupBoard(page);
  await openCard(page, cardTitle);

  // Add 20 subtasks — click button once then reuse the open input for all
  await page.locator('button:has-text("+ Add subtask")').click();
  for (let i = 1; i <= 20; i++) {
    const input = page.locator('input[placeholder="Subtask title…"]');
    await input.fill(`Step ${i}`);
    await input.press('Enter');
  }

  // Close input — at 20 subtasks the button should be gone
  await page.keyboard.press('Escape');
  await expect(page.locator('button:has-text("+ Add subtask")')).not.toBeVisible();
  await expect(page.getByText('Maximum 20 subtasks per card')).toBeVisible();
});
