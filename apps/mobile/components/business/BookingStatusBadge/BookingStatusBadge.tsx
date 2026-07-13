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
import { useTranslation } from 'react-i18next';
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

const statusConfig: Record<string, { labelKey: string; variant: BadgeVariant }> = {
  pending_payment: { labelKey: 'components.bookingStatusBadge.pendingPayment', variant: 'warning' },
  pending: { labelKey: 'components.bookingStatusBadge.pending', variant: 'warning' },
  confirmed: { labelKey: 'components.bookingStatusBadge.confirmed', variant: 'success' },
  cancelled: { labelKey: 'components.bookingStatusBadge.cancelled', variant: 'neutral' },
  noshow: { labelKey: 'components.bookingStatusBadge.noshow', variant: 'error' },
};

const FALLBACK = {
  labelKey: 'components.bookingStatusBadge.unknown',
  variant: 'neutral' as BadgeVariant,
};

export function BookingStatusBadge({ status, size = 'md' }: BookingStatusBadgeProps) {
  const { t } = useTranslation();
  const config = statusConfig[status] ?? FALLBACK;

  return (
    <Badge variant={config.variant} size={size} label={t(config.labelKey)} />
  );
}
