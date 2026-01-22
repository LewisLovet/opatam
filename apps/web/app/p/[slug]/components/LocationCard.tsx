'use client';

import { MapPin, Car, Building2, Navigation, ExternalLink } from 'lucide-react';

interface Location {
  id: string;
  name: string;
  address: string;
  city: string;
  postalCode: string;
  type: 'fixed' | 'mobile';
  travelRadius: number | null;
}

interface LocationCardProps {
  location: Location;
}

export function LocationCard({ location }: LocationCardProps) {
  const isFixed = location.type === 'fixed';
  const fullAddress = `${location.address}, ${location.postalCode} ${location.city}`;
  const mapsUrl = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(fullAddress)}`;

  return (
    <div className="group relative bg-white dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700 overflow-hidden transition-all duration-200 hover:shadow-lg hover:border-primary-200 dark:hover:border-primary-800">
      {/* Accent bar */}
      <div className="absolute left-0 top-0 bottom-0 w-1 bg-primary-500 opacity-0 group-hover:opacity-100 transition-opacity" />

      <div className="p-5">
        <div className="flex items-start gap-4">
          {/* Icon */}
          <div className={`
            w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0
            ${isFixed
              ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400'
              : 'bg-green-100 dark:bg-green-900/30 text-green-600 dark:text-green-400'
            }
          `}>
            {isFixed ? (
              <Building2 className="w-6 h-6" />
            ) : (
              <Car className="w-6 h-6" />
            )}
          </div>

          {/* Content */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <h4 className="font-semibold text-gray-900 dark:text-white truncate">
                {location.name}
              </h4>
              <span className={`
                px-2 py-0.5 text-xs font-medium rounded-full
                ${isFixed
                  ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400'
                  : 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400'
                }
              `}>
                {isFixed ? 'Salon' : 'Mobile'}
              </span>
            </div>

            {isFixed ? (
              <>
                <p className="text-sm text-gray-600 dark:text-gray-400 mb-3">
                  {location.address}
                  <br />
                  {location.postalCode} {location.city}
                </p>

                {/* Google Maps link */}
                <a
                  href={mapsUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 text-sm font-medium text-primary-600 dark:text-primary-400 hover:text-primary-700 dark:hover:text-primary-300 transition-colors"
                >
                  <Navigation className="w-4 h-4" />
                  Voir sur Google Maps
                  <ExternalLink className="w-3 h-3 opacity-50" />
                </a>
              </>
            ) : (
              <p className="text-sm text-gray-600 dark:text-gray-400">
                <span className="flex items-center gap-1.5">
                  <MapPin className="w-4 h-4" />
                  Déplacement à domicile
                  {location.travelRadius && (
                    <span className="text-gray-500 dark:text-gray-500">
                      • Rayon de {location.travelRadius} km
                    </span>
                  )}
                </span>
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
