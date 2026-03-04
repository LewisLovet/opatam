'use client';

import { TrendingUp, TrendingDown } from 'lucide-react';

interface AdminStatCardProps {
  label: string;
  value: string | number;
  icon: React.ReactNode;
  trend?: {
    value: number;
    label: string;
  };
  format?: 'number' | 'currency' | 'percentage';
}

export function AdminStatCard({ label, value, icon, trend, format }: AdminStatCardProps) {
  const formattedValue = (() => {
    if (format === 'currency') {
      return `${(Number(value) / 100).toFixed(0)} \u20ac`;
    }
    if (format === 'percentage') {
      return `${value}%`;
    }
    return value;
  })();

  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl p-5 shadow-sm border border-gray-100 dark:border-gray-700">
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <p className="text-sm text-gray-500 dark:text-gray-400">{label}</p>
          <p className="text-2xl font-bold text-gray-900 dark:text-white mt-1">{formattedValue}</p>

          {trend && (
            <div className="flex items-center gap-1 mt-2">
              {trend.value >= 0 ? (
                <TrendingUp className="w-3.5 h-3.5 text-emerald-500" />
              ) : (
                <TrendingDown className="w-3.5 h-3.5 text-red-500" />
              )}
              <span
                className={`text-xs font-medium ${
                  trend.value >= 0 ? 'text-emerald-500' : 'text-red-500'
                }`}
              >
                {trend.value >= 0 ? '+' : ''}
                {trend.value}
              </span>
              <span className="text-xs text-gray-400">{trend.label}</span>
            </div>
          )}
        </div>

        <div className="w-10 h-10 rounded-lg bg-red-50 dark:bg-red-900/20 flex items-center justify-center flex-shrink-0">
          {icon}
        </div>
      </div>
    </div>
  );
}
