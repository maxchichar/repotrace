import 'server-only';
import { AppError } from '../validation';

function errorCode(error: unknown): string | undefined {
  let current = error;
  for (let depth = 0; depth < 4 && current && typeof current === 'object'; depth++) {
    const value = current as { code?: unknown; cause?: unknown };
    if (typeof value.code === 'string') return value.code;
    current = value.cause;
  }
}
export function storageError(error: unknown): AppError {
  if (error instanceof AppError) return error;
  const code = errorCode(error);
  const message =
    code === '42P01'
      ? 'Database tables are missing. Set the Vercel build command to npm run vercel:build and redeploy.'
      : code === '28P01'
        ? 'PostgreSQL rejected the database credentials. Update DATABASE_URL from Neon in Vercel and redeploy.'
        : ['ENOTFOUND', 'EAI_AGAIN', 'ECONNREFUSED', 'ETIMEDOUT'].includes(code ?? '')
          ? 'The database host could not be reached. Check the Neon connection and DATABASE_URL in Vercel.'
          : [
                'DEPTH_ZERO_SELF_SIGNED_CERT',
                'SELF_SIGNED_CERT_IN_CHAIN',
                'UNABLE_TO_VERIFY_LEAF_SIGNATURE',
              ].includes(code ?? '')
            ? 'Database TLS verification failed. Use the provider’s verified connection settings; certificate verification remains enabled.'
            : 'Report storage is unavailable. Check DATABASE_URL in Vercel or REPORT_DIR for local development.';
  return new AppError(message, 503, undefined, {
    code:
      code === '42P01'
        ? 'DATABASE_SCHEMA_MISSING'
        : code === '28P01'
          ? 'DATABASE_AUTH_FAILED'
          : 'DATABASE_UNAVAILABLE',
    cause: error,
  });
}
