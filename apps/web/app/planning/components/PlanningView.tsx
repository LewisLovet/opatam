'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import {
  Calendar,
  Clock,
  User,
  Mail,
  Phone,
  MapPin,
  Loader2,
  LogOut,
  RefreshCw,
  Tag,
  Copy,
  Check,
  ExternalLink,
  Share2,
  QrCode,
  Download,
} from 'lucide-react';
import { QRCodeCanvas } from 'qrcode.react';

interface BookingItem {
  id: string;
  serviceName: string;
  duration: number;
  price: number;
  clientInfo: {
    name: string;
    email: string;
    phone: string;
  };
  datetime: string;
  endDatetime: string;
  status: 'confirmed' | 'pending';
  locationName: string;
  locationAddress: string;
}

interface PlanningData {
  member: { name: string; email: string };
  businessName: string;
  slug: string | null;
  bookings: BookingItem[];
}

interface PlanningViewProps {
  accessCode: string;
  memberName: string;
  onLogout: () => void;
}

export function PlanningView({ accessCode, memberName, onLogout }: PlanningViewProps) {
  const [data, setData] = useState<PlanningData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const qrRef = useRef<HTMLDivElement>(null);

  const fetchBookings = useCallback(async () => {
    setLoading(true);
    setError('');

    try {
      const response = await fetch(`/api/planning/bookings?code=${encodeURIComponent(accessCode)}`);
      const result = await response.json();

      if (!response.ok) {
        setError(result.error || 'Erreur lors du chargement');
        return;
      }

      setData(result);
    } catch {
      setError('Erreur de connexion');
    } finally {
      setLoading(false);
    }
  }, [accessCode]);

  useEffect(() => {
    fetchBookings();
  }, [fetchBookings]);

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-950 flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-primary-600 animate-spin" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-950 flex items-center justify-center p-4">
        <div className="text-center">
          <p className="text-red-600 dark:text-red-400 mb-4">{error}</p>
          <button
            onClick={fetchBookings}
            className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors"
          >
            Réessayer
          </button>
        </div>
      </div>
    );
  }

  if (!data) return null;

  // Group bookings by date
  const bookingsByDate: Record<string, BookingItem[]> = {};
  data.bookings.forEach((booking) => {
    const dateKey = new Date(booking.datetime).toISOString().split('T')[0];
    if (!bookingsByDate[dateKey]) {
      bookingsByDate[dateKey] = [];
    }
    bookingsByDate[dateKey].push(booking);
  });

  const dates = Object.keys(bookingsByDate).sort();
  const activeDateKey = selectedDate || dates[0] || null;

  // Get unique dates for the date navigator
  const today = new Date().toISOString().split('T')[0];

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950">
      {/* Header */}
      <header className="bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-800 sticky top-0 z-10">
        <div className="max-w-3xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                {data.businessName}
              </p>
              <h1 className="text-lg font-bold text-gray-900 dark:text-white">
                {memberName}
              </h1>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={fetchBookings}
                className="p-2 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors"
                title="Actualiser"
              >
                <RefreshCw className="w-5 h-5" />
              </button>
              <button
                onClick={onLogout}
                className="p-2 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors"
                title="Déconnexion"
              >
                <LogOut className="w-5 h-5" />
              </button>
            </div>
          </div>
        </div>
      </header>

      <div className="max-w-3xl mx-auto px-4 py-6">
        {/* Stats */}
        <div className="grid grid-cols-2 gap-3 mb-6">
          <div className="bg-white dark:bg-gray-900 rounded-xl p-4 border border-gray-200 dark:border-gray-800">
            <p className="text-2xl font-bold text-primary-600 dark:text-primary-400">
              {data.bookings.length}
            </p>
            <p className="text-xs text-gray-500 dark:text-gray-400">RDV à venir</p>
          </div>
          <div className="bg-white dark:bg-gray-900 rounded-xl p-4 border border-gray-200 dark:border-gray-800">
            <p className="text-2xl font-bold text-gray-900 dark:text-white">
              {dates.length}
            </p>
            <p className="text-xs text-gray-500 dark:text-gray-400">Jours avec RDV</p>
          </div>
        </div>

        {/* Date navigation */}
        {dates.length > 0 && (
          <div className="mb-6">
            <div className="flex gap-2 overflow-x-auto pb-2 -mx-4 px-4 scrollbar-hide">
              {dates.map((dateKey) => {
                const date = new Date(dateKey + 'T00:00:00');
                const isToday = dateKey === today;
                const isActive = dateKey === activeDateKey;
                const count = bookingsByDate[dateKey].length;

                return (
                  <button
                    key={dateKey}
                    onClick={() => setSelectedDate(dateKey)}
                    className={`
                      flex-shrink-0 flex flex-col items-center px-4 py-3 rounded-xl border-2 transition-all min-w-[72px]
                      ${isActive
                        ? 'border-primary-500 bg-primary-50 dark:bg-primary-900/20'
                        : 'border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 hover:border-gray-300 dark:hover:border-gray-700'
                      }
                    `}
                  >
                    <span className={`text-xs font-medium uppercase ${
                      isActive
                        ? 'text-primary-600 dark:text-primary-400'
                        : 'text-gray-500 dark:text-gray-400'
                    }`}>
                      {isToday ? "Auj." : date.toLocaleDateString('fr-FR', { weekday: 'short' })}
                    </span>
                    <span className={`text-lg font-bold ${
                      isActive
                        ? 'text-primary-700 dark:text-primary-300'
                        : 'text-gray-900 dark:text-white'
                    }`}>
                      {date.getDate()}
                    </span>
                    <span className={`text-xs ${
                      isActive
                        ? 'text-primary-600 dark:text-primary-400'
                        : 'text-gray-400 dark:text-gray-500'
                    }`}>
                      {date.toLocaleDateString('fr-FR', { month: 'short' })}
                    </span>
                    {count > 1 && (
                      <span className={`mt-1 text-xs font-medium px-1.5 py-0.5 rounded-full ${
                        isActive
                          ? 'bg-primary-200 dark:bg-primary-800 text-primary-700 dark:text-primary-300'
                          : 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400'
                      }`}>
                        {count}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* Bookings list */}
        {dates.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <div className="w-16 h-16 rounded-full bg-gray-100 dark:bg-gray-800 flex items-center justify-center mb-4">
              <Calendar className="w-8 h-8 text-gray-400" />
            </div>
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
              Aucun rendez-vous
            </h2>
            <p className="text-sm text-gray-500 dark:text-gray-400 max-w-xs">
              Vous n&apos;avez aucun rendez-vous à venir pour le moment.
            </p>
          </div>
        ) : activeDateKey && bookingsByDate[activeDateKey] ? (
          <div>
            {/* Date header */}
            <h2 className="text-sm font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-4">
              {formatDateHeader(activeDateKey)}
            </h2>

            {/* Booking cards */}
            <div className="space-y-3">
              {bookingsByDate[activeDateKey].map((booking) => (
                <BookingCard key={booking.id} booking={booking} />
              ))}
            </div>
          </div>
        ) : null}

        {/* Share section */}
        {data.slug && (
          <ShareSection
            slug={data.slug}
            businessName={data.businessName}
            copied={copied}
            onCopy={setCopied}
            qrRef={qrRef}
          />
        )}
      </div>
    </div>
  );
}

// --- Share section ---

function ShareSection({
  slug,
  businessName,
  copied,
  onCopy,
  qrRef,
}: {
  slug: string;
  businessName: string;
  copied: boolean;
  onCopy: (v: boolean) => void;
  qrRef: React.RefObject<HTMLDivElement | null>;
}) {
  const origin = typeof window !== 'undefined' ? window.location.origin : '';
  const bookingUrl = `${origin}/p/${slug}/reserver`;

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(bookingUrl);
    } catch {
      const textarea = document.createElement('textarea');
      textarea.value = bookingUrl;
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand('copy');
      document.body.removeChild(textarea);
    }
    onCopy(true);
    setTimeout(() => onCopy(false), 2000);
  };

  const handleDownload = () => {
    const canvas = qrRef.current?.querySelector('canvas');
    if (!canvas) return;

    const downloadCanvas = document.createElement('canvas');
    const size = 1024;
    const padding = 80;
    downloadCanvas.width = size + padding * 2;
    downloadCanvas.height = size + padding * 2 + 60;
    const ctx = downloadCanvas.getContext('2d');
    if (!ctx) return;

    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, downloadCanvas.width, downloadCanvas.height);
    ctx.drawImage(canvas, padding, padding, size, size);

    ctx.fillStyle = '#374151';
    ctx.font = '600 28px system-ui, -apple-system, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(
      `Réservez chez ${businessName}`,
      downloadCanvas.width / 2,
      size + padding + 48
    );

    const link = document.createElement('a');
    link.download = `qrcode-${slug}.png`;
    link.href = downloadCanvas.toDataURL('image/png');
    link.click();
  };

  const handleShare = async () => {
    if (navigator.share) {
      try {
        await navigator.share({
          title: `Réserver chez ${businessName}`,
          text: `Prenez rendez-vous en ligne chez ${businessName}`,
          url: bookingUrl,
        });
      } catch {
        // User cancelled
      }
    } else {
      handleCopy();
    }
  };

  return (
    <div className="mt-10 pt-8 border-t border-gray-200 dark:border-gray-800">
      <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 p-6">
        <div className="flex items-center gap-2 mb-4">
          <Share2 className="w-5 h-5 text-primary-600 dark:text-primary-400" />
          <h3 className="text-base font-semibold text-gray-900 dark:text-white">
            Partagez la page de réservation
          </h3>
        </div>

        <div className="flex flex-col sm:flex-row gap-6">
          {/* QR Code */}
          <div className="flex-shrink-0 flex justify-center">
            <div
              ref={qrRef}
              className="bg-white p-4 rounded-xl border border-gray-200 dark:border-gray-600 inline-block"
            >
              <QRCodeCanvas
                value={bookingUrl}
                size={160}
                level="H"
                marginSize={0}
              />
            </div>
          </div>

          {/* Actions */}
          <div className="flex-1 space-y-4">
            {/* URL */}
            <div>
              <label className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-1.5 block">
                Lien de réservation
              </label>
              <div className="flex items-center gap-2">
                <code className="flex-1 text-sm bg-gray-50 dark:bg-gray-800 px-3 py-2.5 rounded-lg border border-gray-200 dark:border-gray-700 truncate text-gray-900 dark:text-gray-100">
                  {bookingUrl}
                </code>
                <button
                  onClick={handleCopy}
                  className="p-2.5 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 border border-gray-200 dark:border-gray-700 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors flex-shrink-0"
                  title="Copier"
                >
                  {copied ? <Check className="w-4 h-4 text-green-500" /> : <Copy className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {/* Buttons */}
            <div className="flex flex-wrap gap-2">
              <button
                onClick={handleShare}
                className="inline-flex items-center gap-2 px-4 py-2.5 bg-primary-600 text-white hover:bg-primary-700 rounded-lg text-sm font-medium transition-colors"
              >
                <ExternalLink className="w-4 h-4" />
                Partager
              </button>
              <button
                onClick={handleDownload}
                className="inline-flex items-center gap-2 px-4 py-2.5 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700 rounded-lg text-sm font-medium transition-colors"
              >
                <Download className="w-4 h-4" />
                Télécharger le QR code
              </button>
            </div>

            <p className="text-xs text-gray-400 dark:text-gray-500">
              Partagez ce lien à vos clients pour qu&apos;ils puissent réserver directement en ligne.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

// --- Booking card ---

function BookingCard({ booking }: { booking: BookingItem }) {
  const datetime = new Date(booking.datetime);
  const endDatetime = new Date(booking.endDatetime);
  const isPast = datetime < new Date();
  const isPending = booking.status === 'pending';

  const timeStr = datetime.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
  const endTimeStr = endDatetime.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
  const priceStr = (booking.price / 100).toFixed(0) + ' €';

  return (
    <div className={`
      bg-white dark:bg-gray-900 rounded-xl border overflow-hidden transition-all
      ${isPending
        ? 'border-amber-300 dark:border-amber-700'
        : isPast
          ? 'border-gray-200 dark:border-gray-800 opacity-60'
          : 'border-gray-200 dark:border-gray-800'
      }
    `}>
      {/* Time bar + status */}
      <div className={`
        flex items-center justify-between px-4 py-2.5
        ${isPending
          ? 'bg-amber-50 dark:bg-amber-900/20'
          : 'bg-gray-50 dark:bg-gray-800/50'
        }
      `}>
        <div className="flex items-center gap-2">
          <Clock className="w-4 h-4 text-gray-500 dark:text-gray-400" />
          <span className="font-semibold text-gray-900 dark:text-white">
            {timeStr}
          </span>
          <span className="text-gray-400">—</span>
          <span className="text-sm text-gray-600 dark:text-gray-400">
            {endTimeStr}
          </span>
          <span className="text-xs text-gray-400 dark:text-gray-500">
            ({booking.duration} min)
          </span>
        </div>
        {isPending && (
          <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-400">
            En attente
          </span>
        )}
      </div>

      {/* Content */}
      <div className="px-4 py-3 space-y-3">
        {/* Service */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Tag className="w-4 h-4 text-primary-500" />
            <span className="font-medium text-gray-900 dark:text-white">
              {booking.serviceName}
            </span>
          </div>
          <span className="text-sm font-semibold text-gray-700 dark:text-gray-300">
            {priceStr}
          </span>
        </div>

        {/* Client info */}
        <div className="space-y-1.5">
          <div className="flex items-center gap-2 text-sm">
            <User className="w-3.5 h-3.5 text-gray-400" />
            <span className="text-gray-700 dark:text-gray-300">{booking.clientInfo.name}</span>
          </div>
          <div className="flex items-center gap-2 text-sm">
            <Mail className="w-3.5 h-3.5 text-gray-400" />
            <a
              href={`mailto:${booking.clientInfo.email}`}
              className="text-primary-600 dark:text-primary-400 hover:underline"
            >
              {booking.clientInfo.email}
            </a>
          </div>
          {booking.clientInfo.phone && (
            <div className="flex items-center gap-2 text-sm">
              <Phone className="w-3.5 h-3.5 text-gray-400" />
              <a
                href={`tel:${booking.clientInfo.phone}`}
                className="text-primary-600 dark:text-primary-400 hover:underline"
              >
                {booking.clientInfo.phone}
              </a>
            </div>
          )}
        </div>

        {/* Location */}
        <div className="flex items-start gap-2 text-sm pt-1 border-t border-gray-100 dark:border-gray-800">
          <MapPin className="w-3.5 h-3.5 text-gray-400 mt-0.5 flex-shrink-0" />
          <div>
            <span className="text-gray-600 dark:text-gray-400">{booking.locationName}</span>
            {booking.locationAddress && (
              <p className="text-xs text-gray-400 dark:text-gray-500">{booking.locationAddress}</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// --- Helpers ---

function formatDateHeader(dateKey: string): string {
  const date = new Date(dateKey + 'T00:00:00');
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);

  if (date.getTime() === today.getTime()) {
    return "Aujourd'hui";
  }
  if (date.getTime() === tomorrow.getTime()) {
    return 'Demain';
  }

  return date.toLocaleDateString('fr-FR', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  });
}
