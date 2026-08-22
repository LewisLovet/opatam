import type { DashboardStats, TrendData, CategoryData, RevenueStats, AnalyticsData, ActivityEvent, RecentSignups, StripeEconomics } from './types';
import { adminHeaders } from './adminFetch';

const BASE_URL = '/api/admin/stats';

export const adminStatsService = {
  async getDashboardStats(adminUid: string, fresh = false): Promise<DashboardStats> {
    // `fresh` bypasses the 5-min browser cache (used right after a manual recompute).
    const res = await fetch(fresh ? `${BASE_URL}?t=${Date.now()}` : BASE_URL, {
      headers: await adminHeaders(),
      ...(fresh ? { cache: 'no-store' as RequestCache } : {}),
    });
    if (!res.ok) throw new Error('Erreur lors du chargement des statistiques');
    return res.json();
  },

  async getSignupsTrend(adminUid: string, days = 30): Promise<TrendData[]> {
    const res = await fetch(`${BASE_URL}?type=signups-trend&days=${days}`, {
      headers: await adminHeaders(),
    });
    if (!res.ok) throw new Error('Erreur lors du chargement des tendances');
    return res.json();
  },

  async getBookingsTrend(adminUid: string, days = 30): Promise<TrendData[]> {
    const res = await fetch(`${BASE_URL}?type=bookings-trend&days=${days}`, {
      headers: await adminHeaders(),
    });
    if (!res.ok) throw new Error('Erreur lors du chargement des tendances');
    return res.json();
  },

  async getPageViewsTrend(adminUid: string, days = 30): Promise<TrendData[]> {
    const res = await fetch(`${BASE_URL}?type=pageviews-trend&days=${days}`, {
      headers: await adminHeaders(),
    });
    if (!res.ok) throw new Error('Erreur lors du chargement des tendances');
    return res.json();
  },

  async getBookingsByCategory(adminUid: string): Promise<CategoryData[]> {
    const res = await fetch(`${BASE_URL}?type=by-category`, {
      headers: await adminHeaders(),
    });
    if (!res.ok) throw new Error('Erreur lors du chargement des catégories');
    return res.json();
  },

  async getRevenueStats(adminUid: string): Promise<RevenueStats> {
    const res = await fetch(`${BASE_URL}?type=revenue`, {
      headers: await adminHeaders(),
    });
    if (!res.ok) throw new Error('Erreur lors du chargement des revenus');
    return res.json();
  },

  /** Économie Stripe complète — recettes ET coûts. Route distincte de
   *  `?type=revenue` : elle lit les transactions de solde, seul endroit où
   *  apparaissent les frais Connect. */
  async getStripeEconomics(adminUid: string): Promise<StripeEconomics> {
    const res = await fetch('/api/admin/stripe', { headers: await adminHeaders() });
    if (!res.ok) throw new Error('Erreur lors du chargement des données Stripe');
    return res.json();
  },

  async getAnalytics(adminUid: string): Promise<AnalyticsData> {
    const res = await fetch(`${BASE_URL}?type=analytics`, {
      headers: await adminHeaders(),
    });
    if (!res.ok) throw new Error('Erreur lors du chargement des analytics');
    return res.json();
  },

  async getRecentSignups(adminUid: string): Promise<RecentSignups> {
    const res = await fetch(`${BASE_URL}?type=recent-signups`, {
      headers: await adminHeaders(),
    });
    if (!res.ok) throw new Error('Erreur lors du chargement des inscriptions récentes');
    return res.json();
  },

  async getActivityFeed(adminUid: string): Promise<ActivityEvent[]> {
    const res = await fetch(`${BASE_URL}?type=activity`, {
      headers: await adminHeaders(),
    });
    if (!res.ok) throw new Error('Erreur lors du chargement de l\'activité');
    return res.json();
  },
};
