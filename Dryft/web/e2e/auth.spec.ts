import { test, expect } from '@playwright/test';

const fakeUser = {
  id: 'user-1',
  email: 'test@example.com',
  verified: true,
  created_at: new Date().toISOString(),
};

const fakeTokens = {
  access_token: 'access-token',
  refresh_token: 'refresh-token',
  expires_in: 3600,
};

test('login form renders and redirects after login', async ({ page }) => {
  await page.route('**/v1/store/featured?*', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ items: [] }),
    })
  );
  await page.route('**/v1/store/popular?*', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ items: [] }),
    })
  );
  await page.route('**/v1/auth/login', (route) => {
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ user: fakeUser, tokens: fakeTokens }),
    });
  });

  await page.goto('/login');

  await expect(page.getByRole('link', { name: 'Drift' })).toBeVisible();
  await page.getByLabel('Email').fill('test@example.com');
  await page.getByLabel('Password').fill('password123');
  await page.getByRole('button', { name: 'Sign In' }).click();

  await page.waitForURL('**/');
  await expect(page.getByRole('heading', { name: 'Express yourself in VR' })).toBeVisible();
});

test('register shows validation errors', async ({ page }) => {
  await page.goto('/register');

  await page.getByLabel('Email').fill('new@example.com');
  await page.getByLabel('Password').fill('password123');
  await page.getByLabel('Confirm Password').fill('different');
  await page.getByRole('button', { name: 'Create Account' }).click();

  await expect(page.getByText('Passwords do not match')).toBeVisible();
});
