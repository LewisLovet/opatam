'use client';

import { useMemo } from 'react';
import type { DaySchedule } from '../hooks/useScheduleReducer';

const DAY_LABELS: Record<number, string> = {
  1: 'Lun',
  2: 'Mar',
  3: 'Mer',
  4: 'Jeu',
  5: 'Ven',
  6: 'Sam',
  0: 'Dim',
};

const DAY_ORDER = [1, 2, 3, 4, 5, 6, 0];
const BAR_HEIGHT = 380;

// Compute dynamic hour range from schedule data
function computeHourRange(schedule: DaySchedule[]): { hourStart: number; hourEnd: number } {
  let earliest = 9;
  let latest = 18;

  for (const day of schedule) {
    if (!day.isOpen || day.slots.length === 0) continue;
    for (const slot of day.slots) {
      const [sh, sm] = slot.start.split(':').map(Number);
      const [eh, em] = slot.end.split(':').map(Number);
      const startH = sh + sm / 60;
      const endH = eh + em / 60;
      if (startH < earliest) earliest = startH;
      if (endH > latest) latest = endH;
    }
  }

  // Round down start to previous even hour (min 0), round up end to next even hour (max 24)
  const hourStart = Math.max(0, Math.floor(earliest / 2) * 2 - 1);
  const hourEnd = Math.min(24, Math.ceil(latest / 2) * 2 + 1);

  return { hourStart, hourEnd };
}

interface WeeklyPreviewProps {
  schedule: DaySchedule[];
  dirtyDays: Set<number>;
}

export function WeeklyPreview({ schedule, dirtyDays }: WeeklyPreviewProps) {
  const orderedDays = useMemo(
    () => DAY_ORDER.map((dow) => schedule.find((d) => d.dayOfWeek === dow)),
    [schedule]
  );

  const { hourStart, hourEnd } = useMemo(() => computeHourRange(schedule), [schedule]);
  const totalMinutes = (hourEnd - hourStart) * 60;

  function timeToY(time: string): number {
    const [h, m] = time.split(':').map(Number);
    const minutes = h * 60 + m - hourStart * 60;
    return Math.max(0, Math.min(BAR_HEIGHT, (minutes / totalMinutes) * BAR_HEIGHT));
  }

  const hourLabels = useMemo(() => {
    const labels: { hour: number; y: number }[] = [];
    for (let h = hourStart; h <= hourEnd; h += 2) {
      labels.push({
        hour: h,
        y: ((h - hourStart) / (hourEnd - hourStart)) * BAR_HEIGHT,
      });
    }
    return labels;
  }, [hourStart, hourEnd]);

  const gridLines = useMemo(() => {
    const lines: number[] = [];
    for (let h = hourStart; h <= hourEnd; h++) {
      lines.push(((h - hourStart) / (hourEnd - hourStart)) * BAR_HEIGHT);
    }
    return lines;
  }, [hourStart, hourEnd]);

  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-5">
      <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-4">
        Aperçu de la semaine
      </h3>

      <div className="flex">
        {/* Hour labels */}
        <div className="shrink-0 w-8 relative" style={{ height: BAR_HEIGHT, marginTop: 20 }}>
          {hourLabels.map(({ hour, y }) => (
            <span
              key={hour}
              className="absolute right-2 text-[10px] text-gray-400 dark:text-gray-500 leading-none"
              style={{ top: y, transform: 'translateY(-50%)' }}
            >
              {hour}h
            </span>
          ))}
        </div>

        {/* Day columns with grid lines */}
        <div className="flex-1 flex gap-1.5 relative">
          {/* Grid lines */}
          <div
            className="absolute inset-x-0 pointer-events-none"
            style={{ top: 20, height: BAR_HEIGHT }}
          >
            {gridLines.map((y, i) => (
              <div
                key={i}
                className="absolute left-0 right-0 border-t border-gray-100 dark:border-gray-700/30"
                style={{ top: y }}
              />
            ))}
          </div>

          {orderedDays.map((day) => {
            if (!day) return null;

            return (
              <div key={day.dayOfWeek} className="flex-1 flex flex-col items-center relative z-10">
                {/* Day label */}
                <span
                  className={`text-[11px] mb-1.5 leading-none ${
                    day.isOpen
                      ? 'text-gray-700 dark:text-gray-300 font-medium'
                      : 'text-gray-400 dark:text-gray-500'
                  }`}
                >
                  {DAY_LABELS[day.dayOfWeek]}
                </span>

                {/* Vertical bar */}
                <div
                  className={`relative w-full rounded-md ${
                    day.isOpen
                      ? 'bg-gray-50 dark:bg-gray-700/30'
                      : 'bg-gray-50/50 dark:bg-gray-800/20'
                  }`}
                  style={{ height: BAR_HEIGHT }}
                >
                  {day.isOpen && day.slots.length > 0
                    ? day.slots.map((slot, i) => {
                        const top = timeToY(slot.start);
                        const bottom = timeToY(slot.end);
                        const height = bottom - top;
                        if (height <= 0) return null;

                        return (
                          <div
                            key={i}
                            className="absolute left-0.5 right-0.5 rounded-sm bg-primary-500 dark:bg-primary-400"
                            style={{ top, height }}
                          >
                            {height >= 30 && (
                              <div className="absolute inset-0 flex flex-col items-center justify-center">
                                <span className="text-[8px] text-white/90 font-medium leading-tight">
                                  {slot.start}
                                </span>
                                <span className="text-[8px] text-white/90 font-medium leading-tight">
                                  {slot.end}
                                </span>
                              </div>
                            )}
                          </div>
                        );
                      })
                    : !day.isOpen && (
                        <div className="absolute inset-0 flex items-center justify-center">
                          <div className="w-3 h-px bg-gray-200 dark:bg-gray-600" />
                        </div>
                      )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Summary */}
      <div className="mt-4 pt-3 border-t border-gray-100 dark:border-gray-700/50">
        <SummaryStats schedule={schedule} />
      </div>
    </div>
  );
}

function SummaryStats({ schedule }: { schedule: DaySchedule[] }) {
  const stats = useMemo(() => {
    let openDays = 0;
    let totalMinutes = 0;

    for (const day of schedule) {
      if (!day.isOpen || day.slots.length === 0) continue;
      openDays++;
      for (const slot of day.slots) {
        const [sh, sm] = slot.start.split(':').map(Number);
        const [eh, em] = slot.end.split(':').map(Number);
        totalMinutes += (eh * 60 + em) - (sh * 60 + sm);
      }
    }

    const totalHours = Math.round(totalMinutes / 60);
    return { openDays, totalHours };
  }, [schedule]);

  return (
    <div className="flex items-center justify-between text-xs text-gray-500 dark:text-gray-400">
      <span>{stats.openDays} jour{stats.openDays > 1 ? 's' : ''} ouvert{stats.openDays > 1 ? 's' : ''}</span>
      <span>{stats.totalHours}h / semaine</span>
    </div>
  );
}
