'use client';

import { ArrowDownRight, ArrowUpRight, Eye, Euro, Users, Calendar } from 'lucide-react';
import { formatPrice } from '@booking-app/shared';
import { deltaPercent, PERIOD_LABELS, type Period } from '../lib/period';

interface Props {
  period: Period;
  revenue: { current: number; previous: number };
  bookings: { current: number; previous: number };
  uniqueClients: { current: number; previous: number };
  pageViews: { current: number; previous: number };
}

export function KpiBar({ period, revenue, bookings, uniqueClients, pageViews }: Props) {
  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
      <KpiCard
        icon={<Euro className="w-5 h-5" />}
        label="CA réalisé"
        value={formatPrice(revenue.current)}
        delta={deltaPercent(revenue.current, revenue.previous)}
        period={period}
        tone="primary"
      />
      <KpiCard
        icon={<Calendar className="w-5 h-5" />}
        label="Réservations"
        value={bookings.current.toString()}
        delta={deltaPercent(bookings.current, bookings.previous)}
        period={period}
      />
      <KpiCard
        icon={<Users className="w-5 h-5" />}
        label="Clients uniques"
        value={uniqueClients.current.toString()}
        delta={deltaPercent(uniqueClients.current, uniqueClients.previous)}
        period={period}
      />
      <KpiCard
        icon={<Eye className="w-5 h-5" />}
        label="Vues vitrine"
        value={pageViews.current.toLocaleString('fr-FR')}
        delta={deltaPercent(pageViews.current, pageViews.previous)}
        period={period}
      />
    </div>
  );
}

interface KpiCardProps {
  icon: React.ReactNode;
  label: string;
  value: string;
  delta: number | null;
  period: Period;
  tone?: 'default' | 'primary';
}

function KpiCard({ icon, label, value, delta, period, tone = 'default' }: KpiCardProps) {
  const positive = delta !== null && delta > 0;
  const negative = delta !== null && delta < 0;
  const iconBg =
    tone === 'primary'
      ? 'bg-primary-100 dark:bg-primary-900/30 text-primary-600 dark:text-primary-400'
      : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400';

  return (
    <div className="rounded-xl bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 p-4 sm:p-5">
      <div className="flex items-center gap-3">
        <div className={`p-2.5 rounded-xl ${iconBg}`}>{icon}</div>
        <div className="min-w-0">
          <p className="text-xs sm:text-sm text-gray-500 dark:text-gray-400">{label}</p>
          <p className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-white truncate">
            {value}
          </p>
        </div>
      </div>
      <div className="mt-3 flex items-center gap-1.5 text-xs">
        {delta === null ? (
          <span className="text-gray-400 dark:text-gray-500">—</span>
        ) : (
          <span
            className={`inline-flex items-center gap-0.5 font-medium ${
              positive
                ? 'text-emerald-600 dark:text-emerald-400'
                : negative
                  ? 'text-red-600 dark:text-red-400'
                  : 'text-gray-500 dark:text-gray-400'
            }`}
          >
            {positive && <ArrowUpRight className="w-3 h-3" />}
            {negative && <ArrowDownRight className="w-3 h-3" />}
            {delta > 0 ? '+' : ''}
            {delta}%
          </span>
        )}
        <span className="text-gray-400 dark:text-gray-500">
          vs {PERIOD_LABELS[period]} précédents
        </span>
      </div>
    </div>
  );
}
