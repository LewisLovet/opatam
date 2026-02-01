'use client';

import { useMemo } from 'react';

interface TimeGridProps {
  startHour?: number;
  endHour?: number;
  slotHeight?: number;
  showLabels?: boolean;
  children?: React.ReactNode;
}

export function TimeGrid({
  startHour = 6,
  endHour = 22,
  slotHeight = 60,
  showLabels = true,
  children,
}: TimeGridProps) {
  const hours = useMemo(() => {
    const h = [];
    for (let i = startHour; i <= endHour; i++) {
      h.push(i);
    }
    return h;
  }, [startHour, endHour]);

  const totalHeight = (endHour - startHour) * slotHeight;

  return (
    <div className="relative flex" style={{ height: `${totalHeight}px` }}>
      {/* Time labels */}
      {showLabels && (
        <div className="flex-shrink-0 w-14 sm:w-16 relative">
          {hours.map((hour) => {
            // Display "00:00" for midnight instead of "24:00"
            const displayHour = hour === 24 ? 0 : hour;
            return (
              <div
                key={hour}
                className="absolute right-2 -translate-y-1/2 text-xs text-gray-500 dark:text-gray-400"
                style={{ top: `${(hour - startHour) * slotHeight}px` }}
              >
                {displayHour.toString().padStart(2, '0')}:00
              </div>
            );
          })}
        </div>
      )}

      {/* Grid lines and content area */}
      <div className="flex-1 relative">
        {/* Hour lines */}
        {hours.map((hour) => (
          <div
            key={hour}
            className="absolute left-0 right-0 border-t border-gray-200 dark:border-gray-700"
            style={{ top: `${(hour - startHour) * slotHeight}px` }}
          />
        ))}

        {/* Half-hour lines */}
        {hours.slice(0, -1).map((hour) => (
          <div
            key={`${hour}-30`}
            className="absolute left-0 right-0 border-t border-gray-100 dark:border-gray-800 border-dashed"
            style={{ top: `${(hour - startHour) * slotHeight + slotHeight / 2}px` }}
          />
        ))}

        {/* Children (booking blocks, availability overlays, etc.) */}
        {children}
      </div>
    </div>
  );
}

/**
 * Calculate vertical position and height for a time block
 */
export function calculateBlockPosition(
  startTime: Date,
  endTime: Date,
  startHour: number = 6,
  slotHeight: number = 60
): { top: number; height: number } {
  const startMinutes = startTime.getHours() * 60 + startTime.getMinutes();
  const endMinutes = endTime.getHours() * 60 + endTime.getMinutes();
  const startMinutesFromGrid = startMinutes - startHour * 60;
  const durationMinutes = endMinutes - startMinutes;

  const top = (startMinutesFromGrid / 60) * slotHeight;
  const height = (durationMinutes / 60) * slotHeight;

  return { top: Math.max(0, top), height: Math.max(0, height) };
}

/**
 * Calculate position from time string (HH:mm)
 */
export function calculatePositionFromTimeString(
  startTimeStr: string,
  endTimeStr: string,
  startHour: number = 6,
  slotHeight: number = 60
): { top: number; height: number } {
  const [startH, startM] = startTimeStr.split(':').map(Number);
  const [endH, endM] = endTimeStr.split(':').map(Number);

  const startMinutes = startH * 60 + startM;
  const endMinutes = endH * 60 + endM;
  const startMinutesFromGrid = startMinutes - startHour * 60;
  const durationMinutes = endMinutes - startMinutes;

  const top = (startMinutesFromGrid / 60) * slotHeight;
  const height = (durationMinutes / 60) * slotHeight;

  return { top: Math.max(0, top), height: Math.max(0, height) };
}

/**
 * Get time from click position on the grid
 */
export function getTimeFromPosition(
  y: number,
  startHour: number = 6,
  slotHeight: number = 60,
  roundToMinutes: number = 15
): { hours: number; minutes: number } {
  const totalMinutes = Math.round((y / slotHeight) * 60) + startHour * 60;
  const roundedMinutes = Math.round(totalMinutes / roundToMinutes) * roundToMinutes;

  const hours = Math.floor(roundedMinutes / 60);
  const minutes = roundedMinutes % 60;

  return { hours, minutes };
}
