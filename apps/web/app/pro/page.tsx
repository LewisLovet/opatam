'use client';

import { useMemo } from 'react';
import Link from 'next/link';
import {
  Calendar,
  Clock,
  Users,
  Star,
  ChevronRight,
  AlertCircle,
  Camera,
  Globe,
  Bell,
} from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui';

// Mock data for demonstration
const mockStats = {
  todayAppointments: 5,
  weekAppointments: 23,
  pendingAppointments: 3,
  averageRating: 4.8,
  totalReviews: 127,
};

const mockUpcomingBookings = [
  {
    id: '1',
    time: '09:00',
    clientName: 'Marie Dupont',
    service: 'Coupe femme',
    status: 'confirmed',
  },
  {
    id: '2',
    time: '10:30',
    clientName: 'Jean Martin',
    service: 'Coupe homme',
    status: 'confirmed',
  },
  {
    id: '3',
    time: '11:00',
    clientName: 'Sophie Leroy',
    service: 'Coloration',
    status: 'pending',
  },
  {
    id: '4',
    time: '14:00',
    clientName: 'Pierre Bernard',
    service: 'Barbe',
    status: 'confirmed',
  },
  {
    id: '5',
    time: '15:30',
    clientName: 'Camille Moreau',
    service: 'Brushing',
    status: 'confirmed',
  },
];

interface QuickAction {
  id: string;
  title: string;
  description: string;
  icon: React.ReactNode;
  href: string;
  priority: 'high' | 'medium' | 'low';
}

function getStatusBadge(status: string) {
  switch (status) {
    case 'confirmed':
      return (
        <span className="px-2 py-1 text-xs font-medium rounded-full bg-success-100 text-success-700 dark:bg-success-900/20 dark:text-success-400">
          Confirme
        </span>
      );
    case 'pending':
      return (
        <span className="px-2 py-1 text-xs font-medium rounded-full bg-warning-100 text-warning-700 dark:bg-warning-900/20 dark:text-warning-400">
          En attente
        </span>
      );
    case 'cancelled':
      return (
        <span className="px-2 py-1 text-xs font-medium rounded-full bg-error-100 text-error-700 dark:bg-error-900/20 dark:text-error-400">
          Annule
        </span>
      );
    default:
      return null;
  }
}

function formatDate(date: Date): string {
  return date.toLocaleDateString('fr-FR', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
}

export default function DashboardPage() {
  const { user, provider } = useAuth();

  const today = useMemo(() => new Date(), []);
  const greeting = useMemo(() => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Bonjour';
    if (hour < 18) return 'Bon apres-midi';
    return 'Bonsoir';
  }, []);

  // Determine quick actions based on profile completeness
  const quickActions = useMemo<QuickAction[]>(() => {
    const actions: QuickAction[] = [];

    if (!provider?.photoURL) {
      actions.push({
        id: 'photo',
        title: 'Ajoutez une photo de profil',
        description: 'Les clients aiment voir qui ils contactent',
        icon: <Camera className="w-5 h-5" />,
        href: '/pro/parametres',
        priority: 'high',
      });
    }

    if (!provider?.isPublished) {
      actions.push({
        id: 'publish',
        title: 'Publiez votre profil',
        description: 'Rendez-vous visible pour les clients',
        icon: <Globe className="w-5 h-5" />,
        href: '/pro/parametres',
        priority: 'high',
      });
    }

    if (provider?.settings?.reminderTimes?.length === 0) {
      actions.push({
        id: 'reminders',
        title: 'Configurez les rappels',
        description: 'Reduisez les absences avec des notifications',
        icon: <Bell className="w-5 h-5" />,
        href: '/pro/parametres',
        priority: 'medium',
      });
    }

    return actions;
  }, [provider]);

  return (
    <div className="space-y-8">
      {/* Welcome header */}
      <div>
        <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 dark:text-white">
          {greeting}, {user?.displayName?.split(' ')[0] || 'Prestataire'}
        </h1>
        <p className="mt-1 text-gray-600 dark:text-gray-400 capitalize">
          {formatDate(today)}
        </p>
      </div>

      {/* Stats cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Today's appointments */}
        <div className="bg-white dark:bg-gray-800 rounded-xl p-4 sm:p-6 border border-gray-200 dark:border-gray-700">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-primary-100 dark:bg-primary-900/30 text-primary-600 dark:text-primary-400">
              <Calendar className="w-5 h-5" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm text-gray-500 dark:text-gray-400">Aujourd&apos;hui</p>
              <p className="text-2xl font-bold text-gray-900 dark:text-white">
                {mockStats.todayAppointments}
              </p>
            </div>
          </div>
        </div>

        {/* Week's appointments */}
        <div className="bg-white dark:bg-gray-800 rounded-xl p-4 sm:p-6 border border-gray-200 dark:border-gray-700">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-success-100 dark:bg-success-900/30 text-success-600 dark:text-success-400">
              <Clock className="w-5 h-5" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm text-gray-500 dark:text-gray-400">Cette semaine</p>
              <p className="text-2xl font-bold text-gray-900 dark:text-white">
                {mockStats.weekAppointments}
              </p>
            </div>
          </div>
        </div>

        {/* Pending appointments */}
        <div className="bg-white dark:bg-gray-800 rounded-xl p-4 sm:p-6 border border-gray-200 dark:border-gray-700">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-warning-100 dark:bg-warning-900/30 text-warning-600 dark:text-warning-400">
              <Users className="w-5 h-5" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm text-gray-500 dark:text-gray-400">En attente</p>
              <p className="text-2xl font-bold text-gray-900 dark:text-white">
                {mockStats.pendingAppointments}
              </p>
            </div>
          </div>
        </div>

        {/* Average rating */}
        <div className="bg-white dark:bg-gray-800 rounded-xl p-4 sm:p-6 border border-gray-200 dark:border-gray-700">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-yellow-100 dark:bg-yellow-900/30 text-yellow-600 dark:text-yellow-400">
              <Star className="w-5 h-5" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm text-gray-500 dark:text-gray-400">Note moyenne</p>
              <div className="flex items-baseline gap-1">
                <p className="text-2xl font-bold text-gray-900 dark:text-white">
                  {mockStats.averageRating}
                </p>
                <span className="text-sm text-gray-500 dark:text-gray-400">
                  ({mockStats.totalReviews})
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Main content grid */}
      <div className="grid lg:grid-cols-3 gap-6">
        {/* Upcoming bookings */}
        <div className="lg:col-span-2 bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700">
          <div className="p-4 sm:p-6 border-b border-gray-200 dark:border-gray-700">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
                Prochains rendez-vous
              </h2>
              <Link
                href="/pro/reservations"
                className="text-sm font-medium text-primary-600 hover:text-primary-700 dark:text-primary-400 dark:hover:text-primary-300 flex items-center gap-1"
              >
                Voir tout
                <ChevronRight className="w-4 h-4" />
              </Link>
            </div>
          </div>

          <div className="divide-y divide-gray-200 dark:divide-gray-700">
            {mockUpcomingBookings.map((booking) => (
              <div
                key={booking.id}
                className="p-4 sm:px-6 flex items-center gap-4 hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors"
              >
                {/* Time */}
                <div className="text-center min-w-[60px]">
                  <p className="text-lg font-semibold text-gray-900 dark:text-white">
                    {booking.time}
                  </p>
                </div>

                {/* Client info */}
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-gray-900 dark:text-white truncate">
                    {booking.clientName}
                  </p>
                  <p className="text-sm text-gray-500 dark:text-gray-400 truncate">
                    {booking.service}
                  </p>
                </div>

                {/* Status */}
                {getStatusBadge(booking.status)}
              </div>
            ))}

            {mockUpcomingBookings.length === 0 && (
              <div className="p-8 text-center">
                <Calendar className="w-12 h-12 text-gray-300 dark:text-gray-600 mx-auto mb-3" />
                <p className="text-gray-500 dark:text-gray-400">
                  Aucun rendez-vous a venir
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Quick actions */}
        <div className="space-y-6">
          {quickActions.length > 0 && (
            <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700">
              <div className="p-4 sm:p-6 border-b border-gray-200 dark:border-gray-700">
                <h2 className="text-lg font-semibold text-gray-900 dark:text-white flex items-center gap-2">
                  <AlertCircle className="w-5 h-5 text-warning-500" />
                  Actions recommandees
                </h2>
              </div>

              <div className="divide-y divide-gray-200 dark:divide-gray-700">
                {quickActions.map((action) => (
                  <Link
                    key={action.id}
                    href={action.href}
                    className="block p-4 sm:px-6 hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors"
                  >
                    <div className="flex items-start gap-3">
                      <div
                        className={`p-2 rounded-lg ${
                          action.priority === 'high'
                            ? 'bg-warning-100 dark:bg-warning-900/30 text-warning-600 dark:text-warning-400'
                            : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400'
                        }`}
                      >
                        {action.icon}
                      </div>
                      <div className="flex-1">
                        <p className="font-medium text-gray-900 dark:text-white">
                          {action.title}
                        </p>
                        <p className="text-sm text-gray-500 dark:text-gray-400">
                          {action.description}
                        </p>
                      </div>
                      <ChevronRight className="w-5 h-5 text-gray-400 flex-shrink-0" />
                    </div>
                  </Link>
                ))}
              </div>
            </div>
          )}

          {/* Quick stats */}
          <div className="bg-gradient-to-br from-primary-500 to-primary-700 rounded-xl p-6 text-white">
            <h3 className="font-semibold mb-2">Conseil du jour</h3>
            <p className="text-sm text-primary-100 mb-4">
              Ajoutez des photos de vos realisations pour attirer plus de clients.
              Les profils avec photos recoivent 3x plus de reservations.
            </p>
            <Button
              variant="secondary"
              size="sm"
              className="bg-white text-primary-700 hover:bg-primary-50"
            >
              Ajouter des photos
            </Button>
          </div>

          {/* Trial banner (if applicable) */}
          {provider?.plan === 'trial' && (
            <div className="bg-gradient-to-br from-warning-500 to-warning-600 rounded-xl p-6 text-white">
              <h3 className="font-semibold mb-2">Periode d&apos;essai</h3>
              <p className="text-sm text-white/90 mb-4">
                Votre periode d&apos;essai expire bientot. Passez a un abonnement
                pour continuer a utiliser toutes les fonctionnalites.
              </p>
              <Button
                variant="secondary"
                size="sm"
                className="bg-white text-warning-700 hover:bg-warning-50"
              >
                Voir les offres
              </Button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
