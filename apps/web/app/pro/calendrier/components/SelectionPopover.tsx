'use client';

/**
 * SelectionPopover — appears after the pro drag-selects a time range
 * on the calendar. Two actions: turn the range into an activity, or
 * block it as a generic period. Both are shorthand routes into the
 * existing modals with the times pre-filled.
 */

interface SelectionPopoverProps {
  /** Pixel offset from the top of the column where the popover anchors. */
  y: number;
  /** Total column height — popover is clamped so it can't fall off the bottom. */
  totalHeight: number;
  startTime: string;
  endTime: string;
  onActivity: () => void;
  onBlock: () => void;
}

export function SelectionPopover({
  y,
  totalHeight,
  startTime,
  endTime,
  onActivity,
  onBlock,
}: SelectionPopoverProps) {
  // Clamp so the popover stays inside the column even when the
  // selection ends near the bottom edge.
  const top = Math.min(y, Math.max(0, totalHeight - 110));

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
        <button
          type="button"
          onClick={onActivity}
          className="w-full flex items-center gap-2.5 px-3 py-2 text-left text-sm hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
        >
          <span
            className="w-7 h-7 rounded-full flex items-center justify-center"
            style={{ backgroundColor: '#f9731620' }}
          >
            <span className="w-2 h-2 rounded-full" style={{ backgroundColor: '#f97316' }} />
          </span>
          <span className="font-medium text-gray-900 dark:text-white">Activité</span>
        </button>
        <button
          type="button"
          onClick={onBlock}
          className="w-full flex items-center gap-2.5 px-3 py-2 text-left text-sm hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
        >
          <span className="w-7 h-7 rounded-full bg-gray-100 dark:bg-gray-800 flex items-center justify-center">
            <span className="w-2 h-2 rounded-full bg-gray-400 dark:bg-gray-500" />
          </span>
          <span className="font-medium text-gray-900 dark:text-white">Bloquer</span>
        </button>
      </div>
    </div>
  );
}
