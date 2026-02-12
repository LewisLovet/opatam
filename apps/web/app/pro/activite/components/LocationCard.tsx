'use client';

import { useState } from 'react';
import { Badge, Switch } from '@/components/ui';
import { Building2, Car, Star } from 'lucide-react';
import type { Location } from '@booking-app/shared';

type WithId<T> = { id: string } & T;

interface LocationCardProps {
  location: WithId<Location>;
  onToggleActive: (locationId: string, isActive: boolean) => Promise<void>;
  onSetDefault: (locationId: string) => Promise<void>;
  onClick: () => void;
}

export function LocationCard({
  location,
  onToggleActive,
  onSetDefault,
  onClick,
}: LocationCardProps) {
  const [toggling, setToggling] = useState(false);
  const [settingDefault, setSettingDefault] = useState(false);

  const handleToggle = async (checked: boolean) => {
    setToggling(true);
    try {
      await onToggleActive(location.id, checked);
    } finally {
      setToggling(false);
    }
  };

  const handleSetDefault = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (location.isDefault || !location.isActive) return;

    setSettingDefault(true);
    try {
      await onSetDefault(location.id);
    } finally {
      setSettingDefault(false);
    }
  };

  const isMobile = location.type === 'mobile';
  const Icon = isMobile ? Car : Building2;

  // Format location info based on type
  const locationInfo = isMobile
    ? `Déplacement dans un rayon de ${location.travelRadius} km autour de ${location.city}`
    : `${location.address}, ${location.postalCode} ${location.city}`;

  return (
    <div
      className={`
        group relative bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700
        transition-all duration-200 cursor-pointer
        hover:border-primary-300 dark:hover:border-primary-600 hover:shadow-md
        ${!location.isActive ? 'opacity-60' : ''}
      `}
      onClick={onClick}
    >
      <div className="p-4">
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1 min-w-0">
            {/* Location name with badges */}
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="font-semibold text-gray-900 dark:text-white truncate">
                {location.name}
              </h3>
              {location.isDefault && (
                <Badge variant="warning" className="flex-shrink-0">
                  <Star className="w-3 h-3 mr-1" />
                  Principal
                </Badge>
              )}
              {!location.isActive && (
                <Badge variant="default" className="flex-shrink-0">
                  Inactif
                </Badge>
              )}
            </div>

            {/* Location info with icon */}
            <div className="mt-2 flex items-start gap-2 text-sm text-gray-600 dark:text-gray-300">
              <Icon className="w-4 h-4 text-gray-400 flex-shrink-0 mt-0.5" />
              <span className="line-clamp-2">{locationInfo}</span>
            </div>

            {/* Description */}
            {location.description && (
              <p className="mt-2 text-sm text-gray-500 dark:text-gray-400 line-clamp-2">
                {location.description}
              </p>
            )}

            {/* Set as default button */}
            {!location.isDefault && location.isActive && (
              <button
                type="button"
                onClick={handleSetDefault}
                disabled={settingDefault}
                className="mt-3 text-sm font-medium text-primary-600 dark:text-primary-400 hover:text-primary-700 dark:hover:text-primary-300 transition-colors disabled:opacity-50"
              >
                {settingDefault ? 'Mise à jour...' : 'Définir comme principal'}
              </button>
            )}
          </div>

          {/* Toggle switch */}
          <div onClick={(e) => e.stopPropagation()}>
            <Switch
              checked={location.isActive}
              onChange={(e) => handleToggle(e.target.checked)}
              disabled={toggling}
              aria-label={location.isActive ? 'Désactiver' : 'Activer'}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
