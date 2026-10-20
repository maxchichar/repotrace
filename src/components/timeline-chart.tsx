'use client';
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import type { Contributor, Metric, Scope } from '@/lib/types';
import { activitySeries } from '@/lib/measurements';
import { number } from '@/lib/utils';
export function TimelineChart({
  contributors,
  metric,
  scope,
}: {
  contributors: Contributor[];
  metric: Metric;
  scope: Scope;
}) {
  const data = activitySeries(contributors, metric, scope);
  const resolution = data[0]?.resolution ?? 'day';
  if (!data.length) return <div className="chart-empty">No activity in this window.</div>;
  return (
    <div
      className="h-64 w-full min-w-0 overflow-hidden"
      role="img"
      aria-label={`Activity by ${resolution}: ${metric === 'churn' ? 'changed lines' : metric}. Exact values in the activity data table below.`}
    >
      <ResponsiveContainer width="100%" height="100%" minWidth={0}>
        <AreaChart
          data={data}
          margin={{ top: 12, right: 12, bottom: 4, left: -15 }}
          accessibilityLayer
        >
          <defs>
            <linearGradient id="activity-fill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="var(--accent)" stopOpacity={0.22} />
              <stop offset="100%" stopColor="var(--accent)" stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid vertical={false} stroke="var(--border-default)" />
          <XAxis
            dataKey="date"
            tickFormatter={(s) => (resolution === 'day' ? String(s).slice(5) : String(s))}
            tick={{ fontSize: 11, fill: 'var(--fg-muted)' }}
            tickLine={false}
            axisLine={false}
            minTickGap={35}
          />
          <YAxis
            tick={{ fontSize: 11, fill: 'var(--fg-muted)' }}
            tickFormatter={number}
            tickLine={false}
            axisLine={false}
          />
          <Tooltip
            contentStyle={{
              borderRadius: 6,
              border: '1px solid var(--border-default)',
              backgroundColor: 'var(--surface)',
              color: 'var(--fg-default)',
              fontSize: 12,
            }}
            formatter={(value) => [
              number(Number(value)),
              metric === 'churn'
                ? 'Changed lines'
                : metric === 'prs'
                  ? 'Merged PRs'
                  : 'Commit units',
            ]}
          />
          <Area
            dataKey="value"
            type="stepAfter"
            stroke="var(--accent)"
            strokeWidth={2}
            fill="url(#activity-fill)"
            isAnimationActive={false}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
