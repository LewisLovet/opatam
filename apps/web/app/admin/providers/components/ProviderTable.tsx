'use client';

import Link from 'next/link';
import { ChevronRight, CheckCircle, XCircle, Star, AlertTriangle } from 'lucide-react';
import { Badge } from '@/components/ui';

interface ProviderItem {
  id: string;
  businessName: string;
  category: string;
  photoURL: string | null;
  plan: string;
  subscriptionStatus: string | null;
  isPublished: boolean;
  isVerified: boolean;
  rating: { average: number; count: number };
  cities: string[];
  region: string | null;
  createdAt: string | null;
}

interface ProviderTableProps {
  items: ProviderItem[];
}

const planLabels: Record<string, string> = {
  trial: 'Trial',
  solo: 'Solo',
  team: 'Team',
  test: 'Test',
};

const planBadgeVariant: Record<string, 'warning' | 'info' | 'success' | 'error'> = {
  trial: 'warning',
  solo: 'info',
  team: 'success',
  test: 'error',
};

const categoryLabels: Record<string, string> = {
  coiffure: 'Coiffure',
  barbier: 'Barbier',
  esthetique: 'Esthétique',
  massage: 'Massage',
  onglerie: 'Onglerie',
  tatouage: 'Tatouage',
  maquillage: 'Maquillage',
  soin_visage: 'Soin visage',
};

export function ProviderTable({ items }: ProviderTableProps) {
  if (items.length === 0) {
    return (
      <div className="bg-white dark:bg-gray-800 rounded-xl p-8 text-center text-gray-400 text-sm">
        Aucun prestataire trouvé
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
                Prestataire
              </th>
              <th className="text-left px-5 py-3 text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">
                Plan
              </th>
              <th className="text-left px-5 py-3 text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">
                Note
              </th>
              <th className="text-left px-5 py-3 text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">
                Statut
              </th>
              <th className="text-left px-5 py-3 text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">
                Inscrit le
              </th>
              <th className="w-10" />
            </tr>
          </thead>
          <tbody>
            {items.map((provider) => (
              <tr
                key={provider.id}
                className="border-b border-gray-50 dark:border-gray-700/50 hover:bg-gray-50 dark:hover:bg-gray-700/30 transition-colors"
              >
                <td className="px-5 py-3">
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-full bg-gray-200 dark:bg-gray-600 flex items-center justify-center flex-shrink-0">
                      {provider.photoURL ? (
                        <img
                          src={provider.photoURL}
                          alt={provider.businessName}
                          className="w-9 h-9 rounded-full object-cover"
                        />
                      ) : (
                        <span className="text-sm font-medium text-gray-600 dark:text-gray-300">
                          {provider.businessName?.charAt(0).toUpperCase() || '?'}
                        </span>
                      )}
                    </div>
                    <div>
                      <p className="text-sm font-medium text-gray-900 dark:text-white">
                        {provider.businessName}
                      </p>
                      <p className="text-xs text-gray-500 dark:text-gray-400">
                        {categoryLabels[provider.category] || provider.category}
                        {provider.cities.length > 0 && ` \u00b7 ${provider.cities[0]}`}
                      </p>
                      {!provider.region && (!provider.countryCode || provider.countryCode === 'FR') && (
                        <span className="inline-flex items-center gap-0.5 text-[10px] text-red-500 mt-0.5">
                          <AlertTriangle className="w-3 h-3" />
                          Région manquante
                        </span>
                      )}
                      {provider.countryCode && provider.countryCode !== 'FR' && (
                        <span className="inline-flex items-center gap-0.5 text-[10px] text-blue-500 mt-0.5">
                          {provider.countryCode}
                        </span>
                      )}
                    </div>
                  </div>
                </td>
                <td className="px-5 py-3">
                  <Badge variant={planBadgeVariant[provider.plan] || 'primary'} size="sm">
                    {planLabels[provider.plan] || provider.plan}
                  </Badge>
                </td>
                <td className="px-5 py-3">
                  {provider.rating.count > 0 ? (
                    <div className="flex items-center gap-1">
                      <Star className="w-3.5 h-3.5 text-amber-400 fill-amber-400" />
                      <span className="text-sm text-gray-900 dark:text-white">
                        {provider.rating.average.toFixed(1)}
                      </span>
                      <span className="text-xs text-gray-400">({provider.rating.count})</span>
                    </div>
                  ) : (
                    <span className="text-xs text-gray-400">-</span>
                  )}
                </td>
                <td className="px-5 py-3">
                  <div className="flex items-center gap-2">
                    {provider.isPublished ? (
                      <span className="inline-flex items-center gap-1 text-xs font-medium text-emerald-500">
                        <CheckCircle className="w-3 h-3" /> Publié
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-xs font-medium text-gray-400">
                        <XCircle className="w-3 h-3" /> Brouillon
                      </span>
                    )}
                    {provider.isVerified && (
                      <Badge variant="success" size="sm">Vérifié</Badge>
                    )}
                  </div>
                </td>
                <td className="px-5 py-3 text-sm text-gray-500 dark:text-gray-400">
                  {provider.createdAt
                    ? new Date(provider.createdAt).toLocaleDateString('fr-FR', {
                        day: '2-digit',
                        month: 'short',
                        year: 'numeric',
                      })
                    : '-'}
                </td>
                <td className="px-5 py-3">
                  <Link
                    href={`/admin/providers/${provider.id}`}
                    className="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors inline-flex"
                  >
                    <ChevronRight className="w-4 h-4 text-gray-400" />
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Mobile cards */}
      <div className="md:hidden space-y-3">
        {items.map((provider) => (
          <Link
            key={provider.id}
            href={`/admin/providers/${provider.id}`}
            className="block bg-white dark:bg-gray-800 rounded-xl p-4 shadow-sm border border-gray-100 dark:border-gray-700"
          >
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-gray-200 dark:bg-gray-600 flex items-center justify-center flex-shrink-0">
                {provider.photoURL ? (
                  <img
                    src={provider.photoURL}
                    alt={provider.businessName}
                    className="w-10 h-10 rounded-full object-cover"
                  />
                ) : (
                  <span className="text-sm font-medium text-gray-600 dark:text-gray-300">
                    {provider.businessName?.charAt(0).toUpperCase() || '?'}
                  </span>
                )}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-gray-900 dark:text-white truncate">
                  {provider.businessName}
                </p>
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  {categoryLabels[provider.category] || provider.category}
                </p>
                {!provider.region && (!provider.countryCode || provider.countryCode === 'FR') && (
                  <span className="inline-flex items-center gap-0.5 text-[10px] text-red-500">
                    <AlertTriangle className="w-3 h-3" />
                    Région manquante
                  </span>
                )}
                {provider.countryCode && provider.countryCode !== 'FR' && (
                  <span className="inline-flex items-center gap-0.5 text-[10px] text-blue-500">
                    {provider.countryCode}
                  </span>
                )}
              </div>
              <div className="flex flex-col items-end gap-1">
                <Badge variant={planBadgeVariant[provider.plan] || 'primary'} size="sm">
                  {planLabels[provider.plan] || provider.plan}
                </Badge>
                {provider.isPublished ? (
                  <span className="text-xs text-emerald-500">Publié</span>
                ) : (
                  <span className="text-xs text-gray-400">Brouillon</span>
                )}
              </div>
              <ChevronRight className="w-4 h-4 text-gray-400 flex-shrink-0" />
            </div>
          </Link>
        ))}
      </div>
    </>
  );
}
