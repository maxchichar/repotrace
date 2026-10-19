import { afterEach, describe, it, expect, vi } from 'vitest';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { buildAnalysis } from '../src/lib/attribution';
import { validateInsights, evidencePacket, generateInsights } from '../src/lib/ai';
import { csvCell, reportCSV } from '../src/lib/export';
import { readReport, saveReport } from '../src/lib/store';
import { guardRequest, readBody } from '../src/lib/security';
import { commit, pr, repo, scope } from './fixtures';
const report = () =>
  buildAnalysis({
    id: randomUUID(),
    repo,
    scope,
    commits: [commit('a')],
    prs: [pr(1)],
    warnings: [],
    complete: true,
    requests: 1,
  });
const estimate = {
  contributorId: 'gh:1',
  summary: 'Observed parser changes',
  impact: 'moderate',
  confidence: 'low',
  rationale: 'Limited observed changes',
  limitations: 'Cannot infer quality or ownership',
  evidenceIds: ['commit:a'],
};
afterEach(() => vi.unstubAllEnvs());
describe('AI evidence boundary', () => {
  it('accepts only known contributor-specific citations', () => {
    expect(validateInsights({ estimates: [estimate] }, report())).toHaveLength(1);
    expect(() =>
      validateInsights({ estimates: [{ ...estimate, evidenceIds: ['invented'] }] }, report()),
    ).toThrow('unsupported');
    expect(() =>
      validateInsights({ estimates: [{ ...estimate, contributorId: 'invented' }] }, report()),
    ).toThrow();
    expect(() =>
      validateInsights({ estimates: [{ ...estimate, confidence: 'certain' }] }, report()),
    ).toThrow();
    expect(() => validateInsights({ estimates: [estimate, estimate] }, report())).toThrow();
  });
  it('does not include raw emails or patches in model packet', () => {
    const packet = JSON.stringify(evidencePacket(report()));
    expect(packet).not.toContain('example.test');
    expect(packet).not.toContain('@@ patch');
  });
  it('does not call provider when credentials are absent', async () => {
    vi.stubEnv('GROQ_API_KEY', '');
    const fetcher = vi.fn();
    await expect(generateInsights(report(), fetcher)).rejects.toMatchObject({ status: 503 });
    expect(fetcher).not.toHaveBeenCalled();
  });
  it('uses a fixed HTTPS host and validates provider response', async () => {
    vi.stubEnv('GROQ_API_KEY', 'test-only');
    vi.stubEnv('GROQ_MODEL', '');
    const fetcher = vi.fn(
      async () =>
        new Response(
          JSON.stringify({
            choices: [{ message: { content: JSON.stringify({ estimates: [estimate] }) } }],
          }),
          { headers: { 'content-type': 'application/json' } },
        ),
    );
    expect((await generateInsights(report(), fetcher)).estimates).toHaveLength(1);
    expect(fetcher).toHaveBeenCalledWith(
      'https://api.groq.com/openai/v1/chat/completions',
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({ Authorization: 'Bearer test-only' }),
      }),
    );
    const [, options] = (fetcher.mock.calls as unknown as [string, RequestInit][])[0];
    const body = JSON.parse(options.body as string);
    expect(body.model).toBe('openai/gpt-oss-20b');
    expect(body.response_format).toEqual({ type: 'json_object' });
    expect(body.max_completion_tokens).toBe(5000);
  });
  it('honors the Groq model override and surfaces rate limits without saving estimates', async () => {
    vi.stubEnv('GROQ_API_KEY', 'test-only');
    vi.stubEnv('GROQ_MODEL', 'qwen/qwen3.8-27b');
    const fetcher = vi.fn(async (_url: string | URL | Request, options?: RequestInit) => {
      expect(JSON.parse(options?.body as string).model).toBe('qwen/qwen3.8-27b');
      return new Response('{}', { status: 429 });
    });
    await expect(generateInsights(report(), fetcher)).rejects.toMatchObject({ status: 429 });
  });
});
describe('share store and exports', () => {
  it('round-trips a report and enforces expiration and UUID paths', async () => {
    const dir = await mkdtemp(path.join(tmpdir(), 'repotrace-test-'));
    vi.stubEnv('REPORT_DIR', dir);
    try {
      const r = report();
      await saveReport(r);
      expect(await readReport(r.id)).toEqual(r);
      await expect(readReport('../../etc/passwd')).rejects.toMatchObject({ status: 404 });
      r.expiresAt = '2020-01-01T00:00:00Z';
      await saveReport(r);
      await expect(readReport(r.id)).rejects.toMatchObject({ status: 404 });
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });
  it('escapes CSV formulas and quotes, exports evidence and scope', () => {
    expect(csvCell('=SUM(1,1)')).toBe('"\'=SUM(1,1)"');
    expect(csvCell('"quoted"')).toBe('"""quoted"""');
    expect(csvCell(' @SUM()')).toContain("'");
    const csv = reportCSV(report());
    expect(csv).toContain('Commit %');
    expect(csv).toContain(repo.url + '/commit/a');
    expect(csv).toContain(scope.since);
  });
});
describe('request abuse boundaries', () => {
  it('rejects cross-origin and oversized bodies', async () => {
    expect(() =>
      guardRequest(
        new Request('https://repotrace.test/api/analyses', {
          headers: { origin: 'https://evil.test' },
        }),
        'analysis',
      ),
    ).toThrow('Cross-origin');
    await expect(
      readBody(
        new Request('https://repotrace.test', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: 'a'.repeat(5000),
        }),
      ),
    ).rejects.toMatchObject({ status: 413 });
  });
  it('accepts same-origin requests behind a host-preserving reverse proxy', () => {
    expect(() =>
      guardRequest(
        new Request('http://0.0.0.0:3000/api/analyses', {
          headers: { host: '127.0.0.1:3000', origin: 'http://127.0.0.1:3000' },
        }),
        'analysis',
      ),
    ).not.toThrow();
  });
  it('parses only valid bounded JSON', async () => {
    await expect(
      readBody(
        new Request('https://repotrace.test', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: 'invalid',
        }),
      ),
    ).rejects.toMatchObject({ status: 400 });
  });
});
