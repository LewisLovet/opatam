'use client';

import { Trophy, Star } from 'lucide-react';
import Link from 'next/link';

interface ProviderData {
  id: string;
  businessName: string;
  photoURL?: string;
  category: string;
  bookings: number;
  rating: number;
  ratingCount: number;
}

interface TopProvidersTableProps {
  data: ProviderData[];
}

export function TopProvidersTable({ data }: TopProvidersTableProps) {
  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl p-5 shadow-sm border border-gray-100 dark:border-gray-700">
      <div className="flex items-center gap-2 mb-4">
        <Trophy className="w-5 h-5 text-red-500" />
        <h3 className="text-sm font-semibold text-gray-900 dark:text-white">
          Top prestataires (90 derniers jours)
        </h3>
      </div>

      {data.length === 0 ? (
        <p className="text-sm text-gray-500 dark:text-gray-400 text-center py-8">
          Aucune donnée disponible
        </p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-gray-500 dark:text-gray-400 border-b border-gray-100 dark:border-gray-700">
                <th className="pb-3 font-medium">Prestataire</th>
                <th className="pb-3 font-medium">Catégorie</th>
                <th className="pb-3 font-medium text-right">Réservations</th>
                <th className="pb-3 font-medium text-right">Note</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50 dark:divide-gray-700/50">
              {data.map((provider, i) => (
                <tr key={provider.id}>
                  <td className="py-3">
                    <Link
                      href={`/admin/providers/${provider.id}`}
                      className="flex items-center gap-3 hover:opacity-80 transition-opacity"
                    >
                      <div className="relative">
                        {i < 3 && (
                          <span className="absolute -top-1 -left-1 w-4 h-4 bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center z-10">
                            {i + 1}
                          </span>
                        )}
                        {provider.photoURL ? (
                          <img
                            src={provider.photoURL}
                            alt={provider.businessName}
                            className="w-8 h-8 rounded-full object-cover"
                          />
                        ) : (
                          <div className="w-8 h-8 rounded-full bg-gray-200 dark:bg-gray-600 flex items-center justify-center">
                            <span className="text-xs font-semibold text-gray-600 dark:text-gray-300">
                              {provider.businessName.charAt(0).toUpperCase()}
                            </span>
                          </div>
                        )}
                      </div>
                      <span className="font-medium text-gray-900 dark:text-white truncate max-w-[200px]">
                        {provider.businessName}
                      </span>
                    </Link>
                  </td>
                  <td className="py-3">
                    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300">
                      {provider.category}
                    </span>
                  </td>
                  <td className="py-3 text-right font-semibold text-gray-900 dark:text-white">
                    {provider.bookings}
                  </td>
                  <td className="py-3 text-right">
                    <div className="flex items-center justify-end gap-1">
                      <Star className="w-3.5 h-3.5 text-amber-400 fill-amber-400" />
                      <span className="font-medium text-gray-900 dark:text-white">
                        {provider.rating > 0 ? provider.rating.toFixed(1) : '—'}
                      </span>
                      <span className="text-gray-400 text-xs">
                        ({provider.ratingCount})
                      </span>
                    </div>
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
