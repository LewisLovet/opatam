import type { PaginatedResult, ReviewFilters } from './types';
import { adminHeaders } from './adminFetch';

const BASE_URL = '/api/admin/reviews';

export const adminReviewService = {
  async getReviews(
    adminUid: string,
    filters: ReviewFilters = {},
    page = 1,
    pageSize = 20
  ): Promise<PaginatedResult<any>> {
    const params = new URLSearchParams();
    params.set('page', String(page));
    params.set('pageSize', String(pageSize));

    if (filters.search) params.set('search', filters.search);
    if (filters.minRating) params.set('minRating', String(filters.minRating));
    if (filters.maxRating) params.set('maxRating', String(filters.maxRating));
    if (filters.isPublic && filters.isPublic !== 'all') params.set('isPublic', filters.isPublic);
    if (filters.imported === 'true') params.set('imported', 'true');
    if (filters.providerId) params.set('providerId', filters.providerId);
    if (filters.dateFrom) params.set('dateFrom', filters.dateFrom);
    if (filters.dateTo) params.set('dateTo', filters.dateTo);

    const res = await fetch(`${BASE_URL}?${params}`, { headers: await adminHeaders() });
    if (!res.ok) throw new Error('Erreur lors du chargement des avis');
    return res.json();
  },

  async toggleReviewVisibility(
    adminUid: string,
    reviewId: string,
    isPublic: boolean
  ): Promise<void> {
    const res = await fetch(`${BASE_URL}/${reviewId}`, {
      method: 'PATCH',
      headers: await adminHeaders(),
      body: JSON.stringify({ isPublic }),
    });
    if (!res.ok) throw new Error('Erreur lors de la modification');
  },

  async deleteReview(adminUid: string, reviewId: string): Promise<void> {
    const res = await fetch(`${BASE_URL}/${reviewId}`, {
      method: 'DELETE',
      headers: await adminHeaders(),
    });
    if (!res.ok) throw new Error('Erreur lors de la suppression');
  },

  async deleteImportedReviews(
    adminUid: string,
    providerId: string,
    source?: string
  ): Promise<{ deleted: number }> {
    const res = await fetch(`${BASE_URL}/bulk-delete-imported`, {
      method: 'POST',
      headers: await adminHeaders(),
      body: JSON.stringify({ providerId, ...(source ? { source } : {}) }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data?.error || 'Erreur lors de la suppression');
    return data;
  },

  async importReviews(
    adminUid: string,
    payload: {
      providerId: string;
      source: string;
      notifyProvider?: boolean;
      reviews: {
        rating: number;
        createdAt: string; // ISO
        comment?: string | null;
        serviceLabel?: string | null;
        sourceRef?: string | null;
      }[];
    }
  ): Promise<{ created: number; skipped: number; reportSent?: boolean; errors?: string[] }> {
    const res = await fetch(`${BASE_URL}/import`, {
      method: 'POST',
      headers: await adminHeaders(),
      body: JSON.stringify(payload),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data?.error || "Erreur lors de l'import");
    return data;
  },
};
