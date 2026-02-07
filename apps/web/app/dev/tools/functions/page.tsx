'use client';

import { useState, useEffect, useRef } from 'react';
import { getFunctions, httpsCallable, connectFunctionsEmulator } from 'firebase/functions';
import { app } from '@booking-app/firebase';
import { Button } from '@/components/ui/Button';
import { Card, CardHeader, CardBody } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Input } from '@/components/ui/Input';
import Link from 'next/link';

// Types pour testFunction
interface ProviderSummary {
  id: string;
  businessName: string;
  category: string;
  isPublished: boolean;
}

interface BookingSummary {
  id: string;
  serviceName: string;
  clientName: string;
  status: string;
  datetime: string;
}

interface TestFunctionResponse {
  success: boolean;
  timestamp: string;
  data: {
    providersCount: number;
    providers: ProviderSummary[];
    bookingsCount: number;
    bookings: BookingSummary[];
  };
  message: string;
}

// Types pour recalculateNextSlot
interface RecalculateResponse {
  success: boolean;
  providerId: string;
  nextAvailableSlot: string | null;
  message: string;
  debug?: {
    memberFound: boolean;
    availabilitiesCount: number;
    blockedSlotsCount: number;
    futureBookingsCount: number;
  };
}

// Types pour testCalculateNextSlot (détaillé)
interface AvailabilityDebug {
  dayOfWeek: number;
  dayName: string;
  isOpen: boolean;
  slots: { start: string; end: string }[];
}

interface BlockedSlotDebug {
  startDate: string;
  endDate: string;
  allDay: boolean;
  reason: string | null;
}

interface BookingDebug {
  date: string;
  time: string;
  serviceName: string;
  status: string;
}

interface DayAnalysis {
  date: string;
  dayName: string;
  status: 'closed' | 'blocked' | 'full' | 'available';
  availableMinutes: number;
  bookedMinutes: number;
}

interface TestDetailedResponse {
  success: boolean;
  providerId: string;
  nextAvailableSlot: string | null;
  member: {
    id: string;
    name: string;
    isDefault: boolean;
  } | null;
  availabilities: AvailabilityDebug[];
  blockedSlots: BlockedSlotDebug[];
  futureBookings: BookingDebug[];
  next7Days: DayAnalysis[];
  message: string;
}

// Types pour testPushNotification
type NotificationType =
  | 'simple'
  | 'new_booking'
  | 'booking_confirmed'
  | 'booking_cancelled_by_client'
  | 'booking_cancelled_by_provider'
  | 'booking_rescheduled';

interface TestPushNotificationResponse {
  success: boolean;
  message: string;
  notificationType: NotificationType;
  details: {
    sentCount: number;
    failedCount: number;
    invalidTokens: string[];
  };
}

const NOTIFICATION_TYPES: { value: NotificationType; label: string }[] = [
  { value: 'simple', label: 'Test simple' },
  { value: 'new_booking', label: 'Nouveau RDV (provider)' },
  { value: 'booking_confirmed', label: 'RDV confirmé (client)' },
  { value: 'booking_cancelled_by_client', label: 'Annulé par client (provider)' },
  { value: 'booking_cancelled_by_provider', label: 'Annulé par provider (client)' },
  { value: 'booking_rescheduled', label: 'RDV modifié (client)' },
];

// Types pour testCreateBooking
type BookingTestScenario =
  | 'create'
  | 'confirm'
  | 'cancel_by_client'
  | 'cancel_by_provider'
  | 'reschedule';

interface TestCreateBookingResponse {
  success: boolean;
  bookingId: string;
  scenario: BookingTestScenario;
  message: string;
  steps: string[];
}

interface TestCleanupBookingsResponse {
  success: boolean;
  deletedCount: number;
  message: string;
}

const BOOKING_SCENARIOS: { value: BookingTestScenario; label: string; description: string }[] = [
  { value: 'create', label: 'Création', description: 'Crée un booking pending → notifie le provider' },
  { value: 'confirm', label: 'Confirmation', description: 'Crée puis confirme → notifie le client' },
  { value: 'cancel_by_client', label: 'Annulation client', description: 'Crée confirmé puis annule par client → notifie le provider' },
  { value: 'cancel_by_provider', label: 'Annulation provider', description: 'Crée confirmé puis annule par provider → notifie le client' },
  { value: 'reschedule', label: 'Replanification', description: 'Crée confirmé puis change la date → notifie le client' },
];

// Types pour recalculateAllProviders
interface ProviderResult {
  providerId: string;
  businessName: string;
  previousSlot: string | null;
  newSlot: string | null;
  changed: boolean;
  error: string | null;
}

interface RecalculateAllResponse {
  success: boolean;
  totalProviders: number;
  skipped: number;
  updated: number;
  unchanged: number;
  errors: number;
  results: ProviderResult[];
  executionTimeMs: number;
  message: string;
}

export default function TestFunctionsPage() {
  const [testResult, setTestResult] = useState<TestFunctionResponse | null>(null);
  const [recalculateResult, setRecalculateResult] = useState<RecalculateResponse | null>(null);
  const [detailedResult, setDetailedResult] = useState<TestDetailedResponse | null>(null);
  const [allProvidersResult, setAllProvidersResult] = useState<RecalculateAllResponse | null>(null);
  const [pushResult, setPushResult] = useState<TestPushNotificationResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState<string | null>(null);
  const [isEmulator, setIsEmulator] = useState(false);
  const [providerId, setProviderId] = useState('');
  const [pushUserId, setPushUserId] = useState('');
  const [pushNotifType, setPushNotifType] = useState<NotificationType>('simple');
  // Test booking states
  const [bookingProviderId, setBookingProviderId] = useState('');
  const [bookingClientId, setBookingClientId] = useState('');
  const [bookingScenario, setBookingScenario] = useState<BookingTestScenario>('create');
  const [bookingResult, setBookingResult] = useState<TestCreateBookingResponse | null>(null);
  const [cleanupResult, setCleanupResult] = useState<TestCleanupBookingsResponse | null>(null);
  const emulatorConnected = useRef(false);

  useEffect(() => {
    const isLocalhost = window.location.hostname === 'localhost';
    setIsEmulator(isLocalhost);

    if (isLocalhost && !emulatorConnected.current) {
      const functions = getFunctions(app);
      connectFunctionsEmulator(functions, 'localhost', 5001);
      emulatorConnected.current = true;
    }
  }, []);

  const runTestFunction = async () => {
    const functions = getFunctions(app);
    setLoading('test');
    setError(null);
    setTestResult(null);

    try {
      const testFn = httpsCallable<void, TestFunctionResponse>(functions, 'testFunction');
      const response = await testFn();
      setTestResult(response.data);

      if (response.data.data.providers.length > 0 && !providerId) {
        setProviderId(response.data.data.providers[0].id);
      }
    } catch (err) {
      console.error('Error calling testFunction:', err);
      handleError(err);
    } finally {
      setLoading(null);
    }
  };

  const runRecalculateNextSlot = async () => {
    if (!providerId.trim()) {
      setError('Veuillez entrer un providerId');
      return;
    }

    const functions = getFunctions(app);
    setLoading('recalculate');
    setError(null);
    setRecalculateResult(null);

    try {
      const recalculateFn = httpsCallable<{ providerId: string }, RecalculateResponse>(
        functions,
        'recalculateNextSlot'
      );
      const response = await recalculateFn({ providerId: providerId.trim() });
      setRecalculateResult(response.data);
    } catch (err) {
      console.error('Error calling recalculateNextSlot:', err);
      handleError(err);
    } finally {
      setLoading(null);
    }
  };

  const runTestDetailedSlot = async () => {
    if (!providerId.trim()) {
      setError('Veuillez entrer un providerId');
      return;
    }

    const functions = getFunctions(app);
    setLoading('detailed');
    setError(null);
    setDetailedResult(null);

    try {
      const testDetailedFn = httpsCallable<{ providerId: string }, TestDetailedResponse>(
        functions,
        'testCalculateNextSlot'
      );
      const response = await testDetailedFn({ providerId: providerId.trim() });
      setDetailedResult(response.data);
    } catch (err) {
      console.error('Error calling testCalculateNextSlot:', err);
      handleError(err);
    } finally {
      setLoading(null);
    }
  };

  const handleError = (err: unknown) => {
    const errorMessage = err instanceof Error ? err.message : 'Erreur inconnue';

    if (errorMessage.includes('INTERNAL') || errorMessage.includes('Failed to fetch')) {
      setError(
        `Impossible de joindre l'émulateur Functions.\n\n` +
        `Lancez l'émulateur avec :\n` +
        `firebase emulators:start --only functions`
      );
    } else {
      setError(errorMessage);
    }
  };

  const getStatusColor = (status: DayAnalysis['status']) => {
    switch (status) {
      case 'available': return 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300';
      case 'closed': return 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400';
      case 'blocked': return 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300';
      case 'full': return 'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-300';
      default: return 'bg-gray-100 text-gray-600';
    }
  };

  const getStatusLabel = (status: DayAnalysis['status']) => {
    switch (status) {
      case 'available': return 'Disponible';
      case 'closed': return 'Fermé';
      case 'blocked': return 'Bloqué';
      case 'full': return 'Complet';
      default: return status;
    }
  };

  const runRecalculateAllProviders = async () => {
    const functions = getFunctions(app);
    setLoading('allProviders');
    setError(null);
    setAllProvidersResult(null);

    try {
      const recalculateAllFn = httpsCallable<void, RecalculateAllResponse>(
        functions,
        'recalculateAllProviders'
      );
      const response = await recalculateAllFn();
      setAllProvidersResult(response.data);
    } catch (err) {
      console.error('Error calling recalculateAllProviders:', err);
      handleError(err);
    } finally {
      setLoading(null);
    }
  };

  const formatSlotDate = (isoString: string | null) => {
    if (!isoString) return 'Aucun';
    return new Date(isoString).toLocaleDateString('fr-FR', {
      weekday: 'short',
      day: 'numeric',
      month: 'short',
    });
  };

  const runTestPushNotification = async () => {
    if (!pushUserId.trim()) {
      setError('Veuillez entrer un userId');
      return;
    }

    const functions = getFunctions(app);
    setLoading('push');
    setError(null);
    setPushResult(null);

    try {
      const pushFn = httpsCallable<
        { userId: string; type?: NotificationType },
        TestPushNotificationResponse
      >(functions, 'testPushNotification');
      const response = await pushFn({
        userId: pushUserId.trim(),
        type: pushNotifType,
      });
      setPushResult(response.data);
    } catch (err) {
      console.error('Error calling testPushNotification:', err);
      handleError(err);
    } finally {
      setLoading(null);
    }
  };

  const runTestCreateBooking = async () => {
    if (!bookingProviderId.trim()) {
      setError('Veuillez entrer un providerId');
      return;
    }

    const functions = getFunctions(app);
    setLoading('createBooking');
    setError(null);
    setBookingResult(null);

    try {
      const createBookingFn = httpsCallable<
        { providerId: string; clientId?: string; scenario: BookingTestScenario },
        TestCreateBookingResponse
      >(functions, 'testCreateBooking');
      const response = await createBookingFn({
        providerId: bookingProviderId.trim(),
        clientId: bookingClientId.trim() || undefined,
        scenario: bookingScenario,
      });
      setBookingResult(response.data);
    } catch (err) {
      console.error('Error calling testCreateBooking:', err);
      handleError(err);
    } finally {
      setLoading(null);
    }
  };

  const runTestCleanupBookings = async () => {
    const functions = getFunctions(app);
    setLoading('cleanup');
    setError(null);
    setCleanupResult(null);

    try {
      const cleanupFn = httpsCallable<void, TestCleanupBookingsResponse>(
        functions,
        'testCleanupBookings'
      );
      const response = await cleanupFn();
      setCleanupResult(response.data);
    } catch (err) {
      console.error('Error calling testCleanupBookings:', err);
      handleError(err);
    } finally {
      setLoading(null);
    }
  };

  return (
    <div className="py-12 px-4">
      <div className="max-w-2xl mx-auto space-y-6">
        {/* Back link */}
        <Link href="/dev" className="text-sm text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200">
          &larr; Retour au Dev Hub
        </Link>

        <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">
          Test Cloud Functions
        </h1>

        {/* Recalculer TOUS les providers */}
        <Card>
          <CardHeader
            title="Recalculer TOUS les providers"
            description="Met à jour nextAvailableSlot pour tous les providers publiés"
            action={
              <Badge variant={isEmulator ? 'info' : 'success'}>
                {isEmulator ? 'Émulateur' : 'Production'}
              </Badge>
            }
          />
          <CardBody className="space-y-4">
            <Button
              onClick={runRecalculateAllProviders}
              loading={loading === 'allProviders'}
              fullWidth
              variant="primary"
            >
              Recalculer tous les providers
            </Button>

            {allProvidersResult && (
              <div className="space-y-4">
                <div className={`p-4 rounded-lg border ${
                  allProvidersResult.success
                    ? 'bg-green-50 dark:bg-green-900/20 border-green-300 dark:border-green-700'
                    : 'bg-red-50 dark:bg-red-900/20 border-red-300 dark:border-red-700'
                }`}>
                  <div className="flex items-center justify-between mb-2">
                    <Badge variant={allProvidersResult.success ? 'success' : 'error'}>
                      {allProvidersResult.success ? 'Succès' : 'Erreur'}
                    </Badge>
                    <span className="text-xs text-gray-500 dark:text-gray-400">
                      {allProvidersResult.executionTimeMs}ms
                    </span>
                  </div>
                  <p className="text-sm text-gray-800 dark:text-gray-200">{allProvidersResult.message}</p>

                  <div className="flex flex-wrap gap-4 mt-3">
                    <div className="text-center">
                      <div className="text-2xl font-bold text-gray-900 dark:text-gray-100">{allProvidersResult.totalProviders}</div>
                      <div className="text-xs text-gray-500 dark:text-gray-400">Traités</div>
                    </div>
                    {allProvidersResult.skipped > 0 && (
                      <div className="text-center">
                        <div className="text-2xl font-bold text-blue-600 dark:text-blue-400">{allProvidersResult.skipped}</div>
                        <div className="text-xs text-gray-500 dark:text-gray-400">Ignorés</div>
                      </div>
                    )}
                    <div className="text-center">
                      <div className="text-2xl font-bold text-green-600 dark:text-green-400">{allProvidersResult.updated}</div>
                      <div className="text-xs text-gray-500 dark:text-gray-400">Mis à jour</div>
                    </div>
                    <div className="text-center">
                      <div className="text-2xl font-bold text-gray-500 dark:text-gray-400">{allProvidersResult.unchanged}</div>
                      <div className="text-xs text-gray-500 dark:text-gray-400">Inchangés</div>
                    </div>
                    {allProvidersResult.errors > 0 && (
                      <div className="text-center">
                        <div className="text-2xl font-bold text-red-600 dark:text-red-400">{allProvidersResult.errors}</div>
                        <div className="text-xs text-gray-500 dark:text-gray-400">Erreurs</div>
                      </div>
                    )}
                  </div>
                </div>

                {allProvidersResult.results.length > 0 && (
                  <div className="p-3 bg-gray-100 dark:bg-gray-800 rounded-lg">
                    <p className="text-sm font-medium mb-3 text-gray-900 dark:text-gray-100">Résultat par provider</p>
                    <div className="space-y-2">
                      {allProvidersResult.results.map((result) => (
                        <div
                          key={result.providerId}
                          className={`p-3 rounded border ${
                            result.error
                              ? 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800'
                              : result.changed
                                ? 'bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800'
                                : 'bg-white dark:bg-gray-700 border-gray-200 dark:border-gray-600'
                          }`}
                        >
                          <div className="flex items-center justify-between">
                            <div>
                              <span className="font-medium text-gray-900 dark:text-gray-100">{result.businessName}</span>
                              <span className="text-xs text-gray-500 dark:text-gray-400 ml-2">{result.providerId.substring(0, 8)}...</span>
                            </div>
                            {result.error ? (
                              <Badge variant="error">Erreur</Badge>
                            ) : result.changed ? (
                              <Badge variant="success">Mis à jour</Badge>
                            ) : (
                              <Badge variant="default">Inchangé</Badge>
                            )}
                          </div>

                          {result.error ? (
                            <p className="text-xs text-red-600 dark:text-red-400 mt-1">{result.error}</p>
                          ) : (
                            <div className="flex items-center gap-2 mt-2 text-sm">
                              <span className="text-gray-500 dark:text-gray-400">{formatSlotDate(result.previousSlot)}</span>
                              <span className="text-gray-400 dark:text-gray-500">→</span>
                              <span className={result.changed ? 'font-medium text-green-700 dark:text-green-300' : 'text-gray-700 dark:text-gray-300'}>
                                {formatSlotDate(result.newSlot)}
                              </span>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                <details className="p-3 bg-gray-100 dark:bg-gray-800 rounded-lg">
                  <summary className="text-sm font-medium cursor-pointer text-gray-900 dark:text-gray-100">
                    Voir la réponse JSON complète
                  </summary>
                  <pre className="text-xs overflow-auto max-h-60 mt-2 text-gray-700 dark:text-gray-300">
                    {JSON.stringify(allProvidersResult, null, 2)}
                  </pre>
                </details>
              </div>
            )}
          </CardBody>
        </Card>

        {/* Test Push Notification */}
        <Card>
          <CardHeader
            title="Test Push Notification"
            description="Envoyer une notification push de test à un utilisateur"
            action={
              <Badge variant={isEmulator ? 'info' : 'success'}>
                {isEmulator ? 'Émulateur' : 'Production'}
              </Badge>
            }
          />
          <CardBody className="space-y-4">
            <Input
              label="User ID"
              value={pushUserId}
              onChange={(e) => setPushUserId(e.target.value)}
              placeholder="ID de l'utilisateur (Firebase Auth UID)"
            />

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Type de notification
              </label>
              <select
                value={pushNotifType}
                onChange={(e) => setPushNotifType(e.target.value as NotificationType)}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-primary-500 focus:border-transparent"
              >
                {NOTIFICATION_TYPES.map((type) => (
                  <option key={type.value} value={type.value}>
                    {type.label}
                  </option>
                ))}
              </select>
            </div>

            <Button
              onClick={runTestPushNotification}
              loading={loading === 'push'}
              disabled={!pushUserId.trim()}
              fullWidth
              variant="primary"
            >
              Envoyer la notification
            </Button>

            {pushResult && (
              <div className="space-y-3">
                <div className={`p-4 rounded-lg border ${
                  pushResult.success
                    ? 'bg-green-50 dark:bg-green-900/20 border-green-300 dark:border-green-700'
                    : 'bg-yellow-50 dark:bg-yellow-900/20 border-yellow-300 dark:border-yellow-700'
                }`}>
                  <div className="flex items-center gap-2 mb-2">
                    <Badge variant={pushResult.success ? 'success' : 'warning'}>
                      {pushResult.success ? 'Succès' : 'Erreur'}
                    </Badge>
                    <Badge variant="info">
                      {NOTIFICATION_TYPES.find(t => t.value === pushResult.notificationType)?.label || pushResult.notificationType}
                    </Badge>
                  </div>
                  <p className="text-sm text-gray-800 dark:text-gray-200">{pushResult.message}</p>

                  <div className="flex flex-wrap gap-4 mt-3">
                    <div className="text-center">
                      <div className="text-2xl font-bold text-green-600 dark:text-green-400">{pushResult.details.sentCount}</div>
                      <div className="text-xs text-gray-500 dark:text-gray-400">Envoyées</div>
                    </div>
                    {pushResult.details.failedCount > 0 && (
                      <div className="text-center">
                        <div className="text-2xl font-bold text-red-600 dark:text-red-400">{pushResult.details.failedCount}</div>
                        <div className="text-xs text-gray-500 dark:text-gray-400">Échouées</div>
                      </div>
                    )}
                    {pushResult.details.invalidTokens.length > 0 && (
                      <div className="text-center">
                        <div className="text-2xl font-bold text-orange-600 dark:text-orange-400">{pushResult.details.invalidTokens.length}</div>
                        <div className="text-xs text-gray-500 dark:text-gray-400">Tokens invalides</div>
                      </div>
                    )}
                  </div>
                </div>

                <details className="p-3 bg-gray-100 dark:bg-gray-800 rounded-lg">
                  <summary className="text-sm font-medium cursor-pointer text-gray-900 dark:text-gray-100">
                    Voir la réponse JSON complète
                  </summary>
                  <pre className="text-xs overflow-auto max-h-40 mt-2 text-gray-700 dark:text-gray-300">
                    {JSON.stringify(pushResult, null, 2)}
                  </pre>
                </details>
              </div>
            )}
          </CardBody>
        </Card>

        {/* Test onBookingWrite Trigger */}
        <Card>
          <CardHeader
            title="Test onBookingWrite (Trigger)"
            description="Crée un booking de test pour déclencher le trigger et tester les notifications"
            action={
              <Badge variant={isEmulator ? 'info' : 'success'}>
                {isEmulator ? 'Émulateur' : 'Production'}
              </Badge>
            }
          />
          <CardBody className="space-y-4">
            <Input
              label="Provider ID"
              value={bookingProviderId}
              onChange={(e) => setBookingProviderId(e.target.value)}
              placeholder="ID du provider (doit avoir des pushTokens)"
            />

            <Input
              label="Client ID (optionnel)"
              value={bookingClientId}
              onChange={(e) => setBookingClientId(e.target.value)}
              placeholder="ID du client (pour tester les notifs client)"
            />

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Scénario de test
              </label>
              <select
                value={bookingScenario}
                onChange={(e) => setBookingScenario(e.target.value as BookingTestScenario)}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-primary-500 focus:border-transparent"
              >
                {BOOKING_SCENARIOS.map((scenario) => (
                  <option key={scenario.value} value={scenario.value}>
                    {scenario.label}
                  </option>
                ))}
              </select>
              <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                {BOOKING_SCENARIOS.find(s => s.value === bookingScenario)?.description}
              </p>
            </div>

            <div className="flex gap-2">
              <Button
                onClick={runTestCreateBooking}
                loading={loading === 'createBooking'}
                disabled={!bookingProviderId.trim()}
                className="flex-1"
                variant="primary"
              >
                Créer booking de test
              </Button>
              <Button
                onClick={runTestCleanupBookings}
                loading={loading === 'cleanup'}
                variant="secondary"
              >
                Nettoyer
              </Button>
            </div>

            {cleanupResult && (
              <div className={`p-3 rounded-lg border ${
                cleanupResult.success
                  ? 'bg-blue-50 dark:bg-blue-900/20 border-blue-300 dark:border-blue-700'
                  : 'bg-yellow-50 dark:bg-yellow-900/20 border-yellow-300 dark:border-yellow-700'
              }`}>
                <p className="text-sm text-gray-800 dark:text-gray-200">{cleanupResult.message}</p>
              </div>
            )}

            {bookingResult && (
              <div className="space-y-3">
                <div className={`p-4 rounded-lg border ${
                  bookingResult.success
                    ? 'bg-green-50 dark:bg-green-900/20 border-green-300 dark:border-green-700'
                    : 'bg-yellow-50 dark:bg-yellow-900/20 border-yellow-300 dark:border-yellow-700'
                }`}>
                  <div className="flex items-center gap-2 mb-2">
                    <Badge variant={bookingResult.success ? 'success' : 'warning'}>
                      {bookingResult.success ? 'Succès' : 'Erreur'}
                    </Badge>
                    <Badge variant="info">
                      {BOOKING_SCENARIOS.find(s => s.value === bookingResult.scenario)?.label || bookingResult.scenario}
                    </Badge>
                  </div>
                  <p className="text-sm text-gray-800 dark:text-gray-200 mb-2">{bookingResult.message}</p>

                  {bookingResult.bookingId && (
                    <p className="text-xs font-mono text-gray-600 dark:text-gray-400 mb-3">
                      Booking ID: {bookingResult.bookingId}
                    </p>
                  )}

                  {bookingResult.steps.length > 0 && (
                    <div className="p-3 bg-gray-100 dark:bg-gray-800 rounded-lg">
                      <p className="text-xs font-medium text-gray-700 dark:text-gray-300 mb-2">Étapes exécutées :</p>
                      <ol className="list-decimal list-inside text-xs text-gray-600 dark:text-gray-400 space-y-1">
                        {bookingResult.steps.map((step, i) => (
                          <li key={i}>{step}</li>
                        ))}
                      </ol>
                    </div>
                  )}
                </div>

                <details className="p-3 bg-gray-100 dark:bg-gray-800 rounded-lg">
                  <summary className="text-sm font-medium cursor-pointer text-gray-900 dark:text-gray-100">
                    Voir la réponse JSON complète
                  </summary>
                  <pre className="text-xs overflow-auto max-h-40 mt-2 text-gray-700 dark:text-gray-300">
                    {JSON.stringify(bookingResult, null, 2)}
                  </pre>
                </details>
              </div>
            )}
          </CardBody>
        </Card>

        <hr className="border-gray-300 dark:border-gray-700" />

        {/* Test de connexion */}
        <Card>
          <CardHeader
            title="1. Test de connexion"
            description="Vérifiez la connexion à Firestore et récupérez les providers"
            action={
              <Badge variant={isEmulator ? 'info' : 'success'}>
                {isEmulator ? 'Émulateur' : 'Production'}
              </Badge>
            }
          />
          <CardBody className="space-y-4">
            <Button
              onClick={runTestFunction}
              loading={loading === 'test'}
              fullWidth
            >
              Tester la connexion
            </Button>

            {testResult && (
              <div className="space-y-3">
                <div className={`p-3 rounded-lg border ${
                  testResult.success
                    ? 'bg-green-50 dark:bg-green-900/20 border-green-300 dark:border-green-700'
                    : 'bg-yellow-50 dark:bg-yellow-900/20 border-yellow-300 dark:border-yellow-700'
                }`}>
                  <Badge variant={testResult.success ? 'success' : 'warning'}>
                    {testResult.success ? 'Succès' : 'Erreur'}
                  </Badge>
                  <p className="text-sm mt-1 text-gray-800 dark:text-gray-200">{testResult.message}</p>
                </div>

                {testResult.data.providers.length > 0 && (
                  <div className="p-3 bg-gray-100 dark:bg-gray-800 rounded-lg">
                    <p className="text-sm font-medium mb-2 text-gray-900 dark:text-gray-100">Providers disponibles :</p>
                    <ul className="space-y-1 text-sm">
                      {testResult.data.providers.map((p) => (
                        <li key={p.id} className="flex items-center gap-2">
                          <button
                            onClick={() => setProviderId(p.id)}
                            className="text-primary-600 dark:text-primary-400 hover:underline font-medium"
                          >
                            {p.businessName}
                          </button>
                          <span className="text-gray-500 dark:text-gray-400 text-xs">{p.id}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            )}
          </CardBody>
        </Card>

        {/* Recalculate Next Slot */}
        <Card>
          <CardHeader
            title="2. Recalculer nextAvailableSlot"
            description="Testez le calcul du prochain créneau disponible pour un provider"
          />
          <CardBody className="space-y-4">
            <Input
              label="Provider ID"
              value={providerId}
              onChange={(e) => setProviderId(e.target.value)}
              placeholder="Ex: abc123..."
            />

            <Button
              onClick={runRecalculateNextSlot}
              loading={loading === 'recalculate'}
              disabled={!providerId.trim()}
              fullWidth
            >
              Recalculer nextAvailableSlot
            </Button>

            {recalculateResult && (
              <div className="space-y-3">
                <div className={`p-3 rounded-lg border ${
                  recalculateResult.success
                    ? 'bg-green-50 dark:bg-green-900/20 border-green-300 dark:border-green-700'
                    : 'bg-yellow-50 dark:bg-yellow-900/20 border-yellow-300 dark:border-yellow-700'
                }`}>
                  <Badge variant={recalculateResult.success ? 'success' : 'warning'}>
                    {recalculateResult.success ? 'Succès' : 'Erreur'}
                  </Badge>
                  <p className="text-sm mt-1 text-gray-800 dark:text-gray-200">{recalculateResult.message}</p>

                  {recalculateResult.nextAvailableSlot && (
                    <p className="text-sm font-medium mt-2 text-gray-900 dark:text-gray-100">
                      Prochain slot : {new Date(recalculateResult.nextAvailableSlot).toLocaleDateString('fr-FR', {
                        weekday: 'long',
                        day: 'numeric',
                        month: 'long',
                        year: 'numeric',
                      })}
                    </p>
                  )}
                </div>

                {recalculateResult.debug && (
                  <div className="p-3 bg-gray-100 dark:bg-gray-800 rounded-lg">
                    <p className="text-sm font-medium mb-2 text-gray-900 dark:text-gray-100">Debug info :</p>
                    <ul className="text-sm space-y-1 text-gray-700 dark:text-gray-300">
                      <li>Membre trouvé : {recalculateResult.debug.memberFound ? 'Oui' : 'Non'}</li>
                      <li>Availabilities : {recalculateResult.debug.availabilitiesCount}</li>
                      <li>Blocked slots : {recalculateResult.debug.blockedSlotsCount}</li>
                      <li>Bookings futurs : {recalculateResult.debug.futureBookingsCount}</li>
                    </ul>
                  </div>
                )}

                <div className="p-3 bg-gray-100 dark:bg-gray-800 rounded-lg">
                  <p className="text-sm font-medium mb-2 text-gray-900 dark:text-gray-100">Réponse JSON :</p>
                  <pre className="text-xs overflow-auto max-h-40 text-gray-700 dark:text-gray-300">
                    {JSON.stringify(recalculateResult, null, 2)}
                  </pre>
                </div>
              </div>
            )}
          </CardBody>
        </Card>

        {/* Test détaillé du calcul */}
        <Card>
          <CardHeader
            title="3. Test détaillé (Debug)"
            description="Analyse complète du calcul avec toutes les données intermédiaires"
          />
          <CardBody className="space-y-4">
            <Button
              onClick={runTestDetailedSlot}
              loading={loading === 'detailed'}
              disabled={!providerId.trim()}
              fullWidth
              variant="secondary"
            >
              Lancer le test détaillé
            </Button>

            {detailedResult && (
              <div className="space-y-4">
                <div className={`p-3 rounded-lg border ${
                  detailedResult.success
                    ? 'bg-green-50 dark:bg-green-900/20 border-green-300 dark:border-green-700'
                    : 'bg-yellow-50 dark:bg-yellow-900/20 border-yellow-300 dark:border-yellow-700'
                }`}>
                  <Badge variant={detailedResult.success ? 'success' : 'warning'}>
                    {detailedResult.success ? 'Succès' : 'Erreur'}
                  </Badge>
                  <p className="text-sm mt-1 text-gray-800 dark:text-gray-200">{detailedResult.message}</p>
                </div>

                {detailedResult.member && (
                  <div className="p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-800">
                    <p className="text-sm font-medium text-blue-900 dark:text-blue-100">Membre utilisé</p>
                    <p className="text-sm text-blue-700 dark:text-blue-300">
                      {detailedResult.member.name} ({detailedResult.member.id})
                      {detailedResult.member.isDefault && <Badge variant="info" className="ml-2">Default</Badge>}
                    </p>
                  </div>
                )}

                <div className="p-3 bg-gray-100 dark:bg-gray-800 rounded-lg">
                  <p className="text-sm font-medium mb-3 text-gray-900 dark:text-gray-100">Analyse des 7 prochains jours</p>
                  <div className="grid grid-cols-1 gap-2">
                    {detailedResult.next7Days.map((day, index) => (
                      <div key={index} className="flex items-center justify-between p-2 bg-white dark:bg-gray-700 rounded border dark:border-gray-600">
                        <div>
                          <span className="font-medium text-gray-900 dark:text-gray-100">{day.date}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          {day.status === 'available' && (
                            <span className="text-xs text-gray-500 dark:text-gray-400">
                              {day.availableMinutes}min dispo
                            </span>
                          )}
                          {day.bookedMinutes > 0 && (
                            <span className="text-xs text-gray-500 dark:text-gray-400">
                              ({day.bookedMinutes}min réservé)
                            </span>
                          )}
                          <span className={`px-2 py-1 rounded text-xs font-medium ${getStatusColor(day.status)}`}>
                            {getStatusLabel(day.status)}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="p-3 bg-gray-100 dark:bg-gray-800 rounded-lg">
                  <p className="text-sm font-medium mb-2 text-gray-900 dark:text-gray-100">
                    Horaires configurés ({detailedResult.availabilities.filter(a => a.isOpen).length}/7 jours ouverts)
                  </p>
                  <div className="grid grid-cols-7 gap-1 text-xs">
                    {detailedResult.availabilities.map((av) => (
                      <div
                        key={av.dayOfWeek}
                        className={`p-2 rounded text-center ${
                          av.isOpen
                            ? 'bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-300'
                            : 'bg-gray-200 dark:bg-gray-700 text-gray-500 dark:text-gray-400'
                        }`}
                      >
                        <div className="font-medium">{av.dayName.substring(0, 3)}</div>
                        {av.isOpen && av.slots.length > 0 && (
                          <div className="mt-1 text-[10px]">
                            {av.slots.map((s, i) => (
                              <div key={i}>{s.start}-{s.end}</div>
                            ))}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>

                {detailedResult.blockedSlots.length > 0 && (
                  <div className="p-3 bg-red-50 dark:bg-red-900/20 rounded-lg border border-red-200 dark:border-red-800">
                    <p className="text-sm font-medium mb-2 text-red-900 dark:text-red-100">
                      Créneaux bloqués ({detailedResult.blockedSlots.length})
                    </p>
                    <ul className="text-sm space-y-1 text-red-700 dark:text-red-300">
                      {detailedResult.blockedSlots.map((bs, i) => (
                        <li key={i}>
                          {new Date(bs.startDate).toLocaleDateString('fr-FR')} - {new Date(bs.endDate).toLocaleDateString('fr-FR')}
                          {bs.allDay && ' (journée entière)'}
                          {bs.reason && ` - ${bs.reason}`}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {detailedResult.futureBookings.length > 0 && (
                  <div className="p-3 bg-purple-50 dark:bg-purple-900/20 rounded-lg border border-purple-200 dark:border-purple-800">
                    <p className="text-sm font-medium mb-2 text-purple-900 dark:text-purple-100">
                      Réservations futures ({detailedResult.futureBookings.length})
                    </p>
                    <ul className="text-sm space-y-1 text-purple-700 dark:text-purple-300">
                      {detailedResult.futureBookings.map((b, i) => (
                        <li key={i}>
                          {b.date} à {b.time} - {b.serviceName}
                          <Badge variant={b.status === 'confirmed' ? 'success' : 'warning'} className="ml-2">
                            {b.status}
                          </Badge>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                <details className="p-3 bg-gray-100 dark:bg-gray-800 rounded-lg">
                  <summary className="text-sm font-medium cursor-pointer text-gray-900 dark:text-gray-100">
                    Voir la réponse JSON complète
                  </summary>
                  <pre className="text-xs overflow-auto max-h-60 mt-2 text-gray-700 dark:text-gray-300">
                    {JSON.stringify(detailedResult, null, 2)}
                  </pre>
                </details>
              </div>
            )}
          </CardBody>
        </Card>

        {/* Erreur globale */}
        {error && (
          <Card>
            <CardBody>
              <div className="p-4 bg-red-50 dark:bg-red-900/20 border border-red-300 dark:border-red-700 rounded-lg">
                <p className="font-medium text-red-800 dark:text-red-300 mb-1">Erreur</p>
                <pre className="text-sm text-red-700 dark:text-red-400 whitespace-pre-wrap">{error}</pre>
              </div>
            </CardBody>
          </Card>
        )}

        {/* Instructions */}
        <Card variant="default" className="bg-gray-100 dark:bg-gray-800 border-0">
          <CardBody>
            <p className="font-medium text-gray-900 dark:text-gray-100 mb-2">Instructions</p>
            <ol className="list-decimal list-inside space-y-1 text-sm text-gray-600 dark:text-gray-400">
              <li>Lancez l'émulateur : <code className="bg-gray-200 dark:bg-gray-700 px-1 rounded">firebase emulators:start --only functions</code></li>
              <li>Lancez le serveur web : <code className="bg-gray-200 dark:bg-gray-700 px-1 rounded">npm run dev</code></li>
              <li>Testez la connexion pour récupérer les providers</li>
              <li>Cliquez sur un provider pour remplir le champ ID</li>
              <li>Recalculez le nextAvailableSlot</li>
            </ol>
          </CardBody>
        </Card>
      </div>
    </div>
  );
}
