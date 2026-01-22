'use client';

import { MoreVertical, Check, X, UserX, CheckCircle, Mail, Phone, Clock, Euro } from 'lucide-react';
import { useState, useRef, useEffect } from 'react';
import type { Booking, Member } from '@booking-app/shared';
import { statusConfig, formatBookingDate, formatBookingTime, formatBookingPrice, formatDuration } from '@/lib/booking-utils';

type WithId<T> = { id: string } & T;

interface BookingRowProps {
  booking: WithId<Booking>;
  members: WithId<Member>[];
  isTeamPlan: boolean;
  onView: (booking: WithId<Booking>) => void;
  onConfirm: (booking: WithId<Booking>) => void;
  onCancel: (booking: WithId<Booking>) => void;
  onComplete: (booking: WithId<Booking>) => void;
  onNoShow: (booking: WithId<Booking>) => void;
}

export function BookingRow({
  booking,
  members,
  isTeamPlan,
  onView,
  onConfirm,
  onCancel,
  onComplete,
  onNoShow,
}: BookingRowProps) {
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
    <tr
      className={`
        group cursor-pointer transition-all duration-200
        hover:bg-primary-50/50 dark:hover:bg-primary-900/10
        ${isPast && !isToday ? 'opacity-70' : ''}
        ${isToday ? 'bg-primary-50/30 dark:bg-primary-900/5' : ''}
      `}
      onClick={() => onView(booking)}
    >
      {/* Client */}
      <td className="px-4 py-4">
        <div className="flex items-center gap-3">
          {/* Avatar initials */}
          <div className="flex-shrink-0 w-10 h-10 rounded-full bg-gradient-to-br from-primary-100 to-primary-200 dark:from-primary-900/50 dark:to-primary-800/50 flex items-center justify-center">
            <span className="text-sm font-semibold text-primary-700 dark:text-primary-300">
              {booking.clientInfo.name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)}
            </span>
          </div>
          <div className="min-w-0">
            <p className="font-semibold text-gray-900 dark:text-white truncate">
              {booking.clientInfo.name}
            </p>
            <div className="flex items-center gap-3 mt-0.5">
              <span className="flex items-center gap-1 text-xs text-gray-500 dark:text-gray-400">
                <Mail className="w-3 h-3" />
                <span className="truncate max-w-[150px]">{booking.clientInfo.email}</span>
              </span>
              {booking.clientInfo.phone && (
                <span className="flex items-center gap-1 text-xs text-gray-500 dark:text-gray-400">
                  <Phone className="w-3 h-3" />
                  {booking.clientInfo.phone}
                </span>
              )}
            </div>
          </div>
        </div>
      </td>

      {/* Service */}
      <td className="px-4 py-4">
        <div>
          <p className="font-medium text-gray-900 dark:text-white">{booking.serviceName}</p>
          <div className="flex items-center gap-3 mt-0.5">
            <span className="flex items-center gap-1 text-xs text-gray-500 dark:text-gray-400">
              <Clock className="w-3 h-3" />
              {formatDuration(booking.duration)}
            </span>
            <span className="flex items-center gap-1 text-xs font-medium text-gray-600 dark:text-gray-300">
              <Euro className="w-3 h-3" />
              {formatBookingPrice(booking.price).replace('€', '').trim()}
            </span>
          </div>
        </div>
      </td>

      {/* Date/Time */}
      <td className="px-4 py-4">
        <div className="flex items-center gap-2">
          {/* Date indicator */}
          <div className={`
            flex-shrink-0 w-12 h-12 rounded-lg flex flex-col items-center justify-center
            ${isToday 
              ? 'bg-primary-100 dark:bg-primary-900/30 text-primary-700 dark:text-primary-300' 
              : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300'
            }
          `}>
            <span className="text-xs uppercase font-medium">
              {bookingDate.toLocaleDateString('fr-FR', { weekday: 'short' }).slice(0, 3)}
            </span>
            <span className="text-lg font-bold leading-tight">
              {bookingDate.getDate()}
            </span>
          </div>
          <div>
            <p className="font-medium text-gray-900 dark:text-white">
              {bookingDate.toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' })}
            </p>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              {formatBookingTime(bookingDate)}
            </p>
          </div>
        </div>
      </td>

      {/* Member (Team plan only) */}
      {isTeamPlan && (
        <td className="px-4 py-4">
          {member ? (
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-full bg-gray-100 dark:bg-gray-700 flex items-center justify-center">
                <span className="text-xs font-medium text-gray-600 dark:text-gray-300">
                  {member.name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)}
                </span>
              </div>
              <span className="text-sm text-gray-700 dark:text-gray-300">{member.name}</span>
            </div>
          ) : (
            <span className="text-sm text-gray-400 dark:text-gray-500">-</span>
          )}
        </td>
      )}

      {/* Status */}
      <td className="px-4 py-4">
        <span
          className={`
            inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium rounded-full
            ${status.bgColor} ${status.color}
          `}
        >
          <span className={`w-1.5 h-1.5 rounded-full ${status.dotColor || 'bg-current'}`} />
          {status.label}
        </span>
      </td>

      {/* Actions */}
      <td className="px-4 py-4">
        <div className="relative" ref={menuRef}>
          <button
            onClick={(e) => {
              e.stopPropagation();
              setMenuOpen(!menuOpen);
            }}
            className={`
              p-2 rounded-lg transition-all duration-200
              ${menuOpen 
                ? 'bg-gray-100 dark:bg-gray-700 text-gray-900 dark:text-white' 
                : 'text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 opacity-0 group-hover:opacity-100'
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
                  className="w-full flex items-center gap-2.5 px-4 py-2.5 text-sm text-left text-success-600 dark:text-success-400 hover:bg-success-50 dark:hover:bg-success-900/20 transition-colors"
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
                  className="w-full flex items-center gap-2.5 px-4 py-2.5 text-sm text-left text-primary-600 dark:text-primary-400 hover:bg-primary-50 dark:hover:bg-primary-900/20 transition-colors"
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
                  className="w-full flex items-center gap-2.5 px-4 py-2.5 text-sm text-left text-warning-600 dark:text-warning-400 hover:bg-warning-50 dark:hover:bg-warning-900/20 transition-colors"
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
                  className="w-full flex items-center gap-2.5 px-4 py-2.5 text-sm text-left text-error-600 dark:text-error-400 hover:bg-error-50 dark:hover:bg-error-900/20 transition-colors"
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
      </td>
    </tr>
  );
}
