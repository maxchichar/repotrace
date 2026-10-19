import 'server-only';
import { storageError } from './db/errors';
import { assertHostedStorage } from './deployment';
import { mkdir, readFile, writeFile, rename, readdir, unlink } from 'node:fs/promises';
import path from 'node:path';
import { eq, lt, and, gt } from 'drizzle-orm';
import { database } from './db/client';
import { reports } from './db/schema';
import { randomUUID } from 'node:crypto';
import type { Analysis } from './types';
import { AppError, reportId } from './validation';
const directory = () =>
  path.resolve(/* turbopackIgnore: true */ process.env.REPORT_DIR || '.data/reports');
export async function saveReport(report: Analysis) {
  reportId.parse(report.id);
  assertHostedStorage();
  if (process.env.DATABASE_URL) {
    const db = database();
    await db.transaction(async (tx) => {
      await tx.delete(reports).where(lt(reports.expiresAt, new Date()));
      await tx
        .insert(reports)
        .values({
          id: report.id,
          payload: report,
          createdAt: new Date(report.createdAt),
          expiresAt: new Date(report.expiresAt),
        })
        .onConflictDoUpdate({
          target: reports.id,
          set: { payload: report, expiresAt: new Date(report.expiresAt) },
        });
    });
    return;
  }
  const dir = directory();
  await mkdir(dir, { recursive: true, mode: 0o700 });
  const entries = (await readdir(/* turbopackIgnore: true */ dir)).filter((f) =>
    f.endsWith('.json'),
  );
  if (entries.length >= 100) {
    // TTL is checked on reads; evict oldest persisted reports to bound storage.
    const records = await Promise.all(
      entries.map(async (f) => {
        try {
          const data = JSON.parse(
            await readFile(
              /* turbopackIgnore: true */ path.join(/* turbopackIgnore: true */ dir, f),
              'utf8',
            ),
          ) as Analysis;
          return { f, date: data.createdAt };
        } catch {
          return { f, date: '' };
        }
      }),
    );
    records.sort((a, b) => a.date.localeCompare(b.date));
    for (const item of records.slice(0, Math.max(1, entries.length - 99)))
      await unlink(
        /* turbopackIgnore: true */ path.join(/* turbopackIgnore: true */ dir, item.f),
      ).catch(() => {});
  }
  const temporary = path.join(dir, `${report.id}.${randomUUID()}.tmp`);
  await writeFile(temporary, JSON.stringify(report), { mode: 0o600 });
  await rename(temporary, path.join(dir, `${report.id}.json`));
}
export async function readReport(id: string): Promise<Analysis> {
  assertHostedStorage();
  if (!reportId.safeParse(id).success) throw new AppError('Report not found.', 404);
  if (process.env.DATABASE_URL) {
    try {
      const [row] = await database()
        .select({ payload: reports.payload })
        .from(reports)
        .where(and(eq(reports.id, id), gt(reports.expiresAt, new Date())))
        .limit(1);
      if (!row) throw new AppError('Report expired or was not found. Run a new analysis.', 404);
      return row.payload;
    } catch (error) {
      if (error instanceof AppError) throw error;
      throw storageError(error);
    }
  }
  try {
    const report = JSON.parse(
      await readFile(path.join(directory(), `${id}.json`), 'utf8'),
    ) as Analysis;
    if (Date.parse(report.expiresAt) <= Date.now()) throw new Error('expired');
    return report;
  } catch {
    throw new AppError('Report expired or was not found. Run a new analysis.', 404);
  }
}
