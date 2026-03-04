'use client';

import { useEffect, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { adminStatsService } from '@/services/admin';
import type { AnalyticsData } from '@/services/admin/types';
import { Loader } from '@/components/ui';
import {
  TopCitiesTable,
  TopProvidersTable,
  SignupsByMonthChart,
  PeakHoursChart,
  CategoryBreakdownTable,
} from './components';

export default function AnalyticsPage() {
  const { user } = useAuth();
  const [data, setData] = useState<AnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!user?.id) return;

    const load = async () => {
      try {
        const analytics = await adminStatsService.getAnalytics(user.id);
        setData(analytics);
      } catch (err) {
        console.error('Error loading analytics:', err);
        setError('Erreur lors du chargement des analytics');
      } finally {
        setLoading(false);
      }
    };

    load();
  }, [user?.id]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <Loader size="lg" />
      </div>
    );
  }

  if (error || !data) {
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
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Analytics</h1>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
          Statistiques avancées de la plateforme
        </p>
      </div>

      {/* Top cities */}
      <TopCitiesTable data={data.topCities} />

      {/* Top providers */}
      <TopProvidersTable data={data.topProviders} />

      {/* Charts grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <SignupsByMonthChart data={data.signupsByMonth} />
        <PeakHoursChart data={data.peakHours} />
      </div>

      {/* Category breakdown */}
      <CategoryBreakdownTable data={data.categoryBreakdown} />
    </div>
  );
}
