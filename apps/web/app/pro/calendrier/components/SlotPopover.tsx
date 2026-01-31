'use client';

import type { Booking } from '@booking-app/shared';

type WithId<T> = { id: string } & T;

interface SlotTooltipProps {
  booking: WithId<Booking>;
  children: React.ReactNode;
  disabled?: boolean;
}

/**
 * Determines the visual status of a booking based on time and booking status
 */
export type VisualStatus = 'past' | 'ongoing' | 'confirmed' | 'pending' | 'cancelled' | 'noshow';

export function getVisualStatus(booking: Booking): VisualStatus {
  const now = new Date();
  const startTime = new Date(booking.datetime);
  const endTime = new Date(booking.endDatetime);

  // Priority 1: Cancelled
  if (booking.status === 'cancelled') return 'cancelled';

  // Priority 2: No-show
  if (booking.status === 'noshow') return 'noshow';

  // Priority 3: Ongoing (current time is between start and end)
  if (now >= startTime && now <= endTime) return 'ongoing';

  // Priority 4: Past (end time has passed)
  if (now > endTime) return 'past';

  // Priority 5: Pending
  if (booking.status === 'pending') return 'pending';

  // Default: Confirmed future booking
  return 'confirmed';
}

export function isPastBooking(booking: Booking): boolean {
  const status = getVisualStatus(booking);
  return status === 'past' || status === 'cancelled' || status === 'noshow';
}

/**
 * Format price from cents to euros
 */
function formatPrice(cents: number): string {
  return new Intl.NumberFormat('fr-FR', {
    style: 'currency',
    currency: 'EUR',
  }).format(cents / 100);
}

/**
 * Simple CSS tooltip component that shows booking details on hover
 * Actions are handled via the modal on click, not in the tooltip
 */
export function SlotPopover({
  booking,
  children,
  disabled = false,
}: SlotTooltipProps) {
  if (disabled) {
    return <>{children}</>;
  }

  const tooltipContent = [
    booking.serviceName,
    formatPrice(booking.price),
    booking.clientInfo.phone,
  ].filter(Boolean).join(' • ');

  return (
    <div className="group/tooltip relative contents">
      {children}
      <div
        className="pointer-events-none absolute left-full ml-2 top-1/2 -translate-y-1/2 z-[100] px-3 py-2 bg-gray-900 dark:bg-gray-700 text-white text-sm rounded-lg shadow-lg max-w-[200px] opacity-0 invisible group-hover/tooltip:opacity-100 group-hover/tooltip:visible transition-opacity duration-150 whitespace-nowrap"
        role="tooltip"
      >
        <p className="font-medium truncate">{booking.serviceName}</p>
        <p className="text-gray-300 dark:text-gray-400">{formatPrice(booking.price)}</p>
        {booking.clientInfo.phone && (
          <p className="text-gray-300 dark:text-gray-400">{booking.clientInfo.phone}</p>
        )}
        {/* Arrow */}
        <div className="absolute right-full top-1/2 -translate-y-1/2 border-8 border-transparent border-r-gray-900 dark:border-r-gray-700" />
      </div>
    </div>
  );
}

/**
 * Status badge component - kept for use in BookingBlock
 */
export function StatusBadge({ status }: { status: VisualStatus }) {
  const config: Record<VisualStatus, { label: string; className: string }> = {
    past: {
      label: 'Passe',
      className: 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-400',
    },
    ongoing: {
      label: 'En cours',
      className: 'bg-primary-100 text-primary-700 dark:bg-primary-900/30 dark:text-primary-300',
    },
    confirmed: {
      label: 'Confirme',
      className: 'bg-success-100 text-success-700 dark:bg-success-900/30 dark:text-success-300',
    },
    pending: {
      label: 'En attente',
      className: 'bg-warning-100 text-warning-700 dark:bg-warning-900/30 dark:text-warning-300',
    },
    cancelled: {
      label: 'Annule',
      className: 'bg-error-100 text-error-700 dark:bg-error-900/30 dark:text-error-300',
    },
    noshow: {
      label: 'Absent',
      className: 'bg-error-100 text-error-700 dark:bg-error-900/30 dark:text-error-300',
    },
  };

  const { label, className } = config[status];

  return (
    <span className={`ml-auto text-xs font-medium px-2 py-0.5 rounded-full ${className}`}>
      {label}
    </span>
  );
}
