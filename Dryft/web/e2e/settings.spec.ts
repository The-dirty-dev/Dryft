import { test, expect } from '@playwright/test';

test('settings page renders all categories', async ({ page }) => {
  await page.goto('/settings');

  await expect(page.getByRole('heading', { name: 'Settings' })).toBeVisible();
  await expect(page.getByText('Haptic Devices')).toBeVisible();
  await expect(page.getByText('Notifications')).toBeVisible();
  await expect(page.getByText('Privacy')).toBeVisible();
});

test('haptic devices link navigates correctly', async ({ page }) => {
  await page.goto('/settings');

  await page.getByText('Haptic Devices').click();
  await page.waitForURL('**/settings/devices');
});
