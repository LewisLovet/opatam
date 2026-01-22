import type { BookingStatus } from '@booking-app/shared';

export const statusConfig: Record<
  BookingStatus,
  { label: string; color: string; bgColor: string; dotColor: string }
> = {
  pending: {
    label: 'En attente',
    color: 'text-warning-700 dark:text-warning-300',
    bgColor: 'bg-warning-100 dark:bg-warning-900/30',
    dotColor: 'bg-warning-500',
  },
  confirmed: {
    label: 'Confirmé',
    color: 'text-success-700 dark:text-success-300',
    bgColor: 'bg-success-100 dark:bg-success-900/30',
    dotColor: 'bg-success-500',
  },
  cancelled: {
    label: 'Annulé',
    color: 'text-gray-600 dark:text-gray-400',
    bgColor: 'bg-gray-100 dark:bg-gray-800',
    dotColor: 'bg-gray-400',
  },
  completed: {
    label: 'Terminé',
    color: 'text-primary-700 dark:text-primary-300',
    bgColor: 'bg-primary-100 dark:bg-primary-900/30',
    dotColor: 'bg-primary-500',
  },
  noshow: {
    label: 'Absent',
    color: 'text-error-700 dark:text-error-300',
    bgColor: 'bg-error-100 dark:bg-error-900/30',
    dotColor: 'bg-error-500',
  },
};

export const CANCEL_REASONS = [
  { value: '', label: 'Sélectionner un motif...' },
  { value: 'client_request', label: 'Demande du client' },
  { value: 'client_unavailable', label: 'Client indisponible' },
  { value: 'provider_unavailable', label: 'Prestataire indisponible' },
  { value: 'schedule_conflict', label: "Conflit d'horaire" },
  { value: 'emergency', label: 'Urgence' },
  { value: 'other', label: 'Autre (préciser)' },
];

export function formatBookingDate(date: Date): string {
  return new Date(date).toLocaleDateString('fr-FR', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
}

export function formatBookingTime(date: Date): string {
  return new Date(date).toLocaleTimeString('fr-FR', {
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function formatBookingPrice(priceInCentimes: number): string {
  const priceInEuros = priceInCentimes / 100;
  return new Intl.NumberFormat('fr-FR', {
    style: 'currency',
    currency: 'EUR',
  }).format(priceInEuros);
}

export function formatDuration(minutes: number): string {
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
