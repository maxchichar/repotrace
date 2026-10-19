import { z } from 'zod';
export class AppError extends Error {
  constructor(
    message: string,
    public status = 400,
    public retryAfter?: number,
  ) {
    super(message);
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
    since: z.iso.datetime(),
    until: z.iso.datetime(),
  })
  .strict()
  .superRefine((v, ctx) => {
    const start = Date.parse(v.since),
      end = Date.parse(v.until);
    if (start >= end)
      ctx.addIssue({ code: 'custom', message: 'Start must be before end.', path: ['since'] });
    if (end - start > 366 * 86400000)
      ctx.addIssue({
        code: 'custom',
        message: 'Choose a window of 366 days or fewer.',
        path: ['until'],
      });
    if (end > Date.now() + 86400000)
      ctx.addIssue({
        code: 'custom',
        message: 'The end date cannot be in the future.',
        path: ['until'],
      });
  });
export const reportId = z.uuid();
