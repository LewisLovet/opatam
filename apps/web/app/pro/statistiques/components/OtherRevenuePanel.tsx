'use client';

/**
 * "Autres revenus" panel — surfaces the paid-activity revenue track
 * (workshops, off-platform consultations, etc.) on the stats page.
 *
 * Tracked separately from the booking-revenue KPI so the pro can
 * see at a glance what comes from the platform vs. what they
 * earn in parallel. The sum is also surfaced inside the KpiBar
 * as a "+ X € hors RDV" caption when non-zero, but the breakdown
 * by category lives here.
 *
 * Renders nothing when there's no activity revenue on the period —
 * a "0 €" panel with empty bars would be visual noise. The KpiBar
 * line vanishes too in that case.
 */

import {
  formatPrice,
  type ActivityCategory,
  type ProviderStatsActivityBreakdown,
} from '@booking-app/shared';

/** Display label per category — keep in sync with the mobile copy
 *  in apps/mobile/components/business/Activity/categoryMeta.ts. */
const CATEGORY_LABEL: Record<ActivityCategory, string> = {
  sport: 'Sport',
  meeting: 'Meeting',
  personal: 'Perso',
  admin: 'Admin',
  travel: 'Trajet',
  imprevu: 'Imprévu',
  other: 'Autre',
};

/** Brand colour per category — same hex set as the mobile palette. */
const CATEGORY_COLOR: Record<ActivityCategory, string> = {
  sport: '#f97316',
  meeting: '#8b5cf6',
  personal: '#ec4899',
  admin: '#facc15',
  travel: '#06b6d4',
  imprevu: '#ef4444',
  other: '#6b7280',
};

interface Props {
  data: ProviderStatsActivityBreakdown[];
  /** Total — passed in (already summed across the period) so we
   *  don't have to recompute and the figure stays consistent with
   *  whatever the parent shows in the KPI bar. */
  total: number;
  count: number;
}

export function OtherRevenuePanel({ data, total, count }: Props) {
  if (total === 0 || data.length === 0) return null;
  const max = Math.max(...data.map((d) => d.revenue), 1);

  return (
    <section className="rounded-xl bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 p-4 sm:p-5">
      <header className="mb-4 flex items-baseline justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold text-gray-900 dark:text-white">
            Autres revenus
          </h2>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
            Activités hors RDV — workshops, consultations, etc.
          </p>
        </div>
        <div className="text-right flex-shrink-0">
          <div className="text-lg font-semibold text-gray-900 dark:text-white">
            {formatPrice(total)}
          </div>
          <div className="text-xs text-gray-500 dark:text-gray-400">
            {count} activité{count > 1 ? 's' : ''}
          </div>
        </div>
      </header>

      <ul className="space-y-3">
        {data.map((c) => (
          <li key={c.category} className="space-y-1.5">
            <div className="flex items-center justify-between gap-3 text-sm">
              <span className="flex items-center gap-2 min-w-0">
                {/* Tiny coloured dot — same brand colour the mobile
                    calendar uses for this category, so the visual
                    language carries over. */}
                <span
                  className="w-2 h-2 rounded-full flex-shrink-0"
                  style={{ backgroundColor: CATEGORY_COLOR[c.category] }}
                />
                <span className="font-medium text-gray-900 dark:text-white truncate">
                  {CATEGORY_LABEL[c.category]}
                </span>
              </span>
              <span className="flex items-baseline gap-2 flex-shrink-0">
                <span className="text-xs text-gray-500 dark:text-gray-400">
                  {c.count}
                </span>
                <span className="font-semibold text-gray-900 dark:text-white">
                  {formatPrice(c.revenue)}
                </span>
              </span>
            </div>
            <div className="h-1.5 rounded-full bg-gray-100 dark:bg-gray-700 overflow-hidden">
              <div
                className="h-full rounded-full"
                style={{
                  width: `${(c.revenue / max) * 100}%`,
                  backgroundColor: CATEGORY_COLOR[c.category],
                }}
              />
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}
