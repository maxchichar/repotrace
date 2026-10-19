import { spawnSync } from 'node:child_process';

if (!process.env.DATABASE_URL) {
  console.error(
    'RepoTrace needs hosted PostgreSQL on Vercel. Add DATABASE_URL in project settings before deploying. The local filesystem report store is for development only.',
  );
  process.exit(1);
}
for (const args of [['scripts/migrate.mjs'], ['node_modules/next/dist/bin/next', 'build']]) {
  const result = spawnSync(process.execPath, args, { stdio: 'inherit', env: process.env });
  if (result.error) {
    console.error('A RepoTrace build step could not start. Check the build runtime.');
    process.exit(1);
  }
  if (result.status !== 0) process.exit(result.status ?? 1);
}
