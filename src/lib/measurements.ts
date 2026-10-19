import type { Analysis, Metric } from './types';
export function measuredRows(report: Analysis, metric: Metric, includeBots = true) {
  const people = report.contributors.filter((p) => includeBots || !p.bot);
  const denominator = people.reduce((sum, p) => sum + p[metric], 0);
  return people
    .map((p) => ({
      ...p,
      value: p[metric],
      percentage: denominator ? (p[metric] / denominator) * 100 : 0,
    }))
    .sort((a, b) => b.value - a.value);
}

// Include quiet days so charts never interpolate sustained activity between distant commits.
export function dailySeries(
  people: import('./types').Contributor[],
  metric: Metric,
  scope: import('./types').Scope,
) {
  const values = new Map<string, number>();
  for (const p of people)
    for (const d of p.timeline) values.set(d.date, (values.get(d.date) ?? 0) + d[metric]);
  const start = Date.parse(scope.since.slice(0, 10) + 'T00:00:00Z');
  const end = Date.parse(scope.until.slice(0, 10) + 'T00:00:00Z');
  const data: { date: string; value: number }[] = [];
  for (let time = start; time <= end && data.length < 367; time += 86400000) {
    const date = new Date(time).toISOString().slice(0, 10);
    data.push({ date, value: values.get(date) ?? 0 });
  }
  return data;
}
