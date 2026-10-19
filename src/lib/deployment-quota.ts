import 'server-only';
import { sql, lt } from 'drizzle-orm';
import { database } from './db/client';
import { rateLimits } from './db/schema';
import { assertHostedStorage } from './deployment';
import { storageError } from './db/errors';
import { AppError } from './validation';

// A server-wide hourly ceiling, shared by every Vercel function instance. It bounds
// GitHub and Groq spend even if clients spoof addresses or instances cold-start.
export async function enforceDeploymentQuota(kind: 'analysis' | 'ai', now = Date.now()) {
  if (process.env.VERCEL !== '1') return;
  assertHostedStorage();
  const hour = Math.floor(now / 3_600_000);
  const expiresAt = new Date((hour + 1) * 3_600_000);
  const key = `deployment:${kind}:${hour}`;
  const limit = kind === 'ai' ? 4 : 12;
  try {
    await database().transaction(async (tx) => {
      await tx.delete(rateLimits).where(lt(rateLimits.expiresAt, new Date(now)));
      const result = await tx.execute<{ used: number }>(sql`
        INSERT INTO repotrace_rate_limits (key, used, expires_at)
        VALUES (${key}, 1, ${expiresAt})
        ON CONFLICT (key) DO UPDATE
        SET used = repotrace_rate_limits.used + 1
        WHERE repotrace_rate_limits.used < ${limit}
        RETURNING used
      `);
      if (!result.rows.length) {
        throw new AppError(
          'The deployment’s hourly request allowance has been reached. Try again after the next UTC hour.',
          429,
          Math.max(1, Math.ceil((expiresAt.getTime() - now) / 1000)),
        );
      }
    });
  } catch (error) {
    if (error instanceof AppError) throw error;
    throw storageError(error);
  }
}
