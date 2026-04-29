'use client';

import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import {
  Plus,
  Search,
  FileText,
  Eye,
  Loader2,
  AlertCircle,
  Sparkles,
  PlayCircle,
} from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import {
  ARTICLE_CATEGORY_LABELS,
  type ArticleCategory,
  type ArticleStatus,
} from '@booking-app/shared';
import {
  adminArticleService,
  type ArticleListItem,
} from '@/services/admin/adminArticleService';
import { youtubeThumbnailUrl } from '@/lib/youtube';

/**
 * Same fallback chain as the public ArticleCard:
 *  cover → custom video poster → YouTube auto-thumb → null (icon fallback)
 */
function resolveThumbnail(a: ArticleListItem): string | null {
  if (a.coverImageURL) return a.coverImageURL;
  if (a.videoCoverURL) return a.videoCoverURL;
  return youtubeThumbnailUrl(a.videoUrl, 'hq');
}

type StatusFilter = ArticleStatus | 'all';
type CategoryFilter = ArticleCategory | 'all';

export default function AdminArticlesPage() {
  const { user } = useAuth();
  const [items, setItems] = useState<ArticleListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [categoryFilter, setCategoryFilter] = useState<CategoryFilter>('all');
  const [search, setSearch] = useState('');

  const load = useCallback(async () => {
    if (!user?.id) return;
    setLoading(true);
    setError(null);
    try {
      const data = await adminArticleService.list(user.id, {
        status: statusFilter,
        category: categoryFilter !== 'all' ? categoryFilter : undefined,
      });
      setItems(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erreur inconnue');
    } finally {
      setLoading(false);
    }
  }, [user?.id, statusFilter, categoryFilter]);

  useEffect(() => {
    load();
  }, [load]);

  const filtered = items.filter((a) => {
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    return a.title.toLowerCase().includes(q) || a.slug.toLowerCase().includes(q);
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
            <FileText className="w-6 h-6 text-primary-500" />
            Blog
          </h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            {loading
              ? 'Chargement…'
              : `${items.length} article${items.length > 1 ? 's' : ''}`}
          </p>
        </div>
        <Link
          href="/admin/articles/new"
          className="inline-flex items-center justify-center gap-1.5 px-4 py-2 rounded-lg bg-primary-600 text-white text-sm font-semibold hover:bg-primary-700 transition-colors"
        >
          <Plus className="w-4 h-4" />
          Nouvel article
        </Link>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            placeholder="Rechercher par titre ou slug…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-sm text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-primary-500"
          />
        </div>

        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value as StatusFilter)}
          className="px-4 py-2.5 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary-500"
        >
          <option value="all">Tous statuts</option>
          <option value="published">Publiés</option>
          <option value="draft">Brouillons</option>
        </select>

        <select
          value={categoryFilter}
          onChange={(e) => setCategoryFilter(e.target.value as CategoryFilter)}
          className="px-4 py-2.5 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary-500"
        >
          <option value="all">Toutes catégories</option>
          {(Object.keys(ARTICLE_CATEGORY_LABELS) as ArticleCategory[]).map((c) => (
            <option key={c} value={c}>
              {ARTICLE_CATEGORY_LABELS[c]}
            </option>
          ))}
        </select>
      </div>

      {/* Error */}
      {error && (
        <div className="flex items-start gap-2 p-3 rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-sm text-red-700 dark:text-red-400">
          <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
          <p>{error}</p>
        </div>
      )}

      {/* Loading */}
      {loading && (
        <div className="flex items-center justify-center h-48">
          <Loader2 className="w-6 h-6 animate-spin text-primary-500" />
        </div>
      )}

      {/* Empty state */}
      {!loading && filtered.length === 0 && (
        <div className="rounded-xl border border-dashed border-gray-200 dark:border-gray-700 p-10 text-center">
          <FileText className="w-10 h-10 mx-auto text-gray-300 dark:text-gray-600 mb-3" />
          <p className="text-sm font-medium text-gray-700 dark:text-gray-300">
            {items.length === 0 ? 'Aucun article pour le moment' : 'Aucun résultat'}
          </p>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
            {items.length === 0
              ? 'Créez votre premier article pour commencer.'
              : 'Essayez d’ajuster les filtres.'}
          </p>
          {items.length === 0 && (
            <Link
              href="/admin/articles/new"
              className="inline-flex items-center gap-1.5 mt-4 px-4 py-2 rounded-lg bg-primary-600 text-white text-sm font-semibold hover:bg-primary-700"
            >
              <Plus className="w-4 h-4" />
              Créer un article
            </Link>
          )}
        </div>
      )}

      {/* List */}
      {!loading && filtered.length > 0 && (
        <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 overflow-hidden">
          <table className="w-full">
            <thead className="bg-gray-50 dark:bg-gray-900/50 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">
              <tr>
                <th className="px-4 py-3">Article</th>
                <th className="px-4 py-3 hidden md:table-cell">Catégorie</th>
                <th className="px-4 py-3">Statut</th>
                <th className="px-4 py-3 hidden lg:table-cell">Vues</th>
                <th className="px-4 py-3 hidden lg:table-cell">Mis à jour</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
              {filtered.map((a) => (
                <tr
                  key={a.id}
                  className="hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors"
                >
                  <td className="px-4 py-3">
                    <Link
                      href={`/admin/articles/${a.id}`}
                      className="flex items-center gap-3 group"
                    >
                      {(() => {
                        const thumb = resolveThumbnail(a);
                        return (
                          <div className="w-12 h-12 rounded-lg overflow-hidden bg-gray-100 dark:bg-gray-700 flex-shrink-0 relative">
                            {thumb ? (
                              <>
                                {/* eslint-disable-next-line @next/next/no-img-element */}
                                <img
                                  src={thumb}
                                  alt=""
                                  className="w-full h-full object-cover"
                                />
                                {a.videoUrl && (
                                  <span className="absolute inset-0 flex items-center justify-center bg-black/30">
                                    <PlayCircle className="w-4 h-4 text-white" />
                                  </span>
                                )}
                              </>
                            ) : (
                              <div className="w-full h-full flex items-center justify-center">
                                <FileText className="w-5 h-5 text-gray-400" />
                              </div>
                            )}
                          </div>
                        );
                      })()}
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <p className="font-medium text-gray-900 dark:text-white text-sm group-hover:text-primary-600 dark:group-hover:text-primary-400 truncate">
                            {a.title || '(sans titre)'}
                          </p>
                          {a.isFeatured && (
                            <span className="inline-flex items-center gap-0.5 text-[10px] font-semibold bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400 px-1.5 py-0.5 rounded">
                              <Sparkles className="w-2.5 h-2.5" />À LA UNE
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-gray-500 dark:text-gray-400 font-mono truncate">
                          /blog/{a.slug}
                        </p>
                      </div>
                    </Link>
                  </td>
                  <td className="px-4 py-3 hidden md:table-cell text-sm text-gray-600 dark:text-gray-400">
                    {ARTICLE_CATEGORY_LABELS[a.category]}
                  </td>
                  <td className="px-4 py-3">
                    <StatusBadge status={a.status} />
                  </td>
                  <td className="px-4 py-3 hidden lg:table-cell text-sm text-gray-500 dark:text-gray-400">
                    <span className="inline-flex items-center gap-1">
                      <Eye className="w-3.5 h-3.5" />
                      {a.viewCount.toLocaleString('fr-FR')}
                    </span>
                  </td>
                  <td className="px-4 py-3 hidden lg:table-cell text-xs text-gray-500 dark:text-gray-400">
                    {a.updatedAt
                      ? new Date(a.updatedAt).toLocaleDateString('fr-FR', {
                          day: '2-digit',
                          month: 'short',
                          year: 'numeric',
                        })
                      : '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function StatusBadge({ status }: { status: ArticleStatus }) {
  if (status === 'published') {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 text-xs font-medium">
        <span className="w-1.5 h-1.5 rounded-full bg-green-500" />
        Publié
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400 text-xs font-medium">
      <span className="w-1.5 h-1.5 rounded-full bg-gray-400" />
      Brouillon
    </span>
  );
}
