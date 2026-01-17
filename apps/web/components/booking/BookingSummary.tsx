'use client';

import { Card, CardBody, CardHeader } from '../ui/Card';
import { Avatar } from '../ui/Avatar';

interface BookingSummaryProps {
  service: {
    name: string;
    duration: number;
    price: number;
  };
  datetime: Date;
  location: {
    name: string;
    address: string;
  };
  member?: {
    name: string;
    photoURL?: string | null;
  } | null;
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

function formatDateTime(date: Date): string {
  return date.toLocaleDateString('fr-FR', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
}

function formatTime(date: Date): string {
  return date.toLocaleTimeString('fr-FR', {
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function BookingSummary({
  service,
  datetime,
  location,
  member,
  className = '',
}: BookingSummaryProps) {
  return (
    <Card variant="bordered" className={className}>
      <CardHeader title="Récapitulatif" />
      <CardBody className="space-y-4">
        {/* Service */}
        <div className="flex items-start gap-3">
          <div className="flex-shrink-0 w-10 h-10 rounded-lg bg-primary-100 dark:bg-primary-900/30 flex items-center justify-center">
            <svg className="w-5 h-5 text-primary-600 dark:text-primary-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
            </svg>
          </div>
          <div className="flex-1">
            <h4 className="font-medium text-gray-900 dark:text-white">{service.name}</h4>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              {formatDuration(service.duration)}
            </p>
          </div>
          <span className="font-semibold text-gray-900 dark:text-white">
            {formatPrice(service.price)}
          </span>
        </div>

        {/* Date & Time */}
        <div className="flex items-start gap-3">
          <div className="flex-shrink-0 w-10 h-10 rounded-lg bg-primary-100 dark:bg-primary-900/30 flex items-center justify-center">
            <svg className="w-5 h-5 text-primary-600 dark:text-primary-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
          </div>
          <div>
            <h4 className="font-medium text-gray-900 dark:text-white capitalize">
              {formatDateTime(datetime)}
            </h4>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              à {formatTime(datetime)}
            </p>
          </div>
        </div>

        {/* Location */}
        <div className="flex items-start gap-3">
          <div className="flex-shrink-0 w-10 h-10 rounded-lg bg-primary-100 dark:bg-primary-900/30 flex items-center justify-center">
            <svg className="w-5 h-5 text-primary-600 dark:text-primary-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
          </div>
          <div>
            <h4 className="font-medium text-gray-900 dark:text-white">{location.name}</h4>
            <p className="text-sm text-gray-500 dark:text-gray-400">{location.address}</p>
          </div>
        </div>

        {/* Member (if selected) */}
        {member && (
          <div className="flex items-start gap-3">
            <Avatar src={member.photoURL} alt={member.name} size="md" />
            <div>
              <h4 className="font-medium text-gray-900 dark:text-white">{member.name}</h4>
              <p className="text-sm text-gray-500 dark:text-gray-400">Professionnel</p>
            </div>
          </div>
        )}

        {/* Divider */}
        <div className="border-t border-gray-200 dark:border-gray-700 pt-4">
          <div className="flex items-center justify-between">
            <span className="text-base font-medium text-gray-900 dark:text-white">Total</span>
            <span className="text-xl font-bold text-primary-600 dark:text-primary-400">
              {formatPrice(service.price)}
            </span>
          </div>
        </div>
      </CardBody>
    </Card>
  );
}
