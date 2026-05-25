import { test, expect, type BrowserContext, type Page } from '@playwright/test';

const backendHazard = {
  id: 'hazard-1',
  type: 'blocked_pavement',
  description: 'Blocked pavement. A parked car blocks the dropped kerb.',
  status: 'Reported',
  reportedAt: '2026-05-25T09:30:00Z',
  location: {
    coordinates: [-1.891, 52.481],
  },
};

const hazardPage = {
  items: [backendHazard],
  nextCursor: null,
  limit: 25,
  hasMore: false,
};

async function installCoreApiMocks(page: Page) {
  await page.route('**/api/v1/hazards/page**', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(hazardPage),
    });
  });

  await page.route('**/api/v1/hazards/hazard-1', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(backendHazard),
    });
  });

  await page.route('**/api/v1/routing/safe-path', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        distance: 1200,
        estimatedTime: 18,
        safetyScore: 0.92,
        warnings: [],
        path: {
          type: 'LineString',
          coordinates: [
            [-1.89, 52.48],
            [-1.885, 52.482],
            [-1.88, 52.485],
          ],
        },
        steps: [
          {
            instruction: 'Use the step-free crossing, then continue on Bristol Road.',
          },
        ],
      }),
    });
  });

  await page.route('**/api/v1/geocoding/reverse**', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        display_name: 'Bournbrook Road, Birmingham',
      }),
    });
  });
}

async function grantBirminghamLocation(context: BrowserContext) {
  await context.grantPermissions(['geolocation']);
  await context.setGeolocation({ latitude: 52.48, longitude: -1.89 });
}

async function installAccountApiMocks(page: Page) {
  await page.route('**/api/v1/account/profile', async (route) => {
    const request = route.request();
    const fullName = request.method() === 'PUT'
      ? (request.postDataJSON() as { fullName?: string }).fullName || 'Profile Tester'
      : 'Profile Tester';

    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        email: 'profile@test.local',
        fullName,
        accessibilityPreferences: {
          mobilityDevice: 'Manual wheelchair',
          avoidStairs: true,
          avoidSteepIncline: true,
          preferCurbRamps: true,
          preferSmoothSurface: true,
          maxDetourToleranceMinutes: 30,
        },
        stats: {
          reportsSubmitted: 7,
          resolvedReports: 4,
          communityImpact: 11,
        },
      }),
    });
  });

  await page.route('**/api/v1/account/notifications', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        hazardAlerts: true,
        routeWarnings: true,
        reportUpdates: true,
        weeklySummary: false,
      }),
    });
  });

  await page.route('**/api/v1/account/support/contact', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        id: 'support-1',
        status: 'received',
        createdAtUtc: '2026-05-25T10:00:00Z',
      }),
    });
  });
}

test.describe('AccessCity web (Expo)', () => {
  test.describe.configure({ mode: 'serial' });

  test('landing shows AccessCity branding', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByText('Navigate your world with confidence')).toBeVisible({ timeout: 60_000 });
    await expect(page.getByText('Sign In', { exact: true })).toBeVisible();
  });

  test('can switch to Sign Up tab and see full name field', async ({ page }) => {
    await page.goto('/');
    await page.getByText('Sign Up', { exact: true }).click();
    await expect(page.getByPlaceholder('Full Name')).toBeVisible({ timeout: 15_000 });
  });

  test('empty sign-in shows validation', async ({ page }) => {
    await page.goto('/');
    await page.getByTestId('index-auth-submit').click();
    await expect(page.getByText(/Please fill in all mandatory fields/i)).toBeVisible({
      timeout: 10_000,
    });
  });

  test('map tab renders the web map shell', async ({ page }) => {
    await page.goto('/map');
    await expect(page.getByText('Recommended route')).toBeVisible({ timeout: 60_000 });
  });

  test('map recommendation starts and ends guidance from a loaded route', async ({ page }) => {
    await installCoreApiMocks(page);

    await page.goto('/map');

    await expect(page.getByText('Recommended route')).toBeVisible({ timeout: 60_000 });
    await expect(page.getByText('1 city reports')).toBeVisible();
    await expect(page.getByText('Avoids known hazards')).toBeVisible();
    await expect(page.getByText('Start navigation')).toBeVisible({ timeout: 20_000 });

    await page.getByText('Start navigation').click();

    await expect(page.getByText('Navigation active')).toBeVisible();
    await expect(page.getByText('Next step')).toBeVisible();
    await expect(page.getByText('Use the step-free crossing, then continue on Bristol Road.')).toBeVisible();

    await page.getByLabel('End navigation').click();

    await expect(page.getByText('Navigation active')).not.toBeVisible();
  });

  test('hazard inbox search and avoid-route action navigate into map', async ({ page }) => {
    await installCoreApiMocks(page);

    await page.goto('/hazard');

    await expect(page.getByText('Hazards', { exact: true })).toBeVisible({ timeout: 60_000 });
    await expect(page.getByText('Blocked pavement')).toBeVisible();

    await page.getByLabel('Search hazards').click();
    await page.getByPlaceholder('Search type, street, or status').fill('blocked');
    await expect(page.getByText('May block wheelchair access')).toBeVisible();

    await page.getByText('Avoid in route').click();

    await expect(page).toHaveURL(/\/map/);
    await expect(page.getByText(/Avoiding Blocked pavement/)).toBeVisible({ timeout: 20_000 });
  });

  test('report flow checks nearby duplicates and links back to hazard inbox', async ({ page, context }) => {
    await grantBirminghamLocation(context);
    await installCoreApiMocks(page);

    await page.goto('/report/reportpage');

    await expect(page.getByText('Report issue')).toBeVisible({ timeout: 60_000 });
    await page.getByText('Blocked pavement').click();
    await page.getByText('Next').click();

    await expect(page.getByText(/nearby report.*may match/i)).toBeVisible({ timeout: 20_000 });
    await page.getByText('Review').click();

    await expect(page).toHaveURL(/\/hazard/);
    await expect(page.getByText('Hazards')).toBeVisible({ timeout: 20_000 });
  });

  test('profile modules open their connected panels', async ({ page }) => {
    await installAccountApiMocks(page);

    await page.goto('/profile');

    await expect(page.getByText('Profile Tester')).toBeVisible({ timeout: 60_000 });
    await expect(page.getByText('My reports')).toBeVisible();

    await page.getByText('Edit Profile').click();
    await expect(page.getByText('Save profile')).toBeVisible();

    await page.getByText('Notifications').click();
    await expect(page.getByText('Save notifications')).toBeVisible();

    await page.getByText('Help & Support').click();
    await expect(page.getByText('Send support request')).toBeVisible();

    await expect(page.getByText('System Operations')).toBeVisible();
  });
});
