const { test, expect } = require('@playwright/test');
const { uid, register } = require('./helpers');

const PW = 'password1';

test('assign two members → card face shows a stack of two avatars', async ({ page, browser }) => {
  const ownerEmail = `own-${uid()}@test.com`;
  const memberEmail = `mem-${uid()}@test.com`;

  await register(page, ownerEmail, PW, 'Olivia');
  const ctx2 = await browser.newContext();
  const page2 = await ctx2.newPage();
  await register(page2, memberEmail, PW, 'Max');
  await page2.close();
  await ctx2.close();

  await page.goto('/boards');
  await page.fill('input[placeholder="New board name…"]', 'Team Board');
  await page.click('button:has-text("Create Board")');
  await page.getByRole('link', { name: 'Team Board' }).click();
  await expect(page).toHaveURL(/\/boards\//);

  // Invite the second member
  await page.click('button:has-text("+ Invite")');
  await page.fill('#invite-email', memberEmail);
  await page.locator('[role="dialog"] button:has-text("Invite")').click();
  await expect(page.getByText(memberEmail)).toBeVisible();
  await page.locator('[role="dialog"] button:has-text("✕")').click();

  // Column + card
  await page.click('text=+ Add column');
  await page.fill('input[placeholder="Column name…"]', 'Todo');
  await page.getByRole('button', { name: 'Add', exact: true }).click();
  await page.click('text=+ New card');
  await page.fill('textarea[placeholder="Card title…"]', 'Shared work');
  await Promise.all([
    page.waitForResponse(r => /\/cards/.test(r.url()) && r.request().method() === 'POST' && r.status() === 201),
    page.getByRole('button', { name: 'Add card', exact: true }).click(),
  ]);

  // Assign both members
  await page.getByText('Shared work').click();
  const toggles = page.locator('[data-testid="assignee-toggle"]');
  await expect(toggles).toHaveCount(2);
  for (let i = 0; i < 2; i++) {
    await Promise.all([
      page.waitForResponse(r => /\/assignees\//.test(r.url()) && r.request().method() === 'PUT' && r.status() === 200),
      toggles.nth(i).click(),
    ]);
  }

  await page.locator('button[title="Close panel"]').click();

  // Card face shows both avatars
  await expect(page.locator('[data-testid="avatar-stack"] > div')).toHaveCount(2);

  // Persists after reload
  await page.reload();
  await expect(page.locator('[data-testid="avatar-stack"] > div')).toHaveCount(2);
});
