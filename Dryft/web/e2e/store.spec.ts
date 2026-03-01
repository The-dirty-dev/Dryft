import { test, expect } from '@playwright/test';

const baseItem = {
  id: 'item-1',
  creator_id: 'creator-1',
  creator_name: 'Neon Creator',
  item_type: 'avatar',
  name: 'Neon Avatar',
  description: 'A bright avatar',
  price: 499,
  currency: 'USD',
  thumbnail_url: 'https://example.com/thumb.png',
  preview_url: 'https://example.com/preview.png',
  preview_urls: [],
  tags: ['neon'],
  purchase_count: 12,
  rating: 4.6,
  rating_count: 20,
  is_featured: true,
  is_owned: false,
};

test('store page renders item cards', async ({ page }) => {
  await page.route('**/v1/store/categories', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ categories: [] }),
    })
  );

  await page.route('**/v1/store/items?*', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ items: [baseItem], total: 1 }),
    })
  );

  await page.goto('/store');

  await expect(page.getByText('Neon Avatar')).toBeVisible();
  await expect(page.getByText('Featured')).toBeVisible();
});

test('purchase button shows free state', async ({ page }) => {
  const freeItem = { ...baseItem, id: 'free-item', price: 0, is_owned: false };

  await page.route('**/v1/store/items/free-item', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ item: freeItem }),
    })
  );
  await page.route('**/v1/store/items/free-item/reviews?*', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ reviews: [] }),
    })
  );

  await page.goto('/store/free-item');
  await expect(page.getByRole('button', { name: 'Get for Free' })).toBeVisible();
});

test('purchase button shows owned state', async ({ page }) => {
  const ownedItem = { ...baseItem, id: 'owned-item', price: 1299, is_owned: true };

  await page.route('**/v1/store/items/owned-item', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ item: ownedItem }),
    })
  );
  await page.route('**/v1/store/items/owned-item/reviews?*', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ reviews: [] }),
    })
  );

  await page.goto('/store/owned-item');
  await expect(page.getByText('You own this item')).toBeVisible();
});
