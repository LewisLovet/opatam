'use client';

import { PERIOD_LABELS, type Period } from '../lib/period';

interface Props {
  value: Period;
  onChange: (p: Period) => void;
}

const ORDER: Period[] = ['7d', '30d', '90d', '12m'];

export function PeriodPills({ value, onChange }: Props) {
  return (
    <div
      role="tablist"
      aria-label="Période"
      className="inline-flex p-1 rounded-lg bg-gray-100 dark:bg-gray-800 border border-gray-200 dark:border-gray-700"
    >
      {ORDER.map((p) => {
        const active = value === p;
        return (
          <button
            key={p}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => onChange(p)}
            className={`px-3 sm:px-4 py-1.5 text-sm font-medium rounded-md transition-all duration-150 ${
              active
                ? 'bg-white dark:bg-gray-700 text-gray-900 dark:text-white shadow-sm'
                : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200'
            }`}
          >
            {PERIOD_LABELS[p]}
          </button>
        );
      })}
    </div>
  );
}
