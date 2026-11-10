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

test('single add validates inline before sending, in the batch wording (#67)', async ({ page }) => {
  const { cardTitle } = await setupBoard(page);
  await openCard(page, cardTitle);
  let posts = 0;
  page.on('request', r => { if (r.url().includes('/subtasks') && r.method() === 'POST') posts++; });

  await page.locator('button:has-text("+ Add subtask")').click();
  const input = page.locator('input[placeholder="Subtask title…"]');
  await input.press('Enter');
  await expect(page.getByText('ชื่อ Subtask ว่าง')).toBeVisible();

  await input.fill('a'.repeat(101));
  await input.press('Enter');
  await expect(page.getByText('ชื่อ Subtask ยาวเกิน 100 ตัวอักษร')).toBeVisible();
  await expect(input).toHaveValue('a'.repeat(101));
  expect(posts).toBe(0);
});

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
    page.locator('aside input[type="checkbox"]').click(), // .check() can't verify: done rows hide (#61)
  ]);

  await page.locator('button[title="Close panel"]').click();
  await expect(page.locator('[data-testid="card-progress"]').getByText('1/1')).toBeVisible();

  await page.reload();
  await expect(page.locator('[data-testid="card-progress"]').getByText('1/1')).toBeVisible();

  await openCard(page, cardTitle);
  await page.locator('[data-testid="subtask-done-toggle"]').click();
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

// Paste text into the "+ Add subtask" input through the real clipboard + Ctrl/Cmd+V,
// so the browser fires a trusted paste event (fill() never fires onPaste, and a
// synthetic paste event wouldn't insert single-line text the way a real one does).
async function pasteIntoSubtaskInput(page, text) {
  await page.context().grantPermissions(['clipboard-read', 'clipboard-write']);
  const btn = page.locator('button:has-text("+ Add subtask")');
  if (await btn.isVisible()) await btn.click();
  const input = page.locator('input[placeholder="Subtask title…"]');
  await input.focus();
  await page.evaluate(value => navigator.clipboard.writeText(value), text);
  await input.press('ControlOrMeta+V');
}

const batchBox = page => page.locator('[data-testid="subtask-batch-input"]');
const subtaskTitles = page => page.locator('aside [data-testid="subtask-title"]');

// Paste lines and press Enter, waiting for the batch POST to confirm and the
// panel to settle back to the single-line input
async function pasteBatch(page, lines) {
  await pasteIntoSubtaskInput(page, lines.join('\n'));
  await Promise.all([
    page.waitForResponse(r => r.url().includes('/subtasks/batch') && r.status() === 201),
    batchBox(page).press('Enter'),
  ]);
  await expect(batchBox(page)).not.toBeVisible();
}

test('max 50 subtasks — add button hidden, hint shown', async ({ page }) => {
  const { cardTitle } = await setupBoard(page);
  await openCard(page, cardTitle);

  await pasteBatch(page, Array.from({ length: 50 }, (_, i) => `Step ${i + 1}`));
  await page.keyboard.press('Escape');

  await expect(page.locator('button:has-text("+ Add subtask")')).not.toBeVisible();
  await expect(page.getByText('Subtask ครบลิมิต 50 แล้ว')).toBeVisible();
});

test('paste several lines → box + hint → Enter adds one subtask per line, in order → persists', async ({ page }) => {
  const { cardTitle } = await setupBoard(page);
  await openCard(page, cardTitle);
  await addSubtask(page, 'Existing');

  await pasteIntoSubtaskInput(page, 'ครั้งที่ 1 – slide\n\n  ครั้งที่ 1 – note  \nครั้งที่ 2 – slide');

  await expect(batchBox(page)).toBeVisible();
  await expect(page.getByTestId('subtask-batch-hint')).toHaveText('Enter เพื่อเพิ่ม 3 รายการ · Esc ยกเลิก');

  await Promise.all([
    page.waitForResponse(r => r.url().includes('/subtasks/batch') && r.status() === 201),
    batchBox(page).press('Enter'),
  ]);

  const expected = ['Existing', 'ครั้งที่ 1 – slide', 'ครั้งที่ 1 – note', 'ครั้งที่ 2 – slide'];
  await expect(subtaskTitles(page)).toHaveText(expected);
  await expect(batchBox(page)).not.toBeVisible();
  await expect(page.locator('input[placeholder="Subtask title…"]')).toHaveValue('');

  await page.reload();
  await openCard(page, cardTitle);
  await expect(subtaskTitles(page)).toHaveText(expected);
});

test('pasting a single line behaves like typing it', async ({ page }) => {
  const { cardTitle } = await setupBoard(page);
  await openCard(page, cardTitle);

  await pasteIntoSubtaskInput(page, 'Just one');

  await expect(batchBox(page)).not.toBeVisible();
  await expect(page.locator('input[placeholder="Subtask title…"]')).toHaveValue('Just one');
});

test('a paste over the 50 limit adds nothing and keeps the text with the reason', async ({ page }) => {
  const { cardTitle } = await setupBoard(page);
  await openCard(page, cardTitle);
  await pasteBatch(page, Array.from({ length: 48 }, (_, i) => `Step ${i + 1}`));

  const text = 'Extra 1\nExtra 2\nExtra 3';
  await pasteIntoSubtaskInput(page, text);
  await batchBox(page).press('Enter');

  await expect(page.getByText('วาง 3 รายการจะเกินลิมิต 50 (เพิ่มได้อีก 2)')).toBeVisible();
  await expect(batchBox(page)).toHaveValue(text);
  await expect(subtaskTitles(page)).toHaveCount(48);
});

test('Escape cancels a pasted batch without adding anything', async ({ page }) => {
  const { cardTitle } = await setupBoard(page);
  await openCard(page, cardTitle);

  let batchPosts = 0;
  page.on('request', r => { if (r.url().includes('/subtasks/batch')) batchPosts += 1; });

  await pasteIntoSubtaskInput(page, 'A\nB');
  await batchBox(page).press('Escape');

  await expect(batchBox(page)).not.toBeVisible();
  await expect(subtaskTitles(page)).toHaveCount(0);
  expect(batchPosts).toBe(0);
});

test('Shift+Enter adds a line to the batch before committing', async ({ page }) => {
  const { cardTitle } = await setupBoard(page);
  await openCard(page, cardTitle);

  await pasteIntoSubtaskInput(page, 'A\nB');
  await batchBox(page).press('ControlOrMeta+End'); // end of the whole text, not just line 1
  await batchBox(page).press('Shift+Enter');
  await batchBox(page).pressSequentially('C');
  await expect(page.getByTestId('subtask-batch-hint')).toHaveText('Enter เพื่อเพิ่ม 3 รายการ · Esc ยกเลิก');

  await Promise.all([
    page.waitForResponse(r => r.url().includes('/subtasks/batch') && r.status() === 201),
    batchBox(page).press('Enter'),
  ]);
  await expect(subtaskTitles(page)).toHaveText(['A', 'B', 'C']);
});

test('a batch the server rejects rolls back every row and keeps the pasted text', async ({ page }) => {
  const { cardTitle } = await setupBoard(page);
  await openCard(page, cardTitle);
  await page.route('**/subtasks/batch', route =>
    route.fulfill({ status: 500, contentType: 'application/json', body: JSON.stringify({ error: 'server exploded' }) }));

  await pasteIntoSubtaskInput(page, 'A\nB');
  await batchBox(page).press('Enter');

  await expect(page.locator('aside').getByText('server exploded')).toBeVisible();
  await expect(subtaskTitles(page)).toHaveCount(0);
  await expect(batchBox(page)).toHaveValue('A\nB');
});

test('a second Enter while the batch is saving does not add it twice', async ({ page }) => {
  const { cardTitle } = await setupBoard(page);
  await openCard(page, cardTitle);
  let posts = 0;
  let release;
  const held = new Promise(r => { release = r; });
  await page.route('**/subtasks/batch', async route => {
    posts += 1;
    await held;
    await route.continue();
  });

  await pasteIntoSubtaskInput(page, 'A\nB');
  await batchBox(page).press('Enter');
  await batchBox(page).press('Enter');
  release();

  await expect(subtaskTitles(page)).toHaveText(['A', 'B']);
  await page.reload();
  await openCard(page, cardTitle);
  await expect(subtaskTitles(page)).toHaveText(['A', 'B']);
  expect(posts).toBe(1);
});

// ── Hide done Subtasks (PRD §12, #61) — a `✓ N` switch in the header (#83) ──

const doneToggle = page => page.locator('[data-testid="subtask-done-toggle"]');
const doneCount = page => page.locator('[data-testid="subtask-done-count"]');
async function expectSwitch(page, n, on) {
  await expect(doneCount(page)).toHaveText(`✓ ${n}`);
  await expect(doneToggle(page)).toHaveAttribute('role', 'switch');
  await expect(doneToggle(page)).toHaveAttribute('aria-checked', String(on));
  await expect(doneToggle(page)).toHaveAccessibleName(`แสดงที่เสร็จแล้ว ✓ ${n}`);
}

async function tick(page, title) {
  const row = page.locator('[data-testid="subtask-row"]').filter({ has: page.getByText(title, { exact: true }) });
  await Promise.all([
    page.waitForResponse(r => r.url().includes('/subtasks') && r.request().method() === 'PATCH' && r.status() === 200),
    row.locator('input[type="checkbox"]').click(),
  ]);
}

test('ticking hides the row; reveal shows it in place; reopening the panel hides it again', async ({ page }) => {
  const { cardTitle } = await setupBoard(page);
  await openCard(page, cardTitle);
  await pasteBatch(page, ['A', 'B', 'C']);
  await expect(doneToggle(page)).toHaveCount(0); // nothing done yet

  await tick(page, 'B');
  await expect(subtaskTitles(page)).toHaveText(['A', 'C']);
  await expectSwitch(page, 1, false);
  await expect(page.locator('aside').getByText('Subtasks (3)')).toBeVisible(); // count still includes done
  // In the header, above the list — it doesn't move when the list grows.
  const switchBox = await doneToggle(page).boundingBox();
  const firstRow = await page.locator('[data-testid="subtask-row"]').first().boundingBox();
  expect(switchBox.y + switchBox.height).toBeLessThanOrEqual(firstRow.y);

  await doneToggle(page).click();
  await expect(subtaskTitles(page)).toHaveText(['A', 'B', 'C']);
  await expectSwitch(page, 1, true);
  expect((await doneToggle(page).boundingBox()).y).toBeCloseTo(switchBox.y, 0);

  // Revealed: unticking keeps it in place.
  await tick(page, 'B');
  await expect(subtaskTitles(page)).toHaveText(['A', 'B', 'C']);
  await tick(page, 'B');
  await expect(subtaskTitles(page)).toHaveText(['A', 'B', 'C']);

  // Close and reopen → hidden again.
  await page.locator('aside button[title="Close panel"]').click();
  await expect(page.locator('[data-testid="card-progress"]').getByText('1/3')).toBeVisible(); // card face counts all
  await openCard(page, cardTitle);
  await expect(subtaskTitles(page)).toHaveText(['A', 'C']);
  await expectSwitch(page, 1, false);
});

test('switch on: untick the last done → switch gone; tick one again → it comes back on, row stays', async ({ page }) => {
  const { cardTitle } = await setupBoard(page);
  await openCard(page, cardTitle);
  await pasteBatch(page, ['A', 'B']);
  await tick(page, 'A');
  await doneToggle(page).click();
  await expectSwitch(page, 1, true);

  await tick(page, 'A'); // untick the only done one
  await expect(doneToggle(page)).toHaveCount(0);
  await expect(doneCount(page)).toHaveCount(0);

  await tick(page, 'B');
  await expectSwitch(page, 1, true);
  await expect(subtaskTitles(page)).toHaveText(['A', 'B']);
});

test('a Card with every Subtask done shows only the header switch and "+ Add subtask"', async ({ page }) => {
  const { cardTitle } = await setupBoard(page);
  await openCard(page, cardTitle);
  await pasteBatch(page, ['A', 'B']);
  await tick(page, 'A');
  await tick(page, 'B');
  await page.locator('aside button[title="Close panel"]').click();
  await openCard(page, cardTitle);

  await expect(subtaskTitles(page)).toHaveCount(0);
  await expectSwitch(page, 2, false);
  await expect(page.locator('aside').getByRole('button', { name: '+ Add subtask' })).toBeVisible();
});

test('↑ skips a hidden done Subtask in one press; hidden one stays put; persists after reload', async ({ page }) => {
  const { cardTitle } = await setupBoard(page);
  await openCard(page, cardTitle);
  await pasteBatch(page, ['A', 'B', 'C']);
  await tick(page, 'B');
  await expect(subtaskTitles(page)).toHaveText(['A', 'C']);

  const panel = page.locator('aside');
  // ↑ disabled on the first visible row, ↓ on the last.
  await expect(panel.locator('button[title="Move up"]').first()).toBeDisabled();
  await expect(panel.locator('button[title="Move down"]').last()).toBeDisabled();

  await Promise.all([
    page.waitForResponse(r => r.url().includes('/subtasks') && r.request().method() === 'PATCH' && r.status() === 200),
    panel.locator('button[title="Move up"]').last().click(), // C ↑
  ]);
  await expect(subtaskTitles(page)).toHaveText(['C', 'A']);

  await doneToggle(page).click();
  await expect(subtaskTitles(page)).toHaveText(['C', 'A', 'B']); // B kept its slot after A

  await page.reload();
  await openCard(page, cardTitle);
  await doneToggle(page).click();
  await expect(subtaskTitles(page)).toHaveText(['C', 'A', 'B']);
});
