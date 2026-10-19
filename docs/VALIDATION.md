# RepoTrace verification record

## Groq provider correction — 2026-10-19

The AI integration now uses **Groq**, fixed endpoint `https://api.groq.com/openai/v1/chat/completions`, server-only `GROQ_API_KEY`, and optional `GROQ_MODEL` (default `openai/gpt-oss-20b`). The endpoint path names the OpenAI-compatible protocol; inference is provided by Groq. UI disclosure, .env.example, README, plan, and tests were updated. Official Groq TypeScript SDK source confirms the host, credential name, model, `max_completion_tokens`, and JSON response mode.

Checks after the change: `npm test` **37 passed, 1 skipped** (PostgreSQL test requires its disposable database, already verified in the original run below); typecheck, lint and production build passed. Contract tests assert the exact Groq endpoint, model default/override, JSON mode, token budget, and rate-limit handling. The updated production server also passed all 3 browser tests in 16.4 seconds, including the real public GitHub form/report workflow and unavailable-Groq messaging. No Groq key was present in process configuration or .env.local, so actual provider inference remains unrun. The original verification record below is retained as historical evidence.

The environment draft now includes the GROQ_API_KEY requirement and api.groq.com allowance, with updated startup instructions. The update tool cannot delete old credential requirements. The unbound legacy AI_API_KEY/OpenAI entry must be removed in environment settings; its presence causes the tool to retain api.openai.com on the allowlist. Runtime code has no OpenAI provider or credential fallback. Review/save and publish the corrected environment configuration.

## Original implementation verification


Verified in the cloud workspace on **2026-10-19**. Node 24.19.0, npm 11.9.0, Next.js 16.4.2, React 19.3.1. Application algorithm: 1.1.0. These results apply to this machine and working tree, not a deployment or restored environment.

## Milestones

1. **Research and plan:** inspected the empty repository, user-installed skills, official GitHub documentation and git-fame/gitinspector documentation. Initially blocked GitHub API/docs access was resolved through the environment network configuration. Official endpoint pages subsequently returned HTTP 200. Research and architecture recorded before application implementation.
2. **Data engine:** first focused suite passed 31 tests for URL/scope validation, fractional coauthors, unresolved identities, separate denominators, bot filtering, generated exclusions, pagination, API failures, rate limits, report storage, CSV injection, AI packet minimization and citation validation.
3. **Product and persistence:** implemented the responsive dashboard, navigable contributor profiles, file/module evidence, UTC timelines, optional AI pipeline, public report routes and CSV/JSON exports. Added PostgreSQL/Drizzle with a real isolated PostgreSQL 17 integration test, additive migration and local fallback. No fixtures were installed in the runtime report store.
4. **Final verification:** 37 unit/integration tests and 3 Playwright browser tests passed. Details below.

## Actual final checks

| Command / check | Observed outcome |
| --- | --- |
| `npm ci --cache /tmp/repotrace-npm-cache` | Passed, lockfile install reproduced successfully. |
| `TEST_DATABASE_URL=postgresql://postgres@127.0.0.1:54329/repotrace npm test` | **37 passed**, 4 test files; no skipped tests in this configured run. Includes HTTP-boundary Octokit integration and real PostgreSQL/Drizzle persistence. |
| `npm run typecheck` | Passed. |
| `npm run lint` | Passed, zero reported errors/warnings. |
| `npm run build` | Passed, all application/API/report routes compiled. |
| `npm start` + health request | Passed; production server started and health returned 200. |
| `E2E_LIVE=1 npm run test:e2e` | **3 passed** in 15.3s; actual production server and Chromium. |
| axe WCAG 2 A/AA and 2.1 AA automated checks | Zero violations in tested landing, contributor profile, evidence and overview views. This is not a complete WCAG audit/certification. |
| Responsive browser assertions | Landing/methodology: 1440, 768, 390, 320 px; report: 768, 390, 320 px. No whole-document horizontal overflow at tested sizes. The comparison table has its own horizontal scrolling area. |
| `DATABASE_URL=… npm run db:migrate`, repeated on disposable database | Passed; migration is idempotent and existing schema/rows are preserved. |
| `npm audit --omit=dev --audit-level=high` | Reported **0 vulnerabilities** for production dependencies. Not a complete security audit. |
| `git diff --check` | Passed. |

The PostgreSQL test used a disposable Docker container with loopback-only access and local trust authentication, not production credentials. It was stopped after testing. The running application uses the local report fallback unless DATABASE_URL is configured. Standard `npm test` skips the optional database integration test when TEST_DATABASE_URL is absent; the run above explicitly enabled it.

## Real GitHub evidence

- Native Octokit metadata requests succeeded with the existing injected GitHub authentication after Node native fetch was configured to honor HTTPS_PROXY through NODE_USE_ENV_PROXY=1. TLS verification remained enabled.
- Private repository metadata accessible to the server token was correctly rejected by the application before history collection.
- The live browser test entered **https://github.com/octocat/Hello-World**, UTC window **2011-01-01 through 2011-12-31**, using the actual input form.
- The observed public report contained two contributors (`Spaceghost`, `Cameron423698`), two commit units, three eligible changed lines, and zero merged PRs in that window. Commit shares were 50%/50%; code-change shares were 2/3 and 1/3; merged-PR shares were zero. These are observed API results for that specific window, not sample production data or project ownership.
- The analysis resolved the repository's default branch head, completed its bounded API traversal in 12 requests, retained original GitHub evidence URLs, and displayed scope caveats.
- The browser exercised metric switching, contributor profile/timeline/evidence, unavailable-AI messaging, evidence search view, CSV download response, and full JSON export. JSON repository identity and CSV contributor/evidence fields were checked.
- Runtime reports contain only data collected from public GitHub; synthetic API fixtures remain in `tests/`.

## Defects found and corrected during verification

- Current lucide-react no longer exports the previous GitHub brand icon. Replaced it with a supported Git graph icon.
- Node's default fetch transport did not honor the environment's HTTP proxy. Tested and saved Node 24 proxy-aware start commands.
- Valid browser requests were initially rejected because Next's internal host differed from the incoming host. Same-origin checking now respects the incoming host (or configured APP_ORIGIN); regression test and actual browser request pass.
- PR filtering used lexicographic timestamp comparison, which could omit the last second of a window when fractional precision differed. It now compares parsed timestamps, with a regression test.
- Coauthor text outside the final trailer block could be interpreted as attribution. Credit now requires a final trailer block; a narrative-text regression test passes.
- Window dates now use committer timestamps for branch activity while author/coauthor identities receive credit. Missing committer dates use a disclosed author-date fallback; a rebased-commit regression test verifies the distinction.
- A sparse timeline initially joined distant active days, visually suggesting sustained activity. Every UTC day now has an explicit value, including zero; step rendering and a conservation test prevent interpolation of unseen work.
- Automated accessibility checks caught muted labels with insufficient contrast. Affected labels were darkened and small interface text enlarged. All tested views now pass the selected axe checks.
- Narrow screens exposed an absolutely positioned accessible table label and stale chart dimensions during resize. Scrolling-table positioning and chart bounds now contain them; responsive assertions pass through 320 px.

## Saved environment configuration

Draft persistence was confirmed by the environment configuration tool. Saved fields: **install_script**, **start_skill**, required network additions (`api.github.com`, `docs.github.com`, `api.openai.com`), and the optional **AI_API_KEY** credential requirement targeting api.openai.com. Existing GitHub authentication was reused; no new GitHub token was requested. The draft is not a publication. Review/save changes in environment settings and publish the environment to activate a reusable published version. Fresh-task restoration has not been verified.

## Known limits / unrun checks

- **Paid AI inference not run:** no AI_API_KEY was available. The fixed-host provider adapter, valid/invalid output handling, missing-key behavior, evidence minimization, and citation validation were tested with isolated provider fixtures; the real browser confirmed unavailable-AI behavior. Supply a key securely in environment settings to enable actual inference. AI output still needs human judgment; citation validation does not establish semantic truth.
- **No production deployment, load test, field Core Web Vitals, manual screen-reader audit, or cross-browser certification.** Chromium and the specified automated checks were exercised. GitHub CI configuration was added but not executed remotely.
- Per-process cache, concurrency limits, and hourly quotas do not provide distributed abuse protection or reliable long-running job coordination across replicas. PostgreSQL report persistence is implemented and tested, but production multi-instance use also needs a distributed limiter and job queue, operational monitoring and appropriate AI authorization/budgets.
- Default local reports require a persistent writable volume to survive deployment restarts. Configure PostgreSQL for shared durable storage. No production database was provisioned or configured.
- API traversal caps, generated-file heuristics, missing patches, anonymous/ambiguous accounts, squash/rebase/deleted history, and changing PR collections limit completeness and interpretation. No activity metric proves ownership, quality, effort, or actual technical impact.
- Full available history on very large repositories, a GitHub App installation workflow, cross-repository identity curation, CODEOWNERS/blame analysis, and source-level feature understanding are outside this release.

## Live Groq verification — 2026-10-19

After the user saved GROQ_API_KEY, process presence and the saved binding were confirmed without printing values. Authenticated GET https://api.groq.com/openai/v1/models returned 200. The previously selected llama-3.3-70b-versatile was absent from the live model catalog, causing the first estimate attempt to fail. The application default and saved GROQ_MODEL suggestion were corrected to the available Groq-hosted openai/gpt-oss-20b model; the requests still go exclusively to api.groq.com.

The actual analysis → insights → retained-report API workflow then succeeded for octocat/Hello-World, UTC 2011. Groq returned two contributor estimates; every contributor-specific citation passed validation, deterministic contributor measurements were byte-equivalent before/after enrichment, and estimates persisted on a subsequent GET. A Chromium check confirmed a generated impact estimate is visible in its contributor profile and its evidence links match the stored cited GitHub records. This establishes provider integration and rendering for this small evidence packet, not the accuracy of all model interpretations or large-scale performance.

After the model correction: npm test reported 37 passed and 1 skipped (optional PostgreSQL test); typecheck, lint and build passed. The updated production server is running. Updated default/model startup settings were saved to the draft; review/save and publish are still required to preserve the latest reusable snapshot. Earlier entries describing unavailable Groq inference are historical and are superseded by this live result.

## GitHub / Vercel deployment preparation — 2026-10-19

Deployment-specific changes: `vercel.json` selects Next.js and the validated `vercel:build` script; Node is pinned to the 24.x runtime. The build requires hosted PostgreSQL, migrates schema with a transaction/advisory lock, and compiles the app. Vercel runtime storage fails closed without DATABASE_URL instead of attempting local filesystem writes. PostgreSQL counters atomically bound all function instances to 12 analyses / 4 AI requests per UTC hour. Existing local/client guards remain an additional limit. Large hosted report/export responses receive a clear size-limit error. `.vercel/`, secrets, generated reports, and runtime outputs are excluded from Git.

Verified locally with a disposable PostgreSQL 17 container:

- **42 unit/integration tests passed**, including all PostgreSQL tests and eight concurrent quota calls (four admitted, four rejected at the shared AI ceiling), next-hour reset, missing-storage runtime rejection, and missing-DATABASE_URL build rejection.
- Typecheck and lint passed.
- `VERCEL=1 DATABASE_URL=… npm run vercel:build` passed with the additive schema migration and optimized Next.js build. This is the configured build command executed locally, not a remote Vercel deployment.
- The production server was started with VERCEL=1 and PostgreSQL. All **3 browser tests passed** in 14.6 seconds, exercising the real GitHub input/report/profile/export workflow plus local API security and accessibility/responsive checks.
- Credential-pattern scan found no token/password literals in publishable files. Generated report data remains ignored.

GitHub read/write access to maxchichar/vec-premium-apps was confirmed. Vercel CLI reported **Logged out**; neither a Vercel login/token nor hosted DATABASE_URL is available in the workspace. Actual remote deployment and production-domain validation remain blocked by those prerequisites. Importing the pushed repository and entering credentials securely in Vercel is documented in DEPLOYMENT.md. Cloud proxy-bound credentials are not copied to another platform.
