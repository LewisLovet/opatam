'use client';

import { useState, useEffect } from 'react';
import { Button, Card, CardBody, CardHeader, Input, Badge } from '@/components/ui';
import {
  schedulingService,
  providerRepository,
  serviceRepository,
  locationRepository,
  memberRepository,
} from '@booking-app/firebase';
import type { Provider, Service, Location, Member } from '@booking-app/shared';
import type { WithId } from '@booking-app/firebase';

const DAYS_OF_WEEK = [
  { value: 0, label: 'Dimanche' },
  { value: 1, label: 'Lundi' },
  { value: 2, label: 'Mardi' },
  { value: 3, label: 'Mercredi' },
  { value: 4, label: 'Jeudi' },
  { value: 5, label: 'Vendredi' },
  { value: 6, label: 'Samedi' },
];

export default function SchedulingServiceTestPage() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<unknown>(null);
  const [lastAction, setLastAction] = useState<string>('');

  // Data lists
  const [providers, setProviders] = useState<WithId<Provider>[]>([]);
  const [services, setServices] = useState<WithId<Service>[]>([]);
  const [locations, setLocations] = useState<WithId<Location>[]>([]);
  const [members, setMembers] = useState<WithId<Member>[]>([]);
  const [loadingData, setLoadingData] = useState(true);

  // Form states
  const [providerId, setProviderId] = useState('');
  const [memberId, setMemberId] = useState('');
  const [locationId, setLocationId] = useState('');
  const [serviceId, setServiceId] = useState('');

  // Availability form (par jour de semaine)
  const [availDayOfWeek, setAvailDayOfWeek] = useState(1); // Lundi par defaut
  const [availStartTime, setAvailStartTime] = useState('09:00');
  const [availEndTime, setAvailEndTime] = useState('18:00');
  const [availIsOpen, setAvailIsOpen] = useState(true);

  // Weekly schedule
  const [weeklyStartTime, setWeeklyStartTime] = useState('09:00');
  const [weeklyEndTime, setWeeklyEndTime] = useState('18:00');

  // Block period
  const [blockStartDate, setBlockStartDate] = useState('');
  const [blockEndDate, setBlockEndDate] = useState('');
  const [blockAllDay, setBlockAllDay] = useState(true);
  const [blockStartTime, setBlockStartTime] = useState('09:00');
  const [blockEndTime, setBlockEndTime] = useState('12:00');
  const [blockReason, setBlockReason] = useState('Vacances');
  const [blockedSlotId, setBlockedSlotId] = useState('');

  // Slot check
  const [slotStartDate, setSlotStartDate] = useState('');
  const [slotEndDate, setSlotEndDate] = useState('');

  // Load providers on mount
  useEffect(() => {
    const loadProviders = async () => {
      try {
        const allProviders = await providerRepository.getAll();
        setProviders(allProviders);
        if (allProviders.length > 0) {
          setProviderId(allProviders[0].id);
        }
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
        if (providerLocations.length > 0) {
          setLocationId(providerLocations[0].id);
        }
        // Auto-select first service if available
        if (providerServices.length > 0) {
          setServiceId(providerServices[0].id);
        }
      } catch (err) {
        console.error('Error loading provider data:', err);
      }
    };
    loadProviderData();
  }, [providerId]);

  const executeAction = async (action: string, fn: () => Promise<unknown>) => {
    setLoading(true);
    setError(null);
    setLastAction(action);
    try {
      const res = await fn();
      setResult(res);
    } catch (err) {
      setError(err instanceof Error ? err.message : JSON.stringify(err));
      setResult(null);
    } finally {
      setLoading(false);
    }
  };

  const handleSetAvailability = () =>
    executeAction('SET AVAILABILITY', async () => {
      if (!providerId) throw new Error('Provider ID requis');
      if (!locationId) throw new Error('Location ID requis');

      const availabilityId = await schedulingService.setAvailability(providerId, {
        locationId,
        memberId: memberId || null,
        dayOfWeek: availDayOfWeek,
        slots: availIsOpen ? [{ start: availStartTime, end: availEndTime }] : [],
        isOpen: availIsOpen,
      });
      return {
        message: 'Disponibilite definie',
        availabilityId,
        day: DAYS_OF_WEEK.find((d) => d.value === availDayOfWeek)?.label,
        locationId,
        memberId: memberId || null,
        isOpen: availIsOpen,
        slots: availIsOpen ? [{ start: availStartTime, end: availEndTime }] : [],
      };
    });

  const handleSetWeeklySchedule = () =>
    executeAction('SET WEEKLY SCHEDULE', async () => {
      if (!providerId) throw new Error('Provider ID requis');
      if (!locationId) throw new Error('Location ID requis');

      // Define Mon-Sat schedule (Dimanche ferme)
      const schedule = [
        { dayOfWeek: 0, slots: [], isOpen: false }, // Dimanche
        { dayOfWeek: 1, slots: [{ start: weeklyStartTime, end: weeklyEndTime }], isOpen: true },
        { dayOfWeek: 2, slots: [{ start: weeklyStartTime, end: weeklyEndTime }], isOpen: true },
        { dayOfWeek: 3, slots: [{ start: weeklyStartTime, end: weeklyEndTime }], isOpen: true },
        { dayOfWeek: 4, slots: [{ start: weeklyStartTime, end: weeklyEndTime }], isOpen: true },
        { dayOfWeek: 5, slots: [{ start: weeklyStartTime, end: weeklyEndTime }], isOpen: true },
        { dayOfWeek: 6, slots: [{ start: weeklyStartTime, end: weeklyEndTime }], isOpen: true }, // Samedi
      ];

      await schedulingService.setWeeklySchedule(
        providerId,
        locationId,
        memberId || null,
        schedule
      );
      return {
        message: 'Planning hebdomadaire defini (Lun-Sam)',
        locationId,
        memberId: memberId || null,
        horaires: `${weeklyStartTime} - ${weeklyEndTime}`,
        dimancheFerme: true,
      };
    });

  const handleBlockPeriod = () =>
    executeAction('BLOCK PERIOD', async () => {
      if (!providerId) throw new Error('Provider ID requis');
      if (!blockStartDate || !blockEndDate) throw new Error('Dates requises');

      const blockedId = await schedulingService.blockPeriod(providerId, {
        memberId: memberId || null,
        locationId: locationId || null,
        startDate: new Date(blockStartDate),
        endDate: new Date(blockEndDate),
        allDay: blockAllDay,
        isRecurring: false,
        startTime: blockAllDay ? null : blockStartTime,
        endTime: blockAllDay ? null : blockEndTime,
        reason: blockReason || null,
      });
      setBlockedSlotId(blockedId);
      return {
        message: 'Periode bloquee',
        blockedSlotId: blockedId,
        startDate: blockStartDate,
        endDate: blockEndDate,
        allDay: blockAllDay,
        reason: blockReason,
      };
    });

  const handleUnblockPeriod = () =>
    executeAction('UNBLOCK PERIOD', async () => {
      if (!providerId) throw new Error('Provider ID requis');
      if (!blockedSlotId) throw new Error('Blocked Slot ID requis');

      await schedulingService.unblockPeriod(providerId, blockedSlotId);
      return {
        message: 'Periode debloquee',
        deletedId: blockedSlotId,
      };
    });

  const handleGetAvailableSlots = () =>
    executeAction('GET AVAILABLE SLOTS', async () => {
      if (!providerId) throw new Error('Provider ID requis');
      if (!serviceId) throw new Error('Service ID requis');
      if (!locationId) throw new Error('Location ID requis');
      if (!slotStartDate || !slotEndDate) throw new Error('Dates requises');

      const slots = await schedulingService.getAvailableSlots({
        providerId,
        serviceId,
        locationId,
        memberId: memberId || null,
        startDate: new Date(slotStartDate),
        endDate: new Date(slotEndDate),
      });
      return {
        message: `${slots.length} creneau(x) disponible(s)`,
        period: `${slotStartDate} - ${slotEndDate}`,
        params: {
          providerId,
          serviceId,
          locationId,
          memberId: memberId || null,
        },
        slotsCount: slots.length,
        slots: slots.slice(0, 20).map((s) => ({
          date: s.date.toISOString().split('T')[0],
          start: s.start,
          end: s.end,
        })),
        note: slots.length > 20 ? `... et ${slots.length - 20} autres creneaux` : undefined,
      };
    });

  const handleIsSlotAvailable = () =>
    executeAction('IS SLOT AVAILABLE', async () => {
      if (!providerId) throw new Error('Provider ID requis');
      if (!locationId) throw new Error('Location ID requis');
      if (!slotStartDate) throw new Error('Date requise');

      const datetime = new Date(`${slotStartDate}T${availStartTime}`);
      const isAvailable = await schedulingService.isSlotAvailable({
        providerId,
        memberId: memberId || null,
        locationId,
        datetime,
        duration: 60, // 1h par defaut
      });
      return {
        message: isAvailable ? 'Creneau disponible' : 'Creneau NON disponible',
        isAvailable,
        datetime: datetime.toISOString(),
        duration: 60,
      };
    });

  const handleGetWeeklySchedule = () =>
    executeAction('GET WEEKLY SCHEDULE', async () => {
      if (!providerId) throw new Error('Provider ID requis');
      if (!locationId) throw new Error('Location ID requis');

      const schedule = await schedulingService.getWeeklySchedule(
        providerId,
        locationId,
        memberId || null
      );
      return {
        params: { providerId, locationId, memberId: memberId || null },
        count: schedule.length,
        schedule: schedule.map((a) => ({
          id: a.id,
          day: DAYS_OF_WEEK.find((d) => d.value === a.dayOfWeek)?.label,
          dayOfWeek: a.dayOfWeek,
          isOpen: a.isOpen,
          slots: a.slots,
        })),
      };
    });

  const handleGetBlockedSlots = () =>
    executeAction('GET BLOCKED SLOTS', async () => {
      if (!providerId) throw new Error('Provider ID requis');
      const blockedSlots = await schedulingService.getBlockedSlots(providerId);
      return {
        count: blockedSlots.length,
        blockedSlots: blockedSlots.map((b) => ({
          id: b.id,
          startDate: b.startDate,
          endDate: b.endDate,
          allDay: b.allDay,
          startTime: b.startTime,
          endTime: b.endTime,
          reason: b.reason,
          memberId: b.memberId,
          locationId: b.locationId,
        })),
      };
    });

  // Set today's date as default
  const today = new Date().toISOString().split('T')[0];
  const nextWeek = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

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
          Test Scheduling Service
        </h2>
        <p className="text-gray-600 dark:text-gray-400">
          Test des operations planning: disponibilites hebdomadaires, blocages, calcul de creneaux.
        </p>
      </div>

      {/* Selection */}
      <Card variant="bordered" className="border-primary-300 dark:border-primary-700">
        <CardHeader title="Selection" />
        <CardBody>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {/* Provider */}
            <div className="space-y-1">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                Provider *
              </label>
              <select
                value={providerId}
                onChange={(e) => {
                  setProviderId(e.target.value);
                  setLocationId('');
                  setServiceId('');
                  setMemberId('');
                }}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
              >
                <option value="">-- Selectionner --</option>
                {providers.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.businessName} ({p.id.slice(0, 8)}...)
                  </option>
                ))}
              </select>
              {providers.length === 0 && (
                <p className="text-xs text-amber-600">Aucun provider.</p>
              )}
            </div>

            {/* Location */}
            <div className="space-y-1">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                Lieu *
              </label>
              <select
                value={locationId}
                onChange={(e) => setLocationId(e.target.value)}
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

            {/* Service */}
            <div className="space-y-1">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                Prestation (pour creneaux)
              </label>
              <select
                value={serviceId}
                onChange={(e) => setServiceId(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
                disabled={!providerId}
              >
                <option value="">-- Selectionner --</option>
                {services.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name} ({s.duration}min)
                  </option>
                ))}
              </select>
              {services.length === 0 && providerId && (
                <p className="text-xs text-amber-600">Aucun service.</p>
              )}
            </div>

            {/* Member */}
            <div className="space-y-1">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                Membre (optionnel)
              </label>
              <select
                value={memberId}
                onChange={(e) => setMemberId(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
                disabled={!providerId}
              >
                <option value="">-- Aucun (provider) --</option>
                {members.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Show selected IDs for debugging */}
          {providerId && (
            <div className="mt-4 p-3 bg-gray-50 dark:bg-gray-800 rounded-lg text-xs font-mono">
              <p><strong>IDs selectionnes:</strong></p>
              <p>providerId: {providerId}</p>
              <p>locationId: {locationId || '(aucun)'}</p>
              <p>serviceId: {serviceId || '(aucun)'}</p>
              <p>memberId: {memberId || '(aucun - provider level)'}</p>
            </div>
          )}
        </CardBody>
      </Card>

      {/* Set Availability (par jour) */}
      <Card>
        <CardHeader title="Definir Disponibilite (jour de semaine)" />
        <CardBody>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <div className="space-y-1">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                Jour
              </label>
              <select
                value={availDayOfWeek}
                onChange={(e) => setAvailDayOfWeek(parseInt(e.target.value))}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
              >
                {DAYS_OF_WEEK.map((day) => (
                  <option key={day.value} value={day.value}>
                    {day.label}
                  </option>
                ))}
              </select>
            </div>
            <Input
              label="Debut"
              type="time"
              value={availStartTime}
              onChange={(e) => setAvailStartTime(e.target.value)}
            />
            <Input
              label="Fin"
              type="time"
              value={availEndTime}
              onChange={(e) => setAvailEndTime(e.target.value)}
            />
            <div className="flex items-center gap-2 pt-6">
              <input
                type="checkbox"
                id="isOpen"
                checked={availIsOpen}
                onChange={(e) => setAvailIsOpen(e.target.checked)}
                className="w-4 h-4"
              />
              <label htmlFor="isOpen" className="text-sm text-gray-700 dark:text-gray-300">
                Ouvert ce jour
              </label>
            </div>
          </div>
          <div className="mt-4">
            <Button
              onClick={handleSetAvailability}
              loading={loading && lastAction === 'SET AVAILABILITY'}
              disabled={!providerId || !locationId}
            >
              Definir Disponibilite
            </Button>
          </div>
        </CardBody>
      </Card>

      {/* Weekly Schedule */}
      <Card>
        <CardHeader title="Planning Hebdomadaire (Lun-Sam)" />
        <CardBody>
          <div className="grid gap-4 sm:grid-cols-2">
            <Input
              label="Heure debut"
              type="time"
              value={weeklyStartTime}
              onChange={(e) => setWeeklyStartTime(e.target.value)}
            />
            <Input
              label="Heure fin"
              type="time"
              value={weeklyEndTime}
              onChange={(e) => setWeeklyEndTime(e.target.value)}
            />
          </div>
          <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">
            Definit les memes horaires du Lundi au Samedi. Dimanche ferme.
          </p>
          <div className="mt-4 flex gap-3">
            <Button
              variant="outline"
              onClick={handleSetWeeklySchedule}
              loading={loading && lastAction === 'SET WEEKLY SCHEDULE'}
              disabled={!providerId || !locationId}
            >
              Appliquer Planning
            </Button>
            <Button
              variant="ghost"
              onClick={handleGetWeeklySchedule}
              loading={loading && lastAction === 'GET WEEKLY SCHEDULE'}
              disabled={!providerId || !locationId}
            >
              Voir Planning
            </Button>
          </div>
        </CardBody>
      </Card>

      {/* Block Period */}
      <Card>
        <CardHeader title="Bloquer Periode" />
        <CardBody>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <Input
              label="Date debut"
              type="date"
              value={blockStartDate || today}
              onChange={(e) => setBlockStartDate(e.target.value)}
            />
            <Input
              label="Date fin"
              type="date"
              value={blockEndDate || today}
              onChange={(e) => setBlockEndDate(e.target.value)}
            />
            <Input
              label="Raison"
              value={blockReason}
              onChange={(e) => setBlockReason(e.target.value)}
              placeholder="Vacances"
            />
          </div>
          <div className="mt-4 flex items-center gap-4">
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="allDay"
                checked={blockAllDay}
                onChange={(e) => setBlockAllDay(e.target.checked)}
                className="w-4 h-4"
              />
              <label htmlFor="allDay" className="text-sm text-gray-700 dark:text-gray-300">
                Journee entiere
              </label>
            </div>
            {!blockAllDay && (
              <>
                <Input
                  label="De"
                  type="time"
                  value={blockStartTime}
                  onChange={(e) => setBlockStartTime(e.target.value)}
                  className="w-32"
                />
                <Input
                  label="A"
                  type="time"
                  value={blockEndTime}
                  onChange={(e) => setBlockEndTime(e.target.value)}
                  className="w-32"
                />
              </>
            )}
          </div>
          <div className="mt-4 flex gap-3">
            <Button
              onClick={handleBlockPeriod}
              loading={loading && lastAction === 'BLOCK PERIOD'}
              disabled={!providerId}
            >
              Bloquer
            </Button>
            <Input
              label=""
              value={blockedSlotId}
              onChange={(e) => setBlockedSlotId(e.target.value)}
              placeholder="ID du blocage (pour debloquer)"
              className="flex-1"
            />
            <Button
              variant="outline"
              onClick={handleUnblockPeriod}
              loading={loading && lastAction === 'UNBLOCK PERIOD'}
              disabled={!providerId || !blockedSlotId}
            >
              Debloquer
            </Button>
          </div>
        </CardBody>
      </Card>

      {/* Check Slots */}
      <Card>
        <CardHeader title="Calculer Creneaux Disponibles" />
        <CardBody>
          <div className="grid gap-4 sm:grid-cols-2">
            <Input
              label="Date debut"
              type="date"
              value={slotStartDate || today}
              onChange={(e) => setSlotStartDate(e.target.value)}
            />
            <Input
              label="Date fin"
              type="date"
              value={slotEndDate || nextWeek}
              onChange={(e) => setSlotEndDate(e.target.value)}
            />
          </div>
          <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">
            Necessite un Service pour calculer la duree des creneaux.
          </p>
          <div className="mt-4 flex flex-wrap gap-3">
            <Button
              onClick={handleGetAvailableSlots}
              loading={loading && lastAction === 'GET AVAILABLE SLOTS'}
              disabled={!providerId || !serviceId || !locationId}
            >
              Obtenir Creneaux
            </Button>
            <Button
              variant="outline"
              onClick={handleIsSlotAvailable}
              loading={loading && lastAction === 'IS SLOT AVAILABLE'}
              disabled={!providerId || !locationId}
            >
              Verifier {slotStartDate || today} {availStartTime}
            </Button>
          </div>
        </CardBody>
      </Card>

      {/* List Data */}
      <Card>
        <CardHeader title="Consulter" />
        <CardBody>
          <div className="flex flex-wrap gap-3">
            <Button
              variant="outline"
              onClick={handleGetWeeklySchedule}
              loading={loading && lastAction === 'GET WEEKLY SCHEDULE'}
              disabled={!providerId || !locationId}
            >
              Planning Hebdo
            </Button>
            <Button
              variant="outline"
              onClick={handleGetBlockedSlots}
              loading={loading && lastAction === 'GET BLOCKED SLOTS'}
              disabled={!providerId}
            >
              Periodes Bloquees
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
              <p className="text-red-500 dark:text-red-300 text-sm mt-1 whitespace-pre-wrap">{error}</p>
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
