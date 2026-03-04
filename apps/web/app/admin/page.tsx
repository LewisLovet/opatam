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
} from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { adminStatsService } from '@/services/admin';
import type { DashboardStats, TrendData, CategoryData } from '@/services/admin/types';
import { AdminStatCard } from './components/AdminStatCard';
import { SignupsChart } from './components/SignupsChart';
import { BookingsTrendChart } from './components/BookingsTrendChart';
import { BookingsByCategoryChart } from './components/BookingsByCategoryChart';
import { Loader } from '@/components/ui';

export default function AdminDashboardPage() {
  const { user } = useAuth();
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [signupsTrend, setSignupsTrend] = useState<TrendData[]>([]);
  const [bookingsTrend, setBookingsTrend] = useState<TrendData[]>([]);
  const [categoryData, setCategoryData] = useState<CategoryData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!user?.id) return;

    const loadData = async () => {
      try {
        const [statsData, signups, bookings, categories] = await Promise.all([
          adminStatsService.getDashboardStats(user.id),
          adminStatsService.getSignupsTrend(user.id, 30),
          adminStatsService.getBookingsTrend(user.id, 30),
          adminStatsService.getBookingsByCategory(user.id),
        ]);

        setStats(statsData);
        setSignupsTrend(signups);
        setBookingsTrend(bookings);
        setCategoryData(categories);
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
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Dashboard</h1>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
          Vue d&apos;ensemble de la plateforme
        </p>
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
          label="Prestataires actifs"
          value={stats.activeProviders}
          icon={<Briefcase className="w-5 h-5 text-red-500" />}
        />
        <AdminStatCard
          label="Réservations"
          value={stats.totalBookings}
          icon={<Calendar className="w-5 h-5 text-red-500" />}
          trend={{ value: stats.bookingsToday, label: "aujourd'hui" }}
        />
        <AdminStatCard
          label="MRR"
          value={stats.mrr}
          icon={<DollarSign className="w-5 h-5 text-red-500" />}
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

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <SignupsChart data={signupsTrend} />
        <BookingsTrendChart data={bookingsTrend} />
      </div>

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
