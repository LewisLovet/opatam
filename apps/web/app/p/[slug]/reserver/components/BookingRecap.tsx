'use client';

import { Clock, MapPin, User, Calendar } from 'lucide-react';
import Image from 'next/image';

interface TimeSlotWithDate {
  date: string;
  start: string;
  end: string;
  datetime: string;
  endDatetime: string;
}

interface Service {
  id: string;
  name: string;
  description: string | null;
  duration: number;
  price: number;
  priceMax?: number | null;
  bufferTime: number;
  locationIds: string[];
  memberIds: string[] | null;
}

interface Member {
  id: string;
  name: string;
  photoURL: string | null;
  locationId: string;
  isDefault: boolean;
}

interface Location {
  id: string;
  name: string;
  address: string;
  city: string;
  postalCode: string;
  type: 'fixed' | 'mobile';
  protectAddress?: boolean;
  approxArea?: string | null;
}

interface Provider {
  id: string;
  businessName: string;
  slug: string;
  photoURL: string | null;
  plan: string;
}

interface BookingRecapProps {
  service: Service | null;
  /** Overrides the displayed service name (e.g. "2 prestations" for a
   *  multi-prestation cart). Falls back to service.name when omitted. */
  serviceLabel?: string;
  member: Member | null;
  location: Location | null;
  slot: TimeSlotWithDate | null;
  provider: Provider;
  compact?: boolean;
  /** Effective price/duration including the chosen variations/options.
   *  When provided they override the service base values. `effectivePrice` is
   *  the DISCOUNTED amount when a promo is active. */
  effectivePrice?: number;
  effectiveDuration?: number;
  /** Pre-discount total (cents) + active promo % — to render the crossed-out
   *  original price + a "−X%" badge. null/undefined = no promo. */
  originalPrice?: number | null;
  discountPercent?: number | null;
  /** Labels of the chosen variations/options to list under the service. */
  choiceLabels?: string[];
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

function formatPrice(cents: number, centsMax?: number | null): string {
  if (cents === 0 && !centsMax) return 'Gratuit';
  const fmt = (v: number) =>
    new Intl.NumberFormat('fr-FR', {
      style: 'currency',
      currency: 'EUR',
      minimumFractionDigits: 0,
      maximumFractionDigits: 2,
    }).format(v / 100);
  if (centsMax && centsMax > cents) return `De ${fmt(cents)} à ${fmt(centsMax)}`;
  return fmt(cents);
}

function formatDate(isoString: string): string {
  const date = new Date(isoString);
  return date.toLocaleDateString('fr-FR', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  });
}

export function BookingRecap({
  service,
  serviceLabel,
  member,
  location,
  slot,
  provider,
  compact = false,
  effectivePrice,
  effectiveDuration,
  originalPrice,
  discountPercent,
  choiceLabels = [],
}: BookingRecapProps) {
  const displayName = serviceLabel ?? service?.name ?? '';
  // When an effective price is given (variations/options), it's an exact
  // amount — drop the base range.
  const displayPrice = effectivePrice ?? service?.price ?? 0;
  const displayMax = effectivePrice != null ? null : service?.priceMax;
  const displayDuration = effectiveDuration ?? service?.duration ?? 0;
  // Active promo → show the crossed-out original + a "−X%" badge.
  const hasPromo =
    discountPercent != null && originalPrice != null && originalPrice > displayPrice;

  if (compact) {
    // Mobile compact version
    return (
      <div className="flex items-center justify-between">
        <div className="min-w-0 flex-1">
          {service ? (
            <>
              <p className="font-semibold text-gray-900 dark:text-white truncate">
                {displayName}
              </p>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                {formatDuration(displayDuration)} · {formatPrice(displayPrice, displayMax)}
              </p>
            </>
          ) : (
            <p className="text-gray-500 dark:text-gray-400">
              Sélectionnez une prestation
            </p>
          )}
        </div>
        {service && (
          <div className="text-right flex-shrink-0">
            {hasPromo && (
              <span className="block text-xs font-normal text-gray-400 line-through leading-none">
                {formatPrice(originalPrice!)}
              </span>
            )}
            <span
              className={`text-xl font-bold ${
                hasPromo ? 'text-rose-600 dark:text-rose-400' : 'text-gray-900 dark:text-white'
              }`}
            >
              {formatPrice(displayPrice, displayMax)}
            </span>
          </div>
        )}
      </div>
    );
  }

  // Desktop sidebar version
  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-5 sticky top-24">
      <h3 className="font-semibold text-gray-900 dark:text-white mb-4">
        Récapitulatif
      </h3>

      {/* Provider */}
      <div className="flex items-center gap-3 pb-4 border-b border-gray-200 dark:border-gray-700">
        {provider.photoURL ? (
          <Image
            src={provider.photoURL}
            alt={provider.businessName}
            width={40}
            height={40}
            className="w-10 h-10 rounded-full object-cover"
          />
        ) : (
          <div className="w-10 h-10 rounded-full bg-primary-100 dark:bg-primary-900/30 flex items-center justify-center">
            <span className="text-primary-600 dark:text-primary-400 font-semibold">
              {provider.businessName[0]}
            </span>
          </div>
        )}
        <div>
          <p className="font-medium text-gray-900 dark:text-white">
            {provider.businessName}
          </p>
        </div>
      </div>

      <div className="py-4 space-y-4">
        {/* Service */}
        {service ? (
          <div>
            <p className="text-sm text-gray-500 dark:text-gray-400 mb-1">
              Prestation
            </p>
            <p className="font-medium text-gray-900 dark:text-white">
              {displayName}
            </p>
          </div>
        ) : (
          <div className="text-sm text-gray-400 dark:text-gray-500">
            Sélectionnez une prestation
          </div>
        )}

        {/* Member */}
        {member && (
          <div>
            <p className="text-sm text-gray-500 dark:text-gray-400 mb-1">
              Professionnel
            </p>
            <div className="flex items-center gap-2">
              {member.photoURL ? (
                <Image
                  src={member.photoURL}
                  alt={member.name}
                  width={24}
                  height={24}
                  className="w-6 h-6 rounded-full object-cover"
                />
              ) : (
                <div className="w-6 h-6 rounded-full bg-gray-200 dark:bg-gray-700 flex items-center justify-center">
                  <User className="w-3 h-3 text-gray-400" />
                </div>
              )}
              <span className="font-medium text-gray-900 dark:text-white">
                {member.name}
              </span>
            </div>
          </div>
        )}

        {/* Location */}
        {location && (
          <div>
            <p className="text-sm text-gray-500 dark:text-gray-400 mb-1">
              Lieu
            </p>
            <div className="flex items-start gap-2">
              <MapPin className="w-4 h-4 text-gray-400 mt-0.5 flex-shrink-0" />
              <div>
                <p className="font-medium text-gray-900 dark:text-white">
                  {location.name}
                </p>
                {location.protectAddress ? (
                  <>
                    <p className="text-sm text-gray-500 dark:text-gray-400">
                      {location.approxArea?.trim() || `${location.postalCode} ${location.city}`.trim()}
                    </p>
                    <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">
                      Adresse exacte communiquée après confirmation
                    </p>
                  </>
                ) : (
                  <p className="text-sm text-gray-500 dark:text-gray-400">
                    {location.address
                      ? `${location.address}, ${location.postalCode} ${location.city}`
                      : `${location.postalCode} ${location.city}`}
                  </p>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Date & Time */}
        {slot && (
          <div>
            <p className="text-sm text-gray-500 dark:text-gray-400 mb-1">
              Date & Heure
            </p>
            <div className="flex items-center gap-2">
              <Calendar className="w-4 h-4 text-gray-400" />
              <div>
                <p className="font-medium text-gray-900 dark:text-white capitalize">
                  {formatDate(slot.datetime)}
                </p>
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  {slot.start} - {slot.end}
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Détail des choix (variations / options / réponses aux infos) —
            placé à la fin du récap, juste avant le total. */}
        {service && choiceLabels.length > 0 && (
          <div>
            <p className="text-sm text-gray-500 dark:text-gray-400 mb-1">
              Détail
            </p>
            <ul className="space-y-0.5">
              {choiceLabels.map((label, i) => (
                <li key={i} className="text-sm text-gray-700 dark:text-gray-300">
                  {label}
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>

      {/* Total + durée — mis en avant ensemble */}
      {service && (
        <div className="mt-1 pt-4 border-t border-gray-200 dark:border-gray-700 space-y-2">
          <div className="flex items-center justify-between">
            <span className="inline-flex items-center gap-1.5 text-sm font-medium text-gray-600 dark:text-gray-300">
              <Clock className="w-4 h-4" />
              Durée
            </span>
            <span className="text-base font-semibold text-gray-900 dark:text-white">
              {formatDuration(displayDuration)}
            </span>
          </div>
          <div className="flex items-end justify-between">
            <span className="text-base font-semibold text-gray-900 dark:text-white">
              Total
            </span>
            <span className="text-right leading-tight">
              {hasPromo && (
                <span className="block text-sm font-normal text-gray-400 line-through">
                  {formatPrice(originalPrice!)}
                </span>
              )}
              <span className="text-2xl font-extrabold text-primary-600 dark:text-primary-400">
                {formatPrice(displayPrice, displayMax)}
              </span>
            </span>
          </div>
          {hasPromo && (
            <p className="text-right text-xs font-semibold text-rose-600 dark:text-rose-400">
              Promotion −{discountPercent}% · vous économisez{' '}
              {formatPrice(originalPrice! - displayPrice)}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
