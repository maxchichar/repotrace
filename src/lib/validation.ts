import { z } from 'zod';
export class AppError extends Error {
  readonly code: string;
  constructor(
    message: string,
    public status = 400,
    public retryAfter?: number,
    options?: { code?: string; cause?: unknown },
  ) {
    super(message, options?.cause ? { cause: options.cause } : undefined);
    this.name = 'AppError';
    this.code = options?.code ?? 'REQUEST_FAILED';
  }
}
export function parseRepository(value: string) {
  let url: URL;
  try {
    url = new URL(value.trim());
  } catch {
    throw new AppError('Enter a full public GitHub repository URL.');
  }
  if (
    url.protocol !== 'https:' ||
    url.hostname !== 'github.com' ||
    url.port ||
    url.username ||
    url.password ||
    url.search ||
    url.hash
  )
    throw new AppError(
      'Use an HTTPS github.com repository URL without credentials, query parameters, or fragments.',
    );
  const parts = url.pathname.replace(/\/$/, '').split('/').filter(Boolean);
  const [owner, originalName] = parts;
  const name = originalName?.replace(/\.git$/, '');
  if (
    parts.length !== 2 ||
    !/^[a-z\d](?:[a-z\d-]{0,38})$/i.test(owner ?? '') ||
    !/^[a-z\d_.-]{1,100}$/i.test(name ?? '') ||
    name === '.' ||
    name === '..'
  )
    throw new AppError('Use a repository URL such as https://github.com/owner/repository.');
  return { owner, name };
}
export const inputSchema = z
  .object({
    url: z.string().min(1).max(250),
    branch: z
      .string()
      .trim()
      .max(200)
      .refine(
        (v) =>
          !v ||
          (!/[\s~^:?*\[\\]/.test(v) &&
            !v.includes('..') &&
            !v.includes('@{') &&
            !v.startsWith('-')),
        'Invalid branch name.',
      )
      .optional(),
    mode: z.enum(['custom', 'all']).default('custom'),
    since: z.iso.datetime().optional(),
    until: z.iso.datetime().optional(),
  })
  .strict()
  .superRefine((v, ctx) => {
    if (v.mode === 'custom') {
      if (!v.since)
        ctx.addIssue({
          code: 'custom',
          message: 'Choose a start date or select All history.',
          path: ['since'],
        });
      if (!v.until)
        ctx.addIssue({
          code: 'custom',
          message: 'Choose an end date or select All history.',
          path: ['until'],
        });
      if (v.since && v.until && Date.parse(v.since) >= Date.parse(v.until)) {
        ctx.addIssue({ code: 'custom', message: 'Start must be before end.', path: ['since'] });
      }
    }
    if (v.until && Date.parse(v.until) > Date.now() + 86400000) {
      ctx.addIssue({
        code: 'custom',
        message: 'The end date cannot be in the future.',
        path: ['until'],
      });
    }
  })
  .transform((v) => ({
    ...v,
    since: v.mode === 'all' ? '0001-01-01T00:00:00.000Z' : v.since!,
    until: v.until ?? new Date(new Date().setUTCHours(23, 59, 59, 999)).toISOString(),
  }));
export function parseAnalysisInput(body: unknown) {
  const result = inputSchema.safeParse(body);
  if (!result.success)
    throw new AppError(result.error.issues.map((i) => i.message).join(' '), 400, undefined, {
      code: 'INVALID_INPUT',
    });
  parseRepository(result.data.url);
  return result.data;
}
export const reportId = z.uuid();
