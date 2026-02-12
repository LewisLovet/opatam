'use client';

import { useState } from 'react';
import { Button, Card, CardBody, CardHeader, Input, Select, Badge } from '@/components/ui';
import { bookingRepository } from '@booking-app/firebase';
import type { BookingStatus } from '@booking-app/shared';

const STATUS_OPTIONS = [
  { value: 'pending', label: 'En attente' },
  { value: 'confirmed', label: 'Confirmé' },
  { value: 'cancelled', label: 'Annulé' },
  { value: 'completed', label: 'Terminé' },
  { value: 'noshow', label: 'No-show' },
];

export default function BookingsTestPage() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<unknown>(null);
  const [lastAction, setLastAction] = useState<string>('');

  // Form states
  const [providerId, setProviderId] = useState('');
  const [locationId, setLocationId] = useState('');
  const [serviceId, setServiceId] = useState('');
  const [memberId, setMemberId] = useState('');

  const [clientName, setClientName] = useState('Client Test');
  const [clientEmail, setClientEmail] = useState('client@example.com');
  const [clientPhone, setClientPhone] = useState('0612345678');
  const [bookingDate, setBookingDate] = useState('');
  const [bookingTime, setBookingTime] = useState('10:00');

  const [searchId, setSearchId] = useState('');
  const [searchClientId, setSearchClientId] = useState('');
  const [searchCancelToken, setSearchCancelToken] = useState('');
  const [searchStatus, setSearchStatus] = useState<BookingStatus>('pending');

  const [updateId, setUpdateId] = useState('');
  const [updateStatus, setUpdateStatus] = useState<BookingStatus>('confirmed');

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

  const generateCancelToken = () => {
    return Math.random().toString(36).substring(2, 15);
  };

  const handleCreate = () =>
    executeAction('CREATE', async () => {
      if (!providerId) throw new Error('Provider ID requis');
      if (!locationId) throw new Error('Location ID requis');
      if (!serviceId) throw new Error('Service ID requis');
      if (!bookingDate) throw new Error('Date requise');

      const datetime = new Date(`${bookingDate}T${bookingTime}`);
      const endDatetime = new Date(datetime.getTime() + 60 * 60 * 1000); // +1h

      const id = await bookingRepository.create({
        providerId,
        clientId: null,
        memberId: memberId || null,
        providerName: 'Test Provider',
        providerPhoto: null,
        memberName: memberId ? 'Test Member' : null,
        memberPhoto: null,
        locationId,
        locationName: 'Test Location',
        locationAddress: '123 Rue Test',
        serviceId,
        serviceName: 'Test Service',
        duration: 60,
        price: 5000,
        clientInfo: {
          name: clientName,
          email: clientEmail,
          phone: clientPhone,
        },
        datetime,
        endDatetime,
        status: 'pending',
        cancelledAt: null,
        cancelledBy: null,
        cancelReason: null,
        cancelToken: generateCancelToken(),
        remindersSent: [],
        reviewRequestSentAt: null,
      });
      return { id, message: 'Réservation créée avec succès' };
    });

  const handleGetAll = () =>
    executeAction('GET ALL', async () => {
      const bookings = await bookingRepository.getAll();
      return { count: bookings.length, bookings };
    });

  const handleGetById = () =>
    executeAction('GET BY ID', async () => {
      if (!searchId) throw new Error('ID requis');
      const booking = await bookingRepository.getById(searchId);
      return booking || { message: 'Réservation non trouvée' };
    });

  const handleGetByProvider = () =>
    executeAction('GET BY PROVIDER', async () => {
      if (!providerId) throw new Error('Provider ID requis');
      const bookings = await bookingRepository.getByProvider(providerId);
      return { count: bookings.length, bookings };
    });

  const handleGetByClient = () =>
    executeAction('GET BY CLIENT', async () => {
      if (!searchClientId) throw new Error('Client ID requis');
      const bookings = await bookingRepository.getByClient(searchClientId);
      return { count: bookings.length, bookings };
    });

  const handleGetByMember = () =>
    executeAction('GET BY MEMBER', async () => {
      if (!providerId) throw new Error('Provider ID requis');
      if (!memberId) throw new Error('Member ID requis');
      const bookings = await bookingRepository.getByMember(providerId, memberId);
      return { count: bookings.length, bookings };
    });

  const handleGetByCancelToken = () =>
    executeAction('GET BY TOKEN', async () => {
      if (!searchCancelToken) throw new Error('Token requis');
      const booking = await bookingRepository.getByCancelToken(searchCancelToken);
      return booking || { message: 'Réservation non trouvée' };
    });

  const handleGetByStatus = () =>
    executeAction('GET BY STATUS', async () => {
      const bookings = await bookingRepository.getByStatus(searchStatus);
      return { count: bookings.length, bookings };
    });

  const handleGetPending = () =>
    executeAction('GET PENDING', async () => {
      if (!providerId) throw new Error('Provider ID requis');
      const bookings = await bookingRepository.getPendingByProvider(providerId);
      return { count: bookings.length, bookings };
    });

  const handleGetToday = () =>
    executeAction('GET TODAY', async () => {
      if (!providerId) throw new Error('Provider ID requis');
      const bookings = await bookingRepository.getTodayByProvider(providerId);
      return { count: bookings.length, bookings };
    });

  const handleGetUpcoming = () =>
    executeAction('GET UPCOMING', async () => {
      const from = new Date();
      const to = new Date();
      to.setDate(to.getDate() + 7); // Next 7 days
      const bookings = await bookingRepository.getUpcoming(from, to);
      return { count: bookings.length, bookings };
    });

  const handleUpdateStatus = () =>
    executeAction('UPDATE STATUS', async () => {
      if (!updateId) throw new Error('ID requis');
      await bookingRepository.updateStatus(updateId, updateStatus);
      return { message: `Statut mis à jour : ${updateStatus}`, id: updateId };
    });

  const handleCancel = () =>
    executeAction('CANCEL', async () => {
      if (!updateId) throw new Error('ID requis');
      await bookingRepository.updateStatus(updateId, 'cancelled', {
        cancelledBy: 'provider',
        cancelReason: 'Annulé depuis le test',
      });
      return { message: 'Réservation annulée', id: updateId };
    });

  const handleGetStats = () =>
    executeAction('GET STATS', async () => {
      if (!providerId) throw new Error('Provider ID requis');
      const stats = await bookingRepository.getStatsByProvider(providerId);
      return stats;
    });

  const handleDelete = () =>
    executeAction('DELETE', async () => {
      if (!searchId) throw new Error('ID requis');
      await bookingRepository.delete(searchId);
      return { message: 'Réservation supprimée', id: searchId };
    });

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100 mb-2">
          Test Bookings Repository
        </h2>
        <p className="text-gray-600 dark:text-gray-400">
          Test des opérations CRUD sur la collection bookings.
        </p>
      </div>

      {/* Context */}
      <Card variant="bordered" className="border-primary-300 dark:border-primary-700">
        <CardHeader title="Contexte" />
        <CardBody>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <Input
              label="Provider ID"
              value={providerId}
              onChange={(e) => setProviderId(e.target.value)}
              placeholder="ID du provider"
            />
            <Input
              label="Location ID"
              value={locationId}
              onChange={(e) => setLocationId(e.target.value)}
              placeholder="ID de la location"
            />
            <Input
              label="Service ID"
              value={serviceId}
              onChange={(e) => setServiceId(e.target.value)}
              placeholder="ID du service"
            />
            <Input
              label="Member ID (optionnel)"
              value={memberId}
              onChange={(e) => setMemberId(e.target.value)}
              placeholder="ID du member"
            />
          </div>
        </CardBody>
      </Card>

      {/* Create */}
      <Card>
        <CardHeader title="Créer une Réservation" />
        <CardBody>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <Input
              label="Nom client"
              value={clientName}
              onChange={(e) => setClientName(e.target.value)}
              placeholder="Client Test"
            />
            <Input
              label="Email client"
              value={clientEmail}
              onChange={(e) => setClientEmail(e.target.value)}
              placeholder="client@example.com"
            />
            <Input
              label="Téléphone client"
              value={clientPhone}
              onChange={(e) => setClientPhone(e.target.value)}
              placeholder="0612345678"
            />
            <Input
              label="Date"
              type="date"
              value={bookingDate}
              onChange={(e) => setBookingDate(e.target.value)}
            />
            <Input
              label="Heure"
              type="time"
              value={bookingTime}
              onChange={(e) => setBookingTime(e.target.value)}
            />
          </div>
          <div className="mt-4">
            <Button
              onClick={handleCreate}
              loading={loading && lastAction === 'CREATE'}
              disabled={!providerId || !locationId || !serviceId}
            >
              Créer Réservation
            </Button>
          </div>
        </CardBody>
      </Card>

      {/* Read */}
      <Card>
        <CardHeader title="Lire des Réservations" />
        <CardBody>
          <div className="space-y-4">
            <div className="flex flex-wrap gap-3">
              <Button
                onClick={handleGetAll}
                loading={loading && lastAction === 'GET ALL'}
              >
                Toutes
              </Button>
              <Button
                variant="outline"
                onClick={handleGetByProvider}
                loading={loading && lastAction === 'GET BY PROVIDER'}
                disabled={!providerId}
              >
                Par provider
              </Button>
              <Button
                variant="outline"
                onClick={handleGetPending}
                loading={loading && lastAction === 'GET PENDING'}
                disabled={!providerId}
              >
                En attente
              </Button>
              <Button
                variant="outline"
                onClick={handleGetToday}
                loading={loading && lastAction === 'GET TODAY'}
                disabled={!providerId}
              >
                Aujourd&apos;hui
              </Button>
              <Button
                variant="outline"
                onClick={handleGetUpcoming}
                loading={loading && lastAction === 'GET UPCOMING'}
              >
                7 prochains jours
              </Button>
              <Button
                variant="outline"
                onClick={handleGetStats}
                loading={loading && lastAction === 'GET STATS'}
                disabled={!providerId}
              >
                Statistiques
              </Button>
            </div>

            <div className="flex gap-3 items-end">
              <Input
                label="Chercher par ID"
                value={searchId}
                onChange={(e) => setSearchId(e.target.value)}
                placeholder="ID de la réservation"
                className="flex-1"
              />
              <Button
                variant="outline"
                onClick={handleGetById}
                loading={loading && lastAction === 'GET BY ID'}
              >
                Chercher
              </Button>
              <Button
                variant="outline"
                onClick={handleDelete}
                loading={loading && lastAction === 'DELETE'}
                className="text-red-600 border-red-300 hover:bg-red-50"
              >
                Supprimer
              </Button>
            </div>

            <div className="flex gap-3 items-end">
              <Input
                label="Chercher par Client ID"
                value={searchClientId}
                onChange={(e) => setSearchClientId(e.target.value)}
                placeholder="ID du client"
                className="flex-1"
              />
              <Button
                variant="outline"
                onClick={handleGetByClient}
                loading={loading && lastAction === 'GET BY CLIENT'}
              >
                Chercher
              </Button>
            </div>

            <div className="flex gap-3 items-end">
              <Button
                variant="outline"
                onClick={handleGetByMember}
                loading={loading && lastAction === 'GET BY MEMBER'}
                disabled={!providerId || !memberId}
              >
                Par member
              </Button>
            </div>

            <div className="flex gap-3 items-end">
              <Input
                label="Chercher par Token d'annulation"
                value={searchCancelToken}
                onChange={(e) => setSearchCancelToken(e.target.value)}
                placeholder="Token"
                className="flex-1"
              />
              <Button
                variant="outline"
                onClick={handleGetByCancelToken}
                loading={loading && lastAction === 'GET BY TOKEN'}
              >
                Chercher
              </Button>
            </div>

            <div className="flex gap-3 items-end">
              <Select
                label="Chercher par Statut"
                value={searchStatus}
                onChange={(e) => setSearchStatus(e.target.value as BookingStatus)}
                options={STATUS_OPTIONS}
                className="flex-1"
              />
              <Button
                variant="outline"
                onClick={handleGetByStatus}
                loading={loading && lastAction === 'GET BY STATUS'}
              >
                Chercher
              </Button>
            </div>
          </div>
        </CardBody>
      </Card>

      {/* Update Status */}
      <Card>
        <CardHeader title="Modifier le Statut" />
        <CardBody>
          <div className="flex gap-3 items-end flex-wrap">
            <Input
              label="ID de la réservation"
              value={updateId}
              onChange={(e) => setUpdateId(e.target.value)}
              placeholder="ID"
              className="flex-1 min-w-[200px]"
            />
            <Select
              label="Nouveau statut"
              value={updateStatus}
              onChange={(e) => setUpdateStatus(e.target.value as BookingStatus)}
              options={STATUS_OPTIONS}
              className="flex-1 min-w-[150px]"
            />
            <Button
              variant="outline"
              onClick={handleUpdateStatus}
              loading={loading && lastAction === 'UPDATE STATUS'}
            >
              Modifier
            </Button>
            <Button
              variant="outline"
              onClick={handleCancel}
              loading={loading && lastAction === 'CANCEL'}
              className="text-red-600 border-red-300 hover:bg-red-50"
            >
              Annuler
            </Button>
          </div>
        </CardBody>
      </Card>

      {/* Result */}
      <Card>
        <CardHeader
          title="Résultat"
          action={
            lastAction && (
              <Badge variant={error ? 'error' : 'success'}>
                {lastAction}
              </Badge>
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
              Exécutez une action pour voir le résultat ici.
            </p>
          )}
        </CardBody>
      </Card>
    </div>
  );
}
