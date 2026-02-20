'use client';

import { Switch } from '@/components/ui';
import { Plus, X } from 'lucide-react';
import { CopyToPopover } from './CopyToPopover';
import type { TimeSlot } from '@booking-app/shared';

const DAY_NAMES: Record<number, string> = {
  0: 'Dim',
  1: 'Lun',
  2: 'Mar',
  3: 'Mer',
  4: 'Jeu',
  5: 'Ven',
  6: 'Sam',
};

interface DayRowProps {
  dayOfWeek: number;
  isOpen: boolean;
  slots: TimeSlot[];
  onDayChange: (dayOfWeek: number, isOpen: boolean, slots: TimeSlot[]) => void;
  onCopyTo: (sourceDayOfWeek: number, targetDays: number[]) => void;
  isDirty?: boolean;
}

const DEFAULT_SLOT: TimeSlot[] = [{ start: '09:00', end: '18:00' }];

export function DayRow({
  dayOfWeek,
  isOpen,
  slots,
  onDayChange,
  onCopyTo,
  isDirty = false,
}: DayRowProps) {
  const dayName = DAY_NAMES[dayOfWeek];

  const handleToggle = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newIsOpen = e.target.checked;
    if (newIsOpen && slots.length === 0) {
      onDayChange(dayOfWeek, true, DEFAULT_SLOT);
    } else {
      onDayChange(dayOfWeek, newIsOpen, slots);
    }
  };

  const handleSlotChange = (index: number, field: 'start' | 'end', value: string) => {
    const newSlots = [...slots];
    newSlots[index] = { ...newSlots[index], [field]: value };
    onDayChange(dayOfWeek, isOpen, newSlots);
  };

  const handleAddSlot = () => {
    if (slots.length >= 4) return;
    const lastEnd = slots[slots.length - 1]?.end || '18:00';
    onDayChange(dayOfWeek, isOpen, [...slots, { start: lastEnd, end: '20:00' }]);
  };

  const handleRemoveSlot = (index: number) => {
    if (slots.length <= 1) return;
    onDayChange(dayOfWeek, isOpen, slots.filter((_, i) => i !== index));
  };

  const handleCopyApply = (targetDays: number[]) => {
    onCopyTo(dayOfWeek, targetDays);
  };

  return (
    <div
      className={`
        flex items-start gap-2 py-2 px-3 rounded-lg transition-all
        ${isDirty ? 'bg-primary-50/50 dark:bg-primary-900/10' : ''}
      `}
    >
      {/* Switch + day name */}
      <div className="flex items-center gap-2 shrink-0 pt-0.5" style={{ width: 80 }}>
        <Switch
          checked={isOpen}
          onChange={handleToggle}
          aria-label={`${dayName} ouvert`}
        />
        <span
          className={`text-sm font-medium ${
            isOpen
              ? 'text-gray-900 dark:text-white'
              : 'text-gray-400 dark:text-gray-500'
          }`}
        >
          {dayName}
        </span>
      </div>

      {/* Slots or "Fermé" */}
      <div className="flex-1 min-w-0">
        {isOpen ? (
          <div className="flex flex-col gap-1.5">
            {slots.map((slot, index) => {
              const hasError = slot.start >= slot.end;
              return (
                <div key={index} className="flex items-center gap-1">
                  <TimeSelect
                    value={slot.start}
                    onChange={(v) => handleSlotChange(index, 'start', v)}
                    hasError={hasError}
                  />
                  <span className="text-gray-400 text-xs">–</span>
                  <TimeSelect
                    value={slot.end}
                    onChange={(v) => handleSlotChange(index, 'end', v)}
                    hasError={hasError}
                  />
                  {slots.length > 1 && (
                    <button
                      type="button"
                      onClick={() => handleRemoveSlot(index)}
                      className="p-0.5 text-gray-300 hover:text-error-500 dark:text-gray-600 dark:hover:text-error-400 transition-colors"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  )}
                </div>
              );
            })}
            {slots.length < 4 && (
              <button
                type="button"
                onClick={handleAddSlot}
                className="flex items-center gap-0.5 text-[11px] text-primary-500 dark:text-primary-400 hover:text-primary-600 w-fit"
              >
                <Plus className="w-3 h-3" />
                Plage
              </button>
            )}
          </div>
        ) : (
          <span className="text-xs text-gray-400 dark:text-gray-500 pt-1 block">
            Fermé
          </span>
        )}
      </div>

      {/* Copy button */}
      {isOpen && (
        <div className="shrink-0 pt-0.5">
          <CopyToPopover
            sourceDayOfWeek={dayOfWeek}
            onApply={handleCopyApply}
            disabled={!isOpen}
          />
        </div>
      )}
    </div>
  );
}

/* Compact time select */
function TimeSelect({
  value,
  onChange,
  hasError,
}: {
  value: string;
  onChange: (value: string) => void;
  hasError?: boolean;
}) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className={`
        w-[72px] px-1.5 py-1 text-xs rounded border appearance-none
        bg-white dark:bg-gray-800 transition-colors
        focus:outline-none focus:ring-1 focus:ring-offset-0
        ${hasError
          ? 'border-error-400 text-error-600 dark:text-error-400 focus:ring-error-500'
          : 'border-gray-200 dark:border-gray-600 text-gray-700 dark:text-gray-300 focus:ring-primary-500 focus:border-primary-500'
        }
      `}
    >
      {TIME_OPTIONS.map((t) => (
        <option key={t} value={t}>{t}</option>
      ))}
    </select>
  );
}

// 15-min increment time options
const TIME_OPTIONS: string[] = (() => {
  const opts: string[] = [];
  for (let h = 0; h < 24; h++) {
    for (let m = 0; m < 60; m += 15) {
      opts.push(`${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`);
    }
  }
  return opts;
})();
