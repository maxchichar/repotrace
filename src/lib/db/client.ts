import 'server-only';
import { AppError } from '../validation';
import { Pool } from 'pg';
import { drizzle } from 'drizzle-orm/node-postgres';
let pool: Pool | undefined;
export function database() {
  const connectionString = process.env.DATABASE_URL?.trim();
  try {
    if (!connectionString) throw new Error('Missing database configuration');
    const url = new URL(connectionString);
    if (!['postgres:', 'postgresql:'].includes(url.protocol) || !url.hostname)
      throw new Error('Invalid database protocol');
  } catch (cause) {
    throw new AppError(
      'DATABASE_URL must be a PostgreSQL connection string. Copy the connection URL from Neon, not the psql command, into Vercel and redeploy.',
      503,
      undefined,
      { code: 'DATABASE_CONFIG_INVALID', cause },
    );
  }

  pool ??= new Pool({
    connectionString,
    max: 5,
    connectionTimeoutMillis: 5000,
    idleTimeoutMillis: 10000,
    allowExitOnIdle: true,
  });
  return drizzle(pool);
}
