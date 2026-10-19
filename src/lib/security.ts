import 'server-only';
import { createHash } from 'node:crypto';
import { AppError } from './validation';
const buckets = new Map<string, { count: number; reset: number }>();
export function guardRequest(request: Request, kind: 'analysis' | 'ai') {
  const url = new URL(request.url),
    origin = request.headers.get('origin');
  const expectedOrigin =
    process.env.APP_ORIGIN || `${url.protocol}//${request.headers.get('host') || url.host}`;
  if (origin && origin !== expectedOrigin)
    throw new AppError('Cross-origin requests are not allowed.', 403);
  if (request.headers.get('sec-fetch-site') === 'cross-site')
    throw new AppError('Cross-site requests are not allowed.', 403);
  // Only trust the real client header when an operator configures a trusted reverse proxy.
  const address =
    process.env.TRUST_PROXY === '1'
      ? request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown'
      : 'shared';
  const key = createHash('sha256').update(`${kind}:${address}`).digest('hex');
  const now = Date.now();
  for (const [k, v] of buckets) if (v.reset < now) buckets.delete(k);
  const record = buckets.get(key) ?? { count: 0, reset: now + 3600000 };
  const limit = kind === 'ai' ? 4 : 12;
  if (record.count >= limit)
    throw new AppError(
      'This server’s hourly request allowance has been reached. Try again later.',
      429,
      Math.ceil((record.reset - now) / 1000),
    );
  record.count++;
  buckets.set(key, record);
}
export async function readBody(request: Request) {
  if (!request.headers.get('content-type')?.includes('application/json'))
    throw new AppError('Send an application/json request.', 415);
  if (Number(request.headers.get('content-length') || 0) > 4096)
    throw new AppError('Request body is too large.', 413);
  const reader = request.body?.getReader();
  if (!reader) throw new AppError('A JSON body is required.');
  let bytes = 0;
  const chunks: Uint8Array[] = [];
  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    bytes += value.length;
    if (bytes > 4096) {
      await reader.cancel();
      throw new AppError('Request body is too large.', 413);
    }
    chunks.push(value);
  }
  try {
    return JSON.parse(Buffer.concat(chunks).toString('utf8')) as unknown;
  } catch {
    throw new AppError('Request body must be valid JSON.');
  }
}
export function errorResponse(error: unknown) {
  const e =
    error instanceof AppError
      ? error
      : new AppError('The request could not be completed. Please try again.', 500);
  return Response.json(
    { error: e.message },
    {
      status: e.status,
      headers: {
        'Cache-Control': 'no-store',
        ...(e.retryAfter ? { 'Retry-After': String(e.retryAfter) } : {}),
      },
    },
  );
}
