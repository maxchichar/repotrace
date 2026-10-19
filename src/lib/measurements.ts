import type { Analysis, Contributor, Metric, Scope } from './types';
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

// Every period is explicit, including zero-activity periods. Longer windows use
// calendar buckets rather than dropping everything after the first 367 days.
export function activitySeries(people: Contributor[], metric: Metric, scope: Scope) {
  const start = Date.parse(scope.since.slice(0, 10) + 'T00:00:00Z');
  const end = Date.parse(scope.until.slice(0, 10) + 'T00:00:00Z');
  if (!Number.isFinite(start) || !Number.isFinite(end) || start > end) return [];
  const days = (end - start) / 86400000 + 1;
  const startYear = new Date(start).getUTCFullYear(),
    endYear = new Date(end).getUTCFullYear();
  const resolution = days <= 366 ? 'day' : days <= 366 * 12 ? 'month' : 'year';
  const yearStep = Math.max(1, Math.ceil((endYear - startYear + 1) / 200));
  const key = (date: string) =>
    resolution === 'day'
      ? date.slice(0, 10)
      : resolution === 'month'
        ? date.slice(0, 7)
        : String(Math.floor(Number(date.slice(0, 4)) / yearStep) * yearStep).padStart(4, '0');
  const values = new Map<string, number>();
  for (const person of people)
    for (const point of person.timeline) {
      const time = Date.parse(point.date + 'T00:00:00Z');
      if (time < start || time > end) continue;
      const period = key(point.date);
      values.set(period, (values.get(period) ?? 0) + point[metric]);
    }
  const data: {
    date: string;
    label: string;
    value: number;
    resolution: 'day' | 'month' | 'year';
  }[] = [];
  const add = (date: string) => {
    const label =
      resolution === 'day'
        ? date
        : resolution === 'month'
          ? date
          : yearStep === 1
            ? date
            : `${date}–${Number(date) + yearStep - 1}`;
    data.push({ date, label, value: values.get(date) ?? 0, resolution });
  };
  if (resolution === 'day') {
    for (let time = start; time <= end; time += 86400000)
      add(new Date(time).toISOString().slice(0, 10));
  } else if (resolution === 'month') {
    let year = startYear,
      month = new Date(start).getUTCMonth();
    const last = new Date(end);
    const endMonth = last.getUTCMonth();
    while (year < endYear || (year === endYear && month <= endMonth)) {
      add(`${String(year).padStart(4, '0')}-${String(month + 1).padStart(2, '0')}`);
      if (++month === 12) {
        month = 0;
        year++;
      }
    }
  } else {
    for (let year = Math.floor(startYear / yearStep) * yearStep; year <= endYear; year += yearStep)
      add(String(year).padStart(4, '0'));
  }
  return data;
}
