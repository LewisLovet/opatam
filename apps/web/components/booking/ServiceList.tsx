'use client';

import { ServiceCard } from './ServiceCard';

interface Service {
  id: string;
  name: string;
  description?: string | null;
  duration: number;
  price: number;
}

interface ServiceListProps {
  services: Service[];
  selectedId?: string | null;
  onSelect?: (serviceId: string) => void;
  showBookButton?: boolean;
  className?: string;
}

export function ServiceList({
  services,
  selectedId,
  onSelect,
  showBookButton = true,
  className = '',
}: ServiceListProps) {
  if (services.length === 0) {
    return (
      <div className={`text-center py-8 ${className}`}>
        <svg
          className="mx-auto h-12 w-12 text-gray-400"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={1.5}
            d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"
          />
        </svg>
        <h3 className="mt-2 text-sm font-medium text-gray-900 dark:text-white">
          Aucune prestation
        </h3>
        <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
          Aucune prestation disponible pour le moment.
        </p>
      </div>
    );
  }

  return (
    <div className={`space-y-3 ${className}`}>
      {services.map((service) => (
        <ServiceCard
          key={service.id}
          service={service}
          selected={selectedId === service.id}
          onSelect={onSelect}
          showBookButton={showBookButton}
        />
      ))}
    </div>
  );
}
