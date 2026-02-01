'use client';

import { useMemo, useState, useCallback } from 'react';
import { Plus } from 'lucide-react';
import type { Booking, Member, Availability, BlockedSlot } from '@booking-app/shared';
import { TimeGrid, calculateBlockPosition, calculatePositionFromTimeString, getTimeFromPosition } from './TimeGrid';
import { BookingBlock } from './BookingBlock';
import { SelectMemberPrompt } from './SelectMemberPrompt';
import { DayHeaderCompact } from './DayHeaderWithGauge';
import { PastTimeOverlay, BlockedSlotZone } from './UnavailableZone';
import { NowIndicator } from './NowIndicator';

// Component for availability slot with hover indicator at mouse position
function AvailabilitySlotWithHover({
  top,
  height,
  slotHeight,
  date,
  slotStartHour,
  startHour,
}: {
  top: number;
  height: number;
  slotHeight: number;
  date: Date;
  slotStartHour: number; // Hour when this availability slot starts (e.g., 9 for 9:00)
  startHour: number; // Calendar start hour (e.g., 6)
}) {
  const [hoverY, setHoverY] = useState<number | null>(null);

  // Check if a specific time slot is in the past
  const isSlotInPast = useCallback((yPosition: number) => {
    const now = new Date();
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const slotDate = new Date(date);
    slotDate.setHours(0, 0, 0, 0);

    // If the day is in the past, all slots are past
    if (slotDate < today) return true;

    // If the day is in the future, no slots are past
    if (slotDate > today) return false;

    // Same day - check the time
    // Calculate the hour from the Y position within this availability slot
    const hoursFromSlotStart = yPosition / slotHeight;
    const absoluteHour = slotStartHour + hoursFromSlotStart;
    const slotHour = Math.floor(absoluteHour);
    const slotMinutes = (absoluteHour - slotHour) * 60;

    const slotTime = new Date(date);
    slotTime.setHours(slotHour, slotMinutes, 0, 0);

    return slotTime < now;
  }, [date, slotHeight, slotStartHour]);

  const handleMouseMove = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const y = e.clientY - rect.top;
    // Snap to slot intervals (every slotHeight/2 pixels = 30 min)
    const snappedY = Math.floor(y / (slotHeight / 2)) * (slotHeight / 2);

    // Only show indicator if slot is not in the past
    if (!isSlotInPast(snappedY)) {
      setHoverY(snappedY);
    } else {
      setHoverY(null);
    }
  }, [slotHeight, isSlotInPast]);

  const handleMouseLeave = useCallback(() => {
    setHoverY(null);
  }, []);

  return (
    <div
      className="absolute left-0 right-0 bg-success-50 dark:bg-success-900/20 hover:bg-success-100 dark:hover:bg-success-900/40 transition-colors"
      style={{ top: `${top}px`, height: `${height}px` }}
      title="Cliquer pour créer un RDV"
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
    >
      {/* Hover indicator at mouse position */}
      {hoverY !== null && (
        <div
          className="absolute left-0 right-0 flex items-center justify-center pointer-events-none transition-all duration-75"
          style={{ top: `${hoverY}px`, height: `${slotHeight / 2}px` }}
        >
          <div className="w-6 h-6 rounded-full bg-primary-500 flex items-center justify-center shadow-sm">
            <Plus className="w-4 h-4 text-white" />
          </div>
        </div>
      )}
    </div>
  );
}

type WithId<T> = { id: string } & T;

interface WeekViewProps {
  startDate: Date;
  bookings: WithId<Booking>[];
  members: WithId<Member>[];
  selectedMemberId: string;
  selectedLocationId: string;
  isTeamPlan: boolean;
  onBookingClick: (booking: WithId<Booking>) => void;
  onSlotClick: (date: Date, memberId?: string) => void;
  onDayClick: (date: Date) => void;
  onMemberSelect?: (memberId: string) => void;
  getAvailabilityForDay: (date: Date, memberId: string | null, locationId: string) => WithId<Availability> | undefined;
  getBlockedSlotsForDay: (date: Date, memberId: string | null, locationId: string) => WithId<BlockedSlot>[];
}

const START_HOUR = 6;
const END_HOUR = 24; // Midnight
const SLOT_HEIGHT = 48; // Smaller for week view
const DAY_NAMES = ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim'];

export function WeekView({
  startDate,
  bookings,
  members,
  selectedMemberId,
  selectedLocationId,
  isTeamPlan,
  onBookingClick,
  onSlotClick,
  onDayClick,
  onMemberSelect,
  getAvailabilityForDay,
  getBlockedSlotsForDay,
}: WeekViewProps) {
  // If team plan and "all members" selected, show member selection prompt
  if (isTeamPlan && selectedMemberId === 'all' && members.length > 0 && onMemberSelect) {
    return <SelectMemberPrompt members={members} onSelect={onMemberSelect} />;
  }
  // Generate days of the week
  const days = useMemo(() => {
    const result = [];
    for (let i = 0; i < 7; i++) {
      const day = new Date(startDate);
      day.setDate(day.getDate() + i);
      result.push(day);
    }
    return result;
  }, [startDate]);

  // Group bookings by day (using local date, not UTC)
  const bookingsByDay = useMemo(() => {
    const grouped: Record<string, WithId<Booking>[]> = {};

    // Helper to get local date key YYYY-MM-DD
    const getLocalDateKey = (date: Date) => {
      const year = date.getFullYear();
      const month = (date.getMonth() + 1).toString().padStart(2, '0');
      const day = date.getDate().toString().padStart(2, '0');
      return `${year}-${month}-${day}`;
    };

    days.forEach((day) => {
      const key = getLocalDateKey(day);
      grouped[key] = [];
    });

    bookings.forEach((booking) => {
      const bookingDate = new Date(booking.datetime);
      const key = getLocalDateKey(bookingDate);
      if (grouped[key]) {
        grouped[key].push(booking);
      }
    });

    return grouped;
  }, [bookings, days]);

  const isToday = (date: Date) => {
    const today = new Date();
    return (
      date.getDate() === today.getDate() &&
      date.getMonth() === today.getMonth() &&
      date.getFullYear() === today.getFullYear()
    );
  };

  // Handle click on empty slot
  const handleSlotClick = (e: React.MouseEvent, day: Date) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const y = e.clientY - rect.top;
    const { hours, minutes } = getTimeFromPosition(y, START_HOUR, SLOT_HEIGHT, 15);

    const clickedDate = new Date(day);
    clickedDate.setHours(hours, minutes, 0, 0);

    onSlotClick(clickedDate);
  };

  const totalHeight = (END_HOUR - START_HOUR) * SLOT_HEIGHT;

  return (
    <div className="overflow-x-auto">
      <div className="min-w-[600px]">
        {/* Day headers with gauges */}
        <div className="flex border-b border-gray-200 dark:border-gray-700 sticky top-0 bg-white dark:bg-gray-800 z-20">
          {/* Time label spacer */}
          <div className="flex-shrink-0 w-12 sm:w-14" />
          {/* Day headers with booking count gauge */}
          {days.map((day, idx) => {
            const getLocalDateKey = (date: Date) => {
              const year = date.getFullYear();
              const month = (date.getMonth() + 1).toString().padStart(2, '0');
              const d = date.getDate().toString().padStart(2, '0');
              return `${year}-${month}-${d}`;
            };
            const dayKey = getLocalDateKey(day);
            const dayBookings = bookingsByDay[dayKey] || [];
            const activeBookings = dayBookings.filter(
              (b) => b.status === 'pending' || b.status === 'confirmed'
            );
            return (
              <DayHeaderCompact
                key={idx}
                date={day}
                bookingCount={activeBookings.length}
                expectedCapacity={8}
                onClick={() => onDayClick(day)}
              />
            );
          })}
        </div>

        {/* Time grid */}
        <div className="flex">
          {/* Time labels */}
          <div className="flex-shrink-0 w-12 sm:w-14 relative" style={{ height: `${totalHeight}px` }}>
            {Array.from({ length: END_HOUR - START_HOUR + 1 }, (_, i) => {
              const hour = START_HOUR + i;
              // Display "00:00" for midnight instead of "24:00"
              const displayHour = hour === 24 ? 0 : hour;
              return (
                <div
                  key={i}
                  className="absolute right-1 sm:right-2 -translate-y-1/2 text-[10px] sm:text-xs text-gray-500 dark:text-gray-400"
                  style={{ top: `${i * SLOT_HEIGHT}px` }}
                >
                  {displayHour.toString().padStart(2, '0')}:00
                </div>
              );
            })}
          </div>

          {/* Day columns */}
          {days.map((day, idx) => {
            // Use local date key to match bookingsByDay grouping
            const getLocalDateKey = (date: Date) => {
              const year = date.getFullYear();
              const month = (date.getMonth() + 1).toString().padStart(2, '0');
              const d = date.getDate().toString().padStart(2, '0');
              return `${year}-${month}-${d}`;
            };
            const dayKey = getLocalDateKey(day);
            const dayBookings = bookingsByDay[dayKey] || [];
            const memberId = selectedMemberId !== 'all' ? selectedMemberId : null;
            const availability = getAvailabilityForDay(day, memberId, selectedLocationId);
            const blockedSlots = getBlockedSlotsForDay(day, memberId, selectedLocationId);
            const isClosed = !availability || !availability.isOpen;

            // Generate closed hour sections (outside availability slots)
            const getClosedSections = () => {
              if (!availability?.isOpen) return [];

              const closedSections: { top: number; height: number }[] = [];
              const slots = availability.slots || [];
              const sortedSlots = [...slots].sort((a, b) => a.start.localeCompare(b.start));

              let lastEnd = `${START_HOUR.toString().padStart(2, '0')}:00`;

              sortedSlots.forEach((slot) => {
                if (slot.start > lastEnd) {
                  const { top, height } = calculatePositionFromTimeString(
                    lastEnd,
                    slot.start,
                    START_HOUR,
                    SLOT_HEIGHT
                  );
                  if (height > 0) {
                    closedSections.push({ top, height });
                  }
                }
                if (slot.end > lastEnd) {
                  lastEnd = slot.end;
                }
              });

              const endTime = `${END_HOUR.toString().padStart(2, '0')}:00`;
              if (lastEnd < endTime) {
                const { top, height } = calculatePositionFromTimeString(
                  lastEnd,
                  endTime,
                  START_HOUR,
                  SLOT_HEIGHT
                );
                if (height > 0) {
                  closedSections.push({ top, height });
                }
              }

              return closedSections;
            };

            return (
              <div
                key={idx}
                className="flex-1 min-w-[80px] relative border-l border-gray-200 dark:border-gray-700 cursor-pointer"
                style={{ height: `${totalHeight}px` }}
                onClick={(e) => handleSlotClick(e, day)}
              >
                {/* Base background - gray with hatching for closed, white for open */}
                <div
                  className={`absolute inset-0 ${isClosed ? 'bg-gray-100 dark:bg-gray-800/50' : 'bg-white dark:bg-gray-900'}`}
                  style={isClosed ? {
                    backgroundImage: 'repeating-linear-gradient(45deg, transparent, transparent 4px, rgba(156, 163, 175, 0.3) 4px, rgba(156, 163, 175, 0.3) 8px)',
                  } : undefined}
                  title={isClosed ? 'Fermé' : undefined}
                />

                {/* Availability slots background - green for open hours with hover effect */}
                {availability?.isOpen && availability.slots.map((slot, slotIdx) => {
                  const { top, height } = calculatePositionFromTimeString(
                    slot.start,
                    slot.end,
                    START_HOUR,
                    SLOT_HEIGHT
                  );
                  // Parse slot start hour (e.g., "09:00" -> 9)
                  const slotStartHour = parseInt(slot.start.split(':')[0], 10);
                  return (
                    <AvailabilitySlotWithHover
                      key={slotIdx}
                      top={top}
                      height={height}
                      slotHeight={SLOT_HEIGHT}
                      date={day}
                      slotStartHour={slotStartHour}
                      startHour={START_HOUR}
                    />
                  );
                })}

                {/* Closed hours overlay - gray with hatching for hours outside availability */}
                {getClosedSections().map((section, sectionIdx) => (
                  <div
                    key={`closed-${sectionIdx}`}
                    className="absolute left-0 right-0 bg-gray-100 dark:bg-gray-800/50"
                    style={{
                      top: `${section.top}px`,
                      height: `${section.height}px`,
                      backgroundImage: 'repeating-linear-gradient(45deg, transparent, transparent 4px, rgba(156, 163, 175, 0.3) 4px, rgba(156, 163, 175, 0.3) 8px)',
                    }}
                    title="Fermé"
                  />
                ))}

                {/* Blocked slots overlay - red hatched pattern */}
                {blockedSlots.map((blocked) => {
                  let top = 0;
                  let height = totalHeight;

                  if (!blocked.allDay && blocked.startTime && blocked.endTime) {
                    const pos = calculatePositionFromTimeString(
                      blocked.startTime,
                      blocked.endTime,
                      START_HOUR,
                      SLOT_HEIGHT
                    );
                    top = pos.top;
                    height = pos.height;
                  }

                  return (
                    <BlockedSlotZone
                      key={blocked.id}
                      top={top}
                      height={height}
                      reason={blocked.reason ?? undefined}
                      isAllDay={blocked.allDay}
                    />
                  );
                })}

                {/* Past time overlay for today */}
                <PastTimeOverlay
                  date={day}
                  startHour={START_HOUR}
                  slotHeight={SLOT_HEIGHT}
                />

                {/* Hour lines */}
                {Array.from({ length: END_HOUR - START_HOUR + 1 }, (_, i) => (
                  <div
                    key={i}
                    className="absolute left-0 right-0 border-t border-gray-200 dark:border-gray-700"
                    style={{ top: `${i * SLOT_HEIGHT}px` }}
                  />
                ))}

                {/* Booking blocks */}
                {dayBookings.map((booking) => {
                  const { top, height } = calculateBlockPosition(
                    new Date(booking.datetime),
                    new Date(booking.endDatetime),
                    START_HOUR,
                    SLOT_HEIGHT
                  );

                  return (
                    <BookingBlock
                      key={booking.id}
                      booking={booking}
                      top={top}
                      height={height}
                      onClick={() => onBookingClick(booking)}
                      showMemberName={isTeamPlan && selectedMemberId === 'all'}
                      compact
                    />
                  );
                })}

                {/* Current time indicator */}
                <NowIndicator
                  startHour={START_HOUR}
                  endHour={END_HOUR}
                  slotHeight={SLOT_HEIGHT}
                  isTodayVisible={isToday(day)}
                />
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
