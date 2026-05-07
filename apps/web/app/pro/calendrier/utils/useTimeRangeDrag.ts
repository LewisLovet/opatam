'use client';

/**
 * useTimeRangeDrag — shared drag-to-select logic for the calendar
 * day / week columns.
 *
 * The pro presses, drags vertically across the time grid, releases —
 * we surface a popover with two choices (Bloquer / Activité). A short
 * drag (< CLICK_THRESHOLD px) is treated as a normal click and
 * delegates to `onClick` so the existing "click empty slot to
 * create a booking" flow still works.
 */
import {
  useEffect,
  useRef,
  useState,
  type MouseEvent as ReactMouseEvent,
} from 'react';
import { getTimeFromPosition } from '../components/TimeGrid';

const CLICK_THRESHOLD_PX = 8;

interface UseTimeRangeDragOptions {
  /** Total pixel height of the grid (END_HOUR - START_HOUR) * SLOT_HEIGHT. */
  totalHeight: number;
  startHour: number;
  slotHeight: number;
  /** Snap step in minutes — both DayView and WeekView use 15. */
  snapMinutes?: number;
  /** Fallback for taps that fail the drag threshold. */
  onClick?: (e: ReactMouseEvent) => void;
}

interface SelectionPopover {
  y: number;
  startTime: string;
  endTime: string;
}

interface UseTimeRangeDragResult {
  // Loosened to MutableRefObject so older React 18 typings (where
  // useRef<T>(null) returns RefObject<T> with nullable .current)
  // line up with the explicit cast we make in the hook body.
  colRef: { current: HTMLDivElement | null };
  dragRect: { top: number; height: number } | null;
  popover: SelectionPopover | null;
  setPopover: (p: SelectionPopover | null) => void;
  bind: {
    onMouseDown: (e: ReactMouseEvent) => void;
    onMouseMove: (e: ReactMouseEvent) => void;
    onMouseUp: (e: ReactMouseEvent) => void;
    onMouseLeave: () => void;
  };
}

export function useTimeRangeDrag({
  totalHeight,
  startHour,
  slotHeight,
  snapMinutes = 15,
  onClick,
}: UseTimeRangeDragOptions): UseTimeRangeDragResult {
  const colRef = useRef<HTMLDivElement>(null);
  const [dragStartY, setDragStartY] = useState<number | null>(null);
  const [dragCurrentY, setDragCurrentY] = useState<number | null>(null);
  const [popover, setPopover] = useState<SelectionPopover | null>(null);

  const yToTime = (y: number) => {
    const clamped = Math.max(0, Math.min(y, totalHeight));
    const { hours, minutes } = getTimeFromPosition(clamped, startHour, slotHeight, snapMinutes);
    return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
  };

  const onMouseDown = (e: ReactMouseEvent) => {
    if (e.button !== 0) return;
    if (popover) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const y = e.clientY - rect.top;
    setDragStartY(y);
    setDragCurrentY(y);
  };

  const onMouseMove = (e: ReactMouseEvent) => {
    if (dragStartY === null) return;
    const rect = e.currentTarget.getBoundingClientRect();
    setDragCurrentY(e.clientY - rect.top);
  };

  const onMouseUp = (e: ReactMouseEvent) => {
    if (dragStartY === null) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const endY = e.clientY - rect.top;
    const distance = Math.abs(endY - dragStartY);
    const startY = dragStartY;
    setDragStartY(null);
    setDragCurrentY(null);

    if (distance < CLICK_THRESHOLD_PX) {
      onClick?.(e);
      return;
    }

    const top = Math.min(startY, endY);
    const bottom = Math.max(startY, endY);
    setPopover({
      y: bottom + 6,
      startTime: yToTime(top),
      endTime: yToTime(bottom),
    });
  };

  const onMouseLeave = () => {
    if (dragStartY !== null && popover === null) {
      setDragStartY(null);
      setDragCurrentY(null);
    }
  };

  // Close popover on outside click + Escape.
  useEffect(() => {
    if (!popover) return;
    const onDocClick = (e: globalThis.MouseEvent) => {
      if (!colRef.current) return;
      if (!colRef.current.contains(e.target as Node)) setPopover(null);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setPopover(null);
    };
    document.addEventListener('mousedown', onDocClick);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDocClick);
      document.removeEventListener('keydown', onKey);
    };
  }, [popover]);

  const dragRect =
    dragStartY !== null && dragCurrentY !== null
      ? {
          top: Math.min(dragStartY, dragCurrentY),
          height: Math.abs(dragCurrentY - dragStartY),
        }
      : null;

  return {
    colRef,
    dragRect,
    popover,
    setPopover,
    bind: { onMouseDown, onMouseMove, onMouseUp, onMouseLeave },
  };
}
