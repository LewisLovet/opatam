'use client';

import type { SeedStats as SeedStatsType } from '../_hooks/useSeedData';
import { Store, Scissors, User, MapPin, Calendar } from 'lucide-react';

interface SeedStatsProps {
  stats: SeedStatsType;
}

export function SeedStats({ stats }: SeedStatsProps) {
  const items = [
    { label: 'Providers', value: stats.providersCreated, icon: Store },
    { label: 'Services', value: stats.servicesCreated, icon: Scissors },
    { label: 'Membres', value: stats.membersCreated, icon: User },
    { label: 'Locations', value: stats.locationsCreated, icon: MapPin },
    { label: 'Disponibilités', value: stats.availabilitiesCreated, icon: Calendar },
  ];

  const hasData = Object.values(stats).some(v => v > 0);

  if (!hasData) {
    return null;
  }

  return (
    <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg p-4">
      <h3 className="text-sm font-medium text-green-800 dark:text-green-200 mb-3">
        Données créées
      </h3>
      <div className="grid grid-cols-5 gap-4">
        {items.map((item) => {
          const Icon = item.icon;
          return (
            <div key={item.label} className="text-center">
              <div className="w-8 h-8 mx-auto mb-1 bg-green-100 dark:bg-green-800/30 rounded-lg flex items-center justify-center">
                <Icon className="w-4 h-4 text-green-600 dark:text-green-400" />
              </div>
              <div className="text-xl font-bold text-green-700 dark:text-green-300">
                {item.value}
              </div>
              <div className="text-xs text-green-600 dark:text-green-400">
                {item.label}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
