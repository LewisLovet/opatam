'use client';

import type { Booking, BookingStatus } from '@booking-app/shared';
import { Clock, User, Scissors } from 'lucide-react';

type WithId<T> = { id: string } & T;

interface BookingBlockProps {
  booking: WithId<Booking>;
  top: number;
  height: number;
  onClick: () => void;
  showMemberName?: boolean;
  compact?: boolean;
}

const statusColors: Record<BookingStatus, { bg: string; border: string; text: string; badge: string }> = {
  pending: {
    bg: 'bg-warning-50 dark:bg-warning-900/20',
    border: 'border-warning-300 dark:border-warning-700',
    text: 'text-warning-800 dark:text-warning-200',
    badge: 'bg-warning-500',
  },
  confirmed: {
    bg: 'bg-success-50 dark:bg-success-900/20',
    border: 'border-success-300 dark:border-success-700',
    text: 'text-success-800 dark:text-success-200',
    badge: 'bg-success-500',
  },
  cancelled: {
    bg: 'bg-gray-50 dark:bg-gray-800/50',
    border: 'border-gray-300 dark:border-gray-600',
    text: 'text-gray-500 dark:text-gray-400 line-through',
    badge: 'bg-gray-400',
  },
  completed: {
    bg: 'bg-primary-50 dark:bg-primary-900/20',
    border: 'border-primary-300 dark:border-primary-700',
    text: 'text-primary-800 dark:text-primary-200',
    badge: 'bg-primary-500',
  },
  noshow: {
    bg: 'bg-error-50 dark:bg-error-900/20',
    border: 'border-error-300 dark:border-error-700',
    text: 'text-error-800 dark:text-error-200',
    badge: 'bg-error-500',
  },
};

const statusLabels: Record<BookingStatus, string> = {
  pending: 'En attente',
  confirmed: 'Confirme',
  cancelled: 'Annule',
  completed: 'Termine',
  noshow: 'Absent',
};

export function BookingBlock({
  booking,
  top,
  height,
  onClick,
  showMemberName = false,
  compact = false,
}: BookingBlockProps) {
  const colors = statusColors[booking.status];
  const minHeightForDetails = 40;
  const minHeightForService = 60;
  const minHeightForServiceCompact = 48;

  const formatTime = (date: Date | string) => {
    return new Date(date).toLocaleTimeString('fr-FR', {
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const handleClick = (e: React.MouseEvent) => {
    e.stopPropagation(); // Prevent opening create modal
    onClick();
  };

  const startTime = formatTime(booking.datetime);
  const endTime = formatTime(booking.endDatetime);

  return (
    <button
      onClick={handleClick}
      className={`
        absolute left-1 right-1 rounded-lg border overflow-hidden
        cursor-pointer transition-all hover:shadow-md hover:z-10
        ${colors.bg} ${colors.border}
      `}
      style={{ top: `${top}px`, height: `${height}px`, minHeight: '24px' }}
      title={`${startTime} - ${endTime} | ${booking.serviceName} | ${booking.clientInfo.name}`}
    >
      <div className={`h-full p-1.5 sm:p-2 flex flex-col ${colors.text}`}>
        {/* Time range - always visible */}
        <div className="flex items-center gap-1 text-xs font-medium">
          <Clock className="w-3 h-3 flex-shrink-0" />
          <span className="truncate">{startTime} - {endTime}</span>
          {/* Status badge */}
          <span className={`ml-auto w-2 h-2 rounded-full flex-shrink-0 ${colors.badge}`} title={statusLabels[booking.status]} />
        </div>

        {/* Compact mode: show service name if enough space */}
        {compact && height >= minHeightForServiceCompact && (
          <div className="flex items-center gap-1 text-xs mt-0.5 truncate opacity-80">
            <Scissors className="w-3 h-3 flex-shrink-0" />
            <span className="truncate">{booking.serviceName}</span>
          </div>
        )}

        {/* Client name - if enough space (non-compact) */}
        {height >= minHeightForDetails && !compact && (
          <div className="flex items-center gap-1 text-xs mt-0.5 truncate">
            <User className="w-3 h-3 flex-shrink-0" />
            <span className="truncate">{booking.clientInfo.name}</span>
          </div>
        )}

        {/* Service name - if even more space (non-compact) */}
        {height >= minHeightForService && !compact && (
          <div className="flex items-center gap-1 text-xs mt-0.5 truncate opacity-75">
            <Scissors className="w-3 h-3 flex-shrink-0" />
            <span className="truncate">{booking.serviceName}</span>
          </div>
        )}

        {/* Member name - for week view with all members */}
        {showMemberName && booking.memberName && height >= minHeightForDetails && (
          <div className="text-xs mt-auto opacity-75 truncate">
            {booking.memberName}
          </div>
        )}
      </div>
    </button>
  );
}

/**
 * Compact version for smaller slots or week view
 */
export function BookingBlockCompact({
  booking,
  onClick,
}: {
  booking: WithId<Booking>;
  onClick: () => void;
}) {
  const colors = statusColors[booking.status];

  const formatTime = (date: Date) => {
    return new Date(date).toLocaleTimeString('fr-FR', {
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const handleClick = (e: React.MouseEvent) => {
    e.stopPropagation(); // Prevent opening create modal
    onClick();
  };

  return (
    <button
      onClick={handleClick}
      className={`
        w-full text-left px-2 py-1 rounded border text-xs
        truncate transition-colors hover:brightness-95
        ${colors.bg} ${colors.border} ${colors.text}
      `}
      title={`${formatTime(booking.datetime)} - ${booking.clientInfo.name} - ${booking.serviceName}`}
    >
      <span className="font-medium">{formatTime(booking.datetime)}</span>
      <span className="mx-1">-</span>
      <span className="truncate">{booking.clientInfo.name}</span>
    </button>
  );
}
