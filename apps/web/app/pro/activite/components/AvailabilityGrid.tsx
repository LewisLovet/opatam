'use client';

import { useState, useEffect } from 'react';
import { DayAvailability } from './DayAvailability';
import type { TimeSlot, Availability } from '@booking-app/shared';

type WithId<T> = { id: string } & T;

interface DaySchedule {
  dayOfWeek: number;
  isOpen: boolean;
  slots: TimeSlot[];
}

interface AvailabilityGridProps {
  availabilities: WithId<Availability>[];
  onChange: (schedule: DaySchedule[]) => void;
}

// Default schedule for new providers
const getDefaultSchedule = (): DaySchedule[] => [
  { dayOfWeek: 0, isOpen: false, slots: [] }, // Sunday
  { dayOfWeek: 1, isOpen: true, slots: [{ start: '09:00', end: '18:00' }] }, // Monday
  { dayOfWeek: 2, isOpen: true, slots: [{ start: '09:00', end: '18:00' }] }, // Tuesday
  { dayOfWeek: 3, isOpen: true, slots: [{ start: '09:00', end: '18:00' }] }, // Wednesday
  { dayOfWeek: 4, isOpen: true, slots: [{ start: '09:00', end: '18:00' }] }, // Thursday
  { dayOfWeek: 5, isOpen: true, slots: [{ start: '09:00', end: '18:00' }] }, // Friday
  { dayOfWeek: 6, isOpen: false, slots: [] }, // Saturday
];

export function AvailabilityGrid({
  availabilities,
  onChange,
}: AvailabilityGridProps) {
  const [isMobile, setIsMobile] = useState(false);
  const [expandedDay, setExpandedDay] = useState<number | null>(1); // Monday expanded by default

  // Check for mobile/small viewport
  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 1024); // lg breakpoint
    };
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  // Build schedule from availabilities
  const [schedule, setSchedule] = useState<DaySchedule[]>(() => {
    return getDefaultSchedule().map((defaultDay) => {
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
  });

  // Update schedule when availabilities change
  useEffect(() => {
    const newSchedule = getDefaultSchedule().map((defaultDay) => {
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
    setSchedule(newSchedule);
  }, [availabilities]);

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

  const handleDayChange = (dayOfWeek: number, isOpen: boolean, slots: TimeSlot[]) => {
    const newSchedule = schedule.map((day) =>
      day.dayOfWeek === dayOfWeek ? { ...day, isOpen, slots } : day
    );
    setSchedule(newSchedule);
    onChange(newSchedule);
  };

  const handleToggleExpand = (dayOfWeek: number) => {
    setExpandedDay(expandedDay === dayOfWeek ? null : dayOfWeek);
  };

  // Mobile/tablet layout: vertical list with accordions
  if (isMobile) {
    return (
      <div className="space-y-2">
        {orderedSchedule.map((day) => (
          <DayAvailability
            key={day.dayOfWeek}
            dayOfWeek={day.dayOfWeek}
            isOpen={day.isOpen}
            slots={day.slots}
            onChange={(isOpen, slots) => handleDayChange(day.dayOfWeek, isOpen, slots)}
            isMobile={true}
            expanded={expandedDay === day.dayOfWeek}
            onToggleExpand={() => handleToggleExpand(day.dayOfWeek)}
          />
        ))}
      </div>
    );
  }

  // Desktop layout: 2 rows of cards (4 + 3)
  return (
    <div className="space-y-3">
      {/* First row: Mon-Thu */}
      <div className="grid grid-cols-2 xl:grid-cols-4 gap-3">
        {orderedSchedule.slice(0, 4).map((day) => (
          <DayAvailability
            key={day.dayOfWeek}
            dayOfWeek={day.dayOfWeek}
            isOpen={day.isOpen}
            slots={day.slots}
            onChange={(isOpen, slots) => handleDayChange(day.dayOfWeek, isOpen, slots)}
          />
        ))}
      </div>
      {/* Second row: Fri-Sun */}
      <div className="grid grid-cols-2 xl:grid-cols-3 gap-3">
        {orderedSchedule.slice(4).map((day) => (
          <DayAvailability
            key={day.dayOfWeek}
            dayOfWeek={day.dayOfWeek}
            isOpen={day.isOpen}
            slots={day.slots}
            onChange={(isOpen, slots) => handleDayChange(day.dayOfWeek, isOpen, slots)}
          />
        ))}
      </div>
    </div>
  );
}
