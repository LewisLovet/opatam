'use client';

/**
 * Live preview of the provider's public page, shown in the right panel of
 * the registration wizard. It mirrors the look of the real /p/[slug] fiche
 * but reads a lightweight payload pushed from the wizard form (via the
 * `register-data-change` window event) — no coupling to the server data
 * shape, so it can't regress the real page.
 */

import { MapPin, Clock, Star, Calendar, Scissors } from 'lucide-react';

export interface RegisterPreviewData {
  businessName: string;
  /** Category id (e.g. 'beauty') — drives the panel background gradient. */
  category: string;
  categoryLabel: string;
  description: string;
  city: string;
  address: string;
  cityOnly: boolean;
  services: { name: string; priceFrom: number; durationFrom: number; variable: boolean }[];
  /** Day indices (0=Sun … 6=Sat) that are marked open. */
  openDays: number[];
}

const DAY_LABELS = ['Dim', 'Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam'];
const DAY_DISPLAY_ORDER = [1, 2, 3, 4, 5, 6, 0]; // Mon → Sun

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '';
  return (parts[0][0] + (parts[1]?.[0] ?? '')).toUpperCase();
}

function formatEuro(v: number): string {
  return Number.isInteger(v) ? `${v} €` : `${v.toFixed(2)} €`;
}

function formatDuration(min: number): string {
  if (!min) return '';
  if (min < 60) return `${min} min`;
  const h = Math.floor(min / 60);
  const m = min % 60;
  return m === 0 ? `${h}h` : `${h}h${m}`;
}

function formatOpenDays(days: number[]): string {
  return DAY_DISPLAY_ORDER.filter((d) => days.includes(d))
    .map((d) => DAY_LABELS[d])
    .join(' · ');
}

function servicePrice(s: { priceFrom: number; variable: boolean }): string {
  if (s.priceFrom <= 0) return s.variable ? '—' : 'Gratuit';
  return s.variable ? `à partir de ${formatEuro(s.priceFrom)}` : formatEuro(s.priceFrom);
}

export function RegisterLivePreview({ data }: { data: RegisterPreviewData | null }) {
  const name = data?.businessName?.trim() || '';
  const services = (data?.services ?? []).filter((s) => s.name.trim());
  const locationText = data?.cityOnly
    ? data?.city || ''
    : [data?.address, data?.city].filter(Boolean).join(', ');

  return (
    <div className="w-full max-w-md xl:max-w-lg mx-auto">
      <p className="text-center text-primary-100 text-base mb-4">Aperçu de votre page</p>

      <div className="bg-white rounded-2xl shadow-2xl overflow-hidden text-left">
        {/* Cover — mirrors the real fiche (ProviderHero): blue gradient
            default + a soft dark overlay, with a circular avatar overlapping
            the bottom. */}
        <div className="h-28 relative bg-gradient-to-br from-primary-400 to-primary-600">
          <div className="absolute inset-0 bg-gradient-to-t from-black/40 via-transparent to-transparent" />
          <div className="absolute -bottom-9 left-6 w-24 h-24 rounded-full bg-white shadow-md flex items-center justify-center ring-4 ring-white">
            {name ? (
              <span className="text-primary-700 font-bold text-3xl">{initials(name)}</span>
            ) : (
              <Scissors className="w-9 h-9 text-primary-300" />
            )}
          </div>
        </div>

        <div className="px-7 pb-7" style={{ paddingTop: '3.25rem' }}>
          {/* Name */}
          {name ? (
            <h3 className="text-2xl font-bold text-gray-900 truncate">{name}</h3>
          ) : (
            <div className="h-8 w-56 rounded-md bg-gray-50 border border-dashed border-gray-300 flex items-center px-3 text-sm text-gray-400">
              Votre nom ici
            </div>
          )}

          {/* Category + rating */}
          <div className="mt-2 flex items-center gap-2 flex-wrap">
            {data?.categoryLabel && (
              <span className="px-2.5 py-1 rounded-full bg-primary-50 text-primary-700 text-sm font-medium">
                {data.categoryLabel}
              </span>
            )}
            <span className="inline-flex items-center gap-1 text-sm text-gray-400">
              <Star className="w-4 h-4 fill-amber-400 text-amber-400" /> Nouveau
            </span>
          </div>

          {/* Description */}
          {data?.description?.trim() && (
            <p className="mt-3 text-base text-gray-500 line-clamp-2">{data.description}</p>
          )}

          {/* Location */}
          {locationText && (
            <p className="mt-3 flex items-center gap-2 text-base text-gray-500">
              <MapPin className="w-5 h-5 text-gray-400 flex-shrink-0" />
              <span className="truncate">{locationText}</span>
            </p>
          )}

          {/* Services */}
          <div className="mt-5 border-t border-gray-100 pt-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-gray-400 mb-3">
              Prestations
            </p>
            {services.length > 0 ? (
              <ul className="space-y-3">
                {services.slice(0, 4).map((s, i) => (
                  <li key={i} className="flex items-center justify-between gap-3">
                    <span className="text-base font-medium text-gray-800 truncate">{s.name}</span>
                    <span className="text-sm text-gray-500 whitespace-nowrap">
                      {[formatDuration(s.durationFrom), servicePrice(s)].filter(Boolean).join(' · ')}
                    </span>
                  </li>
                ))}
                {services.length > 4 && (
                  <li className="text-sm text-gray-400">+{services.length - 4} autre(s)</li>
                )}
              </ul>
            ) : (
              <div className="space-y-3">
                {[0, 1].map((i) => (
                  <div key={i} className="flex items-center justify-between">
                    <div className="h-4 w-36 rounded bg-gray-100" />
                    <div className="h-4 w-16 rounded bg-gray-100" />
                  </div>
                ))}
                <p className="text-sm text-gray-400 pt-1">Vos prestations apparaîtront ici</p>
              </div>
            )}
          </div>

          {/* Hours */}
          {data?.openDays && data.openDays.length > 0 && (
            <p className="mt-4 flex items-center gap-2 text-sm text-gray-500">
              <Clock className="w-4 h-4 text-gray-400 flex-shrink-0" />
              Ouvert : {formatOpenDays(data.openDays)}
            </p>
          )}

          {/* Fake CTA */}
          <div className="mt-5 w-full py-3.5 rounded-xl bg-primary-600 text-white text-center text-base font-semibold flex items-center justify-center gap-2">
            <Calendar className="w-5 h-5" /> Réserver
          </div>
        </div>
      </div>

      <p className="text-center text-primary-100/80 text-sm mt-4">
        Sans commission · 30 jours offerts · Données protégées
      </p>
    </div>
  );
}
