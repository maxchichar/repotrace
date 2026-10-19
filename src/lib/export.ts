import type { Analysis } from './types';
import { measuredRows } from './measurements';
export function csvCell(value: unknown) {
  let text = String(value ?? '');
  if (/^[\s]*[=+@\-\t\r]/.test(text)) text = "'" + text;
  return '"' + text.replaceAll('"', '""') + '"';
}
export function reportCSV(report: Analysis) {
  const commits = new Map(measuredRows(report, 'commits').map((p) => [p.id, p.percentage]));
  const churn = new Map(measuredRows(report, 'churn').map((p) => [p.id, p.percentage]));
  const prs = new Map(measuredRows(report, 'prs').map((p) => [p.id, p.percentage]));
  const rows: unknown[][] = [
    [
      'Repository',
      'Branch',
      'Head',
      'Since UTC',
      'Until UTC',
      'Traversal complete',
      'Contributor ID',
      'Name',
      'Identity',
      'Bot',
      'Commit units',
      'Commit %',
      'Eligible changed lines',
      'Code-change %',
      'Merged PRs',
      'PR %',
      'Evidence URLs',
      'Warnings',
    ],
  ];
  for (const p of report.contributors)
    rows.push([
      report.repo.fullName,
      report.repo.branch,
      report.repo.head,
      report.scope.since,
      report.scope.until,
      report.traversalComplete,
      p.id,
      p.name,
      p.identity,
      p.bot,
      p.commits,
      commits.get(p.id),
      p.churn,
      churn.get(p.id),
      p.prs,
      prs.get(p.id),
      report.evidence
        .filter((e) => p.evidenceIds.includes(e.id))
        .map((e) => e.url)
        .join(' '),
      report.warnings.join(' | '),
    ]);
  return rows.map((row) => row.map(csvCell).join(',')).join('\r\n');
}
