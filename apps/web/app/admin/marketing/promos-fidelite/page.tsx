'use client';

/**
 * Admin · Envois promos fidélité
 *
 * Journal des emails de promotion envoyés aux clients fidélité. Vue de
 * CONSTAT : elle n'offre ni renvoi ni relance, parce qu'il n'existe aucun
 * mécanisme de reprise — une promo part une fois, le throttle de 7 jours
 * est consommé, et un email refusé par Resend n'est jamais réexpédié.
 * L'admin vient ici pour voir qu'un envoi a partiellement ou totalement
 * échoué, et rien d'autre. Le parcours du prestataire n'en sait rien.
 *
 * Source : providers/{providerId}/promoNotifications/{serviceId}.
 */

import { useCallback, useEffect, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui';
import { AlertTriangle, CheckCircle2, Clock, Mail, RefreshCw, XCircle } from 'lucide-react';
import type {
  PromoNotificationRow,
  PromoNotificationStatus,
} from '@/app/api/admin/promo-notifications/route';

const STATUS: Record<
  PromoNotificationStatus,
  { label: string; className: string; icon: React.ReactNode }
> = {
  sent: {
    label: 'Envoyé',
    className:
      'bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-300',
    icon: <CheckCircle2 className="w-3.5 h-3.5" />,
  },
  partial: {
    label: 'Partiellement envoyé',
    className:
      'bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300',
    icon: <AlertTriangle className="w-3.5 h-3.5" />,
  },
  failed: {
    label: 'Échec',
    className: 'bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300',
    icon: <XCircle className="w-3.5 h-3.5" />,
  },
  pending: {
    label: 'En attente',
    className: 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300',
    icon: <Clock className="w-3.5 h-3.5" />,
  },
};

function formatDate(iso: string | null): string {
  if (!iso) return '—';
  const ms = Date.parse(iso);
  if (Number.isNaN(ms)) return '—';
  return new Date(ms).toLocaleString('fr-FR', { dateStyle: 'medium', timeStyle: 'short' });
}

function formatPeriod(startsAt: string | null, endsAt: string | null): string {
  const fmt = (d: string) =>
    new Date(`${d}T12:00:00`).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' });
  if (startsAt && endsAt) return `${fmt(startsAt)} → ${fmt(endsAt)}`;
  if (startsAt) return `à partir du ${fmt(startsAt)}`;
  if (endsAt) return `jusqu'au ${fmt(endsAt)}`;
  return 'sans limite';
}

export default function PromoNotificationsPage() {
  const { user } = useAuth();
  const [rows, setRows] = useState<PromoNotificationRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!user?.id) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/admin/promo-notifications', {
        headers: { 'x-admin-uid': user.id },
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'Erreur');
      setRows(data.rows ?? []);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erreur inconnue');
    } finally {
      setLoading(false);
    }
  }, [user?.id]);

  useEffect(() => {
    void load();
  }, [load]);

  const incidents = rows.filter((r) => r.status !== 'sent').length;

  return (
    <div className="p-4 sm:p-6 max-w-7xl mx-auto">
      <div className="flex flex-wrap items-center justify-between gap-3 mb-2">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
          <Mail className="w-6 h-6 text-primary-600" />
          Envois promos fidélité
        </h1>
        <Button variant="secondary" onClick={() => void load()} disabled={loading}>
          <RefreshCw className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
          Actualiser
        </Button>
      </div>
      <p className="text-sm text-gray-500 dark:text-gray-400 mb-6">
        Chaque promotion n&apos;est envoyée qu&apos;une fois. Les emails en échec ne sont pas
        réexpédiés&nbsp;: cette page sert uniquement à les constater.
      </p>

      {incidents > 0 && !loading && (
        <div className="mb-4 flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 dark:border-amber-900/50 dark:bg-amber-900/20 p-3">
          <AlertTriangle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
          <p className="text-sm text-amber-800 dark:text-amber-200">
            {incidents} envoi{incidents > 1 ? 's' : ''} n&apos;{incidents > 1 ? 'ont' : 'a'} pas
            abouti complètement.
          </p>
        </div>
      )}

      {error && (
        <div className="mb-4 rounded-xl border border-red-200 bg-red-50 dark:border-red-900/50 dark:bg-red-900/20 p-3 text-sm text-red-700 dark:text-red-300">
          {error}
        </div>
      )}

      {loading ? (
        <div className="py-16 text-center text-gray-500 dark:text-gray-400">Chargement…</div>
      ) : rows.length === 0 ? (
        <div className="py-16 text-center">
          <Mail className="w-10 h-10 mx-auto text-gray-300 dark:text-gray-600 mb-3" />
          <p className="text-gray-600 dark:text-gray-300 font-medium">Aucun envoi enregistré</p>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            Aucun prestataire n&apos;a encore demandé à prévenir ses clients fidélité d&apos;une
            promotion.
          </p>
        </div>
      ) : (
        <>
          {/* Tableau — écrans larges */}
          <div className="hidden lg:block overflow-x-auto rounded-xl border border-gray-200 dark:border-gray-700">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 dark:bg-gray-800/60 text-left text-gray-600 dark:text-gray-300">
                <tr>
                  <th className="px-4 py-3 font-medium">Prestataire</th>
                  <th className="px-4 py-3 font-medium">Prestation</th>
                  <th className="px-4 py-3 font-medium">Offre</th>
                  <th className="px-4 py-3 font-medium">Statut</th>
                  <th className="px-4 py-3 font-medium text-right">Visés</th>
                  <th className="px-4 py-3 font-medium text-right">Envoyés</th>
                  <th className="px-4 py-3 font-medium text-right">Échecs</th>
                  <th className="px-4 py-3 font-medium">Date</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                {rows.map((r) => (
                  <tr key={r.id} className="hover:bg-gray-50 dark:hover:bg-gray-800/40">
                    <td className="px-4 py-3 text-gray-900 dark:text-white">{r.businessName}</td>
                    <td className="px-4 py-3 text-gray-700 dark:text-gray-300">{r.serviceName}</td>
                    <td className="px-4 py-3 text-gray-700 dark:text-gray-300 whitespace-nowrap">
                      <span className="font-semibold">−{r.percent}&nbsp;%</span>
                      <span className="block text-xs text-gray-500 dark:text-gray-400">
                        {formatPeriod(r.startsAt, r.endsAt)}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`inline-flex items-center gap-1.5 px-2 py-1 rounded-full text-xs font-medium ${STATUS[r.status].className}`}
                      >
                        {STATUS[r.status].icon}
                        {STATUS[r.status].label}
                      </span>
                      {r.attempts > 1 && (
                        <span className="block text-xs text-gray-500 dark:text-gray-400 mt-1">
                          {r.attempts} tentatives
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right text-gray-700 dark:text-gray-300">
                      {r.recipientsCount}
                    </td>
                    <td className="px-4 py-3 text-right text-gray-700 dark:text-gray-300">
                      {r.sentCount}
                    </td>
                    <td
                      className={`px-4 py-3 text-right font-medium ${r.failedCount > 0 ? 'text-red-600 dark:text-red-400' : 'text-gray-400'}`}
                    >
                      {r.failedCount}
                    </td>
                    <td className="px-4 py-3 text-gray-600 dark:text-gray-400 whitespace-nowrap">
                      {formatDate(r.sentAt ?? r.claimedAt)}
                      {r.lastError && (
                        <span
                          className="block text-xs text-red-600 dark:text-red-400 max-w-xs truncate"
                          title={r.lastError}
                        >
                          {r.lastError}
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Cartes — écrans étroits */}
          <div className="lg:hidden space-y-3">
            {rows.map((r) => (
              <div
                key={r.id}
                className="rounded-xl border border-gray-200 dark:border-gray-700 p-4"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="font-medium text-gray-900 dark:text-white truncate">
                      {r.businessName}
                    </p>
                    <p className="text-sm text-gray-600 dark:text-gray-400 truncate">
                      {r.serviceName} · −{r.percent}&nbsp;%
                    </p>
                    <p className="text-xs text-gray-500 dark:text-gray-400">
                      {formatPeriod(r.startsAt, r.endsAt)}
                    </p>
                  </div>
                  <span
                    className={`inline-flex items-center gap-1.5 px-2 py-1 rounded-full text-xs font-medium flex-shrink-0 ${STATUS[r.status].className}`}
                  >
                    {STATUS[r.status].icon}
                    {STATUS[r.status].label}
                  </span>
                </div>
                <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-gray-600 dark:text-gray-400">
                  <span>Visés&nbsp;: {r.recipientsCount}</span>
                  <span>Envoyés&nbsp;: {r.sentCount}</span>
                  <span className={r.failedCount > 0 ? 'text-red-600 dark:text-red-400' : ''}>
                    Échecs&nbsp;: {r.failedCount}
                  </span>
                  <span>{formatDate(r.sentAt ?? r.claimedAt)}</span>
                </div>
                {r.lastError && (
                  <p className="mt-2 text-xs text-red-600 dark:text-red-400 break-words">
                    {r.lastError}
                  </p>
                )}
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
