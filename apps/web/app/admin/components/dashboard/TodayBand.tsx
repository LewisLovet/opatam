'use client';

import Link from 'next/link';
import { Instagram } from 'lucide-react';
import type { AdminOverview, DashboardStats } from '@/services/admin/types';
import { Avatar, Panel, nombre } from './primitives';

/**
 * La journée en cours, d'un seul coup d'œil : qui est là, ce qui se réserve,
 * qui s'inscrit — et QUI publie des stories, pas seulement combien.
 */
export function TodayBand({ stats, overview }: { stats: DashboardStats; overview: AdminOverview | null }) {
  const actifs = stats.activeToday.total;
  const auteurs = stats.storiesTodayBy ?? [];
  const chiffres = [
    { label: 'Actifs', value: nombre(actifs.clients + actifs.prestataires), sub: `dont ${actifs.prestataires} pro${actifs.prestataires > 1 ? 's' : ''}` },
    { label: 'Réservations', value: nombre(stats.bookingsToday), sub: `${nombre(stats.bookingsMonth)} ce mois` },
    { label: 'Inscriptions', value: nombre(stats.newSignupsToday), sub: `${nombre(stats.newSignupsMonth)} ce mois` },
    ...(overview
      ? [{
          label: "Pages d'accueil",
          value: nombre(overview.landingPages.reduce((s, p) => s + p.today, 0)),
          sub: `${nombre(overview.landingPages.reduce((s, p) => s + p.views30, 0))} sur 30 j`,
        }]
      : []),
    { label: 'Vues des vitrines', value: nombre(stats.pageViewsToday), sub: `${nombre(stats.pageViews7Days)} sur 7 j` },
    { label: 'Stories', value: nombre(stats.storiesToday), sub: auteurs.length > 0 ? `par ${auteurs.length} pro${auteurs.length > 1 ? 's' : ''}` : 'aucune encore' },
  ];

  return (
    <Panel className="overflow-hidden">
      <div className="flex flex-col lg:flex-row">
        <div className="flex items-center gap-2 border-b lg:border-b-0 lg:border-r border-gray-100 dark:border-gray-700/60 px-5 py-4 lg:w-40 flex-shrink-0">
          <span className="relative flex h-2.5 w-2.5">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-60" />
            <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-emerald-500" />
          </span>
          <span className="text-sm font-semibold text-gray-900 dark:text-white">Aujourd&apos;hui</span>
        </div>
        <div className="grid flex-1 grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 divide-x divide-gray-100 dark:divide-gray-700/60">
          {chiffres.map((c) => (
            <div key={c.label} className="px-5 py-4">
              <p className="text-xs text-gray-500 dark:text-gray-400">{c.label}</p>
              <p className="mt-0.5 text-xl font-bold text-gray-900 dark:text-white">{c.value}</p>
              <p className="text-[11px] text-gray-400 dark:text-gray-500">{c.sub}</p>
            </div>
          ))}
        </div>
      </div>

      {auteurs.length > 0 && (
        <div className="flex flex-wrap items-center gap-2 border-t border-gray-100 dark:border-gray-700/60 bg-gray-50/60 dark:bg-gray-900/20 px-5 py-3">
          <span className="text-xs font-medium text-gray-500 dark:text-gray-400 mr-1">Stories publiées par</span>
          {auteurs.map((a) => (
            <Link
              key={a.providerId}
              href={`/admin/providers/${a.providerId}`}
              title={a.contents.join(' · ')}
              className="inline-flex items-center gap-1.5 rounded-full border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 py-0.5 pl-0.5 pr-2.5 text-xs text-gray-700 dark:text-gray-200 hover:border-red-300 dark:hover:border-red-500/50 transition-colors"
            >
              <Avatar name={a.businessName} photoURL={a.photoURL} size={22} />
              <span className="font-medium">{a.businessName}</span>
              {a.isTest && <span className="text-[10px] text-gray-400">test</span>}
              {a.instagram && <Instagram className="h-3 w-3 text-pink-500" aria-label="Instagram" />}
              <span className="rounded-full bg-red-50 dark:bg-red-500/10 px-1.5 text-[11px] font-semibold text-red-600 dark:text-red-400">
                {a.count}
              </span>
            </Link>
          ))}
        </div>
      )}
    </Panel>
  );
}
