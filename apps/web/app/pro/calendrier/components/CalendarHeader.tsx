'use client';

import { useState, useRef, useEffect } from 'react';
import { Button } from '@/components/ui';
import { ChevronLeft, ChevronRight, Calendar, Plus, User, MapPin } from 'lucide-react';
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
          <Button variant="ghost" size="sm" onClick={onPrevious} aria-label="Precedent">
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

        {/* Create booking button */}
        <div className="ml-auto">
          <Button onClick={onCreateBooking} size="sm">
            <Plus className="w-4 h-4 mr-1.5" />
            <span className="hidden sm:inline">Nouveau RDV</span>
            <span className="sm:hidden">RDV</span>
          </Button>
        </div>
      </div>
    </div>
  );
}
