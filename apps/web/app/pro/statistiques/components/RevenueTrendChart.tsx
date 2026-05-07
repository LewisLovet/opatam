'use client';

import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { formatPrice } from '@booking-app/shared';
import type { TrendPoint } from '../lib/aggregate';
import { useTheme } from '@/hooks/useTheme';

interface Props {
  data: TrendPoint[];
  title?: string;
}

export function RevenueTrendChart({ data, title }: Props) {
  const { resolvedTheme } = useTheme();
  const isDark = resolvedTheme === 'dark';

  // Tweak so an all-zero dataset still shows the X axis nicely.
  const hasData = data.some((p) => p.revenue > 0);

  return (
    <section className="rounded-xl bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 p-4 sm:p-5">
      <header className="mb-4">
        <h2 className="text-base font-semibold text-gray-900 dark:text-white">
          {title ?? 'Évolution du chiffre d\'affaires'}
        </h2>
      </header>
      <div className="h-56 sm:h-72">
        {!hasData ? (
          <EmptyChart />
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data} margin={{ top: 8, right: 8, left: -8, bottom: 0 }}>
              <CartesianGrid
                strokeDasharray="3 3"
                stroke={isDark ? '#374151' : '#e5e7eb'}
                vertical={false}
              />
              <XAxis
                dataKey="label"
                tick={{ fontSize: 11, fill: isDark ? '#9ca3af' : '#6b7280' }}
                tickLine={false}
                axisLine={false}
                interval="preserveStartEnd"
                minTickGap={20}
              />
              <YAxis
                tick={{ fontSize: 11, fill: isDark ? '#9ca3af' : '#6b7280' }}
                tickLine={false}
                axisLine={false}
                tickFormatter={(v: number) => (v >= 100000 ? `${Math.round(v / 100000)} k€` : v >= 10000 ? `${(v / 100).toFixed(0)} €` : `${(v / 100).toFixed(0)}€`)}
                width={56}
              />
              <Tooltip
                cursor={{ fill: isDark ? 'rgba(124, 58, 237, 0.08)' : 'rgba(124, 58, 237, 0.05)' }}
                contentStyle={{
                  background: isDark ? '#1f2937' : '#fff',
                  border: `1px solid ${isDark ? '#374151' : '#e5e7eb'}`,
                  borderRadius: 8,
                  fontSize: 12,
                }}
                formatter={(value, name) => {
                  const v = typeof value === 'number' ? value : Number(value);
                  if (name === 'revenue') return [formatPrice(v), 'CA'] as const;
                  return [v, String(name)] as const;
                }}
                labelStyle={{
                  color: isDark ? '#e5e7eb' : '#111827',
                  fontWeight: 600,
                }}
              />
              <Bar
                dataKey="revenue"
                fill="var(--color-primary-500, #8b5cf6)"
                radius={[4, 4, 0, 0]}
                maxBarSize={32}
              />
            </BarChart>
          </ResponsiveContainer>
        )}
      </div>
    </section>
  );
}

function EmptyChart() {
  return (
    <div className="h-full flex items-center justify-center text-sm text-gray-400 dark:text-gray-500">
      Aucune donnée sur la période sélectionnée
    </div>
  );
}
