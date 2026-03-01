import { test, expect } from '@playwright/test';

test('chat flow sends a message via REST fallback', async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem('user', JSON.stringify({ id: 'user-1' }));
  });

  await page.route('**/v1/matches/match-1', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        id: 'match-1',
        user: { id: 'user-2', display_name: 'Riley', profile_photo: null },
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

  await page.route('**/v1/conversations/conv-1/messages', (route) => {
    const method = route.request().method();
    if (method === 'POST') {
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          id: 'msg-1',
          conversation_id: 'conv-1',
          sender_id: 'user-1',
          content: 'Hello there',
          type: 'text',
          created_at: new Date().toISOString(),
        }),
      });
    }

    return route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ messages: [] }),
    });
  });

  await page.route('**/v1/conversations/conv-1/read', (route) =>
    route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({}) })
  );

  await page.goto('/messages/match-1');

  await expect(page.getByRole('heading', { name: 'Riley' })).toBeVisible();

  await page.getByPlaceholder('Type a message...').fill('Hello there');
  await page.getByRole('button', { name: 'Send' }).click();

  await expect(page.getByText('Hello there')).toBeVisible();
});
