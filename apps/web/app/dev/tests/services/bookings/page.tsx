'use client';

import { useState, useEffect } from 'react';
import { Button, Card, CardBody, CardHeader, Input, Badge } from '@/components/ui';
import {
  bookingService,
  bookingRepository,
  providerRepository,
  serviceRepository,
  locationRepository,
  memberRepository,
  userRepository,
  schedulingService,
} from '@booking-app/firebase';
import type { Provider, Service, Location, Member, User } from '@booking-app/shared';
import type { WithId } from '@booking-app/firebase';

interface AvailableSlot {
  date: Date;
  start: string;
  end: string;
  datetime: Date;
  endDatetime: Date;
}

export default function BookingsServiceTestPage() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<unknown>(null);
  const [lastAction, setLastAction] = useState<string>('');

  // Data lists
  const [providers, setProviders] = useState<WithId<Provider>[]>([]);
  const [services, setServices] = useState<WithId<Service>[]>([]);
  const [locations, setLocations] = useState<WithId<Location>[]>([]);
  const [members, setMembers] = useState<WithId<Member>[]>([]);
  const [clients, setClients] = useState<WithId<User>[]>([]);
  const [loadingData, setLoadingData] = useState(true);

  // Available slots
  const [availableSlots, setAvailableSlots] = useState<AvailableSlot[]>([]);
  const [loadingSlots, setLoadingSlots] = useState(false);
  const [slotsError, setSlotsError] = useState<string | null>(null);
  const [selectedSlot, setSelectedSlot] = useState<AvailableSlot | null>(null);

  // Form states
  const [providerId, setProviderId] = useState('');
  const [bookingId, setBookingId] = useState('');

  // Create booking form
  const [serviceId, setServiceId] = useState('');
  const [memberId, setMemberId] = useState('');
  const [locationId, setLocationId] = useState('');
  const [searchStartDate, setSearchStartDate] = useState('');
  const [searchEndDate, setSearchEndDate] = useState('');

  // Client info (for non-logged users)
  const [clientMode, setClientMode] = useState<'existing' | 'new'>('new');
  const [clientId, setClientId] = useState('');
  const [clientName, setClientName] = useState('Test Client');
  const [clientEmail, setClientEmail] = useState('test@example.com');
  const [clientPhone, setClientPhone] = useState('0612345678');
  const [notes, setNotes] = useState('');

  // Cancel by token
  const [cancelToken, setCancelToken] = useState('');

  // Cancel reason
  const [cancelReason, setCancelReason] = useState('');
  const [cancelledBy, setCancelledBy] = useState<'client' | 'provider'>('client');

  // Initialize dates
  useEffect(() => {
    const today = new Date();
    const nextWeek = new Date(today);
    nextWeek.setDate(nextWeek.getDate() + 7);
    setSearchStartDate(today.toISOString().split('T')[0]);
    setSearchEndDate(nextWeek.toISOString().split('T')[0]);
  }, []);

  // Load providers on mount
  useEffect(() => {
    const loadProviders = async () => {
      try {
        const allProviders = await providerRepository.getAll();
        setProviders(allProviders);
        if (allProviders.length > 0) {
          setProviderId(allProviders[0].id);
        }

        // Load clients (users with role 'client')
        const allUsers = await userRepository.getAll();
        const clientUsers = allUsers.filter((u) => u.role === 'client');
        setClients(clientUsers);
      } catch (err) {
        console.error('Error loading providers:', err);
      } finally {
        setLoadingData(false);
      }
    };
    loadProviders();
  }, []);

  // Load provider data when providerId changes
  useEffect(() => {
    if (!providerId) {
      setServices([]);
      setLocations([]);
      setMembers([]);
      return;
    }

    const loadProviderData = async () => {
      try {
        const [providerServices, providerLocations, providerMembers] = await Promise.all([
          serviceRepository.getByProvider(providerId),
          locationRepository.getByProvider(providerId),
          memberRepository.getByProvider(providerId),
        ]);
        setServices(providerServices);
        setLocations(providerLocations);
        setMembers(providerMembers);

        // Auto-select first location if available
        if (providerLocations.length > 0 && !locationId) {
          setLocationId(providerLocations[0].id);
        }
      } catch (err) {
        console.error('Error loading provider data:', err);
      }
    };
    loadProviderData();
  }, [providerId]);

  // Load available slots when selection changes
  const loadAvailableSlots = async () => {
    if (!providerId || !serviceId || !locationId || !searchStartDate || !searchEndDate) {
      return;
    }

    setLoadingSlots(true);
    setSlotsError(null);
    setAvailableSlots([]);
    setSelectedSlot(null);

    try {
      const slots = await schedulingService.getAvailableSlots({
        providerId,
        serviceId,
        locationId,
        memberId: memberId || null,
        startDate: new Date(searchStartDate),
        endDate: new Date(searchEndDate),
      });
      setAvailableSlots(slots);
      if (slots.length === 0) {
        setSlotsError('Aucun creneau disponible pour cette periode. Verifiez les disponibilites dans l\'onglet Scheduling.');
      }
    } catch (err) {
      setSlotsError(err instanceof Error ? err.message : 'Erreur lors du chargement des creneaux');
    } finally {
      setLoadingSlots(false);
    }
  };

  const executeAction = async (action: string, fn: () => Promise<unknown>) => {
    setLoading(true);
    setError(null);
    setLastAction(action);
    try {
      const res = await fn();
      setResult(res);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur inconnue');
      setResult(null);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateBooking = () =>
    executeAction('CREATE BOOKING', async () => {
      if (!providerId) throw new Error('Provider requis');
      if (!serviceId) throw new Error('Service requis');
      if (!locationId) throw new Error('Lieu requis');
      if (!selectedSlot) throw new Error('Selectionnez un creneau disponible');

      const input: Parameters<typeof bookingService.createBooking>[0] = {
        providerId,
        serviceId,
        locationId,
        memberId: memberId || null,
        datetime: selectedSlot.datetime,
        notes: notes || undefined,
      };

      if (clientMode === 'existing' && clientId) {
        input.clientId = clientId;
      } else {
        input.clientInfo = {
          name: clientName,
          email: clientEmail,
          phone: clientPhone,
        };
      }

      const booking = await bookingService.createBooking(input);

      // Get selected service for display
      const selectedService = services.find((s) => s.id === serviceId);

      // Refresh slots after booking
      await loadAvailableSlots();

      return {
        message: 'Reservation creee avec succes',
        booking: {
          id: booking.id,
          service: booking.serviceName,
          location: booking.locationName,
          member: booking.memberName,
          datetime: booking.datetime,
          duration: booking.duration,
          price: `${(booking.price / 100).toFixed(2)}€`,
          status: booking.status,
        },
        cancelToken: booking.cancelToken,
        note: `Prix et duree recuperes automatiquement du service "${selectedService?.name}"`,
      };
    });

  const handleConfirmBooking = () =>
    executeAction('CONFIRM BOOKING', async () => {
      if (!bookingId) throw new Error('Booking ID requis');
      await bookingService.confirmBooking(bookingId, providerId);
      const booking = await bookingRepository.getById(bookingId);
      return {
        message: 'Reservation confirmee',
        status: booking?.status,
      };
    });

  const handleCancelBooking = () =>
    executeAction('CANCEL BOOKING', async () => {
      if (!bookingId) throw new Error('Booking ID requis');
      await bookingService.cancelBooking(
        bookingId,
        cancelledBy,
        providerId,
        cancelReason || undefined
      );
      const booking = await bookingRepository.getById(bookingId);
      return {
        message: 'Reservation annulee',
        status: booking?.status,
        cancelledBy: booking?.cancelledBy,
        cancelReason: booking?.cancelReason,
      };
    });

  const handleCancelByToken = () =>
    executeAction('CANCEL BY TOKEN', async () => {
      if (!cancelToken) throw new Error("Token d'annulation requis");
      await bookingService.cancelBookingByToken(cancelToken);
      return {
        message: 'Reservation annulee via token',
      };
    });

  const handleCompleteBooking = () =>
    executeAction('COMPLETE BOOKING', async () => {
      if (!bookingId) throw new Error('Booking ID requis');
      await bookingService.completeBooking(bookingId, providerId);
      const booking = await bookingRepository.getById(bookingId);
      return {
        message: 'Reservation terminee',
        status: booking?.status,
      };
    });

  const handleMarkNoShow = () =>
    executeAction('MARK NO SHOW', async () => {
      if (!bookingId) throw new Error('Booking ID requis');
      await bookingService.markNoShow(bookingId, providerId);
      const booking = await bookingRepository.getById(bookingId);
      return {
        message: 'Client marque absent',
        status: booking?.status,
      };
    });

  const handleGetBooking = () =>
    executeAction('GET BOOKING', async () => {
      if (!bookingId) throw new Error('Booking ID requis');
      const booking = await bookingRepository.getById(bookingId);
      if (!booking) return { message: 'Reservation non trouvee' };
      return {
        ...booking,
        priceFormatted: `${(booking.price / 100).toFixed(2)}€`,
      };
    });

  const handleGetByProvider = () =>
    executeAction('GET BY PROVIDER', async () => {
      if (!providerId) throw new Error('Provider ID requis');
      const bookings = await bookingRepository.getByProvider(providerId);
      return {
        count: bookings.length,
        bookings: bookings.map((b) => ({
          id: b.id,
          client: b.clientInfo?.name || 'Client connecte',
          service: b.serviceName,
          location: b.locationName,
          datetime: b.datetime,
          status: b.status,
          price: `${(b.price / 100).toFixed(2)}€`,
        })),
      };
    });

  const handleGetStatistics = () =>
    executeAction('GET STATISTICS', async () => {
      if (!providerId) throw new Error('Provider ID requis');
      const stats = await bookingService.getStatistics(providerId);
      return stats;
    });

  // Selected service info
  const selectedService = services.find((s) => s.id === serviceId);

  // Group slots by date for display
  const slotsByDate = availableSlots.reduce((acc, slot) => {
    const dateKey = slot.date.toISOString().split('T')[0];
    if (!acc[dateKey]) {
      acc[dateKey] = [];
    }
    acc[dateKey].push(slot);
    return acc;
  }, {} as Record<string, AvailableSlot[]>);

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString('fr-FR', {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
    });
  };

  if (loadingData) {
    return (
      <div className="flex items-center justify-center h-64">
        <p className="text-gray-500 dark:text-gray-400">Chargement des donnees...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100 mb-2">
          Test Bookings Service
        </h2>
        <p className="text-gray-600 dark:text-gray-400">
          Test des operations reservations: creation, confirmation, annulation, completion.
        </p>
      </div>

      {/* Provider Selection */}
      <Card variant="bordered" className="border-primary-300 dark:border-primary-700">
        <CardHeader title="Selection du Provider" />
        <CardBody>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                Provider *
              </label>
              <select
                value={providerId}
                onChange={(e) => {
                  setProviderId(e.target.value);
                  setServiceId('');
                  setLocationId('');
                  setMemberId('');
                  setAvailableSlots([]);
                  setSelectedSlot(null);
                }}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
              >
                <option value="">-- Selectionner un provider --</option>
                {providers.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.businessName} ({p.id.slice(0, 8)}...)
                  </option>
                ))}
              </select>
              {providers.length === 0 && (
                <p className="text-sm text-amber-600 dark:text-amber-400">
                  Aucun provider. Creez-en un dans l&apos;onglet Provider.
                </p>
              )}
            </div>
            <Input
              label="Booking ID (pour actions)"
              value={bookingId}
              onChange={(e) => setBookingId(e.target.value)}
              placeholder="ID de la reservation"
            />
          </div>
        </CardBody>
      </Card>

      {/* Create Booking */}
      <Card>
        <CardHeader title="Creer une Reservation" />
        <CardBody>
          {/* Step 1: Selection criteria */}
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {/* Service */}
            <div className="space-y-1">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                Prestation *
              </label>
              <select
                value={serviceId}
                onChange={(e) => {
                  setServiceId(e.target.value);
                  setAvailableSlots([]);
                  setSelectedSlot(null);
                }}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
                disabled={!providerId}
              >
                <option value="">-- Selectionner --</option>
                {services.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name} - {(s.price / 100).toFixed(2)}€ ({s.duration}min)
                  </option>
                ))}
              </select>
              {services.length === 0 && providerId && (
                <p className="text-xs text-amber-600">Aucun service. Creez-en dans Catalog.</p>
              )}
            </div>

            {/* Location */}
            <div className="space-y-1">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                Lieu *
              </label>
              <select
                value={locationId}
                onChange={(e) => {
                  setLocationId(e.target.value);
                  setAvailableSlots([]);
                  setSelectedSlot(null);
                }}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
                disabled={!providerId}
              >
                <option value="">-- Selectionner --</option>
                {locations.map((l) => (
                  <option key={l.id} value={l.id}>
                    {l.name} - {l.city}
                  </option>
                ))}
              </select>
              {locations.length === 0 && providerId && (
                <p className="text-xs text-amber-600">Aucun lieu.</p>
              )}
            </div>

            {/* Member */}
            <div className="space-y-1">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                Membre (optionnel)
              </label>
              <select
                value={memberId}
                onChange={(e) => {
                  setMemberId(e.target.value);
                  setAvailableSlots([]);
                  setSelectedSlot(null);
                }}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
                disabled={!providerId}
              >
                <option value="">-- Aucun --</option>
                {members.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.name}
                  </option>
                ))}
              </select>
            </div>

            {/* Date range */}
            <Input
              label="Du *"
              type="date"
              value={searchStartDate}
              onChange={(e) => {
                setSearchStartDate(e.target.value);
                setAvailableSlots([]);
                setSelectedSlot(null);
              }}
            />
            <Input
              label="Au *"
              type="date"
              value={searchEndDate}
              onChange={(e) => {
                setSearchEndDate(e.target.value);
                setAvailableSlots([]);
                setSelectedSlot(null);
              }}
            />

            {/* Search button */}
            <div className="flex items-end">
              <Button
                onClick={loadAvailableSlots}
                loading={loadingSlots}
                disabled={!providerId || !serviceId || !locationId}
                variant="outline"
              >
                Chercher creneaux
              </Button>
            </div>
          </div>

          {/* Selected service info */}
          {selectedService && (
            <div className="mt-4 p-3 bg-primary-50 dark:bg-primary-950 rounded-lg">
              <p className="text-sm text-primary-700 dark:text-primary-300">
                <strong>Service selectionne:</strong> {selectedService.name} |{' '}
                <strong>Duree:</strong> {selectedService.duration} min |{' '}
                <strong>Prix:</strong> {(selectedService.price / 100).toFixed(2)}€
                {selectedService.bufferTime > 0 && (
                  <> | <strong>Buffer:</strong> {selectedService.bufferTime} min</>
                )}
              </p>
            </div>
          )}

          {/* Available slots */}
          <div className="mt-6 pt-6 border-t border-gray-200 dark:border-gray-700">
            <h4 className="font-medium text-gray-900 dark:text-gray-100 mb-4">
              Creneaux disponibles
              {availableSlots.length > 0 && (
                <span className="ml-2 text-sm font-normal text-gray-500">
                  ({availableSlots.length} creneaux)
                </span>
              )}
            </h4>

            {loadingSlots && (
              <p className="text-gray-500 dark:text-gray-400">Chargement des creneaux...</p>
            )}

            {slotsError && (
              <div className="p-3 bg-amber-50 dark:bg-amber-950 border border-amber-200 dark:border-amber-800 rounded-lg">
                <p className="text-amber-700 dark:text-amber-300 text-sm">{slotsError}</p>
              </div>
            )}

            {!loadingSlots && availableSlots.length === 0 && !slotsError && (
              <p className="text-gray-500 dark:text-gray-400 text-sm">
                Selectionnez un service, un lieu et cliquez sur &quot;Chercher creneaux&quot;.
              </p>
            )}

            {Object.keys(slotsByDate).length > 0 && (
              <div className="space-y-4 max-h-80 overflow-y-auto">
                {Object.entries(slotsByDate).map(([dateKey, slots]) => (
                  <div key={dateKey}>
                    <p className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2 capitalize">
                      {formatDate(dateKey)}
                    </p>
                    <div className="flex flex-wrap gap-2">
                      {slots.map((slot, idx) => {
                        const isSelected =
                          selectedSlot?.datetime.getTime() === slot.datetime.getTime();
                        return (
                          <button
                            key={idx}
                            onClick={() => setSelectedSlot(slot)}
                            className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                              isSelected
                                ? 'bg-primary-600 text-white'
                                : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
                            }`}
                          >
                            {slot.start}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            )}

            {selectedSlot && (
              <div className="mt-4 p-3 bg-green-50 dark:bg-green-950 border border-green-200 dark:border-green-800 rounded-lg">
                <p className="text-green-700 dark:text-green-300 text-sm">
                  <strong>Creneau selectionne:</strong>{' '}
                  {selectedSlot.datetime.toLocaleDateString('fr-FR', {
                    weekday: 'long',
                    day: 'numeric',
                    month: 'long',
                  })}{' '}
                  de {selectedSlot.start} a {selectedSlot.end}
                </p>
              </div>
            )}
          </div>

          {/* Client Info */}
          <div className="mt-6 pt-6 border-t border-gray-200 dark:border-gray-700">
            <h4 className="font-medium text-gray-900 dark:text-gray-100 mb-4">
              Informations Client
            </h4>
            <div className="flex gap-4 mb-4">
              <label className="flex items-center gap-2">
                <input
                  type="radio"
                  name="clientMode"
                  checked={clientMode === 'new'}
                  onChange={() => setClientMode('new')}
                  className="text-primary-600"
                />
                <span className="text-sm text-gray-700 dark:text-gray-300">Nouveau client</span>
              </label>
              <label className="flex items-center gap-2">
                <input
                  type="radio"
                  name="clientMode"
                  checked={clientMode === 'existing'}
                  onChange={() => setClientMode('existing')}
                  className="text-primary-600"
                />
                <span className="text-sm text-gray-700 dark:text-gray-300">Client existant</span>
              </label>
            </div>

            {clientMode === 'new' ? (
              <div className="grid gap-4 sm:grid-cols-3">
                <Input
                  label="Nom *"
                  value={clientName}
                  onChange={(e) => setClientName(e.target.value)}
                  placeholder="Nom du client"
                />
                <Input
                  label="Email *"
                  type="email"
                  value={clientEmail}
                  onChange={(e) => setClientEmail(e.target.value)}
                  placeholder="email@example.com"
                />
                <Input
                  label="Telephone *"
                  value={clientPhone}
                  onChange={(e) => setClientPhone(e.target.value)}
                  placeholder="0612345678"
                />
              </div>
            ) : (
              <div className="space-y-1">
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                  Client existant *
                </label>
                <select
                  value={clientId}
                  onChange={(e) => setClientId(e.target.value)}
                  className="w-full max-w-md px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
                >
                  <option value="">-- Selectionner un client --</option>
                  {clients.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.displayName || c.email} ({c.id.slice(0, 8)}...)
                    </option>
                  ))}
                </select>
                {clients.length === 0 && (
                  <p className="text-sm text-amber-600">
                    Aucun client existant. Utilisez &quot;Nouveau client&quot;.
                  </p>
                )}
              </div>
            )}

            <div className="mt-4">
              <Input
                label="Notes (optionnel)"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Notes pour le provider"
              />
            </div>
          </div>

          <div className="mt-6">
            <Button
              onClick={handleCreateBooking}
              loading={loading && lastAction === 'CREATE BOOKING'}
              disabled={!providerId || !serviceId || !locationId || !selectedSlot}
            >
              Creer Reservation
            </Button>
          </div>
          <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">
            Le prix et la duree sont automatiquement recuperes depuis le service selectionne.
          </p>
        </CardBody>
      </Card>

      {/* Booking Status Actions */}
      <Card>
        <CardHeader title="Actions sur Reservation" />
        <CardBody>
          <div className="flex flex-wrap gap-3">
            <Button
              onClick={handleConfirmBooking}
              loading={loading && lastAction === 'CONFIRM BOOKING'}
              disabled={!bookingId}
            >
              Confirmer
            </Button>
            <Button
              variant="outline"
              onClick={handleCompleteBooking}
              loading={loading && lastAction === 'COMPLETE BOOKING'}
              disabled={!bookingId}
            >
              Terminer
            </Button>
            <Button
              variant="outline"
              onClick={handleMarkNoShow}
              loading={loading && lastAction === 'MARK NO SHOW'}
              disabled={!bookingId}
              className="text-amber-600 border-amber-300 hover:bg-amber-50"
            >
              No Show
            </Button>
          </div>
        </CardBody>
      </Card>

      {/* Cancel Booking */}
      <Card>
        <CardHeader title="Annuler Reservation" />
        <CardBody>
          <div className="grid gap-4 sm:grid-cols-3 items-end">
            <div className="space-y-1">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                Annule par
              </label>
              <select
                value={cancelledBy}
                onChange={(e) => setCancelledBy(e.target.value as 'client' | 'provider')}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
              >
                <option value="client">Client</option>
                <option value="provider">Provider</option>
              </select>
            </div>
            <Input
              label="Raison (optionnel)"
              value={cancelReason}
              onChange={(e) => setCancelReason(e.target.value)}
              placeholder="Raison de l'annulation"
            />
            <Button
              variant="outline"
              onClick={handleCancelBooking}
              loading={loading && lastAction === 'CANCEL BOOKING'}
              disabled={!bookingId}
              className="text-red-600 border-red-300 hover:bg-red-50"
            >
              Annuler
            </Button>
          </div>
        </CardBody>
      </Card>

      {/* Cancel by Token */}
      <Card>
        <CardHeader title="Annulation par Token (anonyme)" />
        <CardBody>
          <div className="flex gap-3 items-end">
            <Input
              label="Token d'annulation"
              value={cancelToken}
              onChange={(e) => setCancelToken(e.target.value)}
              placeholder="Token recu lors de la creation"
              className="flex-1"
            />
            <Button
              variant="outline"
              onClick={handleCancelByToken}
              loading={loading && lastAction === 'CANCEL BY TOKEN'}
              className="text-red-600 border-red-300 hover:bg-red-50"
            >
              Annuler via Token
            </Button>
          </div>
          <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">
            Permet l&apos;annulation sans authentification (lien dans email de confirmation).
          </p>
        </CardBody>
      </Card>

      {/* List Bookings */}
      <Card>
        <CardHeader title="Lister Reservations" />
        <CardBody>
          <div className="flex flex-wrap gap-3">
            <Button
              variant="outline"
              onClick={handleGetBooking}
              loading={loading && lastAction === 'GET BOOKING'}
              disabled={!bookingId}
            >
              Obtenir Reservation
            </Button>
            <Button
              variant="outline"
              onClick={handleGetByProvider}
              loading={loading && lastAction === 'GET BY PROVIDER'}
              disabled={!providerId}
            >
              Par Provider
            </Button>
            <Button
              variant="outline"
              onClick={handleGetStatistics}
              loading={loading && lastAction === 'GET STATISTICS'}
              disabled={!providerId}
            >
              Statistiques
            </Button>
          </div>
        </CardBody>
      </Card>

      {/* Result */}
      <Card>
        <CardHeader
          title="Resultat"
          action={
            lastAction && (
              <Badge variant={error ? 'error' : 'success'}>{lastAction}</Badge>
            )
          }
        />
        <CardBody>
          {error ? (
            <div className="p-4 bg-red-50 dark:bg-red-950 border border-red-200 dark:border-red-800 rounded-lg">
              <p className="text-red-600 dark:text-red-400 font-medium">Erreur</p>
              <p className="text-red-500 dark:text-red-300 text-sm mt-1">{error}</p>
            </div>
          ) : result ? (
            <pre className="p-4 bg-gray-100 dark:bg-gray-800 rounded-lg text-sm overflow-x-auto max-h-96 text-gray-800 dark:text-gray-200">
              {JSON.stringify(result, null, 2)}
            </pre>
          ) : (
            <p className="text-gray-500 dark:text-gray-400 text-sm">
              Executez une action pour voir le resultat ici.
            </p>
          )}
        </CardBody>
      </Card>
    </div>
  );
}
