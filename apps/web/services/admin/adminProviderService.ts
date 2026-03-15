import type { PaginatedResult, ProviderFilters, ProviderDetail } from './types';

const BASE_URL = '/api/admin/providers';

function headers(adminUid: string) {
  return {
    'Content-Type': 'application/json',
    'x-admin-uid': adminUid,
  };
}

export const adminProviderService = {
  async getProviders(
    adminUid: string,
    filters: ProviderFilters = {},
    page = 1,
    pageSize = 20
  ): Promise<PaginatedResult<any>> {
    const params = new URLSearchParams();
    params.set('page', String(page));
    params.set('pageSize', String(pageSize));

    if (filters.search) params.set('search', filters.search);
    if (filters.plan) params.set('plan', filters.plan);
    if (filters.isPublished && filters.isPublished !== 'all') params.set('isPublished', filters.isPublished);
    if (filters.isVerified && filters.isVerified !== 'all') params.set('isVerified', filters.isVerified);
    if (filters.category) params.set('category', filters.category);

    const res = await fetch(`${BASE_URL}?${params}`, { headers: headers(adminUid) });
    if (!res.ok) throw new Error('Erreur lors du chargement des prestataires');
    return res.json();
  },

  async getProviderDetail(adminUid: string, providerId: string): Promise<ProviderDetail> {
    const res = await fetch(`${BASE_URL}/${providerId}`, { headers: headers(adminUid) });
    if (!res.ok) throw new Error('Erreur lors du chargement du prestataire');
    return res.json();
  },

  async toggleVerified(
    adminUid: string,
    providerId: string,
    isVerified: boolean
  ): Promise<void> {
    const res = await fetch(`${BASE_URL}/${providerId}`, {
      method: 'PATCH',
      headers: headers(adminUid),
      body: JSON.stringify({ isVerified }),
    });
    if (!res.ok) throw new Error('Erreur lors de la modification');
  },

  async togglePublished(
    adminUid: string,
    providerId: string,
    isPublished: boolean
  ): Promise<void> {
    const res = await fetch(`${BASE_URL}/${providerId}`, {
      method: 'PATCH',
      headers: headers(adminUid),
      body: JSON.stringify({ isPublished }),
    });
    if (!res.ok) throw new Error('Erreur lors de la modification');
  },

  async fixRegion(
    adminUid: string,
    providerId: string
  ): Promise<{ providerId: string; fixed: boolean; region?: string; error?: string }> {
    const res = await fetch(`${BASE_URL}/fix-regions`, {
      method: 'POST',
      headers: headers(adminUid),
      body: JSON.stringify({ providerId }),
    });
    if (!res.ok) throw new Error('Erreur lors de la correction de la région');
    return res.json();
  },

  async deleteProvider(
    adminUid: string,
    providerId: string
  ): Promise<void> {
    const res = await fetch(`${BASE_URL}/${providerId}`, {
      method: 'DELETE',
      headers: headers(adminUid),
    });
    if (!res.ok) throw new Error('Erreur lors de la suppression du compte');
  },

  async fixAllRegions(
    adminUid: string
  ): Promise<{ total: number; fixed: number; skipped: number; errors?: string[] }> {
    const res = await fetch(`${BASE_URL}/fix-regions`, {
      method: 'POST',
      headers: headers(adminUid),
      body: JSON.stringify({}),
    });
    if (!res.ok) throw new Error('Erreur lors de la correction des régions');
    return res.json();
  },
};
