'use client';

import { useState, useRef, useEffect } from 'react';
import { ChevronLeft, ChevronRight, Calendar, X } from 'lucide-react';
import type { Member } from '@booking-app/shared';

type WithId<T> = { id: string } & T;

export type BookingStatusFilter = 'all' | 'pending' | 'confirmed' | 'completed' | 'cancelled' | 'noshow';
export type PeriodType = 'today' | 'week' | 'month' | 'custom';

export interface BookingFiltersState {
  status: BookingStatusFilter;
  memberId: string;
  startDate: string;
  endDate: string;
  periodType: PeriodType;
  periodOffset: number; // For navigation: 0 = current, -1 = previous, 1 = next
}

interface BookingFiltersProps {
  filters: BookingFiltersState;
  onChange: (filters: Partial<BookingFiltersState>) => void;
  onReset: () => void;
  members: WithId<Member>[];
  isTeamPlan: boolean;
}

const STATUS_OPTIONS: { value: BookingStatusFilter; label: string }[] = [
  { value: 'all', label: 'Tous les statuts' },
  { value: 'pending', label: 'En attente' },
  { value: 'confirmed', label: 'Confirmé' },
  { value: 'completed', label: 'Terminé' },
  { value: 'cancelled', label: 'Annulé' },
  { value: 'noshow', label: 'Absent' },
];

const PERIOD_OPTIONS: { value: PeriodType; label: string }[] = [
  { value: 'today', label: "Aujourd'hui" },
  { value: 'week', label: 'Semaine' },
  { value: 'month', label: 'Mois' },
  { value: 'custom', label: 'Date' },
];

// Helper functions for date calculations
function getStartOfDay(date: Date): Date {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
}

function getEndOfDay(date: Date): Date {
  const d = new Date(date);
  d.setHours(23, 59, 59, 999);
  return d;
}

function getStartOfWeek(date: Date): Date {
  const d = new Date(date);
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1); // Monday
  d.setDate(diff);
  d.setHours(0, 0, 0, 0);
  return d;
}

function getEndOfWeek(date: Date): Date {
  const start = getStartOfWeek(date);
  const end = new Date(start);
  end.setDate(end.getDate() + 6);
  end.setHours(23, 59, 59, 999);
  return end;
}

function getStartOfMonth(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

function getEndOfMonth(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth() + 1, 0, 23, 59, 59, 999);
}

function addDays(date: Date, days: number): Date {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
}

function addWeeks(date: Date, weeks: number): Date {
  return addDays(date, weeks * 7);
}

function addMonths(date: Date, months: number): Date {
  const d = new Date(date);
  d.setMonth(d.getMonth() + months);
  return d;
}

function formatDateRange(start: Date, end: Date, periodType: PeriodType): string {
  const options: Intl.DateTimeFormatOptions = { day: 'numeric', month: 'short' };
  const optionsWithYear: Intl.DateTimeFormatOptions = { day: 'numeric', month: 'short', year: 'numeric' };
  
  if (periodType === 'today') {
    return start.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' });
  }
  
  if (periodType === 'week') {
    const startStr = start.toLocaleDateString('fr-FR', options);
    const endStr = end.toLocaleDateString('fr-FR', options);
    return `${startStr} - ${endStr}`;
  }
  
  if (periodType === 'month') {
    return start.toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' });
  }
  
  // Custom
  return start.toLocaleDateString('fr-FR', optionsWithYear);
}

function toISODateString(date: Date): string {
  return date.toISOString().split('T')[0];
}

export function BookingFilters({
  filters,
  onChange,
  onReset,
  members,
  isTeamPlan,
}: BookingFiltersProps) {
  const [showDatePicker, setShowDatePicker] = useState(false);
  const datePickerRef = useRef<HTMLDivElement>(null);

  // Calculate date range based on period type and offset
  const getDateRange = () => {
    const today = new Date();
    let baseDate = today;
    
    // Apply offset
    if (filters.periodType === 'today') {
      baseDate = addDays(today, filters.periodOffset);
    } else if (filters.periodType === 'week') {
      baseDate = addWeeks(today, filters.periodOffset);
    } else if (filters.periodType === 'month') {
      baseDate = addMonths(today, filters.periodOffset);
    }
    
    let start: Date;
    let end: Date;
    
    switch (filters.periodType) {
      case 'today':
        start = getStartOfDay(baseDate);
        end = getEndOfDay(baseDate);
        break;
      case 'week':
        start = getStartOfWeek(baseDate);
        end = getEndOfWeek(baseDate);
        break;
      case 'month':
        start = getStartOfMonth(baseDate);
        end = getEndOfMonth(baseDate);
        break;
      case 'custom':
        start = filters.startDate ? new Date(filters.startDate) : getStartOfDay(today);
        end = filters.endDate ? new Date(filters.endDate) : getEndOfDay(today);
        break;
      default:
        start = getStartOfDay(today);
        end = getEndOfDay(today);
    }
    
    return { start, end };
  };

  const { start, end } = getDateRange();

  // Update parent with calculated dates when period changes
  useEffect(() => {
    if (filters.periodType !== 'custom') {
      const today = new Date();
      let baseDate = today;

      // Apply offset
      if (filters.periodType === 'today') {
        baseDate = addDays(today, filters.periodOffset);
      } else if (filters.periodType === 'week') {
        baseDate = addWeeks(today, filters.periodOffset);
      } else if (filters.periodType === 'month') {
        baseDate = addMonths(today, filters.periodOffset);
      }

      let calculatedStart: Date;
      let calculatedEnd: Date;

      switch (filters.periodType) {
        case 'today':
          calculatedStart = getStartOfDay(baseDate);
          calculatedEnd = getEndOfDay(baseDate);
          break;
        case 'week':
          calculatedStart = getStartOfWeek(baseDate);
          calculatedEnd = getEndOfWeek(baseDate);
          break;
        case 'month':
          calculatedStart = getStartOfMonth(baseDate);
          calculatedEnd = getEndOfMonth(baseDate);
          break;
        default:
          calculatedStart = getStartOfDay(today);
          calculatedEnd = getEndOfDay(today);
      }

      onChange({
        startDate: toISODateString(calculatedStart),
        endDate: toISODateString(calculatedEnd),
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filters.periodType, filters.periodOffset]);

  // Close date picker when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (datePickerRef.current && !datePickerRef.current.contains(event.target as Node)) {
        setShowDatePicker(false);
      }
    };

    if (showDatePicker) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [showDatePicker]);

  const handlePeriodChange = (periodType: PeriodType) => {
    if (periodType === 'custom') {
      setShowDatePicker(true);
      onChange({ periodType, periodOffset: 0 });
    } else {
      setShowDatePicker(false);
      onChange({ periodType, periodOffset: 0 });
    }
  };

  const handleNavigate = (direction: -1 | 1) => {
    onChange({ periodOffset: filters.periodOffset + direction });
  };

  const handleCustomDateChange = (date: string) => {
    onChange({
      startDate: date,
      endDate: date,
      periodType: 'custom',
    });
    setShowDatePicker(false);
  };

  const hasActiveFilters =
    filters.status !== 'all' ||
    filters.memberId !== 'all';

  const canNavigate = filters.periodType !== 'custom';

  return (
    <div className="space-y-4">
      {/* Top row: Status + Member filters */}
      <div className="flex flex-wrap items-center gap-3">
        {/* Status filter */}
        <select
          value={filters.status}
          onChange={(e) => onChange({ status: e.target.value as BookingStatusFilter })}
          className="px-3 py-2 text-base rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-colors"
        >
          {STATUS_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>

        {/* Member filter (Team plan only) */}
        {isTeamPlan && members.length > 0 && (
          <select
            value={filters.memberId}
            onChange={(e) => onChange({ memberId: e.target.value })}
            className="px-3 py-2 text-base rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-colors"
          >
            <option value="all">Tous les membres</option>
            {members.map((member) => (
              <option key={member.id} value={member.id}>
                {member.name}
              </option>
            ))}
          </select>
        )}

        {/* Reset button */}
        {hasActiveFilters && (
          <button
            onClick={onReset}
            className="flex items-center gap-1.5 px-3 py-2 text-sm text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
          >
            <X className="w-4 h-4" />
            Réinitialiser
          </button>
        )}
      </div>

      {/* Bottom row: Period selector */}
      <div className="flex items-center gap-3">
        {/* Period type toggle buttons */}
        <div className="inline-flex rounded-lg border border-gray-200 dark:border-gray-700 p-1 bg-gray-50 dark:bg-gray-800/50">
          {PERIOD_OPTIONS.map((option) => (
            <button
              key={option.value}
              onClick={() => handlePeriodChange(option.value)}
              className={`
                relative px-3 py-1.5 text-sm font-medium rounded-md transition-all duration-200
                ${option.value === 'custom' ? 'flex items-center gap-1.5' : ''}
                ${
                  filters.periodType === option.value
                    ? 'bg-white dark:bg-gray-700 text-gray-900 dark:text-white shadow-sm'
                    : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
                }
              `}
            >
              {option.value === 'custom' && <Calendar className="w-4 h-4" />}
              {option.label}
            </button>
          ))}
        </div>

        {/* Navigation arrows */}
        {canNavigate && (
          <div className="flex items-center gap-1">
            <button
              onClick={() => handleNavigate(-1)}
              className="p-2 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
              aria-label="Période précédente"
            >
              <ChevronLeft className="w-5 h-5" />
            </button>
            <button
              onClick={() => handleNavigate(1)}
              className="p-2 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
              aria-label="Période suivante"
            >
              <ChevronRight className="w-5 h-5" />
            </button>
          </div>
        )}

        {/* Current period display */}
        <div className="flex items-center gap-2 px-3 py-1.5 bg-primary-50 dark:bg-primary-900/20 text-primary-700 dark:text-primary-300 rounded-lg">
          <Calendar className="w-4 h-4" />
          <span className="text-sm font-medium capitalize">
            {formatDateRange(start, end, filters.periodType)}
          </span>
        </div>

        {/* Custom date picker */}
        {showDatePicker && (
          <div ref={datePickerRef} className="relative">
            <input
              type="date"
              value={filters.startDate}
              onChange={(e) => handleCustomDateChange(e.target.value)}
              className="px-3 py-2 text-base rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-primary-500 focus:border-transparent"
              autoFocus
            />
          </div>
        )}

        {/* Back to today button (when offset !== 0) */}
        {filters.periodOffset !== 0 && canNavigate && (
          <button
            onClick={() => onChange({ periodOffset: 0 })}
            className="px-3 py-1.5 text-sm text-primary-600 dark:text-primary-400 hover:bg-primary-50 dark:hover:bg-primary-900/20 rounded-lg transition-colors"
          >
            Revenir à maintenant
          </button>
        )}
      </div>
    </div>
  );
}
