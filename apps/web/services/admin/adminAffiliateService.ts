const BASE_URL = '/api/admin/affiliates';

function headers(adminUid: string) {
  return {
    'Content-Type': 'application/json',
    'x-admin-uid': adminUid,
  };
}

export const adminAffiliateService = {
  async getAffiliates(adminUid: string) {
    const res = await fetch(BASE_URL, { headers: headers(adminUid) });
    if (!res.ok) throw new Error('Erreur lors du chargement des affiliés');
    return res.json();
  },

  async createAffiliate(
    adminUid: string,
    data: {
      name: string;
      email: string;
      code: string;
      commission: number;
      discount?: number | null;
      discountDuration?: string | null;
    }
  ) {
    const res = await fetch(BASE_URL, {
      method: 'POST',
      headers: headers(adminUid),
      body: JSON.stringify(data),
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || 'Erreur lors de la création');
    }
    return res.json();
  },

  async updateAffiliate(
    adminUid: string,
    affiliateId: string,
    data: { commission?: number; discount?: number | null; discountDuration?: string | null; isActive?: boolean }
  ) {
    const res = await fetch(BASE_URL, {
      method: 'PATCH',
      headers: headers(adminUid),
      body: JSON.stringify({ affiliateId, ...data }),
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || 'Erreur lors de la mise à jour');
    }
    return res.json();
  },

  async deleteAffiliate(adminUid: string, affiliateId: string) {
    const res = await fetch(BASE_URL, {
      method: 'DELETE',
      headers: headers(adminUid),
      body: JSON.stringify({ affiliateId }),
    });
    if (!res.ok) throw new Error('Erreur lors de la suppression');
    return res.json();
  },
};
