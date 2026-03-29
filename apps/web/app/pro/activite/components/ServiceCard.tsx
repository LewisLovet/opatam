'use client';

import { useState } from 'react';
import Image from 'next/image';
import { Badge, Switch } from '@/components/ui';
import { ChevronUp, ChevronDown, Clock, Euro } from 'lucide-react';
import type { Service, Member } from '@booking-app/shared';

type WithId<T> = { id: string } & T;

interface ServiceCardProps {
  service: WithId<Service>;
  members?: WithId<Member>[];
  allMembers?: WithId<Member>[];
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
  if (cents === 0) return 'Gratuit';
  const euros = cents / 100;
  return new Intl.NumberFormat('fr-FR', {
    style: 'currency',
    currency: 'EUR',
  }).format(euros);
}

export function ServiceCard({
  service,
  members = [],
  allMembers = [],
  onToggleActive,
  onClick,
  onMoveUp,
  onMoveDown,
  canMoveUp = true,
  canMoveDown = true,
  showOrder = false,
  orderNumber,
}: ServiceCardProps) {
  // Determine which members perform this service
  const assignedMembers = service.memberIds
    ? members.filter((m) => service.memberIds?.includes(m.id))
    : allMembers; // null = all members
  const isAllMembers = !service.memberIds && allMembers.length > 0;
  const showMembers = allMembers.length > 0;
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
        {/* Order controls — hidden on mobile */}
        <div className="hidden sm:flex flex-col items-center justify-center border-r border-gray-100 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50 rounded-l-xl">
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
        <div className="flex-1 min-w-0 p-3 sm:p-4" onClick={onClick}>
          <div className="flex items-start justify-between gap-2 sm:gap-4">
            {/* Photo thumbnail */}
            {service.photoURL && (
              <div className="flex-shrink-0 w-12 h-12 sm:w-14 sm:h-14 rounded-lg overflow-hidden">
                <Image
                  src={service.photoURL}
                  alt={service.name}
                  width={56}
                  height={56}
                  className="w-full h-full object-cover"
                />
              </div>
            )}

            <div className="flex-1 min-w-0">
              {/* Service name */}
              <h3 className="font-semibold text-gray-900 dark:text-white truncate text-sm sm:text-base">
                {service.name}
              </h3>

              {/* Description — hidden on mobile */}
              {service.description && (
                <p className="mt-1 text-sm text-gray-500 dark:text-gray-400 line-clamp-2 hidden sm:block">
                  {service.description}
                </p>
              )}

              {/* Duration & Price */}
              <div className="mt-1.5 sm:mt-3 flex items-center gap-3 sm:gap-4 text-xs sm:text-sm">
                <span className="flex items-center gap-1 sm:gap-1.5 text-gray-600 dark:text-gray-300">
                  <Clock className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-gray-400" />
                  {formatDuration(service.duration)}
                </span>
                <span className="flex items-center gap-1 sm:gap-1.5 font-medium text-gray-900 dark:text-white">
                  {formatPrice(service.price)}
                </span>
              </div>

              {/* Assigned members */}
              {showMembers && (
                <div className="mt-2 flex items-center gap-1.5 flex-wrap">
                  {isAllMembers ? (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-primary-50 dark:bg-primary-900/20 text-[11px] font-semibold text-primary-600 dark:text-primary-400">
                      Tous les membres
                    </span>
                  ) : (
                    assignedMembers.map((member) => (
                      <span
                        key={member.id}
                        className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium text-gray-700 dark:text-gray-300"
                        style={{ backgroundColor: (member.color || '#6B7280') + '18' }}
                      >
                        <span
                          className="w-1.5 h-1.5 rounded-full flex-shrink-0"
                          style={{ backgroundColor: member.color || '#6B7280' }}
                        />
                        {member.name.split(' ')[0]}
                      </span>
                    ))
                  )}
                </div>
              )}
            </div>

            {/* Status badge (desktop) + Toggle (mobile) */}
            <div className="flex items-center gap-2 flex-shrink-0">
              <Badge variant={service.isActive ? 'success' : 'default'} size="sm" className="hidden sm:inline-flex">
                {service.isActive ? 'Actif' : 'Inactif'}
              </Badge>
              <div className="sm:hidden" onClick={(e) => e.stopPropagation()}>
                <Switch
                  checked={service.isActive}
                  onChange={(e) => handleToggle(e.target.checked)}
                  disabled={toggling}
                  aria-label={service.isActive ? 'Désactiver' : 'Activer'}
                />
              </div>
            </div>
          </div>
        </div>

        {/* Toggle switch — desktop only */}
        <div
          className="hidden sm:flex items-center px-4 border-l border-gray-100 dark:border-gray-700"
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
