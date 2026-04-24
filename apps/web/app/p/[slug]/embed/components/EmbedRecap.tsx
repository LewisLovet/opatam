'use client';

import { Calendar, Clock, MapPin, User, Euro } from 'lucide-react';

interface EmbedRecapService {
  name: string;
  duration: number;
  price: number;
  priceMax: number | null;
}

interface EmbedRecapMember {
  name: string;
  photoURL: string | null;
}

interface EmbedRecapLocation {
  name: string;
  city: string;
}

interface EmbedRecapProps {
  service: EmbedRecapService;
  member?: EmbedRecapMember | null;
  location?: EmbedRecapLocation | null;
  slotDatetime?: string | null;
}

function formatDuration(minutes: number): string {
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.floor(minutes / 60);
  const rem = minutes % 60;
  return rem === 0 ? `${hours}h` : `${hours}h${rem}`;
}

function formatPrice(cents: number, centsMax: number | null): string {
  if (cents === 0 && !centsMax) return 'Gratuit';
  const fmt = (v: number) =>
    new Intl.NumberFormat('fr-FR', {
      style: 'currency',
      currency: 'EUR',
      minimumFractionDigits: 0,
      maximumFractionDigits: 2,
    }).format(v / 100);
  if (centsMax && centsMax > cents) return `${fmt(cents)} – ${fmt(centsMax)}`;
  return fmt(cents);
}

function formatSlot(iso: string): { date: string; time: string } {
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
  return { date, time };
}

/**
 * Sticky sidebar shown on md+ while the user progresses through the flow.
 * Mirrors the recap on /p/[slug]/reserver but sized for a 240px column.
 */
export function EmbedRecap({ service, member, location, slotDatetime }: EmbedRecapProps) {
  const slot = slotDatetime ? formatSlot(slotDatetime) : null;

  return (
    <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50 overflow-hidden">
      <div className="px-3 py-2 border-b border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800">
        <p className="text-[11px] font-semibold uppercase tracking-wide text-primary-600 dark:text-primary-400">
          Votre réservation
        </p>
      </div>

      <div className="p-3 space-y-3 text-sm">
        {/* Service */}
        <div className="flex items-start gap-2">
          <Calendar className="w-4 h-4 text-gray-400 flex-shrink-0 mt-0.5" />
          <div className="min-w-0 flex-1">
            <p className="font-semibold text-gray-900 dark:text-white leading-snug">
              {service.name}
            </p>
            <div className="mt-0.5 flex items-center gap-2 text-[11px] text-gray-500 dark:text-gray-400">
              <span className="inline-flex items-center gap-1">
                <Clock className="w-3 h-3" />
                {formatDuration(service.duration)}
              </span>
              <span className="inline-flex items-center gap-1">
                <Euro className="w-3 h-3" />
                {formatPrice(service.price, service.priceMax)}
              </span>
            </div>
          </div>
        </div>

        {/* Member */}
        {member && (
          <div className="flex items-center gap-2 pt-2 border-t border-gray-200 dark:border-gray-700">
            <User className="w-4 h-4 text-gray-400 flex-shrink-0" />
            <p className="text-gray-700 dark:text-gray-300 text-[13px] truncate">
              avec <span className="font-medium text-gray-900 dark:text-white">{member.name}</span>
            </p>
          </div>
        )}

        {/* Date + Time */}
        {slot && (
          <div className="flex items-start gap-2 pt-2 border-t border-gray-200 dark:border-gray-700">
            <Clock className="w-4 h-4 text-gray-400 flex-shrink-0 mt-0.5" />
            <div className="min-w-0 flex-1">
              <p className="text-gray-900 dark:text-white text-[13px] capitalize font-medium">
                {slot.date}
              </p>
              <p className="text-gray-600 dark:text-gray-400 text-[11px]">
                à {slot.time}
              </p>
            </div>
          </div>
        )}

        {/* Location */}
        {location && (
          <div className="flex items-start gap-2 pt-2 border-t border-gray-200 dark:border-gray-700">
            <MapPin className="w-4 h-4 text-gray-400 flex-shrink-0 mt-0.5" />
            <div className="min-w-0 flex-1">
              <p className="text-gray-900 dark:text-white text-[13px] font-medium truncate">
                {location.name}
              </p>
              <p className="text-gray-600 dark:text-gray-400 text-[11px] truncate">
                {location.city}
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
