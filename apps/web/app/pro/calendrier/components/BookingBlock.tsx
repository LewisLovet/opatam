'use client';

import type { Booking } from '@booking-app/shared';
import { Clock, User, Tag } from 'lucide-react';
import { SlotPopover, getVisualStatus, type VisualStatus } from './SlotPopover';

type WithId<T> = { id: string } & T;

interface BookingBlockProps {
  booking: WithId<Booking>;
  top: number;
  height: number;
  onClick: () => void;
  showMemberName?: boolean;
  compact?: boolean;
}

/**
 * Visual styles based on temporal status (not just booking status)
 * - past: Grey, reduced opacity
 * - ongoing: Blue with glow effect
 * - confirmed: Green
 * - pending: Yellow/amber
 * - cancelled: Red, strikethrough, 50% opacity
 * - noshow: Red, 60% opacity
 */
const visualStatusStyles: Record<VisualStatus, {
  bg: string;
  border: string;
  text: string;
  badge: string;
  extra?: string;
}> = {
  past: {
    bg: 'bg-gray-100 dark:bg-gray-800/60',
    border: 'border-gray-300 dark:border-gray-600',
    text: 'text-gray-500 dark:text-gray-400',
    badge: 'bg-gray-400',
    extra: 'opacity-70',
  },
  ongoing: {
    bg: 'bg-primary-50 dark:bg-primary-900/30',
    border: 'border-primary-400 dark:border-primary-500',
    text: 'text-primary-800 dark:text-primary-200',
    badge: 'bg-primary-500',
    extra: 'shadow-md shadow-primary-200 dark:shadow-primary-900/50 ring-1 ring-primary-200 dark:ring-primary-700',
  },
  confirmed: {
    bg: 'bg-success-50 dark:bg-success-900/20',
    border: 'border-success-300 dark:border-success-700',
    text: 'text-success-800 dark:text-success-200',
    badge: 'bg-success-500',
    extra: 'shadow-sm',
  },
  pending: {
    bg: 'bg-warning-50 dark:bg-warning-900/20',
    border: 'border-warning-400 dark:border-warning-600',
    text: 'text-warning-800 dark:text-warning-200',
    badge: 'bg-warning-500',
    extra: 'shadow-sm',
  },
  cancelled: {
    bg: 'bg-error-50/50 dark:bg-error-900/10',
    border: 'border-error-300 dark:border-error-800',
    text: 'text-error-600 dark:text-error-400 line-through',
    badge: 'bg-error-400',
    extra: 'opacity-50',
  },
  noshow: {
    bg: 'bg-error-50 dark:bg-error-900/20',
    border: 'border-error-300 dark:border-error-700',
    text: 'text-error-700 dark:text-error-300',
    badge: 'bg-error-500',
    extra: 'opacity-60',
  },
};

const statusLabels: Record<VisualStatus, string> = {
  past: 'Passé',
  ongoing: 'En cours',
  confirmed: 'Confirmé',
  pending: 'En attente',
  cancelled: 'Annulé',
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
  const visualStatus = getVisualStatus(booking);
  const styles = visualStatusStyles[visualStatus];

  // Height thresholds for showing different elements
  const minHeightForClientName = 40;
  const minHeightForService = 60;
  const minHeightForClientCompact = 48;

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

  const blockContent = (
    <button
      onClick={handleClick}
      className={`
        absolute left-1.5 right-1.5 rounded-xl border overflow-hidden
        cursor-pointer transition-all hover:shadow-md hover:z-10
        ${styles.bg} ${styles.border} ${styles.extra || ''}
      `}
      style={{ top: `${top}px`, height: `${height}px`, minHeight: '24px' }}
      title={`${startTime} - ${endTime} | ${booking.clientInfo.name} | ${booking.serviceName}`}
    >
      <div className={`h-full p-1.5 sm:p-2 flex flex-col ${styles.text}`}>
        {/* Time range - always visible */}
        <div className="flex items-center gap-1 text-xs font-medium">
          <Clock className="w-3 h-3 flex-shrink-0" />
          <span className="truncate">{startTime} - {endTime}</span>
          {/* Status badge */}
          <span
            className={`ml-auto w-2 h-2 rounded-full flex-shrink-0 ${styles.badge}`}
            title={statusLabels[visualStatus]}
          />
        </div>

        {/* Compact mode: show client name if enough space */}
        {compact && height >= minHeightForClientCompact && (
          <div className="flex items-center gap-1 text-xs mt-0.5 truncate">
            <User className="w-3 h-3 flex-shrink-0" />
            <span className="truncate">{booking.clientInfo.name}</span>
          </div>
        )}

        {/* Client name - priority, shown if enough space (non-compact) */}
        {height >= minHeightForClientName && !compact && (
          <div className="flex items-center gap-1 text-xs mt-0.5 truncate">
            <User className="w-3 h-3 flex-shrink-0" />
            <span className="truncate">{booking.clientInfo.name}</span>
          </div>
        )}

        {/* Service name - secondary, shown only if lots of space (non-compact) */}
        {height >= minHeightForService && !compact && (
          <div className="flex items-center gap-1 text-xs mt-0.5 truncate opacity-75">
            <Tag className="w-3 h-3 flex-shrink-0" />
            <span className="truncate">{booking.serviceName}</span>
          </div>
        )}

        {/* Member name - for week view with all members */}
        {showMemberName && booking.memberName && height >= minHeightForClientName && (
          <div className="text-xs mt-auto opacity-75 truncate">
            {booking.memberName}
          </div>
        )}
      </div>
    </button>
  );

  // Wrap with tooltip
  return (
    <SlotPopover booking={booking}>
      {blockContent}
    </SlotPopover>
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
  const visualStatus = getVisualStatus(booking);
  const styles = visualStatusStyles[visualStatus];

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
    <SlotPopover booking={booking}>
      <button
        onClick={handleClick}
        className={`
          w-full text-left px-2 py-1 rounded border text-xs
          truncate transition-colors hover:brightness-95
          ${styles.bg} ${styles.border} ${styles.text} ${styles.extra || ''}
        `}
        title={`${formatTime(booking.datetime)} - ${booking.clientInfo.name} - ${booking.serviceName}`}
      >
        <span className="font-medium">{formatTime(booking.datetime)}</span>
        <span className="mx-1">-</span>
        <span className="truncate">{booking.clientInfo.name}</span>
      </button>
    </SlotPopover>
  );
}
