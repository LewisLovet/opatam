'use client';

import { Star, Eye, EyeOff, Trash2 } from 'lucide-react';
import { useState } from 'react';
import { Badge } from '@/components/ui';

interface ReviewItem {
  id: string;
  providerId: string;
  providerName?: string;
  clientId: string | null;
  clientName: string;
  clientPhoto?: string | null;
  rating: number;
  comment: string | null;
  isPublic: boolean;
  createdAt: string | null;
}

interface ReviewTableProps {
  items: ReviewItem[];
  onToggleVisibility: (reviewId: string, isPublic: boolean) => void;
  onDelete: (reviewId: string) => void;
}

function StarRating({ rating }: { rating: number }) {
  return (
    <div className="flex items-center gap-0.5">
      {[1, 2, 3, 4, 5].map((i) => (
        <Star
          key={i}
          className={`w-3.5 h-3.5 ${
            i <= rating
              ? 'fill-yellow-400 text-yellow-400'
              : 'fill-gray-200 text-gray-200 dark:fill-gray-600 dark:text-gray-600'
          }`}
        />
      ))}
    </div>
  );
}

function truncate(text: string | null, maxLength = 50): string {
  if (!text) return '-';
  return text.length > maxLength ? text.slice(0, maxLength) + '...' : text;
}

export function ReviewTable({ items, onToggleVisibility, onDelete }: ReviewTableProps) {
  const [togglingIds, setTogglingIds] = useState<Set<string>>(new Set());

  const handleToggle = async (reviewId: string, currentIsPublic: boolean) => {
    setTogglingIds((prev) => new Set(prev).add(reviewId));
    try {
      await onToggleVisibility(reviewId, !currentIsPublic);
    } finally {
      setTogglingIds((prev) => {
        const next = new Set(prev);
        next.delete(reviewId);
        return next;
      });
    }
  };

  const handleDelete = (reviewId: string) => {
    if (window.confirm('Supprimer cet avis ? Cette action est irr\u00e9versible.')) {
      onDelete(reviewId);
    }
  };

  if (items.length === 0) {
    return (
      <div className="bg-white dark:bg-gray-800 rounded-xl p-8 text-center text-gray-400 text-sm">
        Aucun avis trouv&eacute;
      </div>
    );
  }

  return (
    <>
      {/* Desktop table */}
      <div className="hidden md:block bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="border-b border-gray-100 dark:border-gray-700">
              <th className="text-left px-5 py-3 text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">
                Client
              </th>
              <th className="text-left px-5 py-3 text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">
                Prestataire
              </th>
              <th className="text-left px-5 py-3 text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">
                Note
              </th>
              <th className="text-left px-5 py-3 text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">
                Commentaire
              </th>
              <th className="text-left px-5 py-3 text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">
                Visibilit&eacute;
              </th>
              <th className="text-left px-5 py-3 text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">
                Date
              </th>
              <th className="text-left px-5 py-3 text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">
                Actions
              </th>
            </tr>
          </thead>
          <tbody>
            {items.map((review) => (
              <tr
                key={review.id}
                className="border-b border-gray-50 dark:border-gray-700/50 hover:bg-gray-50 dark:hover:bg-gray-700/30 transition-colors"
              >
                {/* Client */}
                <td className="px-5 py-3">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-gray-200 dark:bg-gray-600 flex items-center justify-center flex-shrink-0">
                      {review.clientPhoto ? (
                        <img
                          src={review.clientPhoto}
                          alt={review.clientName}
                          className="w-8 h-8 rounded-full object-cover"
                        />
                      ) : (
                        <span className="text-xs font-medium text-gray-600 dark:text-gray-300">
                          {review.clientName?.charAt(0).toUpperCase() || '?'}
                        </span>
                      )}
                    </div>
                    <span className="text-sm font-medium text-gray-900 dark:text-white">
                      {review.clientName || 'Anonyme'}
                    </span>
                  </div>
                </td>

                {/* Prestataire */}
                <td className="px-5 py-3 text-sm text-gray-700 dark:text-gray-300">
                  {review.providerName || 'Inconnu'}
                </td>

                {/* Note */}
                <td className="px-5 py-3">
                  <StarRating rating={review.rating} />
                </td>

                {/* Commentaire */}
                <td className="px-5 py-3 text-sm text-gray-500 dark:text-gray-400 max-w-xs">
                  {truncate(review.comment)}
                </td>

                {/* Visibilit&eacute; */}
                <td className="px-5 py-3">
                  {review.isPublic ? (
                    <Badge variant="success" size="sm">Public</Badge>
                  ) : (
                    <Badge variant="info" size="sm">Priv&eacute;</Badge>
                  )}
                </td>

                {/* Date */}
                <td className="px-5 py-3 text-sm text-gray-500 dark:text-gray-400">
                  {review.createdAt
                    ? new Date(review.createdAt).toLocaleDateString('fr-FR', {
                        day: '2-digit',
                        month: 'short',
                        year: 'numeric',
                      })
                    : '-'}
                </td>

                {/* Actions */}
                <td className="px-5 py-3">
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => handleToggle(review.id, review.isPublic)}
                      disabled={togglingIds.has(review.id)}
                      className="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors disabled:opacity-50"
                      title={review.isPublic ? 'Rendre priv\u00e9' : 'Rendre public'}
                    >
                      {review.isPublic ? (
                        <EyeOff className="w-4 h-4 text-gray-500 dark:text-gray-400" />
                      ) : (
                        <Eye className="w-4 h-4 text-gray-500 dark:text-gray-400" />
                      )}
                    </button>
                    <button
                      onClick={() => handleDelete(review.id)}
                      className="p-1.5 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
                      title="Supprimer"
                    >
                      <Trash2 className="w-4 h-4 text-red-500" />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Mobile cards */}
      <div className="md:hidden space-y-3">
        {items.map((review) => (
          <div
            key={review.id}
            className="bg-white dark:bg-gray-800 rounded-xl p-4 shadow-sm border border-gray-100 dark:border-gray-700"
          >
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-10 h-10 rounded-full bg-gray-200 dark:bg-gray-600 flex items-center justify-center flex-shrink-0">
                  {review.clientPhoto ? (
                    <img
                      src={review.clientPhoto}
                      alt={review.clientName}
                      className="w-10 h-10 rounded-full object-cover"
                    />
                  ) : (
                    <span className="text-sm font-medium text-gray-600 dark:text-gray-300">
                      {review.clientName?.charAt(0).toUpperCase() || '?'}
                    </span>
                  )}
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-medium text-gray-900 dark:text-white truncate">
                    {review.clientName || 'Anonyme'}
                  </p>
                  <p className="text-xs text-gray-500 dark:text-gray-400 truncate">
                    {review.providerName || 'Inconnu'}
                  </p>
                </div>
              </div>
              <div className="flex flex-col items-end gap-1">
                {review.isPublic ? (
                  <Badge variant="success" size="sm">Public</Badge>
                ) : (
                  <Badge variant="info" size="sm">Priv&eacute;</Badge>
                )}
                <StarRating rating={review.rating} />
              </div>
            </div>

            {review.comment && (
              <p className="mt-2 text-sm text-gray-600 dark:text-gray-400 line-clamp-2">
                {review.comment}
              </p>
            )}

            <div className="mt-3 flex items-center justify-between">
              <span className="text-xs text-gray-400">
                {review.createdAt
                  ? new Date(review.createdAt).toLocaleDateString('fr-FR', {
                      day: '2-digit',
                      month: 'short',
                      year: 'numeric',
                    })
                  : '-'}
              </span>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => handleToggle(review.id, review.isPublic)}
                  disabled={togglingIds.has(review.id)}
                  className="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors disabled:opacity-50"
                  title={review.isPublic ? 'Rendre priv\u00e9' : 'Rendre public'}
                >
                  {review.isPublic ? (
                    <EyeOff className="w-4 h-4 text-gray-500 dark:text-gray-400" />
                  ) : (
                    <Eye className="w-4 h-4 text-gray-500 dark:text-gray-400" />
                  )}
                </button>
                <button
                  onClick={() => handleDelete(review.id)}
                  className="p-1.5 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
                  title="Supprimer"
                >
                  <Trash2 className="w-4 h-4 text-red-500" />
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>
    </>
  );
}
