import { test, expect } from '@playwright/test';

test('main navigation links load pages', async ({ page }) => {
  await page.route('**/v1/store/featured?*', (route) =>
    route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ items: [] }) })
  );
  await page.route('**/v1/store/popular?*', (route) =>
    route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ items: [] }) })
  );
  await page.route('**/v1/store/categories', (route) =>
    route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ categories: [] }) })
  );
  await page.route('**/v1/store/items?*', (route) =>
    route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ items: [], total: 0 }) })
  );
  await page.route('**/v1/creators?*', (route) =>
    route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ creators: [], total: 0 }) })
  );

  await page.goto('/');

  await page.getByRole('link', { name: 'Store' }).click();
  await expect(page.getByText('No items found')).toBeVisible();

  await page.getByRole('link', { name: 'Creators' }).click();
  await expect(page.getByRole('heading', { name: 'Creators' })).toBeVisible();

  await page.getByRole('link', { name: 'Sign In' }).click();
  await expect(page.getByText('Sign in to your account')).toBeVisible();
});
