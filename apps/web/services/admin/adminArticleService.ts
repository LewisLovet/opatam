import type { ArticleCategory, ArticleStatus, CreateArticleInput, UpdateArticleInput } from '@booking-app/shared';

const BASE_URL = '/api/admin/articles';

function headers(adminUid: string) {
  return {
    'Content-Type': 'application/json',
    'x-admin-uid': adminUid,
  };
}

export interface ArticleListItem {
  id: string;
  slug: string;
  title: string;
  excerpt: string;
  coverImageURL: string | null;
  category: ArticleCategory;
  isFeatured: boolean;
  videoUrl: string | null;
  videoCoverURL: string | null;
  authorName: string;
  status: ArticleStatus;
  publishedAt: string | null;  // ISO
  viewCount: number;
  updatedAt: string | null;    // ISO
}

export interface ArticleDetail extends ArticleListItem {
  body: string;
  videoCoverURL: string | null;
  authorPhotoURL: string | null;
  seoTitle: string | null;
  seoDescription: string | null;
  ogImageURL: string | null;
  createdAt: string | null;    // ISO
}

export interface ArticleListFilters {
  status?: ArticleStatus | 'all';
  category?: ArticleCategory;
}

export const adminArticleService = {
  async list(adminUid: string, filters: ArticleListFilters = {}): Promise<ArticleListItem[]> {
    const params = new URLSearchParams();
    if (filters.status && filters.status !== 'all') params.set('status', filters.status);
    if (filters.category) params.set('category', filters.category);

    const res = await fetch(`${BASE_URL}${params.toString() ? `?${params}` : ''}`, {
      headers: headers(adminUid),
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      throw new Error(data.error || 'Erreur lors du chargement des articles');
    }
    const data = await res.json();
    return data.items as ArticleListItem[];
  },

  async get(adminUid: string, articleId: string): Promise<ArticleDetail> {
    const res = await fetch(`${BASE_URL}/${articleId}`, { headers: headers(adminUid) });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      throw new Error(data.error || 'Erreur lors du chargement');
    }
    return res.json() as Promise<ArticleDetail>;
  },

  async create(adminUid: string, input: CreateArticleInput): Promise<{ id: string }> {
    const res = await fetch(BASE_URL, {
      method: 'POST',
      headers: headers(adminUid),
      body: JSON.stringify(input),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      throw new Error(data.error || 'Erreur lors de la création');
    }
    return data as { id: string };
  },

  async update(
    adminUid: string,
    articleId: string,
    input: UpdateArticleInput
  ): Promise<void> {
    const res = await fetch(`${BASE_URL}/${articleId}`, {
      method: 'PUT',
      headers: headers(adminUid),
      body: JSON.stringify(input),
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      throw new Error(data.error || 'Erreur lors de la mise à jour');
    }
  },

  async delete(adminUid: string, articleId: string): Promise<void> {
    const res = await fetch(`${BASE_URL}/${articleId}`, {
      method: 'DELETE',
      headers: headers(adminUid),
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      throw new Error(data.error || 'Erreur lors de la suppression');
    }
  },
};
