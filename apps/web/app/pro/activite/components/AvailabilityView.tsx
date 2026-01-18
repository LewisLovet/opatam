'use client';

import { Clock } from 'lucide-react';
import type { Availability, TimeSlot } from '@booking-app/shared';

type WithId<T> = { id: string } & T;

const DAY_NAMES = ['Dim', 'Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam'];
const DAY_NAMES_FULL = ['Dimanche', 'Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi'];

interface DaySchedule {
  dayOfWeek: number;
  isOpen: boolean;
  slots: TimeSlot[];
}

interface AvailabilityViewProps {
  availabilities: WithId<Availability>[];
}

// Default schedule for display
const getDefaultSchedule = (): DaySchedule[] => [
  { dayOfWeek: 0, isOpen: false, slots: [] },
  { dayOfWeek: 1, isOpen: true, slots: [{ start: '09:00', end: '18:00' }] },
  { dayOfWeek: 2, isOpen: true, slots: [{ start: '09:00', end: '18:00' }] },
  { dayOfWeek: 3, isOpen: true, slots: [{ start: '09:00', end: '18:00' }] },
  { dayOfWeek: 4, isOpen: true, slots: [{ start: '09:00', end: '18:00' }] },
  { dayOfWeek: 5, isOpen: true, slots: [{ start: '09:00', end: '18:00' }] },
  { dayOfWeek: 6, isOpen: false, slots: [] },
];

export function AvailabilityView({ availabilities }: AvailabilityViewProps) {
  // Build schedule from availabilities
  const schedule: DaySchedule[] = getDefaultSchedule().map((defaultDay) => {
    const existing = availabilities.find((a) => a.dayOfWeek === defaultDay.dayOfWeek);
    if (existing) {
      return {
        dayOfWeek: existing.dayOfWeek,
        isOpen: existing.isOpen,
        slots: existing.slots,
      };
    }
    return defaultDay;
  });

  // Reorder: Monday to Sunday (1,2,3,4,5,6,0)
  const orderedSchedule = [
    schedule[1], // Monday
    schedule[2], // Tuesday
    schedule[3], // Wednesday
    schedule[4], // Thursday
    schedule[5], // Friday
    schedule[6], // Saturday
    schedule[0], // Sunday
  ];

  const formatSlots = (slots: TimeSlot[]): string => {
    if (slots.length === 0) return '';
    return slots.map((s) => `${s.start} - ${s.end}`).join(', ');
  };

  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden">
      {/* Table header - hidden on mobile */}
      <div className="hidden sm:grid sm:grid-cols-7 bg-gray-50 dark:bg-gray-900/50 border-b border-gray-200 dark:border-gray-700">
        {orderedSchedule.map((day) => (
          <div
            key={day.dayOfWeek}
            className="px-3 py-2 text-center text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase"
          >
            {DAY_NAMES[day.dayOfWeek]}
          </div>
        ))}
      </div>

      {/* Desktop view - grid */}
      <div className="hidden sm:grid sm:grid-cols-7 divide-x divide-gray-200 dark:divide-gray-700">
        {orderedSchedule.map((day) => (
          <div
            key={day.dayOfWeek}
            className={`p-3 min-h-[80px] ${
              !day.isOpen ? 'bg-gray-50 dark:bg-gray-900/30' : ''
            }`}
          >
            {day.isOpen ? (
              <div className="space-y-1">
                {day.slots.map((slot, idx) => (
                  <div
                    key={idx}
                    className="flex items-center gap-1 text-sm text-gray-700 dark:text-gray-300"
                  >
                    <Clock className="w-3 h-3 text-gray-400 flex-shrink-0" />
                    <span className="whitespace-nowrap">
                      {slot.start} - {slot.end}
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              <div className="flex items-center justify-center h-full">
                <span className="text-sm text-gray-400 dark:text-gray-500">Ferme</span>
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Mobile view - list */}
      <div className="sm:hidden divide-y divide-gray-200 dark:divide-gray-700">
        {orderedSchedule.map((day) => (
          <div
            key={day.dayOfWeek}
            className={`flex items-center justify-between px-4 py-3 ${
              !day.isOpen ? 'bg-gray-50 dark:bg-gray-900/30' : ''
            }`}
          >
            <span className="font-medium text-gray-900 dark:text-white">
              {DAY_NAMES_FULL[day.dayOfWeek]}
            </span>
            {day.isOpen ? (
              <span className="text-sm text-gray-600 dark:text-gray-400">
                {formatSlots(day.slots)}
              </span>
            ) : (
              <span className="text-sm text-gray-400 dark:text-gray-500">Ferme</span>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
