# RepoTrace architecture and acceptance plan

## Design and scope
Build a Next.js App Router monolith with TypeScript, Tailwind, shadcn/ui primitives, Octokit, Zod, and Recharts. Domain attribution stays pure and separately tested. A narrow server adapter owns upstream access; the browser never receives tokens. Standard risk engineering, with additional security checks for credentials, untrusted source text, SSRF, and optional paid inference.

UI direction: precise, composed, investigative. Ink sidebar, warm neutral canvas, emerald actions, restrained serif display heading and tabular data. The primary journey is URL → branch/window → explicit run status → measured dashboard → contributor evidence → optional AI → report/export. No sample contributors or synthetic analytics on the landing page. Loading, empty, error, partial, missing-AI, and expired-report states are first-class. Charts have matching numeric tables.

## Boundaries
Browser → validated same-origin API → public-repository GitHub adapter → immutable evidence/attribution engine → bounded local report store → dashboard/share/export.
Optional AI request → stored report → minimized evidence packet → fixed Groq HTTPS endpoint → strict validation → separate estimate fields.

Persistence decision: share links justify persistence. PostgreSQL with Drizzle is supported when DATABASE_URL is configured (typed JSONB report table, UUID primary key, expiry index, transactional upsert and expired-row cleanup). An idempotent migration creates the schema. A bounded local JSON fallback under .data/ makes development usable without a database; its reports are atomic writes, max 100, seven-day TTL. Local fallback cannot promise cross-instance durable sharing. Production should use PostgreSQL plus a distributed queue/rate limiter before horizontal deployment. Filesystem fallback durability depends on a persistent volume. Exports provide portable snapshots. Real PostgreSQL integration is checked with an isolated local test container; no synthetic reports are seeded into the application store.

## Models
Repository: id, owner/name, URL, description, stars, forks, default/selected branch, resolved SHA.
Analysis: random UUID, schema/algorithm version, created/expires, window, scope, warnings, request counts/completeness, evidence[], contributors[], totals.
Evidence: immutable commit SHA or PR number ID, canonical GitHub URL, date, title, actor IDs, file path/addition/deletion/exclusion metadata. No email or source patches in reports.
Contributor: opaque ID, optional account login/URL/avatar, name, identity confidence, bot flag, commit units, eligible churn, merged PR count, linked evidence, file/module breakdown, daily timeline.
Estimate: known contributor ID, summary, impact low/moderate/high, confidence low/medium, rationale, limitations, known evidence IDs; never a measured share.

## API contracts
- POST /api/analyses {url, branch?, since, until}: strict input; resolve public metadata/head; paginated bounded analysis; cache repeat key; persist; return report. Errors: 400 invalid, 403 private/prohibited, 404 not found, 429 quota/rate limit (+ Retry-After), 502 upstream, 503 unavailable storage.
- GET /api/reports/:id: stored immutable report; UUID validation; 404 expired/unknown.
- GET /api/reports/:id/export?format=json|csv: correct MIME, attachment, spreadsheet formula escaping; no credentials/emails.
- POST /api/reports/:id/insights: same-origin, explicit opt-in, server credential only, paid inference quota, bounded packet/output and citations. 503 if unconfigured. Store estimates separately from measurements.
- /reports/:id is a public read-only view; unguessable ID is convenience, not access control. Repositories must be public; disclose reports share public activity. Contributor profiles are navigable from report with stable query selection.

## Algorithm / completeness contract
Resolve branch head and walk commit pages by SHA with since/until. Walk closed PR pages for base branch sorted updated desc, filter merged_at but do not stop early. Exclude multi-parent merge commits. Fetch each unique commit with paginated files. Capture page/detail/file/request/time caps and failures as warnings; never claim complete when hit. Known generated/vendor/build/lockfiles are heuristically excluded and exposed. Deduplicate commits, PRs, and coauthor trailers. Build email→observed account-ID sets, link only singleton sets. Fractionally allocate each commit and its eligible churn among unique authors/coauthors. Separate merged-PR denominators. Bots included unless user toggles view. File attribution is observed changed paths, feature labels only stated intent with citations. Full scan means API traversal completed for selected window, not proof all history/effort exists.

Cache: canonical owner/repo + branch + UTC window + algorithm version, TTL 15 min, in-flight dedup, no stale masquerading as fresh. Store reports 7 days, max 100. Quotas and concurrency are process-local and explicitly not a complete public deployment abuse solution. Per run bounded pages/commits/files, 180 upstream calls and deadline; render partial results with precise warnings.

## Milestones and acceptance
1. Research + plan: official-source constraints, comparator findings, unknowns documented before application code.
2. Data engine: URL rejection tests; fractional percentages conserve units; merge exclusion; duplicate commits/PRs/coauthors; bot denominator; generated paths; anonymous/ambiguous IDs; rename/file evidence; zero denominator. Adapter integration tests mock HTTP boundary with Octokit, exercise pagination, private rejection, rate limit, partial failures/caps and no early PR stop. No fake fixtures in runtime.
3. Product: real input flows to evidence report; compare measured metrics, contributor selection/timeline/module detail, bot toggle, branch/window/partial state visible; JSON/CSV exports and public report route work; AI missing/invalid/citation cases tested; no mock runtime data.
4. Verification: tests + lint + typecheck + production build; actual server requests and browser critical path if tooling works; responsive/keyboard/automated accessibility checks if available. Live GitHub and paid AI verified only when authorized network/credentials are available. Record failures/unrun distinctly.

## Deployment and recovery
No deployment is authorized by this build. npm ci; npm run build; npm start. Optional server env GITHUB_TOKEN (GH_TOKEN fallback), GROQ_API_KEY, GROQ_MODEL; REPORT_DIR for writable durable volume. No private source. Health endpoint verifies process; readiness needs writable storage and actual GitHub connectivity. Stop own process to roll back runtime; code rollback via reviewed commit, not destructive resets. Multi-instance hosting needs PostgreSQL, distributed cache/quota, job queue and authentication for cost-bearing AI. See README for limits; local checks do not establish production readiness.
