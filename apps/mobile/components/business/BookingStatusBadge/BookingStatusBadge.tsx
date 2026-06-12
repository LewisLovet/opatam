/**
 * BookingStatusBadge Component
 * Displays booking status with appropriate color coding.
 *
 * Accepts ANY booking status string and falls back to a neutral badge
 * for unknown values — an unmapped status must never crash the list
 * that renders it. `pending_payment` (deposit awaiting payment) used
 * to be missing from this map and crashed the whole Planning tab.
 */

import React from 'react';
import { Badge } from '../../Badge';
import type { BookingStatus as SharedBookingStatus } from '@booking-app/shared';

export type BookingStatus = SharedBookingStatus;

export interface BookingStatusBadgeProps {
  /** Booking status */
  status: BookingStatus | string;
  /** Badge size */
  size?: 'sm' | 'md';
}

type BadgeVariant = 'warning' | 'success' | 'neutral' | 'error';

const statusConfig: Record<string, { label: string; variant: BadgeVariant }> = {
  pending_payment: { label: 'Acompte en attente', variant: 'warning' },
  pending: { label: 'En attente', variant: 'warning' },
  confirmed: { label: 'Confirmé', variant: 'success' },
  cancelled: { label: 'Annulé', variant: 'neutral' },
  noshow: { label: 'Absent', variant: 'error' },
};

const FALLBACK = { label: 'Statut inconnu', variant: 'neutral' as BadgeVariant };

export function BookingStatusBadge({ status, size = 'md' }: BookingStatusBadgeProps) {
  const config = statusConfig[status] ?? FALLBACK;

  return (
    <Badge variant={config.variant} size={size} label={config.label} />
  );
}
