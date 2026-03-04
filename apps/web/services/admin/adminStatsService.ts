import type { DashboardStats, TrendData, CategoryData, RevenueStats } from './types';

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
};
