import { test, expect } from '@playwright/test';
import { fakeUser, fakeTokens, mockStoreEndpoints } from './helpers';

test('successful registration redirects to home', async ({ page }) => {
  await mockStoreEndpoints(page);

  await page.route('**/v1/auth/register', (route) => {
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ user: fakeUser, tokens: fakeTokens }),
    });
  });

  await page.goto('/register');

  await page.getByLabel('Display Name').fill('New User');
  await page.getByLabel('Email').fill('new@example.com');
  await page.getByLabel('Password', { exact: true }).fill('password123');
  await page.getByLabel('Confirm Password').fill('password123');
  await page.getByRole('button', { name: 'Create Account' }).click();

  await page.waitForURL('**/');
  await expect(page.getByRole('heading', { name: 'Express yourself in VR' })).toBeVisible();
});

test('short password shows validation error', async ({ page }) => {
  await page.goto('/register');

  await page.getByLabel('Email').fill('new@example.com');
  await page.getByLabel('Password', { exact: true }).fill('short');
  await page.getByLabel('Confirm Password').fill('short');
  await page.getByRole('button', { name: 'Create Account' }).click();

  await expect(page.getByText('Password must be at least 8 characters')).toBeVisible();
});

test('server error is displayed', async ({ page }) => {
  await page.route('**/v1/auth/register', (route) => {
    route.fulfill({
      status: 409,
      contentType: 'application/json',
      body: JSON.stringify({ error: 'Email already registered' }),
    });
  });

  await page.goto('/register');

  await page.getByLabel('Email').fill('existing@example.com');
  await page.getByLabel('Password', { exact: true }).fill('password123');
  await page.getByLabel('Confirm Password').fill('password123');
  await page.getByRole('button', { name: 'Create Account' }).click();

  await expect(page.getByText('Email already registered')).toBeVisible();
});
