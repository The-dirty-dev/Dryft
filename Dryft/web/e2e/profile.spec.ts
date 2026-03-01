import { test, expect } from '@playwright/test';

const fakeTokens = {
  access_token: 'user-access',
  refresh_token: 'user-refresh',
  expires_in: 3600,
};

const profile = {
  id: 'user-1',
  email: 'user@example.com',
  display_name: 'Casey',
  bio: 'Hello there',
  avatar_url: null,
  verified: false,
  created_at: new Date().toISOString(),
  stats: {
    inventory_count: 2,
    total_spent: 1200,
  },
};

test('profile renders and edit mode toggles', async ({ page }) => {
  await page.addInitScript((tokens) => {
    localStorage.setItem('drift_tokens', JSON.stringify(tokens));
  }, fakeTokens);

  await page.route('**/v1/users/me', (route) => {
    const method = route.request().method();
    if (method === 'PUT') {
      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({}) });
    }
    return route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ user: profile }),
    });
  });

  await page.goto('/profile');

  await expect(page.getByRole('heading', { name: 'Casey' })).toBeVisible();
  await page.getByRole('button', { name: 'Edit Profile' }).click();

  await expect(page.getByLabel('Display Name')).toBeVisible();
  await page.getByLabel('Display Name').fill('Casey Updated');
  await page.getByRole('button', { name: 'Save Changes' }).click();

  await expect(page.getByRole('button', { name: 'Edit Profile' })).toBeVisible();
});
