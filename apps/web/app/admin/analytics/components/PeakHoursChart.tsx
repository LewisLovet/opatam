'use client';

import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
} from 'recharts';

interface HourData {
  hour: number;
  count: number;
}

interface PeakHoursChartProps {
  data: HourData[];
}

export function PeakHoursChart({ data }: PeakHoursChartProps) {
  const formatted = data.map((d) => ({
    ...d,
    label: `${d.hour}h`,
  }));

  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl p-5 shadow-sm border border-gray-100 dark:border-gray-700">
      <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-4">
        Heures de pointe (90 derniers jours)
      </h3>
      <div className="h-64">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={formatted}>
            <CartesianGrid strokeDasharray="3 3" stroke="#374151" opacity={0.2} />
            <XAxis
              dataKey="label"
              tick={{ fontSize: 10, fill: '#9CA3AF' }}
              interval={1}
            />
            <YAxis tick={{ fontSize: 11, fill: '#9CA3AF' }} allowDecimals={false} />
            <Tooltip
              contentStyle={{
                backgroundColor: '#1F2937',
                border: 'none',
                borderRadius: '8px',
                color: '#F9FAFB',
                fontSize: '12px',
              }}
              labelStyle={{ color: '#9CA3AF' }}
              formatter={(value) => [value, 'Réservations']}
            />
            <Bar
              dataKey="count"
              fill="#EF4444"
              radius={[2, 2, 0, 0]}
              name="Réservations"
            />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
