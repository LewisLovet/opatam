'use client';

import { useRef, useState, useMemo } from 'react';
import { Button } from '../ui/Button';
import { Loader } from '../ui/Loader';

interface TimeSlot {
  datetime: Date;
  available: boolean;
}

interface SlotPickerProps {
  slots: TimeSlot[];
  selectedSlot?: Date | null;
  onSelect: (slot: Date) => void;
  loading?: boolean;
  daysToShow?: number;
  className?: string;
}

function formatDate(date: Date): string {
  return date.toLocaleDateString('fr-FR', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
  });
}

function formatTime(date: Date): string {
  return date.toLocaleTimeString('fr-FR', {
    hour: '2-digit',
    minute: '2-digit',
  });
}

function isSameDay(date1: Date, date2: Date): boolean {
  return (
    date1.getFullYear() === date2.getFullYear() &&
    date1.getMonth() === date2.getMonth() &&
    date1.getDate() === date2.getDate()
  );
}

function isSameTime(date1: Date, date2: Date): boolean {
  return date1.getTime() === date2.getTime();
}

export function SlotPicker({
  slots,
  selectedSlot,
  onSelect,
  loading = false,
  daysToShow = 7,
  className = '',
}: SlotPickerProps) {
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const [scrollPosition, setScrollPosition] = useState(0);

  // Group slots by date
  const slotsByDate = useMemo(() => {
    const grouped = new Map<string, TimeSlot[]>();

    slots.forEach((slot) => {
      const dateKey = slot.datetime.toDateString();
      if (!grouped.has(dateKey)) {
        grouped.set(dateKey, []);
      }
      grouped.get(dateKey)!.push(slot);
    });

    // Sort each day's slots by time
    grouped.forEach((daySlots) => {
      daySlots.sort((a, b) => a.datetime.getTime() - b.datetime.getTime());
    });

    return grouped;
  }, [slots]);

  // Get unique dates
  const dates = useMemo(() => {
    const uniqueDates: Date[] = [];
    const seen = new Set<string>();

    slots.forEach((slot) => {
      const dateKey = slot.datetime.toDateString();
      if (!seen.has(dateKey)) {
        seen.add(dateKey);
        uniqueDates.push(new Date(slot.datetime.toDateString()));
      }
    });

    uniqueDates.sort((a, b) => a.getTime() - b.getTime());
    return uniqueDates;
  }, [slots]);

  const canScrollLeft = scrollPosition > 0;
  const canScrollRight = scrollPosition < dates.length - daysToShow;

  const scroll = (direction: 'left' | 'right') => {
    const container = scrollContainerRef.current;
    if (!container) return;

    const newPosition = direction === 'left'
      ? Math.max(0, scrollPosition - 1)
      : Math.min(dates.length - daysToShow, scrollPosition + 1);

    setScrollPosition(newPosition);
    container.scrollTo({
      left: newPosition * (container.scrollWidth / dates.length),
      behavior: 'smooth',
    });
  };

  if (loading) {
    return (
      <div className={`flex items-center justify-center py-12 ${className}`}>
        <Loader size="lg" />
      </div>
    );
  }

  if (slots.length === 0) {
    return (
      <div className={`text-center py-8 ${className}`}>
        <svg
          className="mx-auto h-12 w-12 text-gray-400"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={1.5}
            d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
          />
        </svg>
        <h3 className="mt-2 text-sm font-medium text-gray-900 dark:text-white">
          Aucun créneau disponible
        </h3>
        <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
          Aucun créneau disponible pour la période sélectionnée.
        </p>
      </div>
    );
  }

  return (
    <div className={className}>
      {/* Navigation Header */}
      <div className="flex items-center justify-between mb-4">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => scroll('left')}
          disabled={!canScrollLeft}
          aria-label="Jours précédents"
        >
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </Button>

        <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
          {dates.length > 0 && (
            <>
              {formatDate(dates[scrollPosition])}
              {dates.length > 1 && ` - ${formatDate(dates[Math.min(scrollPosition + daysToShow - 1, dates.length - 1)])}`}
            </>
          )}
        </span>

        <Button
          variant="ghost"
          size="sm"
          onClick={() => scroll('right')}
          disabled={!canScrollRight}
          aria-label="Jours suivants"
        >
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
        </Button>
      </div>

      {/* Slots Grid */}
      <div
        ref={scrollContainerRef}
        className="flex gap-3 overflow-x-auto pb-2 scrollbar-hide"
        style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
      >
        {dates.map((date) => {
          const daySlots = slotsByDate.get(date.toDateString()) || [];
          const availableSlots = daySlots.filter((s) => s.available);
          const isToday = isSameDay(date, new Date());

          return (
            <div
              key={date.toDateString()}
              className="flex-shrink-0 w-28 sm:w-32"
            >
              {/* Date Header */}
              <div className={`
                text-center pb-2 mb-2 border-b border-gray-200 dark:border-gray-700
                ${isToday ? 'text-primary-600 dark:text-primary-400' : 'text-gray-700 dark:text-gray-300'}
              `}>
                <div className="text-xs font-medium uppercase">
                  {date.toLocaleDateString('fr-FR', { weekday: 'short' })}
                </div>
                <div className="text-lg font-bold">
                  {date.getDate()}
                </div>
                <div className="text-xs text-gray-500 dark:text-gray-400">
                  {date.toLocaleDateString('fr-FR', { month: 'short' })}
                </div>
              </div>

              {/* Time Slots */}
              <div className="space-y-1.5 max-h-48 overflow-y-auto">
                {availableSlots.length === 0 ? (
                  <p className="text-xs text-center text-gray-400 dark:text-gray-500 py-4">
                    Aucun créneau
                  </p>
                ) : (
                  availableSlots.map((slot) => {
                    const isSelected = selectedSlot && isSameTime(slot.datetime, selectedSlot);
                    return (
                      <button
                        key={slot.datetime.toISOString()}
                        type="button"
                        onClick={() => onSelect(slot.datetime)}
                        className={`
                          w-full py-2 px-2 text-sm font-medium rounded-lg transition-all
                          ${
                            isSelected
                              ? 'bg-primary-600 text-white'
                              : 'bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700'
                          }
                        `}
                      >
                        {formatTime(slot.datetime)}
                      </button>
                    );
                  })
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Selected Slot Confirmation */}
      {selectedSlot && (
        <div className="mt-4 p-3 bg-primary-50 dark:bg-primary-950/30 rounded-lg border border-primary-200 dark:border-primary-800">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-primary-700 dark:text-primary-300 text-sm sm:text-base">
            <svg className="w-5 h-5 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
            </svg>
            <span className="font-medium">Creneau :</span>
            <span>
              {selectedSlot.toLocaleDateString('fr-FR', {
                weekday: 'long',
                day: 'numeric',
                month: 'long',
              })} a {formatTime(selectedSlot)}
            </span>
          </div>
        </div>
      )}
    </div>
  );
}
