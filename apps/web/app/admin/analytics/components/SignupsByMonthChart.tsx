'use client';

import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
} from 'recharts';

interface SignupMonth {
  month: string;
  clients: number;
  providers: number;
}

interface SignupsByMonthChartProps {
  data: SignupMonth[];
}

export function SignupsByMonthChart({ data }: SignupsByMonthChartProps) {
  const formatted = data.map((d) => {
    const [year, month] = d.month.split('-');
    const date = new Date(parseInt(year), parseInt(month) - 1);
    return {
      ...d,
      label: date.toLocaleDateString('fr-FR', { month: 'short', year: '2-digit' }),
    };
  });

  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl p-5 shadow-sm border border-gray-100 dark:border-gray-700">
      <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-4">
        Inscriptions par mois
      </h3>
      <div className="h-64">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={formatted}>
            <CartesianGrid strokeDasharray="3 3" stroke="#374151" opacity={0.2} />
            <XAxis
              dataKey="label"
              tick={{ fontSize: 11, fill: '#9CA3AF' }}
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
            />
            <Legend
              wrapperStyle={{ fontSize: '12px' }}
              formatter={(value) => (
                <span className="text-gray-500 dark:text-gray-400">{value}</span>
              )}
            />
            <Bar dataKey="clients" name="Clients" fill="#EF4444" radius={[2, 2, 0, 0]} stackId="a" />
            <Bar dataKey="providers" name="Prestataires" fill="#3B82F6" radius={[2, 2, 0, 0]} stackId="a" />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
