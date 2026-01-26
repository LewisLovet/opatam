'use client';

import { useState } from 'react';
import Link from 'next/link';
import {
  Star,
  AlertTriangle,
  Clock,
  Calendar,
  User,
  ArrowRight,
  CheckCircle,
  Loader2,
  XCircle,
} from 'lucide-react';
import { StarRatingInput } from '@/components/ui/StarRatingInput';

interface Booking {
  id: string;
  providerId: string;
  providerName: string;
  serviceName: string;
  memberName: string | null;
  locationName: string;
  datetime: string;
  duration: number;
  clientInfo: {
    name: string;
  };
}

interface ExistingReview {
  rating: number;
  comment: string | null;
  createdAt: string;
}

interface ReviewClientProps {
  booking: Booking | null;
  bookingId: string;
  initialState: 'not_found' | 'not_yet_passed' | 'already_reviewed' | 'form';
  existingReview: ExistingReview | null;
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

function StarDisplay({ rating }: { rating: number }) {
  return (
    <div className="flex gap-1">
      {[1, 2, 3, 4, 5].map((star) => (
        <Star
          key={star}
          className={`w-5 h-5 ${
            star <= rating
              ? 'text-yellow-400 fill-yellow-400'
              : 'text-gray-300 dark:text-gray-600'
          }`}
        />
      ))}
    </div>
  );
}

export function ReviewClient({
  booking,
  bookingId,
  initialState,
  existingReview,
}: ReviewClientProps) {
  const [state, setState] = useState<
    'not_found' | 'not_yet_passed' | 'already_reviewed' | 'form' | 'loading' | 'success' | 'error'
  >(initialState);
  const [rating, setRating] = useState(0);
  const [comment, setComment] = useState('');
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async () => {
    if (rating === 0) {
      setError('Veuillez selectionner une note');
      return;
    }

    setState('loading');
    setError(null);

    try {
      const response = await fetch('/api/reviews/submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          bookingId,
          rating,
          comment: comment.trim() || undefined,
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Une erreur est survenue');
      }

      setState('success');
    } catch (err) {
      console.error('[REVIEW] Error:', err);
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
            Reservation introuvable
          </h1>
          <p className="text-gray-500 dark:text-gray-400 mb-8">
            Cette reservation n'existe pas ou le lien est invalide.
          </p>
          <Link
            href="/"
            className="inline-flex items-center gap-2 px-6 py-3 bg-primary-600 hover:bg-primary-700 text-white font-medium rounded-lg transition-colors"
          >
            Retour a l'accueil
            <ArrowRight className="w-4 h-4" />
          </Link>
        </div>
      </div>
    );
  }

  // Not yet passed state
  if (state === 'not_yet_passed') {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 py-12 px-4">
        <div className="max-w-lg mx-auto text-center">
          <div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-yellow-100 dark:bg-yellow-900/30 mb-6">
            <Clock className="w-10 h-10 text-yellow-500" />
          </div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-3">
            Rendez-vous a venir
          </h1>
          <p className="text-gray-500 dark:text-gray-400 mb-2">
            Vous pourrez donner votre avis apres votre rendez-vous.
          </p>
          {booking && (
            <p className="text-sm text-gray-400 dark:text-gray-500 mb-8">
              Rendez-vous prevu le {formatDate(booking.datetime)} a {formatTime(booking.datetime)}
            </p>
          )}
          <Link
            href="/"
            className="inline-flex items-center gap-2 px-6 py-3 bg-primary-600 hover:bg-primary-700 text-white font-medium rounded-lg transition-colors"
          >
            Retour a l'accueil
            <ArrowRight className="w-4 h-4" />
          </Link>
        </div>
      </div>
    );
  }

  // Already reviewed state
  if (state === 'already_reviewed' && existingReview) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 py-12 px-4">
        <div className="max-w-lg mx-auto text-center">
          <div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-green-100 dark:bg-green-900/30 mb-6">
            <CheckCircle className="w-10 h-10 text-green-500" />
          </div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-3">
            Avis deja depose
          </h1>
          <p className="text-gray-500 dark:text-gray-400 mb-6">
            Vous avez deja donne votre avis pour ce rendez-vous.
          </p>

          {/* Display the existing review */}
          <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-6 text-left mb-8">
            <div className="flex items-center gap-3 mb-3">
              <StarDisplay rating={existingReview.rating} />
              <span className="text-sm text-gray-500 dark:text-gray-400">
                {formatDate(existingReview.createdAt)}
              </span>
            </div>
            {existingReview.comment && (
              <p className="text-gray-700 dark:text-gray-300">{existingReview.comment}</p>
            )}
          </div>

          <Link
            href="/"
            className="inline-flex items-center gap-2 px-6 py-3 bg-primary-600 hover:bg-primary-700 text-white font-medium rounded-lg transition-colors"
          >
            Retour a l'accueil
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
            Merci pour votre avis !
          </h1>
          <p className="text-gray-500 dark:text-gray-400 mb-8">
            Votre avis a bien ete enregistre et sera visible sur la page du prestataire.
          </p>
          <Link
            href="/"
            className="inline-flex items-center gap-2 px-6 py-3 bg-primary-600 hover:bg-primary-700 text-white font-medium rounded-lg transition-colors"
          >
            Retour a l'accueil
            <ArrowRight className="w-4 h-4" />
          </Link>
        </div>
      </div>
    );
  }

  // Form state (includes error)
  if (!booking) {
    return null;
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 py-12 px-4">
      <div className="max-w-lg mx-auto">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-primary-100 dark:bg-primary-900/30 mb-4">
            <Star className="w-8 h-8 text-primary-600 dark:text-primary-400" />
          </div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
            Donner votre avis
          </h1>
          <p className="text-gray-500 dark:text-gray-400">
            Comment s'est passe votre rendez-vous chez {booking.providerName} ?
          </p>
        </div>

        {/* Booking Summary Card */}
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden mb-6">
          <div className="p-5 border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50">
            <p className="font-semibold text-gray-900 dark:text-white">{booking.providerName}</p>
          </div>

          <div className="p-5 space-y-3">
            {/* Service */}
            <div className="flex items-center gap-3 text-sm">
              <span className="text-gray-500 dark:text-gray-400 w-24">Prestation</span>
              <span className="font-medium text-gray-900 dark:text-white">
                {booking.serviceName}
              </span>
            </div>

            {/* Member */}
            {booking.memberName && (
              <div className="flex items-center gap-3 text-sm">
                <span className="text-gray-500 dark:text-gray-400 w-24">Professionnel</span>
                <div className="flex items-center gap-2">
                  <User className="w-4 h-4 text-gray-400" />
                  <span className="font-medium text-gray-900 dark:text-white">
                    {booking.memberName}
                  </span>
                </div>
              </div>
            )}

            {/* Date */}
            <div className="flex items-center gap-3 text-sm">
              <span className="text-gray-500 dark:text-gray-400 w-24">Date</span>
              <div className="flex items-center gap-2">
                <Calendar className="w-4 h-4 text-gray-400" />
                <span className="font-medium text-gray-900 dark:text-white capitalize">
                  {formatDate(booking.datetime)}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Rating Section */}
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-6 mb-6">
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-4">
            Votre note *
          </label>
          <div className="flex justify-center">
            <StarRatingInput
              value={rating}
              onChange={setRating}
              size="lg"
              disabled={state === 'loading'}
            />
          </div>
          {rating > 0 && (
            <p className="text-center text-sm text-gray-500 dark:text-gray-400 mt-3">
              {rating === 1 && 'Tres insatisfait'}
              {rating === 2 && 'Insatisfait'}
              {rating === 3 && 'Correct'}
              {rating === 4 && 'Satisfait'}
              {rating === 5 && 'Tres satisfait'}
            </p>
          )}
        </div>

        {/* Comment Section */}
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-6 mb-6">
          <label
            htmlFor="comment"
            className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2"
          >
            Votre commentaire (optionnel)
          </label>
          <textarea
            id="comment"
            rows={4}
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            placeholder="Partagez votre experience..."
            maxLength={1000}
            className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 focus:ring-2 focus:ring-primary-500 focus:border-primary-500 transition-colors resize-none"
            disabled={state === 'loading'}
          />
          <p className="text-xs text-gray-400 dark:text-gray-500 mt-2 text-right">
            {comment.length}/1000
          </p>
        </div>

        {/* Error Message */}
        {error && (
          <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4 mb-6">
            <div className="flex items-start gap-3">
              <AlertTriangle className="w-5 h-5 text-red-600 dark:text-red-400 flex-shrink-0 mt-0.5" />
              <p className="text-sm text-red-700 dark:text-red-300">{error}</p>
            </div>
          </div>
        )}

        {/* Submit Button */}
        <button
          onClick={handleSubmit}
          disabled={state === 'loading' || rating === 0}
          className="flex items-center justify-center gap-2 w-full py-3 px-4 bg-primary-600 hover:bg-primary-700 disabled:bg-primary-400 disabled:cursor-not-allowed text-white font-medium rounded-lg transition-colors"
        >
          {state === 'loading' ? (
            <>
              <Loader2 className="w-5 h-5 animate-spin" />
              Envoi en cours...
            </>
          ) : (
            <>
              <Star className="w-5 h-5" />
              Envoyer mon avis
            </>
          )}
        </button>

        {/* Cancel Link */}
        <div className="text-center mt-4">
          <Link
            href="/"
            className="text-sm text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 transition-colors"
          >
            Annuler et retourner a l'accueil
          </Link>
        </div>

        {/* Reference */}
        <p className="mt-6 text-center text-xs text-gray-400 dark:text-gray-500">
          Reference : {booking.id}
        </p>
      </div>
    </div>
  );
}
