import { describe, it, expect, vi } from 'vitest';
import { Octokit } from '@octokit/rest';
import { analyzeRepository } from '../src/lib/github';
import { alice, commit, pr, repo, scope } from './fixtures';
function api(handler: (url: URL) => Response) {
  const fetcher = vi.fn(async (input: RequestInfo | URL) =>
    handler(new URL(input instanceof Request ? input.url : input)),
  );
  return {
    client: new Octokit({
      request: { fetch: fetcher },
      retry: { enabled: false },
      throttle: { enabled: false },
    }),
    fetcher,
  };
}
const json = (data: unknown, headers: Record<string, string> = {}, status = 200) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { 'content-type': 'application/json', ...headers },
  });
const meta = {
  id: 1,
  private: false,
  full_name: repo.fullName,
  description: null,
  stargazers_count: 1,
  forks_count: 0,
  default_branch: 'main',
};
function standard(u: URL): Response | undefined {
  if (u.pathname === '/repos/owner/project') return json(meta);
  if (u.pathname.endsWith('/branches/main')) return json({ commit: { sha: 'snapshot' } });
}
describe('GitHub ingestion integration over HTTP boundary', () => {
  it('paginates commits/files and scans PR pages beyond old merged timestamps', async () => {
    const { client, fetcher } = api((u) => {
      const initial = standard(u);
      if (initial) return initial;
      const page = u.searchParams.get('page');
      if (u.pathname.endsWith('/commits')) {
        expect(u.searchParams.get('sha')).toBe('snapshot');
        return page === '1'
          ? json([commit('a')], {
              link: '<https://api.github.com/repos/owner/project/commits?page=2>; rel="next"',
            })
          : json([commit('b', alice)]);
      }
      if (u.pathname.includes('/commits/'))
        return page === '1'
          ? json(commit(u.pathname.split('/').at(-1)!), {
              link: '<https://api.github.com/x?page=2>; rel="next"',
            })
          : json(
              commit('x', alice, {
                files: [{ filename: 'docs/guide.md', additions: 3, deletions: 0, patch: 'patch' }],
              }),
            );
      if (u.pathname.endsWith('/pulls'))
        return page === '1'
          ? json([{ ...pr(1), merged_at: '2025-01-01T00:00:00Z' }], {
              link: '<https://api.github.com/x?page=2>; rel="next"',
            })
          : json([pr(2)]);
      throw new Error('Unexpected URL ' + u);
    });
    const report = await analyzeRepository({ url: repo.url, ...scope }, client);
    expect(report.traversalComplete).toBe(true);
    expect(report.evidence.filter((e) => e.kind === 'commit')).toHaveLength(2);
    expect(report.contributors[0].churn).toBe(26);
    expect(report.contributors[0].prs).toBe(1);
    expect(report.requests).toBe(fetcher.mock.calls.length);
  });
  it('includes merged PRs in the final second of the UTC window', async () => {
    const { client } = api(
      (u) =>
        standard(u) ??
        (u.pathname.endsWith('/commits')
          ? json([])
          : json([{ ...pr(9), merged_at: '2026-01-31T23:59:59Z' }])),
    );
    const result = await analyzeRepository({ url: repo.url, ...scope }, client);
    expect(result.contributors[0].prs).toBe(1);
  });
  it('rejects private repositories before history requests', async () => {
    const { client, fetcher } = api(() => json({ ...meta, private: true }));
    await expect(analyzeRepository({ url: repo.url, ...scope }, client)).rejects.toMatchObject({
      status: 403,
    });
    expect(fetcher).toHaveBeenCalledTimes(1);
  });
  it('translates primary rate limits into actionable 429 with retry information', async () => {
    const { client } = api(() =>
      json(
        { message: 'API rate limit exceeded' },
        { 'x-ratelimit-remaining': '0', 'retry-after': '60' },
        403,
      ),
    );
    await expect(analyzeRepository({ url: repo.url, ...scope }, client)).rejects.toMatchObject({
      status: 429,
      retryAfter: 60,
    });
  });
  it('reports cap as partial and keeps observed evidence', async () => {
    const { client } = api(
      (u) =>
        standard(u) ??
        (u.pathname.endsWith('/commits')
          ? json([commit('a'), commit('b')])
          : u.pathname.includes('/commits/')
            ? json(commit('a'))
            : json([])),
    );
    const result = await analyzeRepository({ url: repo.url, ...scope }, client, { maxCommits: 1 });
    expect(result.traversalComplete).toBe(false);
    expect(result.warnings.join()).toContain('cap');
    expect(result.contributors[0].commits).toBe(1);
  });
  it('marks commit details and PR failures incomplete instead of presenting zero as complete', async () => {
    const { client } = api(
      (u) =>
        standard(u) ??
        (u.pathname.endsWith('/commits')
          ? json([commit('a')])
          : json({ message: 'unavailable' }, {}, 503)),
    );
    const result = await analyzeRepository({ url: repo.url, ...scope }, client);
    expect(result.traversalComplete).toBe(false);
    expect(result.evidence).toEqual([]);
    expect(result.warnings.join()).toContain('unavailable');
  });
  it('caps endless file pagination and marks incomplete', async () => {
    const { client } = api(
      (u) =>
        standard(u) ??
        (u.pathname.endsWith('/commits')
          ? json([commit('a')])
          : u.pathname.includes('/commits/')
            ? json(commit('a'), { link: '<https://api.github.com/x?page=2>; rel="next"' })
            : json([])),
    );
    const result = await analyzeRepository({ url: repo.url, ...scope }, client, {
      maxFilePages: 1,
    });
    expect(result.traversalComplete).toBe(false);
    expect(result.warnings.join()).toContain('file pagination');
  });
});
