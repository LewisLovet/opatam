'use client';

import { useState } from 'react';
import { Badge, Switch } from '@/components/ui';
import { ChevronUp, ChevronDown, Clock, Euro } from 'lucide-react';
import type { Service } from '@booking-app/shared';

type WithId<T> = { id: string } & T;

interface ServiceCardProps {
  service: WithId<Service>;
  onToggleActive: (serviceId: string, isActive: boolean) => Promise<void>;
  onClick: () => void;
  onMoveUp?: () => void;
  onMoveDown?: () => void;
  canMoveUp?: boolean;
  canMoveDown?: boolean;
  showOrder?: boolean;
  orderNumber?: number;
}

function formatDuration(minutes: number): string {
  if (minutes < 60) {
    return `${minutes} min`;
  }
  const hours = Math.floor(minutes / 60);
  const remainingMinutes = minutes % 60;
  if (remainingMinutes === 0) {
    return `${hours}h`;
  }
  return `${hours}h${remainingMinutes.toString().padStart(2, '0')}`;
}

function formatPrice(cents: number): string {
  const euros = cents / 100;
  return new Intl.NumberFormat('fr-FR', {
    style: 'currency',
    currency: 'EUR',
  }).format(euros);
}

export function ServiceCard({
  service,
  onToggleActive,
  onClick,
  onMoveUp,
  onMoveDown,
  canMoveUp = true,
  canMoveDown = true,
  showOrder = false,
  orderNumber,
}: ServiceCardProps) {
  const [toggling, setToggling] = useState(false);

  const handleToggle = async (checked: boolean) => {
    setToggling(true);
    try {
      await onToggleActive(service.id, checked);
    } finally {
      setToggling(false);
    }
  };

  const handleMoveUp = (e: React.MouseEvent) => {
    e.stopPropagation();
    onMoveUp?.();
  };

  const handleMoveDown = (e: React.MouseEvent) => {
    e.stopPropagation();
    onMoveDown?.();
  };

  return (
    <div
      className={`
        group relative bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700
        transition-all duration-200 cursor-pointer
        hover:border-primary-300 dark:hover:border-primary-600 hover:shadow-md
        ${!service.isActive ? 'opacity-60' : ''}
      `}
    >
      <div className="flex items-stretch">
        {/* Order controls */}
        <div className="flex flex-col items-center justify-center border-r border-gray-100 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50 rounded-l-xl">
          <button
            type="button"
            onClick={handleMoveUp}
            disabled={!canMoveUp}
            className={`
              p-1.5 transition-colors
              ${canMoveUp
                ? 'text-gray-500 hover:text-primary-600 hover:bg-primary-50 dark:hover:bg-primary-900/20'
                : 'text-gray-300 dark:text-gray-600 cursor-not-allowed'}
            `}
            aria-label="Monter"
          >
            <ChevronUp className="w-5 h-5" />
          </button>
          {showOrder && orderNumber !== undefined && (
            <span className="text-xs font-medium text-gray-500 dark:text-gray-400 px-2">
              {orderNumber}
            </span>
          )}
          <button
            type="button"
            onClick={handleMoveDown}
            disabled={!canMoveDown}
            className={`
              p-1.5 transition-colors
              ${canMoveDown
                ? 'text-gray-500 hover:text-primary-600 hover:bg-primary-50 dark:hover:bg-primary-900/20'
                : 'text-gray-300 dark:text-gray-600 cursor-not-allowed'}
            `}
            aria-label="Descendre"
          >
            <ChevronDown className="w-5 h-5" />
          </button>
        </div>

        {/* Main content - clickable */}
        <div className="flex-1 p-4" onClick={onClick}>
          <div className="flex items-start justify-between gap-4">
            <div className="flex-1 min-w-0">
              {/* Service name */}
              <h3 className="font-semibold text-gray-900 dark:text-white truncate">
                {service.name}
              </h3>

              {/* Description */}
              {service.description && (
                <p className="mt-1 text-sm text-gray-500 dark:text-gray-400 line-clamp-2">
                  {service.description}
                </p>
              )}

              {/* Duration & Price */}
              <div className="mt-3 flex items-center gap-4 text-sm">
                <span className="flex items-center gap-1.5 text-gray-600 dark:text-gray-300">
                  <Clock className="w-4 h-4 text-gray-400" />
                  {formatDuration(service.duration)}
                </span>
                <span className="flex items-center gap-1.5 font-medium text-gray-900 dark:text-white">
                  <Euro className="w-4 h-4 text-gray-400" />
                  {formatPrice(service.price)}
                </span>
              </div>
            </div>

            {/* Status badge */}
            <Badge variant={service.isActive ? 'success' : 'default'} className="flex-shrink-0">
              {service.isActive ? 'Actif' : 'Inactif'}
            </Badge>
          </div>
        </div>

        {/* Toggle switch */}
        <div
          className="flex items-center px-4 border-l border-gray-100 dark:border-gray-700"
          onClick={(e) => e.stopPropagation()}
        >
          <Switch
            checked={service.isActive}
            onChange={(e) => handleToggle(e.target.checked)}
            disabled={toggling}
            aria-label={service.isActive ? 'Désactiver' : 'Activer'}
          />
        </div>
      </div>
    </div>
  );
}
