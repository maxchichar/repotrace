import { createHash } from 'node:crypto';
import type {
  Actor,
  Analysis,
  Contributor,
  Evidence,
  FileEvidence,
  Person,
  RawCommit,
  RawPR,
  Repo,
  Scope,
} from './types';
import { ALGORITHM } from './types';

const emailKey = (email: string) => email.trim().toLowerCase();
const digest = (value: string) => createHash('sha256').update(value).digest('hex').slice(0, 24);
function account(actor: Actor): Person {
  return {
    id: `gh:${actor.id}`,
    name: actor.login,
    login: actor.login,
    url: `https://github.com/${encodeURIComponent(actor.login)}`,
    bot: actor.type === 'Bot' || actor.login.toLowerCase().endsWith('[bot]'),
    identity: 'github-account',
  };
}
export function generatedReason(path: string): string | undefined {
  if (
    /(^|\/)(node_modules|vendor|dist|build|coverage|\.next|__generated__|generated)(\/|$)/i.test(
      path,
    )
  )
    return 'Generated, vendor, or build directory (path heuristic)';
  if (
    /(^|\/)(package-lock\.json|yarn\.lock|pnpm-lock\.yaml|bun\.lockb?|Cargo\.lock|poetry\.lock|composer\.lock|Gemfile\.lock)$/.test(
      path,
    )
  )
    return 'Dependency lockfile';
  if (/\.(min\.(js|css)|map|generated\.[^/]+|g\.cs)$/i.test(path))
    return 'Generated artifact (filename heuristic)';
}
export function buildAnalysis(input: {
  id: string;
  repo: Repo;
  scope: Scope;
  commits: RawCommit[];
  prs: RawPR[];
  warnings: string[];
  complete: boolean;
  requests: number;
  now?: Date;
}): Analysis {
  const now = input.now ?? new Date();
  const warnings = new Set(input.warnings);
  const commits = [...new Map(input.commits.map((c) => [c.sha, c])).values()].filter((c) => {
    const date = Date.parse(c.commit.committer?.date ?? c.commit.author?.date ?? '');
    return (
      Number.isFinite(date) &&
      date >= Date.parse(input.scope.since) &&
      date <= Date.parse(input.scope.until)
    );
  });
  const emailAccounts = new Map<string, Set<string>>();
  const people = new Map<string, Person>();
  for (const c of commits)
    if (c.author) {
      const p = account(c.author);
      people.set(p.id, p);
      const email = c.commit.author?.email;
      if (email) {
        const key = emailKey(email);
        const ids = emailAccounts.get(key) ?? new Set<string>();
        ids.add(p.id);
        emailAccounts.set(key, ids);
      }
    }
  const resolve = (actor: Actor | null, name: string, email: string, fallback: string): Person => {
    if (actor) {
      const p = account(actor);
      people.set(p.id, p);
      return p;
    }
    const key = emailKey(email);
    const matches = emailAccounts.get(key);
    if (key && matches?.size === 1) return people.get([...matches][0])!;
    const noreply = /^(\d+)\+[^@]+@users\.noreply\.github\.com$/i.exec(key);
    if (noreply && people.has(`gh:${noreply[1]}`)) return people.get(`gh:${noreply[1]}`)!;
    const id = `unresolved:${digest(key || fallback)}`;
    // Do not expose raw commit emails, including emails embedded in display names.
    const safeName =
      name
        .replace(/[\w.+-]+@[\w.-]+\.[a-z]{2,}/gi, '[email redacted]')
        .slice(0, 100)
        .trim() || 'Unresolved author';
    const p: Person = { id, name: safeName, bot: false, identity: 'unresolved' };
    if (!people.has(id)) people.set(id, p);
    warnings.add(
      'Some authors could not be linked to a verified GitHub account. Equal coauthor credit is a policy, not verified effort.',
    );
    if (matches && matches.size > 1)
      warnings.add(
        'An email was observed with multiple accounts; ambiguous coauthor identities were kept separate.',
      );
    return people.get(id)!;
  };
  const evidence: Evidence[] = [];
  const exclusions = { mergeCommits: 0, generatedFiles: 0, excludedChurn: 0, missingPatches: 0 };
  for (const c of commits) {
    if (c.parents.length > 1) {
      exclusions.mergeCommits++;
      continue;
    }
    if (!c.commit.committer?.date)
      warnings.add(
        'A commit lacked a committer timestamp; its author timestamp was used as a fallback.',
      );
    const author = resolve(
      c.author,
      c.commit.author?.name ?? '',
      c.commit.author?.email ?? '',
      c.sha,
    );
    const ids = new Set([author.id]);
    const paragraphs = c.commit.message.trimEnd().split(/\r?\n\s*\r?\n/);
    const trailerBlock = paragraphs.length > 1 ? paragraphs.at(-1)! : '';
    const validTrailerBlock = trailerBlock
      .split(/\r?\n/)
      .every((line) => /^[A-Za-z][A-Za-z-]*:\s*.+$/.test(line));
    for (const match of (validTrailerBlock ? trailerBlock : '').matchAll(
      /^Co-authored-by:[ \t]*(.*?)[ \t]*<([^<>\s]+@[^<>\s]+)>[ \t]*$/gim,
    ))
      ids.add(resolve(null, match[1], match[2], c.sha).id);
    const files: FileEvidence[] = (c.files ?? []).map((f) => {
      const reason = generatedReason(f.filename);
      if (reason) {
        exclusions.generatedFiles++;
        exclusions.excludedChurn += f.additions + f.deletions;
      }
      if (!f.patch) {
        exclusions.missingPatches++;
      }
      return {
        path: f.filename,
        previousPath: f.previous_filename,
        additions: f.additions,
        deletions: f.deletions,
        excluded: !!reason,
        reason,
        patchAvailable: !!f.patch,
      };
    });
    evidence.push({
      id: `commit:${c.sha}`,
      kind: 'commit',
      url: `${input.repo.url}/commit/${c.sha}`,
      title: c.commit.message.split('\n')[0].slice(0, 300),
      date: c.commit.committer?.date ?? c.commit.author?.date ?? input.scope.since,
      actorIds: [...ids],
      files,
    });
  }
  for (const pr of new Map(input.prs.map((p) => [p.number, p])).values()) {
    if (
      !pr.merged_at ||
      Date.parse(pr.merged_at) < Date.parse(input.scope.since) ||
      Date.parse(pr.merged_at) > Date.parse(input.scope.until)
    )
      continue;
    if (pr.base && pr.base.ref !== input.repo.branch) continue;
    const p = resolve(pr.user, 'Unresolved PR author', '', `pr:${pr.number}`);
    evidence.push({
      id: `pr:${pr.number}`,
      kind: 'pr',
      url: `${input.repo.url}/pull/${pr.number}`,
      title: pr.title.slice(0, 300),
      date: pr.merged_at,
      actorIds: [p.id],
      files: [],
    });
  }
  if (exclusions.missingPatches)
    warnings.add(
      'Some changed files have no patch (for example binary or large files). Line statistics may not describe their content.',
    );
  if (commits.length !== input.commits.length)
    warnings.add('Duplicate or out-of-window commits were removed from analysis.');
  const contributors: Contributor[] = [];
  for (const p of people.values()) {
    const own = evidence.filter((e) => e.actorIds.includes(p.id));
    if (!own.length) continue;
    const timeline = new Map<
      string,
      { date: string; commits: number; churn: number; prs: number }
    >();
    const files = new Map<string, { path: string; changes: number; commits: number }>();
    let commitUnits = 0,
      churn = 0,
      prs = 0;
    for (const e of own) {
      const day = e.date.slice(0, 10);
      const d = timeline.get(day) ?? { date: day, commits: 0, churn: 0, prs: 0 };
      timeline.set(day, d);
      if (e.kind === 'pr') {
        prs++;
        d.prs++;
        continue;
      }
      const unit = 1 / e.actorIds.length;
      commitUnits += unit;
      d.commits += unit;
      for (const f of e.files) {
        if (f.excluded) continue;
        const amount = (f.additions + f.deletions) * unit;
        churn += amount;
        d.churn += amount;
        const row = files.get(f.path) ?? { path: f.path, changes: 0, commits: 0 };
        row.changes += amount;
        row.commits += unit;
        files.set(f.path, row);
      }
    }
    contributors.push({
      ...p,
      commits: commitUnits,
      churn,
      prs,
      evidenceIds: own.map((e) => e.id),
      files: [...files.values()].sort((a, b) => b.changes - a.changes),
      timeline: [...timeline.values()].sort((a, b) => a.date.localeCompare(b.date)),
    });
  }
  return {
    id: input.id,
    algorithm: ALGORITHM,
    createdAt: now.toISOString(),
    expiresAt: new Date(now.getTime() + 7 * 86400000).toISOString(),
    repo: input.repo,
    scope: input.scope,
    warnings: [...warnings],
    traversalComplete: input.complete,
    requests: input.requests,
    contributors: contributors.sort((a, b) => b.commits - a.commits || a.id.localeCompare(b.id)),
    evidence,
    exclusions,
  };
}
