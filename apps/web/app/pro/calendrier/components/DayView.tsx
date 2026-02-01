'use client';

import { useMemo, useRef, useState, useCallback } from 'react';
import { Plus } from 'lucide-react';
import type { Booking, Member, Availability, BlockedSlot } from '@booking-app/shared';
import { TimeGrid, calculateBlockPosition, calculatePositionFromTimeString, getTimeFromPosition } from './TimeGrid';
import { BookingBlock } from './BookingBlock';
import { PastTimeOverlay, BlockedSlotZone } from './UnavailableZone';
import { NowIndicator } from './NowIndicator';

// Component for availability slot with hover indicator at mouse position
function AvailabilitySlotWithHover({
  top,
  height,
  slotHeight,
  date,
  slotStartHour,
}: {
  top: number;
  height: number;
  slotHeight: number;
  date: Date;
  slotStartHour: number; // Hour when this availability slot starts (e.g., 9 for 9:00)
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
    // Snap to 30-minute intervals
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
          <div className="w-8 h-8 rounded-full bg-primary-500 flex items-center justify-center shadow-sm">
            <Plus className="w-5 h-5 text-white" />
          </div>
        </div>
      )}
    </div>
  );
}

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
const END_HOUR = 24; // Midnight
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
      {/* Base background - gray with hatching for closed, white for open */}
      <div
        className={`absolute inset-0 ${isClosed ? 'bg-gray-100 dark:bg-gray-800/50' : 'bg-white dark:bg-gray-900'}`}
        style={isClosed ? {
          backgroundImage: 'repeating-linear-gradient(45deg, transparent, transparent 4px, rgba(156, 163, 175, 0.3) 4px, rgba(156, 163, 175, 0.3) 8px)',
        } : undefined}
        title={isClosed ? 'Fermé' : undefined}
      />

      {/* Availability slots background - green for open hours with hover effect */}
      {availability?.isOpen && availability.slots.map((slot, idx) => {
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
            key={idx}
            top={top}
            height={height}
            slotHeight={SLOT_HEIGHT}
            date={date}
            slotStartHour={slotStartHour}
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
            style={{
              top: `${section.top}px`,
              height: `${section.height}px`,
              backgroundImage: 'repeating-linear-gradient(45deg, transparent, transparent 4px, rgba(156, 163, 175, 0.3) 4px, rgba(156, 163, 175, 0.3) 8px)',
            }}
            title="Fermé"
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
        date={date}
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
      <NowIndicator
        startHour={START_HOUR}
        endHour={END_HOUR}
        slotHeight={SLOT_HEIGHT}
        isTodayVisible={isToday(date)}
      />
    </div>
  );
}

function isToday(date: Date): boolean {
  const now = new Date();
  return (
    date.getDate() === now.getDate() &&
    date.getMonth() === now.getMonth() &&
    date.getFullYear() === now.getFullYear()
  );
}
