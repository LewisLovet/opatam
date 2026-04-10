'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
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
  ExternalLink,
  AlertTriangle,
  RefreshCw,
  Trash2,
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

export default function AdminProviderDetailPage() {
  const { providerId } = useParams<{ providerId: string }>();
  const router = useRouter();
  const { user: authUser } = useAuth();
  const [detail, setDetail] = useState<ProviderDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [togglingVerified, setTogglingVerified] = useState(false);
  const [togglingPublished, setTogglingPublished] = useState(false);
  const [fixingRegion, setFixingRegion] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [selectedBooking, setSelectedBooking] = useState<ProviderDetail['recentBookings'][number] | null>(null);
  const [showAllBookings, setShowAllBookings] = useState(false);

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

  const handleFixRegion = async () => {
    if (!authUser?.id || !detail) return;
    setFixingRegion(true);
    try {
      const result = await adminProviderService.fixRegion(authUser.id, providerId);
      if (result.fixed && result.region) {
        setDetail({
          ...detail,
          provider: { ...detail.provider, region: result.region },
        });
      } else {
        alert(`Impossible de corriger la région : ${result.error || 'Erreur inconnue'}`);
      }
    } catch (err) {
      console.error('Error fixing region:', err);
      alert('Erreur lors de la correction de la région');
    } finally {
      setFixingRegion(false);
    }
  };

  const handleDelete = async () => {
    if (!authUser?.id || !detail) return;
    const name = detail.provider.businessName || 'ce prestataire';
    if (!confirm(`Supprimer le compte de "${name}" ? Cette action est irréversible.\n\nTout sera supprimé :\n- Compte Firebase Auth\n- Document utilisateur\n- Établissement et toutes ses données (services, membres, lieux, disponibilités)`)) return;
    if (!confirm(`Dernière confirmation : êtes-vous sûr de vouloir supprimer définitivement "${name}" ?`)) return;

    setDeleting(true);
    try {
      await adminProviderService.deleteProvider(authUser.id, providerId);
      router.push('/admin/providers');
    } catch (err) {
      console.error('Error deleting provider:', err);
      alert('Erreur lors de la suppression du compte');
      setDeleting(false);
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

            <div className="flex items-center gap-2 mt-1 flex-wrap">
              {/* Country */}
              {provider.countryCode && (
                <span className="text-sm">
                  {({ FR: '🇫🇷', BE: '🇧🇪', CH: '🇨🇭', LU: '🇱🇺', DE: '🇩🇪', ES: '🇪🇸', IT: '🇮🇹', PT: '🇵🇹', NL: '🇳🇱' } as Record<string, string>)[provider.countryCode] || '🌍'}{' '}
                  <span className="text-gray-500 dark:text-gray-400">{provider.countryCode}</span>
                </span>
              )}
              {/* Region — only relevant for FR */}
              {provider.countryCode === 'FR' || !provider.countryCode ? (
                provider.region ? (
                  <>
                    <span className="text-gray-300 dark:text-gray-600">·</span>
                    <span className="text-sm text-gray-600 dark:text-gray-300">{provider.region}</span>
                  </>
                ) : (
                  <span className="inline-flex items-center gap-1">
                    <Badge variant="error" size="sm">
                      <AlertTriangle className="w-3 h-3 mr-1" />
                      Région manquante
                    </Badge>
                    <button
                      onClick={handleFixRegion}
                      disabled={fixingRegion}
                      className="inline-flex items-center gap-1 px-2 py-0.5 text-xs font-medium rounded-md bg-blue-50 text-blue-700 hover:bg-blue-100 dark:bg-blue-900/30 dark:text-blue-400 dark:hover:bg-blue-900/50 transition-colors disabled:opacity-50"
                    >
                      <RefreshCw className={`w-3 h-3 ${fixingRegion ? 'animate-spin' : ''}`} />
                      Corriger
                    </button>
                  </span>
                )
              ) : provider.region ? (
                <>
                  <span className="text-gray-300 dark:text-gray-600">·</span>
                  <span className="text-sm text-gray-600 dark:text-gray-300">{provider.region}</span>
                </>
              ) : null}
            </div>

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
            {provider.slug && (
              <a
                href={`/p/${provider.slug}`}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium rounded-lg border border-gray-200 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
              >
                <ExternalLink className="w-4 h-4" />
                Voir la page
              </a>
            )}
            <Button
              variant="outline"
              size="sm"
              onClick={handleDelete}
              loading={deleting}
              className="!border-red-300 !text-red-600 hover:!bg-red-50 dark:!border-red-700 dark:!text-red-400 dark:hover:!bg-red-900/20"
            >
              <Trash2 className="w-4 h-4 mr-1" />
              Supprimer le compte
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

        {/* Recent bookings */}
        {detail.recentBookings && detail.recentBookings.length > 0 && (() => {
          const statusColors: Record<string, string> = {
            confirmed: 'text-emerald-600 bg-emerald-50',
            pending: 'text-amber-600 bg-amber-50',
            cancelled: 'text-red-600 bg-red-50',
            noshow: 'text-gray-600 bg-gray-100',
          };
          const statusLabels: Record<string, string> = {
            confirmed: 'Confirmé',
            pending: 'En attente',
            cancelled: 'Annulé',
            noshow: 'Absent',
          };
          const visibleBookings = showAllBookings ? detail.recentBookings : detail.recentBookings.slice(0, 5);

          return (
            <div className="bg-white dark:bg-gray-800 rounded-xl p-5 shadow-sm border border-gray-100 dark:border-gray-700 md:col-span-2">
              <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
                <Clock className="w-4 h-4" />
                Dernières réservations ({detail.recentBookings.length})
              </h3>
              <div className="space-y-1">
                {visibleBookings.map((b) => (
                  <div
                    key={b.id}
                    onClick={() => setSelectedBooking(b)}
                    className="flex items-center justify-between p-3 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors cursor-pointer"
                  >
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-900 dark:text-white truncate">
                        {b.clientName}
                      </p>
                      <p className="text-xs text-gray-500 dark:text-gray-400">
                        {b.serviceName} {b.memberName ? `· ${b.memberName}` : ''}
                      </p>
                    </div>
                    <div className="flex flex-col items-end gap-1 flex-shrink-0 ml-3">
                      <span className="text-xs text-gray-500">
                        {b.datetime ? new Date(b.datetime).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) : '—'}
                      </span>
                      <span className="text-[10px] text-gray-400">
                        Pris le {b.createdAt ? new Date(b.createdAt).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) : '—'}
                      </span>
                      <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${statusColors[b.status] || 'text-gray-500 bg-gray-100'}`}>
                        {statusLabels[b.status] || b.status}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
              {detail.recentBookings.length > 5 && !showAllBookings && (
                <button
                  onClick={() => setShowAllBookings(true)}
                  className="mt-3 w-full text-center text-sm font-medium text-primary-600 hover:text-primary-700 py-2"
                >
                  Voir les {detail.recentBookings.length - 5} autres →
                </button>
              )}
            </div>
          );
        })()}

        {/* Booking detail modal */}
        {selectedBooking && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={() => setSelectedBooking(null)}>
            <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl max-w-md w-full p-6" onClick={(e) => e.stopPropagation()}>
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-bold text-gray-900 dark:text-white">Détail du RDV</h3>
                <button onClick={() => setSelectedBooking(null)} className="text-gray-400 hover:text-gray-600">
                  <XCircle className="w-5 h-5" />
                </button>
              </div>
              <div className="space-y-3 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-500">Client</span>
                  <span className="font-medium text-gray-900 dark:text-white">{selectedBooking.clientName}</span>
                </div>
                {selectedBooking.clientEmail && (
                  <div className="flex justify-between">
                    <span className="text-gray-500">Email</span>
                    <span className="text-gray-700 dark:text-gray-300">{selectedBooking.clientEmail}</span>
                  </div>
                )}
                <div className="flex justify-between">
                  <span className="text-gray-500">Prestation</span>
                  <span className="font-medium text-gray-900 dark:text-white">{selectedBooking.serviceName}</span>
                </div>
                {selectedBooking.memberName && (
                  <div className="flex justify-between">
                    <span className="text-gray-500">Membre</span>
                    <span className="text-gray-700 dark:text-gray-300">{selectedBooking.memberName}</span>
                  </div>
                )}
                <div className="flex justify-between">
                  <span className="text-gray-500">Date du RDV</span>
                  <span className="font-medium text-gray-900 dark:text-white">
                    {selectedBooking.datetime ? new Date(selectedBooking.datetime).toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' }) : '—'}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Pris le</span>
                  <span className="text-gray-700 dark:text-gray-300">
                    {selectedBooking.createdAt ? new Date(selectedBooking.createdAt).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '—'}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Prix</span>
                  <span className="font-medium text-gray-900 dark:text-white">{selectedBooking.price ? `${(selectedBooking.price / 100).toFixed(2)} €` : 'Gratuit'}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-gray-500">Statut</span>
                  <span className={`text-xs font-semibold px-2 py-1 rounded-full ${{
                    confirmed: 'text-emerald-600 bg-emerald-50',
                    pending: 'text-amber-600 bg-amber-50',
                    cancelled: 'text-red-600 bg-red-50',
                    noshow: 'text-gray-600 bg-gray-100',
                  }[selectedBooking.status] || 'text-gray-500 bg-gray-100'}`}>
                    ${{ confirmed: 'Confirmé', pending: 'En attente', cancelled: 'Annulé', noshow: 'Absent' }[selectedBooking.status] || selectedBooking.status}
                  </span>
                </div>
              </div>
              <button
                onClick={() => setSelectedBooking(null)}
                className="mt-5 w-full px-4 py-2.5 text-sm font-medium text-gray-600 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors"
              >
                Fermer
              </button>
            </div>
          </div>
        )}

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
