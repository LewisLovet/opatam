'use client';

import { useState, useRef, useEffect } from 'react';
import { Button } from '@/components/ui';
import { ChevronLeft, ChevronRight, Calendar, Plus, User, MapPin, Zap, Ban, ChevronDown } from 'lucide-react';
import type { Member, Location } from '@booking-app/shared';
import { FilterChip } from './FilterChip';

type WithId<T> = { id: string } & T;
type ViewMode = 'day' | 'week';

interface CalendarHeaderProps {
  viewMode: ViewMode;
  onViewModeChange: (mode: ViewMode) => void;
  selectedDate: Date;
  dateRange: { start: Date; end: Date };
  onDateSelect: (date: Date) => void;
  onPrevious: () => void;
  onNext: () => void;
  onToday: () => void;
  members: WithId<Member>[];
  locations: WithId<Location>[];
  selectedMemberId: string;
  selectedLocationId: string;
  onMemberChange: (memberId: string) => void;
  onLocationChange: (locationId: string) => void;
  onCreateBooking: () => void;
  onCreateActivity?: () => void;
  onBlockSlot?: () => void;
  isTeamPlan: boolean;
}

export function CalendarHeader({
  viewMode,
  onViewModeChange,
  selectedDate,
  dateRange,
  onDateSelect,
  onPrevious,
  onNext,
  onToday,
  members,
  locations,
  selectedMemberId,
  selectedLocationId,
  onMemberChange,
  onLocationChange,
  onCreateBooking,
  onCreateActivity,
  onBlockSlot,
  isTeamPlan,
}: CalendarHeaderProps) {
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [pickerMonth, setPickerMonth] = useState(new Date(selectedDate));
  const datePickerRef = useRef<HTMLDivElement>(null);

  // Close date picker when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (datePickerRef.current && !datePickerRef.current.contains(event.target as Node)) {
        setShowDatePicker(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Format title based on view mode
  const getTitle = () => {
    if (viewMode === 'day') {
      return selectedDate.toLocaleDateString('fr-FR', {
        weekday: 'long',
        day: 'numeric',
        month: 'long',
        year: 'numeric',
      });
    } else {
      const startStr = dateRange.start.toLocaleDateString('fr-FR', {
        day: 'numeric',
        month: 'long',
      });
      const endStr = dateRange.end.toLocaleDateString('fr-FR', {
        day: 'numeric',
        month: 'long',
        year: 'numeric',
      });
      return `${startStr} - ${endStr}`;
    }
  };

  // Generate calendar days for date picker
  const generateCalendarDays = () => {
    const year = pickerMonth.getFullYear();
    const month = pickerMonth.getMonth();

    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);

    const days: (Date | null)[] = [];

    // Add empty slots for days before the first day of month
    const firstDayOfWeek = firstDay.getDay();
    const startOffset = firstDayOfWeek === 0 ? 6 : firstDayOfWeek - 1;
    for (let i = 0; i < startOffset; i++) {
      days.push(null);
    }

    // Add days of the month
    for (let d = 1; d <= lastDay.getDate(); d++) {
      days.push(new Date(year, month, d));
    }

    return days;
  };

  const handleDateClick = (date: Date) => {
    onDateSelect(date);
    setShowDatePicker(false);
  };

  const isToday = (date: Date) => {
    const today = new Date();
    return (
      date.getDate() === today.getDate() &&
      date.getMonth() === today.getMonth() &&
      date.getFullYear() === today.getFullYear()
    );
  };

  const isSelected = (date: Date) => {
    return (
      date.getDate() === selectedDate.getDate() &&
      date.getMonth() === selectedDate.getMonth() &&
      date.getFullYear() === selectedDate.getFullYear()
    );
  };

  // Convert 'all' to null for FilterChip
  const memberValue = selectedMemberId === 'all' ? null : selectedMemberId;
  const locationValue = selectedLocationId === 'all' ? null : selectedLocationId;

  const handleMemberFilterChange = (value: string | null) => {
    onMemberChange(value || 'all');
  };

  const handleLocationFilterChange = (value: string | null) => {
    onLocationChange(value || 'all');
  };

  return (
    <div className="space-y-3">
      {/* Line 1: Navigation */}
      <div className="flex flex-wrap items-center gap-2 sm:gap-4">
        <Button variant="outline" size="sm" onClick={onToday}>
          Aujourd'hui
        </Button>

        <div className="flex items-center gap-1">
          <Button variant="ghost" size="sm" onClick={onPrevious} aria-label="Précédent">
            <ChevronLeft className="w-5 h-5" />
          </Button>
          <Button variant="ghost" size="sm" onClick={onNext} aria-label="Suivant">
            <ChevronRight className="w-5 h-5" />
          </Button>
        </div>

        {/* Title with date picker */}
        <div className="relative" ref={datePickerRef}>
          <button
            onClick={() => {
              setPickerMonth(new Date(selectedDate));
              setShowDatePicker(!showDatePicker);
            }}
            className="flex items-center gap-2 px-3 py-1.5 text-lg font-semibold text-gray-900 dark:text-white hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
          >
            <span className="capitalize">{getTitle()}</span>
            <Calendar className="w-4 h-4 text-gray-500" />
          </button>

          {/* Date Picker Dropdown */}
          {showDatePicker && (
            <div className="absolute top-full left-0 mt-2 p-4 bg-white dark:bg-gray-800 rounded-xl shadow-xl border border-gray-200 dark:border-gray-700 z-50 min-w-[280px]">
              {/* Month navigation */}
              <div className="flex items-center justify-between mb-4">
                <button
                  onClick={() => setPickerMonth(new Date(pickerMonth.getFullYear(), pickerMonth.getMonth() - 1))}
                  className="p-1.5 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <span className="font-medium text-gray-900 dark:text-white capitalize">
                  {pickerMonth.toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' })}
                </span>
                <button
                  onClick={() => setPickerMonth(new Date(pickerMonth.getFullYear(), pickerMonth.getMonth() + 1))}
                  className="p-1.5 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>

              {/* Day headers */}
              <div className="grid grid-cols-7 gap-1 mb-2">
                {['Lu', 'Ma', 'Me', 'Je', 'Ve', 'Sa', 'Di'].map((day) => (
                  <div key={day} className="text-center text-xs font-medium text-gray-500 dark:text-gray-400 py-1">
                    {day}
                  </div>
                ))}
              </div>

              {/* Days */}
              <div className="grid grid-cols-7 gap-1">
                {generateCalendarDays().map((day, index) =>
                  day ? (
                    <button
                      key={index}
                      onClick={() => handleDateClick(day)}
                      className={`
                        w-8 h-8 text-sm rounded-full flex items-center justify-center transition-colors
                        ${isSelected(day)
                          ? 'bg-primary-500 text-white'
                          : isToday(day)
                          ? 'bg-primary-100 dark:bg-primary-900/30 text-primary-700 dark:text-primary-300'
                          : 'hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-900 dark:text-white'}
                      `}
                    >
                      {day.getDate()}
                    </button>
                  ) : (
                    <div key={index} className="w-8 h-8" />
                  )
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Line 2: Filters and actions */}
      <div className="flex flex-wrap items-center gap-2 sm:gap-3">
        {/* View toggle - hidden on mobile since week view doesn't fit */}
        <div className="hidden md:flex rounded-lg border border-gray-200 dark:border-gray-700 p-0.5 bg-gray-50 dark:bg-gray-800">
          <button
            onClick={() => onViewModeChange('day')}
            className={`px-3 py-1.5 text-sm font-medium rounded-md transition-colors ${
              viewMode === 'day'
                ? 'bg-white dark:bg-gray-700 text-gray-900 dark:text-white shadow-sm'
                : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
            }`}
          >
            Jour
          </button>
          <button
            onClick={() => onViewModeChange('week')}
            className={`px-3 py-1.5 text-sm font-medium rounded-md transition-colors ${
              viewMode === 'week'
                ? 'bg-white dark:bg-gray-700 text-gray-900 dark:text-white shadow-sm'
                : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
            }`}
          >
            Semaine
          </button>
        </div>

        {/* Member filter (Teams only) */}
        {isTeamPlan && members.length > 0 && (
          <FilterChip
            label="membres"
            value={memberValue}
            options={members.map((member) => ({
              id: member.id,
              label: member.name,
              color: member.color,
            }))}
            icon={<User className="w-4 h-4" />}
            allLabel="Tous les"
            onChange={handleMemberFilterChange}
          />
        )}

        {/* Location filter */}
        {locations.length > 1 && (
          <FilterChip
            label="lieux"
            value={locationValue}
            options={locations.map((location) => ({
              id: location.id,
              label: location.name,
            }))}
            icon={<MapPin className="w-4 h-4" />}
            allLabel="Tous les"
            onChange={handleLocationFilterChange}
          />
        )}

        {/* Add menu — 3 choices: réservation, activité, période */}
        <div className="ml-auto relative">
          <AddMenu
            onCreateBooking={onCreateBooking}
            onCreateActivity={onCreateActivity}
            onBlockSlot={onBlockSlot}
          />
        </div>
      </div>
    </div>
  );
}

// ─── AddMenu ───────────────────────────────────────────────────────────
//
// Dropdown trigger that mirrors the mobile bottom sheet: Réservation
// client / Activité personnelle / Bloquer une période. Closes on
// outside click + Escape key. Each item routes to its own callback so
// the parent decides whether to open a modal, navigate, etc.

function AddMenu({
  onCreateBooking,
  onCreateActivity,
  onBlockSlot,
}: {
  onCreateBooking: () => void;
  onCreateActivity?: () => void;
  onBlockSlot?: () => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!open) return;
    const onDocClick = (e: MouseEvent) => {
      if (!ref.current) return;
      if (!ref.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', onDocClick);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDocClick);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  // When the optional callbacks aren't wired, fall back to the
  // single-button behaviour so we don't break callers that haven't
  // adopted activities yet.
  if (!onCreateActivity && !onBlockSlot) {
    return (
      <Button onClick={onCreateBooking} size="sm">
        <Plus className="w-4 h-4 mr-1.5" />
        <span className="hidden sm:inline">Nouveau RDV</span>
        <span className="sm:hidden">RDV</span>
      </Button>
    );
  }

  return (
    <div ref={ref}>
      <Button onClick={() => setOpen((v) => !v)} size="sm">
        <Plus className="w-4 h-4 mr-1.5" />
        <span className="hidden sm:inline">Nouveau</span>
        <span className="sm:hidden">+</span>
        <ChevronDown className="w-3.5 h-3.5 ml-1.5 -mr-0.5" />
      </Button>
      {open && (
        <div
          className="
            absolute right-0 mt-2 w-64 z-30
            bg-white dark:bg-gray-900 rounded-xl shadow-lg
            border border-gray-200 dark:border-gray-700
            py-1.5 overflow-hidden
          "
        >
          <button
            type="button"
            onClick={() => {
              setOpen(false);
              onCreateBooking();
            }}
            className="w-full flex items-center gap-3 px-3 py-2.5 text-left hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
          >
            <span className="flex-shrink-0 w-9 h-9 rounded-full bg-primary-100 dark:bg-primary-900/30 flex items-center justify-center">
              <Calendar className="w-4 h-4 text-primary-600 dark:text-primary-400" />
            </span>
            <span className="flex-1 min-w-0">
              <span className="block font-medium text-gray-900 dark:text-white">
                Réservation client
              </span>
              <span className="block text-xs text-gray-500 dark:text-gray-400">
                Nouveau RDV
              </span>
            </span>
          </button>

          {onCreateActivity && (
            <button
              type="button"
              onClick={() => {
                setOpen(false);
                onCreateActivity();
              }}
              className="w-full flex items-center gap-3 px-3 py-2.5 text-left hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
            >
              <span
                className="flex-shrink-0 w-9 h-9 rounded-full flex items-center justify-center"
                style={{ backgroundColor: '#f9731620' }}
              >
                <Zap className="w-4 h-4" style={{ color: '#f97316' }} />
              </span>
              <span className="flex-1 min-w-0">
                <span className="block font-medium text-gray-900 dark:text-white">
                  Activité personnelle
                </span>
                <span className="block text-xs text-gray-500 dark:text-gray-400">
                  Sport, RDV perso, admin…
                </span>
              </span>
            </button>
          )}

          {onBlockSlot && (
            <button
              type="button"
              onClick={() => {
                setOpen(false);
                onBlockSlot();
              }}
              className="w-full flex items-center gap-3 px-3 py-2.5 text-left hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
            >
              <span className="flex-shrink-0 w-9 h-9 rounded-full bg-gray-100 dark:bg-gray-800 flex items-center justify-center">
                <Ban className="w-4 h-4 text-gray-500 dark:text-gray-400" />
              </span>
              <span className="flex-1 min-w-0">
                <span className="block font-medium text-gray-900 dark:text-white">
                  Bloquer une période
                </span>
                <span className="block text-xs text-gray-500 dark:text-gray-400">
                  Vacances, formation, absence
                </span>
              </span>
            </button>
          )}
        </div>
      )}
    </div>
  );
}
