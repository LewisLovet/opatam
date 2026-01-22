'use client';

import { MoreVertical, Check, X, UserX, CheckCircle, Calendar, Clock, User, Mail, Phone, Euro } from 'lucide-react';
import { useState, useRef, useEffect } from 'react';
import type { Booking, Member } from '@booking-app/shared';
import { statusConfig, formatBookingDate, formatBookingTime, formatBookingPrice, formatDuration } from '@/lib/booking-utils';

type WithId<T> = { id: string } & T;

interface BookingCardProps {
  booking: WithId<Booking>;
  members: WithId<Member>[];
  isTeamPlan: boolean;
  onView: (booking: WithId<Booking>) => void;
  onConfirm: (booking: WithId<Booking>) => void;
  onCancel: (booking: WithId<Booking>) => void;
  onComplete: (booking: WithId<Booking>) => void;
  onNoShow: (booking: WithId<Booking>) => void;
}

export function BookingCard({
  booking,
  members,
  isTeamPlan,
  onView,
  onConfirm,
  onCancel,
  onComplete,
  onNoShow,
}: BookingCardProps) {
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  // Close menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setMenuOpen(false);
      }
    };

    if (menuOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [menuOpen]);

  const bookingDate = new Date(booking.datetime);
  const status = statusConfig[booking.status];
  const member = members.find((m) => m.id === booking.memberId);

  const canConfirm = booking.status === 'pending';
  const canCancel = booking.status === 'pending' || booking.status === 'confirmed';
  const canComplete = booking.status === 'confirmed';
  const canNoShow = booking.status === 'confirmed';

  // Determine if this is a past or future booking
  const isPast = bookingDate < new Date();
  const isToday = bookingDate.toDateString() === new Date().toDateString();

  return (
    <div
      className={`
        bg-white dark:bg-gray-800 rounded-xl border overflow-hidden
        cursor-pointer transition-all duration-200
        hover:shadow-md hover:border-primary-300 dark:hover:border-primary-700
        ${isToday 
          ? 'border-primary-200 dark:border-primary-800 ring-1 ring-primary-100 dark:ring-primary-900/30' 
          : 'border-gray-200 dark:border-gray-700'
        }
        ${isPast && !isToday ? 'opacity-75' : ''}
      `}
      onClick={() => onView(booking)}
    >
      {/* Header with date badge and status */}
      <div className={`
        flex items-center justify-between px-4 py-3
        ${isToday 
          ? 'bg-primary-50/50 dark:bg-primary-900/10' 
          : 'bg-gray-50/50 dark:bg-gray-800/50'
        }
      `}>
        {/* Date badge */}
        <div className="flex items-center gap-3">
          <div className={`
            flex flex-col items-center justify-center w-12 h-12 rounded-lg
            ${isToday 
              ? 'bg-primary-100 dark:bg-primary-900/40 text-primary-700 dark:text-primary-300' 
              : 'bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-300 border border-gray-200 dark:border-gray-600'
            }
          `}>
            <span className="text-[10px] uppercase font-semibold tracking-wide">
              {bookingDate.toLocaleDateString('fr-FR', { weekday: 'short' }).slice(0, 3)}
            </span>
            <span className="text-lg font-bold leading-tight">
              {bookingDate.getDate()}
            </span>
          </div>
          <div>
            <p className="text-sm font-medium text-gray-900 dark:text-white">
              {bookingDate.toLocaleDateString('fr-FR', { month: 'long' })}
            </p>
            <p className="text-sm text-primary-600 dark:text-primary-400 font-semibold">
              {formatBookingTime(bookingDate)}
            </p>
          </div>
        </div>

        {/* Status + Actions */}
        <div className="flex items-center gap-2">
          <span
            className={`
              inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium rounded-full
              ${status.bgColor} ${status.color}
            `}
          >
            <span className={`w-1.5 h-1.5 rounded-full ${status.dotColor || 'bg-current'}`} />
            {status.label}
          </span>

          <div className="relative" ref={menuRef}>
            <button
              onClick={(e) => {
                e.stopPropagation();
                setMenuOpen(!menuOpen);
              }}
              className={`
                p-1.5 rounded-lg transition-colors
                ${menuOpen 
                  ? 'bg-gray-200 dark:bg-gray-600 text-gray-900 dark:text-white' 
                  : 'text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700'
                }
              `}
            >
              <MoreVertical className="w-4 h-4" />
            </button>

            {menuOpen && (
              <div className="absolute right-0 top-full mt-1 w-48 bg-white dark:bg-gray-800 rounded-xl shadow-lg border border-gray-200 dark:border-gray-700 py-1 z-20 overflow-hidden">
                {canConfirm && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onConfirm(booking);
                      setMenuOpen(false);
                    }}
                    className="w-full flex items-center gap-2.5 px-4 py-2.5 text-sm text-left text-success-600 dark:text-success-400 hover:bg-success-50 dark:hover:bg-success-900/20"
                  >
                    <Check className="w-4 h-4" />
                    Confirmer
                  </button>
                )}

                {canComplete && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onComplete(booking);
                      setMenuOpen(false);
                    }}
                    className="w-full flex items-center gap-2.5 px-4 py-2.5 text-sm text-left text-primary-600 dark:text-primary-400 hover:bg-primary-50 dark:hover:bg-primary-900/20"
                  >
                    <CheckCircle className="w-4 h-4" />
                    Marquer terminé
                  </button>
                )}

                {canNoShow && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onNoShow(booking);
                      setMenuOpen(false);
                    }}
                    className="w-full flex items-center gap-2.5 px-4 py-2.5 text-sm text-left text-warning-600 dark:text-warning-400 hover:bg-warning-50 dark:hover:bg-warning-900/20"
                  >
                    <UserX className="w-4 h-4" />
                    Marquer absent
                  </button>
                )}

                {(canConfirm || canComplete || canNoShow) && canCancel && (
                  <div className="my-1 border-t border-gray-100 dark:border-gray-700" />
                )}

                {canCancel && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onCancel(booking);
                      setMenuOpen(false);
                    }}
                    className="w-full flex items-center gap-2.5 px-4 py-2.5 text-sm text-left text-error-600 dark:text-error-400 hover:bg-error-50 dark:hover:bg-error-900/20"
                  >
                    <X className="w-4 h-4" />
                    Annuler
                  </button>
                )}

                {!canConfirm && !canCancel && !canComplete && !canNoShow && (
                  <p className="px-4 py-2.5 text-sm text-gray-500 dark:text-gray-400">
                    Aucune action disponible
                  </p>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="p-4 space-y-3">
        {/* Client info */}
        <div className="flex items-start gap-3">
          <div className="flex-shrink-0 w-10 h-10 rounded-full bg-gradient-to-br from-primary-100 to-primary-200 dark:from-primary-900/50 dark:to-primary-800/50 flex items-center justify-center">
            <span className="text-sm font-semibold text-primary-700 dark:text-primary-300">
              {booking.clientInfo.name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)}
            </span>
          </div>
          <div className="min-w-0 flex-1">
            <p className="font-semibold text-gray-900 dark:text-white">
              {booking.clientInfo.name}
            </p>
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-0.5">
              <span className="flex items-center gap-1 text-xs text-gray-500 dark:text-gray-400">
                <Mail className="w-3 h-3 flex-shrink-0" />
                <span className="truncate">{booking.clientInfo.email}</span>
              </span>
              {booking.clientInfo.phone && (
                <span className="flex items-center gap-1 text-xs text-gray-500 dark:text-gray-400">
                  <Phone className="w-3 h-3 flex-shrink-0" />
                  {booking.clientInfo.phone}
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Divider */}
        <div className="border-t border-gray-100 dark:border-gray-700" />

        {/* Service info */}
        <div className="flex items-center justify-between">
          <div>
            <p className="font-medium text-gray-900 dark:text-white">{booking.serviceName}</p>
            <div className="flex items-center gap-3 mt-0.5">
              <span className="flex items-center gap-1 text-xs text-gray-500 dark:text-gray-400">
                <Clock className="w-3 h-3" />
                {formatDuration(booking.duration)}
              </span>
              {isTeamPlan && member && (
                <span className="flex items-center gap-1 text-xs text-gray-500 dark:text-gray-400">
                  <User className="w-3 h-3" />
                  {member.name}
                </span>
              )}
            </div>
          </div>
          <div className="flex items-center gap-1 text-lg font-bold text-gray-900 dark:text-white">
            {formatBookingPrice(booking.price)}
          </div>
        </div>
      </div>
    </div>
  );
}
