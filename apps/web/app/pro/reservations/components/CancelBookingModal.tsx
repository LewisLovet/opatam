'use client';

import { useState } from 'react';
import { X, Loader2, CheckCircle2, XCircle } from 'lucide-react';
import type { Booking } from '@booking-app/shared';

type WithId<T> = { id: string } & T;

interface CancelBookingModalProps {
  booking: WithId<Booking> | null;
  authToken: string | null;
  onClose: () => void;
  onCancelled: () => void;
}

function formatPrice(cents: number): string {
  return new Intl.NumberFormat('fr-FR', {
    style: 'currency',
    currency: 'EUR',
  }).format(cents / 100);
}

function isWithinRefundDeadline(
  bookingDatetime: Date,
  refundDeadlineHours: number,
): boolean {
  if (refundDeadlineHours <= 0) return false;
  const deadline = new Date(bookingDatetime).getTime() - refundDeadlineHours * 60 * 60 * 1000;
  return Date.now() < deadline;
}

/**
 * Pro-side cancellation modal. Three flavours depending on the deposit
 * state of the booking:
 *
 *   1. No deposit                → simple "annuler" button
 *   2. Deposit + within deadline → "annuler + rembourser X€"
 *   3. Deposit + past deadline   → two separate buttons:
 *                                  "annuler sans remboursement" (default)
 *                                  "annuler avec remboursement"  (override)
 */
export function CancelBookingModal({
  booking,
  authToken,
  onClose,
  onCancelled,
}: CancelBookingModalProps) {
  const [reason, setReason] = useState('');
  const [submitting, setSubmitting] = useState<false | 'plain' | 'force-refund'>(false);
  const [error, setError] = useState<string | null>(null);

  if (!booking) return null;

  const depositPaid = booking.deposit?.status === 'paid';
  const refundEligible =
    depositPaid &&
    isWithinRefundDeadline(
      booking.datetime,
      booking.deposit!.refundDeadlineHours,
    );
  const pastDeadline = depositPaid && !refundEligible;

  async function submit(forceRefund: boolean) {
    if (!authToken) {
      setError('Session expirée — reconnectez-vous');
      return;
    }
    setSubmitting(forceRefund ? 'force-refund' : 'plain');
    setError(null);
    try {
      const res = await fetch('/api/bookings/cancel', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${authToken}`,
        },
        body: JSON.stringify({
          bookingId: booking!.id,
          reason: reason || undefined,
          forceRefund,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Une erreur est survenue');
      }
      onCancelled();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Une erreur est survenue');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="bg-white dark:bg-gray-800 rounded-xl max-w-md w-full overflow-hidden shadow-xl">
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-gray-200 dark:border-gray-700">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
            Annuler la réservation
          </h2>
          <button
            onClick={onClose}
            disabled={!!submitting}
            className="p-1 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="p-5 space-y-4">
          {/* Refund status — front and center so the pro reads the
              financial outcome before anything else. Three states:
                - in deadline → big green "remboursement automatique"
                - past deadline → big red "ACOMPTE NON REMBOURSÉ"
                  (the bottom buttons let them override)
                - no paid deposit → no banner */}
          {depositPaid && refundEligible && (
            <div className="rounded-xl p-4 bg-green-50 dark:bg-green-900/20 border-2 border-green-300 dark:border-green-700">
              <div className="flex items-start gap-3">
                <div className="flex-shrink-0 w-10 h-10 rounded-full bg-green-100 dark:bg-green-900/40 flex items-center justify-center">
                  <CheckCircle2 className="w-6 h-6 text-green-600 dark:text-green-400" />
                </div>
                <div className="flex-1">
                  <p className="text-sm font-bold text-green-900 dark:text-green-100 uppercase tracking-wide mb-0.5">
                    Acompte remboursé
                  </p>
                  <p className="text-sm text-green-800 dark:text-green-200">
                    L'acompte de <strong>{formatPrice(booking.deposit!.amount)}</strong> sera automatiquement reversé au client (dans le délai de remboursement).
                  </p>
                </div>
              </div>
            </div>
          )}
          {pastDeadline && (
            <div className="rounded-xl p-4 bg-red-50 dark:bg-red-900/20 border-2 border-red-300 dark:border-red-700">
              <div className="flex items-start gap-3">
                <div className="flex-shrink-0 w-10 h-10 rounded-full bg-red-100 dark:bg-red-900/40 flex items-center justify-center">
                  <XCircle className="w-6 h-6 text-red-600 dark:text-red-400" />
                </div>
                <div className="flex-1">
                  <p className="text-sm font-bold text-red-900 dark:text-red-100 uppercase tracking-wide mb-0.5">
                    Acompte non remboursé
                  </p>
                  <p className="text-sm text-red-800 dark:text-red-200 mb-2">
                    Le délai de remboursement (<strong>{booking.deposit!.refundDeadlineHours}h</strong> avant le RDV) est dépassé. L'acompte de <strong>{formatPrice(booking.deposit!.amount)}</strong> reste acquis au pro.
                  </p>
                  <p className="text-xs text-red-700 dark:text-red-300">
                    Vous pouvez choisir ci-dessous de rembourser quand même, à titre commercial.
                  </p>
                </div>
              </div>
            </div>
          )}

          <div className="text-sm text-gray-600 dark:text-gray-400">
            <p className="font-medium text-gray-900 dark:text-white mb-0.5">
              {booking.clientInfo.name}
            </p>
            <p>{booking.serviceName}</p>
            <p>
              {new Date(booking.datetime).toLocaleString('fr-FR', {
                weekday: 'short',
                day: 'numeric',
                month: 'short',
                hour: '2-digit',
                minute: '2-digit',
              })}
            </p>
          </div>

          {/* Reason (optional) */}
          <div>
            <label
              htmlFor="cancel-reason"
              className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5"
            >
              Motif (optionnel)
            </label>
            <textarea
              id="cancel-reason"
              rows={2}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Ex : conflit d'horaire, indisponibilité…"
              disabled={!!submitting}
              className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-400 focus:ring-2 focus:ring-primary-500 focus:border-primary-500 resize-none"
            />
          </div>

          {error && (
            <div className="rounded-lg p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800">
              <p className="text-sm text-red-700 dark:text-red-300">{error}</p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-5 border-t border-gray-200 dark:border-gray-700 flex flex-col gap-2">
          {pastDeadline ? (
            <>
              {/* Primary action mirrors the red banner — keep the
                  no-refund path the default since the delay is up. */}
              <button
                onClick={() => submit(false)}
                disabled={!!submitting}
                className="flex items-center justify-center gap-2 w-full py-2.5 px-4 bg-red-600 hover:bg-red-700 disabled:bg-red-400 text-white text-sm font-medium rounded-lg transition-colors"
              >
                {submitting === 'plain' && <Loader2 className="w-4 h-4 animate-spin" />}
                Annuler sans remboursement
              </button>
              {/* Override — outline style so it reads as a secondary
                  "yes I really want to refund anyway" choice. */}
              <button
                onClick={() => submit(true)}
                disabled={!!submitting}
                className="flex items-center justify-center gap-2 w-full py-2.5 px-4 bg-white dark:bg-gray-800 border border-amber-400 text-amber-700 dark:text-amber-300 hover:bg-amber-50 dark:hover:bg-amber-900/20 disabled:opacity-50 text-sm font-medium rounded-lg transition-colors"
              >
                {submitting === 'force-refund' && <Loader2 className="w-4 h-4 animate-spin" />}
                Annuler et rembourser quand même {formatPrice(booking.deposit!.amount)}
              </button>
            </>
          ) : (
            <button
              onClick={() => submit(false)}
              disabled={!!submitting}
              className="flex items-center justify-center gap-2 w-full py-2.5 px-4 bg-red-600 hover:bg-red-700 disabled:bg-red-400 text-white text-sm font-medium rounded-lg transition-colors"
            >
              {submitting === 'plain' && <Loader2 className="w-4 h-4 animate-spin" />}
              {refundEligible
                ? `Annuler et rembourser ${formatPrice(booking.deposit!.amount)}`
                : 'Confirmer l\'annulation'}
            </button>
          )}
          <button
            onClick={onClose}
            disabled={!!submitting}
            className="w-full py-2 text-sm text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white transition-colors"
          >
            Garder la réservation
          </button>
        </div>
      </div>
    </div>
  );
}
