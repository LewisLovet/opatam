'use client';

import { useRef, useState, useEffect } from 'react';
import Link from 'next/link';
import { Clock, ArrowRight } from 'lucide-react';

interface ServiceItemProps {
  service: {
    id: string;
    name: string;
    description: string | null;
    duration: number;
    price: number;
  };
  slug: string;
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
  if (cents === 0) return 'Gratuit';
  const euros = cents / 100;
  return new Intl.NumberFormat('fr-FR', {
    style: 'currency',
    currency: 'EUR',
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(euros);
}

export function ServiceItem({ service, slug }: ServiceItemProps) {
  const [descExpanded, setDescExpanded] = useState(false);
  const [descClamped, setDescClamped] = useState(false);
  const descRef = useRef<HTMLParagraphElement>(null);

  useEffect(() => {
    const el = descRef.current;
    if (el) {
      setDescClamped(el.scrollHeight > el.clientHeight);
    }
  }, [service.description]);

  return (
    <Link href={`/p/${slug}/reserver?service=${service.id}`} className="block group">
      <div className="relative bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 overflow-hidden transition-all duration-200 hover:shadow-lg hover:scale-[1.01] hover:border-primary-200 dark:hover:border-primary-800">
        {/* Colored left border accent */}
        <div className="absolute left-0 top-0 bottom-0 w-1 bg-primary-500 opacity-0 group-hover:opacity-100 transition-opacity" />

        <div className="p-5 pl-6">
          <div className="flex items-start justify-between gap-4">
            {/* Service Info */}
            <div className="flex-1 min-w-0">
              <h3 className="font-semibold text-gray-900 dark:text-white text-lg group-hover:text-primary-600 dark:group-hover:text-primary-400 transition-colors">
                {service.name}
              </h3>
              {service.description && (
                <div className="mt-1.5">
                  <p
                    ref={descRef}
                    className={`text-sm text-gray-500 dark:text-gray-400 ${!descExpanded ? 'line-clamp-2' : ''}`}
                  >
                    {service.description}
                  </p>
                  {descClamped && (
                    <button
                      type="button"
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        setDescExpanded((v) => !v);
                      }}
                      className="text-sm text-primary-600 dark:text-primary-400 hover:underline mt-0.5"
                    >
                      {descExpanded ? 'Moins' : 'Plus de détails'}
                    </button>
                  )}
                </div>
              )}
              <div className="mt-3 flex items-center gap-1.5 text-sm text-gray-400 dark:text-gray-500">
                <Clock className="w-4 h-4" />
                <span>{formatDuration(service.duration)}</span>
              </div>
            </div>

            {/* Price & CTA */}
            <div className="flex flex-col items-end gap-3 flex-shrink-0">
              <span className="text-xl font-bold text-gray-900 dark:text-white">
                {formatPrice(service.price)}
              </span>
              <span className="inline-flex items-center gap-1.5 px-4 py-2 bg-primary-600 text-white text-sm font-medium rounded-lg group-hover:bg-primary-700 transition-colors shadow-sm">
                Réserver
                <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-0.5" />
              </span>
            </div>
          </div>
        </div>
      </div>
    </Link>
  );
}
