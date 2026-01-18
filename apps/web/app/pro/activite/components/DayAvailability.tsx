'use client';

import { useState } from 'react';
import { Switch } from '@/components/ui';
import { Plus, ChevronDown, ChevronUp } from 'lucide-react';
import { TimeSlotInput } from './TimeSlotInput';
import type { TimeSlot } from '@booking-app/shared';

const DAY_NAMES = ['Dimanche', 'Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi'];

type SlotMode = 'simple' | 'advanced';
type SimplePreset = 'continuous' | 'break';

interface DayAvailabilityProps {
  dayOfWeek: number;
  isOpen: boolean;
  slots: TimeSlot[];
  onChange: (isOpen: boolean, slots: TimeSlot[]) => void;
  disabled?: boolean;
  expanded?: boolean;
  onToggleExpand?: () => void;
  isMobile?: boolean;
}

const DEFAULT_CONTINUOUS: TimeSlot[] = [{ start: '09:00', end: '18:00' }];
const DEFAULT_BREAK: TimeSlot[] = [
  { start: '09:00', end: '12:00' },
  { start: '14:00', end: '18:00' },
];

export function DayAvailability({
  dayOfWeek,
  isOpen,
  slots,
  onChange,
  disabled = false,
  expanded = true,
  onToggleExpand,
  isMobile = false,
}: DayAvailabilityProps) {
  const [mode, setMode] = useState<SlotMode>(() => {
    // Determine initial mode based on slots
    if (slots.length <= 2) return 'simple';
    return 'advanced';
  });

  const [preset, setPreset] = useState<SimplePreset>(() => {
    if (slots.length === 1) return 'continuous';
    return 'break';
  });

  const dayName = DAY_NAMES[dayOfWeek];

  const handleToggleOpen = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newIsOpen = e.target.checked;
    if (newIsOpen && slots.length === 0) {
      // Set default slots when opening
      onChange(true, DEFAULT_CONTINUOUS);
    } else {
      onChange(newIsOpen, slots);
    }
  };

  const handlePresetChange = (newPreset: SimplePreset) => {
    setPreset(newPreset);
    if (newPreset === 'continuous') {
      // Keep first slot's times or use defaults
      const start = slots[0]?.start || '09:00';
      const end = slots[slots.length - 1]?.end || '18:00';
      onChange(isOpen, [{ start, end }]);
    } else {
      // Break preset - 2 slots
      onChange(isOpen, DEFAULT_BREAK);
    }
  };

  const handleSlotChange = (index: number, start: string, end: string) => {
    const newSlots = [...slots];
    newSlots[index] = { start, end };
    onChange(isOpen, newSlots);
  };

  const handleAddSlot = () => {
    if (slots.length >= 5) return;
    const lastSlot = slots[slots.length - 1];
    const newStart = lastSlot?.end || '18:00';
    const newEnd = '20:00';
    onChange(isOpen, [...slots, { start: newStart, end: newEnd }]);
  };

  const handleRemoveSlot = (index: number) => {
    if (slots.length <= 1) return;
    const newSlots = slots.filter((_, i) => i !== index);
    onChange(isOpen, newSlots);
  };

  const switchToAdvanced = () => {
    setMode('advanced');
  };

  const switchToSimple = () => {
    setMode('simple');
    // Normalize to max 2 slots
    if (slots.length > 2) {
      onChange(isOpen, slots.slice(0, 2));
    }
    setPreset(slots.length === 1 ? 'continuous' : 'break');
  };

  const validateSlot = (slot: TimeSlot): string | undefined => {
    if (slot.start >= slot.end) {
      return 'Heure de fin doit etre apres le debut';
    }
    return undefined;
  };

  // Mobile accordion header
  const renderMobileHeader = () => (
    <button
      type="button"
      onClick={onToggleExpand}
      className={`
        w-full flex items-center justify-between p-4
        ${!isOpen ? 'opacity-60' : ''}
      `}
    >
      <div className="flex items-center gap-3">
        <div onClick={(e) => e.stopPropagation()}>
          <Switch
            checked={isOpen}
            onChange={handleToggleOpen}
            disabled={disabled}
            aria-label={`${dayName} ouvert`}
          />
        </div>
        <span className="font-medium text-gray-900 dark:text-white">{dayName}</span>
      </div>
      <div className="flex items-center gap-2">
        {isOpen && slots.length > 0 && (
          <span className="text-sm text-gray-500 dark:text-gray-400">
            {slots.map((s) => `${s.start}-${s.end}`).join(', ')}
          </span>
        )}
        {!isOpen && (
          <span className="text-sm text-gray-400 dark:text-gray-500">Ferme</span>
        )}
        {expanded ? (
          <ChevronUp className="w-5 h-5 text-gray-400" />
        ) : (
          <ChevronDown className="w-5 h-5 text-gray-400" />
        )}
      </div>
    </button>
  );

  // Desktop header
  const renderDesktopHeader = () => (
    <div className="flex items-center justify-between mb-3">
      <span className="font-medium text-gray-900 dark:text-white">{dayName}</span>
      <Switch
        checked={isOpen}
        onChange={handleToggleOpen}
        disabled={disabled}
        aria-label={`${dayName} ouvert`}
      />
    </div>
  );

  // Content when day is closed
  const renderClosedContent = () => (
    <div className="text-center py-4 text-gray-400 dark:text-gray-500">
      Ferme
    </div>
  );

  // Simple mode content
  const renderSimpleMode = () => (
    <div className="space-y-4">
      {/* Preset selector */}
      <div className="flex gap-2">
        <button
          type="button"
          onClick={() => handlePresetChange('continuous')}
          className={`
            flex-1 py-2 px-3 text-sm rounded-lg border transition-all
            ${preset === 'continuous'
              ? 'border-primary-500 bg-primary-50 dark:bg-primary-900/20 text-primary-700 dark:text-primary-300'
              : 'border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-400 hover:border-gray-300 dark:hover:border-gray-600'
            }
          `}
        >
          Journee continue
        </button>
        <button
          type="button"
          onClick={() => handlePresetChange('break')}
          className={`
            flex-1 py-2 px-3 text-sm rounded-lg border transition-all
            ${preset === 'break'
              ? 'border-primary-500 bg-primary-50 dark:bg-primary-900/20 text-primary-700 dark:text-primary-300'
              : 'border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-400 hover:border-gray-300 dark:hover:border-gray-600'
            }
          `}
        >
          Avec pause
        </button>
      </div>

      {/* Time slots */}
      <div className="space-y-3">
        {slots.map((slot, index) => (
          <div key={index}>
            {preset === 'break' && index === 1 && (
              <div className="text-xs text-gray-500 dark:text-gray-400 mb-1 text-center">
                Pause dejeuner
              </div>
            )}
            <TimeSlotInput
              start={slot.start}
              end={slot.end}
              onChange={(start, end) => handleSlotChange(index, start, end)}
              error={validateSlot(slot)}
            />
          </div>
        ))}
      </div>

      {/* Mode switcher */}
      <button
        type="button"
        onClick={switchToAdvanced}
        className="text-sm text-primary-600 dark:text-primary-400 hover:underline"
      >
        Mode avance
      </button>
    </div>
  );

  // Advanced mode content
  const renderAdvancedMode = () => (
    <div className="space-y-4">
      {/* Time slots */}
      <div className="space-y-3">
        {slots.map((slot, index) => (
          <TimeSlotInput
            key={index}
            start={slot.start}
            end={slot.end}
            onChange={(start, end) => handleSlotChange(index, start, end)}
            onRemove={() => handleRemoveSlot(index)}
            showRemove={slots.length > 1}
            error={validateSlot(slot)}
          />
        ))}
      </div>

      {/* Add slot button */}
      {slots.length < 5 && (
        <button
          type="button"
          onClick={handleAddSlot}
          className="flex items-center gap-1 text-sm text-primary-600 dark:text-primary-400 hover:text-primary-700 dark:hover:text-primary-300"
        >
          <Plus className="w-4 h-4" />
          Ajouter une plage
        </button>
      )}

      {/* Mode switcher */}
      <button
        type="button"
        onClick={switchToSimple}
        className="text-sm text-gray-500 dark:text-gray-400 hover:underline"
      >
        Mode simple
      </button>
    </div>
  );

  // Mobile view
  if (isMobile) {
    return (
      <div className="border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden">
        {renderMobileHeader()}
        {expanded && isOpen && (
          <div className="px-4 pb-4 border-t border-gray-100 dark:border-gray-800 pt-3">
            {mode === 'simple' ? renderSimpleMode() : renderAdvancedMode()}
          </div>
        )}
      </div>
    );
  }

  // Desktop view
  return (
    <div className={`
      p-4 rounded-xl border transition-all
      ${isOpen
        ? 'border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800'
        : 'border-gray-100 dark:border-gray-800 bg-gray-50 dark:bg-gray-900/50'
      }
    `}>
      {renderDesktopHeader()}
      {isOpen ? (
        mode === 'simple' ? renderSimpleMode() : renderAdvancedMode()
      ) : (
        renderClosedContent()
      )}
    </div>
  );
}
