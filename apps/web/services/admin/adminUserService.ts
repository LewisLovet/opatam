import type { PaginatedResult, UserFilters, UserDetail } from './types';

const BASE_URL = '/api/admin/users';

function headers(adminUid: string) {
  return {
    'Content-Type': 'application/json',
    'x-admin-uid': adminUid,
  };
}

export const adminUserService = {
  async getUsers(
    adminUid: string,
    filters: UserFilters = {},
    page = 1,
    pageSize = 20
  ): Promise<PaginatedResult<any>> {
    const params = new URLSearchParams();
    params.set('page', String(page));
    params.set('pageSize', String(pageSize));

    if (filters.search) params.set('search', filters.search);
    if (filters.role && filters.role !== 'all') params.set('role', filters.role);
    if (filters.dateFrom) params.set('dateFrom', filters.dateFrom);
    if (filters.dateTo) params.set('dateTo', filters.dateTo);
    if (filters.city) params.set('city', filters.city);

    const res = await fetch(`${BASE_URL}?${params}`, { headers: headers(adminUid) });
    if (!res.ok) throw new Error('Erreur lors du chargement des utilisateurs');
    return res.json();
  },

  async getUserDetail(adminUid: string, userId: string): Promise<UserDetail> {
    const res = await fetch(`${BASE_URL}/${userId}`, { headers: headers(adminUid) });
    if (!res.ok) throw new Error('Erreur lors du chargement de l\'utilisateur');
    return res.json();
  },

  async toggleUserDisabled(
    adminUid: string,
    userId: string,
    disabled: boolean
  ): Promise<void> {
    const res = await fetch(`${BASE_URL}/${userId}`, {
      method: 'PATCH',
      headers: headers(adminUid),
      body: JSON.stringify({ disabled }),
    });
    if (!res.ok) throw new Error('Erreur lors de la modification');
  },
};
