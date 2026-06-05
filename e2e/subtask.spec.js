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

async function openCard(page, cardTitle) {
  await page.getByRole('button', { name: cardTitle }).click();
  await expect(page.locator('aside')).toBeVisible();
}

async function addSubtask(page, title) {
  const btn = page.locator('button:has-text("+ Add subtask")');
  const input = page.locator('input[placeholder="Subtask title…"]');
  if (await btn.isVisible()) await btn.click();
  await input.fill(title);
  await input.press('Enter');
  await expect(page.locator('aside').getByText(title)).toBeVisible();
}

test('create subtask → persists after reload', async ({ page }) => {
  const { cardTitle } = await setupBoard(page);
  await openCard(page, cardTitle);

  await addSubtask(page, 'Write tests');

  // Reload and re-open card — subtask should still appear
  await page.reload();
  await openCard(page, cardTitle);
  await expect(page.locator('aside').getByText('Write tests')).toBeVisible();
});

test('toggle checkbox → card preview shows ✓ n/total → persists after reload', async ({ page }) => {
  const { cardTitle } = await setupBoard(page);
  await openCard(page, cardTitle);
  await addSubtask(page, 'Step one');

  // Tick the checkbox
  await page.locator('aside input[type="checkbox"]').check();

  // Close panel and verify progress indicator on card preview
  await page.locator('button[title="Close panel"]').click();
  await expect(page.getByText('✓ 1 / 1')).toBeVisible();

  // Reload — state persists
  await page.reload();
  await expect(page.getByText('✓ 1 / 1')).toBeVisible();

  // Re-open card and verify checkbox is still checked
  await openCard(page, cardTitle);
  await expect(page.locator('aside input[type="checkbox"]')).toBeChecked();
});

test('rename subtask inline — new title persists after reload', async ({ page }) => {
  const { cardTitle } = await setupBoard(page);
  await openCard(page, cardTitle);
  await addSubtask(page, 'Original title');

  // Click title to open inline edit
  await page.locator('aside').getByText('Original title').click();
  const editInput = page.locator('aside input[placeholder="Subtask title…"]');
  await editInput.fill('Renamed title');
  await editInput.press('Enter');
  await expect(page.locator('aside').getByText('Renamed title')).toBeVisible();
  await expect(page.locator('aside').getByText('Original title')).not.toBeVisible();

  // Reload — renamed title persists
  await page.reload();
  await openCard(page, cardTitle);
  await expect(page.locator('aside').getByText('Renamed title')).toBeVisible();
});

test('reorder subtasks with ↑ button → order persists after reload', async ({ page }) => {
  const { cardTitle } = await setupBoard(page);
  await openCard(page, cardTitle);
  await addSubtask(page, 'Subtask A');
  await addSubtask(page, 'Subtask B');

  // Verify initial order: A then B
  const panel = page.locator('aside');
  const titles = panel.locator('.subtaskTitle, span').filter({ hasText: /Subtask [AB]/ });
  await expect(titles.first()).toHaveText('Subtask A');

  // Click ↑ on Subtask B (only one enabled ↑ button)
  await panel.locator('button[title="Move up"]:not([disabled])').click();

  // Subtask B should now be first
  await expect(panel.getByText('Subtask B')).toBeVisible();

  // Reload — order persists
  await page.reload();
  await openCard(page, cardTitle);
  const panelAfter = page.locator('aside');
  const allTitles = await panelAfter.locator('span').allTextContents();
  const subtaskTitles = allTitles.filter(t => t === 'Subtask A' || t === 'Subtask B');
  expect(subtaskTitles[0]).toBe('Subtask B');
  expect(subtaskTitles[1]).toBe('Subtask A');
});

test('delete subtask → removed from list, progress indicator disappears', async ({ page }) => {
  const { cardTitle } = await setupBoard(page);
  await openCard(page, cardTitle);
  await addSubtask(page, 'Step to delete');

  // Delete the subtask
  await page.locator('button[title="Delete subtask"]').click();
  await expect(page.locator('aside').getByText('Step to delete')).not.toBeVisible();

  // Close panel — progress indicator should be gone (no subtasks left)
  await page.locator('button[title="Close panel"]').click();
  await expect(page.getByText(/✓ \d+ \/ \d+/)).not.toBeVisible();
});

test('max 20 subtasks — add button hidden, hint shown', async ({ page }) => {
  const { cardTitle } = await setupBoard(page);
  await openCard(page, cardTitle);

  // Add 20 subtasks
  await page.locator('button:has-text("+ Add subtask")').click();
  for (let i = 1; i <= 20; i++) {
    await page.locator('input[placeholder="Subtask title…"]').fill(`Step ${i}`);
    await page.locator('input[placeholder="Subtask title…"]').press('Enter');
    if (i < 20) {
      await expect(page.locator('aside').getByText(`Step ${i}`)).toBeVisible();
    }
  }

  // Dismiss inline input
  await page.keyboard.press('Escape');

  // "+ Add subtask" button should be gone; limit message should appear
  await expect(page.locator('button:has-text("+ Add subtask")')).not.toBeVisible();
  await expect(page.getByText('Maximum 20 subtasks per card')).toBeVisible();
});
