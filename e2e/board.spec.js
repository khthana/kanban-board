const { test, expect } = require('@playwright/test');
const { uid, register } = require('./helpers');

const PW = 'password1';

test('create → open → rename → delete board', async ({ page }) => {
  await register(page, `user-${uid()}@test.com`, PW, 'Test User');

  // Create
  await page.fill('input[placeholder="New board name…"]', 'My Board');
  await page.click('button:has-text("Create Board")');
  await expect(page.getByRole('link', { name: 'My Board' })).toBeVisible();

  // Open
  await page.getByRole('link', { name: 'My Board' }).click();
  await expect(page).toHaveURL(/\/boards\//);
  await page.click('text=← Boards');

  // Rename
  await page.click('button[title="Rename"]');
  await page.fill('input[value="My Board"]', 'Renamed Board');
  await page.click('button:has-text("Save")');
  await expect(page.getByRole('link', { name: 'Renamed Board' })).toBeVisible();

  // Delete
  page.on('dialog', d => d.accept());
  await page.click('button[title="Delete"]');
  await expect(page.getByRole('link', { name: 'Renamed Board' })).not.toBeVisible();
});

test('member cannot delete board', async ({ page, browser }) => {
  const ownerEmail = `owner-${uid()}@test.com`;
  const memberEmail = `member-${uid()}@test.com`;

  await register(page, ownerEmail, PW, 'Owner');
  const ctx2 = await browser.newContext();
  const page2 = await ctx2.newPage();
  await register(page2, memberEmail, PW, 'Member');
  await page2.close();
  await ctx2.close();

  // Owner creates board and invites member
  await page.fill('input[placeholder="New board name…"]', 'Owner Board');
  await page.click('button:has-text("Create Board")');
  await page.getByRole('link', { name: 'Owner Board' }).click();
  await page.click('button:has-text("+ Invite")');
  await page.fill('#invite-email', memberEmail);
  await page.locator('[role="dialog"] button:has-text("Invite")').click();
  await page.keyboard.press('Escape');

  // Member opens board — should not see Delete button
  const ctx3 = await browser.newContext();
  const page3 = await ctx3.newPage();
  await page3.goto('/login');
  await page3.fill('#email', memberEmail);
  await page3.fill('#password', PW);
  await page3.click('button[type="submit"]');
  await page3.getByRole('link', { name: 'Owner Board' }).click();
  await expect(page3.locator('button[title="Delete"]')).not.toBeVisible();
  await page3.close();
  await ctx3.close();
});
