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
  member: Member | null;
  location: Location | null;
  slot: TimeSlotWithDate | null;
  provider: Provider;
  compact?: boolean;
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
  member,
  location,
  slot,
  provider,
  compact = false,
}: BookingRecapProps) {
  if (compact) {
    // Mobile compact version
    return (
      <div className="flex items-center justify-between">
        <div className="min-w-0 flex-1">
          {service ? (
            <>
              <p className="font-semibold text-gray-900 dark:text-white truncate">
                {service.name}
              </p>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                {formatDuration(service.duration)} · {formatPrice(service.price)}
              </p>
            </>
          ) : (
            <p className="text-gray-500 dark:text-gray-400">
              Sélectionnez une prestation
            </p>
          )}
        </div>
        {service && (
          <span className="text-xl font-bold text-gray-900 dark:text-white">
            {formatPrice(service.price)}
          </span>
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
              {service.name}
            </p>
            <div className="flex items-center gap-1.5 text-sm text-gray-500 dark:text-gray-400 mt-1">
              <Clock className="w-4 h-4" />
              <span>{formatDuration(service.duration)}</span>
            </div>
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
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  {location.address}, {location.postalCode} {location.city}
                </p>
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
      </div>

      {/* Total */}
      {service && (
        <div className="pt-4 border-t border-gray-200 dark:border-gray-700">
          <div className="flex items-center justify-between">
            <span className="font-medium text-gray-900 dark:text-white">
              Total
            </span>
            <span className="text-xl font-bold text-gray-900 dark:text-white">
              {formatPrice(service.price)}
            </span>
          </div>
        </div>
      )}
    </div>
  );
}
