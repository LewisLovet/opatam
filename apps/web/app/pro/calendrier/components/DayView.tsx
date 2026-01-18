'use client';

import { useMemo, useRef } from 'react';
import type { Booking, Member, Availability, BlockedSlot } from '@booking-app/shared';
import { TimeGrid, calculateBlockPosition, calculatePositionFromTimeString, getTimeFromPosition } from './TimeGrid';
import { BookingBlock } from './BookingBlock';

type WithId<T> = { id: string } & T;

interface DayViewProps {
  date: Date;
  bookings: WithId<Booking>[];
  members: WithId<Member>[];
  selectedMemberId: string;
  selectedLocationId: string;
  isTeamPlan: boolean;
  onBookingClick: (booking: WithId<Booking>) => void;
  onSlotClick: (date: Date, memberId?: string) => void;
  getAvailabilityForDay: (date: Date, memberId: string | null, locationId: string) => WithId<Availability> | undefined;
  getBlockedSlotsForDay: (date: Date, memberId: string | null, locationId: string) => WithId<BlockedSlot>[];
}

const START_HOUR = 6;
const END_HOUR = 22;
const SLOT_HEIGHT = 60;

export function DayView({
  date,
  bookings,
  members,
  selectedMemberId,
  selectedLocationId,
  isTeamPlan,
  onBookingClick,
  onSlotClick,
  getAvailabilityForDay,
  getBlockedSlotsForDay,
}: DayViewProps) {
  const gridRef = useRef<HTMLDivElement>(null);

  // Determine columns to show
  const columns = useMemo(() => {
    if (!isTeamPlan || selectedMemberId !== 'all') {
      return [{ id: selectedMemberId, name: '' }];
    }
    return members.map((m) => ({ id: m.id, name: m.name }));
  }, [isTeamPlan, selectedMemberId, members]);

  // Group bookings by member
  const bookingsByMember = useMemo(() => {
    const grouped: Record<string, WithId<Booking>[]> = {};

    columns.forEach((col) => {
      grouped[col.id] = [];
    });

    bookings.forEach((booking) => {
      if (selectedMemberId === 'all') {
        const memberId = booking.memberId || 'no-member';
        if (grouped[memberId]) {
          grouped[memberId].push(booking);
        }
      } else {
        grouped[selectedMemberId] = grouped[selectedMemberId] || [];
        grouped[selectedMemberId].push(booking);
      }
    });

    return grouped;
  }, [bookings, columns, selectedMemberId]);

  // Handle click on empty slot
  const handleGridClick = (e: React.MouseEvent, memberId: string) => {
    if (!gridRef.current) return;

    const rect = e.currentTarget.getBoundingClientRect();
    const y = e.clientY - rect.top;
    const { hours, minutes } = getTimeFromPosition(y, START_HOUR, SLOT_HEIGHT, 15);

    const clickedDate = new Date(date);
    clickedDate.setHours(hours, minutes, 0, 0);

    onSlotClick(clickedDate, memberId);
  };

  return (
    <div className="overflow-x-auto">
      <div className="min-w-[300px]">
        {/* Column headers (only for multi-column view) */}
        {columns.length > 1 && (
          <div className="flex border-b border-gray-200 dark:border-gray-700 sticky top-0 bg-white dark:bg-gray-800 z-20">
            {/* Time label spacer */}
            <div className="flex-shrink-0 w-14 sm:w-16" />
            {/* Member headers */}
            {columns.map((col) => (
              <div
                key={col.id}
                className="flex-1 min-w-[120px] px-2 py-3 text-center text-sm font-medium text-gray-900 dark:text-white border-l border-gray-200 dark:border-gray-700"
              >
                {col.name}
              </div>
            ))}
          </div>
        )}

        {/* Time grid */}
        <div className="relative flex" ref={gridRef}>
          {/* Time labels */}
          <TimeGrid
            startHour={START_HOUR}
            endHour={END_HOUR}
            slotHeight={SLOT_HEIGHT}
            showLabels={true}
          >
            {/* This is just for the labels */}
          </TimeGrid>

          {/* Columns */}
          <div className="flex flex-1">
            {columns.map((col, colIndex) => (
              <DayColumn
                key={col.id}
                memberId={col.id === 'all' ? null : col.id}
                date={date}
                bookings={bookingsByMember[col.id] || []}
                selectedLocationId={selectedLocationId}
                isFirst={colIndex === 0}
                onBookingClick={onBookingClick}
                onSlotClick={(e) => handleGridClick(e, col.id)}
                getAvailabilityForDay={getAvailabilityForDay}
                getBlockedSlotsForDay={getBlockedSlotsForDay}
              />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

interface DayColumnProps {
  memberId: string | null;
  date: Date;
  bookings: WithId<Booking>[];
  selectedLocationId: string;
  isFirst: boolean;
  onBookingClick: (booking: WithId<Booking>) => void;
  onSlotClick: (e: React.MouseEvent) => void;
  getAvailabilityForDay: (date: Date, memberId: string | null, locationId: string) => WithId<Availability> | undefined;
  getBlockedSlotsForDay: (date: Date, memberId: string | null, locationId: string) => WithId<BlockedSlot>[];
}

function DayColumn({
  memberId,
  date,
  bookings,
  selectedLocationId,
  isFirst,
  onBookingClick,
  onSlotClick,
  getAvailabilityForDay,
  getBlockedSlotsForDay,
}: DayColumnProps) {
  const totalHeight = (END_HOUR - START_HOUR) * SLOT_HEIGHT;

  // Get availability for this column
  const availability = getAvailabilityForDay(date, memberId, selectedLocationId);

  // Get blocked slots for this column
  const blockedSlots = getBlockedSlotsForDay(date, memberId, selectedLocationId);

  // Check if the day is closed (no availability or isOpen is false)
  const isClosed = !availability || !availability.isOpen;

  return (
    <div
      className={`flex-1 min-w-[120px] relative cursor-pointer ${!isFirst ? 'border-l border-gray-200 dark:border-gray-700' : ''}`}
      style={{ height: `${totalHeight}px` }}
      onClick={onSlotClick}
    >
      {/* Base background - gray for closed, white for open */}
      <div
        className={`absolute inset-0 ${isClosed ? 'bg-gray-100 dark:bg-gray-800/50' : 'bg-white dark:bg-gray-900'}`}
      />

      {/* Availability slots background - green for open hours */}
      {availability?.isOpen && availability.slots.map((slot, idx) => {
        const { top, height } = calculatePositionFromTimeString(
          slot.start,
          slot.end,
          START_HOUR,
          SLOT_HEIGHT
        );
        return (
          <div
            key={idx}
            className="absolute left-0 right-0 bg-success-50 dark:bg-success-900/20"
            style={{ top: `${top}px`, height: `${height}px` }}
          />
        );
      })}

      {/* Closed hours overlay - gray for hours outside availability */}
      {availability?.isOpen && (() => {
        // Generate closed hour sections (outside availability slots)
        const closedSections: { top: number; height: number }[] = [];
        const slots = availability.slots || [];

        // Sort slots by start time
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

        // Add section after last slot until END_HOUR
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

        return closedSections.map((section, idx) => (
          <div
            key={`closed-${idx}`}
            className="absolute left-0 right-0 bg-gray-100 dark:bg-gray-800/50"
            style={{ top: `${section.top}px`, height: `${section.height}px` }}
          />
        ));
      })()}

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

      {/* Half-hour lines */}
      {Array.from({ length: END_HOUR - START_HOUR }, (_, i) => (
        <div
          key={`half-${i}`}
          className="absolute left-0 right-0 border-t border-gray-100 dark:border-gray-800 border-dashed"
          style={{ top: `${i * SLOT_HEIGHT + SLOT_HEIGHT / 2}px` }}
        />
      ))}

      {/* Booking blocks */}
      {bookings.map((booking) => {
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
          />
        );
      })}

      {/* Current time indicator */}
      <CurrentTimeIndicator date={date} />
    </div>
  );
}

function CurrentTimeIndicator({ date }: { date: Date }) {
  const now = new Date();
  const isToday =
    date.getDate() === now.getDate() &&
    date.getMonth() === now.getMonth() &&
    date.getFullYear() === now.getFullYear();

  if (!isToday) return null;

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
        <div className="absolute -left-1 -top-1.5 w-3 h-3 bg-error-500 rounded-full" />
        <div className="h-0.5 bg-error-500" />
      </div>
    </div>
  );
}
