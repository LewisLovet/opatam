'use client';

import { useEffect, useState } from 'react';
import {
  Users,
  Briefcase,
  Calendar,
  TrendingUp,
  Star,
  DollarSign,
  UserPlus,
  XCircle,
  RefreshCw,
  Eye,
  CalendarCheck,
} from 'lucide-react';
import Link from 'next/link';
import { getFunctions, httpsCallable } from 'firebase/functions';
import { app } from '@booking-app/firebase';
import { useAuth } from '@/contexts/AuthContext';
import { adminStatsService } from '@/services/admin';
import type { DashboardStats, TrendData, CategoryData, RecentSignups } from '@/services/admin/types';
import { AdminStatCard } from './components/AdminStatCard';
import { SignupsChart } from './components/SignupsChart';
import { BookingsTrendChart } from './components/BookingsTrendChart';
import { BookingsByCategoryChart } from './components/BookingsByCategoryChart';
import { PageViewsTrendChart } from './components/PageViewsTrendChart';
import { Loader } from '@/components/ui';

export default function AdminDashboardPage() {
  const { user } = useAuth();
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [signupsTrend, setSignupsTrend] = useState<TrendData[]>([]);
  const [bookingsTrend, setBookingsTrend] = useState<TrendData[]>([]);
  const [pageViewsTrend, setPageViewsTrend] = useState<TrendData[]>([]);
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
        const [statsData, signups, bookings, pageViews, categories, recent] = await Promise.all([
          adminStatsService.getDashboardStats(user.id),
          adminStatsService.getSignupsTrend(user.id, 30),
          adminStatsService.getBookingsTrend(user.id, 30),
          adminStatsService.getPageViewsTrend(user.id, 30),
          adminStatsService.getBookingsByCategory(user.id),
          adminStatsService.getRecentSignups(user.id),
        ]);

        setStats(statsData);
        setSignupsTrend(signups);
        setBookingsTrend(bookings);
        setPageViewsTrend(pageViews);
        setCategoryData(categories);
        setRecentSignups(recent);
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

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Dashboard</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            Vue d&apos;ensemble de la plateforme
          </p>
        </div>
        <button
          type="button"
          onClick={handleRecompute}
          disabled={recomputing}
          title="Recompte les stats depuis la source (exclut les comptes de test) — corrige toute dérive"
          className="inline-flex items-center gap-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 px-3 py-2 text-sm font-medium text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-50 shrink-0"
        >
          <RefreshCw className={`w-4 h-4 ${recomputing ? 'animate-spin' : ''}`} />
          {recomputing ? 'Recalcul…' : 'Recalculer'}
        </button>
      </div>

      {/* KPI Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <AdminStatCard
          label="Utilisateurs"
          value={stats.totalUsers}
          icon={<Users className="w-5 h-5 text-red-500" />}
          trend={{ value: stats.newSignupsToday, label: "aujourd'hui" }}
        />
        <AdminStatCard
          label="Prestataires payants"
          value={stats.activeProviders}
          icon={<Briefcase className="w-5 h-5 text-red-500" />}
        />
        <AdminStatCard
          label="Encaissé (ce mois)"
          value={stats.collectedThisMonth}
          icon={<DollarSign className="w-5 h-5 text-emerald-500" />}
          format="currency"
        />
        <AdminStatCard
          label="MRR net"
          value={stats.mrr}
          icon={<TrendingUp className="w-5 h-5 text-red-500" />}
          format="currency"
        />
      </div>

      {/* Second row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <AdminStatCard
          label="Inscriptions (semaine)"
          value={stats.newSignupsWeek}
          icon={<UserPlus className="w-5 h-5 text-red-500" />}
        />
        <AdminStatCard
          label="Réservations (mois)"
          value={stats.bookingsMonth}
          icon={<TrendingUp className="w-5 h-5 text-red-500" />}
          trend={{ value: stats.bookingsToday, label: "aujourd'hui" }}
        />
        <AdminStatCard
          label="Note moyenne"
          value={stats.averageRating}
          icon={<Star className="w-5 h-5 text-red-500" />}
        />
        <AdminStatCard
          label="Taux d'annulation"
          value={stats.cancellationRate}
          icon={<XCircle className="w-5 h-5 text-red-500" />}
          format="percentage"
        />
      </div>

      {/* Third row — total bookings + page views */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <AdminStatCard
          label="Réservations (total)"
          value={stats.totalBookings}
          icon={<CalendarCheck className="w-5 h-5 text-red-500" />}
        />
        <AdminStatCard
          label="Vues des pages (aujourd'hui)"
          value={stats.pageViewsToday}
          icon={<Eye className="w-5 h-5 text-violet-500" />}
        />
        <AdminStatCard
          label="Vues (30 jours)"
          value={stats.pageViews30Days}
          icon={<Eye className="w-5 h-5 text-violet-500" />}
        />
        <AdminStatCard
          label="Vues (total)"
          value={stats.pageViewsTotal}
          icon={<Eye className="w-5 h-5 text-violet-500" />}
        />
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <SignupsChart data={signupsTrend} />
        <BookingsTrendChart data={bookingsTrend} />
        <PageViewsTrendChart data={pageViewsTrend} />
      </div>

      {/* Recent signups */}
      {recentSignups && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Derniers inscrits — onglets Prestataires / Clients */}
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700">
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
                      <p className="text-xs text-gray-500 dark:text-gray-400">
                        {p.city || p.category}
                      </p>
                    </div>
                    <span className="text-xs text-gray-400 flex-shrink-0">
                      {p.createdAt ? new Date(p.createdAt).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' }) : ''}
                    </span>
                  </Link>
                ))}
              </div>
            )}
          </div>

          {/* Dernières réservations — qui réserve chez qui : signal direct
              des prestataires qui travaillent. */}
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700">
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
                        {b.price > 0 ? ` · ${(b.price / 100).toLocaleString('fr-FR')} €` : ''}
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
        <div className="bg-white dark:bg-gray-800 rounded-xl p-5 shadow-sm border border-gray-100 dark:border-gray-700">
          <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-4">
            Indicateurs clés
          </h3>
          <div className="space-y-4">
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
              <span className="text-sm text-gray-500 dark:text-gray-400">Inscriptions (mois)</span>
              <span className="text-sm font-semibold text-gray-900 dark:text-white">
                {stats.newSignupsMonth}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-500 dark:text-gray-400">Réservations (semaine)</span>
              <span className="text-sm font-semibold text-gray-900 dark:text-white">
                {stats.bookingsWeek}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-500 dark:text-gray-400">Taux no-show</span>
              <span className="text-sm font-semibold text-gray-900 dark:text-white">
                {stats.noshowRate}%
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-500 dark:text-gray-400">Conversion trial</span>
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
