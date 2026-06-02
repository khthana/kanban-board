const { test, expect } = require('@playwright/test');
const { uid, register } = require('./helpers');

const PW = 'password1';

test('register creates account and redirects to boards', async ({ page }) => {
  await page.goto('/register');
  await page.fill('#displayName', 'Test User');
  await page.fill('#email', `user-${uid()}@test.com`);
  await page.fill('#password', PW);
  await page.click('button[type="submit"]');
  await expect(page).toHaveURL(/\/boards$/);
});

test('logout then login again', async ({ page }) => {
  const email = `user-${uid()}@test.com`;
  await register(page, email, PW, 'Test User');
  await page.click('button:has-text("Sign out")');
  await expect(page).toHaveURL(/\/login/);
  await page.fill('#email', email);
  await page.fill('#password', PW);
  await page.click('button[type="submit"]');
  await expect(page).toHaveURL(/\/boards$/);
});

test('unauthenticated visit redirects to login', async ({ page }) => {
  await page.goto('/boards');
  await expect(page).toHaveURL(/\/login/);
});
