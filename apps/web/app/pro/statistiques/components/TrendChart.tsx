'use client';

import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { useTheme } from '@/hooks/useTheme';
import type { TrendPoint } from '@booking-app/shared';

export type ChartType = 'bar' | 'line';

interface Props {
  data: TrendPoint[];
  /** Section heading. */
  title: string;
  /** Optional sub-text under the title. */
  subtitle?: string;
  /** Which value of the TrendPoint to plot. */
  valueKey: 'revenue' | 'bookingsCount' | 'pageViews';
  /**
   * `bar` for short windows (the default for 7 days) — each
   * day reads as a discrete unit. `line` (smoothed area) for 30/90
   * days and 12 months — the trend matters more than per-bucket
   * absolute heights and the chart stays readable with many points.
   */
  chartType: ChartType;
  /** Tick formatter for the Y axis (e.g. format euros / counts). */
  yAxisFormatter: (v: number) => string;
  /** Tooltip body formatter — turns the raw value into the displayed string + label pair. */
  tooltipFormatter: (v: number) => [string, string];
}

function readTrendValue(p: TrendPoint, key: 'revenue' | 'bookingsCount' | 'pageViews'): number {
  if (key === 'revenue') return p.revenue;
  if (key === 'bookingsCount') return p.bookingsCount;
  return p.pageViews;
}

export function TrendChart({
  data,
  title,
  subtitle,
  valueKey,
  chartType,
  yAxisFormatter,
  tooltipFormatter,
}: Props) {
  const { resolvedTheme } = useTheme();
  const isDark = resolvedTheme === 'dark';
  const hasData = data.some((p) => (readTrendValue(p, valueKey) ?? 0) > 0);

  const grid = isDark ? '#374151' : '#e5e7eb';
  const tick = { fontSize: 11, fill: isDark ? '#9ca3af' : '#6b7280' };
  const tooltipStyle = {
    background: isDark ? '#1f2937' : '#fff',
    border: `1px solid ${isDark ? '#374151' : '#e5e7eb'}`,
    borderRadius: 8,
    fontSize: 12,
  };
  const labelStyle = {
    color: isDark ? '#e5e7eb' : '#111827',
    fontWeight: 600,
  };

  return (
    <section className="rounded-xl bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 p-4 sm:p-5">
      <header className="mb-4">
        <h2 className="text-base font-semibold text-gray-900 dark:text-white">
          {title}
        </h2>
        {subtitle && (
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
            {subtitle}
          </p>
        )}
      </header>
      <div className="h-56 sm:h-72">
        {!hasData ? (
          <div className="h-full flex items-center justify-center text-sm text-gray-400 dark:text-gray-500">
            Aucune donnée sur la période sélectionnée
          </div>
        ) : chartType === 'bar' ? (
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data} margin={{ top: 8, right: 8, left: -8, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke={grid} vertical={false} />
              <XAxis
                dataKey="label"
                tick={tick}
                tickLine={false}
                axisLine={false}
                interval="preserveStartEnd"
                minTickGap={20}
              />
              <YAxis
                tick={tick}
                tickLine={false}
                axisLine={false}
                tickFormatter={yAxisFormatter}
                width={56}
              />
              <Tooltip
                cursor={{ fill: 'rgba(124, 58, 237, 0.08)' }}
                contentStyle={tooltipStyle}
                labelStyle={labelStyle}
                formatter={(value) => {
                  const v = typeof value === 'number' ? value : Number(value);
                  return tooltipFormatter(v);
                }}
              />
              <Bar
                dataKey={valueKey}
                fill="var(--color-primary-500, #8b5cf6)"
                radius={[4, 4, 0, 0]}
                maxBarSize={32}
              />
            </BarChart>
          </ResponsiveContainer>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={data} margin={{ top: 8, right: 8, left: -8, bottom: 0 }}>
              <defs>
                <linearGradient id={`grad-${valueKey}`} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="var(--color-primary-500, #8b5cf6)" stopOpacity={0.35} />
                  <stop offset="100%" stopColor="var(--color-primary-500, #8b5cf6)" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke={grid} vertical={false} />
              <XAxis
                dataKey="label"
                tick={tick}
                tickLine={false}
                axisLine={false}
                interval="preserveStartEnd"
                minTickGap={32}
              />
              <YAxis
                tick={tick}
                tickLine={false}
                axisLine={false}
                tickFormatter={yAxisFormatter}
                width={56}
              />
              <Tooltip
                cursor={{ stroke: 'var(--color-primary-500, #8b5cf6)', strokeWidth: 1, strokeDasharray: '3 3' }}
                contentStyle={tooltipStyle}
                labelStyle={labelStyle}
                formatter={(value) => {
                  const v = typeof value === 'number' ? value : Number(value);
                  return tooltipFormatter(v);
                }}
              />
              <Area
                type="monotone"
                dataKey={valueKey}
                stroke="var(--color-primary-500, #8b5cf6)"
                strokeWidth={2}
                fill={`url(#grad-${valueKey})`}
                dot={false}
                activeDot={{ r: 4 }}
              />
            </AreaChart>
          </ResponsiveContainer>
        )}
      </div>
    </section>
  );
}
