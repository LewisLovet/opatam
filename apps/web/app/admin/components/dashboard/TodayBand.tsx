'use client';

import Link from 'next/link';
import { ArrowUpRight, Instagram } from 'lucide-react';
import type { AdminOverview, DashboardStats, RecentSignups } from '@/services/admin/types';
import { Avatar, Panel, nombre } from './primitives';

/**
 * La journée en cours, d'un seul coup d'œil : qui est là, ce qui se réserve,
 * qui s'inscrit — et QUI publie des stories, pas seulement combien.
 */
/** Même journée calendaire, à l'heure locale. */
function estAujourdhui(iso: string | null): boolean {
  if (!iso) return false;
  const d = new Date(iso);
  const n = new Date();
  return d.getFullYear() === n.getFullYear() && d.getMonth() === n.getMonth() && d.getDate() === n.getDate();
}

export function TodayBand({
  stats,
  overview,
  recentSignups,
}: {
  stats: DashboardStats;
  overview: AdminOverview | null;
  recentSignups: RecentSignups | null;
}) {
  const actifs = stats.activeToday.total;
  const auteurs = stats.storiesTodayBy ?? [];
  // Qui s'est inscrit aujourd'hui : le nouveau venu se voit d'un coup d'œil,
  // comme le « +X » d'avant la refonte — avec son nom en plus.
  const prosDuJour = (recentSignups?.providers ?? []).filter((p) => estAujourdhui(p.createdAt));
  const clientsDuJour = (recentSignups?.clients ?? []).filter((c) => estAujourdhui(c.createdAt));
  const listesCompletes = prosDuJour.length + clientsDuJour.length;
  const chiffres: { label: string; value: string; sub: string; plus?: number }[] = [
    { label: 'Réservations', value: nombre(stats.bookingsToday), plus: stats.bookingsToday, sub: `${nombre(stats.bookingsMonth)} ce mois` },
    {
      label: 'Inscriptions',
      value: nombre(stats.newSignupsToday),
      plus: stats.newSignupsToday,
      sub: `${prosDuJour.length > 0 ? `dont ${prosDuJour.length} pro${prosDuJour.length > 1 ? 's' : ''} · ` : ''}${nombre(stats.totalUsers)} au total`,
    },
    { label: 'Actifs', value: nombre(actifs.clients + actifs.prestataires), sub: `dont ${actifs.prestataires} pro${actifs.prestataires > 1 ? 's' : ''}` },
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
              {c.plus !== undefined ? (
                // Les arrivées du jour : « +3 » en vert dès qu'il y en a une.
                <p
                  className={`mt-0.5 flex items-center gap-0.5 text-2xl font-bold ${
                    c.plus > 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-gray-300 dark:text-gray-600'
                  }`}
                >
                  {c.plus > 0 && <ArrowUpRight className="h-5 w-5" />}
                  {c.plus > 0 ? `+${c.value}` : '0'}
                </p>
              ) : (
                <p className="mt-0.5 text-xl font-bold text-gray-900 dark:text-white">{c.value}</p>
              )}
              <p className="text-[11px] text-gray-400 dark:text-gray-500">{c.sub}</p>
            </div>
          ))}
        </div>
      </div>

      {listesCompletes > 0 && (
        <div className="flex flex-wrap items-center gap-2 border-t border-gray-100 dark:border-gray-700/60 bg-emerald-50/40 dark:bg-emerald-500/5 px-5 py-3">
          <span className="text-xs font-medium text-emerald-700 dark:text-emerald-400 mr-1">Inscrits aujourd&apos;hui</span>
          {prosDuJour.map((p) => (
            <Link
              key={p.id}
              href={`/admin/providers/${p.id}`}
              className="inline-flex items-center gap-1.5 rounded-full border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 py-0.5 pl-0.5 pr-2.5 text-xs text-gray-700 dark:text-gray-200 hover:border-emerald-300 dark:hover:border-emerald-500/50 transition-colors"
            >
              <Avatar name={p.businessName} photoURL={p.photoURL} size={22} />
              <span className="font-medium">{p.businessName}</span>
              <span className="rounded-full bg-violet-50 dark:bg-violet-500/10 px-1.5 text-[10px] font-semibold text-violet-600 dark:text-violet-400">pro</span>
            </Link>
          ))}
          {clientsDuJour.map((c) => (
            <Link
              key={c.id}
              href={`/admin/users/${c.id}`}
              className="inline-flex items-center gap-1.5 rounded-full border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 py-0.5 pl-0.5 pr-2.5 text-xs text-gray-700 dark:text-gray-200 hover:border-emerald-300 dark:hover:border-emerald-500/50 transition-colors"
            >
              <Avatar name={c.displayName || c.email || '?'} photoURL={c.photoURL} size={22} />
              <span className="font-medium">{c.displayName || c.email || 'Sans nom'}</span>
              <span className="rounded-full bg-gray-100 dark:bg-gray-700 px-1.5 text-[10px] text-gray-500 dark:text-gray-400">client</span>
            </Link>
          ))}
          {stats.newSignupsToday > listesCompletes && (
            <span className="text-[11px] text-gray-500">et {stats.newSignupsToday - listesCompletes} autre{stats.newSignupsToday - listesCompletes > 1 ? 's' : ''}</span>
          )}
        </div>
      )}

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
