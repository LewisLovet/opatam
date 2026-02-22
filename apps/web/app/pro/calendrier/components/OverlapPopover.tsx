'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { Clock, User, Tag } from 'lucide-react';
import type { Booking } from '@booking-app/shared';
import { getVisualStatus } from './SlotPopover';

type WithId<T> = { id: string } & T;

interface OverlapPopoverProps {
  bookings: WithId<Booking>[];
  anchorRect: DOMRect;
  onSelect: (booking: WithId<Booking>) => void;
  onClose: () => void;
}

const statusLabels: Record<string, string> = {
  past: 'Passé',
  ongoing: 'En cours',
  confirmed: 'Confirmé',
  pending: 'En attente',
  cancelled: 'Annulé',
  noshow: 'Absent',
};

const statusDotColors: Record<string, string> = {
  past: 'bg-gray-400',
  ongoing: 'bg-primary-500',
  confirmed: 'bg-success-500',
  pending: 'bg-warning-500',
  cancelled: 'bg-error-400',
  noshow: 'bg-error-500',
};

export function OverlapPopover({
  bookings,
  anchorRect,
  onSelect,
  onClose,
}: OverlapPopoverProps) {
  const popoverRef = useRef<HTMLDivElement>(null);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  // Close on click outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (popoverRef.current && !popoverRef.current.contains(e.target as Node)) {
        onClose();
      }
    };
    // Defer to avoid catching the same click that opened the popover
    const timer = setTimeout(() => {
      document.addEventListener('mousedown', handleClickOutside);
    }, 0);
    return () => {
      clearTimeout(timer);
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [onClose]);

  // Close on Escape
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  if (!mounted) return null;

  // Position: to the right of the anchor, or left if near right edge
  const popoverWidth = 260;
  const padding = 8;
  let left = anchorRect.right + padding;
  let top = anchorRect.top;

  if (left + popoverWidth > window.innerWidth - padding) {
    left = anchorRect.left - popoverWidth - padding;
  }
  if (top + 200 > window.innerHeight - padding) {
    top = window.innerHeight - padding - 200;
  }
  if (top < padding) {
    top = padding;
  }

  const formatTime = (date: Date | string) =>
    new Date(date).toLocaleTimeString('fr-FR', {
      hour: '2-digit',
      minute: '2-digit',
    });

  // Sort by start time
  const sorted = [...bookings].sort(
    (a, b) => new Date(a.datetime).getTime() - new Date(b.datetime).getTime()
  );

  return createPortal(
    <div
      ref={popoverRef}
      className="fixed z-[9999] bg-white dark:bg-gray-800 rounded-xl shadow-xl border border-gray-200 dark:border-gray-700 overflow-hidden"
      style={{ top, left, width: popoverWidth, maxHeight: 300 }}
      role="listbox"
      aria-label="Choisir un rendez-vous"
    >
      {/* Header */}
      <div className="px-3 py-2 border-b border-gray-100 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/80">
        <p className="text-xs font-semibold text-gray-600 dark:text-gray-300">
          {sorted.length} rendez-vous superposés
        </p>
      </div>

      {/* Booking list */}
      <div className="overflow-y-auto" style={{ maxHeight: 250 }}>
        {sorted.map((booking) => {
          const status = getVisualStatus(booking);
          return (
            <button
              key={booking.id}
              onClick={() => onSelect(booking)}
              className="w-full text-left px-3 py-2.5 hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors border-b border-gray-50 dark:border-gray-700/50 last:border-b-0"
              role="option"
            >
              <div className="flex items-center gap-2">
                {/* Member color dot */}
                {booking.memberColor && (
                  <span
                    className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                    style={{ backgroundColor: booking.memberColor }}
                  />
                )}

                {/* Time */}
                <span className="text-xs font-medium text-gray-700 dark:text-gray-200 flex items-center gap-1 flex-shrink-0">
                  <Clock className="w-3 h-3" />
                  {formatTime(booking.datetime)}
                </span>

                {/* Status dot */}
                <span
                  className={`w-2 h-2 rounded-full flex-shrink-0 ${statusDotColors[status] || 'bg-gray-400'}`}
                  title={statusLabels[status]}
                />
              </div>

              <div className="mt-1 flex items-center gap-1.5 text-xs text-gray-600 dark:text-gray-300">
                <User className="w-3 h-3 flex-shrink-0" />
                <span className="truncate font-medium">{booking.clientInfo.name}</span>
                <span className="text-gray-400 dark:text-gray-500 mx-0.5">·</span>
                <span className="truncate text-gray-500 dark:text-gray-400">{booking.serviceName}</span>
              </div>

              {/* Member name */}
              {booking.memberName && (
                <div className="mt-0.5 text-xs text-gray-400 dark:text-gray-500 truncate">
                  {booking.memberName}
                </div>
              )}
            </button>
          );
        })}
      </div>
    </div>,
    document.body
  );
}
