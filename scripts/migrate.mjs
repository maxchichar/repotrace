import pg from 'pg';
if (!process.env.DATABASE_URL)
  throw new Error('Set DATABASE_URL on the server before running migrations.');
const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL,
  connectionTimeoutMillis: 5000,
});
const client = await pool.connect();
try {
  await client.query('BEGIN');
  // Serialize concurrent preview/production builds sharing the same database.
  await client.query("SELECT pg_advisory_xact_lock(hashtext('repotrace-schema'))");
  await client.query(`CREATE TABLE IF NOT EXISTS repotrace_reports (
    id uuid PRIMARY KEY,
    payload jsonb NOT NULL,
    created_at timestamptz NOT NULL,
    expires_at timestamptz NOT NULL
  );
  CREATE INDEX IF NOT EXISTS repotrace_reports_expires_idx ON repotrace_reports(expires_at);
  CREATE TABLE IF NOT EXISTS repotrace_rate_limits (
    key text PRIMARY KEY,
    used integer NOT NULL,
    expires_at timestamptz NOT NULL
  );
  CREATE INDEX IF NOT EXISTS repotrace_rate_limits_expires_idx ON repotrace_rate_limits(expires_at);`);
  await client.query('COMMIT');
  console.log(
    'RepoTrace report and request-limit schemas are ready. Existing reports were preserved.',
  );
} catch (error) {
  await client.query('ROLLBACK');
  throw error;
} finally {
  client.release();
  await pool.end();
}
