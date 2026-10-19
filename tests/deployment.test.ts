import { afterEach, describe, expect, it, vi } from 'vitest';
import { spawnSync } from 'node:child_process';
import { assertHostedStorage } from '../src/lib/deployment';
import { enforceDeploymentQuota } from '../src/lib/deployment-quota';
import { readReport, saveReport } from '../src/lib/store';
import { buildAnalysis } from '../src/lib/attribution';
import { randomUUID } from 'node:crypto';
import { repo, scope } from './fixtures';
afterEach(() => vi.unstubAllEnvs());
describe('Vercel deployment storage boundary', () => {
  it('allows local development without PostgreSQL', async () => {
    vi.stubEnv('VERCEL', '');
    vi.stubEnv('DATABASE_URL', '');
    expect(() => assertHostedStorage()).not.toThrow();
    await expect(enforceDeploymentQuota('analysis')).resolves.toBeUndefined();
  });
  it('fails closed on Vercel instead of writing reports to ephemeral storage', async () => {
    vi.stubEnv('VERCEL', '1');
    vi.stubEnv('DATABASE_URL', '');
    expect(() => assertHostedStorage()).toThrow('DATABASE_URL');
    const report = buildAnalysis({
      id: randomUUID(),
      repo,
      scope,
      commits: [],
      prs: [],
      warnings: [],
      complete: true,
      requests: 0,
    });
    await expect(saveReport(report)).rejects.toMatchObject({ status: 503 });
    await expect(readReport(report.id)).rejects.toMatchObject({ status: 503 });
    await expect(enforceDeploymentQuota('ai')).rejects.toMatchObject({ status: 503 });
  });
  it('stops the Vercel build before deployment if DATABASE_URL is missing', () => {
    const result = spawnSync(process.execPath, ['scripts/vercel-build.mjs'], {
      env: { ...process.env, DATABASE_URL: '' },
      encoding: 'utf8',
    });
    expect(result.status).toBe(1);
    expect(result.stderr).toContain('hosted PostgreSQL');
    expect(result.stdout).not.toContain('Creating an optimized production build');
  });
});
