'use client';

import { ChevronUp, ChevronDown } from 'lucide-react';

interface ReorderControlsProps {
  index: number;
  count: number;
  onMove: (dir: -1 | 1) => void;
  /** Tighter buttons for compact rows (e.g. variation choices). */
  compact?: boolean;
}

/**
 * Up / Down arrows to reorder an item in a list. Hidden entirely when
 * there's a single item (nothing to reorder). Bounds buttons disable at
 * the ends.
 */
export function ReorderControls({
  index,
  count,
  onMove,
  compact = false,
}: ReorderControlsProps) {
  if (count <= 1) return null;
  const size = compact ? 'w-3.5 h-3.5' : 'w-4 h-4';
  const pad = compact ? 'p-0.5' : 'p-1';

  return (
    <div className="flex flex-col flex-shrink-0">
      <button
        type="button"
        onClick={() => onMove(-1)}
        disabled={index === 0}
        className={`${pad} rounded text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors disabled:opacity-25 disabled:hover:bg-transparent`}
        aria-label="Monter"
      >
        <ChevronUp className={size} />
      </button>
      <button
        type="button"
        onClick={() => onMove(1)}
        disabled={index === count - 1}
        className={`${pad} rounded text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors disabled:opacity-25 disabled:hover:bg-transparent`}
        aria-label="Descendre"
      >
        <ChevronDown className={size} />
      </button>
    </div>
  );
}
