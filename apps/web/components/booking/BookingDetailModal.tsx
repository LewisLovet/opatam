'use client';

import { useState } from 'react';
import {
  Modal,
  ModalHeader,
  ModalBody,
  ModalFooter,
  Button,
  Select,
  Input,
  useToast,
} from '@/components/ui';
import { useAuth } from '@/contexts/AuthContext';
import { bookingService } from '@booking-app/firebase';
import type { Booking, BookingStatus } from '@booking-app/shared';
import {
  statusConfig,
  CANCEL_REASONS,
  formatBookingDate,
  formatBookingTime,
  formatBookingPrice,
} from '@/lib/booking-utils';
import {
  Loader2,
  Calendar,
  Clock,
  User,
  Mail,
  Phone,
  MapPin,
  Scissors,
  Users,
  Check,
  X,
  AlertTriangle,
  Ban,
  Star,
  CheckCircle,
} from 'lucide-react';

type WithId<T> = { id: string } & T;

interface BookingDetailModalProps {
  isOpen: boolean;
  onClose: () => void;
  booking: WithId<Booking> | null;
  onUpdate: () => void;
}

export function BookingDetailModal({
  isOpen,
  onClose,
  booking,
  onUpdate,
}: BookingDetailModalProps) {
  const { user } = useAuth();
  const toast = useToast();

  const [loading, setLoading] = useState(false);
  const [reviewRequestLoading, setReviewRequestLoading] = useState(false);
  const [showCancelConfirm, setShowCancelConfirm] = useState(false);
  const [showNoShowConfirm, setShowNoShowConfirm] = useState(false);
  const [cancelReasonType, setCancelReasonType] = useState('');
  const [cancelReasonCustom, setCancelReasonCustom] = useState('');

  if (!booking) return null;

  const status = statusConfig[booking.status];

  const getCancelReason = () => {
    if (cancelReasonType === 'other') {
      return cancelReasonCustom || 'Autre';
    }
    const reason = CANCEL_REASONS.find((r) => r.value === cancelReasonType);
    return reason?.label || '';
  };

  const handleConfirm = async () => {
    if (!user) return;
    setLoading(true);
    try {
      await bookingService.confirmBooking(booking.id, user.id);
      toast.success('Rendez-vous confirmé');
      onUpdate();
    } catch (error) {
      console.error('Error confirming booking:', error);
      toast.error('Erreur lors de la confirmation');
    } finally {
      setLoading(false);
    }
  };

  const handleCancel = async () => {
    if (!user) return;
    setLoading(true);
    try {
      const reason = getCancelReason();
      await bookingService.cancelBooking(booking.id, 'provider', user.id, reason || undefined);

      // Send cancellation email via API route
      try {
        await fetch('/api/bookings/cancel-email', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            bookingId: booking.id,
            clientEmail: booking.clientInfo.email,
            clientName: booking.clientInfo.name,
            serviceName: booking.serviceName,
            datetime: booking.datetime,
            reason: reason,
            providerName: booking.providerName,
            locationName: booking.locationName,
          }),
        });
      } catch (emailError) {
        console.error('Error sending cancellation email:', emailError);
      }

      toast.success('Rendez-vous annulé');
      setShowCancelConfirm(false);
      setCancelReasonType('');
      setCancelReasonCustom('');
      onUpdate();
    } catch (error) {
      console.error('Error cancelling booking:', error);
      toast.error("Erreur lors de l'annulation");
    } finally {
      setLoading(false);
    }
  };

  const handleNoShow = async () => {
    if (!user) return;
    setLoading(true);
    try {
      await bookingService.markNoShow(booking.id, user.id);
      toast.success('Rendez-vous marqué comme absent');
      setShowNoShowConfirm(false);
      onUpdate();
    } catch (error) {
      console.error('Error marking no-show:', error);
      toast.error('Erreur lors de la mise à jour');
    } finally {
      setLoading(false);
    }
  };

  const resetConfirmations = () => {
    setShowCancelConfirm(false);
    setShowNoShowConfirm(false);
    setCancelReasonType('');
    setCancelReasonCustom('');
  };

  const handleReviewRequest = async () => {
    if (!user) return;
    setReviewRequestLoading(true);
    try {
      const response = await fetch('/api/bookings/review-request-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ bookingId: booking.id }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Erreur lors de l'envoi");
      }

      toast.success("Demande d'avis envoyée");
      onUpdate();
    } catch (error) {
      console.error('Error sending review request:', error);
      toast.error(error instanceof Error ? error.message : "Erreur lors de l'envoi");
    } finally {
      setReviewRequestLoading(false);
    }
  };

  // Check if booking is past and eligible for review request
  const isPastBooking = new Date(booking.datetime) < new Date();
  const canRequestReview = isPastBooking && booking.status === 'confirmed' && !booking.reviewRequestSentAt;
  const reviewRequestAlreadySent = !!booking.reviewRequestSentAt;

  const formatReviewRequestDate = (date: Date | string) => {
    return new Date(date).toLocaleDateString('fr-FR', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} className="max-w-md">
      <ModalHeader title="Détails du rendez-vous" onClose={onClose} />

      <ModalBody className="space-y-4">
        {/* Status badge */}
        <div className="flex items-center gap-2">
          <span className={`px-3 py-1 rounded-full text-sm font-medium ${status.bgColor} ${status.color}`}>
            {status.label}
          </span>
          {booking.status === 'cancelled' && booking.cancelReason && (
            <span className="text-sm text-gray-500 dark:text-gray-400">
              - {booking.cancelReason}
            </span>
          )}
        </div>

        {/* Date and time */}
        <div className="p-4 bg-gray-50 dark:bg-gray-800/50 rounded-xl space-y-3">
          <div className="flex items-center gap-3">
            <Calendar className="w-5 h-5 text-gray-500 dark:text-gray-400" />
            <span className="text-gray-900 dark:text-white capitalize">
              {formatBookingDate(booking.datetime)}
            </span>
          </div>
          <div className="flex items-center gap-3">
            <Clock className="w-5 h-5 text-gray-500 dark:text-gray-400" />
            <span className="text-gray-900 dark:text-white">
              {formatBookingTime(booking.datetime)} - {formatBookingTime(booking.endDatetime)} ({booking.duration} min)
            </span>
          </div>
        </div>

        {/* Client info */}
        <div className="space-y-2">
          <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300">Client</h4>
          <div className="p-4 bg-gray-50 dark:bg-gray-800/50 rounded-xl space-y-2">
            <div className="flex items-center gap-3">
              <User className="w-4 h-4 text-gray-500 dark:text-gray-400" />
              <span className="text-gray-900 dark:text-white font-medium">
                {booking.clientInfo.name}
              </span>
            </div>
            <div className="flex items-center gap-3">
              <Mail className="w-4 h-4 text-gray-500 dark:text-gray-400" />
              <a
                href={`mailto:${booking.clientInfo.email}`}
                className="text-primary-600 dark:text-primary-400 hover:underline"
              >
                {booking.clientInfo.email}
              </a>
            </div>
            <div className="flex items-center gap-3">
              <Phone className="w-4 h-4 text-gray-500 dark:text-gray-400" />
              <a
                href={`tel:${booking.clientInfo.phone}`}
                className="text-primary-600 dark:text-primary-400 hover:underline"
              >
                {booking.clientInfo.phone}
              </a>
            </div>
          </div>
        </div>

        {/* Service info */}
        <div className="space-y-2">
          <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300">Prestation</h4>
          <div className="p-4 bg-gray-50 dark:bg-gray-800/50 rounded-xl space-y-2">
            <div className="flex items-center gap-3">
              <Scissors className="w-4 h-4 text-gray-500 dark:text-gray-400" />
              <span className="text-gray-900 dark:text-white">{booking.serviceName}</span>
              <span className="ml-auto font-semibold text-gray-900 dark:text-white">
                {formatBookingPrice(booking.price)}
              </span>
            </div>
            <div className="flex items-center gap-3">
              <MapPin className="w-4 h-4 text-gray-500 dark:text-gray-400" />
              <span className="text-gray-600 dark:text-gray-400 text-sm">
                {booking.locationName}
              </span>
            </div>
            {booking.memberName && (
              <div className="flex items-center gap-3">
                <Users className="w-4 h-4 text-gray-500 dark:text-gray-400" />
                <span className="text-gray-600 dark:text-gray-400 text-sm">
                  {booking.memberName}
                </span>
              </div>
            )}
          </div>
        </div>

        {/* Cancel confirmation */}
        {showCancelConfirm && (
          <div className="p-4 bg-error-50 dark:bg-error-900/20 rounded-xl space-y-3 border border-error-200 dark:border-error-800">
            <div className="flex items-start gap-2 text-error-700 dark:text-error-300">
              <AlertTriangle className="w-5 h-5 flex-shrink-0 mt-0.5" />
              <span className="text-sm font-medium">
                Êtes-vous sûr de vouloir annuler ce rendez-vous ?
              </span>
            </div>
            <Select
              label="Motif d'annulation"
              value={cancelReasonType}
              onChange={(e) => setCancelReasonType(e.target.value)}
              options={CANCEL_REASONS}
            />
            {cancelReasonType === 'other' && (
              <Input
                label="Préciser le motif"
                value={cancelReasonCustom}
                onChange={(e) => setCancelReasonCustom(e.target.value)}
                placeholder="Entrez le motif..."
              />
            )}
            <div className="flex gap-2 pt-2">
              <Button
                variant="outline"
                size="sm"
                onClick={resetConfirmations}
                disabled={loading}
                className="flex-1"
              >
                Non, revenir
              </Button>
              <Button
                size="sm"
                onClick={handleCancel}
                disabled={loading}
                className="flex-1 bg-error-600 hover:bg-error-700 text-white"
              >
                {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Oui, annuler'}
              </Button>
            </div>
          </div>
        )}

        {/* No-show confirmation */}
        {showNoShowConfirm && (
          <div className="p-4 bg-warning-50 dark:bg-warning-900/20 rounded-xl space-y-3 border border-warning-200 dark:border-warning-800">
            <div className="flex items-start gap-2 text-warning-700 dark:text-warning-300">
              <AlertTriangle className="w-5 h-5 flex-shrink-0 mt-0.5" />
              <span className="text-sm font-medium">
                Confirmer que le client ne s'est pas présenté ?
              </span>
            </div>
            <p className="text-sm text-warning-600 dark:text-warning-400">
              Cette action sera enregistrée dans l'historique du client.
            </p>
            <div className="flex gap-2 pt-2">
              <Button
                variant="outline"
                size="sm"
                onClick={resetConfirmations}
                disabled={loading}
                className="flex-1"
              >
                Non, revenir
              </Button>
              <Button
                size="sm"
                onClick={handleNoShow}
                disabled={loading}
                className="flex-1 bg-warning-600 hover:bg-warning-700 text-white"
              >
                {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Oui, marquer absent'}
              </Button>
            </div>
          </div>
        )}

        {/* Review request section - only for past confirmed bookings */}
        {canRequestReview && !showCancelConfirm && !showNoShowConfirm && (
          <div className="p-4 bg-primary-50 dark:bg-primary-900/20 rounded-xl space-y-3 border border-primary-200 dark:border-primary-800">
            <div className="flex items-center gap-2">
              <Star className="w-5 h-5 text-primary-600 dark:text-primary-400" />
              <span className="font-medium text-primary-700 dark:text-primary-300">
                Demander un avis
              </span>
            </div>
            <p className="text-sm text-primary-600 dark:text-primary-400">
              Envoyer un email à {booking.clientInfo.name} pour lui demander de noter sa prestation.
            </p>
            <Button
              onClick={handleReviewRequest}
              disabled={reviewRequestLoading}
              className="w-full"
            >
              {reviewRequestLoading ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <Mail className="w-4 h-4 mr-2" />
              )}
              Envoyer la demande d'avis
            </Button>
          </div>
        )}

        {/* Review request already sent */}
        {reviewRequestAlreadySent && isPastBooking && booking.status === 'confirmed' && (
          <div className="p-4 bg-success-50 dark:bg-success-900/20 rounded-xl border border-success-200 dark:border-success-800">
            <div className="flex items-center gap-2">
              <CheckCircle className="w-5 h-5 text-success-600 dark:text-success-400" />
              <span className="font-medium text-success-700 dark:text-success-300">
                Demande d'avis envoyée
              </span>
            </div>
            <p className="text-sm text-success-600 dark:text-success-400 mt-1">
              le {formatReviewRequestDate(booking.reviewRequestSentAt!)}
            </p>
          </div>
        )}
      </ModalBody>

      <ModalFooter>
        {/* Actions based on status */}
        {booking.status === 'pending' && !showCancelConfirm && !showNoShowConfirm && (
          <>
            <Button
              variant="outline"
              onClick={() => setShowCancelConfirm(true)}
              disabled={loading}
              className="text-error-600 border-error-300 hover:bg-error-50 dark:text-error-400 dark:border-error-700 dark:hover:bg-error-900/20"
            >
              <X className="w-4 h-4 mr-2" />
              Annuler
            </Button>
            <Button onClick={handleConfirm} disabled={loading}>
              {loading ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <Check className="w-4 h-4 mr-2" />
              )}
              Confirmer
            </Button>
          </>
        )}

        {booking.status === 'confirmed' && !showCancelConfirm && !showNoShowConfirm && !isPastBooking && (
          <>
            <Button
              variant="outline"
              onClick={() => setShowCancelConfirm(true)}
              disabled={loading}
              className="text-error-600 border-error-300 hover:bg-error-50 dark:text-error-400 dark:border-error-700 dark:hover:bg-error-900/20"
            >
              <X className="w-4 h-4 mr-2" />
              Annuler
            </Button>
            <Button
              variant="outline"
              onClick={() => setShowNoShowConfirm(true)}
              disabled={loading}
              className="text-warning-600 border-warning-300 hover:bg-warning-50 dark:text-warning-400 dark:border-warning-700 dark:hover:bg-warning-900/20"
            >
              <Ban className="w-4 h-4 mr-2" />
              Absent
            </Button>
          </>
        )}

        {(booking.status === 'cancelled' ||
          booking.status === 'noshow' ||
          (booking.status === 'confirmed' && isPastBooking)) && (
          <Button variant="outline" onClick={onClose}>
            Fermer
          </Button>
        )}
      </ModalFooter>
    </Modal>
  );
}
