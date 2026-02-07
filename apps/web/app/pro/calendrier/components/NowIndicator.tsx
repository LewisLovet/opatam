'use client';

import { useState, useEffect } from 'react';

interface NowIndicatorProps {
  startHour: number;
  endHour: number;
  slotHeight: number;
  /** Whether today is visible in the current view */
  isTodayVisible: boolean;
}

/**
 * A horizontal line indicator showing the current time.
 * Spans the full width of the calendar and updates every minute.
 */
export function NowIndicator({
  startHour,
  endHour,
  slotHeight,
  isTodayVisible,
}: NowIndicatorProps) {
  const [currentTime, setCurrentTime] = useState(new Date());

  // Update time every minute
  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentTime(new Date());
    }, 60000); // Update every minute

    return () => clearInterval(interval);
  }, []);

  // Don't render if today is not visible
  if (!isTodayVisible) return null;

  const currentHour = currentTime.getHours();
  const currentMinute = currentTime.getMinutes();

  // Don't render if current time is outside calendar hours
  if (currentHour < startHour || currentHour >= endHour) return null;

  // Calculate position
  const top = ((currentHour - startHour) * 60 + currentMinute) / 60 * slotHeight;

  return (
    <div
      className="absolute left-0 right-0 z-20 pointer-events-none"
      style={{ top: `${top}px` }}
    >
      <div className="relative flex items-center">
        {/* Red circle indicator */}
        <div className="absolute -left-0.5 w-2 h-2 bg-error-500 rounded-full shadow-sm" />
        {/* Red line */}
        <div className="w-full h-0.5 bg-error-500 shadow-sm" />
      </div>
    </div>
  );
}

/**
 * Full-width version of NowIndicator that spans from time labels to the end.
 * Use this at the calendar container level to span across all day columns.
 */
export function NowIndicatorFullWidth({
  startHour,
  endHour,
  slotHeight,
  isTodayVisible,
  timeColumnWidth = 56, // Default width of time labels column
}: NowIndicatorProps & { timeColumnWidth?: number }) {
  const [currentTime, setCurrentTime] = useState(new Date());

  // Update time every minute
  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentTime(new Date());
    }, 60000);

    return () => clearInterval(interval);
  }, []);

  if (!isTodayVisible) return null;

  const currentHour = currentTime.getHours();
  const currentMinute = currentTime.getMinutes();

  if (currentHour < startHour || currentHour >= endHour) return null;

  const top = ((currentHour - startHour) * 60 + currentMinute) / 60 * slotHeight;

  return (
    <div
      className="absolute left-0 right-0 z-20 pointer-events-none"
      style={{ top: `${top}px` }}
    >
      <div className="relative flex items-center">
        {/* Red circle at the left edge */}
        <div
          className="absolute w-3 h-3 bg-error-500 rounded-full shadow-md border-2 border-white dark:border-gray-800"
          style={{ left: `${timeColumnWidth - 6}px` }}
        />
        {/* Red line spanning full width */}
        <div
          className="absolute right-0 h-0.5 bg-error-500 shadow-sm"
          style={{ left: `${timeColumnWidth}px` }}
        />
      </div>
    </div>
  );
}
