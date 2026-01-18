'use client';

import { useMemo } from 'react';
import type { Booking, Member, Availability, BlockedSlot } from '@booking-app/shared';
import { TimeGrid, calculateBlockPosition, calculatePositionFromTimeString, getTimeFromPosition } from './TimeGrid';
import { BookingBlock } from './BookingBlock';
import { SelectMemberPrompt } from './SelectMemberPrompt';

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
const END_HOUR = 22;
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
        {/* Day headers */}
        <div className="flex border-b border-gray-200 dark:border-gray-700 sticky top-0 bg-white dark:bg-gray-800 z-20">
          {/* Time label spacer */}
          <div className="flex-shrink-0 w-12 sm:w-14" />
          {/* Day headers */}
          {days.map((day, idx) => (
            <button
              key={idx}
              onClick={() => onDayClick(day)}
              className={`
                flex-1 min-w-[80px] py-2 text-center border-l border-gray-200 dark:border-gray-700
                hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors
              `}
            >
              <div className="text-xs text-gray-500 dark:text-gray-400">
                {DAY_NAMES[idx]}
              </div>
              <div
                className={`
                  text-lg font-semibold mt-0.5
                  ${isToday(day)
                    ? 'w-8 h-8 mx-auto flex items-center justify-center bg-primary-500 text-white rounded-full'
                    : 'text-gray-900 dark:text-white'}
                `}
              >
                {day.getDate()}
              </div>
            </button>
          ))}
        </div>

        {/* Time grid */}
        <div className="flex">
          {/* Time labels */}
          <div className="flex-shrink-0 w-12 sm:w-14 relative" style={{ height: `${totalHeight}px` }}>
            {Array.from({ length: END_HOUR - START_HOUR + 1 }, (_, i) => (
              <div
                key={i}
                className="absolute right-1 sm:right-2 -translate-y-1/2 text-[10px] sm:text-xs text-gray-500 dark:text-gray-400"
                style={{ top: `${i * SLOT_HEIGHT}px` }}
              >
                {(START_HOUR + i).toString().padStart(2, '0')}:00
              </div>
            ))}
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
                {/* Base background - gray for closed, white for open */}
                <div
                  className={`absolute inset-0 ${isClosed ? 'bg-gray-100 dark:bg-gray-800/50' : 'bg-white dark:bg-gray-900'}`}
                />

                {/* Availability slots background - green for open hours */}
                {availability?.isOpen && availability.slots.map((slot, slotIdx) => {
                  const { top, height } = calculatePositionFromTimeString(
                    slot.start,
                    slot.end,
                    START_HOUR,
                    SLOT_HEIGHT
                  );
                  return (
                    <div
                      key={slotIdx}
                      className="absolute left-0 right-0 bg-success-50 dark:bg-success-900/20"
                      style={{ top: `${top}px`, height: `${height}px` }}
                    />
                  );
                })}

                {/* Closed hours overlay - gray for hours outside availability */}
                {getClosedSections().map((section, sectionIdx) => (
                  <div
                    key={`closed-${sectionIdx}`}
                    className="absolute left-0 right-0 bg-gray-100 dark:bg-gray-800/50"
                    style={{ top: `${section.top}px`, height: `${section.height}px` }}
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
                    <div
                      key={blocked.id}
                      className="absolute left-0 right-0 bg-error-50/80 dark:bg-error-900/30"
                      style={{
                        top: `${top}px`,
                        height: `${height}px`,
                        backgroundImage: 'repeating-linear-gradient(45deg, transparent, transparent 4px, rgba(239, 68, 68, 0.15) 4px, rgba(239, 68, 68, 0.15) 8px)',
                      }}
                      title={blocked.reason || 'Bloqué'}
                    />
                  );
                })}

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
                {isToday(day) && <CurrentTimeIndicator />}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function CurrentTimeIndicator() {
  const now = new Date();
  const currentHour = now.getHours();
  const currentMinute = now.getMinutes();

  if (currentHour < START_HOUR || currentHour >= END_HOUR) return null;

  const top = ((currentHour - START_HOUR) * 60 + currentMinute) / 60 * SLOT_HEIGHT;

  return (
    <div
      className="absolute left-0 right-0 z-10 pointer-events-none"
      style={{ top: `${top}px` }}
    >
      <div className="relative">
        <div className="absolute -left-1 -top-1 w-2 h-2 bg-error-500 rounded-full" />
        <div className="h-0.5 bg-error-500" />
      </div>
    </div>
  );
}
