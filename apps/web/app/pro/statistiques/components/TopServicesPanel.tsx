'use client';

import { formatPrice, type ProviderStatsServiceBreakdown } from '@booking-app/shared';

interface Props {
  data: ProviderStatsServiceBreakdown[];
}

export function TopServicesPanel({ data }: Props) {
  const max = Math.max(...data.map((s) => s.revenue), 1);

  return (
    <section className="rounded-xl bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 p-4 sm:p-5">
      <header className="mb-4">
        <h2 className="text-base font-semibold text-gray-900 dark:text-white">
          Top prestations
        </h2>
        <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
          Triées par CA
        </p>
      </header>
      {data.length === 0 ? (
        <Empty />
      ) : (
        <ul className="space-y-3">
          {data.slice(0, 5).map((s, i) => (
            <li key={s.serviceId} className="space-y-1.5">
              <div className="flex items-center justify-between gap-3 text-sm">
                <span className="flex items-center gap-2 min-w-0">
                  <span className="text-xs font-mono text-gray-400 dark:text-gray-500 w-4">
                    {i + 1}
                  </span>
                  <span className="font-medium text-gray-900 dark:text-white truncate">
                    {s.serviceName}
                  </span>
                </span>
                <span className="flex items-baseline gap-2 flex-shrink-0">
                  <span className="text-xs text-gray-500 dark:text-gray-400">
                    {s.confirmedCount} RDV
                  </span>
                  <span className="font-semibold text-gray-900 dark:text-white">
                    {formatPrice(s.revenue)}
                  </span>
                </span>
              </div>
              <div className="h-1.5 rounded-full bg-gray-100 dark:bg-gray-700 overflow-hidden">
                <div
                  className="h-full bg-primary-500 rounded-full"
                  style={{ width: `${(s.revenue / max) * 100}%` }}
                />
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function Empty() {
  return (
    <p className="text-sm text-gray-400 dark:text-gray-500">
      Aucune prestation sur la période.
    </p>
  );
}
