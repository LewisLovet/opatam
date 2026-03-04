'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { adminUserService } from '@/services/admin';
import type { UserDetail } from '@/services/admin/types';
import { Loader, Badge, Button } from '@/components/ui';
import { ArrowLeft, Mail, Phone, MapPin, Calendar, ShieldCheck, Ban, Check } from 'lucide-react';

const roleLabels: Record<string, string> = {
  client: 'Client',
  provider: 'Prestataire',
  both: 'Client + Pro',
};

const statusLabels: Record<string, string> = {
  pending: 'En attente',
  confirmed: 'Confirmée',
  cancelled: 'Annulée',
  noshow: 'No-show',
};

const statusColors: Record<string, 'warning' | 'success' | 'error' | 'info'> = {
  pending: 'warning',
  confirmed: 'success',
  cancelled: 'error',
  noshow: 'info',
};

export default function AdminUserDetailPage() {
  const { userId } = useParams<{ userId: string }>();
  const { user: authUser } = useAuth();
  const [detail, setDetail] = useState<UserDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [toggling, setToggling] = useState(false);

  useEffect(() => {
    if (!authUser?.id) return;

    const load = async () => {
      try {
        const data = await adminUserService.getUserDetail(authUser.id, userId);
        setDetail(data);
      } catch (err) {
        console.error('Error loading user detail:', err);
      } finally {
        setLoading(false);
      }
    };

    load();
  }, [authUser?.id, userId]);

  const handleToggleDisabled = async () => {
    if (!authUser?.id || !detail) return;
    setToggling(true);
    try {
      const newDisabled = !detail.user.isDisabled;
      await adminUserService.toggleUserDisabled(authUser.id, userId, newDisabled);
      setDetail({
        ...detail,
        user: { ...detail.user, isDisabled: newDisabled },
      });
    } catch (err) {
      console.error('Error toggling user:', err);
    } finally {
      setToggling(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <Loader size="lg" />
      </div>
    );
  }

  if (!detail) {
    return (
      <div className="text-center text-gray-400 py-20">Utilisateur non trouvé</div>
    );
  }

  const { user, bookingsCount, recentBookings } = detail;

  return (
    <div className="space-y-6">
      {/* Back link */}
      <Link
        href="/admin/users"
        className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 transition-colors"
      >
        <ArrowLeft className="w-4 h-4" />
        Retour aux utilisateurs
      </Link>

      {/* User info card */}
      <div className="bg-white dark:bg-gray-800 rounded-xl p-6 shadow-sm border border-gray-100 dark:border-gray-700">
        <div className="flex flex-col sm:flex-row items-start gap-5">
          {/* Avatar */}
          <div className="w-16 h-16 rounded-full bg-gray-200 dark:bg-gray-600 flex items-center justify-center flex-shrink-0">
            {user.photoURL ? (
              <img
                src={user.photoURL}
                alt={user.displayName}
                className="w-16 h-16 rounded-full object-cover"
              />
            ) : (
              <span className="text-2xl font-semibold text-gray-600 dark:text-gray-300">
                {user.displayName?.charAt(0).toUpperCase() || '?'}
              </span>
            )}
          </div>

          {/* Info */}
          <div className="flex-1">
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-xl font-bold text-gray-900 dark:text-white">
                {user.displayName}
              </h1>
              {user.isAdmin && (
                <Badge variant="error" size="sm">
                  <ShieldCheck className="w-3 h-3 mr-1" />
                  Admin
                </Badge>
              )}
              <Badge variant={user.isDisabled ? 'error' : 'success'} size="sm">
                {user.isDisabled ? 'Désactivé' : 'Actif'}
              </Badge>
            </div>

            <div className="mt-3 space-y-1.5 text-sm text-gray-500 dark:text-gray-400">
              <div className="flex items-center gap-2">
                <Mail className="w-4 h-4" />
                {user.email}
              </div>
              {user.phone && (
                <div className="flex items-center gap-2">
                  <Phone className="w-4 h-4" />
                  {user.phone}
                </div>
              )}
              {user.city && (
                <div className="flex items-center gap-2">
                  <MapPin className="w-4 h-4" />
                  {user.city}
                </div>
              )}
              <div className="flex items-center gap-2">
                <Calendar className="w-4 h-4" />
                Inscrit le{' '}
                {user.createdAt
                  ? new Date(user.createdAt).toLocaleDateString('fr-FR', {
                      day: '2-digit',
                      month: 'long',
                      year: 'numeric',
                    })
                  : '-'}
              </div>
            </div>

            <div className="mt-3 flex items-center gap-3 flex-wrap">
              <Badge variant="info" size="sm">
                {roleLabels[user.role] || user.role}
              </Badge>
              <span className="text-sm text-gray-500 dark:text-gray-400">
                {bookingsCount} réservation{bookingsCount > 1 ? 's' : ''}
              </span>
              <span className="text-sm text-gray-500 dark:text-gray-400">
                {user.cancellationCount || 0} annulation{(user.cancellationCount || 0) > 1 ? 's' : ''}
              </span>
            </div>
          </div>

          {/* Actions */}
          <div>
            <Button
              variant={user.isDisabled ? 'primary' : 'outline'}
              size="sm"
              onClick={handleToggleDisabled}
              loading={toggling}
            >
              {user.isDisabled ? (
                <>
                  <Check className="w-4 h-4 mr-1" />
                  Réactiver
                </>
              ) : (
                <>
                  <Ban className="w-4 h-4 mr-1" />
                  Désactiver
                </>
              )}
            </Button>
          </div>
        </div>
      </div>

      {/* Recent bookings */}
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700">
        <div className="px-5 py-4 border-b border-gray-100 dark:border-gray-700">
          <h2 className="text-sm font-semibold text-gray-900 dark:text-white">
            Réservations récentes ({bookingsCount})
          </h2>
        </div>

        {recentBookings.length === 0 ? (
          <div className="p-8 text-center text-gray-400 text-sm">
            Aucune réservation
          </div>
        ) : (
          <div className="divide-y divide-gray-50 dark:divide-gray-700/50">
            {recentBookings.map((booking: any) => (
              <div key={booking.id} className="px-5 py-3 flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-900 dark:text-white">
                    {booking.serviceName}
                  </p>
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    {booking.providerName} &middot;{' '}
                    {booking.datetime
                      ? new Date(booking.datetime).toLocaleDateString('fr-FR', {
                          day: '2-digit',
                          month: 'short',
                          year: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit',
                        })
                      : '-'}
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-sm font-medium text-gray-900 dark:text-white">
                    {((booking.price || 0) / 100).toFixed(0)} &euro;
                  </span>
                  <Badge variant={statusColors[booking.status] || 'primary'} size="sm">
                    {statusLabels[booking.status] || booking.status}
                  </Badge>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
