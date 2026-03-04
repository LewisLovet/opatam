import type { PaginatedResult, BookingFilters, BookingDetail } from './types';

const BASE_URL = '/api/admin/bookings';

function headers(adminUid: string) {
  return {
    'Content-Type': 'application/json',
    'x-admin-uid': adminUid,
  };
}

export const adminBookingService = {
  async getBookings(
    adminUid: string,
    filters: BookingFilters = {},
    page = 1,
    pageSize = 20
  ): Promise<PaginatedResult<any>> {
    const params = new URLSearchParams();
    params.set('page', String(page));
    params.set('pageSize', String(pageSize));

    if (filters.search) params.set('search', filters.search);
    if (filters.status && filters.status !== 'all') params.set('status', filters.status);
    if (filters.providerId) params.set('providerId', filters.providerId);
    if (filters.dateFrom) params.set('dateFrom', filters.dateFrom);
    if (filters.dateTo) params.set('dateTo', filters.dateTo);

    const res = await fetch(`${BASE_URL}?${params}`, { headers: headers(adminUid) });
    if (!res.ok) throw new Error('Erreur lors du chargement des r\u00e9servations');
    return res.json();
  },

  async getBookingDetail(adminUid: string, bookingId: string): Promise<BookingDetail> {
    const res = await fetch(`${BASE_URL}/${bookingId}`, { headers: headers(adminUid) });
    if (!res.ok) throw new Error('Erreur lors du chargement de la r\u00e9servation');
    return res.json();
  },

  async updateBookingStatus(
    adminUid: string,
    bookingId: string,
    status: string
  ): Promise<void> {
    const res = await fetch(`${BASE_URL}/${bookingId}`, {
      method: 'PATCH',
      headers: headers(adminUid),
      body: JSON.stringify({ status }),
    });
    if (!res.ok) throw new Error('Erreur lors de la mise \u00e0 jour');
  },
};
