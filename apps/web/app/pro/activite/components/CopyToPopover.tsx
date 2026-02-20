'use client';

import { useState, useRef, useEffect } from 'react';
import { Copy, Check } from 'lucide-react';
import { Button } from '@/components/ui';

const DAY_LABELS: Record<number, string> = {
  0: 'Dimanche',
  1: 'Lundi',
  2: 'Mardi',
  3: 'Mercredi',
  4: 'Jeudi',
  5: 'Vendredi',
  6: 'Samedi',
};

// Ordered Mon-Sun
const DAY_ORDER = [1, 2, 3, 4, 5, 6, 0];
const WEEKDAYS = [1, 2, 3, 4, 5];

interface CopyToPopoverProps {
  sourceDayOfWeek: number;
  onApply: (targetDays: number[]) => void;
  disabled?: boolean;
}

export function CopyToPopover({ sourceDayOfWeek, onApply, disabled = false }: CopyToPopoverProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const popoverRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);

  // Close on click outside
  useEffect(() => {
    if (!isOpen) return;
    const handler = (e: MouseEvent) => {
      if (
        popoverRef.current &&
        !popoverRef.current.contains(e.target as Node) &&
        buttonRef.current &&
        !buttonRef.current.contains(e.target as Node)
      ) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [isOpen]);

  const handleOpen = () => {
    setSelected(new Set());
    setIsOpen(true);
  };

  const toggleDay = (day: number) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(day)) next.delete(day);
      else next.add(day);
      return next;
    });
  };

  const selectWeekdays = () => {
    setSelected(new Set(WEEKDAYS.filter((d) => d !== sourceDayOfWeek)));
  };

  const selectAll = () => {
    setSelected(new Set(DAY_ORDER.filter((d) => d !== sourceDayOfWeek)));
  };

  const handleApply = () => {
    if (selected.size > 0) {
      onApply(Array.from(selected));
    }
    setIsOpen(false);
  };

  return (
    <div className="relative">
      <button
        ref={buttonRef}
        type="button"
        onClick={handleOpen}
        disabled={disabled}
        className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium text-gray-500 dark:text-gray-400 hover:text-primary-600 dark:hover:text-primary-400 hover:bg-gray-50 dark:hover:bg-gray-700/50 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        title="Copier ces horaires vers d'autres jours"
      >
        <Copy className="w-3.5 h-3.5" />
        <span className="hidden sm:inline">Copier vers...</span>
      </button>

      {isOpen && (
        <div
          ref={popoverRef}
          className="absolute right-0 top-full mt-1 z-50 w-64 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl shadow-lg p-4 space-y-3"
        >
          {/* Shortcuts */}
          <div className="flex gap-2">
            <button
              type="button"
              onClick={selectWeekdays}
              className="text-xs text-primary-600 dark:text-primary-400 hover:underline"
            >
              Lun-Ven
            </button>
            <span className="text-gray-300 dark:text-gray-600">|</span>
            <button
              type="button"
              onClick={selectAll}
              className="text-xs text-primary-600 dark:text-primary-400 hover:underline"
            >
              Tous les jours
            </button>
          </div>

          {/* Day checkboxes */}
          <div className="space-y-1.5">
            {DAY_ORDER.map((day) => {
              const isSource = day === sourceDayOfWeek;
              const isChecked = isSource || selected.has(day);

              return (
                <label
                  key={day}
                  className={`
                    flex items-center gap-2.5 px-2 py-1.5 rounded-lg cursor-pointer transition-colors
                    ${isSource ? 'opacity-40 cursor-not-allowed' : 'hover:bg-gray-50 dark:hover:bg-gray-700/50'}
                  `}
                >
                  <input
                    type="checkbox"
                    checked={isChecked}
                    disabled={isSource}
                    onChange={() => !isSource && toggleDay(day)}
                    className="h-4 w-4 rounded border-gray-300 dark:border-gray-600 text-primary-600 dark:text-primary-500 focus:ring-primary-500 focus:ring-offset-0 disabled:opacity-50"
                  />
                  <span className="text-sm text-gray-700 dark:text-gray-300">
                    {DAY_LABELS[day]}
                  </span>
                  {isSource && (
                    <span className="text-xs text-gray-400 dark:text-gray-500 ml-auto">source</span>
                  )}
                </label>
              );
            })}
          </div>

          {/* Actions */}
          <div className="flex items-center justify-between pt-2 border-t border-gray-100 dark:border-gray-700">
            <button
              type="button"
              onClick={() => setIsOpen(false)}
              className="text-xs text-gray-500 dark:text-gray-400 hover:underline"
            >
              Annuler
            </button>
            <Button
              size="sm"
              onClick={handleApply}
              disabled={selected.size === 0}
            >
              <Check className="w-3.5 h-3.5 mr-1" />
              Appliquer ({selected.size})
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
