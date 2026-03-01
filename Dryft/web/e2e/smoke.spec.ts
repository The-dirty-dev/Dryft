import { test, expect } from '@playwright/test';

test('home page loads', async ({ page }) => {
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

  await page.goto('/');
  await expect(page.getByRole('link', { name: 'Drift' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Express yourself in VR' })).toBeVisible();
});
