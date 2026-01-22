'use client';

import { Clock, CheckCircle, XCircle } from 'lucide-react';

interface DaySchedule {
  day: string;
  isOpen: boolean;
  slots: { start: string; end: string }[];
}

interface HoursCardProps {
  weekSchedule: DaySchedule[];
}

function getCurrentDayIndex(): number {
  const now = new Date();
  // Convert to Monday-first (0=Mon, 6=Sun)
  const jsDay = now.getDay(); // 0=Sun, 1=Mon, ...
  return jsDay === 0 ? 6 : jsDay - 1;
}

function isCurrentlyOpen(schedule: DaySchedule[]): boolean {
  const now = new Date();
  const currentDayIndex = getCurrentDayIndex();
  const todaySchedule = schedule[currentDayIndex];

  if (!todaySchedule?.isOpen || !todaySchedule.slots.length) {
    return false;
  }

  const currentTime = now.getHours() * 60 + now.getMinutes();

  return todaySchedule.slots.some((slot) => {
    const [startHour, startMin] = slot.start.split(':').map(Number);
    const [endHour, endMin] = slot.end.split(':').map(Number);
    const startTime = startHour * 60 + startMin;
    const endTime = endHour * 60 + endMin;
    return currentTime >= startTime && currentTime < endTime;
  });
}

export function HoursCard({ weekSchedule }: HoursCardProps) {
  const currentDayIndex = getCurrentDayIndex();
  const isOpen = isCurrentlyOpen(weekSchedule);

  return (
    <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700 overflow-hidden">
      {/* Header with open/closed badge */}
      <div className="px-5 py-4 border-b border-gray-100 dark:border-gray-700 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Clock className="w-5 h-5 text-primary-500" />
          <h4 className="font-semibold text-gray-900 dark:text-white">
            Horaires
          </h4>
        </div>

        {/* Open/Closed badge */}
        <span className={`
          inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-sm font-medium
          ${isOpen
            ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400'
            : 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400'
          }
        `}>
          {isOpen ? (
            <>
              <CheckCircle className="w-4 h-4" />
              Ouvert
            </>
          ) : (
            <>
              <XCircle className="w-4 h-4" />
              Fermé
            </>
          )}
        </span>
      </div>

      {/* Schedule list */}
      <div className="p-5">
        <div className="space-y-2">
          {weekSchedule.map((day, index) => {
            const isToday = index === currentDayIndex;

            return (
              <div
                key={day.day}
                className={`
                  flex justify-between items-center py-2 px-3 rounded-lg transition-colors
                  ${isToday
                    ? 'bg-primary-50 dark:bg-primary-900/20'
                    : 'hover:bg-gray-50 dark:hover:bg-gray-700/50'
                  }
                `}
              >
                <span className={`
                  font-medium
                  ${isToday
                    ? 'text-primary-700 dark:text-primary-400'
                    : 'text-gray-700 dark:text-gray-300'
                  }
                `}>
                  {day.day}
                  {isToday && (
                    <span className="ml-2 text-xs text-primary-500 dark:text-primary-400">
                      (Aujourd'hui)
                    </span>
                  )}
                </span>

                <span className={`
                  text-sm
                  ${day.isOpen
                    ? isToday
                      ? 'text-primary-700 dark:text-primary-300 font-medium'
                      : 'text-gray-900 dark:text-white'
                    : 'text-gray-400 dark:text-gray-500'
                  }
                `}>
                  {day.isOpen && day.slots.length > 0
                    ? day.slots.map((slot, i) => (
                        <span key={i}>
                          {i > 0 && ', '}
                          {slot.start} - {slot.end}
                        </span>
                      ))
                    : 'Fermé'}
                </span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
