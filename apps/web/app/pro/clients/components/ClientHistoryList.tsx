'use client';

/**
 * Booking history list inside the client drawer.
 *
 * Pure renderer — the parent drawer owns the fetch + caches the
 * result so it can also derive fréquence + top services from the
 * same data without a duplicate query.
 */

import {
  Calendar,
  CheckCircle2,
  XCircle,
  Clock,
  AlertCircle,
} from 'lucide-react';
import { formatPrice } from '@booking-app/shared';
import type { Booking, BookingStatus } from '@booking-app/shared';

type WithId<T> = { id: string } & T;

interface Props {
  bookings: WithId<Booking>[];
  loading: boolean;
  error: string | null;
  /** Called when the user clicks a history row. Lets the parent open
   *  the existing BookingDetailModal — the drawer itself doesn't
   *  need to know about that wiring. */
  onBookingClick?: (booking: WithId<Booking>) => void;
}

const STATUS_LABELS: Record<BookingStatus, string> = {
  pending: 'En attente',
  pending_payment: 'Attente paiement',
  confirmed: 'Confirmé',
  cancelled: 'Annulé',
  noshow: 'No-show',
};

const STATUS_COLORS: Record<BookingStatus, string> = {
  pending: 'text-amber-600 dark:text-amber-400',
  pending_payment: 'text-amber-600 dark:text-amber-400',
  confirmed: 'text-emerald-600 dark:text-emerald-400',
  cancelled: 'text-gray-400 dark:text-gray-500',
  noshow: 'text-red-600 dark:text-red-400',
};

const STATUS_ICONS: Record<BookingStatus, React.ComponentType<{ className?: string }>> = {
  pending: Clock,
  pending_payment: AlertCircle,
  confirmed: CheckCircle2,
  cancelled: XCircle,
  noshow: AlertCircle,
};

export function ClientHistoryList({
  bookings,
  loading,
  error,
  onBookingClick,
}: Props) {
  if (loading) {
    return (
      <p className="text-sm text-gray-400 dark:text-gray-500">
        Chargement de l'historique…
      </p>
    );
  }

  if (error) {
    return (
      <p className="text-sm text-red-500 dark:text-red-400">
        {error}
      </p>
    );
  }

  if (bookings.length === 0) {
    return (
      <p className="text-sm text-gray-400 dark:text-gray-500">
        Aucune réservation dans l'historique.
      </p>
    );
  }

  return (
    <ul className="space-y-2">
      {bookings.map((b) => {
        const StatusIcon = STATUS_ICONS[b.status];
        const isPast = b.datetime.getTime() < Date.now();
        return (
          <li key={b.id}>
            <button
              type="button"
              onClick={() => onBookingClick?.(b)}
              className="w-full flex items-start gap-3 px-3 py-2.5 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 hover:border-primary-400 dark:hover:border-primary-500 transition-colors text-left"
            >
              <div className="flex-shrink-0 mt-0.5">
                <Calendar className="w-4 h-4 text-gray-400 dark:text-gray-500" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <p className="text-sm font-medium text-gray-900 dark:text-white truncate">
                    {b.serviceName}
                  </p>
                  <span
                    className={`inline-flex items-center gap-1 text-xs ${STATUS_COLORS[b.status]}`}
                  >
                    <StatusIcon className="w-3.5 h-3.5" />
                    {STATUS_LABELS[b.status]}
                  </span>
                </div>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                  {formatBookingDate(b.datetime)}
                  {b.memberName ? ` · ${b.memberName}` : ''}
                  {!isPast ? ' · à venir' : ''}
                </p>
              </div>
              <span className="text-sm font-semibold text-gray-900 dark:text-white tabular-nums flex-shrink-0">
                {formatPrice(b.price)}
              </span>
            </button>
          </li>
        );
      })}
    </ul>
  );
}

/** "Lun 12 mai · 14:30" — compact and immediately readable. */
function formatBookingDate(d: Date): string {
  return d.toLocaleDateString('fr-FR', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
  }) + ' · ' + d.toLocaleTimeString('fr-FR', {
    hour: '2-digit',
    minute: '2-digit',
  });
}
