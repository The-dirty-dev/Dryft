import { test, expect } from '@playwright/test';
import { authenticateUser, fakeItem, jsonRoute } from './helpers';

const inventoryItem = {
  ...fakeItem,
  acquired_at: new Date().toISOString(),
  is_equipped: false,
};

test('inventory page shows items', async ({ page }) => {
  await authenticateUser(page);

  await jsonRoute(page, '**/v1/inventory*', { items: [inventoryItem] });

  await page.goto('/inventory');

  await expect(page.getByText('Neon Avatar')).toBeVisible();
});

test('inventory page shows empty state when no items', async ({ page }) => {
  await authenticateUser(page);

  await jsonRoute(page, '**/v1/inventory*', { items: [] });

  await page.goto('/inventory');

  await expect(page.getByText(/no items|empty|nothing/i)).toBeVisible();
});

test('redirects to login when not authenticated', async ({ page }) => {
  await page.goto('/inventory');

  await page.waitForURL('**/login*');
});
