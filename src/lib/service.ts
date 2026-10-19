import 'server-only';
import { storageError } from './db/errors';
import { assertHostedStorage } from './deployment';
import { createHash } from 'node:crypto';
import { analyzeRepository } from './github';
import { readReport, saveReport } from './store';
import { ALGORITHM, type Analysis } from './types';
import { AppError, parseAnalysisInput, parseRepository } from './validation';
const cache = new Map<string, { id: string; expires: number }>();
const inFlight = new Map<string, Promise<Analysis>>();
export async function runAnalysis(body: unknown) {
  const input = parseAnalysisInput(body);
  assertHostedStorage();
  const repository = parseRepository(input.url);
  const key = createHash('sha256')
    .update(
      JSON.stringify([
        repository.owner.toLowerCase(),
        repository.name.toLowerCase(),
        input.branch || '',
        input.mode,
        input.since,
        input.until,
        ALGORITHM,
      ]),
    )
    .digest('hex');
  const existing = cache.get(key);
  if (existing && existing.expires > Date.now()) {
    try {
      return await readReport(existing.id);
    } catch {
      cache.delete(key);
    }
  }
  const pending = inFlight.get(key);
  if (pending) return pending;
  if (inFlight.size >= 2)
    throw new AppError('Two analyses are already running. Please try again shortly.', 429, 30);
  const job = (async () => {
    const report = await analyzeRepository(input);
    // Vercel functions cap response payloads. Fail clearly instead of returning a
    // transport error or silently deleting evidence from a large report.
    if (process.env.VERCEL === '1' && Buffer.byteLength(JSON.stringify(report)) > 3_000_000) {
      throw new AppError(
        'This report is too large for the hosted response limit. Choose a smaller analysis window.',
        413,
      );
    }
    try {
      await saveReport(report);
    } catch (error) {
      throw storageError(error);
    }
    for (const [k, v] of cache) if (v.expires < Date.now()) cache.delete(k);
    cache.set(key, { id: report.id, expires: Date.now() + 15 * 60000 });
    return report;
  })();
  inFlight.set(key, job);
  try {
    return await job;
  } finally {
    inFlight.delete(key);
  }
}
