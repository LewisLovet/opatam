'use client';

import { MapPin } from 'lucide-react';

interface CityData {
  city: string;
  providers: number;
  bookings: number;
}

interface TopCitiesTableProps {
  data: CityData[];
}

export function TopCitiesTable({ data }: TopCitiesTableProps) {
  const maxProviders = Math.max(...data.map((d) => d.providers), 1);

  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl p-5 shadow-sm border border-gray-100 dark:border-gray-700">
      <div className="flex items-center gap-2 mb-4">
        <MapPin className="w-5 h-5 text-red-500" />
        <h3 className="text-sm font-semibold text-gray-900 dark:text-white">
          Top villes
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
                <th className="pb-3 font-medium">Ville</th>
                <th className="pb-3 font-medium text-right">Prestataires</th>
                <th className="pb-3 font-medium text-right">Réservations</th>
                <th className="pb-3 font-medium w-32"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50 dark:divide-gray-700/50">
              {data.map((city) => (
                <tr key={city.city}>
                  <td className="py-3 font-medium text-gray-900 dark:text-white">
                    {city.city}
                  </td>
                  <td className="py-3 text-right text-gray-600 dark:text-gray-300">
                    {city.providers}
                  </td>
                  <td className="py-3 text-right text-gray-600 dark:text-gray-300">
                    {city.bookings}
                  </td>
                  <td className="py-3 pl-4">
                    <div className="w-full bg-gray-100 dark:bg-gray-700 rounded-full h-2">
                      <div
                        className="bg-red-500 h-2 rounded-full transition-all"
                        style={{ width: `${(city.providers / maxProviders) * 100}%` }}
                      />
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
