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
import { dailySeries } from '@/lib/measurements';
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
  const data = dailySeries(contributors, metric, scope);
  if (!data.length) return <div className="chart-empty">No activity in this window.</div>;
  return (
    <div
      className="h-64 w-full min-w-0 overflow-hidden"
      role="img"
      aria-label={`Daily ${metric === 'churn' ? 'changed lines' : metric}. Exact values in the daily data table below.`}
    >
      <ResponsiveContainer width="100%" height="100%" minWidth={0}>
        <AreaChart
          data={data}
          margin={{ top: 12, right: 12, bottom: 4, left: -15 }}
          accessibilityLayer
        >
          <defs>
            <linearGradient id="activity-fill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#23846e" stopOpacity={0.22} />
              <stop offset="100%" stopColor="#23846e" stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid vertical={false} stroke="#eeece7" />
          <XAxis
            dataKey="date"
            tickFormatter={(s) => String(s).slice(5)}
            tick={{ fontSize: 11, fill: '#78716c' }}
            tickLine={false}
            axisLine={false}
            minTickGap={35}
          />
          <YAxis
            tick={{ fontSize: 11, fill: '#78716c' }}
            tickFormatter={number}
            tickLine={false}
            axisLine={false}
          />
          <Tooltip
            contentStyle={{ borderRadius: 10, border: '1px solid #e5e3dc', fontSize: 12 }}
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
            stroke="#237c64"
            strokeWidth={2}
            fill="url(#activity-fill)"
            isAnimationActive={false}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
