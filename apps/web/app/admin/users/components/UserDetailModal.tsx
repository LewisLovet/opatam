'use client';

import { useEffect, useState, useCallback } from 'react';
import { X, Mail, Phone, MapPin, Calendar, ShieldCheck, Ban, Check, Loader2 } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { adminUserService } from '@/services/admin';
import type { UserDetail } from '@/services/admin/types';
import { Badge, Loader } from '@/components/ui';

interface UserDetailModalProps {
  open: boolean;
  userId: string | null;
  onClose: () => void;
}

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

export function UserDetailModal({ open, userId, onClose }: UserDetailModalProps) {
  const { user: authUser } = useAuth();
  const [detail, setDetail] = useState<UserDetail | null>(null);
  const [loading, setLoading] = useState(false);
  const [toggling, setToggling] = useState(false);

  useEffect(() => {
    if (!open || !userId || !authUser?.id) {
      setDetail(null);
      return;
    }

    setLoading(true);
    adminUserService
      .getUserDetail(authUser.id, userId)
      .then(setDetail)
      .catch((err) => console.error('Error loading user detail:', err))
      .finally(() => setLoading(false));
  }, [open, userId, authUser?.id]);

  const handleToggleDisabled = useCallback(async () => {
    if (!authUser?.id || !detail || !userId) return;
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
  }, [authUser?.id, detail, userId]);

  useEffect(() => {
    if (!open) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [open, onClose]);

  if (!open) return null;

  const user = detail?.user;

  return (
    <>
      <div className="fixed inset-0 bg-black/60 z-50" onClick={onClose} />
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        <div
          className="w-full max-w-lg bg-white dark:bg-gray-800 rounded-2xl shadow-xl max-h-[85vh] flex flex-col"
          onClick={(e) => e.stopPropagation()}
        >
          {loading || !user ? (
            <div className="flex items-center justify-center py-20">
              <Loader size="lg" />
            </div>
          ) : (
            <>
              {/* Header */}
              <div className="flex items-start justify-between p-6 pb-0">
                <div className="flex items-center gap-4">
                  <div className="w-14 h-14 rounded-full bg-gray-200 dark:bg-gray-600 flex items-center justify-center flex-shrink-0">
                    {user.photoURL ? (
                      <img
                        src={user.photoURL}
                        alt={user.displayName}
                        className="w-14 h-14 rounded-full object-cover"
                      />
                    ) : (
                      <span className="text-xl font-semibold text-gray-600 dark:text-gray-300">
                        {user.displayName?.charAt(0).toUpperCase() || '?'}
                      </span>
                    )}
                  </div>
                  <div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <h2 className="text-lg font-bold text-gray-900 dark:text-white">
                        {user.displayName}
                      </h2>
                      {user.isAdmin && (
                        <Badge variant="error" size="sm">
                          <ShieldCheck className="w-3 h-3 mr-1" />
                          Admin
                        </Badge>
                      )}
                    </div>
                    <div className="flex items-center gap-2 mt-1">
                      <Badge variant="info" size="sm">
                        {roleLabels[user.role] || user.role}
                      </Badge>
                      <Badge variant={user.isDisabled ? 'error' : 'success'} size="sm">
                        {user.isDisabled ? 'Désactivé' : 'Actif'}
                      </Badge>
                    </div>
                  </div>
                </div>
                <button
                  onClick={onClose}
                  className="p-1.5 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Body */}
              <div className="flex-1 overflow-y-auto p-6 space-y-5">
                {/* Contact info */}
                <div className="space-y-2 text-sm text-gray-500 dark:text-gray-400">
                  <div className="flex items-center gap-2">
                    <Mail className="w-4 h-4 flex-shrink-0" />
                    <span className="truncate">{user.email}</span>
                  </div>
                  {user.phone && (
                    <div className="flex items-center gap-2">
                      <Phone className="w-4 h-4 flex-shrink-0" />
                      {user.phone}
                    </div>
                  )}
                  {user.city && (
                    <div className="flex items-center gap-2">
                      <MapPin className="w-4 h-4 flex-shrink-0" />
                      {user.city}
                    </div>
                  )}
                  <div className="flex items-center gap-2">
                    <Calendar className="w-4 h-4 flex-shrink-0" />
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

                {/* Stats */}
                <div className="flex items-center gap-4 text-sm">
                  <span className="text-gray-500 dark:text-gray-400">
                    <span className="font-semibold text-gray-900 dark:text-white">{detail.bookingsCount}</span>{' '}
                    réservation{detail.bookingsCount > 1 ? 's' : ''}
                  </span>
                  <span className="text-gray-500 dark:text-gray-400">
                    <span className="font-semibold text-gray-900 dark:text-white">{user.cancellationCount || 0}</span>{' '}
                    annulation{(user.cancellationCount || 0) > 1 ? 's' : ''}
                  </span>
                </div>

                {/* Action button */}
                <button
                  onClick={handleToggleDisabled}
                  disabled={toggling}
                  className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium rounded-lg transition-colors disabled:opacity-50 ${
                    user.isDisabled
                      ? 'bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600 hover:bg-emerald-100 dark:hover:bg-emerald-500/20'
                      : 'bg-red-50 dark:bg-red-500/10 text-red-600 hover:bg-red-100 dark:hover:bg-red-500/20'
                  }`}
                >
                  {toggling ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : user.isDisabled ? (
                    <Check className="w-4 h-4" />
                  ) : (
                    <Ban className="w-4 h-4" />
                  )}
                  {user.isDisabled ? 'Réactiver' : 'Désactiver'}
                </button>

                {/* Recent bookings */}
                <div>
                  <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-3">
                    Réservations récentes
                  </h3>
                  {detail.recentBookings.length === 0 ? (
                    <p className="text-sm text-gray-400 text-center py-4">
                      Aucune réservation
                    </p>
                  ) : (
                    <div className="space-y-2">
                      {detail.recentBookings.map((booking: any) => (
                        <div
                          key={booking.id}
                          className="flex items-center justify-between p-3 rounded-xl bg-gray-50 dark:bg-gray-700/50"
                        >
                          <div className="min-w-0">
                            <p className="text-sm font-medium text-gray-900 dark:text-white truncate">
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
                          <div className="flex items-center gap-2 flex-shrink-0 ml-3">
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
            </>
          )}
        </div>
      </div>
    </>
  );
}
