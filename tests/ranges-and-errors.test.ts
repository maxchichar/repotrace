import { describe, it, expect, vi, afterEach } from 'vitest';
import { inputSchema, AppError } from '../src/lib/validation';
import { buildAnalysis } from '../src/lib/attribution';
import { activitySeries } from '../src/lib/measurements';
import { storageError } from '../src/lib/db/errors';
import { errorResponse } from '../src/lib/security';
import { readApiResponse, requestFailureMessage } from '../src/lib/api-client';
import type { Actor, Contributor } from '../src/lib/types';
import { commit, pr, repo, scope, alice } from './fixtures';
afterEach(() => vi.restoreAllMocks());
const build = (commits = [commit('a')], prs = [pr(1)], analysisScope = scope) =>
  buildAnalysis({
    id: 'test',
    repo,
    scope: analysisScope,
    commits,
    prs,
    warnings: [],
    complete: true,
    requests: 1,
  });
describe('unrestricted calendar ranges', () => {
  it('accepts multi-year scopes while still validating ordering and dates', () => {
    expect(
      inputSchema.safeParse({ url: repo.url, since: '2010-01-01T00:00:00Z', until: scope.until })
        .success,
    ).toBe(true);
    expect(inputSchema.safeParse({ url: repo.url, mode: 'all' }).success).toBe(true);
    expect(inputSchema.safeParse({ url: repo.url, mode: 'custom' }).success).toBe(false);
    expect(
      inputSchema.safeParse({ url: repo.url, since: scope.until, until: scope.since }).success,
    ).toBe(false);
    expect(
      inputSchema.safeParse({ url: repo.url, since: scope.since, until: '2999-01-01T00:00:00Z' })
        .success,
    ).toBe(false);
  });
  it('all-history scope includes older commits and uses the earliest observed timestamp for charts', () => {
    const report = buildAnalysis({
      id: 'test',
      repo,
      scope: { ...scope, mode: 'all' },
      commits: [
        commit('old', alice, {
          commit: {
            message: 'Earlier work',
            author: { name: 'Alice', email: 'alice@example.test', date: '2010-02-03T00:00:00Z' },
          },
        }),
      ],
      prs: [{ ...pr(1), merged_at: '2010-02-04T00:00:00Z' }],
      warnings: [],
      complete: true,
      requests: 1,
    });
    expect(report.contributors[0].commits).toBe(1);
    expect(report.contributors[0].prs).toBe(1);
    expect(report.scope.since).toBe('2010-02-03T00:00:00Z');
    expect(report.scope.mode).toBe('all');
  });
  it('multi-year charts preserve both early and recent activity and quiet periods', () => {
    const person: Contributor = {
      ...build().contributors[0],
      commits: 2,
      churn: 20,
      timeline: [
        { date: '2020-01-10', commits: 1, churn: 10, prs: 0 },
        { date: '2026-01-10', commits: 1, churn: 10, prs: 0 },
      ],
    };
    const series = activitySeries([person], 'commits', {
      since: '2020-01-01T00:00:00Z',
      until: scope.until,
    });
    expect(series[0].resolution).toBe('month');
    expect(series.reduce((s, p) => s + p.value, 0)).toBe(2);
    expect(series.find((p) => p.date === '2026-01')?.value).toBe(1);
    expect(series.find((p) => p.date === '2021-01')?.value).toBe(0);
    const yearly = activitySeries([person], 'churn', {
      since: '2000-01-01T00:00:00Z',
      until: scope.until,
    });
    expect(yearly[0].resolution).toBe('year');
    expect(yearly.reduce((s, p) => s + p.value, 0)).toBe(20);
  });
});
describe('incomplete GitHub author metadata regression', () => {
  it.each([{}, { id: 99 }])(
    'does not crash or fabricate an account for incomplete metadata %j',
    (actor) => {
      const report = build([commit('incomplete', actor as Actor)]);
      expect(report.contributors.some((p) => p.id === 'gh:99')).toBe(false);
      expect(report.contributors.find((p) => p.identity === 'unresolved')?.commits).toBe(1);
      expect(report.warnings.join(' ')).toContain('incomplete account metadata');
    },
  );
  it('links a missing login by numeric ID only if that account was observed elsewhere', () => {
    const report = build([commit('a', alice), commit('b', { id: alice.id } as Actor)], []);
    expect(report.contributors).toHaveLength(1);
    expect(report.contributors[0].id).toBe('gh:1');
    expect(report.contributors[0].commits).toBe(2);
  });
  it('keeps malformed PR authors unresolved and retains an explicitly reported bot type', () => {
    const report = build([], [pr(1, { type: 'Bot' } as Actor)]);
    expect(report.contributors[0].identity).toBe('unresolved');
    expect(report.contributors[0].bot).toBe(true);
    expect(report.contributors[0].url).toBeUndefined();
  });
});
describe('actionable API errors without secret disclosure', () => {
  it('maps missing schemas, authentication and network failures to configuration actions', () => {
    expect(storageError({ cause: { code: '42P01' } })).toMatchObject({
      status: 503,
      code: 'DATABASE_SCHEMA_MISSING',
    });
    expect(storageError({ code: '28P01' }).message).toContain('credentials');
    expect(storageError({ code: 'ENOTFOUND' }).message).toContain('database host');
  });
  it('returns a correlation reference and logs stack locations instead of raw error messages', async () => {
    const log = vi.spyOn(console, 'error').mockImplementation(() => {});
    const error = new Error('postgresql://user:PRIVATE_PASSWORD@host/db Bearer PRIVATE_TOKEN');
    const response = errorResponse(error, {
      requestId: 'safe-reference',
      stage: 'repository-analysis',
    });
    expect(response.status).toBe(500);
    expect(response.headers.get('x-request-id')).toBe('safe-reference');
    const body = await response.json();
    expect(body.requestId).toBe('safe-reference');
    expect(body.code).toBe('INTERNAL_ERROR');
    const logged = JSON.stringify(log.mock.calls);
    expect(logged).not.toContain('PRIVATE_PASSWORD');
    expect(logged).not.toContain('PRIVATE_TOKEN');
    expect(logged).toContain('repository-analysis');
  });
  it('handles non-JSON platform timeouts and retains server diagnostic references', async () => {
    await expect(
      readApiResponse(
        new Response('<html>timeout</html>', {
          status: 504,
          headers: { 'x-vercel-id': 'edge-reference' },
        }),
      ),
    ).rejects.toMatchObject({ status: 504, requestId: 'edge-reference' });
    await expect(
      readApiResponse(
        Response.json(
          {
            error: 'Missing database tables',
            code: 'DATABASE_SCHEMA_MISSING',
            requestId: 'db-reference',
          },
          { status: 503 },
        ),
      ),
    ).rejects.toMatchObject({ code: 'DATABASE_SCHEMA_MISSING', requestId: 'db-reference' });
    await expect(
      readApiResponse(new Response('limited', { status: 429, headers: { 'retry-after': '120' } })),
    ).rejects.toThrow('2 minute');
    expect(requestFailureMessage(new DOMException('Expired', 'TimeoutError'))).toContain(
      'timed out',
    );
  });
  it('preserves intentional error messages and retry headers', async () => {
    const response = errorResponse(
      new AppError('Wait for the next hour', 429, 120, { code: 'RATE_LIMIT' }),
    );
    expect(response.status).toBe(429);
    expect(response.headers.get('retry-after')).toBe('120');
    expect((await response.json()).code).toBe('RATE_LIMIT');
  });
});
