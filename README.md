# RepoTrace

An evidence-first GitHub contribution intelligence platform. Analyze a **public** repository by branch and UTC window; compare separate commit, code-change, and merged-PR shares; inspect contributor profiles, files, modules, timelines, and original GitHub evidence; share reports and export PDF/JSON/CSV. Optional AI summaries estimate potential technical impact with cited evidence and uncertainty, separately from measured activity. No runtime demo analytics or invented contributor data.

## Deploy to Vercel

Import `maxchichar/repotrace` into Vercel using the Next.js preset and Node.js 24.x. Connect hosted PostgreSQL, set `DATABASE_URL` and your server-only `GROQ_API_KEY`, then deploy. The configured build command migrates the database before compiling. Local report storage is disabled on Vercel; PostgreSQL also enforces shared deployment-wide request limits.

Follow [the deployment guide](docs/DEPLOYMENT.md) for environment variables, secure key entry, preview database separation, verification and rollback. Cloud-workspace credentials do not automatically transfer to Vercel.

## Develop

Requires Node **24.5+** (proxy-aware native fetch) and npm.

```bash
npm ci --cache /tmp/repotrace-npm-cache
npm run dev
```

Open the running app using your development host's normal preview mechanism. The app starts with an empty repository form. Use a full `https://github.com/owner/repo` URL, optional branch, and **All history** (the default) or a custom UTC date range. Custom ranges can span multiple years; there is no fixed day limit. Collection budgets still apply, and incomplete reports disclose their limits. The server uses the environment HTTPS proxy (`NODE_USE_ENV_PROXY=1` in start/dev scripts). GitHub API access to `api.github.com` must be allowed. Public repos work without a token at GitHub's lower unauthenticated quota.

## Server-only configuration

Copy `.env.example` to `.env.local` only when needed, preserving existing values. Never commit credentials or prefix them with `NEXT_PUBLIC_`.

| Variable | Purpose |
| --- | --- |
| `GITHUB_TOKEN` | Optional public-repository GitHub read access; existing `GH_TOKEN` is a fallback. Private repositories are rejected even if the token can access them. |
| `GROQ_API_KEY` | Optional Groq credential. AI is requested explicitly by the user; never automatically billed on analysis. |
| `GROQ_MODEL` | Defaults to `openai/gpt-oss-20b`; choose a model supporting JSON chat responses. |
| `DATABASE_URL` | PostgreSQL connection string for durable shared reports. Use provider-required TLS with certificate verification. Run migration before start. |
| `REPORT_DIR` | Local report fallback if DATABASE_URL is absent. Default `.data/reports`, writable persistent volume recommended. |
| `APP_ORIGIN` | Optional canonical browser origin (scheme + host + port) for same-origin checks behind a reverse proxy. |
| `TRUST_PROXY` | Set `1` only behind a trusted proxy that overwrites X-Forwarded-For. Otherwise all users share a conservative hourly quota. |

AI sends a bounded sample of public commit/PR titles, file paths, and statistics to **api.groq.com**, never source patches or author emails. Repository text is untrusted. Schema and contributor-specific citation validation rejects unsupported references, but cannot prove the model's interpretation correct. No AI key means the feature clearly reports unavailable; measured analysis still works.

## Persistence

PostgreSQL + Drizzle is the durable report backend when configured:

```bash
npm run db:migrate
npm run build
npm start
```

The migration is additive/idempotent; it preserves existing rows. Reports use UUID IDs, JSONB payloads, indexed expiry, transactional upserts, and seven-day retention. Configure a managed database and verified TLS before deployment. Analysis cache and in-flight limits remain process-local. On Vercel, atomic PostgreSQL counters additionally enforce a shared deployment-wide quota; per-user authentication/fairness and durable job coordination remain future work.

Without DATABASE_URL, atomic local JSON reports are retained up to seven days, capped at 100. Share URLs work only while the serving instance retains the report; ephemeral or horizontally scaled filesystem hosting needs PostgreSQL. Share IDs are convenience links, not access control: reports contain public activity and are publicly readable. PDF/CSV/JSON exports include scope and evidence. The PDF is a paginated text report with separate measured shares and saved AI estimates, warnings, contributor details and clickable evidence references. It lists up to ten changed paths per contributor; JSON retains full file statistics and timelines. GitHub-linked contributor avatars load from the GitHub avatar CDN by numeric account ID, with initials for unresolved accounts or failed images. CSV formula prefixes are escaped.

## Attribution contract

- Each observed non-merge commit contributes one unit split equally among its author and unique declared coauthors. Committers do not get author credit automatically.
- GitHub numeric account IDs resolve people. Only unambiguous observed email mappings or matching observed numeric noreply IDs link coauthors; names do not. Unknown people remain unresolved. Author emails never appear in stored/exported report fields.
- Code-change share uses fractional **additions + deletions** in eligible paths, not surviving lines, code quality, actual project ownership, or effort. Known generated/vendor/build/lockfile paths are heuristically excluded and remain visible in evidence.
- Merged-PR share credits the opener by merge timestamp into the selected base branch. It is never added to commit/churn shares. Squashed/rebased original authors may be unrecoverable.
- Bots are included by default. Excluding bots recalculates every denominator. Anonymous and ambiguous identities remain in their appropriate denominators. Empty metrics show 0%, not invented activity.
- Feature intent comes from linked commit/PR titles, not proof of a delivered feature. Modules are literal top-level paths. CODEOWNERS is not treated as historical ownership.
- The selected branch resolves to an immutable head for commit traversal. PR pages are a live base-branch view, not a transactional snapshot. Committer timestamps (author date fallback is disclosed) and PR merge timestamps define their respective UTC windows.

Timelines show explicit zero-activity periods and aggregate longer ranges into calendar months or years without discarding recent activity. Incomplete account metadata remains unresolved unless observed evidence links it unambiguously.

A run is capped at 120 observed commits, ten list pages per collection, 30 file pages/3,000 files per commit, 180 upstream requests, and a 90-second dispatch budget (individual requests time out). Bounded sequential requests avoid request bursts. GitHub rate-limit and Retry-After information is surfaced rather than repeatedly retrying an exhausted quota. Timeouts, failures, and caps generate **partial** reports with explicit warnings. Even a finished API traversal cannot establish deleted history, unrecorded coauthors, total effort, or actual impact. UI percentages are rounded; exports preserve underlying fractions.

## Verify

```bash
npm test
npm run typecheck
npm run lint
npm run build
# Start the production server in another terminal, then:
npm run test:e2e
# Opt-in live GitHub form → report → profile → evidence → exports check:
E2E_LIVE=1 npm run test:e2e
```

Playwright defaults to `/usr/bin/chromium`; set `CHROMIUM_PATH` for another installation. The optional live test uses the real public `octocat/Hello-World` repository in 2011, so it requires network access and upstream availability. The paid AI call is not made by this test; unavailable AI is tested. Standard browser tests do not require GitHub.

An isolated real PostgreSQL integration test can run with a disposable local test database:

```bash
# Local test only: trust auth, bound to loopback; never expose this as a production database.
docker run --rm -d --name repotrace-test-postgres \
  -p 127.0.0.1:54329:5432 -e POSTGRES_HOST_AUTH_METHOD=trust \
  -e POSTGRES_DB=repotrace postgres:17-alpine
DATABASE_URL=postgresql://postgres@127.0.0.1:54329/repotrace npm run db:migrate
TEST_DATABASE_URL=postgresql://postgres@127.0.0.1:54329/repotrace npm test
docker stop repotrace-test-postgres
```

Use only a disposable test database for the integration suite. Unit/HTTP adapter fixtures stay under `tests/` and are never imported by runtime application code.

## API

- `POST /api/analyses` — JSON `{url, branch?, mode: "all"}` for history through today, or `{url, branch?, mode: "custom", since, until}` (ISO UTC dates; omitting mode preserves the custom-range API). Validates scope, reads public GitHub metadata, pins head, collects bounded evidence, computes measures, caches 15 minutes, persists report. Same-origin mutations, 4 KB body cap, two active analyses, hourly allowance.
- `GET /api/reports/:id` — retained report or 404; storage outage returns 503.
- `GET /api/reports/:id/export?format=json|csv|pdf` - downloadable PDF report, evidence-rich JSON or contributor CSV.
- `POST /api/reports/:id/insights` — explicit opt-in, at most four AI requests/hour per client bucket, one active model request. Existing estimates reused.
- `GET /api/health` — process health, not proof of GitHub/database readiness.

## Production boundary

This application has local verification, not production/load certification. Vercel deployment requires hosted PostgreSQL and uses database-backed global quotas across function instances (12 analyses and 4 AI requests per UTC hour), a required-storage build gate, and route duration limits. Per-user authentication/fairness, durable background jobs, operational monitoring and backups are still needed before a larger public rollout. Cache/deduplication remains per-process. The bounded analysis workflow fits the configured 120-second route; unrestricted full-history jobs need a worker.

Research, API uncertainties, competitor findings and sources: [docs/RESEARCH.md](docs/RESEARCH.md). Architecture and milestones: [docs/PLAN.md](docs/PLAN.md). Actual verification record: [docs/VALIDATION.md](docs/VALIDATION.md).
