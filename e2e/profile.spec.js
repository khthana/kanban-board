const { test, expect } = require('@playwright/test');
const { uid, register, login } = require('./helpers');

const PW = 'password1';

async function goToProfile(page) {
  await page.goto('/profile');
  // Wait for form to be populated via async fetchProfile()
  await expect(page.locator('#profile-email')).not.toHaveValue('');
}

test('update displayName — TopBar reflects immediately, persists after refresh', async ({ page }) => {
  const email = `user-${uid()}@test.com`;
  await register(page, email, PW, 'Original Name');

  // Create a board so TopBar is accessible
  await page.fill('input[placeholder="New board name…"]', 'Profile Test Board');
  await page.click('button:has-text("Create Board")');
  await page.getByRole('link', { name: 'Profile Test Board' }).click();
  await expect(page).toHaveURL(/\/boards\//);

  // TopBar dropdown button shows original name
  await expect(page.locator('button:has-text("Original Name")')).toBeVisible();

  // Navigate to profile and update name
  await goToProfile(page);
  await page.fill('#profile-displayName', 'Updated Name');
  await page.click('button:has-text("บันทึก")');
  await expect(page.getByText('บันทึกแล้ว')).toBeVisible();

  // Navigate back via SPA — TopBar shows new name immediately (no full reload needed)
  await page.click('a:has-text("← Boards")');
  await page.waitForURL('**/boards');
  await page.getByRole('link', { name: 'Profile Test Board' }).click();
  await expect(page).toHaveURL(/\/boards\//);
  await expect(page.locator('button:has-text("Updated Name")')).toBeVisible();

  // Reload — name persists after full page refresh
  await page.reload();
  await page.waitForLoadState('networkidle');
  await expect(page.locator('button:has-text("Updated Name")')).toBeVisible({ timeout: 10000 });
});

test('email conflict shows inline error below email field', async ({ page, browser }) => {
  const takenEmail = `taken-${uid()}@test.com`;

  // Register the user whose email will be "taken"
  const ctx2 = await browser.newContext();
  const page2 = await ctx2.newPage();
  await register(page2, takenEmail, PW, 'Other User');
  await page2.close();
  await ctx2.close();

  // Register main user and go to profile
  const email = `user-${uid()}@test.com`;
  await register(page, email, PW, 'Main User');
  await goToProfile(page);

  // Try to change email to already-taken address
  await page.fill('#profile-email', takenEmail);
  await page.click('button:has-text("บันทึก")');

  // Inline error appears below email field — no toast
  await expect(page.getByText('Email นี้ถูกใช้งานแล้ว')).toBeVisible();
  await expect(page.getByText('บันทึกแล้ว')).not.toBeVisible();
});

test('change password — can login with new password after logout', async ({ page }) => {
  const email = `user-${uid()}@test.com`;
  const newPW = 'newpassword99';
  await register(page, email, PW, 'Test User');

  // Change password on profile page
  await goToProfile(page);
  await page.fill('#current-password', PW);
  await page.fill('#new-password', newPW);
  await page.fill('#confirm-password', newPW);
  await page.click('button:has-text("เปลี่ยนรหัสผ่าน")');
  await expect(page.getByText('เปลี่ยนรหัสผ่านแล้ว')).toBeVisible();

  // Fields are cleared after success
  await expect(page.locator('#current-password')).toHaveValue('');
  await expect(page.locator('#new-password')).toHaveValue('');

  // Logout and login with new password (SPA nav to avoid full reload)
  await page.click('a:has-text("← Boards")');
  await page.waitForURL('**/boards');
  await page.click('button:has-text("Sign out")');
  await expect(page).toHaveURL(/\/login/);

  await login(page, email, newPW);
  await expect(page).toHaveURL(/\/boards$/);
});

test('wrong current password shows inline error below that field', async ({ page }) => {
  const email = `user-${uid()}@test.com`;
  await register(page, email, PW, 'Test User');

  await goToProfile(page);
  await page.fill('#current-password', 'wrongpassword');
  await page.fill('#new-password', 'newpassword99');
  await page.fill('#confirm-password', 'newpassword99');
  await page.click('button:has-text("เปลี่ยนรหัสผ่าน")');

  // Inline error below currentPassword field — no toast
  await expect(page.getByText('รหัสผ่านปัจจุบันไม่ถูกต้อง')).toBeVisible();
  await expect(page.getByText('เปลี่ยนรหัสผ่านแล้ว')).not.toBeVisible();

  // Original password still works (SPA nav to avoid full reload)
  await page.click('a:has-text("← Boards")');
  await page.waitForURL('**/boards');
  await page.click('button:has-text("Sign out")');
  await login(page, email, PW);
  await expect(page).toHaveURL(/\/boards$/);
});
