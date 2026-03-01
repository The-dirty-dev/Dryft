import { test, expect } from '@playwright/test';

const profile = {
  id: 'user-2',
  display_name: 'Riley',
  bio: 'VR explorer',
  profile_photo: null,
  age: 28,
  distance: 5,
  photos: [],
  interests: ['VR'],
};

test('matching flow swipes and shows match modal', async ({ page }) => {
  await page.route('**/v1/discover?*', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ profiles: [profile] }),
    })
  );

  await page.route('**/v1/discover/swipe', async (route) => {
    const body = route.request().postDataJSON() as { user_id: string; direction: string };
    if (body?.user_id !== 'user-2') {
      return route.fulfill({ status: 400, body: JSON.stringify({ error: 'bad user' }) });
    }
    return route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        matched: true,
        match_id: 'match-1',
        matched_user: profile,
      }),
    });
  });

  await page.goto('/discover');

  await expect(page.getByText('Riley')).toBeVisible();
  await page.getByRole('button', { name: '♥' }).click();

  await expect(page.getByText("It's a Match!")).toBeVisible();
  await expect(page.getByText('You and Riley liked each other')).toBeVisible();
});
