import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
test('landing, keyboard access, methodology and responsive layout', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto('/');
  await expect(page.getByRole('heading', { name: /Understand the work/ })).toBeVisible();
  await page.keyboard.press('Tab');
  await expect(page.getByText('Skip to content', { exact: true })).toBeFocused();
  await expect(page.getByLabel('Public GitHub repository', { exact: true })).toHaveValue('');
  await expect(page.getByRole('button', { name: 'All history', exact: true })).toHaveAttribute(
    'aria-pressed',
    'true',
  );
  await expect(page.locator('#since')).toHaveCount(0);
  await page.getByRole('button', { name: 'Custom dates', exact: true }).click();
  await page.locator('#since').fill('2010-01-01');
  await page.locator('#until').fill('2025-12-31');
  await page
    .getByLabel('Public GitHub repository', { exact: true })
    .fill('https://github.com/octocat/Hello-World');
  expect(
    await page.locator('form').evaluate((form) => (form as HTMLFormElement).checkValidity()),
  ).toBe(true);
  await page.getByLabel('Public GitHub repository', { exact: true }).fill('');
  await page.getByRole('button', { name: 'All history', exact: true }).click();
  const axe = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze();
  expect(
    axe.violations.map((v) => ({
      id: v.id,
      nodes: v.nodes.map((n) => ({ target: n.target, summary: n.failureSummary })),
    })),
  ).toEqual([]);
  await page.getByRole('button', { name: 'Methodology', exact: true }).click();
  await expect(
    page.getByRole('heading', { name: 'Three metrics. Three denominators.' }),
  ).toBeVisible();
  for (const width of [1440, 768, 390, 320]) {
    await page.setViewportSize({ width, height: 900 });
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth),
    ).toBe(true);
  }
  await page.screenshot({ path: '/tmp/repotrace-mobile.png', fullPage: true });
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto('/');
  await page.screenshot({ path: '/tmp/repotrace-desktop.png', fullPage: true });
  expect(errors).toEqual([]);
});
test('API validates malformed URLs, cross-origin and report IDs', async ({ request }) => {
  const invalid = await request.post('/api/analyses', {
    data: {
      url: 'https://evil.test/owner/repo',
      since: '2025-06-01T00:00:00.000Z',
      until: '2025-06-30T23:59:59.999Z',
    },
  });
  expect(invalid.status()).toBe(400);
  const cross = await request.post('/api/analyses', {
    headers: { Origin: 'https://evil.test' },
    data: {},
  });
  expect(cross.status()).toBe(403);
  expect((await request.get('/api/reports/not-a-uuid')).status()).toBe(404);
  expect((await request.get('/api/health')).status()).toBe(200);
});
test('live public report, profile, metrics, exports and AI unavailable state', async ({
  page,
  request,
}) => {
  test.skip(process.env.E2E_LIVE !== '1', 'Requires a successfully collected live GitHub report.');
  await page.route('https://avatars.githubusercontent.com/**', (route) =>
    route.fulfill({
      contentType: 'image/png',
      body: Buffer.from(
        'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jZQkAAAAASUVORK5CYII=',
        'base64',
      ),
    }),
  );
  await page.goto('/');
  await page
    .getByLabel('Public GitHub repository', { exact: true })
    .fill('https://github.com/octocat/Hello-World');
  await page.getByRole('button', { name: 'Custom dates', exact: true }).click();
  await page.locator('#since').fill('2011-01-01');
  await page.locator('#until').fill('2011-12-31');
  await page.getByRole('button', { name: 'Analyze repository' }).click();
  await expect(page.getByRole('heading', { name: /Hello-World/ })).toBeVisible({
    timeout: 110000,
  });
  await page.waitForURL('**/reports/*');
  const id = page.url().split('/').at(-1)!;
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await expect(page.getByText('Traversal finished', { exact: false })).toBeVisible();
  await expect(page.getByText('50.0%', { exact: true })).toHaveCount(2);
  await expect(page.locator('.person-mark img').first()).toHaveAttribute(
    'src',
    /^https:\/\/avatars\.githubusercontent\.com\/u\/\d+\?s=96$/,
  );
  await expect(page.locator('.person-mark img').first()).toBeVisible();
  expect(
    await page
      .locator('.person-mark img')
      .first()
      .evaluate((image) => (image as HTMLImageElement).naturalWidth),
  ).toBeGreaterThan(0);
  await page.getByRole('button', { name: 'Code changes', exact: true }).click();
  await expect(page.getByText('66.7%', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Merged PRs', exact: true }).click();
  await expect(page.getByText('0.0%', { exact: true })).toHaveCount(2);
  await page.getByRole('button', { name: 'View Spaceghost profile' }).click();
  await expect(page.getByRole('heading', { name: 'Spaceghost', exact: true })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Linked evidence' })).toBeVisible();
  await expect(page.locator('.profile-panel .person-mark img')).toBeVisible();
  expect(
    (
      await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze()
    ).violations.map((v) => ({ id: v.id, targets: v.nodes.map((n) => n.target) })),
  ).toEqual([]);
  await page.getByRole('button', { name: 'Close contributor profile' }).click();
  if (!process.env.GROQ_API_KEY) {
    await page.getByRole('button', { name: 'Send evidence & estimate impact' }).click();
    await expect(page.getByRole('alert').filter({ hasText: 'AI estimates' })).toContainText(
      'not configured',
    );
  }
  await page.getByRole('button', { name: 'Evidence', exact: true }).click();
  await expect(page.getByRole('link', { name: 'first commit' })).toBeVisible();
  const axe = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze();
  expect(
    axe.violations.map((v) => ({
      id: v.id,
      nodes: v.nodes.map((n) => ({ target: n.target, summary: n.failureSummary })),
    })),
  ).toEqual([]);
  const pdf = await request.get(`/api/reports/${id}/export?format=pdf`);
  expect(pdf.status()).toBe(200);
  expect(pdf.headers()['content-type']).toBe('application/pdf');
  expect(pdf.headers()['content-disposition']).toContain('.pdf');
  expect((await pdf.body()).subarray(0, 5).toString()).toBe('%PDF-');
  const invalidExport = await request.get(`/api/reports/${id}/export?format=html`);
  expect(invalidExport.status()).toBe(400);
  const csv = await request.get(`/api/reports/${id}/export?format=csv`);
  expect(csv.status()).toBe(200);
  expect(await csv.text()).toContain('Spaceghost');
  expect(csv.headers()['content-disposition']).toContain('attachment');
  const json = await request.get(`/api/reports/${id}/export?format=json`);
  expect((await json.json()).repo.fullName).toBe('octocat/Hello-World');
  await page.getByRole('button', { name: 'Overview', exact: true }).click();
  expect(
    (
      await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze()
    ).violations.map((v) => ({ id: v.id, targets: v.nodes.map((n) => n.target) })),
  ).toEqual([]);
  await page.screenshot({ path: '/tmp/repotrace-live-report.png', fullPage: true });
  for (const width of [768, 390, 320]) {
    await page.setViewportSize({ width, height: 900 });
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth),
    ).toBe(true);
  }
  await page.getByRole('button', { name: 'Overview', exact: true }).click();
  await page.getByText('Export', { exact: true }).click();
  const downloadPromise = page.waitForEvent('download');
  await page.getByRole('link', { name: 'Report PDF', exact: true }).click();
  expect((await downloadPromise).suggestedFilename()).toBe(`repotrace-${id}.pdf`);
  await page.unroute('https://avatars.githubusercontent.com/**');
  await page.route('https://avatars.githubusercontent.com/**', (route) => route.abort());
  await page.reload();
  await expect(page.locator('.person-mark img')).toHaveCount(0);
  await expect(page.locator('.person-mark').first()).not.toBeEmpty();
  expect(errors).toEqual([]);
});

test('analysis errors expose an actionable reference and platform timeouts without JSON parsing failures', async ({
  page,
}) => {
  await page.goto('/');
  await page
    .getByLabel('Public GitHub repository', { exact: true })
    .fill('https://github.com/hmaach/01edu-tests');
  await page.route('**/api/analyses', (route) =>
    route.fulfill({
      status: 503,
      contentType: 'application/json',
      body: JSON.stringify({
        error:
          'Database tables are missing. Set the Vercel build command to npm run vercel:build and redeploy.',
        code: 'DATABASE_SCHEMA_MISSING',
        requestId: 'browser-reference',
      }),
    }),
  );
  await page.getByRole('button', { name: 'Analyze repository' }).click();
  await expect(page.getByRole('alert').filter({ hasText: 'Database tables' })).toContainText(
    'browser-reference',
  );
  await page.unroute('**/api/analyses');
  await page.route('**/api/analyses', (route) =>
    route.fulfill({ status: 504, contentType: 'text/html', body: '<html>Gateway Timeout</html>' }),
  );
  await page.getByRole('button', { name: 'Analyze repository' }).click();
  await expect(page.getByRole('alert').filter({ hasText: 'execution time' })).toBeVisible();
});
