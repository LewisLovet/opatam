'use client';

import Link from 'next/link';
import { Trophy } from 'lucide-react';
import { formatPrice } from '@booking-app/shared';
import type { AdminOverview } from '@/services/admin/types';
import { Avatar, Panel, PanelTitle } from './primitives';

const RANGS = [
  'bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-400',
  'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300',
  'bg-orange-100 text-orange-700 dark:bg-orange-500/15 dark:text-orange-400',
];

/** Les prestataires qui font vivre la plateforme ce mois-ci. */
export function TopProsCard({ pros }: { pros: AdminOverview['topPros'] }) {
  const max = Math.max(1, ...pros.map((p) => p.bookings));
  return (
    <Panel>
      <PanelTitle icon={<Trophy className="h-4 w-4" />} accent="amber" title="Top pros du mois" />
      {pros.length === 0 ? (
        <p className="px-5 pb-5 text-sm text-gray-400">Aucune réservation ce mois-ci.</p>
      ) : (
        <ol className="space-y-1 px-3 pb-3">
          {pros.map((p, i) => (
            <li key={p.id}>
              <Link
                href={`/admin/providers/${p.id}`}
                className="flex items-center gap-3 rounded-xl px-2 py-2 transition-colors hover:bg-gray-50 dark:hover:bg-gray-700/30"
              >
                <span
                  className={`flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full text-[11px] font-bold ${
                    RANGS[i] ?? 'bg-gray-50 text-gray-400 dark:bg-gray-700/40'
                  }`}
                >
                  {i + 1}
                </span>
                <Avatar name={p.name} photoURL={p.photoURL} size={32} />
                <span className="min-w-0 flex-1">
                  <span className="flex items-baseline justify-between gap-2">
                    <span className="truncate text-sm font-semibold text-gray-900 dark:text-white">{p.name}</span>
                    <span className="flex-shrink-0 text-xs text-gray-500 dark:text-gray-400">
                      {Object.entries(p.revenue)
                        .filter(([, v]) => v > 0)
                        .map(([devise, v]) => formatPrice(v, devise))
                        .join(' · ')}
                    </span>
                  </span>
                  <span className="mt-1 flex items-center gap-2">
                    <span className="h-1.5 flex-1 overflow-hidden rounded-full bg-gray-100 dark:bg-gray-700">
                      <span
                        className="block h-full rounded-full bg-violet-500"
                        style={{ width: `${Math.round((p.bookings / max) * 100)}%` }}
                      />
                    </span>
                    <span className="w-16 flex-shrink-0 text-right text-[11px] text-gray-500 dark:text-gray-400">
                      {p.bookings} résa{p.bookings > 1 ? 's' : ''}
                    </span>
                  </span>
                </span>
              </Link>
            </li>
          ))}
        </ol>
      )}
    </Panel>
  );
}
