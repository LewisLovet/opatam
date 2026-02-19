'use client';

import { useState, useEffect, useMemo, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { Calendar, Clock, Eye, Star, Globe, GlobeLock } from 'lucide-react';
import Link from 'next/link';
import { useAuth } from '@/contexts/AuthContext';
import {
  bookingService,
  memberService,
  locationService,
  catalogService,
  analyticsService,
} from '@booking-app/firebase';
import type { Booking, Member, Location, Service, PageViewStats } from '@booking-app/shared';
import { BookingDetailModal } from '@/components/booking';
import { CreateBookingModal } from './calendrier/components/CreateBookingModal';
import {
  StatCard,
  AlertCard,
  TodayBookings,
  RecentActivity,
  QuickActions,
  type Alert,
} from './components';
import { getStartOfWeek, getEndOfWeek, getDaysRemaining, formatFullDate } from '@/lib/date-utils';

type WithId<T> = { id: string } & T;

export default function DashboardPage() {
  const router = useRouter();
  const { user, provider } = useAuth();

  // Data states
  const [todayBookings, setTodayBookings] = useState<WithId<Booking>[]>([]);
  const [upcomingBookings, setUpcomingBookings] = useState<WithId<Booking>[]>([]);
  const [recentCancellations, setRecentCancellations] = useState<WithId<Booking>[]>([]);
  const [weekBookingsCount, setWeekBookingsCount] = useState(0);
  const [members, setMembers] = useState<WithId<Member>[]>([]);
  const [locations, setLocations] = useState<WithId<Location>[]>([]);
  const [alerts, setAlerts] = useState<Alert[]>([]);

  // Page views (real-time)
  const [pageViewStats, setPageViewStats] = useState<PageViewStats>({
    today: 0,
    total: 0,
    last7Days: 0,
    last30Days: 0,
  });

  // Loading state
  const [loading, setLoading] = useState(true);

  // Modal states
  const [selectedBooking, setSelectedBooking] = useState<WithId<Booking> | null>(null);
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);

  const isTeamPlan = provider?.plan === 'team' || provider?.plan === 'trial';

  // Greeting based on time of day
  const greeting = useMemo(() => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Bonjour';
    if (hour < 18) return 'Bon apres-midi';
    return 'Bonsoir';
  }, []);

  // Build alerts based on provider state and data
  const buildAlerts = useCallback(
    (
      pendingBookings: WithId<Booking>[],
      locationsData: WithId<Location>[],
      servicesData: WithId<Service>[]
    ): Alert[] => {
      if (!provider) return [];

      const alerts: Alert[] = [];

      // 1. Pending bookings
      if (pendingBookings.length > 0) {
        alerts.push({
          id: 'pending',
          message: `${pendingBookings.length} RDV en attente de confirmation`,
          action: 'Voir les réservations',
          href: '/pro/reservations?status=pending',
          priority: 'high',
        });
      }

      // 2. Trial period
      if (provider.subscription?.plan === 'trial' && provider.subscription?.validUntil) {
        const daysRemaining = getDaysRemaining(provider.subscription.validUntil);
        if (daysRemaining <= 14) {
          alerts.push({
            id: 'trial',
            message: `Période d'essai : ${daysRemaining} jours restants`,
            action: 'Voir les offres',
            href: '/pro/parametres?tab=abonnement',
            priority: daysRemaining <= 3 ? 'high' : 'medium',
          });
        }
      }

      // 3. Profile not published
      if (!provider.isPublished) {
        alerts.push({
          id: 'unpublished',
          message: "Votre page n'est pas encore active",
          action: 'Activer',
          href: '/pro/profil?tab=publication',
          priority: 'high',
        });
      }

      // 4. No profile photo
      if (!provider.photoURL) {
        alerts.push({
          id: 'no-photo',
          message: 'Ajoutez une photo de profil',
          action: 'Ajouter',
          href: '/pro/profil?tab=photos',
          priority: 'medium',
        });
      }

      // 5. No portfolio photos
      if (!provider.portfolioPhotos || provider.portfolioPhotos.length === 0) {
        alerts.push({
          id: 'no-portfolio',
          message: 'Ajoutez des photos à votre portfolio',
          action: 'Ajouter',
          href: '/pro/profil?tab=photos',
          priority: 'low',
        });
      }

      // 6. No locations
      if (locationsData.length === 0) {
        alerts.push({
          id: 'no-location',
          message: 'Ajoutez un lieu pour recevoir des réservations',
          action: 'Configurer',
          href: '/pro/activite?tab=lieux',
          priority: 'high',
        });
      }

      // 7. No services
      if (servicesData.length === 0) {
        alerts.push({
          id: 'no-service',
          message: 'Créez votre première prestation',
          action: 'Créer',
          href: '/pro/activite?tab=prestations',
          priority: 'high',
        });
      }

      return alerts;
    },
    [provider]
  );

  // Load dashboard data
  const loadDashboardData = useCallback(async () => {
    if (!provider) return;

    setLoading(true);
    try {
      const today = new Date();
      const startOfToday = new Date(today);
      startOfToday.setHours(0, 0, 0, 0);

      const endOfToday = new Date(today);
      endOfToday.setHours(23, 59, 59, 999);

      const startOfWeek = getStartOfWeek(today);
      const endOfWeek = getEndOfWeek(today);

      // Load all data in parallel
      const [
        todayData,
        pendingData,
        weekData,
        upcomingData,
        cancellationsData,
        membersData,
        locationsData,
        servicesData,
      ] = await Promise.all([
        bookingService.getTodayBookings(provider.id),
        bookingService.getPendingBookings(provider.id),
        bookingService.getProviderBookings(provider.id, {
          startDate: startOfWeek,
          endDate: endOfWeek,
          status: ['pending', 'confirmed'],
        }),
        bookingService.getProviderBookings(provider.id, {
          startDate: endOfToday,
          limit: 5,
          status: ['pending', 'confirmed'],
        }),
        bookingService.getProviderBookings(provider.id, {
          status: ['cancelled'],
          limit: 5,
        }),
        isTeamPlan ? memberService.getByProvider(provider.id) : Promise.resolve([]),
        locationService.getByProvider(provider.id),
        catalogService.getByProvider(provider.id),
      ]);

      // Filter today's bookings to exclude cancelled
      const activeTodayBookings = todayData.filter(
        (b: WithId<Booking>) => b.status === 'pending' || b.status === 'confirmed'
      );

      // Filter upcoming to exclude today's bookings
      const futureBookings = upcomingData.filter((b: WithId<Booking>) => {
        const bookingDate = new Date(b.datetime);
        return bookingDate > endOfToday;
      });

      // Sort cancellations by cancellation date (most recent first)
      const sortedCancellations = cancellationsData.sort((a: WithId<Booking>, b: WithId<Booking>) => {
        const dateA = a.cancelledAt ? new Date(a.cancelledAt).getTime() : 0;
        const dateB = b.cancelledAt ? new Date(b.cancelledAt).getTime() : 0;
        return dateB - dateA;
      });

      setTodayBookings(activeTodayBookings);
      setUpcomingBookings(futureBookings);
      setRecentCancellations(sortedCancellations.slice(0, 3));
      setWeekBookingsCount(weekData.length);
      setMembers(membersData.filter((m: WithId<Member>) => m.isActive));
      setLocations(locationsData.filter((l: WithId<Location>) => l.isActive));

      // Build alerts (servicesData used for alerts, not stored in state)
      const builtAlerts = buildAlerts(pendingData, locationsData, servicesData);
      setAlerts(builtAlerts);
    } catch (error) {
      console.error('[Dashboard] Error loading data:', error);
    } finally {
      setLoading(false);
    }
  }, [provider, isTeamPlan, buildAlerts]);

  useEffect(() => {
    loadDashboardData();
  }, [loadDashboardData]);

  // Real-time page views subscription
  useEffect(() => {
    if (!provider?.id) return;
    const unsub = analyticsService.subscribeToPageViews(provider.id, setPageViewStats);
    return unsub;
  }, [provider?.id]);

  const liveViews = analyticsService.computeLiveStats(pageViewStats);

  // Handlers
  const handleBookingClick = (booking: WithId<Booking>) => {
    setSelectedBooking(booking);
    setIsDetailModalOpen(true);
  };

  const handleBookingUpdate = async () => {
    await loadDashboardData();
    setIsDetailModalOpen(false);
    setSelectedBooking(null);
  };

  const handleCreateBooking = () => {
    router.push('/pro/calendrier');
  };

  const handleBookingCreated = async () => {
    await loadDashboardData();
    setIsCreateModalOpen(false);
  };

  const handleBlockSlot = () => {
    router.push('/pro/activite?tab=disponibilites');
  };

  // Loading skeleton
  if (loading) {
    return (
      <div className="space-y-8">
        {/* Header skeleton */}
        <div>
          <div className="h-8 w-48 bg-gray-200 dark:bg-gray-700 rounded animate-pulse" />
          <div className="h-5 w-64 bg-gray-200 dark:bg-gray-700 rounded animate-pulse mt-2" />
        </div>

        {/* Stats skeleton */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <div
              key={i}
              className="bg-white dark:bg-gray-800 rounded-xl p-5 border border-gray-200 dark:border-gray-700"
            >
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-gray-200 dark:bg-gray-700 rounded-xl animate-pulse" />
                <div className="flex-1">
                  <div className="h-4 w-16 bg-gray-200 dark:bg-gray-700 rounded animate-pulse" />
                  <div className="h-8 w-12 bg-gray-200 dark:bg-gray-700 rounded animate-pulse mt-1" />
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Content skeleton */}
        <div className="grid lg:grid-cols-2 gap-6">
          <div className="bg-white dark:bg-gray-800 rounded-xl p-5 border border-gray-200 dark:border-gray-700 h-64 animate-pulse" />
          <div className="bg-white dark:bg-gray-800 rounded-xl p-5 border border-gray-200 dark:border-gray-700 h-64 animate-pulse" />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 dark:text-white">
            {greeting}, {user?.displayName?.split(' ')[0] || 'Prestataire'}
          </h1>
          <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-gray-600 dark:text-gray-400">
            {provider?.businessName && (
              <span className="font-medium text-gray-700 dark:text-gray-300">
                {provider.businessName}
              </span>
            )}
            {provider?.businessName && <span>•</span>}
            <span className="capitalize">{formatFullDate(new Date())}</span>
            <span>•</span>
            <Link
              href="/pro/profil?tab=publication"
              className={`inline-flex items-center gap-1.5 text-sm font-medium transition-colors ${
                provider?.isPublished
                  ? 'text-success-600 dark:text-success-400 hover:text-success-700 dark:hover:text-success-300'
                  : 'text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300'
              }`}
            >
              {provider?.isPublished ? (
                <Globe className="w-3.5 h-3.5" />
              ) : (
                <GlobeLock className="w-3.5 h-3.5" />
              )}
              {provider?.isPublished ? 'Page active' : 'Page inactive'}
            </Link>
          </div>
        </div>

        {/* Quick Actions */}
        <QuickActions onCreateBooking={handleCreateBooking} onBlockSlot={handleBlockSlot} />
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          icon={<Calendar className="w-5 h-5" />}
          label="Aujourd'hui"
          value={todayBookings.length}
          sublabel="rendez-vous"
          href="/pro/calendrier"
          variant="primary"
        />
        <StatCard
          icon={<Clock className="w-5 h-5" />}
          label="Cette semaine"
          value={weekBookingsCount}
          sublabel="rendez-vous"
          href="/pro/reservations"
          variant="success"
        />
        <StatCard
          icon={<Eye className="w-5 h-5" />}
          label="Vues"
          value={liveViews.today}
          sublabel="aujourd'hui"
          variant={liveViews.today > 0 ? 'primary' : 'default'}
        />
        <StatCard
          icon={<Star className="w-5 h-5" />}
          label="Note moyenne"
          value={provider?.rating?.average?.toFixed(1) || '-'}
          sublabel={provider?.rating?.count ? `(${provider.rating.count} avis)` : ''}
          variant="default"
        />
      </div>

      {/* Alerts */}
      <AlertCard alerts={alerts} />

      {/* Main Content Grid */}
      <div className="grid lg:grid-cols-2 gap-6">
        {/* Today's Bookings */}
        <TodayBookings
          bookings={todayBookings}
          members={members}
          isTeamPlan={isTeamPlan}
          onBookingClick={handleBookingClick}
        />

        {/* Recent Activity */}
        <RecentActivity
          upcomingBookings={upcomingBookings}
          recentCancellations={recentCancellations}
          members={members}
          isTeamPlan={isTeamPlan}
          onBookingClick={handleBookingClick}
        />
      </div>

      {/* Booking Detail Modal */}
      <BookingDetailModal
        isOpen={isDetailModalOpen}
        onClose={() => {
          setIsDetailModalOpen(false);
          setSelectedBooking(null);
        }}
        booking={selectedBooking}
        onUpdate={handleBookingUpdate}
      />

      {/* Create Booking Modal */}
      <CreateBookingModal
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
        members={members}
        locations={locations}
        isTeamPlan={isTeamPlan}
        onCreated={handleBookingCreated}
      />
    </div>
  );
}
