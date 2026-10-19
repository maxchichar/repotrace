import { describe, it, expect } from 'vitest';
import { runAnalysis } from '../src/lib/service';

describe.skipIf(process.env.LIVE_GITHUB !== '1')(
  'reported public repository regression (live GitHub)',
  () => {
    it('analyzes the repository and dates from the reported failure', async () => {
      try {
        const report = await runAnalysis({
          url: 'https://github.com/hmaach/01edu-tests',
          since: '2025-05-07T00:00:00.000Z',
          until: '2026-02-05T23:59:59.999Z',
        });
        expect(report.repo.fullName.toLowerCase()).toBe('hmaach/01edu-tests');
        expect(report.evidence.length).toBeGreaterThan(0);
        console.log(
          JSON.stringify({
            id: report.id,
            contributors: report.contributors.length,
            evidence: report.evidence.length,
            complete: report.traversalComplete,
          }),
        );
      } catch (error) {
        let current: unknown = error;
        const causes = [];
        for (let depth = 0; depth < 4 && current && typeof current === 'object'; depth++) {
          const e = current as { name?: string; code?: string; stack?: string; cause?: unknown };
          causes.push({
            name: e.name,
            code: e.code,
            frames: e.stack
              ?.split('\n')
              .filter((l) => l.trim().startsWith('at '))
              .slice(0, 5),
          });
          current = e.cause;
        }
        console.error(JSON.stringify({ diagnostic: causes }));
        throw new Error('Live analysis failed; inspect the safe diagnostic frames above.');
      }
    }, 120000);
  },
);
