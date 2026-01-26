/**
 * BookingStatusBadge Component
 * Displays booking status with appropriate color coding
 */

import React from 'react';
import { Badge } from '../../Badge';

export type BookingStatus = 'pending' | 'confirmed' | 'cancelled' | 'noshow';

export interface BookingStatusBadgeProps {
  /** Booking status */
  status: BookingStatus;
  /** Badge size */
  size?: 'sm' | 'md';
}

const statusConfig: Record<BookingStatus, { label: string; variant: 'warning' | 'success' | 'neutral' | 'error' }> = {
  pending: { label: 'En attente', variant: 'warning' },
  confirmed: { label: 'Confirmé', variant: 'success' },
  cancelled: { label: 'Annulé', variant: 'neutral' },
  noshow: { label: 'Absent', variant: 'error' },
};

export function BookingStatusBadge({ status, size = 'md' }: BookingStatusBadgeProps) {
  const config = statusConfig[status];

  return (
    <Badge variant={config.variant} size={size} label={config.label} />
  );
}
