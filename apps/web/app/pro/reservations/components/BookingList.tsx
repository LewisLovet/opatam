'use client';

import { Calendar } from 'lucide-react';
import type { Booking, Member } from '@booking-app/shared';
import { BookingRow } from './BookingRow';
import { BookingCard } from './BookingCard';

type WithId<T> = { id: string } & T;

interface BookingListProps {
  bookings: WithId<Booking>[];
  members: WithId<Member>[];
  isTeamPlan: boolean;
  onView: (booking: WithId<Booking>) => void;
  onConfirm: (booking: WithId<Booking>) => void;
  onCancel: (booking: WithId<Booking>) => void;
  onComplete: (booking: WithId<Booking>) => void;
  onNoShow: (booking: WithId<Booking>) => void;
}

export function BookingList({
  bookings,
  members,
  isTeamPlan,
  onView,
  onConfirm,
  onCancel,
  onComplete,
  onNoShow,
}: BookingListProps) {
  if (bookings.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center">
        <div className="w-16 h-16 bg-gray-100 dark:bg-gray-700 rounded-full flex items-center justify-center mb-4">
          <Calendar className="w-8 h-8 text-gray-400 dark:text-gray-500" />
        </div>
        <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-1">
          Aucune réservation
        </h3>
        <p className="text-gray-500 dark:text-gray-400 max-w-sm">
          Aucune réservation ne correspond aux critères sélectionnés.
        </p>
      </div>
    );
  }

  return (
    <>
      {/* Desktop: Table view */}
      <div className="hidden lg:block overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="border-b border-gray-200 dark:border-gray-700">
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                Client
              </th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                Service
              </th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                Date / Heure
              </th>
              {isTeamPlan && (
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Membre
                </th>
              )}
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                Statut
              </th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider w-12">
                <span className="sr-only">Actions</span>
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
            {bookings.map((booking) => (
              <BookingRow
                key={booking.id}
                booking={booking}
                members={members}
                isTeamPlan={isTeamPlan}
                onView={onView}
                onConfirm={onConfirm}
                onCancel={onCancel}
                onComplete={onComplete}
                onNoShow={onNoShow}
              />
            ))}
          </tbody>
        </table>
      </div>

      {/* Mobile: Card view */}
      <div className="lg:hidden space-y-3 p-4">
        {bookings.map((booking) => (
          <BookingCard
            key={booking.id}
            booking={booking}
            members={members}
            isTeamPlan={isTeamPlan}
            onView={onView}
            onConfirm={onConfirm}
            onCancel={onCancel}
            onComplete={onComplete}
            onNoShow={onNoShow}
          />
        ))}
      </div>
    </>
  );
}
