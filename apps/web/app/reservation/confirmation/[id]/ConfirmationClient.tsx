'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Check, Clock, MapPin, Calendar, User, ArrowRight, Download } from 'lucide-react';

interface Booking {
  id: string;
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

interface ConfirmationClientProps {
  booking: Booking;
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

// Generate Google Calendar URL
function generateGoogleCalendarUrl(booking: Booking): string {
  const startDate = new Date(booking.datetime);
  const endDate = new Date(booking.endDatetime);

  // Format dates for Google Calendar (YYYYMMDDTHHmmssZ)
  const formatGoogleDate = (date: Date) => {
    return date.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
  };

  const title = encodeURIComponent(`RDV - ${booking.serviceName} chez ${booking.providerName}`);
  const location = encodeURIComponent(booking.locationAddress);
  const description = encodeURIComponent(
    booking.memberName ? `Avec ${booking.memberName}` : `Chez ${booking.providerName}`
  );
  const dates = `${formatGoogleDate(startDate)}/${formatGoogleDate(endDate)}`;

  return `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${title}&dates=${dates}&location=${location}&details=${description}`;
}

// Generate ICS file content
function generateIcsContent(booking: Booking): string {
  const startDate = new Date(booking.datetime);
  const endDate = new Date(booking.endDatetime);

  // Format dates for ICS (YYYYMMDDTHHmmssZ)
  const formatIcsDate = (date: Date) => {
    return date.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
  };

  const title = `RDV - ${booking.serviceName} chez ${booking.providerName}`;
  const description = booking.memberName ? `Avec ${booking.memberName}` : `Chez ${booking.providerName}`;

  return `BEGIN:VCALENDAR
VERSION:2.0
PRODID:-//BookingApp//FR
BEGIN:VEVENT
UID:${booking.id}@bookingapp
DTSTAMP:${formatIcsDate(new Date())}
DTSTART:${formatIcsDate(startDate)}
DTEND:${formatIcsDate(endDate)}
SUMMARY:${title}
DESCRIPTION:${description}
LOCATION:${booking.locationAddress}
END:VEVENT
END:VCALENDAR`;
}

// Download ICS file
function downloadIcs(booking: Booking) {
  const icsContent = generateIcsContent(booking);
  const blob = new Blob([icsContent], { type: 'text/calendar;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `rdv-${booking.providerName.toLowerCase().replace(/\s+/g, '-')}.ics`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

export function ConfirmationClient({ booking }: ConfirmationClientProps) {
  const [mounted, setMounted] = useState(false);
  const isPending = booking.status === 'pending';

  // Trigger animation on mount
  useEffect(() => {
    const timer = setTimeout(() => setMounted(true), 100);
    return () => clearTimeout(timer);
  }, []);

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 py-12 px-4">
      <div className="max-w-lg mx-auto">
        {/* Success Icon with Animation */}
        <div className="text-center mb-8">
          <div
            className={`inline-flex items-center justify-center w-20 h-20 rounded-full bg-green-100 dark:bg-green-900/30 mb-4 transition-all duration-500 ease-out ${
              mounted ? 'scale-100 opacity-100' : 'scale-50 opacity-0'
            }`}
          >
            <svg
              className={`w-10 h-10 text-green-500 ${mounted ? 'animate-check-draw' : ''}`}
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="3"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path
                d="M5 13l4 4L19 7"
                className={`transition-all duration-500 delay-200 ${
                  mounted ? 'stroke-dashoffset-0' : ''
                }`}
                style={{
                  strokeDasharray: 24,
                  strokeDashoffset: mounted ? 0 : 24,
                  transition: 'stroke-dashoffset 0.4s ease-out 0.3s',
                }}
              />
            </svg>
          </div>
          <h1
            className={`text-2xl font-bold text-gray-900 dark:text-white mb-2 transition-all duration-500 delay-300 ${
              mounted ? 'translate-y-0 opacity-100' : 'translate-y-4 opacity-0'
            }`}
          >
            {isPending ? 'Demande envoyée !' : 'Réservation confirmée !'}
          </h1>
          <p
            className={`text-gray-500 dark:text-gray-400 transition-all duration-500 delay-400 ${
              mounted ? 'translate-y-0 opacity-100' : 'translate-y-4 opacity-0'
            }`}
          >
            {isPending
              ? 'Votre demande de réservation a bien été envoyée. Vous recevrez un email dès que le prestataire aura confirmé.'
              : 'Votre réservation a bien été enregistrée. Un email de confirmation vous a été envoyé.'}
          </p>
        </div>

        {/* Booking Details Card */}
        <div
          className={`bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden mb-6 transition-all duration-500 delay-500 ${
            mounted ? 'translate-y-0 opacity-100' : 'translate-y-4 opacity-0'
          }`}
        >
          {/* Provider Header */}
          <div className="p-5 border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50">
            <p className="font-semibold text-gray-900 dark:text-white">
              {booking.providerName}
            </p>
            {isPending && (
              <span className="inline-flex items-center gap-1.5 mt-2 px-2.5 py-1 bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-400 text-sm font-medium rounded-full">
                <Clock className="w-4 h-4" />
                En attente de confirmation
              </span>
            )}
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

          {/* Total */}
          <div className="px-5 py-4 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50">
            <div className="flex items-center justify-between">
              <span className="font-medium text-gray-900 dark:text-white">
                Total
              </span>
              <span className="text-xl font-bold text-gray-900 dark:text-white">
                {formatPrice(booking.price)}
              </span>
            </div>
          </div>
        </div>

        {/* Add to Calendar Section */}
        <div
          className={`bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4 mb-6 transition-all duration-500 delay-600 ${
            mounted ? 'translate-y-0 opacity-100' : 'translate-y-4 opacity-0'
          }`}
        >
          <p className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
            Ajouter à votre calendrier
          </p>
          <div className="grid grid-cols-2 gap-3">
            <a
              href={generateGoogleCalendarUrl(booking)}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center justify-center gap-2 py-2.5 px-4 bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg text-sm font-medium text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-600 transition-colors"
            >
              <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
                <path d="M12.545 10.239v3.821h5.445c-.712 2.315-2.647 3.972-5.445 3.972a6.033 6.033 0 110-12.064c1.498 0 2.866.549 3.921 1.453l2.814-2.814A9.969 9.969 0 0012.545 2C6.196 2 1.04 7.156 1.04 13.505s5.156 11.505 11.505 11.505 11.505-5.156 11.505-11.505c0-.703-.057-1.391-.168-2.066h-11.337z" />
              </svg>
              Google Calendar
            </a>
            <button
              onClick={() => downloadIcs(booking)}
              className="flex items-center justify-center gap-2 py-2.5 px-4 bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg text-sm font-medium text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-600 transition-colors"
            >
              <Download className="w-4 h-4" />
              Apple / Outlook
            </button>
          </div>
        </div>

        {/* Client Info Reminder */}
        <div
          className={`bg-blue-50 dark:bg-blue-900/20 rounded-xl p-4 mb-6 transition-all duration-500 delay-700 ${
            mounted ? 'translate-y-0 opacity-100' : 'translate-y-4 opacity-0'
          }`}
        >
          <p className="text-sm text-blue-700 dark:text-blue-300">
            Un email de confirmation a été envoyé à{' '}
            <span className="font-medium">{booking.clientInfo.email}</span>
          </p>
        </div>

        {/* Actions */}
        <div
          className={`space-y-3 transition-all duration-500 delay-800 ${
            mounted ? 'translate-y-0 opacity-100' : 'translate-y-4 opacity-0'
          }`}
        >
          <Link
            href="/"
            className="flex items-center justify-center gap-2 w-full py-3 px-4 bg-primary-600 hover:bg-primary-700 text-white font-medium rounded-lg transition-colors"
          >
            Retour à l'accueil
            <ArrowRight className="w-4 h-4" />
          </Link>
        </div>

        {/* Reference */}
        <p
          className={`mt-6 text-center text-xs text-gray-400 dark:text-gray-500 transition-all duration-500 delay-900 ${
            mounted ? 'opacity-100' : 'opacity-0'
          }`}
        >
          Référence : {booking.id}
        </p>
      </div>
    </div>
  );
}
