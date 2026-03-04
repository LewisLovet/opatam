'use client';

import { useEffect, useState, use } from 'react';
import Link from 'next/link';
import { useAuth } from '@/contexts/AuthContext';
import { adminProviderService } from '@/services/admin';
import type { ProviderDetail } from '@/services/admin/types';
import { Loader, Badge, Button } from '@/components/ui';
import {
  ArrowLeft,
  Star,
  MapPin,
  CheckCircle,
  XCircle,
  Calendar,
  CreditCard,
  Users,
  Briefcase,
  Clock,
} from 'lucide-react';

const categoryLabels: Record<string, string> = {
  coiffure: 'Coiffure',
  barbier: 'Barbier',
  esthetique: 'Esthétique',
  massage: 'Massage',
  onglerie: 'Onglerie',
  tatouage: 'Tatouage',
  maquillage: 'Maquillage',
  soin_visage: 'Soin visage',
};

const planLabels: Record<string, string> = {
  trial: 'Trial',
  solo: 'Solo',
  team: 'Team',
  test: 'Test',
};

const statusLabels: Record<string, string> = {
  trialing: 'En essai',
  active: 'Actif',
  past_due: 'En retard',
  cancelled: 'Annulé',
  incomplete: 'Incomplet',
};

export default function AdminProviderDetailPage({
  params,
}: {
  params: Promise<{ providerId: string }>;
}) {
  const { providerId } = use(params);
  const { user: authUser } = useAuth();
  const [detail, setDetail] = useState<ProviderDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [togglingVerified, setTogglingVerified] = useState(false);
  const [togglingPublished, setTogglingPublished] = useState(false);

  useEffect(() => {
    if (!authUser?.id) return;

    const load = async () => {
      try {
        const data = await adminProviderService.getProviderDetail(authUser.id, providerId);
        setDetail(data);
      } catch (err) {
        console.error('Error loading provider detail:', err);
      } finally {
        setLoading(false);
      }
    };

    load();
  }, [authUser?.id, providerId]);

  const handleToggleVerified = async () => {
    if (!authUser?.id || !detail) return;
    setTogglingVerified(true);
    try {
      const newVerified = !detail.provider.isVerified;
      await adminProviderService.toggleVerified(authUser.id, providerId, newVerified);
      setDetail({
        ...detail,
        provider: { ...detail.provider, isVerified: newVerified },
      });
    } catch (err) {
      console.error('Error toggling verified:', err);
    } finally {
      setTogglingVerified(false);
    }
  };

  const handleTogglePublished = async () => {
    if (!authUser?.id || !detail) return;
    setTogglingPublished(true);
    try {
      const newPublished = !detail.provider.isPublished;
      await adminProviderService.togglePublished(authUser.id, providerId, newPublished);
      setDetail({
        ...detail,
        provider: { ...detail.provider, isPublished: newPublished },
      });
    } catch (err) {
      console.error('Error toggling published:', err);
    } finally {
      setTogglingPublished(false);
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
    return <div className="text-center text-gray-400 py-20">Prestataire non trouvé</div>;
  }

  const { provider, user, services, members, locations, bookingStats } = detail;

  return (
    <div className="space-y-6">
      {/* Back link */}
      <Link
        href="/admin/providers"
        className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 transition-colors"
      >
        <ArrowLeft className="w-4 h-4" />
        Retour aux prestataires
      </Link>

      {/* Provider info card */}
      <div className="bg-white dark:bg-gray-800 rounded-xl p-6 shadow-sm border border-gray-100 dark:border-gray-700">
        <div className="flex flex-col sm:flex-row items-start gap-5">
          {/* Photo */}
          <div className="w-16 h-16 rounded-full bg-gray-200 dark:bg-gray-600 flex items-center justify-center flex-shrink-0">
            {provider.photoURL ? (
              <img
                src={provider.photoURL}
                alt={provider.businessName}
                className="w-16 h-16 rounded-full object-cover"
              />
            ) : (
              <span className="text-2xl font-semibold text-gray-600 dark:text-gray-300">
                {provider.businessName?.charAt(0).toUpperCase() || '?'}
              </span>
            )}
          </div>

          {/* Info */}
          <div className="flex-1">
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-xl font-bold text-gray-900 dark:text-white">
                {provider.businessName}
              </h1>
              {provider.isVerified && (
                <Badge variant="success" size="sm">
                  <CheckCircle className="w-3 h-3 mr-1" />
                  Vérifié
                </Badge>
              )}
              <Badge variant={provider.isPublished ? 'success' : 'warning'} size="sm">
                {provider.isPublished ? 'Publié' : 'Brouillon'}
              </Badge>
            </div>

            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
              {categoryLabels[provider.category] || provider.category}
              {provider.cities?.length > 0 && ` \u00b7 ${provider.cities.join(', ')}`}
            </p>

            {provider.rating && provider.rating.count > 0 && (
              <div className="flex items-center gap-1 mt-2">
                <Star className="w-4 h-4 text-amber-400 fill-amber-400" />
                <span className="text-sm font-medium text-gray-900 dark:text-white">
                  {provider.rating.average.toFixed(1)}
                </span>
                <span className="text-xs text-gray-400">({provider.rating.count} avis)</span>
              </div>
            )}

            {user && (
              <div className="mt-3 text-sm text-gray-500 dark:text-gray-400">
                Compte : {user.email}
                {user.isDisabled && (
                  <span className="text-red-500 ml-2">(Désactivé)</span>
                )}
              </div>
            )}
          </div>

          {/* Actions */}
          <div className="flex flex-col gap-2">
            <Button
              variant={provider.isVerified ? 'outline' : 'primary'}
              size="sm"
              onClick={handleToggleVerified}
              loading={togglingVerified}
            >
              {provider.isVerified ? (
                <>
                  <XCircle className="w-4 h-4 mr-1" />
                  Retirer vérification
                </>
              ) : (
                <>
                  <CheckCircle className="w-4 h-4 mr-1" />
                  Vérifier
                </>
              )}
            </Button>
            <Button
              variant={provider.isPublished ? 'outline' : 'primary'}
              size="sm"
              onClick={handleTogglePublished}
              loading={togglingPublished}
            >
              {provider.isPublished ? 'Dépublier' : 'Publier'}
            </Button>
          </div>
        </div>
      </div>

      {/* Stats + Subscription grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Booking stats */}
        <div className="bg-white dark:bg-gray-800 rounded-xl p-5 shadow-sm border border-gray-100 dark:border-gray-700">
          <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
            <Calendar className="w-4 h-4" />
            Réservations
          </h3>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-2xl font-bold text-gray-900 dark:text-white">{bookingStats.total}</p>
              <p className="text-xs text-gray-500">Total</p>
            </div>
            <div>
              <p className="text-2xl font-bold text-emerald-500">{bookingStats.confirmed}</p>
              <p className="text-xs text-gray-500">Confirmées</p>
            </div>
            <div>
              <p className="text-2xl font-bold text-amber-500">{bookingStats.pending}</p>
              <p className="text-xs text-gray-500">En attente</p>
            </div>
            <div>
              <p className="text-2xl font-bold text-red-500">{bookingStats.cancelled}</p>
              <p className="text-xs text-gray-500">Annulées</p>
            </div>
          </div>
          {bookingStats.noshow > 0 && (
            <p className="text-xs text-gray-400 mt-3">{bookingStats.noshow} no-show(s)</p>
          )}
        </div>

        {/* Subscription */}
        <div className="bg-white dark:bg-gray-800 rounded-xl p-5 shadow-sm border border-gray-100 dark:border-gray-700">
          <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
            <CreditCard className="w-4 h-4" />
            Abonnement
          </h3>
          <div className="space-y-3 text-sm">
            <div className="flex justify-between">
              <span className="text-gray-500 dark:text-gray-400">Plan</span>
              <Badge variant="info" size="sm">
                {planLabels[provider.subscription?.plan] || provider.subscription?.plan}
              </Badge>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500 dark:text-gray-400">Statut</span>
              <span className="font-medium text-gray-900 dark:text-white">
                {statusLabels[provider.subscription?.status] || provider.subscription?.status}
              </span>
            </div>
            {provider.subscription?.validUntil && (
              <div className="flex justify-between">
                <span className="text-gray-500 dark:text-gray-400">Valide jusqu&apos;au</span>
                <span className="text-gray-900 dark:text-white">
                  {new Date(provider.subscription.validUntil).toLocaleDateString('fr-FR')}
                </span>
              </div>
            )}
            {provider.subscription?.stripeCustomerId && (
              <div className="flex justify-between">
                <span className="text-gray-500 dark:text-gray-400">Stripe ID</span>
                <span className="text-xs text-gray-400 font-mono">
                  {provider.subscription.stripeCustomerId}
                </span>
              </div>
            )}
            {provider.subscription?.paymentSource && (
              <div className="flex justify-between">
                <span className="text-gray-500 dark:text-gray-400">Source</span>
                <span className="text-gray-900 dark:text-white capitalize">
                  {provider.subscription.paymentSource}
                </span>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Services, Members, Locations */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Services */}
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700">
          <div className="px-5 py-4 border-b border-gray-100 dark:border-gray-700">
            <h3 className="text-sm font-semibold text-gray-900 dark:text-white flex items-center gap-2">
              <Briefcase className="w-4 h-4" />
              Services ({services.length})
            </h3>
          </div>
          {services.length === 0 ? (
            <div className="p-5 text-center text-gray-400 text-sm">Aucun service</div>
          ) : (
            <div className="divide-y divide-gray-50 dark:divide-gray-700/50">
              {services.map((service: any) => (
                <div key={service.id} className="px-5 py-3 flex justify-between items-center">
                  <div>
                    <p className="text-sm font-medium text-gray-900 dark:text-white">{service.name}</p>
                    <p className="text-xs text-gray-500 dark:text-gray-400">
                      <Clock className="w-3 h-3 inline mr-1" />
                      {service.duration} min
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-medium text-gray-900 dark:text-white">
                      {(service.price / 100).toFixed(0)} &euro;
                    </p>
                    {!service.isActive && (
                      <span className="text-xs text-gray-400">Inactif</span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Members */}
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700">
          <div className="px-5 py-4 border-b border-gray-100 dark:border-gray-700">
            <h3 className="text-sm font-semibold text-gray-900 dark:text-white flex items-center gap-2">
              <Users className="w-4 h-4" />
              Membres ({members.length})
            </h3>
          </div>
          {members.length === 0 ? (
            <div className="p-5 text-center text-gray-400 text-sm">Aucun membre</div>
          ) : (
            <div className="divide-y divide-gray-50 dark:divide-gray-700/50">
              {members.map((member: any) => (
                <div key={member.id} className="px-5 py-3 flex justify-between items-center">
                  <div>
                    <p className="text-sm font-medium text-gray-900 dark:text-white">
                      {member.name}
                      {member.isDefault && (
                        <span className="text-xs text-gray-400 ml-2">(principal)</span>
                      )}
                    </p>
                    <p className="text-xs text-gray-500 dark:text-gray-400">{member.email}</p>
                  </div>
                  {!member.isActive && (
                    <span className="text-xs text-gray-400">Inactif</span>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Locations */}
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700">
          <div className="px-5 py-4 border-b border-gray-100 dark:border-gray-700">
            <h3 className="text-sm font-semibold text-gray-900 dark:text-white flex items-center gap-2">
              <MapPin className="w-4 h-4" />
              Lieux ({locations.length})
            </h3>
          </div>
          {locations.length === 0 ? (
            <div className="p-5 text-center text-gray-400 text-sm">Aucun lieu</div>
          ) : (
            <div className="divide-y divide-gray-50 dark:divide-gray-700/50">
              {locations.map((location: any) => (
                <div key={location.id} className="px-5 py-3">
                  <p className="text-sm font-medium text-gray-900 dark:text-white">
                    {location.name}
                    {location.isDefault && (
                      <span className="text-xs text-gray-400 ml-2">(principal)</span>
                    )}
                  </p>
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    {location.address}, {location.city}
                  </p>
                  <div className="flex items-center gap-2 mt-1">
                    <Badge variant="info" size="sm">
                      {location.type === 'fixed' ? 'Fixe' : 'Mobile'}
                    </Badge>
                    {!location.isActive && (
                      <span className="text-xs text-gray-400">Inactif</span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
