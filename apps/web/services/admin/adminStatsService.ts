import type { DashboardStats, TrendData, CategoryData, RevenueStats, AnalyticsData, ActivityEvent } from './types';

const BASE_URL = '/api/admin/stats';

function headers(adminUid: string) {
  return {
    'Content-Type': 'application/json',
    'x-admin-uid': adminUid,
  };
}

export const adminStatsService = {
  async getDashboardStats(adminUid: string): Promise<DashboardStats> {
    const res = await fetch(BASE_URL, { headers: headers(adminUid) });
    if (!res.ok) throw new Error('Erreur lors du chargement des statistiques');
    return res.json();
  },

  async getSignupsTrend(adminUid: string, days = 30): Promise<TrendData[]> {
    const res = await fetch(`${BASE_URL}?type=signups-trend&days=${days}`, {
      headers: headers(adminUid),
    });
    if (!res.ok) throw new Error('Erreur lors du chargement des tendances');
    return res.json();
  },

  async getBookingsTrend(adminUid: string, days = 30): Promise<TrendData[]> {
    const res = await fetch(`${BASE_URL}?type=bookings-trend&days=${days}`, {
      headers: headers(adminUid),
    });
    if (!res.ok) throw new Error('Erreur lors du chargement des tendances');
    return res.json();
  },

  async getBookingsByCategory(adminUid: string): Promise<CategoryData[]> {
    const res = await fetch(`${BASE_URL}?type=by-category`, {
      headers: headers(adminUid),
    });
    if (!res.ok) throw new Error('Erreur lors du chargement des catégories');
    return res.json();
  },

  async getRevenueStats(adminUid: string): Promise<RevenueStats> {
    const res = await fetch(`${BASE_URL}?type=revenue`, {
      headers: headers(adminUid),
    });
    if (!res.ok) throw new Error('Erreur lors du chargement des revenus');
    return res.json();
  },

  async getAnalytics(adminUid: string): Promise<AnalyticsData> {
    const res = await fetch(`${BASE_URL}?type=analytics`, {
      headers: headers(adminUid),
    });
    if (!res.ok) throw new Error('Erreur lors du chargement des analytics');
    return res.json();
  },

  async getActivityFeed(adminUid: string): Promise<ActivityEvent[]> {
    const res = await fetch(`${BASE_URL}?type=activity`, {
      headers: headers(adminUid),
    });
    if (!res.ok) throw new Error('Erreur lors du chargement de l\'activité');
    return res.json();
  },
};
