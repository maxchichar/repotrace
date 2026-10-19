import 'server-only';
import PDFDocument from 'pdfkit';
import path from 'node:path';
import type { Analysis } from './types';
import { measuredRows } from './measurements';
import { withoutEmDash } from './presentation';
import { AppError } from './validation';

// No repository-controlled HTML, scripts, remote fonts, or images are executed.
// Evidence is rendered as text and GitHub links from the retained report.
export async function reportPDF(report: Analysis): Promise<Buffer> {
  const document = new PDFDocument({
    size: 'A4',
    margin: 48,
    font: path.join(process.cwd(), 'public/fonts/DejaVuSans.ttf'),
    info: {
      Title: `RepoTrace: ${report.repo.fullName}`,
      Author: 'RepoTrace',
      Subject: 'GitHub contribution evidence',
    },
  });
  const chunks: Buffer[] = [];
  let bytes = 0;
  const result = new Promise<Buffer>((resolve, reject) => {
    document.on('data', (chunk: Buffer) => {
      bytes += chunk.length;
      if (bytes > 4_000_000) {
        document.destroy(
          new AppError(
            'This PDF exceeds the hosted export size limit. Use CSV or JSON for detailed evidence.',
            413,
          ),
        );
        return;
      }
      chunks.push(chunk);
    });
    document.on('end', () => resolve(Buffer.concat(chunks)));
    document.on('error', reject);
  });
  const clean = (text: string) => withoutEmDash(text).replace(/[\x00-\x08\x0b\x0c\x0e-\x1f]/g, '');
  const text = (value: string, options: PDFKit.Mixins.TextOptions = {}) => {
    document
      .fontSize(9)
      .fillColor('#26352e')
      .text(clean(value), { lineGap: 3, ...options });
  };
  const heading = (value: string, size = 15) => {
    if (document.y > document.page.height - 110) document.addPage();
    document.moveDown(0.7).fontSize(size).fillColor('#1f684f').text(clean(value), { lineGap: 4 });
    document.moveDown(0.3);
  };
  const link = (label: string, url: string) => {
    // Historical reports may be retained across application upgrades.
    // Permit only original public GitHub evidence/profile links in the PDF.
    const safe = /^https:\/\/github\.com\/[^\s]+$/.test(url);
    text(`${label}: ${url}`, safe ? { link: url, underline: true } : {});
  };
  try {
    document.fontSize(10).fillColor('#65766b').text('REPOTRACE / CONTRIBUTION REPORT');
    heading(report.repo.fullName, 24);
    if (report.repo.description) text(report.repo.description);
    link('Repository', report.repo.url);
    heading('Analysis scope');
    text(`Branch: ${report.repo.branch} | Head: ${report.repo.head}`);
    text(
      `Range: ${report.scope.mode === 'all' ? 'All reachable history' : 'Custom dates'} | ${report.scope.since} to ${report.scope.until} (UTC)`,
    );
    if (report.scope.mode === 'all')
      text(
        'The starting date is the earliest observed evidence, not a claim that earlier history is absent.',
      );
    text(`Created: ${report.createdAt} | Algorithm: ${report.algorithm} | Report: ${report.id}`);
    text(
      `Traversal: ${report.traversalComplete ? 'Finished within configured collection bounds' : 'Incomplete; shares describe observed evidence'} | Upstream requests: ${report.requests}`,
    );
    text(
      'Commit units, changed lines and merged PRs are separate activity metrics. They are never added together and do not establish ownership, effort or actual technical impact. All contributors, including bots and unresolved identities, are included in this export.',
    );
    text('Percentages are rounded for display; each metric uses its own denominator.');
    if (!report.insights?.estimates.length)
      text('No AI-assisted estimates have been saved for this report.');
    heading('Completeness and attribution notes');
    for (const warning of report.warnings) text(`• ${warning}`);
    text(
      `Excluded merge commits: ${report.exclusions.mergeCommits}; generated paths: ${report.exclusions.generatedFiles}; excluded changed lines: ${report.exclusions.excludedChurn}; missing patches: ${report.exclusions.missingPatches}.`,
    );
    const shares = {
      commits: new Map(measuredRows(report, 'commits').map((p) => [p.id, p.percentage])),
      churn: new Map(measuredRows(report, 'churn').map((p) => [p.id, p.percentage])),
      prs: new Map(measuredRows(report, 'prs').map((p) => [p.id, p.percentage])),
    };
    document.addPage();
    heading('Measured contributions', 20);
    if (!report.contributors.length)
      text('No contributor activity was observed within the selected scope.');
    for (const person of report.contributors) {
      heading(person.name);
      text(`Identity: ${person.identity}${person.bot ? ' | Bot' : ''} | ${person.id}`);
      if (person.url) link('GitHub profile', person.url);
      const format = (metric: 'commits' | 'churn' | 'prs') =>
        `${person[metric].toLocaleString('en-US', { maximumFractionDigits: 2 })} (${(shares[metric].get(person.id) ?? 0).toFixed(1)}%)`;
      text(
        `Commit units: ${format('commits')} | Eligible changed lines: ${format('churn')} | Merged PRs: ${format('prs')}`,
      );
      text(
        `Observed work: ${person.files.length} eligible changed paths; ${person.evidenceIds.length} evidence references.`,
      );
      const dates = person.timeline.map((point) => point.date).sort();
      if (dates.length) text(`Observed activity: ${dates[0]} to ${dates.at(-1)} (UTC).`);
      if (person.files.length) {
        text('Most changed eligible paths (up to 10):');
        for (const file of person.files.slice(0, 10))
          text(`• ${file.path}: ${file.changes} changed lines`);
      }
      text(`Evidence sample: ${person.evidenceIds.slice(0, 10).join(', ') || 'None'}`);
      if (person.evidenceIds.length > 10)
        text(
          'Additional references appear in the complete evidence catalogue below and in the JSON export.',
        );
      const estimate = report.insights?.estimates.find((item) => item.contributorId === person.id);
      if (estimate) {
        heading('AI-assisted estimate, separate from measured activity', 11);
        text(`Potential impact: ${estimate.impact} | Confidence: ${estimate.confidence}`);
        text(estimate.summary);
        text(`Reasoning: ${estimate.rationale}`);
        text(`Uncertainty: ${estimate.limitations}`);
        text(
          `Citations: ${estimate.evidenceIds.join(', ')} | Model: ${report.insights!.model} | Generated: ${report.insights!.generatedAt}`,
        );
      }
    }
    document.addPage();
    heading('GitHub evidence references', 20);
    text(
      'Titles describe stated intent, not proof of a delivered feature. The PDF lists every retained evidence reference and up to 10 changed paths per contributor. Full file statistics and activity timelines remain available in the JSON export.',
    );
    if (!report.evidence.length) text('No evidence records were observed.');
    for (const evidence of report.evidence) {
      heading(`${evidence.kind === 'pr' ? 'Merged PR' : 'Commit'} | ${evidence.id}`, 11);
      text(evidence.title || 'Untitled evidence');
      text(`${evidence.date} | Contributors: ${evidence.actorIds.join(', ')}`);
      link('Source', evidence.url);
    }
    document.end();
  } catch (error) {
    document.destroy(error instanceof Error ? error : new Error('PDF generation failed.'));
  }
  return result;
}
