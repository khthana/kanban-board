const { test, expect } = require('@playwright/test');
const { uid, register, login } = require('./helpers');

const PW = 'password1';

test('invite member → member sees board', async ({ page, browser }) => {
  const ownerEmail = `owner-${uid()}@test.com`;
  const memberEmail = `member-${uid()}@test.com`;

  // Register both users
  await register(page, ownerEmail, PW, 'Owner');
  const ctx2 = await browser.newContext();
  const page2 = await ctx2.newPage();
  await register(page2, memberEmail, PW, 'Member');
  await page2.close();
  await ctx2.close();

  // Owner creates board
  await page.goto('/boards');
  await page.fill('input[placeholder="New board name…"]', 'Shared Board');
  await page.click('button:has-text("Create Board")');
  await page.getByRole('link', { name: 'Shared Board' }).click();

  // Owner invites member
  await page.click('button:has-text("+ Invite")');
  await page.fill('#invite-email', memberEmail);
  await page.locator('[role="dialog"] button:has-text("Invite")').click();
  await expect(page.getByText(memberEmail)).toBeVisible(); // appears in member list

  // Member logs in and sees the board
  const ctx3 = await browser.newContext();
  const page3 = await ctx3.newPage();
  await login(page3, memberEmail, PW);
  await expect(page3.getByRole('link', { name: 'Shared Board' })).toBeVisible();
  await page3.close();
  await ctx3.close();
});
