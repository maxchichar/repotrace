import 'server-only';
import { Octokit } from '@octokit/rest';
import { randomUUID } from 'node:crypto';
import { buildAnalysis } from './attribution';
import { AppError, parseRepository } from './validation';
import type { RawCommit, RawPR, Repo, Scope } from './types';

export function githubClient(fetcher?: typeof fetch) {
  return new Octokit({
    auth: process.env.GITHUB_TOKEN || process.env.GH_TOKEN || undefined,
    userAgent: 'RepoTrace/0.1',
    request: { timeout: 15000, ...(fetcher ? { fetch: fetcher } : {}) },
  });
}
interface Limits {
  maxCommits: number;
  maxPages: number;
  maxRequests: number;
  maxFilePages: number;
  deadlineMs: number;
}
const defaultLimits: Limits = {
  maxCommits: 120,
  maxPages: 10,
  maxRequests: 180,
  maxFilePages: 30,
  deadlineMs: 90000,
};
export async function analyzeRepository(
  input: { url: string } & Scope,
  client = githubClient(),
  overrides: Partial<Limits> = {},
) {
  const limits = { ...defaultLimits, ...overrides };
  const { owner, name: repo } = parseRepository(input.url);
  const start = Date.now();
  let requests = 0;
  let complete = true;
  const warnings = new Set<string>();
  const call = async <T>(
    route: string,
    params: Record<string, unknown>,
  ): Promise<{ data: T; headers: Record<string, string | number | undefined> }> => {
    if (requests >= limits.maxRequests || Date.now() - start >= limits.deadlineMs)
      throw new AppError('Analysis request or time budget reached.', 429);
    requests++;
    try {
      const response = await client.request(route, {
        ...params,
        headers: { 'X-GitHub-Api-Version': '2022-11-28' },
        request: {
          signal: AbortSignal.timeout(
            Math.max(1, Math.min(15000, limits.deadlineMs - (Date.now() - start))),
          ),
        },
      });
      return { data: response.data as T, headers: response.headers };
    } catch (error) {
      const e = error as { status?: number; response?: { headers?: Record<string, string> } };
      const h = e.response?.headers ?? {};
      if (
        e.status === 429 ||
        (e.status === 403 && (h['x-ratelimit-remaining'] === '0' || h['retry-after']))
      )
        throw new AppError(
          'GitHub rate limit reached. Wait before trying again or configure a server-side GitHub token.',
          429,
          Math.max(
            1,
            Number(h['retry-after']) ||
              Math.ceil(Number(h['x-ratelimit-reset']) - Date.now() / 1000) ||
              60,
          ),
        );
      if (e.status === 404) throw new AppError('Public repository or branch not found.', 404);
      if (e.status === 409)
        throw new AppError('This repository has no commit history to analyze.', 422);
      if (e.status === 403)
        throw new AppError(
          'GitHub access was denied. Check network access and token permissions.',
          403,
        );
      throw new AppError('GitHub could not complete the request. Try again later.', 502);
    }
  };
  const base = { owner, repo };
  const metadata = (
    await call<{
      id: number;
      private: boolean;
      full_name: string;
      html_url: string;
      description: string | null;
      stargazers_count: number;
      forks_count: number;
      default_branch: string;
    }>('GET /repos/{owner}/{repo}', base)
  ).data;
  if (metadata.private) throw new AppError('RepoTrace analyzes public repositories only.', 403);
  const branch = input.branch || metadata.default_branch;
  const head = (
    await call<{ commit: { sha: string } }>('GET /repos/{owner}/{repo}/branches/{branch}', {
      ...base,
      branch,
    })
  ).data.commit.sha;
  const repository: Repo = {
    id: metadata.id,
    fullName: metadata.full_name,
    owner,
    name: repo,
    url: `https://github.com/${owner}/${repo}`,
    description: metadata.description,
    stars: metadata.stargazers_count,
    forks: metadata.forks_count,
    defaultBranch: metadata.default_branch,
    branch,
    head,
  };
  const commits: RawCommit[] = [];
  const prs: RawPR[] = [];
  const seen = new Set<string>();
  try {
    for (let page = 1; page <= limits.maxPages; page++) {
      const response = await call<RawCommit[]>('GET /repos/{owner}/{repo}/commits', {
        ...base,
        sha: head,
        since: input.since,
        until: input.until,
        per_page: 100,
        page,
      });
      for (const summary of response.data) {
        if (seen.has(summary.sha)) continue;
        seen.add(summary.sha);
        if (commits.length >= limits.maxCommits) {
          complete = false;
          warnings.add(
            `Commit cap (${limits.maxCommits}) reached; percentages cover only observed commits.`,
          );
          break;
        }
        if (summary.parents.length > 1) {
          commits.push({ ...summary, files: [] });
          continue;
        }
        try {
          let detail: RawCommit | undefined;
          const files = new Map<string, NonNullable<RawCommit['files']>[number]>();
          for (let fp = 1; fp <= limits.maxFilePages; fp++) {
            const r = await call<RawCommit>('GET /repos/{owner}/{repo}/commits/{ref}', {
              ...base,
              ref: summary.sha,
              per_page: 100,
              page: fp,
            });
            detail ??= r.data;
            for (const f of r.data.files ?? []) files.set(f.filename, f);
            const hasNext = String(r.headers.link ?? '').includes('rel="next"');
            if (!hasNext) {
              if (files.size >= 3000) {
                complete = false;
                warnings.add(
                  'A commit reached GitHub’s 3,000-file ceiling; some file changes may be absent.',
                );
              }
              break;
            }
            if (fp === limits.maxFilePages) {
              complete = false;
              warnings.add(
                'Commit file pagination was capped; code-change percentages are partial.',
              );
            }
          }
          if (detail) commits.push({ ...detail, files: [...files.values()] });
        } catch (e) {
          complete = false;
          warnings.add(
            `Commit detail unavailable for ${summary.sha.slice(0, 12)}: ${e instanceof Error ? e.message : 'request failed'}`,
          );
          if (e instanceof AppError && e.status === 429) throw e;
        }
      }
      if (commits.length >= limits.maxCommits) {
        if (
          String(response.headers.link ?? '').includes('rel="next"') ||
          response.data.length === 100
        ) {
          complete = false;
          warnings.add(
            `Commit cap (${limits.maxCommits}) reached; history traversal may be incomplete.`,
          );
        }
        break;
      }
      if (!String(response.headers.link ?? '').includes('rel="next"')) break;
      if (page === limits.maxPages) {
        complete = false;
        warnings.add('Commit page cap reached; history traversal is incomplete.');
      }
    }
  } catch (e) {
    complete = false;
    warnings.add(
      `Commit traversal incomplete: ${e instanceof Error ? e.message : 'request failed'}`,
    );
  }
  try {
    for (let page = 1; page <= limits.maxPages; page++) {
      const r = await call<RawPR[]>('GET /repos/{owner}/{repo}/pulls', {
        ...base,
        state: 'closed',
        base: branch,
        sort: 'updated',
        direction: 'desc',
        per_page: 100,
        page,
      });
      prs.push(
        ...r.data.filter(
          (p) =>
            p.merged_at &&
            Date.parse(p.merged_at) >= Date.parse(input.since) &&
            Date.parse(p.merged_at) <= Date.parse(input.until),
        ),
      );
      if (!String(r.headers.link ?? '').includes('rel="next"')) break;
      if (page === limits.maxPages) {
        complete = false;
        warnings.add(
          'Closed-PR pagination cap reached. PR merge share covers only observed merged PRs.',
        );
      }
    }
  } catch (e) {
    complete = false;
    warnings.add(`PR traversal incomplete: ${e instanceof Error ? e.message : 'request failed'}`);
  }
  warnings.add(
    'History reflects GitHub’s reachable branch snapshot, not deleted history, all original squash/rebase authors, or actual ownership.',
  );
  warnings.add(
    'Generated-file exclusions use path heuristics; custom generated files may remain. Merged PRs describe the selected base branch and can change during traversal.',
  );
  return buildAnalysis({
    id: randomUUID(),
    repo: repository,
    scope: { since: input.since, until: input.until, branch },
    commits,
    prs,
    warnings: [...warnings],
    complete,
    requests,
  });
}
