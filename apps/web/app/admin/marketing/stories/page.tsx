'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { Loader2, Share2, Users, Instagram, RefreshCw } from 'lucide-react';
import { adminHeaders } from '@/services/admin/adminFetch';

/**
 * Stories — qui partage, et quel type de story marche.
 *
 * Pilotage produit (améliorer, proposer, corriger) et base du futur système
 * de récompense / vérification des prestataires qui publient souvent. Les
 * données viennent de storyEvents, un doc par partage réussi.
 */

interface StoriesData {
  days: number;
  total: number;
  sharers: number;
  byContent: { content: string; label: string; count: number }[];
  byChannel: { channel: string; count: number }[];
  byWeek: { week: string; count: number }[];
  providers: {
    id: string;
    businessName: string;
    photoURL: string | null;
    isPublished: boolean;
    total: number;
    byContent: Record<string, number>;
    lastAt: string | null;
  }[];
  recent: { providerId: string; businessName: string; content: string; label: string; channel: string; createdAt: string | null }[];
  contentLabels: Record<string, string>;
}

const PERIODES = [
  { days: 7, label: '7 jours' },
  { days: 30, label: '30 jours' },
  { days: 90, label: '90 jours' },
  { days: 0, label: 'Tout' },
];

function depuis(iso: string | null): string {
  if (!iso) return '—';
  const min = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 60_000));
  if (min < 60) return `il y a ${Math.max(1, min)} min`;
  const h = Math.round(min / 60);
  if (h < 24) return `il y a ${h} h`;
  return `il y a ${Math.round(h / 24)} j`;
}

export default function AdminStoriesPage() {
  const [days, setDays] = useState(30);
  const [data, setData] = useState<StoriesData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const charger = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/stories?days=${days}`, { headers: await adminHeaders() });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      setData(await res.json());
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erreur');
    } finally {
      setLoading(false);
    }
  }, [days]);

  useEffect(() => {
    void charger();
  }, [charger]);

  const maxWeek = data ? Math.max(1, ...data.byWeek.map((w) => w.count)) : 1;
  const instagram = data?.byChannel.find((c) => c.channel === 'instagram')?.count ?? 0;

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Stories partagées</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            Qui publie, et quel type de story fonctionne — un partage compté seulement quand il aboutit.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <div className="inline-flex rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden">
            {PERIODES.map((p) => (
              <button
                key={p.days}
                onClick={() => setDays(p.days)}
                className={`px-3 py-1.5 text-xs font-semibold ${
                  days === p.days
                    ? 'bg-gray-900 text-white dark:bg-white dark:text-gray-900'
                    : 'text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800'
                }`}
              >
                {p.label}
              </button>
            ))}
          </div>
          <button
            onClick={() => void charger()}
            className="p-2 rounded-xl border border-gray-200 dark:border-gray-700 text-gray-500 hover:text-gray-900 dark:hover:text-white"
            title="Actualiser"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}

      {!data ? (
        <Loader2 className="w-5 h-5 animate-spin text-gray-400" />
      ) : (
        <>
          {/* Chiffres clés */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {[
              { icon: <Share2 className="w-5 h-5" />, label: 'Partages', value: data.total },
              { icon: <Users className="w-5 h-5" />, label: 'Prestataires qui partagent', value: data.sharers },
              { icon: <Instagram className="w-5 h-5" />, label: 'Vers Instagram', value: instagram, sub: data.total > 0 ? `${Math.round((instagram / data.total) * 100)} % des partages` : undefined },
            ].map((k) => (
              <div key={k.label} className="bg-white dark:bg-gray-800 rounded-xl p-5 shadow-sm border border-gray-100 dark:border-gray-700">
                <div className="flex items-center gap-2 text-gray-500 dark:text-gray-400 text-sm">
                  <span className="text-red-500">{k.icon}</span>
                  {k.label}
                </div>
                <p className="mt-2 text-3xl font-bold text-gray-900 dark:text-white">{k.value}</p>
                {k.sub && <p className="text-xs text-gray-400 mt-0.5">{k.sub}</p>}
              </div>
            ))}
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Par type */}
            <div className="bg-white dark:bg-gray-800 rounded-xl p-5 shadow-sm border border-gray-100 dark:border-gray-700">
              <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-4">Quel type de story marche</h3>
              {data.byContent.length === 0 ? (
                <p className="text-sm text-gray-400 text-center py-6">Aucun partage sur la période</p>
              ) : (
                <ul className="space-y-3">
                  {data.byContent.map((c) => {
                    const pct = data.total > 0 ? Math.round((c.count / data.total) * 100) : 0;
                    return (
                      <li key={c.content}>
                        <div className="flex items-center justify-between text-sm">
                          <span className="font-medium text-gray-900 dark:text-white">{c.label}</span>
                          <span className="text-gray-500 dark:text-gray-400 tabular-nums">
                            {c.count} · {pct} %
                          </span>
                        </div>
                        <div className="mt-1 h-2 rounded-full bg-gray-100 dark:bg-gray-700 overflow-hidden">
                          <div className="h-full rounded-full bg-red-500" style={{ width: `${pct}%` }} />
                        </div>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>

            {/* Par semaine */}
            <div className="bg-white dark:bg-gray-800 rounded-xl p-5 shadow-sm border border-gray-100 dark:border-gray-700">
              <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-4">Partages par semaine</h3>
              {data.byWeek.length === 0 ? (
                <p className="text-sm text-gray-400 text-center py-6">Aucun partage sur la période</p>
              ) : (
                <div className="flex items-stretch gap-1.5 h-36">
                  {data.byWeek.map((w) => (
                    <div key={w.week} className="flex-1 flex flex-col items-center justify-end gap-1 min-w-0 h-full" title={`Semaine du ${new Date(w.week).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })} : ${w.count}`}>
                      <span className="text-[10px] text-gray-500 tabular-nums">{w.count}</span>
                      <div className="w-full rounded-t bg-red-500/80" style={{ height: `${Math.max(4, (w.count / maxWeek) * 100)}%` }} />
                      <span className="text-[9px] text-gray-400 truncate w-full text-center">
                        {new Date(w.week).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Qui partage */}
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 overflow-hidden">
            <div className="px-5 py-4 border-b border-gray-100 dark:border-gray-700">
              <h3 className="text-sm font-semibold text-gray-900 dark:text-white">Qui partage</h3>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                Les plus actifs d&apos;abord — base du futur programme de récompense.
              </p>
            </div>
            {data.providers.length === 0 ? (
              <p className="px-5 py-8 text-sm text-gray-400 text-center">Aucun prestataire n&apos;a partagé sur la période</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left text-[11px] uppercase tracking-wider text-gray-400 border-b border-gray-100 dark:border-gray-700">
                      <th className="px-5 py-2.5 font-semibold">Prestataire</th>
                      <th className="px-3 py-2.5 font-semibold text-right">Partages</th>
                      <th className="px-3 py-2.5 font-semibold">Types</th>
                      <th className="px-5 py-2.5 font-semibold text-right">Dernier</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50 dark:divide-gray-700/50">
                    {data.providers.map((p, i) => (
                      <tr key={p.id} className="hover:bg-gray-50/60 dark:hover:bg-gray-700/30">
                        <td className="px-5 py-3">
                          <div className="flex items-center gap-3">
                            <span className="w-6 text-xs text-gray-400 tabular-nums">{i + 1}</span>
                            <div className="w-8 h-8 rounded-full bg-gray-200 dark:bg-gray-600 overflow-hidden flex items-center justify-center flex-shrink-0">
                              {p.photoURL ? (
                                // eslint-disable-next-line @next/next/no-img-element
                                <img src={p.photoURL} alt="" className="w-8 h-8 object-cover" />
                              ) : (
                                <span className="text-xs font-medium text-gray-600 dark:text-gray-300">{p.businessName.charAt(0).toUpperCase()}</span>
                              )}
                            </div>
                            <div className="min-w-0">
                              <Link href={`/admin/providers/${p.id}`} className="font-medium text-gray-900 dark:text-white hover:underline">
                                {p.businessName}
                              </Link>
                              {!p.isPublished && <p className="text-[10px] text-amber-600">page non publiée</p>}
                            </div>
                          </div>
                        </td>
                        <td className="px-3 py-3 text-right font-semibold text-gray-900 dark:text-white tabular-nums">{p.total}</td>
                        <td className="px-3 py-3">
                          <div className="flex flex-wrap gap-1">
                            {Object.entries(p.byContent)
                              .sort((a, b) => b[1] - a[1])
                              .map(([content, n]) => (
                                <span key={content} className="inline-flex items-center rounded-full bg-gray-100 dark:bg-gray-700 px-2 py-0.5 text-[11px] text-gray-700 dark:text-gray-200">
                                  {data.contentLabels[content] ?? content} · {n}
                                </span>
                              ))}
                          </div>
                        </td>
                        <td className="px-5 py-3 text-right text-xs text-gray-500 whitespace-nowrap">{depuis(p.lastAt)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Derniers partages */}
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 overflow-hidden">
            <div className="px-5 py-4 border-b border-gray-100 dark:border-gray-700">
              <h3 className="text-sm font-semibold text-gray-900 dark:text-white">Derniers partages</h3>
            </div>
            {data.recent.length === 0 ? (
              <p className="px-5 py-8 text-sm text-gray-400 text-center">Rien pour l&apos;instant</p>
            ) : (
              <ul className="divide-y divide-gray-50 dark:divide-gray-700/50">
                {data.recent.map((r, i) => (
                  <li key={i} className="px-5 py-2.5 flex items-center justify-between gap-3 text-sm">
                    <span className="min-w-0 truncate">
                      <Link href={`/admin/providers/${r.providerId}`} className="font-medium text-gray-900 dark:text-white hover:underline">
                        {r.businessName}
                      </Link>
                      <span className="text-gray-500 dark:text-gray-400"> · {r.label}</span>
                      <span className="text-gray-400"> · {r.channel === 'instagram' ? 'Instagram' : 'autre'}</span>
                    </span>
                    <span className="text-xs text-gray-400 whitespace-nowrap">{depuis(r.createdAt)}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </>
      )}
    </div>
  );
}
