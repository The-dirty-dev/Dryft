import { test, expect } from '@playwright/test';

const fakeTokens = {
  access_token: 'admin-access',
  refresh_token: 'admin-refresh',
  expires_in: 3600,
};

const adminUser = {
  id: 'admin-1',
  email: 'admin@example.com',
  display_name: 'Admin',
  role: 'admin',
};

test('admin redirects to login when unauthenticated', async ({ page }) => {
  await page.route('**/v1/admin/**', (route) =>
    route.fulfill({ status: 401, contentType: 'application/json', body: JSON.stringify({}) })
  );

  await page.goto('/admin');
  await page.waitForURL('**/login?redirect=/admin');
  await expect(page.getByText('Sign in to your account')).toBeVisible();
});

test('admin dashboard renders when authenticated', async ({ page }) => {
  await page.addInitScript((tokens) => {
    localStorage.setItem('drift_tokens', JSON.stringify(tokens));
  }, fakeTokens);

  await page.route('**/v1/admin/me', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ user: adminUser }),
    })
  );
  await page.route('**/v1/admin/stats', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        stats: {
          total_users: 100,
          verified_users: 80,
          total_creators: 10,
          total_items: 50,
          pending_items: 2,
          total_sales: 5000,
          revenue_today: 1200,
          revenue_week: 4500,
          revenue_month: 12000,
          pending_verifications: 3,
          active_sessions: 5,
        },
      }),
    })
  );
  await page.route('**/v1/admin/activity?*', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ activities: [] }),
    })
  );

  await page.goto('/admin');
  await expect(page.getByRole('heading', { name: 'Dashboard' })).toBeVisible();
});
