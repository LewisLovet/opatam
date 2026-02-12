'use client';

import { Calendar, XCircle, Clock } from 'lucide-react';
import type { Booking, Member } from '@booking-app/shared';

type WithId<T> = { id: string } & T;

interface RecentActivityProps {
  upcomingBookings: WithId<Booking>[];
  recentCancellations: WithId<Booking>[];
  members: WithId<Member>[];
  isTeamPlan: boolean;
  onBookingClick: (booking: WithId<Booking>) => void;
}

function formatRelativeDate(date: Date): string {
  const now = new Date();
  const target = new Date(date);

  // Reset time for date comparison
  const nowDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const targetDate = new Date(target.getFullYear(), target.getMonth(), target.getDate());

  const diffDays = Math.round((targetDate.getTime() - nowDate.getTime()) / (1000 * 60 * 60 * 24));

  if (diffDays === 0) return "Aujourd'hui";
  if (diffDays === 1) return 'Demain';
  if (diffDays === -1) return 'Hier';

  // Return formatted date for other days
  return target.toLocaleDateString('fr-FR', {
    weekday: 'long',
    day: 'numeric',
    month: 'short',
  });
}

function formatRelativeTime(date: Date): string {
  const now = new Date();
  const diff = now.getTime() - new Date(date).getTime();

  const minutes = Math.floor(diff / (1000 * 60));
  const hours = Math.floor(diff / (1000 * 60 * 60));
  const days = Math.floor(diff / (1000 * 60 * 60 * 24));

  if (minutes < 60) return `Il y a ${minutes} min`;
  if (hours < 24) return `Il y a ${hours}h`;
  if (days === 1) return 'Hier';
  if (days < 7) return `Il y a ${days} jours`;

  return new Date(date).toLocaleDateString('fr-FR', {
    day: 'numeric',
    month: 'short',
  });
}

function formatTime(date: Date): string {
  return new Date(date).toLocaleTimeString('fr-FR', {
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function RecentActivity({
  upcomingBookings,
  recentCancellations,
  members,
  isTeamPlan,
  onBookingClick,
}: RecentActivityProps) {
  const hasActivity = upcomingBookings.length > 0 || recentCancellations.length > 0;

  if (!hasActivity) {
    return (
      <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden">
        <div className="p-4 sm:px-5 border-b border-gray-200 dark:border-gray-700">
          <h3 className="font-semibold text-gray-900 dark:text-white">
            Activité récente
          </h3>
        </div>
        <div className="p-8 text-center">
          <Clock className="w-12 h-12 text-gray-300 dark:text-gray-600 mx-auto mb-3" />
          <p className="text-gray-500 dark:text-gray-400">
            Aucune activité récente
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden">
      <div className="p-4 sm:px-5 border-b border-gray-200 dark:border-gray-700">
        <h3 className="font-semibold text-gray-900 dark:text-white">
          Activité récente
        </h3>
      </div>

      <div className="divide-y divide-gray-200 dark:divide-gray-700">
        {/* Upcoming bookings */}
        {upcomingBookings.length > 0 && (
          <div className="p-4 sm:px-5">
            <p className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-3">
              Prochains rendez-vous
            </p>
            <div className="space-y-3">
              {upcomingBookings.slice(0, 5).map((booking) => (
                <button
                  key={booking.id}
                  onClick={() => onBookingClick(booking)}
                  className="w-full flex items-start gap-3 text-left hover:bg-gray-50 dark:hover:bg-gray-700/50 -mx-2 px-2 py-1.5 rounded-lg transition-colors"
                >
                  <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-primary-100 dark:bg-primary-900/30 text-primary-600 dark:text-primary-400 flex-shrink-0">
                    <Calendar className="w-4 h-4" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-900 dark:text-white truncate">
                      {booking.clientInfo.name}
                      <span className="text-gray-500 dark:text-gray-400"> • </span>
                      <span className="text-gray-600 dark:text-gray-300">{booking.serviceName}</span>
                    </p>
                    <p className="text-xs text-gray-500 dark:text-gray-400">
                      <span className="capitalize">{formatRelativeDate(new Date(booking.datetime))}</span>
                      {' '}a {formatTime(new Date(booking.datetime))}
                    </p>
                  </div>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Recent cancellations */}
        {recentCancellations.length > 0 && (
          <div className="p-4 sm:px-5">
            <p className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-3">
              Annulations recentes
            </p>
            <div className="space-y-3">
              {recentCancellations.slice(0, 3).map((booking) => (
                <button
                  key={booking.id}
                  onClick={() => onBookingClick(booking)}
                  className="w-full flex items-start gap-3 text-left hover:bg-gray-50 dark:hover:bg-gray-700/50 -mx-2 px-2 py-1.5 rounded-lg transition-colors"
                >
                  <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-error-100 dark:bg-error-900/30 text-error-600 dark:text-error-400 flex-shrink-0">
                    <XCircle className="w-4 h-4" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-900 dark:text-white truncate">
                      {booking.clientInfo.name}
                      <span className="text-gray-500 dark:text-gray-400"> • </span>
                      <span className="text-gray-600 dark:text-gray-300">{booking.serviceName}</span>
                    </p>
                    <p className="text-xs text-gray-500 dark:text-gray-400">
                      Annulé {booking.cancelledBy === 'client' ? 'par le client' : 'par vous'}
                      {' • '}
                      {formatRelativeTime(new Date(booking.cancelledAt || booking.updatedAt))}
                    </p>
                  </div>
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
