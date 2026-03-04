'use client';

import { useEffect, useState, useCallback } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/contexts/AuthContext';
import { adminBookingService } from '@/services/admin/adminBookingService';
import type { BookingDetail } from '@/services/admin/types';
import { statusConfig } from '@/lib/booking-utils';
import { Loader } from '@/components/ui';
import { ArrowLeft, Calendar, Clock, CreditCard, User, Briefcase } from 'lucide-react';
import type { BookingStatus } from '@booking-app/shared';

// Status transitions: which statuses can move to which
const STATUS_TRANSITIONS: Record<BookingStatus, BookingStatus[]> = {
  pending: ['confirmed', 'cancelled'],
  confirmed: ['cancelled', 'noshow'],
  cancelled: [],
  noshow: [],
};

const ACTION_LABELS: Record<BookingStatus, string> = {
  pending: 'En attente',
  confirmed: 'Confirmer',
  cancelled: 'Annuler',
  noshow: 'Marquer absent',
};

const ACTION_COLORS: Record<BookingStatus, string> = {
  pending: 'bg-yellow-500 hover:bg-yellow-600 text-white',
  confirmed: 'bg-emerald-500 hover:bg-emerald-600 text-white',
  cancelled: 'bg-red-500 hover:bg-red-600 text-white',
  noshow: 'bg-orange-500 hover:bg-orange-600 text-white',
};

const CONFIRM_MESSAGES: Record<BookingStatus, string> = {
  pending: '',
  confirmed: 'Voulez-vous confirmer cette r\u00e9servation ?',
  cancelled: 'Voulez-vous annuler cette r\u00e9servation ?',
  noshow: 'Voulez-vous marquer ce client comme absent ?',
};

function formatDate(iso: Date | string | null): string {
  if (!iso) return '-';
  return new Date(iso).toLocaleDateString('fr-FR', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
}

function formatTime(iso: Date | string | null): string {
  if (!iso) return '-';
  return new Date(iso).toLocaleTimeString('fr-FR', {
    hour: '2-digit',
    minute: '2-digit',
  });
}

function formatPrice(price: number): string {
  return new Intl.NumberFormat('fr-FR', {
    style: 'currency',
    currency: 'EUR',
  }).format(price / 100);
}

export default function AdminBookingDetailPage() {
  const { bookingId } = useParams<{ bookingId: string }>();
  const { user } = useAuth();
  const [data, setData] = useState<BookingDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState(false);

  const loadBooking = useCallback(async () => {
    if (!user?.id || !bookingId) return;
    setLoading(true);
    try {
      const detail = await adminBookingService.getBookingDetail(user.id, bookingId);
      setData(detail);
    } catch (err) {
      console.error('Error loading booking:', err);
    } finally {
      setLoading(false);
    }
  }, [user?.id, bookingId]);

  useEffect(() => {
    loadBooking();
  }, [loadBooking]);

  const handleStatusChange = async (newStatus: BookingStatus) => {
    if (!user?.id || !bookingId || !data) return;

    const message = CONFIRM_MESSAGES[newStatus];
    if (message && !window.confirm(message)) return;

    setUpdating(true);
    try {
      await adminBookingService.updateBookingStatus(user.id, bookingId, newStatus);
      await loadBooking();
    } catch (err) {
      console.error('Error updating booking:', err);
      alert('Erreur lors de la mise \u00e0 jour du statut');
    } finally {
      setUpdating(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader size="lg" />
      </div>
    );
  }

  if (!data?.booking) {
    return (
      <div className="text-center py-12">
        <p className="text-gray-500 dark:text-gray-400">R&eacute;servation non trouv&eacute;e</p>
        <Link
          href="/admin/bookings"
          className="mt-4 inline-flex items-center gap-2 text-sm text-red-500 hover:text-red-600"
        >
          <ArrowLeft className="w-4 h-4" />
          Retour aux r&eacute;servations
        </Link>
      </div>
    );
  }

  const { booking, provider, client } = data;
  const currentStatus = booking.status as BookingStatus;
  const config = statusConfig[currentStatus];
  const availableTransitions = STATUS_TRANSITIONS[currentStatus] || [];

  return (
    <div className="space-y-6">
      {/* Back button */}
      <Link
        href="/admin/bookings"
        className="inline-flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 transition-colors"
      >
        <ArrowLeft className="w-4 h-4" />
        Retour aux r&eacute;servations
      </Link>

      {/* Booking info card */}
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 p-6">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <h1 className="text-xl font-bold text-gray-900 dark:text-white">
              {booking.serviceName || 'Service'}
            </h1>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
              ID: {booking.id}
            </p>
          </div>
          {config && (
            <span
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium ${config.bgColor} ${config.color}`}
            >
              <span className={`w-2 h-2 rounded-full ${config.dotColor}`} />
              {config.label}
            </span>
          )}
        </div>

        <div className="mt-6 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-blue-50 dark:bg-blue-900/20 flex items-center justify-center">
              <Calendar className="w-5 h-5 text-blue-500" />
            </div>
            <div>
              <p className="text-xs text-gray-500 dark:text-gray-400">Date</p>
              <p className="text-sm font-medium text-gray-900 dark:text-white">
                {formatDate(booking.datetime)}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-purple-50 dark:bg-purple-900/20 flex items-center justify-center">
              <Clock className="w-5 h-5 text-purple-500" />
            </div>
            <div>
              <p className="text-xs text-gray-500 dark:text-gray-400">Heure</p>
              <p className="text-sm font-medium text-gray-900 dark:text-white">
                {formatTime(booking.datetime)}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-green-50 dark:bg-green-900/20 flex items-center justify-center">
              <CreditCard className="w-5 h-5 text-green-500" />
            </div>
            <div>
              <p className="text-xs text-gray-500 dark:text-gray-400">Prix</p>
              <p className="text-sm font-medium text-gray-900 dark:text-white">
                {booking.price ? formatPrice(booking.price) : '-'}
              </p>
            </div>
          </div>

          {booking.duration && (
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-orange-50 dark:bg-orange-900/20 flex items-center justify-center">
                <Clock className="w-5 h-5 text-orange-500" />
              </div>
              <div>
                <p className="text-xs text-gray-500 dark:text-gray-400">Dur&eacute;e</p>
                <p className="text-sm font-medium text-gray-900 dark:text-white">
                  {booking.duration} min
                </p>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Client & Provider cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Client */}
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 p-5">
          <div className="flex items-center gap-2 mb-4">
            <User className="w-4 h-4 text-gray-400" />
            <h2 className="text-sm font-semibold text-gray-900 dark:text-white uppercase tracking-wide">
              Client
            </h2>
          </div>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-gray-200 dark:bg-gray-600 flex items-center justify-center flex-shrink-0">
              {client?.photoURL ? (
                <img
                  src={client.photoURL}
                  alt={client.displayName}
                  className="w-10 h-10 rounded-full object-cover"
                />
              ) : (
                <span className="text-sm font-medium text-gray-600 dark:text-gray-300">
                  {(client?.displayName || booking.clientName || '?').charAt(0).toUpperCase()}
                </span>
              )}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-gray-900 dark:text-white truncate">
                {client?.displayName || booking.clientName || 'Client inconnu'}
              </p>
              {client?.email && (
                <p className="text-xs text-gray-500 dark:text-gray-400 truncate">{client.email}</p>
              )}
            </div>
          </div>
          {client?.id && (
            <Link
              href={`/admin/users/${client.id}`}
              className="mt-3 inline-flex items-center gap-1 text-xs text-red-500 hover:text-red-600 font-medium"
            >
              Voir le profil client
              <ArrowLeft className="w-3 h-3 rotate-180" />
            </Link>
          )}
        </div>

        {/* Provider */}
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 p-5">
          <div className="flex items-center gap-2 mb-4">
            <Briefcase className="w-4 h-4 text-gray-400" />
            <h2 className="text-sm font-semibold text-gray-900 dark:text-white uppercase tracking-wide">
              Prestataire
            </h2>
          </div>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-gray-200 dark:bg-gray-600 flex items-center justify-center flex-shrink-0">
              {provider?.photoURL ? (
                <img
                  src={provider.photoURL}
                  alt={provider.businessName}
                  className="w-10 h-10 rounded-full object-cover"
                />
              ) : (
                <span className="text-sm font-medium text-gray-600 dark:text-gray-300">
                  {(provider?.businessName || booking.providerName || '?').charAt(0).toUpperCase()}
                </span>
              )}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-gray-900 dark:text-white truncate">
                {provider?.businessName || booking.providerName || 'Prestataire inconnu'}
              </p>
            </div>
          </div>
          {booking.providerId && (
            <Link
              href={`/admin/providers/${booking.providerId}`}
              className="mt-3 inline-flex items-center gap-1 text-xs text-red-500 hover:text-red-600 font-medium"
            >
              Voir le profil prestataire
              <ArrowLeft className="w-3 h-3 rotate-180" />
            </Link>
          )}
        </div>
      </div>

      {/* Status actions */}
      {availableTransitions.length > 0 && (
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 p-6">
          <h2 className="text-sm font-semibold text-gray-900 dark:text-white uppercase tracking-wide mb-4">
            Actions
          </h2>
          <div className="flex flex-wrap gap-3">
            {availableTransitions.map((targetStatus) => (
              <button
                key={targetStatus}
                onClick={() => handleStatusChange(targetStatus)}
                disabled={updating}
                className={`px-4 py-2.5 rounded-xl text-sm font-medium transition-colors disabled:opacity-50 ${ACTION_COLORS[targetStatus]}`}
              >
                {updating ? 'Mise \u00e0 jour...' : ACTION_LABELS[targetStatus]}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Cancellation info */}
      {(currentStatus === 'cancelled' || currentStatus === 'noshow') && (
        <div className="bg-gray-50 dark:bg-gray-800/50 rounded-xl border border-gray-200 dark:border-gray-700 p-5">
          <p className="text-sm text-gray-600 dark:text-gray-400">
            {currentStatus === 'cancelled' ? 'Annul\u00e9e' : 'Absence marqu\u00e9e'}
            {booking.cancelledAt && (
              <> le {formatDate(booking.cancelledAt)} &agrave; {formatTime(booking.cancelledAt)}</>
            )}
            {booking.cancelledBy && (
              <> par <span className="font-medium text-gray-900 dark:text-white">{booking.cancelledBy}</span></>
            )}
          </p>
          {booking.cancelReason && (
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
              Motif : {booking.cancelReason}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
