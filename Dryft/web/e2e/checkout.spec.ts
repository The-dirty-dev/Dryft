import { test, expect } from '@playwright/test';
import { authenticateUser, jsonRoute } from './helpers';

const fakePurchase = {
  purchase_id: 'purchase-1',
  item_name: 'Neon Avatar',
  item_thumbnail: 'https://example.com/thumb.png',
  creator_name: 'Neon Creator',
  amount: 499,
  currency: 'USD',
};

test('checkout shows error for missing session params', async ({ page }) => {
  await authenticateUser(page);

  await page.goto('/checkout');

  await expect(page.getByText('Invalid checkout session')).toBeVisible();
});

test('checkout page loads purchase details', async ({ page }) => {
  await authenticateUser(page);

  await jsonRoute(page, '**/v1/store/purchases/purchase-1', { purchase: fakePurchase });

  await page.goto('/checkout?secret=pi_secret_test&purchase=purchase-1');

  await expect(page.getByText('Neon Avatar')).toBeVisible();
  await expect(page.getByText('Neon Creator')).toBeVisible();
});

test('checkout success shows completed purchase', async ({ page }) => {
  await authenticateUser(page);

  const completedPurchase = {
    ...fakePurchase,
    item_id: 'item-1',
    item_type: 'avatar',
    status: 'completed',
    completed_at: new Date().toISOString(),
  };

  await jsonRoute(page, '**/v1/store/purchases/purchase-1', { purchase: completedPurchase });

  await page.goto('/checkout/success?purchase=purchase-1&payment_intent=pi_test');

  await expect(page.getByText('Neon Avatar')).toBeVisible();
});

test('checkout success shows error for missing purchase id', async ({ page }) => {
  await authenticateUser(page);

  await page.goto('/checkout/success');

  await expect(page.getByText('Invalid purchase')).toBeVisible();
});
