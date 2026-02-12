'use client';

import { useState } from 'react';
import Link from 'next/link';
import {
  XCircle,
  AlertTriangle,
  Clock,
  MapPin,
  Calendar,
  User,
  ArrowRight,
  CheckCircle,
  Loader2
} from 'lucide-react';
import { bookingService } from '@booking-app/firebase';

interface Booking {
  id: string;
  providerId: string;
  providerName: string;
  serviceName: string;
  memberName: string | null;
  locationName: string;
  locationAddress: string;
  datetime: string;
  endDatetime: string;
  duration: number;
  price: number;
  status: string;
  clientInfo: {
    name: string;
    email: string;
    phone: string;
  };
}

interface CancelClientProps {
  booking: Booking | null;
  token: string;
  initialState: 'not_found' | 'already_cancelled' | 'past' | 'form';
  cancelledAt: string | null;
}

function formatDuration(minutes: number): string {
  if (minutes < 60) {
    return `${minutes} min`;
  }
  const hours = Math.floor(minutes / 60);
  const remainingMinutes = minutes % 60;
  if (remainingMinutes === 0) {
    return `${hours}h`;
  }
  return `${hours}h${remainingMinutes}`;
}

function formatPrice(cents: number): string {
  const euros = cents / 100;
  return new Intl.NumberFormat('fr-FR', {
    style: 'currency',
    currency: 'EUR',
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(euros);
}

function formatDate(dateStr: string): string {
  const date = new Date(dateStr);
  return date.toLocaleDateString('fr-FR', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
}

function formatTime(dateStr: string): string {
  const date = new Date(dateStr);
  return date.toLocaleTimeString('fr-FR', {
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function CancelClient({ booking, token, initialState, cancelledAt }: CancelClientProps) {
  const [state, setState] = useState<'not_found' | 'already_cancelled' | 'past' | 'form' | 'loading' | 'success' | 'error'>(initialState);
  const [reason, setReason] = useState('');
  const [error, setError] = useState<string | null>(null);

  const handleCancel = async () => {
    console.log('[CANCEL-CLIENT] ========== START CANCELLATION ==========');
    console.log('[CANCEL-CLIENT] Token:', token);
    console.log('[CANCEL-CLIENT] Reason:', reason || 'NOT PROVIDED');

    setState('loading');
    setError(null);

    try {
      console.log('[CANCEL-CLIENT] Step 1: Calling bookingService.cancelBookingByToken...');
      await bookingService.cancelBookingByToken(token, reason || undefined);
      console.log('[CANCEL-CLIENT] Step 1: SUCCESS - Booking cancelled in database');

      // Send cancellation email to client
      if (booking) {
        console.log('[CANCEL-CLIENT] Step 2: Sending cancellation email...');
        console.log('[CANCEL-CLIENT] Email recipient:', booking.clientInfo.email);
        try {
          const emailResponse = await fetch('/api/bookings/cancel-email', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              bookingId: booking.id,
              clientEmail: booking.clientInfo.email,
              clientName: booking.clientInfo.name,
              serviceName: booking.serviceName,
              datetime: booking.datetime,
              reason: reason || undefined,
              providerName: booking.providerName,
              locationName: booking.locationName,
            }),
          });
          console.log('[CANCEL-CLIENT] Step 2: Email API response status:', emailResponse.status);
          if (!emailResponse.ok) {
            const errorData = await emailResponse.json();
            console.error('[CANCEL-CLIENT] Step 2: Email API error:', errorData);
          } else {
            console.log('[CANCEL-CLIENT] Step 2: SUCCESS - Cancellation email sent');
          }
        } catch (emailErr) {
          // Don't fail the cancellation if email fails
          console.error('[CANCEL-CLIENT] Step 2: FAILED to send cancellation email:', emailErr);
        }
      } else {
        console.log('[CANCEL-CLIENT] Step 2: SKIPPED - No booking data available');
      }

      console.log('[CANCEL-CLIENT] ========== CANCELLATION COMPLETE ==========');
      setState('success');
    } catch (err) {
      console.error('[CANCEL-CLIENT] ERROR:', err);
      setError(err instanceof Error ? err.message : 'Une erreur est survenue');
      setState('error');
    }
  };

  // Not found state
  if (state === 'not_found') {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 py-12 px-4">
        <div className="max-w-lg mx-auto text-center">
          <div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-red-100 dark:bg-red-900/30 mb-6">
            <XCircle className="w-10 h-10 text-red-500" />
          </div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-3">
            Lien invalide ou expiré
          </h1>
          <p className="text-gray-500 dark:text-gray-400 mb-8">
            Ce lien d'annulation n'est plus valide. Le rendez-vous a peut-être déjà été annulé ou le lien a expiré.
          </p>
          <Link
            href="/"
            className="inline-flex items-center gap-2 px-6 py-3 bg-primary-600 hover:bg-primary-700 text-white font-medium rounded-lg transition-colors"
          >
            Retour à l'accueil
            <ArrowRight className="w-4 h-4" />
          </Link>
        </div>
      </div>
    );
  }

  // Already cancelled state
  if (state === 'already_cancelled') {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 py-12 px-4">
        <div className="max-w-lg mx-auto text-center">
          <div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-yellow-100 dark:bg-yellow-900/30 mb-6">
            <AlertTriangle className="w-10 h-10 text-yellow-500" />
          </div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-3">
            Rendez-vous déjà annulé
          </h1>
          <p className="text-gray-500 dark:text-gray-400 mb-2">
            Ce rendez-vous a déjà été annulé.
          </p>
          {cancelledAt && (
            <p className="text-sm text-gray-400 dark:text-gray-500 mb-8">
              Annulé le {formatDate(cancelledAt)} à {formatTime(cancelledAt)}
            </p>
          )}
          <Link
            href="/"
            className="inline-flex items-center gap-2 px-6 py-3 bg-primary-600 hover:bg-primary-700 text-white font-medium rounded-lg transition-colors"
          >
            Retour à l'accueil
            <ArrowRight className="w-4 h-4" />
          </Link>
        </div>
      </div>
    );
  }

  // Past booking state
  if (state === 'past') {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 py-12 px-4">
        <div className="max-w-lg mx-auto text-center">
          <div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-gray-100 dark:bg-gray-800 mb-6">
            <Clock className="w-10 h-10 text-gray-400" />
          </div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-3">
            Rendez-vous passé
          </h1>
          <p className="text-gray-500 dark:text-gray-400 mb-8">
            Ce rendez-vous est déjà passé et ne peut plus être annulé.
          </p>
          <Link
            href="/"
            className="inline-flex items-center gap-2 px-6 py-3 bg-primary-600 hover:bg-primary-700 text-white font-medium rounded-lg transition-colors"
          >
            Retour à l'accueil
            <ArrowRight className="w-4 h-4" />
          </Link>
        </div>
      </div>
    );
  }

  // Success state
  if (state === 'success') {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 py-12 px-4">
        <div className="max-w-lg mx-auto text-center">
          <div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-green-100 dark:bg-green-900/30 mb-6">
            <CheckCircle className="w-10 h-10 text-green-500" />
          </div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-3">
            Rendez-vous annulé
          </h1>
          <p className="text-gray-500 dark:text-gray-400 mb-2">
            Votre rendez-vous a bien été annulé.
          </p>
          <p className="text-sm text-gray-400 dark:text-gray-500 mb-8">
            Le prestataire a été notifié de cette annulation.
          </p>

          {booking && (
            <div className="space-y-3">
              <Link
                href={`/p/${booking.providerName.toLowerCase().replace(/\s+/g, '-')}`}
                className="inline-flex items-center gap-2 px-6 py-3 bg-primary-600 hover:bg-primary-700 text-white font-medium rounded-lg transition-colors"
              >
                Reprendre rendez-vous
                <ArrowRight className="w-4 h-4" />
              </Link>
              <div>
                <Link
                  href="/"
                  className="text-sm text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 transition-colors"
                >
                  Ou retourner à l'accueil
                </Link>
              </div>
            </div>
          )}
        </div>
      </div>
    );
  }

  // Form state (includes loading and error)
  if (!booking) {
    return null;
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 py-12 px-4">
      <div className="max-w-lg mx-auto">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-red-100 dark:bg-red-900/30 mb-4">
            <XCircle className="w-8 h-8 text-red-500" />
          </div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
            Annuler votre rendez-vous
          </h1>
          <p className="text-gray-500 dark:text-gray-400">
            Êtes-vous sûr de vouloir annuler ce rendez-vous ?
          </p>
        </div>

        {/* Booking Details Card */}
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden mb-6">
          {/* Provider Header */}
          <div className="p-5 border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50">
            <p className="font-semibold text-gray-900 dark:text-white">
              {booking.providerName}
            </p>
          </div>

          {/* Details */}
          <div className="p-5 space-y-4">
            {/* Service */}
            <div>
              <p className="text-sm text-gray-500 dark:text-gray-400 mb-1">
                Prestation
              </p>
              <p className="font-medium text-gray-900 dark:text-white">
                {booking.serviceName}
              </p>
              <div className="flex items-center gap-3 mt-1 text-sm text-gray-500 dark:text-gray-400">
                <span className="flex items-center gap-1">
                  <Clock className="w-4 h-4" />
                  {formatDuration(booking.duration)}
                </span>
                <span>{formatPrice(booking.price)}</span>
              </div>
            </div>

            {/* Member */}
            {booking.memberName && (
              <div>
                <p className="text-sm text-gray-500 dark:text-gray-400 mb-1">
                  Professionnel
                </p>
                <div className="flex items-center gap-2">
                  <User className="w-4 h-4 text-gray-400" />
                  <span className="font-medium text-gray-900 dark:text-white">
                    {booking.memberName}
                  </span>
                </div>
              </div>
            )}

            {/* Date & Time */}
            <div>
              <p className="text-sm text-gray-500 dark:text-gray-400 mb-1">
                Date & Heure
              </p>
              <div className="flex items-start gap-2">
                <Calendar className="w-4 h-4 text-gray-400 mt-0.5" />
                <div>
                  <p className="font-medium text-gray-900 dark:text-white capitalize">
                    {formatDate(booking.datetime)}
                  </p>
                  <p className="text-sm text-gray-500 dark:text-gray-400">
                    {formatTime(booking.datetime)} - {formatTime(booking.endDatetime)}
                  </p>
                </div>
              </div>
            </div>

            {/* Location */}
            <div>
              <p className="text-sm text-gray-500 dark:text-gray-400 mb-1">
                Lieu
              </p>
              <div className="flex items-start gap-2">
                <MapPin className="w-4 h-4 text-gray-400 mt-0.5 flex-shrink-0" />
                <div>
                  <p className="font-medium text-gray-900 dark:text-white">
                    {booking.locationName}
                  </p>
                  <p className="text-sm text-gray-500 dark:text-gray-400">
                    {booking.locationAddress}
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Reason Field */}
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-5 mb-6">
          <label
            htmlFor="reason"
            className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2"
          >
            Raison de l'annulation (optionnel)
          </label>
          <textarea
            id="reason"
            rows={3}
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="Ex: Imprévu, changement de programme..."
            className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 focus:ring-2 focus:ring-primary-500 focus:border-primary-500 transition-colors resize-none"
            disabled={state === 'loading'}
          />
        </div>

        {/* Error Message */}
        {error && (
          <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4 mb-6">
            <p className="text-sm text-red-700 dark:text-red-300">{error}</p>
          </div>
        )}

        {/* Warning */}
        <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-4 mb-6">
          <div className="flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 text-yellow-600 dark:text-yellow-400 flex-shrink-0 mt-0.5" />
            <p className="text-sm text-yellow-700 dark:text-yellow-300">
              Cette action est irréversible. Le prestataire sera notifié de votre annulation.
            </p>
          </div>
        </div>

        {/* Actions */}
        <div className="space-y-3">
          <button
            onClick={handleCancel}
            disabled={state === 'loading'}
            className="flex items-center justify-center gap-2 w-full py-3 px-4 bg-red-600 hover:bg-red-700 disabled:bg-red-400 text-white font-medium rounded-lg transition-colors"
          >
            {state === 'loading' ? (
              <>
                <Loader2 className="w-5 h-5 animate-spin" />
                Annulation en cours...
              </>
            ) : (
              <>
                <XCircle className="w-5 h-5" />
                Confirmer l'annulation
              </>
            )}
          </button>
          <Link
            href="/"
            className="flex items-center justify-center w-full py-3 px-4 bg-gray-100 hover:bg-gray-200 dark:bg-gray-700 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-200 font-medium rounded-lg transition-colors"
          >
            Annuler et retourner à l'accueil
          </Link>
        </div>

        {/* Reference */}
        <p className="mt-6 text-center text-xs text-gray-400 dark:text-gray-500">
          Référence : {booking.id}
        </p>
      </div>
    </div>
  );
}
