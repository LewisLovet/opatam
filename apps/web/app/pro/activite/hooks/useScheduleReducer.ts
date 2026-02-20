'use client';

import { useReducer, useEffect, useMemo, useCallback } from 'react';
import type { TimeSlot } from '@booking-app/shared';

export interface DaySchedule {
  dayOfWeek: number;
  isOpen: boolean;
  slots: TimeSlot[];
}

interface ScheduleState {
  original: DaySchedule[];
  current: DaySchedule[];
  saving: boolean;
}

type ScheduleAction =
  | { type: 'LOAD'; schedule: DaySchedule[] }
  | { type: 'UPDATE_DAY'; dayOfWeek: number; isOpen: boolean; slots: TimeSlot[] }
  | { type: 'COPY_TO'; sourceDayOfWeek: number; targetDays: number[] }
  | { type: 'APPLY_TEMPLATE'; schedule: DaySchedule[] }
  | { type: 'RESET' }
  | { type: 'SAVE_START' }
  | { type: 'SAVE_SUCCESS' }
  | { type: 'SAVE_ERROR' };

// Default schedule for new providers
const DEFAULT_SCHEDULE: DaySchedule[] = [
  { dayOfWeek: 0, isOpen: false, slots: [] },
  { dayOfWeek: 1, isOpen: true, slots: [{ start: '09:00', end: '18:00' }] },
  { dayOfWeek: 2, isOpen: true, slots: [{ start: '09:00', end: '18:00' }] },
  { dayOfWeek: 3, isOpen: true, slots: [{ start: '09:00', end: '18:00' }] },
  { dayOfWeek: 4, isOpen: true, slots: [{ start: '09:00', end: '18:00' }] },
  { dayOfWeek: 5, isOpen: true, slots: [{ start: '09:00', end: '18:00' }] },
  { dayOfWeek: 6, isOpen: false, slots: [] },
];

function dayEquals(a: DaySchedule, b: DaySchedule): boolean {
  return a.isOpen === b.isOpen && JSON.stringify(a.slots) === JSON.stringify(b.slots);
}

function scheduleReducer(state: ScheduleState, action: ScheduleAction): ScheduleState {
  switch (action.type) {
    case 'LOAD': {
      return {
        ...state,
        original: action.schedule,
        current: action.schedule.map((d) => ({ ...d, slots: [...d.slots] })),
      };
    }
    case 'UPDATE_DAY': {
      const newCurrent = state.current.map((day) =>
        day.dayOfWeek === action.dayOfWeek
          ? { ...day, isOpen: action.isOpen, slots: action.slots }
          : day
      );
      return { ...state, current: newCurrent };
    }
    case 'COPY_TO': {
      const sourceDay = state.current.find((d) => d.dayOfWeek === action.sourceDayOfWeek);
      if (!sourceDay) return state;
      const newCurrent = state.current.map((day) =>
        action.targetDays.includes(day.dayOfWeek)
          ? { ...day, isOpen: sourceDay.isOpen, slots: [...sourceDay.slots] }
          : day
      );
      return { ...state, current: newCurrent };
    }
    case 'APPLY_TEMPLATE': {
      return {
        ...state,
        current: action.schedule.map((d) => ({ ...d, slots: [...d.slots] })),
      };
    }
    case 'RESET': {
      return {
        ...state,
        current: state.original.map((d) => ({ ...d, slots: [...d.slots] })),
      };
    }
    case 'SAVE_START': {
      return { ...state, saving: true };
    }
    case 'SAVE_SUCCESS': {
      return {
        ...state,
        saving: false,
        original: state.current.map((d) => ({ ...d, slots: [...d.slots] })),
      };
    }
    case 'SAVE_ERROR': {
      return { ...state, saving: false };
    }
    default:
      return state;
  }
}

export function useScheduleReducer() {
  const [state, dispatch] = useReducer(scheduleReducer, {
    original: DEFAULT_SCHEDULE,
    current: DEFAULT_SCHEDULE.map((d) => ({ ...d, slots: [...d.slots] })),
    saving: false,
  });

  const isDirty = useMemo(
    () => state.current.some((day, i) => !dayEquals(day, state.original[i])),
    [state.current, state.original]
  );

  const dirtyDays = useMemo(
    () =>
      new Set(
        state.current
          .filter((day, i) => !dayEquals(day, state.original[i]))
          .map((d) => d.dayOfWeek)
      ),
    [state.current, state.original]
  );

  const dirtyCount = dirtyDays.size;

  // Warn on navigation away with unsaved changes
  useEffect(() => {
    if (!isDirty) return;
    const handler = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = '';
    };
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, [isDirty]);

  // Ordered schedule: Monday to Sunday (1,2,3,4,5,6,0)
  const orderedSchedule = useMemo(() => [
    state.current[1], // Monday
    state.current[2], // Tuesday
    state.current[3], // Wednesday
    state.current[4], // Thursday
    state.current[5], // Friday
    state.current[6], // Saturday
    state.current[0], // Sunday
  ], [state.current]);

  const load = useCallback((schedule: DaySchedule[]) => dispatch({ type: 'LOAD', schedule }), []);
  const updateDay = useCallback(
    (dayOfWeek: number, isOpen: boolean, slots: TimeSlot[]) =>
      dispatch({ type: 'UPDATE_DAY', dayOfWeek, isOpen, slots }),
    []
  );
  const copyTo = useCallback(
    (sourceDayOfWeek: number, targetDays: number[]) =>
      dispatch({ type: 'COPY_TO', sourceDayOfWeek, targetDays }),
    []
  );
  const applyTemplate = useCallback(
    (schedule: DaySchedule[]) => dispatch({ type: 'APPLY_TEMPLATE', schedule }),
    []
  );
  const reset = useCallback(() => dispatch({ type: 'RESET' }), []);
  const saveStart = useCallback(() => dispatch({ type: 'SAVE_START' }), []);
  const saveSuccess = useCallback(() => dispatch({ type: 'SAVE_SUCCESS' }), []);
  const saveError = useCallback(() => dispatch({ type: 'SAVE_ERROR' }), []);

  return {
    schedule: state.current,
    orderedSchedule,
    saving: state.saving,
    isDirty,
    dirtyDays,
    dirtyCount,
    load,
    updateDay,
    copyTo,
    applyTemplate,
    reset,
    saveStart,
    saveSuccess,
    saveError,
  };
}
