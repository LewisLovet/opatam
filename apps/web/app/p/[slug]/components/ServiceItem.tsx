'use client';

import { useRef, useState, useEffect, Fragment } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { Clock, ArrowRight, X } from 'lucide-react';
import {
  getServiceMinDuration,
  getDiscountedMinPrice,
  resolveServiceDiscount,
  getDiscountDaysLeft,
  formatPromoCountdown,
  type ServiceVariation,
  type ServiceOption,
  type ServiceDiscount,
} from '@booking-app/shared';

interface ServiceItemProps {
  service: {
    id: string;
    name: string;
    description: string | null;
    photoURL?: string | null;
    duration: number;
    price: number;
    priceMax?: number | null;
    variations?: ServiceVariation[];
    options?: ServiceOption[];
    discount?: ServiceDiscount | null;
  };
  slug: string;
  /** Shop-wide promo, applied to services without their own. */
  globalDiscount?: ServiceDiscount | null;
  /** If set, intercepts booking click to show a notice before navigating */
  onBookingClick?: (url: string) => void;
}

function formatDuration(minutes: number): string {
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.floor(minutes / 60);
  const rem = minutes % 60;
  return rem === 0 ? `${hours}h` : `${hours}h${rem}`;
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

export function ServiceItem({ service, slug, globalDiscount, onBookingClick }: ServiceItemProps) {
  const [descExpanded, setDescExpanded] = useState(false);
  const [descClamped, setDescClamped] = useState(false);
  const [photoOpen, setPhotoOpen] = useState(false);
  const descRef = useRef<HTMLParagraphElement>(null);

  // Price varies when the service has variations or optional add-ons.
  const priceVaries =
    (service.variations?.length ?? 0) > 0 || (service.options?.length ?? 0) > 0;

  // Active promotion → crossed-out original + discounted "from" price + badge.
  const { price: minPrice, original: minOriginal, discountPercent } = getDiscountedMinPrice(
    service,
    globalDiscount,
  );
  const hasPromo = discountPercent != null && minPrice < minOriginal;
  // Countdown — surfaced only when the promo is ending soon (≤ 7 days) to
  // create urgency without cluttering every card.
  const promoDaysLeft = hasPromo
    ? getDiscountDaysLeft(resolveServiceDiscount(service, globalDiscount))
    : null;
  const showCountdown = promoDaysLeft != null && promoDaysLeft <= 7;

  useEffect(() => {
    // Small delay to let the layout settle before measuring
    const timer = setTimeout(() => {
      const el = descRef.current;
      if (el) setDescClamped(el.scrollHeight > el.clientHeight + 1);
    }, 50);
    return () => clearTimeout(timer);
  }, [service.description]);

  return (
    <Fragment>
      <Link
        href={`/p/${slug}/reserver?service=${service.id}`}
        className="block group"
        onClick={onBookingClick ? (e) => {
          e.preventDefault();
          onBookingClick(`/p/${slug}/reserver?service=${service.id}`);
        } : undefined}
      >
        <div className="relative bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 overflow-hidden transition-all duration-200 hover:shadow-lg hover:scale-[1.01] hover:border-primary-200 dark:hover:border-primary-800">
          <div className="absolute left-0 top-0 bottom-0 w-1 bg-primary-500 opacity-0 group-hover:opacity-100 transition-opacity" />

          <div className="p-4 sm:p-5 pl-5 sm:pl-6">
            {/* Top row: photo + title + price */}
            <div className="flex items-start gap-3 sm:gap-4">
              {service.photoURL && (
                <button
                  type="button"
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    setPhotoOpen(true);
                  }}
                  className="flex-shrink-0 w-16 h-16 sm:w-20 sm:h-20 rounded-lg overflow-hidden relative cursor-zoom-in hover:opacity-90 transition-opacity"
                >
                  <Image src={service.photoURL} alt={service.name} fill className="object-cover" />
                </button>
              )}

              <div className="flex-1 min-w-0">
                <h3 className="font-semibold text-gray-900 dark:text-white text-base sm:text-lg group-hover:text-primary-600 dark:group-hover:text-primary-400 transition-colors">
                  {service.name}
                </h3>
                <div className="mt-1 flex items-center gap-1.5 text-sm text-gray-400 dark:text-gray-500">
                  <Clock className="w-4 h-4" />
                  <span>{formatDuration(getServiceMinDuration(service))}</span>
                </div>
              </div>

              <div className="flex flex-col items-end gap-2 flex-shrink-0">
                <div className="text-right">
                  {priceVaries && (
                    <span className="block text-[11px] font-normal text-gray-400 leading-none mb-0.5">
                      à partir de
                    </span>
                  )}
                  {hasPromo && (
                    <span className="block text-xs font-normal text-gray-400 line-through leading-none">
                      {formatPrice(minOriginal)}
                    </span>
                  )}
                  <span className="inline-flex items-center gap-1.5">
                    <span
                      className={`text-lg sm:text-xl font-bold ${
                        hasPromo
                          ? 'text-rose-600 dark:text-rose-400'
                          : 'text-gray-900 dark:text-white'
                      }`}
                    >
                      {formatPrice(minPrice)}
                    </span>
                    {hasPromo && (
                      <span className="text-[11px] font-bold text-white bg-rose-500 px-1.5 py-0.5 rounded">
                        −{discountPercent}%
                      </span>
                    )}
                  </span>
                  {showCountdown && (
                    <span className="block text-[10px] font-semibold text-rose-500 dark:text-rose-400 leading-tight mt-0.5">
                      {formatPromoCountdown(promoDaysLeft)}
                    </span>
                  )}
                </div>
                <span className="inline-flex items-center gap-1.5 px-3 sm:px-4 py-1.5 sm:py-2 bg-primary-600 text-white text-sm font-medium rounded-lg group-hover:bg-primary-700 transition-colors shadow-sm">
                  Reserver
                  <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-0.5" />
                </span>
              </div>
            </div>

            {/* Description below */}
            {service.description && (
              <div className="mt-3">
                <p
                  ref={descRef}
                  className={`text-sm text-gray-500 dark:text-gray-400 ${!descExpanded ? 'line-clamp-2' : ''}`}
                >
                  {service.description}
                </p>
                {(descClamped || (service.description && service.description.length > 100)) && (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      setDescExpanded((v) => !v);
                    }}
                    className="text-sm text-primary-600 dark:text-primary-400 hover:underline mt-0.5"
                  >
                    {descExpanded ? 'Moins' : 'Plus de details'}
                  </button>
                )}
              </div>
            )}
          </div>
        </div>
      </Link>

      {/* Photo lightbox */}
      {photoOpen && service.photoURL && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4"
          onClick={() => setPhotoOpen(false)}
        >
          <button
            type="button"
            onClick={() => setPhotoOpen(false)}
            className="absolute top-4 right-4 w-10 h-10 rounded-full bg-black/50 text-white flex items-center justify-center hover:bg-black/70 transition-colors z-10"
          >
            <X className="w-5 h-5" />
          </button>
          <Image
            src={service.photoURL}
            alt={service.name}
            width={800}
            height={800}
            className="max-w-full max-h-[85vh] object-contain rounded-xl"
          />
        </div>
      )}
    </Fragment>
  );
}
