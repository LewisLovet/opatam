/**
 * Analytics Service
 * Tracks page views on provider profiles with atomic increment.
 * Only `stats.pageViews.today` is incremented in real-time (1 write per visit).
 * Nightly Cloud Function aggregates into total/last7Days/last30Days.
 */

import {
  db,
  collections,
  doc,
  updateDoc,
  increment,
  onSnapshot,
} from '../lib/firestore';
import type { PageViewStats } from '@booking-app/shared';

const DEFAULT_PAGE_VIEW_STATS: PageViewStats = {
  today: 0,
  total: 0,
  last7Days: 0,
  last30Days: 0,
};

class AnalyticsService {
  /**
   * Increment today's page view count on a provider document.
   * Single atomic write — no read required.
   */
  async trackPageView(providerId: string): Promise<void> {
    const providerRef = doc(collections.providers(), providerId);
    await updateDoc(providerRef, {
      'stats.pageViews.today': increment(1),
    });
  }

  /**
   * Subscribe to real-time page view stats from the provider document.
   * Returns an unsubscribe function.
   */
  subscribeToPageViews(
    providerId: string,
    callback: (stats: PageViewStats) => void,
  ): () => void {
    const providerRef = doc(collections.providers(), providerId);
    return onSnapshot(providerRef, (snap) => {
      const data = snap.data();
      const raw = data?.stats?.pageViews;
      // Ensure all fields are numbers (missing fields from Firestore → 0)
      callback({
        today: raw?.today ?? 0,
        total: raw?.total ?? 0,
        last7Days: raw?.last7Days ?? 0,
        last30Days: raw?.last30Days ?? 0,
      });
    });
  }

  /**
   * Get page view stats with today added to totals (for UI display).
   * This computes the "live" values without waiting for nightly aggregation.
   */
  computeLiveStats(stats: PageViewStats): {
    today: number;
    total: number;
    last7Days: number;
    last30Days: number;
  } {
    const today = stats.today || 0;
    const total = stats.total || 0;
    const last7 = stats.last7Days || 0;
    const last30 = stats.last30Days || 0;
    return {
      today,
      total: total + today,
      last7Days: last7 + today,
      last30Days: last30 + today,
    };
  }
}

export const analyticsService = new AnalyticsService();
export { AnalyticsService };
