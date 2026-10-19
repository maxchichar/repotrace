import { describe, it, expect, vi, afterEach } from 'vitest';
import { randomUUID } from 'node:crypto';
import { saveReport, readReport } from '../src/lib/store';
import { enforceDeploymentQuota } from '../src/lib/deployment-quota';
import { database } from '../src/lib/db/client';
import { rateLimits } from '../src/lib/db/schema';
import { eq } from 'drizzle-orm';
import { buildAnalysis } from '../src/lib/attribution';
import { commit, pr, repo, scope } from './fixtures';
afterEach(() => vi.unstubAllEnvs());
describe.skipIf(!process.env.TEST_DATABASE_URL)('PostgreSQL + Drizzle integration', () => {
  it('persists, updates AI separately, and expires real PostgreSQL report rows', async () => {
    vi.stubEnv('DATABASE_URL', process.env.TEST_DATABASE_URL!);
    const report = buildAnalysis({
      id: randomUUID(),
      repo,
      scope,
      commits: [commit('db-test')],
      prs: [pr(1)],
      warnings: [],
      complete: true,
      requests: 1,
    });
    await saveReport(report);
    expect(await readReport(report.id)).toEqual(report);
    report.insights = { model: 'test-only', generatedAt: new Date().toISOString(), estimates: [] };
    await saveReport(report);
    expect((await readReport(report.id)).insights?.model).toBe('test-only');
    report.expiresAt = '2020-01-01T00:00:00.000Z';
    await saveReport(report);
    await expect(readReport(report.id)).rejects.toMatchObject({ status: 404 });
  });
  it('atomically bounds requests across concurrent serverless calls and resets the next UTC hour', async () => {
    vi.stubEnv('DATABASE_URL', process.env.TEST_DATABASE_URL!);
    vi.stubEnv('VERCEL', '1');
    const now = Date.UTC(2040, 0, 1, 12, 30);
    const key = `deployment:ai:${Math.floor(now / 3600000)}`;
    const nextKey = `deployment:ai:${Math.floor(now / 3600000) + 1}`;
    const db = database();
    await db.delete(rateLimits).where(eq(rateLimits.key, key));
    await db.delete(rateLimits).where(eq(rateLimits.key, nextKey));
    try {
      const calls = await Promise.allSettled(
        Array.from({ length: 8 }, () => enforceDeploymentQuota('ai', now)),
      );
      expect(calls.filter((c) => c.status === 'fulfilled')).toHaveLength(4);
      const failures = calls.filter((c) => c.status === 'rejected');
      expect(failures).toHaveLength(4);
      for (const failure of failures)
        if (failure.status === 'rejected')
          expect(failure.reason).toMatchObject({ status: 429, retryAfter: 1800 });
      await expect(enforceDeploymentQuota('ai', now + 3600000)).resolves.toBeUndefined();
    } finally {
      await db.delete(rateLimits).where(eq(rateLimits.key, key));
      await db.delete(rateLimits).where(eq(rateLimits.key, nextKey));
    }
  });
});
