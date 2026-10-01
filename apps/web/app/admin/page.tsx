'use client';

import { useEffect, useState } from 'react';
import { formatPrice } from '@booking-app/shared';
import {
  Briefcase,
  Calendar,
  Coins,
  RefreshCw,
  Repeat,
  CalendarCheck,
  Store,
} from 'lucide-react';
import Link from 'next/link';
import { getFunctions, httpsCallable } from 'firebase/functions';
import { app } from '@booking-app/firebase';
import { acquisitionChannelLabel } from '@booking-app/shared';
import { useAuth } from '@/contexts/AuthContext';
import { adminStatsService } from '@/services/admin';
import type { DashboardStats, CategoryData, RecentSignups, AdminOverview } from '@/services/admin/types';
import { BookingsByCategoryChart } from './components/BookingsByCategoryChart';
import { HeroKpi } from './components/dashboard/HeroKpi';
import { TodayBand } from './components/dashboard/TodayBand';
import { MainChart } from './components/dashboard/MainChart';
import { TodoPanel } from './components/dashboard/TodoPanel';
import { TopProsCard } from './components/dashboard/TopProsCard';
import { ActivationFunnel } from './components/dashboard/ActivationFunnel';
import { LandingPagesCard } from './components/dashboard/LandingPagesCard';
import { DeltaPill, nombre } from './components/dashboard/primitives';
import { Loader } from '@/components/ui';

export default function AdminDashboardPage() {
  const { user } = useAuth();
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [overview, setOverview] = useState<AdminOverview | null>(null);
  const [categoryData, setCategoryData] = useState<CategoryData[]>([]);
  const [recentSignups, setRecentSignups] = useState<RecentSignups | null>(null);
  const [signupsTab, setSignupsTab] = useState<'providers' | 'clients'>('providers');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [recomputing, setRecomputing] = useState(false);

  const handleRecompute = async () => {
    if (!user?.id || recomputing) return;
    setRecomputing(true);
    try {
      const fn = httpsCallable(getFunctions(app, 'europe-west1'), 'recomputeDashboardStatsNow');
      await fn();
      const fresh = await adminStatsService.getDashboardStats(user.id, true);
      setStats(fresh);
    } catch (err) {
      console.error('Recompute failed:', err);
      setError('Échec du recalcul des statistiques');
    } finally {
      setRecomputing(false);
    }
  };

  useEffect(() => {
    if (!user?.id) return;

    const loadData = async () => {
      try {
        const [statsData, categories, recent, vue] = await Promise.all([
          adminStatsService.getDashboardStats(user.id),
          adminStatsService.getBookingsByCategory(user.id),
          adminStatsService.getRecentSignups(user.id),
          // Un bloc en panne ne doit pas vider tout le tableau de bord.
          adminStatsService.getOverview().catch((e) => {
            console.error('Overview failed:', e);
            return null;
          }),
        ]);
        setStats(statsData);
        setCategoryData(categories);
        setRecentSignups(recent);
        setOverview(vue);
      } catch (err) {
        console.error('Error loading admin stats:', err);
        setError('Erreur lors du chargement des données');
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, [user?.id]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <Loader size="lg" />
      </div>
    );
  }

  if (error || !stats) {
    return (
      <div className="flex items-center justify-center h-96">
        <p className="text-red-500">{error || 'Erreur inconnue'}</p>
      </div>
    );
  }

  // Devises autres que l'euro qui ont deja produit des frais.
  const autresDevises = Object.keys(stats.serviceFeesByCurrency ?? {}).filter(
    (d) => d !== 'EUR',
  );
  const euros = (cents: number) => formatPrice(cents, 'EUR');
  const aujourdhui = new Date().toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' });

  return (
    <div className="space-y-6">
      {/* En-tête */}
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-sm font-medium capitalize text-red-500">{aujourdhui}</p>
          <h1 className="mt-0.5 text-2xl sm:text-3xl font-bold tracking-tight text-gray-900 dark:text-white">
            Tableau de bord
          </h1>
        </div>
        <button
          type="button"
          onClick={handleRecompute}
          disabled={recomputing}
          title="Recompte les stats depuis la source (exclut les comptes de test) — corrige toute dérive"
          className="inline-flex items-center gap-2 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 px-3.5 py-2 text-sm font-medium text-gray-700 dark:text-gray-200 shadow-sm hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-50 shrink-0"
        >
          <RefreshCw className={`w-4 h-4 ${recomputing ? 'animate-spin' : ''}`} />
          {recomputing ? 'Recalcul…' : 'Recalculer'}
        </button>
      </div>

      {/* Les quatre chiffres qui comptent, comparés à la période d'avant */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        <HeroKpi
          label="MRR net"
          accent="red"
          icon={<Repeat className="h-5 w-5" />}
          value={euros(stats.mrr)}
          detail={
            stats.mrrPreviousMonth !== null && stats.mrrPreviousMonth !== undefined ? (
              <DeltaPill value={stats.mrr} previous={stats.mrrPreviousMonth} suffix="vs mois dernier" />
            ) : (
              <span className="text-xs text-gray-400">comparaison au mois dernier dès le mois prochain</span>
            )
          }
          footer={
            <>
              Encaissé ce mois : <span className="font-semibold text-gray-700 dark:text-gray-200">{euros(stats.collectedThisMonth)}</span>
              {stats.collectedLastMonth > 0 ? ` · ${euros(stats.collectedLastMonth)} le mois dernier` : ''}
            </>
          }
        />
        <HeroKpi
          label="Réservations · 30 j"
          accent="violet"
          icon={<CalendarCheck className="h-5 w-5" />}
          value={overview ? nombre(overview.bookings30.value) : nombre(stats.bookingsMonth)}
          detail={overview && <DeltaPill value={overview.bookings30.value} previous={overview.bookings30.previous} />}
          footer={
            <span className={stats.bookingsToday > 0 ? 'font-semibold text-emerald-600 dark:text-emerald-400' : ''}>
              {stats.bookingsToday > 0 ? `+${nombre(stats.bookingsToday)}` : 'Aucune'} aujourd&apos;hui
            </span>
          }
          spark={overview?.bookings30.spark}
        />
        <HeroKpi
          label="Pros qui travaillent"
          accent="sky"
          icon={<Store className="h-5 w-5" />}
          value={
            overview ? (
              <>
                {overview.workingPros.value}
                <span className="ml-1 text-base font-medium text-gray-400">/ {overview.workingPros.total}</span>
              </>
            ) : (
              '—'
            )
          }
          detail={overview && <DeltaPill value={overview.workingPros.value} previous={overview.workingPros.previous} />}
          footer="au moins une réservation reçue en 30 j, sur les pros publiés"
          gauge={overview && overview.workingPros.total > 0 ? overview.workingPros.value / overview.workingPros.total : undefined}
        />
        <HeroKpi
          label={autresDevises.length > 0 ? 'Frais perçus · 30 j (EUR)' : 'Frais perçus · 30 j'}
          accent="emerald"
          icon={<Coins className="h-5 w-5" />}
          value={overview ? euros(overview.fees30.value) : euros(stats.serviceFeesThisMonth)}
          detail={overview && <DeltaPill value={overview.fees30.value} previous={overview.fees30.previous} />}
          footer={
            overview && (
              <>
                {euros(overview.fees30.thisMonth)} ce mois · {euros(overview.fees30.allTime)} depuis le début
              </>
            )
          }
          spark={overview?.fees30.spark}
        />
      </div>

      {/* La journée en cours */}
      <TodayBand stats={stats} overview={overview} recentSignups={recentSignups} />

      {/* Le grand graphique et ce qui demande une action */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        <div className="xl:col-span-2">
          <MainChart />
        </div>
        {overview && <TodoPanel todo={overview.todo} />}
      </div>

      {/* Qui fait vivre la plateforme, ce qui attire, et ce que deviennent les nouveaux */}
      {overview && (
        <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6">
          <TopProsCard current={overview.topPros} previous={overview.topProsPreviousMonth ?? []} />
          <LandingPagesCard pages={overview.landingPages} />
          <ActivationFunnel activation={overview.activation} />
        </div>
      )}

      {/* Recent signups */}
      {recentSignups && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Derniers inscrits — onglets Prestataires / Clients */}
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700/60">
            <div className="px-5 py-4 border-b border-gray-100 dark:border-gray-700 flex items-center justify-between gap-3">
              <h3 className="text-sm font-semibold text-gray-900 dark:text-white flex items-center gap-2">
                <Briefcase className="w-4 h-4" />
                Derniers inscrits
              </h3>
              <div className="flex items-center gap-2">
                <div className="flex items-center bg-gray-100 dark:bg-gray-700 rounded-full p-0.5">
                  <button
                    type="button"
                    onClick={() => setSignupsTab('providers')}
                    className={`px-3 py-1 text-xs font-medium rounded-full transition-colors ${
                      signupsTab === 'providers'
                        ? 'bg-white dark:bg-gray-800 text-gray-900 dark:text-white shadow-sm'
                        : 'text-gray-500 dark:text-gray-400'
                    }`}
                  >
                    Prestataires
                  </button>
                  <button
                    type="button"
                    onClick={() => setSignupsTab('clients')}
                    className={`px-3 py-1 text-xs font-medium rounded-full transition-colors ${
                      signupsTab === 'clients'
                        ? 'bg-white dark:bg-gray-800 text-gray-900 dark:text-white shadow-sm'
                        : 'text-gray-500 dark:text-gray-400'
                    }`}
                  >
                    Clients
                  </button>
                </div>
                <Link
                  href={signupsTab === 'providers' ? '/admin/providers' : '/admin/users'}
                  className="text-xs text-red-500 hover:text-red-600 transition-colors"
                >
                  Voir tous
                </Link>
              </div>
            </div>
            {signupsTab === 'clients' ? (
              recentSignups.clients.length === 0 ? (
                <div className="p-5 text-center text-gray-400 text-sm">Aucun client</div>
              ) : (
                <div className="divide-y divide-gray-50 dark:divide-gray-700/50">
                  {recentSignups.clients.map((c) => (
                    <div key={c.id} className="flex items-center gap-3 px-5 py-3">
                      <div className="w-8 h-8 rounded-full bg-gray-200 dark:bg-gray-600 flex items-center justify-center flex-shrink-0">
                        {c.photoURL ? (
                          <img src={c.photoURL} alt={c.displayName || ''} className="w-8 h-8 rounded-full object-cover" />
                        ) : (
                          <span className="text-xs font-medium text-gray-600 dark:text-gray-300">
                            {(c.displayName || c.email || '?').charAt(0).toUpperCase()}
                          </span>
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-gray-900 dark:text-white truncate">
                          {c.displayName || 'Sans nom'}
                        </p>
                        <p className="text-xs text-gray-500 dark:text-gray-400 truncate">{c.email}</p>
                        {/* Qui l'a fait venir : le prestataire de sa première réservation */}
                        {c.firstBooking ? (
                          <p className="text-[11px] text-gray-500 dark:text-gray-400 truncate">
                            Via{' '}
                            {c.firstBooking.providerId ? (
                              <Link
                                href={`/admin/providers/${c.firstBooking.providerId}`}
                                className="font-medium text-red-600 dark:text-red-400 hover:underline"
                              >
                                {c.firstBooking.providerName}
                              </Link>
                            ) : (
                              <span className="font-medium">{c.firstBooking.providerName}</span>
                            )}
                            {c.firstBooking.date
                              ? ` · 1ʳᵉ résa le ${new Date(c.firstBooking.date).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })}`
                              : ''}
                            {c.firstBooking.beforeSignup ? ' (invitée avant le compte)' : ''}
                          </p>
                        ) : (
                          <p className="text-[11px] text-gray-300 dark:text-gray-600">Aucune réservation</p>
                        )}
                      </div>
                      <span className="text-xs text-gray-400 flex-shrink-0">
                        {c.createdAt ? new Date(c.createdAt).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' }) : ''}
                      </span>
                    </div>
                  ))}
                </div>
              )
            ) : recentSignups.providers.length === 0 ? (
              <div className="p-5 text-center text-gray-400 text-sm">Aucun prestataire</div>
            ) : (
              <div className="divide-y divide-gray-50 dark:divide-gray-700/50">
                {recentSignups.providers.map((p) => (
                  <Link
                    key={p.id}
                    href={`/admin/providers/${p.id}`}
                    className="flex items-center gap-3 px-5 py-3 hover:bg-gray-50 dark:hover:bg-gray-700/30 transition-colors"
                  >
                    <div className="w-8 h-8 rounded-full bg-gray-200 dark:bg-gray-600 flex items-center justify-center flex-shrink-0">
                      {p.photoURL ? (
                        <img src={p.photoURL} alt={p.businessName} className="w-8 h-8 rounded-full object-cover" />
                      ) : (
                        <span className="text-xs font-medium text-gray-600 dark:text-gray-300">
                          {p.businessName?.charAt(0).toUpperCase() || '?'}
                        </span>
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-900 dark:text-white truncate">{p.businessName}</p>
                      <p className="text-xs text-gray-500 dark:text-gray-400 truncate">
                        {p.city || p.category}
                      </p>
                    </div>
                    <div className="flex-shrink-0 text-right">
                      <span className="block text-xs text-gray-400">
                        {p.createdAt ? new Date(p.createdAt).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' }) : ''}
                      </span>
                      {/* D'où vient l'inscrit — réponse à « Comment avez-vous connu Opatam ? » */}
                      {p.acquisitionSource ? (
                        <span
                          title={p.acquisitionSource.detail || undefined}
                          className="inline-block mt-0.5 max-w-[150px] truncate rounded-full bg-red-50 dark:bg-red-500/10 text-red-600 dark:text-red-400 px-2 py-0.5 text-[10px] font-medium"
                        >
                          {acquisitionChannelLabel(p.acquisitionSource.channel)}
                          {p.acquisitionSource.channel === 'autre' && p.acquisitionSource.detail
                            ? ` · ${p.acquisitionSource.detail}`
                            : ''}
                        </span>
                      ) : (
                        <span className="inline-block mt-0.5 text-[10px] text-gray-300 dark:text-gray-600">
                          source inconnue
                        </span>
                      )}
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </div>

          {/* Frais encaisses dans une autre devise. Les additionner a
              l'euro donnerait un montant qui n'existe pas : ce sont des
              unites differentes et aucun taux n'est stocke. */}
          {autresDevises.length > 0 && (
            <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700/60 px-5 py-4">
              <h3 className="text-sm font-semibold text-gray-900 dark:text-white">
                Frais de service par devise
              </h3>
              <p className="mt-0.5 text-xs text-gray-500 dark:text-gray-400">
                Jamais additionnés : ce sont des unités différentes.
              </p>
              <div className="mt-3 space-y-1.5">
                {Object.entries(stats.serviceFeesByCurrency)
                  .sort((a, b) => b[1] - a[1])
                  .map(([devise, total]) => (
                    <div key={devise} className="flex items-baseline justify-between">
                      <span className="text-xs text-gray-500 dark:text-gray-400">{devise}</span>
                      <span className="text-sm font-semibold text-gray-900 dark:text-white">
                        {formatPrice(total, devise)}
                        <span className="ml-2 text-xs font-normal text-gray-400">
                          dont {formatPrice(stats.serviceFeesMonthByCurrency[devise] ?? 0, devise)} ce mois
                        </span>
                      </span>
                    </div>
                  ))}
              </div>
            </div>
          )}

          {/* Réservations AVEC acompte. Elles sont rares : sans bloc
              dédié elles n'apparaissent jamais dans la liste ci-dessous,
              alors que ce sont précisément celles qui rapportent. */}
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-emerald-100 dark:border-emerald-900/40">
            <div className="px-5 py-4 border-b border-gray-100 dark:border-gray-700 flex items-center justify-between">
              <h3 className="text-sm font-semibold text-gray-900 dark:text-white flex items-center gap-2">
                <Coins className="w-4 h-4 text-emerald-500" />
                Derniers frais perçus
              </h3>
              <span className="text-xs text-gray-400">
                {euros(stats.serviceFeesTotal)} depuis le début
              </span>
            </div>
            {recentSignups.depositBookings.length === 0 ? (
              <div className="p-5 text-center text-gray-400 text-sm">Aucun acompte encaissé</div>
            ) : (
              <div className="divide-y divide-gray-50 dark:divide-gray-700/50">
                {recentSignups.depositBookings.map((b) => (
                  <div key={b.id} className="flex items-center gap-3 px-5 py-3">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-900 dark:text-white truncate">
                        {b.clientName}
                        <span className="font-normal text-gray-500 dark:text-gray-400"> chez </span>
                        {b.providerId ? (
                          <Link href={`/admin/providers/${b.providerId}`} className="hover:underline">
                            {b.providerName}
                          </Link>
                        ) : (
                          b.providerName
                        )}
                      </p>
                      <p className="text-xs text-gray-500 dark:text-gray-400 truncate">
                        {b.serviceName}
                        {b.datetime
                          ? ` · RDV ${new Date(b.datetime).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' })}`
                          : ''}
                      </p>
                    </div>
                    {b.deposit && (
                      <div className="flex-shrink-0 text-right">
                        <p className="text-sm font-semibold text-emerald-600 dark:text-emerald-400">
                          {b.deposit.serviceFee > 0 ? `+${formatPrice(b.deposit.serviceFee, b.currency)}` : 'sans frais'}
                        </p>
                        <p className="text-[11px] text-gray-500 dark:text-gray-400">
                          acompte de {formatPrice(b.deposit.amount, b.currency)}
                          {b.deposit.status === 'refunded' ? ' · remboursé' : ''}
                        </p>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Dernières réservations — qui réserve chez qui : signal direct
              des prestataires qui travaillent. */}
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700/60">
            <div className="px-5 py-4 border-b border-gray-100 dark:border-gray-700 flex items-center justify-between">
              <h3 className="text-sm font-semibold text-gray-900 dark:text-white flex items-center gap-2">
                <Calendar className="w-4 h-4" />
                Dernières réservations
              </h3>
              <Link href="/admin/bookings" className="text-xs text-red-500 hover:text-red-600 transition-colors">
                Voir toutes
              </Link>
            </div>
            {recentSignups.bookings.length === 0 ? (
              <div className="p-5 text-center text-gray-400 text-sm">Aucune réservation</div>
            ) : (
              <div className="divide-y divide-gray-50 dark:divide-gray-700/50">
                {recentSignups.bookings.map((b) => (
                  <div key={b.id} className="flex items-center gap-3 px-5 py-3">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-900 dark:text-white truncate">
                        {b.clientName}
                        <span className="font-normal text-gray-500 dark:text-gray-400"> chez </span>
                        {b.providerId ? (
                          <Link
                            href={`/admin/providers/${b.providerId}`}
                            className="hover:underline"
                          >
                            {b.providerName}
                          </Link>
                        ) : (
                          b.providerName
                        )}
                      </p>
                      <p className="text-xs text-gray-500 dark:text-gray-400 truncate">
                        {b.serviceName}
                        {b.price > 0 ? ` · ${formatPrice(b.price, b.currency)}` : ''}
                        {/* L'acompte : c'est cette réservation-là qui
                            rapporte des frais de service. */}
                        {b.deposit && (
                          <span
                            className={
                              b.deposit.status === 'paid'
                                ? 'text-emerald-600 dark:text-emerald-400'
                                : b.deposit.status === 'refunded'
                                  ? 'text-gray-400'
                                  : 'text-amber-600 dark:text-amber-400'
                            }
                          >
                            {' · acompte '}
                            {formatPrice(b.deposit.amount, b.currency)}
                            {b.deposit.status === 'paid'
                              ? ''
                              : b.deposit.status === 'refunded'
                                ? ' (remboursé)'
                                : ' (en attente)'}
                          </span>
                        )}
                        {b.datetime
                          ? ` · RDV ${new Date(b.datetime).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}`
                          : ''}
                      </p>
                    </div>
                    <span
                      className={`text-[11px] font-medium px-2 py-0.5 rounded-full flex-shrink-0 ${
                        b.status === 'confirmed'
                          ? 'bg-green-50 text-green-700 dark:bg-green-900/30 dark:text-green-300'
                          : b.status === 'cancelled'
                            ? 'bg-red-50 text-red-600 dark:bg-red-900/30 dark:text-red-300'
                            : 'bg-gray-100 text-gray-500 dark:bg-gray-700 dark:text-gray-300'
                      }`}
                    >
                      {b.status === 'confirmed' ? 'Confirmée' : b.status === 'cancelled' ? 'Annulée' : b.status}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <BookingsByCategoryChart data={categoryData} />

        {/* Additional stats card */}
        <div className="bg-white dark:bg-gray-800 rounded-2xl p-5 shadow-sm border border-gray-100 dark:border-gray-700/60">
          <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-4">
            Indicateurs clés
          </h3>
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-500 dark:text-gray-400">Utilisateurs</span>
              <span className="text-sm font-semibold text-gray-900 dark:text-white">
                {stats.totalUsers}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-500 dark:text-gray-400">Clients</span>
              <span className="text-sm font-semibold text-gray-900 dark:text-white">
                {stats.totalClients}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-500 dark:text-gray-400">Prestataires inscrits</span>
              <span className="text-sm font-semibold text-gray-900 dark:text-white">
                {stats.totalProviders}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-500 dark:text-gray-400">Réservations (total)</span>
              <span className="text-sm font-semibold text-gray-900 dark:text-white">
                {stats.totalBookings}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-500 dark:text-gray-400">Taux no-show</span>
              <span className="text-sm font-semibold text-gray-900 dark:text-white">
                {stats.noshowRate}%
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-500 dark:text-gray-400">Conversion essai → payant</span>
              <span className="text-sm font-semibold text-gray-900 dark:text-white">
                {stats.trialConversionRate}%
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
