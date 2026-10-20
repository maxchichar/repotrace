'use client';
import { useState, type FormEvent } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  Activity,
  ArrowDownToLine,
  ArrowRight,
  ArrowUpRight,
  BookOpen,
  ChartNoAxesCombined,
  Check,
  ChevronRight,
  CircleDot,
  Clock3,
  Code2,
  FileCode2,
  Fingerprint,
  GitBranch,
  GitCommitHorizontal,
  GitFork as Github,
  GitPullRequest,
  Layers3,
  Link2,
  LoaderCircle,
  Plus,
  Search,
  ShieldCheck,
  Sparkles,
  Users,
  X,
  TriangleAlert,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { TimelineChart } from './timeline-chart';
import { ContributorAvatar as PersonMark } from './contributor-avatar';
import { withoutEmDash } from '@/lib/presentation';
import { activitySeries, measuredRows } from '@/lib/measurements';
import type { Analysis, Contributor, Evidence, Metric, Scope } from '@/lib/types';
import { readApiResponse, requestFailureMessage } from '@/lib/api-client';
import { cn, number, percent, shortDate } from '@/lib/utils';
const metrics: Record<
  Metric,
  { label: string; short: string; description: string; icon: typeof Activity }
> = {
  commits: {
    label: 'Commit units',
    short: 'Commits',
    description: 'Fractional author + coauthor credit. Merge commits excluded.',
    icon: GitCommitHorizontal,
  },
  churn: {
    label: 'Changed lines',
    short: 'Code changes',
    description: 'Additions + deletions. Generated/vendor/lockfile paths excluded by heuristic.',
    icon: Code2,
  },
  prs: {
    label: 'Merged pull requests',
    short: 'Merged PRs',
    description: 'Credit to the PR opener, counted separately from commits.',
    icon: GitPullRequest,
  },
};
const tabs = ['Overview', 'Contributors', 'Evidence', 'Methodology'] as const;
type Tab = (typeof tabs)[number];
function Logo() {
  return (
    <Link href="/" className="brand" aria-label="RepoTrace home">
      <span className="brand-symbol">
        <GitBranch size={22} />
      </span>
      <span>
        Repo<span className="brand-secondary">Trace</span>
        <span className="brand-dot">.</span>
      </span>
    </Link>
  );
}
function EvidenceList({ items }: { items: Evidence[] }) {
  const [search, setSearch] = useState('');
  const [limit, setLimit] = useState(25);
  const filtered = items.filter((e) =>
    `${e.title} ${e.id} ${e.files.map((f) => f.path).join(' ')}`
      .toLowerCase()
      .includes(search.toLowerCase()),
  );
  return (
    <div>
      <div className="evidence-tools">
        <label className="search-control">
          <Search size={16} />
          <Input
            aria-label="Search evidence"
            placeholder="Search titles, SHAs, PRs, or files…"
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setLimit(25);
            }}
          />
        </label>
        <span className="small-muted">{number(filtered.length)} evidence records</span>
      </div>
      {!filtered.length && <p className="empty-inline">No matching evidence in this analysis.</p>}
      <div className="evidence-list">
        {filtered.slice(0, limit).map((e) => (
          <article className="evidence-row" key={e.id}>
            <span className={cn('evidence-icon', e.kind === 'pr' && 'pr-icon')}>
              {e.kind === 'pr' ? <GitPullRequest size={17} /> : <GitCommitHorizontal size={17} />}
            </span>
            <div className="min-w-0 flex-1">
              <a href={e.url} target="_blank" rel="noopener noreferrer" className="evidence-title">
                {withoutEmDash(e.title || 'Untitled commit')}
                <ArrowUpRight size={13} />
              </a>
              <div className="evidence-meta">
                <code>{e.kind === 'commit' ? e.id.slice(7, 14) : `#${e.id.slice(3)}`}</code>
                <span>·</span>
                <time>{shortDate(e.date)}</time>
                <span>·</span>
                <span>
                  {e.actorIds.length} credited {e.actorIds.length === 1 ? 'identity' : 'identities'}
                </span>
              </div>
              {e.files.length > 0 && (
                <details className="file-details">
                  <summary>
                    {e.files.length} changed {e.files.length === 1 ? 'file' : 'files'}{' '}
                    <ChevronRight size={12} />
                  </summary>
                  <ul>
                    {e.files.map((f) => (
                      <li key={f.path}>
                        <code>{f.path}</code>
                        <span className="diff-positive">+{number(f.additions)}</span>
                        <span className="diff-negative">−{number(f.deletions)}</span>
                        {f.previousPath && (
                          <span className="small-muted">renamed from {f.previousPath}</span>
                        )}
                        {f.excluded && <Badge>Excluded: {f.reason}</Badge>}
                        {!f.patchAvailable && <Badge>Patch unavailable</Badge>}
                      </li>
                    ))}
                  </ul>
                </details>
              )}
            </div>
          </article>
        ))}
      </div>
      {filtered.length > limit && (
        <Button variant="outline" onClick={() => setLimit(limit + 25)}>
          Show more evidence
        </Button>
      )}
    </div>
  );
}
function ActivityTable({
  people,
  metric,
  scope,
}: {
  people: Contributor[];
  metric: Metric;
  scope: Scope;
}) {
  const data = activitySeries(people, metric, scope);
  return (
    <details className="daily-table">
      <summary>View activity data table</summary>
      <div className="table-scroll">
        <table>
          <caption className="sr-only">
            Measured activity: {metrics[metric].label.toLowerCase()} (UTC)
          </caption>
          <thead>
            <tr>
              <th scope="col">Period (UTC)</th>
              <th scope="col">{metrics[metric].label}</th>
            </tr>
          </thead>
          <tbody>
            {data.map(({ date, label, value }) => (
              <tr key={date}>
                <th scope="row">{label}</th>
                <td>{number(value)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </details>
  );
}
function Profile({
  person,
  report,
  onClose,
}: {
  person: Contributor;
  report: Analysis;
  onClose: () => void;
}) {
  const insight = report.insights?.estimates.find((e) => e.contributorId === person.id);
  const evidence = report.evidence.filter((e) => person.evidenceIds.includes(e.id));
  return (
    <section className="profile-panel" aria-labelledby="profile-title">
      <div className="panel-heading">
        <div className="flex items-center gap-3">
          <PersonMark person={person} />
          <div>
            <h2 id="profile-title">{person.name}</h2>
            <p className="small-muted">
              {person.identity === 'github-account'
                ? 'GitHub-linked account'
                : 'Unresolved identity'}
              {person.bot ? ' · Bot' : ''}
            </p>
          </div>
        </div>
        <Button
          variant="ghost"
          size="icon"
          onClick={onClose}
          aria-label="Close contributor profile"
        >
          <X />
        </Button>
      </div>
      <div className="profile-meta">
        {person.url && (
          <a href={person.url} target="_blank" rel="noopener noreferrer">
            GitHub profile <ArrowUpRight size={13} />
          </a>
        )}
        <Link href={`/reports/${report.id}?contributor=${encodeURIComponent(person.id)}`}>
          Link to this profile <Link2 size={13} />
        </Link>
      </div>
      <div className="profile-stats">
        {(Object.keys(metrics) as Metric[]).map((m) => (
          <div key={m}>
            <strong>{number(person[m])}</strong>
            <span>{metrics[m].label}</span>
          </div>
        ))}
      </div>
      <div className="profile-summary">
        <span className="eyebrow">EVIDENCE SUMMARY · DETERMINISTIC</span>
        <p>
          {person.name} received {number(person.commits)} commit units across {person.files.length}{' '}
          eligible changed paths and opened {person.prs} observed merged PRs.{' '}
          {person.files.length
            ? `The most changed path was ${person.files[0].path}.`
            : 'No eligible changed-file statistics are available.'}{' '}
          This describes observed activity, not ownership or technical value.
        </p>
      </div>
      <h3 className="subheading">
        Contributor activity <span className="small-muted">Commit units · UTC</span>
      </h3>
      <TimelineChart contributors={[person]} metric="commits" scope={report.scope} />
      <ActivityTable people={[person]} metric="commits" scope={report.scope} />
      <div className="file-breakdown">
        <h3 className="subheading">
          Files worked on <span className="small-muted">Eligible churn</span>
        </h3>
        {person.files.length ? (
          <div className="table-scroll">
            <table>
              <thead>
                <tr>
                  <th scope="col">Changed path</th>
                  <th scope="col">Changed lines</th>
                  <th scope="col">Commit units</th>
                </tr>
              </thead>
              <tbody>
                {person.files.slice(0, 50).map((f) => (
                  <tr key={f.path}>
                    <th scope="row">
                      <code>{f.path}</code>
                    </th>
                    <td>{number(f.changes)}</td>
                    <td>{number(f.commits)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {person.files.length > 50 && (
              <p className="small-muted">First 50 paths shown; all paths are in the JSON export.</p>
            )}
          </div>
        ) : (
          <p className="empty-inline">No eligible file changes recorded.</p>
        )}
      </div>
      {insight && (
        <div className="ai-estimate">
          <span className="eyebrow">
            <Sparkles size={13} /> AI ESTIMATE · {insight.confidence.toUpperCase()} CONFIDENCE
          </span>
          <h3>{insight.impact} potential impact</h3>
          <p>{withoutEmDash(insight.summary)}</p>
          <p>{withoutEmDash(insight.rationale)}</p>
          <p className="small-muted">Uncertainty: {withoutEmDash(insight.limitations)}</p>
          <div className="flex flex-wrap gap-2">
            {insight.evidenceIds.map((id) => (
              <a
                key={id}
                href={report.evidence.find((e) => e.id === id)?.url}
                target="_blank"
                rel="noopener noreferrer"
                className="evidence-chip"
              >
                {id.slice(0, 22)} <ArrowUpRight size={11} />
              </a>
            ))}
          </div>
        </div>
      )}
      <h3 className="subheading mt-7">Linked evidence</h3>
      <EvidenceList items={evidence} />
    </section>
  );
}
function Methodology() {
  return (
    <div className="method-grid">
      <article className="panel">
        <span className="eyebrow">01 / MEASURED</span>
        <h2>Three metrics. Three denominators.</h2>
        <p>
          Commit share = contributor’s fractional commit units ÷ all observed commit units. Each
          author and declared coauthor gets an equal fraction; integration merge commits are
          excluded.
        </p>
        <p>
          Code-change share = contributor’s eligible additions + deletions ÷ all eligible changed
          lines. This is churn, not surviving code. Known generated, dependency lockfile, vendor,
          and build paths are excluded by a visible path heuristic.
        </p>
        <p>
          Merged-PR share = PRs opened by the contributor and merged into the selected base branch
          in the window ÷ all observed merged PRs. PR and commit shares are never added together.
        </p>
        <p>
          Bots are included by default. Filtering bots recalculates every denominator. Display
          rounding may keep totals slightly above or below 100%.
        </p>
      </article>
      <article className="panel">
        <span className="eyebrow">02 / IDENTITY & SCOPE</span>
        <h2>Credit follows evidence.</h2>
        <p>
          GitHub numeric account IDs take priority. Coauthor emails link to an account only when
          unambiguously observed, or when a numeric GitHub noreply ID matches an observed account.
          Display names never merge identities.
        </p>
        <p>
          Unknown people remain unresolved; equal coauthor credit is an explicit allocation rule,
          not a verified division of effort. Author emails are not included in reports.
        </p>
        <p>
          Commit scope uses committer timestamps within the UTC window (author date only when
          missing) and reachable history at the resolved branch head. PR scope uses merge timestamps
          and base branch. Missing history, squash/rebase transformations, binary files, and API
          limits affect what can be known.
        </p>
      </article>
      <article className="panel">
        <span className="eyebrow">03 / AI ESTIMATES</span>
        <h2>Interpretation with uncertainty.</h2>
        <p>
          AI is optional. It receives a bounded sample of public commit/PR titles, file paths, and
          change counts. It does not receive source patches, credentials, or author emails.
        </p>
        <p>
          Impact bands are evidence-limited estimates, never measured percentages, quality scores,
          ownership, or employee rankings. References must belong to the contributor. Validation
          checks the response structure and citations; it cannot prove the model’s interpretation is
          correct.
        </p>
        <p>
          At most 20 non-bot contributors and five evidence items per person are sent. The interface
          shows only returned estimates; absent estimates mean no AI assessment.
        </p>
      </article>
      <article className="panel">
        <span className="eyebrow">04 / COMPLETENESS & REPORTS</span>
        <h2>The boundaries stay visible.</h2>
        <p>
          Runs are bounded to 120 observed commits, ten history/PR pages, 3,000 files per commit,
          180 requests, and a 90-second request budget. Reaching a cap or losing a request produces
          a partial report.
        </p>
        <p>
          “Traversal finished” means the selected API walk completed, not that all project work is
          known. CODEOWNERS is a review policy, not evidence of historical ownership. File/module
          labels describe changed paths; titles describe stated intent, not independently verified
          features.
        </p>
        <p>
          Reports contain public activity and can be shared by link. Reports use PostgreSQL when
          configured, otherwise a bounded local fallback, for up to seven days. Ephemeral local
          storage can lose reports on restart. Exports preserve the report independently.
        </p>
      </article>
    </div>
  );
}

export function Workbench({
  initialReport,
  initialContributor,
}: {
  initialReport?: Analysis;
  initialContributor?: string;
}) {
  const router = useRouter();
  const [report, setReport] = useState(initialReport);
  const [tab, setTab] = useState<Tab>('Overview');
  const [metric, setMetric] = useState<Metric>('commits');
  const [includeBots, setIncludeBots] = useState(true);
  const [selected, setSelected] = useState(initialContributor);
  const [url, setUrl] = useState('');
  const [allHistory, setAllHistory] = useState(true);
  const [branch, setBranch] = useState('');
  const [since, setSince] = useState(() =>
    new Date(Date.now() - 90 * 86400000).toISOString().slice(0, 10),
  );
  const [until, setUntil] = useState(() => new Date().toISOString().slice(0, 10));
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [aiLoading, setAiLoading] = useState(false);
  const [aiError, setAiError] = useState('');
  const [copied, setCopied] = useState(false);
  const rows = report ? measuredRows(report, metric, includeBots) : [];
  const people = report?.contributors.filter((p) => includeBots || !p.bot) ?? [];
  const person = report?.contributors.find((p) => p.id === selected);
  const total = (m: Metric) => people.reduce((s, p) => s + p[m], 0);
  async function analyze(event: FormEvent) {
    event.preventDefault();
    setError('');
    setLoading(true);
    try {
      const response = await fetch('/api/analyses', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          url,
          branch: branch || undefined,
          mode: allHistory ? 'all' : 'custom',
          ...(allHistory
            ? {}
            : {
                since: new Date(`${since}T00:00:00.000Z`).toISOString(),
                until: new Date(`${until}T23:59:59.999Z`).toISOString(),
              }),
        }),
        signal: AbortSignal.timeout(120000),
      });
      const data = await readApiResponse<Analysis>(response);
      setReport(data as Analysis);
      setSelected(undefined);
      setTab('Overview');
      router.push(`/reports/${data.id}`);
    } catch (e) {
      setError(requestFailureMessage(e));
    } finally {
      setLoading(false);
    }
  }
  async function estimate() {
    if (!report) return;
    setAiLoading(true);
    setAiError('');
    try {
      const response = await fetch(`/api/reports/${report.id}/insights`, {
        method: 'POST',
        signal: AbortSignal.timeout(60000),
      });
      const data = await readApiResponse<Analysis>(response);
      setReport(data);
    } catch (e) {
      setAiError(requestFailureMessage(e));
    } finally {
      setAiLoading(false);
    }
  }
  async function share() {
    if (!report) return;
    try {
      await navigator.clipboard.writeText(`${window.location.origin}/reports/${report.id}`);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch {
      setError('Clipboard is unavailable. Copy the report URL from the address bar.');
    }
  }
  const modules = new Map<string, number>();
  for (const p of people)
    for (const f of p.files) {
      const path = f.path.includes('/') ? `${f.path.split('/')[0]}/` : 'Root files';
      modules.set(path, (modules.get(path) ?? 0) + f.changes);
    }
  return (
    <div className="app-shell">
      <aside className="sidebar">
        <Logo />
        <div className="sidebar-group-label">WORKSPACE</div>
        <nav aria-label="Main navigation">
          <Link
            className={cn('nav-item', tab !== 'Methodology' && 'active')}
            href="/"
            onClick={(e) => {
              e.preventDefault();
              setTab('Overview');
              setSelected(undefined);
            }}
          >
            <ChartNoAxesCombined size={18} />
            Repository analysis
            <span className="nav-indicator" />
          </Link>
          <button
            className={cn('nav-item', tab === 'Methodology' && 'active')}
            onClick={() => {
              setTab('Methodology');
              setSelected(undefined);
            }}
          >
            <BookOpen size={18} />
            Methodology
          </button>
        </nav>
        <div className="sidebar-new">
          <Button asChild variant="outline" className="w-full">
            <Link href="/">
              <Plus size={16} />
              New analysis
            </Link>
          </Button>
        </div>
        <div className="sidebar-note">
          <span className="note-orbit">
            <Fingerprint size={20} />
          </span>
          <h3>Evidence, before estimates.</h3>
          <p>Every contribution has a source. Every estimate has a boundary.</p>
          <span>
            BUILT FOR TRANSPARENCY <ArrowUpRight size={11} />
          </span>
        </div>
        <div className="sidebar-bottom">
          <span className="status-dot" />
          Public repositories<span className="version">v0.1</span>
        </div>
      </aside>
      <div className="workspace">
        <header className="topbar">
          <div className="breadcrumb">
            <span>Workspace</span>
            <ChevronRight size={13} />
            <strong>{report ? report.repo.fullName : 'Repository analysis'}</strong>
          </div>
          <div className="topbar-right">
            <span className="public-label">
              <Github size={14} /> GitHub intelligence
            </span>
            <span className="workspace-avatar" aria-label="Public workspace">
              RT
            </span>
          </div>
        </header>
        <main id="main" className="main-content">
          {!report && tab === 'Methodology' ? (
            <section>
              <div className="page-kicker">
                <span className="status-dot" /> THE ATTRIBUTION CONTRACT
              </div>
              <h1 className="section-title mt-4">How the analysis works</h1>
              <Methodology />
            </section>
          ) : !report ? (
            <>
              <div className="page-kicker">
                <span className="status-dot" /> REPOSITORY INTELLIGENCE{' '}
                <span className="kicker-line" />
              </div>
              <div className="intro-heading">
                <h1>
                  Understand the work.
                  <br />
                  <span>Give credit with context.</span>
                </h1>
                <p>
                  A clearer picture of who contributed, what changed, and what the evidence actually
                  says.
                </p>
              </div>
              <section className="analyze-panel" aria-labelledby="analyze-heading">
                <div className="panel-heading">
                  <div>
                    <span className="eyebrow">START AN INVESTIGATION</span>
                    <h2 id="analyze-heading">One repository. A traceable story.</h2>
                  </div>
                  <span className="corner-icon">
                    <Github size={23} />
                  </span>
                </div>
                <form onSubmit={analyze} aria-busy={loading}>
                  <label className="field-label" htmlFor="repository-url">
                    Public GitHub repository
                  </label>
                  <div className="repo-input-row">
                    <div className="repo-input">
                      <Github size={19} />
                      <Input
                        id="repository-url"
                        type="url"
                        required
                        placeholder="https://github.com/owner/repository"
                        value={url}
                        onChange={(e) => setUrl(e.target.value)}
                        disabled={loading}
                        autoComplete="url"
                        aria-describedby="url-help"
                      />
                    </div>
                    <Button type="submit" disabled={loading}>
                      {loading ? (
                        <>
                          <LoaderCircle className="spin" />
                          Analyzing…
                        </>
                      ) : (
                        <>
                          Analyze repository <ArrowRight />
                        </>
                      )}
                    </Button>
                  </div>
                  <p id="url-help" className="field-help">
                    <ShieldCheck size={13} />
                    Public repositories only. No GitHub sign-in required.
                  </p>
                  <fieldset className="range-picker" aria-describedby="range-help">
                    <legend className="field-label">Analysis range</legend>
                    <div className="segmented" aria-label="Analysis range">
                      <button
                        type="button"
                        className={allHistory ? 'selected' : ''}
                        aria-pressed={allHistory}
                        disabled={loading}
                        onClick={() => setAllHistory(true)}
                      >
                        All history
                      </button>
                      <button
                        type="button"
                        className={!allHistory ? 'selected' : ''}
                        aria-pressed={!allHistory}
                        disabled={loading}
                        onClick={() => setAllHistory(false)}
                      >
                        Custom dates
                      </button>
                    </div>
                    <p id="range-help" className="field-help">
                      {allHistory
                        ? 'Analyze reachable branch history through today. Large histories may return a partial report.'
                        : 'Choose any date range, including multiple years. Large histories may return a partial report.'}
                    </p>
                  </fieldset>
                  <div className={cn('scope-fields', allHistory && 'all-history')}>
                    <div>
                      <label htmlFor="branch" className="field-label">
                        Branch <span>optional</span>
                      </label>
                      <div className="input-icon">
                        <GitBranch size={15} />
                        <Input
                          id="branch"
                          value={branch}
                          onChange={(e) => setBranch(e.target.value)}
                          maxLength={200}
                          placeholder="Default branch"
                          disabled={loading}
                        />
                      </div>
                    </div>
                    {!allHistory && (
                      <>
                        <div>
                          <label htmlFor="since" className="field-label">
                            From <span>UTC</span>
                          </label>
                          <Input
                            id="since"
                            type="date"
                            required
                            value={since}
                            onChange={(e) => setSince(e.target.value)}
                            max={until}
                            disabled={loading}
                          />
                        </div>
                        <div>
                          <label htmlFor="until" className="field-label">
                            Through <span>UTC, inclusive</span>
                          </label>
                          <Input
                            id="until"
                            type="date"
                            required
                            value={until}
                            onChange={(e) => setUntil(e.target.value)}
                            min={since}
                            max={new Date().toISOString().slice(0, 10)}
                            disabled={loading}
                          />
                        </div>
                      </>
                    )}
                  </div>
                  {loading && (
                    <div className="loading-message" role="status">
                      <span className="loading-pulse" />
                      <div>
                        <strong>Following the evidence</strong>
                        <p>
                          Resolving the branch, collecting commits and merged PRs, then calculating
                          credit. Larger histories may produce a partial report. This can take up to
                          two minutes.
                        </p>
                      </div>
                    </div>
                  )}
                  {error && (
                    <div className="error-message" role="alert">
                      <TriangleAlert size={17} />
                      <p>{error}</p>
                    </div>
                  )}
                </form>
                <div className="analyze-footer">
                  <span>
                    <GitCommitHorizontal size={14} />
                    Commits & coauthors
                  </span>
                  <span>
                    <GitPullRequest size={14} />
                    Merged pull requests
                  </span>
                  <span>
                    <FileCode2 size={14} />
                    File-level evidence
                  </span>
                </div>
              </section>
              <section className="principles" aria-label="How RepoTrace works">
                <div className="section-label">
                  <span>CLARITY AT EVERY LAYER</span>
                  <span>01 to 03</span>
                </div>
                <div className="principle-grid">
                  <article>
                    <span className="principle-number">01</span>
                    <GitBranch size={23} />
                    <h2>Measure the activity.</h2>
                    <p>
                      Separate shares for commits, changed lines, and merged PRs. Explicit windows.
                      Visible denominators.
                    </p>
                    <Badge>
                      <CircleDot size={10} />
                      Deterministic
                    </Badge>
                  </article>
                  <article>
                    <span className="principle-number">02</span>
                    <Layers3 size={23} />
                    <h2>Trace the contribution.</h2>
                    <p>
                      Follow changed files and modules back to the commits and PRs that explain the
                      work.
                    </p>
                    <Badge>
                      <Link2 size={10} />
                      Evidence-linked
                    </Badge>
                  </article>
                  <article>
                    <span className="principle-number">03</span>
                    <Sparkles size={23} />
                    <h2>Interpret with care.</h2>
                    <p>
                      Optional AI summaries add context and potential impact, with citations and
                      explicit uncertainty.
                    </p>
                    <Badge>
                      <Sparkles size={10} />
                      Estimated, never measured
                    </Badge>
                  </article>
                </div>
              </section>
              <div className="bottom-note">
                <ShieldCheck size={17} />
                <p>
                  Contribution is more than a number.
                  <span>
                    {' '}
                    RepoTrace measures observable activity. It does not assign ownership, rank human
                    value, or infer unseen work.
                  </span>
                </p>
              </div>
              {tab === 'Methodology' && (
                <section className="mt-10">
                  <h2 className="section-title">How the analysis works</h2>
                  <Methodology />
                </section>
              )}
            </>
          ) : (
            <>
              <div className="report-heading">
                <div>
                  <div className="page-kicker">
                    <span className="status-dot" /> REPOSITORY REPORT
                  </div>
                  <h1>
                    {report.repo.name}
                    <a
                      href={report.repo.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      aria-label="Open repository on GitHub"
                    >
                      <ArrowUpRight size={23} />
                    </a>
                  </h1>
                  <p>
                    {withoutEmDash(
                      report.repo.description ||
                        `Contribution evidence for ${report.repo.fullName}`,
                    )}
                  </p>
                </div>
                <div className="report-actions">
                  <Button variant="outline" size="sm" onClick={share}>
                    {copied ? <Check /> : <Link2 />}
                    {copied ? 'Link copied' : 'Share report'}
                  </Button>
                  <details className="export-menu">
                    <summary>
                      <ArrowDownToLine size={15} />
                      Export
                    </summary>
                    <div>
                      <a href={`/api/reports/${report.id}/export?format=pdf`}>Report PDF</a>
                      <a href={`/api/reports/${report.id}/export?format=csv`}>Contributor CSV</a>
                      <a href={`/api/reports/${report.id}/export?format=json`}>
                        Full evidence JSON
                      </a>
                    </div>
                  </details>
                </div>
              </div>
              <div className="scope-strip">
                <span>
                  <GitBranch size={14} />
                  <strong>{report.repo.branch}</strong>
                  <code>{report.repo.head.slice(0, 7)}</code>
                </span>
                <span>
                  <Clock3 size={14} />
                  {report.scope.mode === 'all'
                    ? `All reachable history · through ${shortDate(report.scope.until)} UTC`
                    : `${shortDate(report.scope.since)} to ${shortDate(report.scope.until)} UTC`}
                </span>
                <Badge
                  className={
                    report.traversalComplete
                      ? 'border-emerald-200 bg-emerald-50 text-emerald-800'
                      : 'border-amber-200 bg-amber-50 text-amber-900'
                  }
                >
                  {report.traversalComplete ? <Check size={12} /> : <TriangleAlert size={12} />}{' '}
                  {report.traversalComplete ? 'Traversal finished' : 'Partial analysis'}
                </Badge>
                <span className="scope-meta">{report.requests} API requests</span>
              </div>
              <details
                className={cn('scope-warning', !report.traversalComplete && 'partial-warning')}
                open={!report.traversalComplete}
              >
                <summary>
                  <TriangleAlert size={14} />
                  {report.traversalComplete
                    ? 'Scope & attribution caveats'
                    : 'Some data is missing. Shares cover observed evidence'}
                  <span>{report.warnings.length} notes</span>
                </summary>
                <ul>
                  {report.warnings.map((w, i) => (
                    <li key={i}>{withoutEmDash(w)}</li>
                  ))}
                </ul>
              </details>
              {error && (
                <div className="error-message" role="alert">
                  {error}
                </div>
              )}
              <div className="report-tabs">
                <nav aria-label="Report sections">
                  {tabs.map((t) => (
                    <button
                      key={t}
                      onClick={() => {
                        setTab(t);
                        setSelected(undefined);
                      }}
                      aria-pressed={tab === t}
                      className={tab === t ? 'selected' : ''}
                    >
                      {t}
                      {t === 'Contributors' && <span>{report.contributors.length}</span>}
                    </button>
                  ))}
                </nav>
                <label className="bot-toggle">
                  <input
                    type="checkbox"
                    checked={includeBots}
                    onChange={(e) => setIncludeBots(e.target.checked)}
                  />
                  Include bots
                </label>
              </div>
              {person ? (
                <Profile person={person} report={report} onClose={() => setSelected(undefined)} />
              ) : tab === 'Methodology' ? (
                <Methodology />
              ) : tab === 'Evidence' ? (
                <section className="panel">
                  <div className="panel-heading">
                    <div>
                      <span className="eyebrow">SOURCE OF TRUTH</span>
                      <h2>Every claim starts here.</h2>
                    </div>
                    <Badge>{report.evidence.length} records</Badge>
                  </div>
                  <EvidenceList
                    items={report.evidence.filter(
                      (e) =>
                        includeBots || e.actorIds.some((id) => people.some((p) => p.id === id)),
                    )}
                  />
                </section>
              ) : (
                <>
                  <div className="stats-grid">
                    <div className="stat-card">
                      <span className="stat-label">
                        <Users size={15} />
                        Observed contributors
                      </span>
                      <strong>{people.length}</strong>
                      <p>
                        {people.filter((p) => p.identity === 'unresolved').length} unresolved
                        identities
                        {includeBots
                          ? ` · ${people.filter((p) => p.bot).length} bots`
                          : ' · Bots excluded'}
                      </p>
                    </div>
                    {(Object.keys(metrics) as Metric[]).map((m) => {
                      const Icon = metrics[m].icon;
                      return (
                        <button
                          key={m}
                          className={cn('stat-card metric-card', metric === m && 'metric-active')}
                          onClick={() => setMetric(m)}
                          aria-pressed={metric === m}
                        >
                          <span className="stat-label">
                            <Icon size={15} />
                            {metrics[m].label}
                          </span>
                          <strong>{number(total(m))}</strong>
                          <p>
                            {m === 'commits'
                              ? 'Equal fractional coauthor credit'
                              : m === 'churn'
                                ? 'Eligible additions + deletions'
                                : 'Separate PR opener attribution'}
                          </p>
                        </button>
                      );
                    })}
                  </div>
                  <section className="panel comparison-panel">
                    <div className="panel-heading">
                      <div>
                        <span className="eyebrow">MEASURED ACTIVITY</span>
                        <h2>Contribution breakdown</h2>
                        <p className="panel-description">{metrics[metric].description}</p>
                      </div>
                      <div className="segmented" aria-label="Comparison metric">
                        {(Object.keys(metrics) as Metric[]).map((m) => (
                          <button
                            key={m}
                            onClick={() => setMetric(m)}
                            aria-pressed={metric === m}
                            className={metric === m ? 'selected' : ''}
                          >
                            {metrics[m].short}
                          </button>
                        ))}
                      </div>
                    </div>
                    <div className="denominator-note">
                      Share of {number(total(metric))} observed{' '}
                      {metrics[metric].label.toLowerCase()} ·{' '}
                      {includeBots ? 'Bots included' : 'Bots excluded'} · Not project ownership
                    </div>
                    {!rows.length ? (
                      <div className="empty-results">
                        <Users size={28} />
                        <h3>No contributors in this window.</h3>
                        <p>
                          Try a wider time window, another branch, or review the incomplete-data
                          notes.
                        </p>
                        <Button asChild variant="outline">
                          <Link href="/">
                            New analysis <ArrowRight />
                          </Link>
                        </Button>
                      </div>
                    ) : (
                      <div className="table-scroll">
                        <table className="contributor-table">
                          <caption className="sr-only">
                            Contributor {metrics[metric].label} comparison. Shares are measured
                            activity, not ownership.
                          </caption>
                          <thead>
                            <tr>
                              <th scope="col">Contributor</th>
                              <th scope="col">{metrics[metric].label}</th>
                              <th scope="col">Share of observed activity</th>
                              <th scope="col">
                                <span className="sr-only">Profile</span>
                              </th>
                            </tr>
                          </thead>
                          <tbody>
                            {rows.slice(0, tab === 'Overview' ? 10 : undefined).map((p, i) => (
                              <tr key={p.id}>
                                <th scope="row">
                                  <button
                                    onClick={() => setSelected(p.id)}
                                    className="contributor-name"
                                  >
                                    <span className="row-index">
                                      {String(i + 1).padStart(2, '0')}
                                    </span>
                                    <PersonMark person={p} />
                                    <span>
                                      <strong>{p.name}</strong>
                                      <span className="person-subtitle">
                                        {p.bot
                                          ? 'Bot account'
                                          : p.identity === 'unresolved'
                                            ? 'Unresolved identity'
                                            : `@${p.login}`}
                                      </span>
                                    </span>
                                  </button>
                                </th>
                                <td className="numeric">{number(p.value)}</td>
                                <td>
                                  <div className="share-cell">
                                    <span className="share-track" aria-hidden="true">
                                      <span style={{ width: `${p.percentage}%` }} />
                                    </span>
                                    <strong>{percent(p.percentage)}</strong>
                                  </div>
                                </td>
                                <td>
                                  <button
                                    className="profile-arrow"
                                    onClick={() => setSelected(p.id)}
                                    aria-label={`View ${p.name} profile`}
                                  >
                                    <ArrowUpRight size={16} />
                                  </button>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                    {tab === 'Overview' && rows.length > 10 && (
                      <button className="text-action" onClick={() => setTab('Contributors')}>
                        View all {rows.length} contributors <ArrowRight size={14} />
                      </button>
                    )}
                  </section>
                  <div className="insights-grid">
                    <section className="panel">
                      <div className="panel-heading">
                        <div>
                          <span className="eyebrow">OVER TIME</span>
                          <h2>Activity timeline</h2>
                        </div>
                        <Badge>UTC</Badge>
                      </div>
                      <TimelineChart contributors={people} metric={metric} scope={report.scope} />
                      <ActivityTable people={people} metric={metric} scope={report.scope} />
                    </section>
                    <section className="panel module-panel">
                      <div className="panel-heading">
                        <div>
                          <span className="eyebrow">WHERE WORK HAPPENED</span>
                          <h2>Changed modules</h2>
                        </div>
                        <Layers3 size={19} />
                      </div>
                      <p className="panel-description">
                        Top-level paths by eligible churn. Paths describe code areas, not feature
                        ownership.
                      </p>
                      {[...modules]
                        .sort(([, a], [, b]) => b - a)
                        .slice(0, 7)
                        .map(([path, amount]) => (
                          <div key={path} className="module-row">
                            <span>
                              <FileCode2 size={14} />
                              <code>{path}</code>
                            </span>
                            <strong>
                              {number(amount)} <small>lines</small>
                            </strong>
                          </div>
                        ))}
                      {!modules.size && (
                        <p className="empty-inline">No eligible module changes in this report.</p>
                      )}
                    </section>
                  </div>
                  <section className="ai-panel">
                    <div className="ai-panel-icon">
                      <Sparkles size={23} />
                    </div>
                    <div className="ai-panel-content">
                      <div className="flex items-center gap-2">
                        <span className="eyebrow">ANOTHER LAYER OF CONTEXT</span>
                        <Badge>AI-assisted · Optional</Badge>
                      </div>
                      <h2>
                        {report.insights
                          ? 'Estimates, with their boundaries.'
                          : 'What might the work mean?'}
                      </h2>
                      <p>
                        {report.insights
                          ? 'Open a contributor profile to read their estimate, uncertainty, and linked sources. Estimates do not affect measured shares.'
                          : 'Request evidence-linked work summaries and qualitative impact estimates. This sends a small sample of public titles, paths, and statistics to Groq. It cannot establish ownership or actual value.'}
                      </p>
                      {report.insights ? (
                        <div className="small-muted">
                          {report.insights.estimates.length} contributors estimated ·{' '}
                          {report.insights.model} · {shortDate(report.insights.generatedAt)} ·
                          Sampled evidence
                        </div>
                      ) : (
                        <Button
                          onClick={estimate}
                          disabled={aiLoading || !report.evidence.length}
                          variant="outline"
                        >
                          {aiLoading ? <LoaderCircle className="spin" /> : <Sparkles />}
                          {aiLoading ? 'Assessing evidence…' : 'Send evidence & estimate impact'}
                          <ArrowRight />
                        </Button>
                      )}
                      {aiError && (
                        <p className="error-message" role="alert">
                          {aiError}
                        </p>
                      )}
                    </div>
                  </section>
                </>
              )}
              <div className="report-footnote">
                <ShieldCheck size={15} />
                <span>
                  Algorithm {report.algorithm} · Analyzed{' '}
                  {new Date(report.createdAt).toLocaleString('en', { timeZone: 'UTC' })} UTC ·
                  Report expires {shortDate(report.expiresAt)}. Exports include evidence and scope.
                </span>
              </div>
            </>
          )}
        </main>
        <footer className="main-footer">
          <span>
            RepoTrace<span className="text-blue-700">.</span>{' '}
            <span className="footer-separator">/</span> The work behind the repository.
          </span>
          <button
            onClick={() => {
              setTab('Methodology');
              setSelected(undefined);
              window.scrollTo({ top: 0, behavior: 'instant' });
            }}
          >
            How we measure <ArrowUpRight size={12} />
          </button>
        </footer>
      </div>
    </div>
  );
}
