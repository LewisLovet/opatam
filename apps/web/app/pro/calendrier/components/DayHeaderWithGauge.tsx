'use client';

import type { Booking } from '@booking-app/shared';

type WithId<T> = { id: string } & T;

interface DayHeaderWithGaugeProps {
  date: Date;
  bookings: WithId<Booking>[];
  /** Expected capacity for the day (e.g., based on availability hours) */
  expectedCapacity?: number;
  onClick?: () => void;
  isCompact?: boolean;
}

const DAY_NAMES_SHORT = ['Dim', 'Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam'];
const DAY_NAMES_FULL = ['Dimanche', 'Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi'];

/**
 * Day header component with fill gauge showing booking count vs capacity.
 * Used in week view to display day information and occupancy.
 */
export function DayHeaderWithGauge({
  date,
  bookings,
  expectedCapacity = 8, // Default to 8 appointments per day
  onClick,
  isCompact = false,
}: DayHeaderWithGaugeProps) {
  const today = new Date();
  const isToday =
    date.getDate() === today.getDate() &&
    date.getMonth() === today.getMonth() &&
    date.getFullYear() === today.getFullYear();

  const isPast = date < new Date(today.setHours(0, 0, 0, 0));

  // Count active bookings (not cancelled or noshow)
  const activeBookings = bookings.filter(
    (b) => b.status === 'pending' || b.status === 'confirmed'
  );
  const bookingCount = activeBookings.length;

  // Calculate fill percentage (capped at 100%)
  const fillPercentage = Math.min((bookingCount / expectedCapacity) * 100, 100);

  // Determine gauge color based on fill level
  const getGaugeColor = () => {
    if (fillPercentage >= 90) return 'bg-error-500';
    if (fillPercentage >= 70) return 'bg-warning-500';
    if (fillPercentage >= 50) return 'bg-primary-500';
    return 'bg-success-500';
  };

  const dayName = isCompact ? DAY_NAMES_SHORT[date.getDay()] : DAY_NAMES_FULL[date.getDay()];

  return (
    <button
      onClick={onClick}
      className={`
        w-full py-2 px-1 text-center transition-colors
        hover:bg-gray-50 dark:hover:bg-gray-700/50
        ${isToday ? 'bg-primary-50/50 dark:bg-primary-900/20' : ''}
        ${isPast ? 'opacity-60' : ''}
      `}
    >
      {/* Day name */}
      <div className={`
        text-xs font-medium
        ${isToday
          ? 'text-primary-600 dark:text-primary-400'
          : 'text-gray-500 dark:text-gray-400'}
      `}>
        {dayName}
      </div>

      {/* Day number */}
      <div
        className={`
          text-lg font-semibold mt-0.5 mx-auto
          ${isToday
            ? 'w-8 h-8 flex items-center justify-center bg-primary-500 text-white rounded-full'
            : 'text-gray-900 dark:text-white'}
        `}
      >
        {date.getDate()}
      </div>

      {/* Booking count */}
      <div className={`
        text-[10px] mt-1
        ${bookingCount > 0
          ? 'text-gray-700 dark:text-gray-300'
          : 'text-gray-400 dark:text-gray-500'}
      `}>
        {bookingCount} RDV
      </div>

      {/* Fill gauge */}
      <div className="mt-1 mx-1 h-1 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full transition-all duration-300 ${getGaugeColor()}`}
          style={{ width: `${fillPercentage}%` }}
        />
      </div>
    </button>
  );
}

/**
 * Compact version for week view with limited space
 */
export function DayHeaderCompact({
  date,
  bookingCount,
  expectedCapacity = 8,
  onClick,
}: {
  date: Date;
  bookingCount: number;
  expectedCapacity?: number;
  onClick?: () => void;
}) {
  const today = new Date();
  const isToday =
    date.getDate() === today.getDate() &&
    date.getMonth() === today.getMonth() &&
    date.getFullYear() === today.getFullYear();

  const fillPercentage = Math.min((bookingCount / expectedCapacity) * 100, 100);

  const getGaugeColor = () => {
    if (fillPercentage >= 90) return 'bg-error-500';
    if (fillPercentage >= 70) return 'bg-warning-500';
    if (fillPercentage >= 50) return 'bg-primary-500';
    return 'bg-success-500';
  };

  return (
    <button
      onClick={onClick}
      className={`
        flex-1 min-w-[80px] py-2 text-center border-l border-gray-200 dark:border-gray-700
        hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors
        ${isToday ? 'bg-primary-50/50 dark:bg-primary-900/20' : ''}
      `}
    >
      <div className={`
        text-xs
        ${isToday
          ? 'text-primary-600 dark:text-primary-400'
          : 'text-gray-500 dark:text-gray-400'}
      `}>
        {DAY_NAMES_SHORT[date.getDay()]}
      </div>
      <div
        className={`
          text-lg font-semibold mt-0.5
          ${isToday
            ? 'w-8 h-8 mx-auto flex items-center justify-center bg-primary-500 text-white rounded-full'
            : 'text-gray-900 dark:text-white'}
        `}
      >
        {date.getDate()}
      </div>

      {/* Mini gauge with count */}
      <div className="flex items-center justify-center gap-1 mt-1">
        <span className="text-[10px] text-gray-500 dark:text-gray-400">
          {bookingCount}
        </span>
        <div className="w-8 h-1 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
          <div
            className={`h-full rounded-full ${getGaugeColor()}`}
            style={{ width: `${fillPercentage}%` }}
          />
        </div>
      </div>
    </button>
  );
}
