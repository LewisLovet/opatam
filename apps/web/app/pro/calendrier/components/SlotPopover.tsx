'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import type { Booking } from '@booking-app/shared';

type WithId<T> = { id: string } & T;

interface SlotTooltipProps {
  booking: WithId<Booking>;
  children: React.ReactNode;
  disabled?: boolean;
}

/**
 * Determines the visual status of a booking based on time and booking status
 */
export type VisualStatus = 'past' | 'ongoing' | 'confirmed' | 'pending' | 'cancelled' | 'noshow';

export function getVisualStatus(booking: Booking): VisualStatus {
  const now = new Date();
  const startTime = new Date(booking.datetime);
  const endTime = new Date(booking.endDatetime);

  // Priority 1: Cancelled
  if (booking.status === 'cancelled') return 'cancelled';

  // Priority 2: No-show
  if (booking.status === 'noshow') return 'noshow';

  // Priority 3: Ongoing (current time is between start and end)
  if (now >= startTime && now <= endTime) return 'ongoing';

  // Priority 4: Past (end time has passed)
  if (now > endTime) return 'past';

  // Priority 5: Pending
  if (booking.status === 'pending') return 'pending';

  // Default: Confirmed future booking
  return 'confirmed';
}

export function isPastBooking(booking: Booking): boolean {
  const status = getVisualStatus(booking);
  return status === 'past' || status === 'cancelled' || status === 'noshow';
}

/**
 * Format price from cents to euros
 */
function formatPrice(cents: number): string {
  return new Intl.NumberFormat('fr-FR', {
    style: 'currency',
    currency: 'EUR',
  }).format(cents / 100);
}

interface TooltipPosition {
  top: number;
  left: number;
}

// Delay before showing tooltip (in ms) - instant for fast feedback
const TOOLTIP_DELAY = 100;

/**
 * Simple tooltip component that shows booking details on hover
 * Uses portal to avoid positioning issues with overflow containers
 */
export function SlotPopover({
  booking,
  children,
  disabled = false,
}: SlotTooltipProps) {
  const [isVisible, setIsVisible] = useState(false);
  const [position, setPosition] = useState<TooltipPosition | null>(null);
  const [mounted, setMounted] = useState(false);
  const triggerRef = useRef<HTMLSpanElement>(null);
  const tooltipRef = useRef<HTMLDivElement>(null);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    setMounted(true);
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, []);

  const updatePosition = useCallback(() => {
    if (!triggerRef.current) return;

    const rect = triggerRef.current.getBoundingClientRect();
    const tooltipWidth = 200; // max-w-[200px]
    const tooltipHeight = 80; // approximate height
    const padding = 8;

    // Default: position to the right
    let left = rect.right + padding;
    let top = rect.top + rect.height / 2;

    // Check if tooltip would go off the right edge of the screen
    if (left + tooltipWidth > window.innerWidth - padding) {
      // Position to the left instead
      left = rect.left - tooltipWidth - padding;
    }

    // Check if tooltip would go off the top of the screen
    if (top - tooltipHeight / 2 < padding) {
      top = padding + tooltipHeight / 2;
    }

    // Check if tooltip would go off the bottom of the screen
    if (top + tooltipHeight / 2 > window.innerHeight - padding) {
      top = window.innerHeight - padding - tooltipHeight / 2;
    }

    setPosition({ top, left });
  }, []);

  const handleMouseEnter = useCallback(() => {
    updatePosition();
    // Show tooltip after a short delay
    timeoutRef.current = setTimeout(() => {
      setIsVisible(true);
    }, TOOLTIP_DELAY);
  }, [updatePosition]);

  const handleMouseLeave = useCallback(() => {
    // Clear any pending timeout
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
    setIsVisible(false);
  }, []);

  if (disabled) {
    return <>{children}</>;
  }

  const showTooltip = isVisible && position && mounted;
  const isPositionedLeft = position && triggerRef.current &&
    position.left < triggerRef.current.getBoundingClientRect().left;

  return (
    <>
      <span
        ref={triggerRef}
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
        className="contents"
      >
        {children}
      </span>
      {showTooltip && createPortal(
        <div
          ref={tooltipRef}
          className="fixed z-[9999] px-3 py-2 bg-gray-900 dark:bg-gray-700 text-white text-sm rounded-lg shadow-lg max-w-[200px] pointer-events-none"
          style={{
            top: position.top,
            left: position.left,
            transform: 'translateY(-50%)',
          }}
          role="tooltip"
        >
          <p className="font-medium truncate">{booking.serviceName}</p>
          {booking.price > 0 && (
            <p className="text-emerald-400 font-semibold">{formatPrice(booking.price)}</p>
          )}
          {booking.price === 0 && (
            <p className="text-emerald-400 font-semibold">Gratuit</p>
          )}
          {booking.clientInfo.phone && (
            <p className="text-gray-300 dark:text-gray-400 text-xs">{booking.clientInfo.phone}</p>
          )}
          {/* Arrow */}
          <div
            className={`absolute top-1/2 -translate-y-1/2 border-8 border-transparent ${
              isPositionedLeft
                ? 'left-full border-l-gray-900 dark:border-l-gray-700'
                : 'right-full border-r-gray-900 dark:border-r-gray-700'
            }`}
          />
        </div>,
        document.body
      )}
    </>
  );
}

/**
 * Status badge component - kept for use in BookingBlock
 */
export function StatusBadge({ status }: { status: VisualStatus }) {
  const config: Record<VisualStatus, { label: string; className: string }> = {
    past: {
      label: 'Passe',
      className: 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-400',
    },
    ongoing: {
      label: 'En cours',
      className: 'bg-primary-100 text-primary-700 dark:bg-primary-900/30 dark:text-primary-300',
    },
    confirmed: {
      label: 'Confirme',
      className: 'bg-success-100 text-success-700 dark:bg-success-900/30 dark:text-success-300',
    },
    pending: {
      label: 'En attente',
      className: 'bg-warning-100 text-warning-700 dark:bg-warning-900/30 dark:text-warning-300',
    },
    cancelled: {
      label: 'Annule',
      className: 'bg-error-100 text-error-700 dark:bg-error-900/30 dark:text-error-300',
    },
    noshow: {
      label: 'Absent',
      className: 'bg-error-100 text-error-700 dark:bg-error-900/30 dark:text-error-300',
    },
  };

  const { label, className } = config[status];

  return (
    <span className={`ml-auto text-xs font-medium px-2 py-0.5 rounded-full ${className}`}>
      {label}
    </span>
  );
}
