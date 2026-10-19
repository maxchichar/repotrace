# Deploy RepoTrace to Vercel

RepoTrace is a Next.js application. Import **maxchichar/vec-premium-apps**, branch **main**, with the repository root as the Root Directory. Keep the GitHub repository private if desired; Vercel can deploy a private GitHub repository once its GitHub integration has access.

## Required setup

1. In Vercel, import the GitHub repository into the intended account/team. Use the **Next.js** framework preset, **Node.js 24.x**, and Fluid Compute (the default on current new projects). `vercel.json` supplies `npm run vercel:build` as the build command. Output Directory stays at its Next.js default.
2. Connect a hosted PostgreSQL database through Vercel Marketplace (for example Neon/Supabase), or supply an existing compatible PostgreSQL connection. Prefer the provider's pooled connection URL for serverless usage. Use verified TLS as required by the provider. No production database has been provisioned by this task.
3. Set these environment variables in **Vercel Project → Settings → Environment Variables**, not in GitHub source:

   | Name | Value / scope |
   | --- | --- |
   | `DATABASE_URL` | Required hosted PostgreSQL URL. Give production and preview separate databases/branches. The database user must be able to create the application tables/indexes. |
   | `GROQ_API_KEY` | Your Groq key, entered securely in Vercel. A cloud-workspace proxy placeholder is not a portable production credential. |
   | `GROQ_MODEL` | `openai/gpt-oss-20b` (hosted by Groq). Requests go to `api.groq.com`. |
   | `GITHUB_TOKEN` | Optional GitHub public-repository read credential for a higher API quota. RepoTrace still rejects private repositories. Workspace-injected GitHub authentication is not automatically available on Vercel. |
   | `APP_ORIGIN` | Optional exact canonical origin, such as `https://your-project.vercel.app`. Set only for a fixed production hostname; omit in Preview so preview origins work. |

   None of these names should use `NEXT_PUBLIC_`. Workspace environment settings do **not** automatically populate Vercel project variables. Set values in the intended Production/Preview scopes before building.

4. Deploy. The build first validates DATABASE_URL, then runs the additive PostgreSQL migration, then compiles Next.js. Missing storage or failed migration stops the deployment; it does not publish a dashboard that cannot retain reports. Concurrent builds serialize their migrations with a PostgreSQL advisory transaction lock.

## Runtime behavior on Vercel

- Reports persist in PostgreSQL for up to seven days. The local `.data/` fallback is disabled when `VERCEL=1`, since Vercel function filesystems are ephemeral/read-only outside temporary storage. Reports generated in this cloud workspace are **not** copied to production or committed to GitHub.
- The analysis route allows 120 seconds; the collector dispatch budget is 90 seconds. AI allows 60 seconds with a 45-second provider timeout. Confirm the selected Vercel plan/runtime supports these configured durations. Large histories still return explicitly partial analyses when a cap is reached.
- An atomic PostgreSQL rate-limit table enforces a **deployment-wide ceiling** of 12 analyses and 4 AI requests per UTC hour across serverless instances. Existing process/client limits are an additional gate. This conservative global cap bounds provider usage; it is not authenticated per-user fairness. Use Vercel Deployment Protection for an initial restricted rollout; add user authentication and user-level quotas before a larger public service.
- Local cache and active-job deduplication remain per-process. Concurrent duplicate analyses on separate instances may consume separate quota slots. Requests are synchronous; disconnected requests are not durable background jobs. A queue is a future requirement for unrestricted/full-history workloads, rather than the bounded initial workflow.
- Hosted report JSON responses are bounded to 3 MB to remain below Vercel's function payload limit. An oversized analysis fails with a clear smaller-window message rather than silently dropping evidence. High-volume exports may need a future object-storage path.
- The PostgreSQL client uses at most five connections per instance with timeouts. Use a provider pooler and monitor database connection limits.
- AI data disclosure and citation validation remain in place. AI is optional; omitted Groq credentials cause a clear unavailable state while measured analysis remains available.

## Post-deployment checks

Use the actual deployment URL provided by Vercel; no deployment URL has been invented in this repository.

1. Visit `/` and confirm the repository form loads. GET `/api/health` should return 200; this is process health, not database/provider readiness.
2. Analyze `https://github.com/octocat/Hello-World`, dates `2011-01-01` through `2011-12-31`, and verify two commit units, three changed lines, and original GitHub evidence. Inspect scope warnings; the branch head itself can change upstream.
3. Reload the report URL and open it in a separate session to verify PostgreSQL persistence. Test CSV/JSON export.
4. Explicitly request AI estimates once and inspect contributor-specific references. This incurs provider usage. Verify that measured contributor statistics do not change.
5. Inspect Vercel function logs for errors without logging credential values, database URLs, or complete provider request headers.

## Redeploy / rollback

Git pushes to the configured production branch trigger deployments after Vercel is connected. To recover from a bad app release, promote a previous successful Vercel deployment. The current migration is additive and preserves report records; rolling back the application does not require deleting tables. Retain normal database backups/restore controls through the database provider. Do not remove storage or disable quota enforcement to bypass a failing deployment.

## Deploy from an authenticated CLI (optional)

After connecting Vercel credentials through its supported login flow and configuring the project variables/database:

```bash
npx vercel login
npx vercel link
npx vercel deploy --prod
```

This cloud workspace currently has no Vercel login/token or hosted DATABASE_URL. The GitHub push and local deployment checks can be completed independently. The user's Vercel account connection, database provisioning and secure environment entry are prerequisites to an actual production deployment.
