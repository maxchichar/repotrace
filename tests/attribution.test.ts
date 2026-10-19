import { describe, it, expect } from 'vitest';
import { buildAnalysis, generatedReason } from '../src/lib/attribution';
import { activitySeries, measuredRows } from '../src/lib/measurements';
import { parseRepository, inputSchema } from '../src/lib/validation';
import { alice, bob, bot, commit, pr, repo, scope } from './fixtures';
const build = (commits = [commit('a')], prs = [pr(1)]) =>
  buildAnalysis({
    id: 'test',
    repo,
    scope,
    commits,
    prs,
    warnings: [],
    complete: true,
    requests: 1,
  });
describe('repository validation', () => {
  it('normalizes a repository URL', () =>
    expect(parseRepository('https://github.com/Owner/repo.git/')).toEqual({
      owner: 'Owner',
      name: 'repo',
    }));
  it.each([
    'http://github.com/a/b',
    'https://github.com.evil.test/a/b',
    'https://user:pass@github.com/a/b',
    'https://github.com/a/b/tree/main',
    'https://github.com/a/b?x=1',
    'https://127.0.0.1/a/b',
    'https://github.com/a/..',
    'https://github.com/a/b#secret',
    'https://github.com:444/a/b',
  ])('rejects %s', (url) => expect(() => parseRepository(url)).toThrow());
  it('rejects reversed, unknown and malformed scope fields', () => {
    expect(
      inputSchema.safeParse({ url: repo.url, since: scope.until, until: scope.since }).success,
    ).toBe(false);
    expect(
      inputSchema.safeParse({ url: repo.url, since: '2020-01-01T00:00:00Z', until: scope.until })
        .success,
    ).toBe(true);
    expect(inputSchema.safeParse({ url: repo.url, ...scope, token: 'secret' }).success).toBe(false);
    expect(inputSchema.safeParse({ url: repo.url, ...scope, branch: 'bad..branch' }).success).toBe(
      false,
    );
  });
});
describe('fractional evidence attribution', () => {
  it('splits coauthor units once, links observed account emails, and conserves churn', () => {
    const a = commit('a', alice, {
      commit: {
        message:
          'Work\n\nCo-authored-by: Bob <bob@example.test>\nCo-authored-by: Bob <BOB@example.test>',
        author: { name: 'Alice', email: 'alice@example.test', date: '2026-01-10T00:00:00Z' },
      },
    });
    const report = build([a, commit('b', bob)]);
    expect(report.contributors.find((p) => p.id === 'gh:1')?.commits).toBe(0.5);
    expect(report.contributors.find((p) => p.id === 'gh:2')?.commits).toBe(1.5);
    expect(report.contributors.reduce((s, p) => s + p.churn, 0)).toBe(20);
    expect(measuredRows(report, 'commits').map((p) => p.percentage)).toEqual([75, 25]);
    expect(JSON.stringify(report)).not.toContain('@example.test');
  });
  it('deduplicates commits and PRs, excludes merge commits, and never adds PRs to commit totals', () => {
    const report = build(
      [commit('a'), commit('a'), commit('merge', bob, { parents: [{ sha: 'x' }, { sha: 'y' }] })],
      [pr(1), pr(1), pr(2, bob)],
    );
    expect(report.exclusions.mergeCommits).toBe(1);
    expect(report.contributors.reduce((s, p) => s + p.commits, 0)).toBe(1);
    expect(measuredRows(report, 'prs').map((p) => p.percentage)).toEqual([50, 50]);
  });
  it('keeps same display names with different emails separate and ambiguous emails unresolved', () => {
    const one = commit('a', alice, {
      commit: {
        message: 'A',
        author: { name: 'Same', email: 'shared@example.test', date: '2026-01-10T00:00:00Z' },
      },
    });
    const two = commit('b', bob, {
      commit: {
        message: 'B\n\nCo-authored-by: Same <shared@example.test>',
        author: { name: 'Same', email: 'shared@example.test', date: '2026-01-11T00:00:00Z' },
      },
    });
    const report = build([one, two, commit('c', null)]);
    expect(report.contributors.filter((p) => p.identity === 'unresolved')).toHaveLength(2);
    expect(report.warnings.join()).toContain('ambiguous');
  });
  it('filters bots with new denominators and handles no data without NaN', () => {
    const report = build([commit('a'), commit('b', bot)]);
    expect(measuredRows(report, 'commits', false)[0].percentage).toBe(100);
    expect(measuredRows(build([], []), 'churn')).toEqual([]);
    expect(
      measuredRows(build([commit('zero', alice, { files: [] })], []), 'churn')[0].percentage,
    ).toBe(0);
  });
  it('excludes generated paths but retains evidence, handles rename and missing patches', () => {
    const report = build([
      commit('a', alice, {
        files: [
          { filename: 'package-lock.json', additions: 100, deletions: 20 },
          {
            filename: 'src/new.ts',
            previous_filename: 'src/old.ts',
            additions: 2,
            deletions: 1,
            patch: 'patch',
          },
        ],
      }),
    ]);
    expect(report.contributors[0].churn).toBe(3);
    expect(report.evidence[0].files[1].previousPath).toBe('src/old.ts');
    expect(report.exclusions.excludedChurn).toBe(120);
    expect(report.exclusions.missingPatches).toBe(1);
    expect(generatedReason('src/generated/foo.ts')).toBeTruthy();
    expect(generatedReason('src/generator.ts')).toBeUndefined();
  });
  it('filters by timestamp and PR base without fabricating contributors', () => {
    const report = build(
      [
        commit('old', alice, {
          commit: { message: 'Old', author: { date: '2025-01-01T00:00:00Z' } },
        }),
      ],
      [
        { ...pr(1), base: { ref: 'other' } },
        { ...pr(2), merged_at: null },
      ],
    );
    expect(report.evidence).toEqual([]);
  });
});

it('fills inactive UTC days with zero rather than interpolating work', () => {
  const report = build([commit('a')], []);
  const series = activitySeries(report.contributors, 'commits', scope);
  expect(series).toHaveLength(31);
  expect(series.find((d) => d.date === '2026-01-09')?.value).toBe(0);
  expect(series.find((d) => d.date === '2026-01-10')?.value).toBe(1);
  expect(series.reduce((s, d) => s + d.value, 0)).toBe(1);
});

it('does not assign coauthor credit from narrative text outside the final trailer block', () => {
  const report = build(
    [
      commit('body', alice, {
        commit: {
          message:
            'Document a format\n\nCo-authored-by: Claimed <claimed@example.test>\n\nThis is narrative documentation, not a trailer.',
          author: { name: 'Alice', email: 'alice@example.test', date: '2026-01-10T00:00:00Z' },
        },
      }),
    ],
    [],
  );
  expect(report.contributors).toHaveLength(1);
  expect(report.contributors[0].commits).toBe(1);
});

it('uses committer time for the window and author identity for credit', () => {
  const report = build(
    [
      commit('rebased', alice, {
        commit: {
          message: 'Rebased work',
          author: { name: 'Alice', email: 'alice@example.test', date: '2025-01-01T00:00:00Z' },
          committer: { date: '2026-01-10T00:00:00Z' },
        },
      }),
    ],
    [],
  );
  expect(report.contributors[0].id).toBe('gh:1');
  expect(report.evidence[0].date).toBe('2026-01-10T00:00:00Z');
});
