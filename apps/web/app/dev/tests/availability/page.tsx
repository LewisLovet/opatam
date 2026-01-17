'use client';

import { useState } from 'react';
import { Button, Card, CardBody, CardHeader, Input, Select, Badge } from '@/components/ui';
import { availabilityRepository, blockedSlotRepository } from '@booking-app/firebase';

const DAYS_OF_WEEK = [
  { value: '0', label: 'Dimanche' },
  { value: '1', label: 'Lundi' },
  { value: '2', label: 'Mardi' },
  { value: '3', label: 'Mercredi' },
  { value: '4', label: 'Jeudi' },
  { value: '5', label: 'Vendredi' },
  { value: '6', label: 'Samedi' },
];

export default function AvailabilityTestPage() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<unknown>(null);
  const [lastAction, setLastAction] = useState<string>('');

  // Provider ID (required for all operations)
  const [providerId, setProviderId] = useState('');
  const [locationId, setLocationId] = useState('');
  const [memberId, setMemberId] = useState('');

  // Availability form states
  const [dayOfWeek, setDayOfWeek] = useState('1');
  const [startTime, setStartTime] = useState('09:00');
  const [endTime, setEndTime] = useState('18:00');
  const [isOpen, setIsOpen] = useState(true);

  // Blocked slot form states
  const [blockStartDate, setBlockStartDate] = useState('');
  const [blockEndDate, setBlockEndDate] = useState('');
  const [blockReason, setBlockReason] = useState('Vacances');
  const [blockAllDay, setBlockAllDay] = useState(true);

  const [searchBlockId, setSearchBlockId] = useState('');

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

  // Availability actions
  const handleSetAvailability = () =>
    executeAction('SET AVAILABILITY', async () => {
      if (!providerId) throw new Error('Provider ID requis');
      if (!locationId) throw new Error('Location ID requis');
      const id = await availabilityRepository.set(providerId, {
        locationId,
        memberId: memberId || null,
        dayOfWeek: parseInt(dayOfWeek, 10),
        slots: [{ start: startTime, end: endTime }],
        isOpen,
      });
      return { id, message: 'Disponibilite definie avec succes' };
    });

  const handleGetAvailability = () =>
    executeAction('GET AVAILABILITY', async () => {
      if (!providerId) throw new Error('Provider ID requis');
      if (!locationId) throw new Error('Location ID requis');
      const availability = await availabilityRepository.get(
        providerId,
        locationId,
        memberId || null,
        parseInt(dayOfWeek, 10)
      );
      return availability || { message: 'Aucune disponibilite trouvee' };
    });

  const handleGetByProvider = () =>
    executeAction('GET BY PROVIDER', async () => {
      if (!providerId) throw new Error('Provider ID requis');
      const availabilities = await availabilityRepository.getByProvider(providerId);
      return { count: availabilities.length, availabilities };
    });

  const handleGetByLocation = () =>
    executeAction('GET BY LOCATION', async () => {
      if (!providerId) throw new Error('Provider ID requis');
      if (!locationId) throw new Error('Location ID requis');
      const availabilities = await availabilityRepository.getByLocation(providerId, locationId);
      return { count: availabilities.length, availabilities };
    });

  const handleGetWeeklySchedule = () =>
    executeAction('GET WEEKLY', async () => {
      if (!providerId) throw new Error('Provider ID requis');
      if (!locationId) throw new Error('Location ID requis');
      const schedule = await availabilityRepository.getWeeklySchedule(
        providerId,
        locationId,
        memberId || null
      );
      return { count: schedule.length, schedule };
    });

  const handleSetWeeklySchedule = () =>
    executeAction('SET WEEKLY', async () => {
      if (!providerId) throw new Error('Provider ID requis');
      if (!locationId) throw new Error('Location ID requis');

      // Create a default week schedule (Mon-Fri 9-18, Sat 9-12, Sun closed)
      const schedule = [
        { dayOfWeek: 0, slots: [], isOpen: false }, // Dimanche
        { dayOfWeek: 1, slots: [{ start: '09:00', end: '18:00' }], isOpen: true },
        { dayOfWeek: 2, slots: [{ start: '09:00', end: '18:00' }], isOpen: true },
        { dayOfWeek: 3, slots: [{ start: '09:00', end: '18:00' }], isOpen: true },
        { dayOfWeek: 4, slots: [{ start: '09:00', end: '18:00' }], isOpen: true },
        { dayOfWeek: 5, slots: [{ start: '09:00', end: '18:00' }], isOpen: true },
        { dayOfWeek: 6, slots: [{ start: '09:00', end: '12:00' }], isOpen: true }, // Samedi
      ];

      await availabilityRepository.setWeeklySchedule(
        providerId,
        locationId,
        memberId || null,
        schedule
      );
      return { message: 'Emploi du temps hebdomadaire defini', schedule };
    });

  // Blocked slot actions
  const handleCreateBlockedSlot = () =>
    executeAction('CREATE BLOCKED', async () => {
      if (!providerId) throw new Error('Provider ID requis');
      if (!blockStartDate || !blockEndDate) throw new Error('Dates requises');

      const id = await blockedSlotRepository.create(providerId, {
        memberId: memberId || null,
        locationId: locationId || null,
        startDate: new Date(blockStartDate),
        endDate: new Date(blockEndDate),
        allDay: blockAllDay,
        startTime: blockAllDay ? null : startTime,
        endTime: blockAllDay ? null : endTime,
        reason: blockReason || null,
      });
      return { id, message: 'Creneau bloque cree avec succes' };
    });

  const handleGetBlockedSlots = () =>
    executeAction('GET BLOCKED', async () => {
      if (!providerId) throw new Error('Provider ID requis');
      const slots = await blockedSlotRepository.getByProvider(providerId);
      return { count: slots.length, slots };
    });

  const handleGetUpcomingBlocked = () =>
    executeAction('GET UPCOMING BLOCKED', async () => {
      if (!providerId) throw new Error('Provider ID requis');
      const slots = await blockedSlotRepository.getUpcoming(providerId);
      return { count: slots.length, slots };
    });

  const handleDeleteBlockedSlot = () =>
    executeAction('DELETE BLOCKED', async () => {
      if (!providerId) throw new Error('Provider ID requis');
      if (!searchBlockId) throw new Error('Blocked Slot ID requis');
      await blockedSlotRepository.delete(providerId, searchBlockId);
      return { message: 'Creneau bloque supprime', id: searchBlockId };
    });

  const handleDeletePastBlocked = () =>
    executeAction('DELETE PAST BLOCKED', async () => {
      if (!providerId) throw new Error('Provider ID requis');
      const count = await blockedSlotRepository.deletePast(providerId);
      return { message: `${count} creneau(x) passe(s) supprime(s)` };
    });

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100 mb-2">
          Test Availability & Blocked Slots
        </h2>
        <p className="text-gray-600 dark:text-gray-400">
          Test des disponibilites et creneaux bloques.
        </p>
      </div>

      {/* Context */}
      <Card variant="bordered" className="border-primary-300 dark:border-primary-700">
        <CardHeader title="Contexte (requis)" />
        <CardBody>
          <div className="grid gap-4 sm:grid-cols-3">
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
              label="Member ID (optionnel)"
              value={memberId}
              onChange={(e) => setMemberId(e.target.value)}
              placeholder="ID du member"
            />
          </div>
        </CardBody>
      </Card>

      {/* Availability */}
      <Card>
        <CardHeader title="Disponibilites" />
        <CardBody>
          <div className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-4">
              <Select
                label="Jour"
                value={dayOfWeek}
                onChange={(e) => setDayOfWeek(e.target.value)}
                options={DAYS_OF_WEEK}
              />
              <Input
                label="Debut"
                type="time"
                value={startTime}
                onChange={(e) => setStartTime(e.target.value)}
              />
              <Input
                label="Fin"
                type="time"
                value={endTime}
                onChange={(e) => setEndTime(e.target.value)}
              />
              <div className="flex items-end">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={isOpen}
                    onChange={(e) => setIsOpen(e.target.checked)}
                    className="rounded border-gray-300"
                  />
                  <span className="text-sm">Ouvert</span>
                </label>
              </div>
            </div>

            <div className="flex flex-wrap gap-3">
              <Button
                onClick={handleSetAvailability}
                loading={loading && lastAction === 'SET AVAILABILITY'}
                disabled={!providerId || !locationId}
              >
                Definir disponibilite
              </Button>
              <Button
                variant="outline"
                onClick={handleGetAvailability}
                loading={loading && lastAction === 'GET AVAILABILITY'}
                disabled={!providerId || !locationId}
              >
                Voir ce jour
              </Button>
              <Button
                variant="outline"
                onClick={handleGetWeeklySchedule}
                loading={loading && lastAction === 'GET WEEKLY'}
                disabled={!providerId || !locationId}
              >
                Voir semaine
              </Button>
              <Button
                variant="outline"
                onClick={handleSetWeeklySchedule}
                loading={loading && lastAction === 'SET WEEKLY'}
                disabled={!providerId || !locationId}
              >
                Semaine par defaut
              </Button>
            </div>

            <div className="flex flex-wrap gap-3">
              <Button
                variant="ghost"
                onClick={handleGetByProvider}
                loading={loading && lastAction === 'GET BY PROVIDER'}
                disabled={!providerId}
              >
                Toutes (provider)
              </Button>
              <Button
                variant="ghost"
                onClick={handleGetByLocation}
                loading={loading && lastAction === 'GET BY LOCATION'}
                disabled={!providerId || !locationId}
              >
                Toutes (location)
              </Button>
            </div>
          </div>
        </CardBody>
      </Card>

      {/* Blocked Slots */}
      <Card>
        <CardHeader title="Creneaux Bloques (vacances, absences...)" />
        <CardBody>
          <div className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <Input
                label="Date debut"
                type="date"
                value={blockStartDate}
                onChange={(e) => setBlockStartDate(e.target.value)}
              />
              <Input
                label="Date fin"
                type="date"
                value={blockEndDate}
                onChange={(e) => setBlockEndDate(e.target.value)}
              />
              <Input
                label="Raison"
                value={blockReason}
                onChange={(e) => setBlockReason(e.target.value)}
                placeholder="Vacances"
              />
              <div className="flex items-end">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={blockAllDay}
                    onChange={(e) => setBlockAllDay(e.target.checked)}
                    className="rounded border-gray-300"
                  />
                  <span className="text-sm">Journee entiere</span>
                </label>
              </div>
            </div>

            <div className="flex flex-wrap gap-3">
              <Button
                onClick={handleCreateBlockedSlot}
                loading={loading && lastAction === 'CREATE BLOCKED'}
                disabled={!providerId}
              >
                Creer blocage
              </Button>
              <Button
                variant="outline"
                onClick={handleGetBlockedSlots}
                loading={loading && lastAction === 'GET BLOCKED'}
                disabled={!providerId}
              >
                Tous les blocages
              </Button>
              <Button
                variant="outline"
                onClick={handleGetUpcomingBlocked}
                loading={loading && lastAction === 'GET UPCOMING BLOCKED'}
                disabled={!providerId}
              >
                Blocages a venir
              </Button>
              <Button
                variant="ghost"
                onClick={handleDeletePastBlocked}
                loading={loading && lastAction === 'DELETE PAST BLOCKED'}
                disabled={!providerId}
              >
                Supprimer passes
              </Button>
            </div>

            <div className="flex gap-3 items-end">
              <Input
                label="ID du blocage a supprimer"
                value={searchBlockId}
                onChange={(e) => setSearchBlockId(e.target.value)}
                placeholder="ID"
                className="flex-1"
              />
              <Button
                variant="outline"
                onClick={handleDeleteBlockedSlot}
                loading={loading && lastAction === 'DELETE BLOCKED'}
                disabled={!providerId}
                className="text-red-600 border-red-300 hover:bg-red-50"
              >
                Supprimer
              </Button>
            </div>
          </div>
        </CardBody>
      </Card>

      {/* Result */}
      <Card>
        <CardHeader
          title="Resultat"
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
              Executez une action pour voir le resultat ici.
            </p>
          )}
        </CardBody>
      </Card>
    </div>
  );
}
