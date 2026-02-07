'use client';

import { useState, useEffect, useMemo } from 'react';
import { ArrowLeft, ChevronLeft, ChevronRight, Loader2, Check } from 'lucide-react';
import { generateDemoSlots } from '../../demoData';

interface TimeSlotWithDate {
  date: string;
  start: string;
  end: string;
  datetime: string;
  endDatetime: string;
}

interface StepSlotProps {
  providerId: string;
  serviceId: string;
  memberId: string;
  serviceDuration: number;
  maxAdvanceDays: number;
  selectedSlot: TimeSlotWithDate | null;
  onSelect: (slot: TimeSlotWithDate) => void;
  onBack: () => void;
  openDays: number[]; // Array of open day numbers (0=Sunday, 1=Monday, etc.)
  isDemo?: boolean;
}

const DAYS_FR = ['Dim', 'Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam'];
const MONTHS_FR = [
  'Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin',
  'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre'
];

export function StepSlot({
  providerId,
  serviceId,
  memberId,
  serviceDuration,
  maxAdvanceDays,
  selectedSlot,
  onSelect,
  onBack,
  openDays,
  isDemo = false,
}: StepSlotProps) {
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [slots, setSlots] = useState<TimeSlotWithDate[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Calculate date range (from today to maxAdvanceDays)
  const dateRange = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const maxDate = new Date(today);
    maxDate.setDate(maxDate.getDate() + maxAdvanceDays);
    return { min: today, max: maxDate };
  }, [maxAdvanceDays]);

  // Generate calendar days for current month
  const calendarDays = useMemo(() => {
    const year = currentMonth.getFullYear();
    const month = currentMonth.getMonth();

    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);

    const days: (Date | null)[] = [];

    // Add empty slots for days before first of month
    const startDayOfWeek = firstDay.getDay();
    for (let i = 0; i < startDayOfWeek; i++) {
      days.push(null);
    }

    // Add days of month
    for (let i = 1; i <= lastDay.getDate(); i++) {
      days.push(new Date(year, month, i));
    }

    return days;
  }, [currentMonth]);

  // Check if a date is selectable (in range AND on an open day)
  const isDateSelectable = (date: Date): boolean => {
    const d = new Date(date);
    d.setHours(0, 0, 0, 0);
    const inRange = d >= dateRange.min && d <= dateRange.max;
    const isOpenDay = openDays.includes(d.getDay());
    return inRange && isOpenDay;
  };

  // Fetch available slots when date changes
  useEffect(() => {
    if (!selectedDate) return;

    // Demo mode — generate mock slots locally
    if (isDemo) {
      setLoading(true);
      // Small delay for realism
      const timer = setTimeout(() => {
        setSlots(generateDemoSlots(selectedDate, serviceDuration));
        setLoading(false);
      }, 300);
      return () => clearTimeout(timer);
    }

    const fetchSlots = async () => {
      setLoading(true);
      setError(null);

      try {
        const startDate = new Date(selectedDate);
        startDate.setHours(0, 0, 0, 0);
        const endDate = new Date(selectedDate);
        endDate.setHours(23, 59, 59, 999);

        const params = new URLSearchParams({
          providerId,
          serviceId,
          memberId,
          startDate: startDate.toISOString(),
          endDate: endDate.toISOString(),
        });

        const response = await fetch(`/api/slots?${params}`);

        if (!response.ok) {
          throw new Error('Erreur lors du chargement des créneaux');
        }

        const data = await response.json();
        setSlots(data.slots || []);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Une erreur est survenue');
        setSlots([]);
      } finally {
        setLoading(false);
      }
    };

    fetchSlots();
  }, [selectedDate, providerId, serviceId, memberId, isDemo, serviceDuration]);

  // Navigate months
  const goToPreviousMonth = () => {
    const prev = new Date(currentMonth);
    prev.setMonth(prev.getMonth() - 1);
    if (prev >= new Date(dateRange.min.getFullYear(), dateRange.min.getMonth(), 1)) {
      setCurrentMonth(prev);
    }
  };

  const goToNextMonth = () => {
    const nextMonth = new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 1);
    const maxMonth = new Date(dateRange.max.getFullYear(), dateRange.max.getMonth(), 1);
    if (nextMonth <= maxMonth) {
      setCurrentMonth(nextMonth);
    }
  };

  // Check if previous/next month buttons should be disabled
  const canGoPrevious = useMemo(() => {
    const prev = new Date(currentMonth);
    prev.setMonth(prev.getMonth() - 1);
    return prev >= new Date(dateRange.min.getFullYear(), dateRange.min.getMonth(), 1);
  }, [currentMonth, dateRange.min]);

  const canGoNext = useMemo(() => {
    const nextMonth = new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 1);
    const maxMonth = new Date(dateRange.max.getFullYear(), dateRange.max.getMonth(), 1);
    return nextMonth <= maxMonth;
  }, [currentMonth, dateRange.max]);

  // Format date for comparison
  const formatDateKey = (date: Date): string => {
    return date.toISOString().split('T')[0];
  };

  // Check if a date is selected
  const isDateSelected = (date: Date): boolean => {
    if (!selectedDate) return false;
    return formatDateKey(date) === formatDateKey(selectedDate);
  };

  // Check if a slot is selected
  const isSlotSelected = (slot: TimeSlotWithDate): boolean => {
    if (!selectedSlot) return false;
    return slot.datetime === selectedSlot.datetime;
  };

  return (
    <div>
      <div className="flex items-center gap-3 mb-4">
        <button
          onClick={onBack}
          className="p-2 -ml-2 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>
        <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
          Choisissez une date et un horaire
        </h2>
      </div>

      {/* Calendar */}
      <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4 mb-6">
        {/* Month Navigation */}
        <div className="flex items-center justify-between mb-4">
          <button
            onClick={goToPreviousMonth}
            disabled={!canGoPrevious}
            className="p-2 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 disabled:opacity-30 disabled:cursor-not-allowed rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700"
          >
            <ChevronLeft className="w-5 h-5" />
          </button>
          <h3 className="font-semibold text-gray-900 dark:text-white">
            {MONTHS_FR[currentMonth.getMonth()]} {currentMonth.getFullYear()}
          </h3>
          <button
            onClick={goToNextMonth}
            disabled={!canGoNext}
            className="p-2 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 disabled:opacity-30 disabled:cursor-not-allowed rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700"
          >
            <ChevronRight className="w-5 h-5" />
          </button>
        </div>

        {/* Days header */}
        <div className="grid grid-cols-7 gap-1 mb-2">
          {DAYS_FR.map((day) => (
            <div
              key={day}
              className="text-center text-xs font-medium text-gray-500 dark:text-gray-400 py-2"
            >
              {day}
            </div>
          ))}
        </div>

        {/* Calendar grid */}
        <div className="grid grid-cols-7 gap-1">
          {calendarDays.map((date, index) => {
            if (!date) {
              return <div key={`empty-${index}`} className="aspect-square" />;
            }

            const inRange = isDateSelectable(date);
            const isToday = formatDateKey(date) === formatDateKey(new Date());
            const selected = isDateSelected(date);

            return (
              <button
                key={date.toISOString()}
                onClick={() => inRange && setSelectedDate(date)}
                disabled={!inRange}
                className={`aspect-square flex items-center justify-center text-sm rounded-lg transition-colors ${
                  selected
                    ? 'bg-primary-600 text-white font-semibold'
                    : inRange
                    ? isToday
                      ? 'bg-primary-100 dark:bg-primary-900/30 text-primary-600 dark:text-primary-400 font-semibold hover:bg-primary-200 dark:hover:bg-primary-900/50'
                      : 'text-gray-900 dark:text-white hover:bg-gray-100 dark:hover:bg-gray-700'
                    : 'text-gray-300 dark:text-gray-600 cursor-not-allowed'
                }`}
              >
                {date.getDate()}
              </button>
            );
          })}
        </div>
      </div>

      {/* Time slots */}
      {selectedDate && (
        <div>
          <h3 className="font-semibold text-gray-900 dark:text-white mb-3">
            Horaires disponibles le{' '}
            {selectedDate.toLocaleDateString('fr-FR', {
              weekday: 'long',
              day: 'numeric',
              month: 'long',
            })}
          </h3>

          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-8 h-8 text-primary-500 animate-spin" />
            </div>
          ) : error ? (
            <div className="text-center py-8 text-red-500 dark:text-red-400">
              {error}
            </div>
          ) : slots.length === 0 ? (
            <div className="text-center py-8 bg-gray-50 dark:bg-gray-800/50 rounded-xl">
              <p className="text-gray-500 dark:text-gray-400">
                Aucun créneau disponible pour cette date.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
              {slots.map((slot) => {
                const selected = isSlotSelected(slot);

                return (
                  <button
                    key={slot.datetime}
                    onClick={() => onSelect(slot)}
                    className={`relative py-3 px-4 rounded-lg border-2 transition-all ${
                      selected
                        ? 'border-primary-500 bg-primary-50 dark:bg-primary-900/20'
                        : 'border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 hover:border-primary-300 dark:hover:border-primary-700'
                    }`}
                  >
                    {/* Check badge */}
                    {selected && (
                      <span className="absolute -top-1.5 -right-1.5 w-5 h-5 bg-primary-500 rounded-full flex items-center justify-center shadow-sm">
                        <Check className="w-3 h-3 text-white" strokeWidth={3} />
                      </span>
                    )}
                    <div className="flex flex-col items-center">
                      <span className={`text-sm font-semibold ${
                        selected
                          ? 'text-primary-600 dark:text-primary-400'
                          : 'text-gray-900 dark:text-white'
                      }`}>
                        {slot.start}
                      </span>
                      <span className={`text-xs ${
                        selected
                          ? 'text-primary-500/70 dark:text-primary-400/70'
                          : 'text-gray-400 dark:text-gray-500'
                      }`}>
                        → {slot.end}
                      </span>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
