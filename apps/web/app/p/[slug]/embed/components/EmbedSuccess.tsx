'use client';

import { CheckCircle2, Calendar, MapPin, User } from 'lucide-react';

interface EmbedSuccessProps {
  /** Service + slot + member recap for context */
  serviceName: string;
  memberName: string | null;
  locationName: string | null;
  datetime: string; // ISO
  /** Reset to service step for another booking */
  onReset: () => void;
}

function formatDateTime(iso: string): string {
  const d = new Date(iso);
  const date = new Intl.DateTimeFormat('fr-FR', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  }).format(d);
  const time = new Intl.DateTimeFormat('fr-FR', {
    hour: '2-digit',
    minute: '2-digit',
  }).format(d);
  return `${date} à ${time}`;
}

/**
 * Confirmation screen shown after a successful booking.
 *
 * Includes an acquisition push to the Opatam mobile app — the client might
 * want to manage this booking (cancel, reschedule) and future ones from
 * there rather than checking their email.
 */
export function EmbedSuccess({
  serviceName,
  memberName,
  locationName,
  datetime,
  onReset,
}: EmbedSuccessProps) {
  return (
    <div className="py-6 px-2">
      {/* Success icon */}
      <div className="flex justify-center mb-4">
        <div className="w-16 h-16 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center">
          <CheckCircle2 className="w-9 h-9 text-green-600 dark:text-green-400" />
        </div>
      </div>

      <div className="text-center mb-5">
        <h2 className="text-lg font-bold text-gray-900 dark:text-white">
          Réservation confirmée !
        </h2>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
          Un email de confirmation vient de vous être envoyé.
        </p>
      </div>

      {/* Recap card */}
      <div className="bg-gray-50 dark:bg-gray-800/50 rounded-xl p-4 mb-5 space-y-2.5">
        <div className="flex items-start gap-2.5">
          <Calendar className="w-4 h-4 text-primary-600 dark:text-primary-400 flex-shrink-0 mt-0.5" />
          <p className="text-sm text-gray-900 dark:text-white leading-snug">
            <span className="font-semibold">{serviceName}</span>
            <br />
            <span className="text-gray-600 dark:text-gray-400">{formatDateTime(datetime)}</span>
          </p>
        </div>
        {memberName && (
          <div className="flex items-center gap-2.5">
            <User className="w-4 h-4 text-gray-400 flex-shrink-0" />
            <p className="text-sm text-gray-600 dark:text-gray-400">avec {memberName}</p>
          </div>
        )}
        {locationName && (
          <div className="flex items-center gap-2.5">
            <MapPin className="w-4 h-4 text-gray-400 flex-shrink-0" />
            <p className="text-sm text-gray-600 dark:text-gray-400 truncate">{locationName}</p>
          </div>
        )}
      </div>

      {/* App acquisition push */}
      <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-4 mb-4">
        <div className="flex items-start gap-3 mb-3">
          <div className="w-10 h-10 rounded-xl bg-gray-900 dark:bg-gray-100 flex items-center justify-center flex-shrink-0">
            <span className="font-bold text-sm text-white dark:text-gray-900">O</span>
          </div>
          <div className="min-w-0">
            <p className="text-sm font-semibold text-gray-900 dark:text-white">
              Gérez votre RDV dans l&apos;app Opatam
            </p>
            <p className="text-[11px] text-gray-500 dark:text-gray-400 leading-snug mt-0.5">
              Rappels automatiques, modifications, nouvelles réservations en un clic.
            </p>
          </div>
        </div>
        <div className="flex gap-2">
          <a
            href="https://apps.apple.com/app/opatam/id6759246218"
            target="_blank"
            rel="noopener noreferrer"
            className="flex-1 inline-flex items-center justify-center gap-1.5 px-3 py-2 bg-gray-900 dark:bg-white text-white dark:text-gray-900 text-xs font-semibold rounded-lg hover:opacity-90 transition-opacity"
          >
            <svg className="w-3.5 h-3.5" viewBox="0 0 384 512" fill="currentColor">
              <path d="M318.7 268.7c-.2-36.7 16.4-64.4 50-84.8-18.8-26.9-47.2-41.7-84.7-44.6-35.5-2.8-74.3 20.7-88.5 20.7-15 0-49.4-19.7-76.4-19.7C63.3 141.2 4 184.8 4 273.5c0 26.2 4.8 53.3 14.4 81.2 12.8 36.9 59 127.7 107.2 126.3 25.2-.6 43-17.9 75.8-17.9 31.8 0 48.3 17.9 76.4 17.9 48.6-.7 90.4-82.5 102.6-119.3-65.2-30.7-61.7-90-61.7-93z" />
              <path d="M262.2 97.3c29.4-35.6 26.5-68.2 25.7-79.7-25.6 1.5-55.1 17.7-72.1 38.2-18.6 22.3-29.6 49.8-27.1 79.6 27.6 2.1 53.4-13.6 73.5-38.1z" />
            </svg>
            App Store
          </a>
          <a
            href="https://play.google.com/store/apps/details?id=com.opatam.app"
            target="_blank"
            rel="noopener noreferrer"
            className="flex-1 inline-flex items-center justify-center gap-1.5 px-3 py-2 bg-gray-900 dark:bg-white text-white dark:text-gray-900 text-xs font-semibold rounded-lg hover:opacity-90 transition-opacity"
          >
            <svg className="w-3.5 h-3.5" viewBox="0 0 512 512" fill="currentColor">
              <path d="M325.3 234.3L104.6 13l280.8 161.2-60.1 60.1zM47 0C34 6.8 25.3 19.2 25.3 35.3v441.3c0 16.1 8.7 28.5 21.7 35.3l256.6-256L47 0zm425.2 225.6l-58.9-34.1-65.7 64.5 65.7 64.5 60.1-34.1c18-14.3 18-46.5-1.2-60.8zM104.6 499l280.8-161.2-60.1-60.1L104.6 499z" />
            </svg>
            Google Play
          </a>
        </div>
      </div>

      <button
        type="button"
        onClick={onReset}
        className="w-full px-4 py-2.5 text-sm font-medium text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 rounded-lg transition-colors"
      >
        Nouvelle réservation
      </button>
    </div>
  );
}
