'use client';

import { LayoutGrid } from 'lucide-react';

interface CategoryData {
  category: string;
  label: string;
  providers: number;
  bookings: number;
}

interface CategoryBreakdownTableProps {
  data: CategoryData[];
}

export function CategoryBreakdownTable({ data }: CategoryBreakdownTableProps) {
  const totalBookings = data.reduce((sum, d) => sum + d.bookings, 0);

  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl p-5 shadow-sm border border-gray-100 dark:border-gray-700">
      <div className="flex items-center gap-2 mb-4">
        <LayoutGrid className="w-5 h-5 text-red-500" />
        <h3 className="text-sm font-semibold text-gray-900 dark:text-white">
          Répartition par catégorie
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
                <th className="pb-3 font-medium">Catégorie</th>
                <th className="pb-3 font-medium text-right">Prestataires</th>
                <th className="pb-3 font-medium text-right">Réservations</th>
                <th className="pb-3 font-medium text-right">% du total</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50 dark:divide-gray-700/50">
              {data.map((cat) => (
                <tr key={cat.category}>
                  <td className="py-3 font-medium text-gray-900 dark:text-white">
                    {cat.label}
                  </td>
                  <td className="py-3 text-right text-gray-600 dark:text-gray-300">
                    {cat.providers}
                  </td>
                  <td className="py-3 text-right text-gray-600 dark:text-gray-300">
                    {cat.bookings}
                  </td>
                  <td className="py-3 text-right">
                    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-red-50 dark:bg-red-500/10 text-red-600 dark:text-red-400">
                      {totalBookings > 0
                        ? `${Math.round((cat.bookings / totalBookings) * 100)}%`
                        : '0%'}
                    </span>
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
