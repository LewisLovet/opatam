'use client';

/**
 * SelectionPopover — appears after the pro clicks or drag-selects a
 * time range on the calendar. The buttons rendered depend on which
 * callbacks are wired:
 *
 *   - onBooking  → "Réservation" (single-point click)
 *   - onActivity → "Activité"    (always available)
 *   - onBlock    → "Bloquer"     (range gesture)
 *
 * Callers wire the relevant subset based on whether the popover was
 * triggered by a click (Réservation + Activité) or a drag (Activité
 * + Bloquer).
 */

import { Calendar, Zap, Ban } from 'lucide-react';

interface SelectionPopoverProps {
  y: number;
  totalHeight: number;
  startTime: string;
  endTime: string;
  onActivity: () => void;
  onBlock?: () => void;
  onBooking?: () => void;
}

export function SelectionPopover({
  y,
  totalHeight,
  startTime,
  endTime,
  onActivity,
  onBlock,
  onBooking,
}: SelectionPopoverProps) {
  // Clamp so the popover stays inside the column even when the
  // selection ends near the bottom edge. Estimate ~50px per row.
  const rowCount = (onBooking ? 1 : 0) + 1 + (onBlock ? 1 : 0);
  const estimatedHeight = 32 + rowCount * 44;
  const top = Math.min(y, Math.max(0, totalHeight - estimatedHeight));

  return (
    <div
      className="absolute left-1 right-1 z-30"
      style={{ top: `${top}px` }}
      onMouseDown={(e) => e.stopPropagation()}
      onClick={(e) => e.stopPropagation()}
    >
      <div className="bg-white dark:bg-gray-900 rounded-lg shadow-xl border border-gray-200 dark:border-gray-700 overflow-hidden">
        <div className="px-3 py-2 border-b border-gray-100 dark:border-gray-800 text-xs text-gray-500 dark:text-gray-400">
          {startTime} → {endTime}
        </div>

        {onBooking && (
          <button
            type="button"
            onClick={onBooking}
            className="w-full flex items-center gap-2.5 px-3 py-2 text-left text-sm hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
          >
            <span className="w-7 h-7 rounded-full bg-primary-100 dark:bg-primary-900/30 flex items-center justify-center">
              <Calendar className="w-3.5 h-3.5 text-primary-600 dark:text-primary-400" />
            </span>
            <span className="font-medium text-gray-900 dark:text-white">Réservation</span>
          </button>
        )}

        <button
          type="button"
          onClick={onActivity}
          className="w-full flex items-center gap-2.5 px-3 py-2 text-left text-sm hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
        >
          <span
            className="w-7 h-7 rounded-full flex items-center justify-center"
            style={{ backgroundColor: '#f9731620' }}
          >
            <Zap className="w-3.5 h-3.5" style={{ color: '#f97316' }} />
          </span>
          <span className="font-medium text-gray-900 dark:text-white">Activité</span>
        </button>

        {onBlock && (
          <button
            type="button"
            onClick={onBlock}
            className="w-full flex items-center gap-2.5 px-3 py-2 text-left text-sm hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
          >
            <span className="w-7 h-7 rounded-full bg-gray-100 dark:bg-gray-800 flex items-center justify-center">
              <Ban className="w-3.5 h-3.5 text-gray-500 dark:text-gray-400" />
            </span>
            <span className="font-medium text-gray-900 dark:text-white">Bloquer</span>
          </button>
        )}
      </div>
    </div>
  );
}
