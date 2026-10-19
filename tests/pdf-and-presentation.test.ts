import { describe, expect, it } from 'vitest';
import { reportPDF } from '../src/lib/pdf';
import { buildAnalysis } from '../src/lib/attribution';
import { githubAvatar, withoutEmDash } from '../src/lib/presentation';
import { commit, repo, scope } from './fixtures';

const build = () =>
  buildAnalysis({
    id: 'bde9ad0d-4d7d-496f-8da7-b8ea99366df8',
    repo,
    scope,
    commits: [commit('first')],
    prs: [],
    warnings: ['Some history is missing.'],
    complete: false,
    requests: 2,
  });

describe('report PDF', () => {
  it('creates a paginated PDF with embedded fonts without changing retained measurements', async () => {
    const report = build();
    report.contributors[0].name = 'Zoë García';
    report.insights = {
      model: 'test-only',
      generatedAt: report.createdAt,
      estimates: [
        {
          contributorId: report.contributors[0].id,
          summary: 'Parser changes — stated intent.',
          rationale: 'One observed commit.',
          limitations: 'Partial history.',
          confidence: 'low',
          impact: 'moderate',
          evidenceIds: report.contributors[0].evidenceIds,
        },
      ],
    };
    const snapshot = structuredClone(report);
    const pdf = await reportPDF(report);
    expect(pdf.subarray(0, 8).toString()).toBe('%PDF-1.3');
    expect(pdf.toString('latin1')).toContain('(RepoTrace: owner/project)');
    expect(pdf.toString('latin1')).toContain('/FontFile2');
    expect(pdf.toString('latin1').match(/\/Type \/Page\b/g)?.length).toBeGreaterThanOrEqual(3);
    expect(pdf.subarray(-20).toString()).toContain('%%EOF');
    expect(report).toEqual(snapshot);
  });
  it('exports an empty report without invented activity', async () => {
    const report = build();
    report.contributors = [];
    report.evidence = [];
    expect((await reportPDF(report)).subarray(0, 5).toString()).toBe('%PDF-');
  });
});

describe('contributor presentation', () => {
  it('uses only a verified numeric GitHub account, including saved reports', () => {
    expect(githubAvatar({ id: 'gh:1234', identity: 'github-account' })).toBe(
      'https://avatars.githubusercontent.com/u/1234?s=96',
    );
    expect(githubAvatar({ id: 'gh:1234', identity: 'unresolved' })).toBeUndefined();
    expect(githubAvatar({ id: 'unresolved:alice', identity: 'unresolved' })).toBeUndefined();
    expect(githubAvatar({ id: 'gh:../../other', identity: 'github-account' })).toBeUndefined();
  });
  it('removes em dashes from presentation without changing evidence identifiers', () => {
    expect(withoutEmDash('Observed work — uncertain impact')).toBe(
      'Observed work, uncertain impact',
    );
    expect(withoutEmDash('commit:abc123')).toBe('commit:abc123');
  });
});
