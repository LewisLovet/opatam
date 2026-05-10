/**
 * Activity category metadata
 *
 * Single source of truth for the visual presentation of personal
 * activities (sport, meeting, perso, admin, voyage, imprévu,
 * autre): label, brand colour, Ionicons glyph. Both the create
 * sheet and the Planning list pull from here so the same activity
 * always looks the same regardless of where it shows up.
 *
 * The keys come from ActivityCategory (packages/shared) — TS will
 * flag any missing entry if a new category is added there.
 */

import type { ComponentProps } from 'react';
import type { Ionicons } from '@expo/vector-icons';
import type { ActivityCategory } from '@booking-app/shared';

type IoniconsName = ComponentProps<typeof Ionicons>['name'];

export interface ActivityCategoryMeta {
  label: string;
  color: string;
  icon: IoniconsName;
}

export const ACTIVITY_CATEGORY_META: Record<
  ActivityCategory,
  ActivityCategoryMeta
> = {
  // Paid off-platform work — emerald colour (~"earnings green")
  // intentionally distinct from the rest of the palette so it
  // reads as "money in" at a glance on the calendar and stats.
  prestation: { label: 'Prestation', color: '#10b981', icon: 'briefcase-outline' },
  sport:      { label: 'Sport',      color: '#f97316', icon: 'fitness-outline' },
  meeting:    { label: 'Meeting',    color: '#8b5cf6', icon: 'people-outline' },
  personal:   { label: 'Perso',      color: '#ec4899', icon: 'heart-outline' },
  admin:      { label: 'Admin',      color: '#facc15', icon: 'document-text-outline' },
  travel:     { label: 'Trajet',     color: '#06b6d4', icon: 'airplane-outline' },
  imprevu:    { label: 'Imprévu',    color: '#ef4444', icon: 'flash-outline' },
  other:      { label: 'Autre',      color: '#6b7280', icon: 'ellipsis-horizontal' },
};

/**
 * Stable iteration order for UI lists (chip strips, sheets…). The
 * Record above is keyed but JS object iteration order isn't worth
 * relying on for UX, so we expose an explicit array.
 *
 * `prestation` sits first because it's the most likely reason a
 * pro logs an activity with an amount — surfacing it as the
 * default tap target reduces the chance of mis-categorising paid
 * work as "Autre" or "Meeting".
 */
export const ACTIVITY_CATEGORY_ORDER: ActivityCategory[] = [
  'prestation',
  'sport',
  'meeting',
  'personal',
  'admin',
  'travel',
  'imprevu',
  'other',
];
