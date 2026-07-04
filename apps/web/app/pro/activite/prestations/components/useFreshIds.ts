'use client';

import { useRef } from 'react';

/**
 * Tells apart items added during this editing session from those present at
 * mount, so freshly added cards can animate in (pop-in) without replaying the
 * animation on every card when the section first renders.
 */
export function useFreshIds(ids: string[]): (id: string) => boolean {
  const initial = useRef<Set<string> | null>(null);
  if (initial.current === null) initial.current = new Set(ids);
  return (id: string) => !initial.current!.has(id);
}
