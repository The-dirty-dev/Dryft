import { test, expect } from '@playwright/test';

test('messages list renders and conversation selection works', async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem('user', JSON.stringify({ id: 'user-1' }));
  });

  await page.route('**/v1/matches', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        matches: [
          {
            id: 'match-1',
            user: {
              id: 'user-2',
              display_name: 'Riley',
              profile_photo: null,
            },
            matched_at: new Date().toISOString(),
            last_message: 'Hey there!',
            last_message_at: new Date().toISOString(),
            unread_count: 1,
          },
        ],
      }),
    })
  );

  await page.route('**/v1/matches/match-1', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        id: 'match-1',
        user: {
          id: 'user-2',
          display_name: 'Riley',
          profile_photo: null,
        },
        matched_at: new Date().toISOString(),
      }),
    })
  );

  await page.route('**/v1/matches/match-1/conversation', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ id: 'conv-1' }),
    })
  );

  await page.route('**/v1/conversations/conv-1/messages', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ messages: [] }),
    })
  );

  await page.route('**/v1/conversations/conv-1/read', (route) =>
    route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({}) })
  );

  await page.goto('/messages');

  await expect(page.getByRole('heading', { name: 'Messages' })).toBeVisible();
  await expect(page.getByText('Riley')).toBeVisible();

  await page.getByRole('link', { name: 'Riley' }).click();
  await page.waitForURL('**/messages/match-1');
  await expect(page.getByRole('heading', { name: 'Riley' })).toBeVisible();
});
