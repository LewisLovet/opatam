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
  /** Default activity duration in minutes used when the popover is
   *  opened from a click (no range was drag-selected). */
  clickDefaultDurationMinutes?: number;
}

interface SelectionPopover {
  y: number;
  startTime: string;
  endTime: string;
  /** How this popover was triggered — drives which actions the
   *  renderer surfaces:
   *    - 'click' → Réservation + Activité (single point, default
   *      duration applied for the activity case)
   *    - 'drag'  → Activité + Bloquer (range explicitly selected)
   */
  mode: 'click' | 'drag';
}

interface UseTimeRangeDragResult {
  // Loosened to MutableRefObject so older React 18 typings (where
  // useRef<T>(null) returns RefObject<T> with nullable .current)
  // line up with the explicit cast we make in the hook body.
  colRef: { current: HTMLDivElement | null };
  dragRect: { top: number; height: number } | null;
  popover: SelectionPopover | null;
  setPopover: (p: SelectionPopover | null) => void;
  /** Mouse Y inside the column — null when the cursor is outside or
   *  while a drag is in progress / popover is open. Used by the
   *  renderer to draw a thin horizontal hover line that signals
   *  "you can click-and-drag here". */
  hoverY: number | null;
  /** Time label ("HH:MM") at hoverY, useful as a small tooltip next
   *  to the line. */
  hoverTime: string | null;
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
  clickDefaultDurationMinutes = 60,
}: UseTimeRangeDragOptions): UseTimeRangeDragResult {
  const colRef = useRef<HTMLDivElement>(null);
  const [dragStartY, setDragStartY] = useState<number | null>(null);
  const [dragCurrentY, setDragCurrentY] = useState<number | null>(null);
  const [popover, setPopover] = useState<SelectionPopover | null>(null);
  // Where the cursor is right now inside the column. We surface this
  // separately from drag tracking so the renderer can draw a hover
  // line as the affordance — without one, pros don't realise they
  // can click-and-drag on what looks like an empty grid.
  const [hoverY, setHoverY] = useState<number | null>(null);

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
    const rect = e.currentTarget.getBoundingClientRect();
    const y = e.clientY - rect.top;
    setHoverY(y);
    if (dragStartY === null) return;
    setDragCurrentY(y);
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
      // Pure click — no range explicitly drawn. Pre-fill a sensible
      // default duration so the activity / booking modals open with
      // start..start+1h. The pro can still tweak from there.
      const startTimeStr = yToTime(startY);
      const [sh, sm] = startTimeStr.split(':').map(Number);
      const totalEndMin = sh * 60 + sm + clickDefaultDurationMinutes;
      const eh = Math.floor(totalEndMin / 60);
      const em = totalEndMin % 60;
      const endTimeStr = `${String(eh).padStart(2, '0')}:${String(em).padStart(2, '0')}`;
      setPopover({
        y: startY + 6,
        startTime: startTimeStr,
        endTime: endTimeStr,
        mode: 'click',
      });
      return;
    }

    const top = Math.min(startY, endY);
    const bottom = Math.max(startY, endY);
    setPopover({
      y: bottom + 6,
      startTime: yToTime(top),
      endTime: yToTime(bottom),
      mode: 'drag',
    });
  };

  const onMouseLeave = () => {
    setHoverY(null);
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

  // Only surface the hover line when there's no drag in progress
  // and no popover open — otherwise it would compete with the
  // selection rectangle / decision UI for the pro's attention.
  const exposeHoverY = hoverY !== null && dragStartY === null && popover === null
    ? hoverY
    : null;
  const hoverTime = exposeHoverY !== null ? yToTime(exposeHoverY) : null;

  return {
    colRef,
    dragRect,
    popover,
    setPopover,
    hoverY: exposeHoverY,
    hoverTime,
    bind: { onMouseDown, onMouseMove, onMouseUp, onMouseLeave },
  };
}
