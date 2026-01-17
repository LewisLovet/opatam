'use client';

import { Button } from '../ui/Button';
import { Card } from '../ui/Card';

interface ServiceCardProps {
  service: {
    id: string;
    name: string;
    description?: string | null;
    duration: number;
    price: number;
  };
  onSelect?: (serviceId: string) => void;
  selected?: boolean;
  showBookButton?: boolean;
  className?: string;
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

function formatPrice(price: number): string {
  return new Intl.NumberFormat('fr-FR', {
    style: 'currency',
    currency: 'EUR',
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(price);
}

export function ServiceCard({
  service,
  onSelect,
  selected = false,
  showBookButton = true,
  className = '',
}: ServiceCardProps) {
  const handleClick = () => {
    if (onSelect) {
      onSelect(service.id);
    }
  };

  return (
    <Card
      variant="bordered"
      className={`
        transition-all
        ${selected ? 'ring-2 ring-primary-500 border-primary-500' : ''}
        ${onSelect ? 'cursor-pointer hover:border-gray-300 dark:hover:border-gray-600' : ''}
        ${className}
      `}
      onClick={onSelect ? handleClick : undefined}
    >
      <div className="p-4">
        <div className="flex items-start justify-between gap-4">
          {/* Service Info */}
          <div className="flex-1 min-w-0">
            <h3 className="font-semibold text-gray-900 dark:text-white">
              {service.name}
            </h3>
            {service.description && (
              <p className="mt-1 text-sm text-gray-600 dark:text-gray-400 line-clamp-2">
                {service.description}
              </p>
            )}
            <div className="mt-2 flex items-center gap-3 text-sm text-gray-500 dark:text-gray-400">
              <span className="inline-flex items-center gap-1">
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                {formatDuration(service.duration)}
              </span>
            </div>
          </div>

          {/* Price & Action */}
          <div className="flex flex-col items-end gap-2">
            <span className="text-lg font-bold text-gray-900 dark:text-white">
              {formatPrice(service.price)}
            </span>
            {showBookButton && onSelect && (
              <Button
                size="sm"
                variant={selected ? 'primary' : 'outline'}
                onClick={(e) => {
                  e.stopPropagation();
                  handleClick();
                }}
              >
                {selected ? 'Sélectionné' : 'Sélectionner'}
              </Button>
            )}
          </div>
        </div>

        {/* Selected indicator */}
        {selected && (
          <div className="mt-3 pt-3 border-t border-primary-100 dark:border-primary-900 flex items-center gap-2 text-sm text-primary-600 dark:text-primary-400">
            <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
            </svg>
            <span>Prestation sélectionnée</span>
          </div>
        )}
      </div>
    </Card>
  );
}
