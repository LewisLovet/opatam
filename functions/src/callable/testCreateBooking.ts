/**
 * Callable: testCreateBooking
 *
 * Creates a test booking to trigger onBookingWrite and test the notification flow.
 * Supports different scenarios to test all notification cases.
 */

import { onCall, CallableRequest, HttpsError } from 'firebase-functions/v2/https';
import * as admin from 'firebase-admin';
import { Timestamp } from 'firebase-admin/firestore';

type TestScenario =
  | 'create'
  | 'confirm'
  | 'cancel_by_client'
  | 'cancel_by_provider'
  | 'reschedule';

interface TestCreateBookingParams {
  providerId: string;
  clientId?: string;
  scenario: TestScenario;
}

interface TestCreateBookingResponse {
  success: boolean;
  bookingId: string;
  scenario: TestScenario;
  message: string;
  steps: string[];
}

/**
 * Create base booking data for tests
 */
function createTestBookingData(providerId: string, clientId: string | null) {
  const now = new Date();
  const tomorrow = new Date(now.getTime() + 24 * 60 * 60 * 1000);
  const tomorrowPlusHour = new Date(tomorrow.getTime() + 60 * 60 * 1000);

  return {
    providerId,
    clientId,
    memberId: null,
    providerName: 'TEST Provider',
    providerPhoto: null,
    memberName: null,
    memberPhoto: null,
    locationId: 'test-location',
    locationName: 'TEST Location',
    locationAddress: '123 Test Street',
    serviceId: 'test-service',
    serviceName: 'TEST Service',
    duration: 60,
    price: 5000,
    clientInfo: {
      name: 'TEST Client',
      email: 'test@opatam.com',
      phone: '0600000000',
    },
    datetime: Timestamp.fromDate(tomorrow),
    endDatetime: Timestamp.fromDate(tomorrowPlusHour),
    status: 'pending' as const,
    cancelledAt: null,
    cancelledBy: null,
    cancelReason: null,
    cancelToken: `test-token-${Date.now()}`,
    remindersSent: [],
    reviewRequestSentAt: null,
    createdAt: Timestamp.now(),
    updatedAt: Timestamp.now(),
  };
}

/**
 * Wait for a specified duration
 */
function wait(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

export const testCreateBooking = onCall(
  async (request: CallableRequest<TestCreateBookingParams>): Promise<TestCreateBookingResponse> => {
    console.log('=== testCreateBooking called ===');

    // Verify authentication
    if (!request.auth) {
      throw new HttpsError('unauthenticated', 'Vous devez être connecté.');
    }

    const { providerId, clientId, scenario } = request.data;

    if (!providerId) {
      throw new HttpsError('invalid-argument', 'providerId est requis.');
    }

    if (!scenario) {
      throw new HttpsError('invalid-argument', 'scenario est requis.');
    }

    const db = admin.firestore();
    const steps: string[] = [];

    try {
      // Verify provider exists
      const providerDoc = await db.collection('providers').doc(providerId).get();
      if (!providerDoc.exists) {
        throw new HttpsError('not-found', 'Provider non trouvé.');
      }
      steps.push(`Provider ${providerId} vérifié`);

      // Verify client exists if provided
      if (clientId) {
        const clientDoc = await db.collection('users').doc(clientId).get();
        if (!clientDoc.exists) {
          throw new HttpsError('not-found', 'Client non trouvé.');
        }
        steps.push(`Client ${clientId} vérifié`);
      }

      const bookingData = createTestBookingData(providerId, clientId || null);
      let bookingId: string;

      switch (scenario) {
        case 'create': {
          // Simply create a pending booking
          // This should trigger notification to provider
          const docRef = await db.collection('bookings').add(bookingData);
          bookingId = docRef.id;
          steps.push(`Booking créé avec status 'pending' (ID: ${bookingId})`);
          steps.push('Le trigger onBookingWrite devrait notifier le provider');
          break;
        }

        case 'confirm': {
          // Create booking, then confirm it
          // This should trigger notification to client
          const docRef = await db.collection('bookings').add(bookingData);
          bookingId = docRef.id;
          steps.push(`Booking créé avec status 'pending' (ID: ${bookingId})`);

          // Wait a bit for the first trigger to complete
          await wait(1500);
          steps.push('Attente 1.5s pour le premier trigger...');

          // Update to confirmed
          await db.collection('bookings').doc(bookingId).update({
            status: 'confirmed',
            updatedAt: Timestamp.now(),
          });
          steps.push(`Booking mis à jour avec status 'confirmed'`);
          steps.push('Le trigger onBookingWrite devrait notifier le client');
          break;
        }

        case 'cancel_by_client': {
          // Create confirmed booking, then cancel by client
          // This should trigger notification to provider
          bookingData.status = 'confirmed' as any;
          const docRef = await db.collection('bookings').add(bookingData);
          bookingId = docRef.id;
          steps.push(`Booking créé avec status 'confirmed' (ID: ${bookingId})`);

          await wait(1500);
          steps.push('Attente 1.5s pour le premier trigger...');

          await db.collection('bookings').doc(bookingId).update({
            status: 'cancelled',
            cancelledBy: 'client',
            cancelledAt: Timestamp.now(),
            cancelReason: 'Test annulation par client',
            updatedAt: Timestamp.now(),
          });
          steps.push(`Booking annulé par 'client'`);
          steps.push('Le trigger onBookingWrite devrait notifier le provider');
          break;
        }

        case 'cancel_by_provider': {
          // Create confirmed booking, then cancel by provider
          // This should trigger notification to client
          bookingData.status = 'confirmed' as any;
          const docRef = await db.collection('bookings').add(bookingData);
          bookingId = docRef.id;
          steps.push(`Booking créé avec status 'confirmed' (ID: ${bookingId})`);

          await wait(1500);
          steps.push('Attente 1.5s pour le premier trigger...');

          await db.collection('bookings').doc(bookingId).update({
            status: 'cancelled',
            cancelledBy: 'provider',
            cancelledAt: Timestamp.now(),
            cancelReason: 'Test annulation par provider',
            updatedAt: Timestamp.now(),
          });
          steps.push(`Booking annulé par 'provider'`);
          steps.push('Le trigger onBookingWrite devrait notifier le client');
          break;
        }

        case 'reschedule': {
          // Create confirmed booking, then change datetime
          // This should trigger notification to client
          bookingData.status = 'confirmed' as any;
          const docRef = await db.collection('bookings').add(bookingData);
          bookingId = docRef.id;
          steps.push(`Booking créé avec status 'confirmed' (ID: ${bookingId})`);

          await wait(1500);
          steps.push('Attente 1.5s pour le premier trigger...');

          // Reschedule to day after tomorrow
          const newDate = new Date(Date.now() + 48 * 60 * 60 * 1000);
          const newEndDate = new Date(newDate.getTime() + 60 * 60 * 1000);

          await db.collection('bookings').doc(bookingId).update({
            datetime: Timestamp.fromDate(newDate),
            endDatetime: Timestamp.fromDate(newEndDate),
            updatedAt: Timestamp.now(),
          });
          steps.push(`Booking replanifié à ${newDate.toISOString()}`);
          steps.push('Le trigger onBookingWrite devrait notifier le client');
          break;
        }

        default:
          throw new HttpsError('invalid-argument', `Scénario inconnu: ${scenario}`);
      }

      console.log('Test booking created:', { bookingId, scenario, steps });

      return {
        success: true,
        bookingId,
        scenario,
        message: `Scénario "${scenario}" exécuté. Vérifiez les logs et les notifications.`,
        steps,
      };
    } catch (error) {
      console.error('=== testCreateBooking ERROR ===', error);

      if (error instanceof HttpsError) {
        throw error;
      }

      const errorMessage = error instanceof Error ? error.message : 'Erreur inconnue';
      throw new HttpsError('internal', `Erreur: ${errorMessage}`);
    }
  }
);
