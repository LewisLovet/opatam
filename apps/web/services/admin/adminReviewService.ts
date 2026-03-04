import type { PaginatedResult, ReviewFilters } from './types';

const BASE_URL = '/api/admin/reviews';

function headers(adminUid: string) {
  return {
    'Content-Type': 'application/json',
    'x-admin-uid': adminUid,
  };
}

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
    if (filters.providerId) params.set('providerId', filters.providerId);
    if (filters.dateFrom) params.set('dateFrom', filters.dateFrom);
    if (filters.dateTo) params.set('dateTo', filters.dateTo);

    const res = await fetch(`${BASE_URL}?${params}`, { headers: headers(adminUid) });
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
      headers: headers(adminUid),
      body: JSON.stringify({ isPublic }),
    });
    if (!res.ok) throw new Error('Erreur lors de la modification');
  },

  async deleteReview(adminUid: string, reviewId: string): Promise<void> {
    const res = await fetch(`${BASE_URL}/${reviewId}`, {
      method: 'DELETE',
      headers: headers(adminUid),
    });
    if (!res.ok) throw new Error('Erreur lors de la suppression');
  },
};
