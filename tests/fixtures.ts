// Isolated synthetic API fixtures for tests only; never imported by runtime components.
import type { Actor, RawCommit, RawPR, Repo } from '../src/lib/types';
export const alice: Actor = { id: 1, login: 'alice', type: 'User' };
export const bob: Actor = { id: 2, login: 'bob', type: 'User' };
export const bot: Actor = { id: 3, login: 'dependency[bot]', type: 'Bot' };
export const repo: Repo = {
  id: 1,
  fullName: 'owner/project',
  owner: 'owner',
  name: 'project',
  url: 'https://github.com/owner/project',
  description: null,
  stars: 1,
  forks: 0,
  defaultBranch: 'main',
  branch: 'main',
  head: 'abc',
};
export const scope = {
  since: '2026-01-01T00:00:00.000Z',
  until: '2026-01-31T23:59:59.999Z',
  branch: 'main',
};
export function commit(
  sha: string,
  actor: Actor | null = alice,
  extra: Partial<RawCommit> = {},
): RawCommit {
  return {
    sha,
    html_url: `${repo.url}/commit/${sha}`,
    author: actor,
    commit: {
      message: 'Change parser',
      author: {
        name: actor?.login || 'Anonymous',
        email: `${actor?.login || 'unknown'}@example.test`,
        date: '2026-01-10T12:00:00.000Z',
      },
    },
    parents: [{ sha: 'parent' }],
    files: [{ filename: 'src/parser.ts', additions: 8, deletions: 2, patch: '@@ patch' }],
    ...extra,
  };
}
export function pr(number: number, actor: Actor | null = alice): RawPR {
  return {
    number,
    title: 'Improve parser',
    html_url: `${repo.url}/pull/${number}`,
    user: actor,
    merged_at: '2026-01-12T12:00:00.000Z',
    base: { ref: 'main' },
  };
}
