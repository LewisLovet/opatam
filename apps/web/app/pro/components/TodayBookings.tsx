'use client';

import Link from 'next/link';
import { Calendar, ChevronRight, Mail, Phone, Clock } from 'lucide-react';
import type { Booking, Member } from '@booking-app/shared';
import { formatBookingPrice, formatDuration } from '@/lib/booking-utils';

type WithId<T> = { id: string } & T;

interface TodayBookingsProps {
  bookings: WithId<Booking>[];
  members: WithId<Member>[];
  isTeamPlan: boolean;
  onBookingClick: (booking: WithId<Booking>) => void;
}

function formatTime(date: Date): string {
  return new Date(date).toLocaleTimeString('fr-FR', {
    hour: '2-digit',
    minute: '2-digit',
  });
}

function getInitials(name: string): string {
  return name
    .split(' ')
    .map((n) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);
}

export function TodayBookings({
  bookings,
  members,
  isTeamPlan,
  onBookingClick,
}: TodayBookingsProps) {
  // Sort by time and limit to 5
  const sortedBookings = [...bookings]
    .sort((a, b) => new Date(a.datetime).getTime() - new Date(b.datetime).getTime())
    .slice(0, 5);

  const getMemberName = (memberId: string | null) => {
    if (!memberId) return null;
    const member = members.find((m) => m.id === memberId);
    return member?.name || null;
  };

  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden">
      <div className="p-4 sm:px-5 border-b border-gray-200 dark:border-gray-700">
        <div className="flex items-center justify-between">
          <h3 className="font-semibold text-gray-900 dark:text-white">
            Rendez-vous du jour
          </h3>
          {bookings.length > 0 && (
            <span className="text-sm text-gray-500 dark:text-gray-400">
              {bookings.length} RDV
            </span>
          )}
        </div>
      </div>

      {sortedBookings.length === 0 ? (
        <div className="p-8 text-center">
          <Calendar className="w-12 h-12 text-gray-300 dark:text-gray-600 mx-auto mb-3" />
          <p className="text-gray-500 dark:text-gray-400">
            Aucun rendez-vous aujourd&apos;hui
          </p>
        </div>
      ) : (
        <div className="divide-y divide-gray-100 dark:divide-gray-700/50">
          {sortedBookings.map((booking) => {
            const memberName = getMemberName(booking.memberId);
            const isPending = booking.status === 'pending';

            return (
              <button
                key={booking.id}
                onClick={() => onBookingClick(booking)}
                className="w-full flex items-start gap-4 p-4 sm:px-5 hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors text-left group"
              >
                {/* Time block */}
                <div className="flex-shrink-0 w-14 h-14 rounded-xl bg-primary-50 dark:bg-primary-900/20 flex flex-col items-center justify-center">
                  <span className="text-lg font-bold text-primary-700 dark:text-primary-300 leading-tight">
                    {formatTime(new Date(booking.datetime))}
                  </span>
                  {isPending && (
                    <span className="text-[10px] font-medium text-warning-600 dark:text-warning-400 uppercase">
                      En attente
                    </span>
                  )}
                </div>

                {/* Avatar */}
                <div className="flex-shrink-0 w-10 h-10 rounded-full bg-gradient-to-br from-primary-100 to-primary-200 dark:from-primary-900/50 dark:to-primary-800/50 flex items-center justify-center">
                  <span className="text-sm font-semibold text-primary-700 dark:text-primary-300">
                    {getInitials(booking.clientInfo.name)}
                  </span>
                </div>

                {/* Content */}
                <div className="flex-1 min-w-0">
                  {/* Client name */}
                  <p className="font-semibold text-gray-900 dark:text-white truncate">
                    {booking.clientInfo.name}
                  </p>

                  {/* Contact info */}
                  <div className="flex items-center gap-3 mt-0.5">
                    <span className="flex items-center gap-1 text-xs text-gray-500 dark:text-gray-400">
                      <Mail className="w-3 h-3 flex-shrink-0" />
                      <span className="truncate max-w-[150px]">{booking.clientInfo.email}</span>
                    </span>
                    {booking.clientInfo.phone && (
                      <span className="hidden sm:flex items-center gap-1 text-xs text-gray-500 dark:text-gray-400">
                        <Phone className="w-3 h-3 flex-shrink-0" />
                        {booking.clientInfo.phone}
                      </span>
                    )}
                  </div>

                  {/* Service details */}
                  <div className="mt-1.5 flex items-center gap-2 flex-wrap">
                    <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                      {booking.serviceName}
                    </span>
                    <span className="text-gray-300 dark:text-gray-600">•</span>
                    <span className="flex items-center gap-1 text-xs text-gray-500 dark:text-gray-400">
                      <Clock className="w-3 h-3" />
                      {formatDuration(booking.duration)}
                    </span>
                    <span className="text-xs font-medium text-gray-600 dark:text-gray-300">
                      {formatBookingPrice(booking.price)}
                    </span>
                    {isTeamPlan && memberName && (
                      <>
                        <span className="text-gray-300 dark:text-gray-600">•</span>
                        <span className="text-xs text-gray-500 dark:text-gray-400">
                          {memberName}
                        </span>
                      </>
                    )}
                  </div>
                </div>

                {/* Arrow */}
                <ChevronRight className="w-5 h-5 text-gray-300 dark:text-gray-600 flex-shrink-0 mt-4 group-hover:text-gray-400 dark:group-hover:text-gray-500 transition-colors" />
              </button>
            );
          })}
        </div>
      )}

      {bookings.length > 0 && (
        <div className="p-3 sm:px-5 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50">
          <Link
            href="/pro/calendrier"
            className="text-sm font-medium text-primary-600 hover:text-primary-700 dark:text-primary-400 dark:hover:text-primary-300 flex items-center justify-center gap-1"
          >
            Voir le calendrier
            <ChevronRight className="w-4 h-4" />
          </Link>
        </div>
      )}
    </div>
  );
}
