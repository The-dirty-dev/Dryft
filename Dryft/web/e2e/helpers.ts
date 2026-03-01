import { Page } from '@playwright/test';

// =============================================================================
// Shared Mock Data
// =============================================================================

export const fakeTokens = {
  access_token: 'test-access-token',
  refresh_token: 'test-refresh-token',
  expires_in: 3600,
};

export const fakeUser = {
  id: 'user-1',
  email: 'test@example.com',
  display_name: 'Test User',
  verified: true,
  created_at: new Date().toISOString(),
};

export const fakeProfile = {
  ...fakeUser,
  bio: 'Hello there',
  avatar_url: null,
  stats: { inventory_count: 2, total_spent: 1200 },
};

export const fakeItem = {
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

// =============================================================================
// Helpers
// =============================================================================

/** Pre-populate localStorage with auth tokens so the page loads as authenticated. */
export async function authenticateUser(page: Page, tokens = fakeTokens) {
  await page.addInitScript((t) => {
    localStorage.setItem('drift_tokens', JSON.stringify(t));
  }, tokens);
}

/** Mock the common store endpoints that most pages fetch on load. */
export async function mockStoreEndpoints(page: Page) {
  await page.route('**/v1/store/featured?*', (route) =>
    route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ items: [] }) }),
  );
  await page.route('**/v1/store/popular?*', (route) =>
    route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ items: [] }) }),
  );
}

/** Return a JSON 200 response for a given route pattern. */
export function jsonRoute(page: Page, pattern: string, data: unknown) {
  return page.route(pattern, (route) =>
    route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(data) }),
  );
}
