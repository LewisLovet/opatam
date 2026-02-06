/**
 * Callable: testCleanupBookings
 *
 * Deletes all test bookings (those with serviceName = 'TEST Service').
 * Used to clean up after testing.
 */

import { onCall, CallableRequest, HttpsError } from 'firebase-functions/v2/https';
import * as admin from 'firebase-admin';

interface TestCleanupBookingsResponse {
  success: boolean;
  deletedCount: number;
  message: string;
}

export const testCleanupBookings = onCall(
  async (request: CallableRequest): Promise<TestCleanupBookingsResponse> => {
    console.log('=== testCleanupBookings called ===');

    // Verify authentication
    if (!request.auth) {
      throw new HttpsError('unauthenticated', 'Vous devez être connecté.');
    }

    const db = admin.firestore();

    try {
      // Find all test bookings
      const testBookingsQuery = await db
        .collection('bookings')
        .where('serviceName', '==', 'TEST Service')
        .get();

      if (testBookingsQuery.empty) {
        return {
          success: true,
          deletedCount: 0,
          message: 'Aucun booking de test trouvé.',
        };
      }

      // Delete all test bookings
      const batch = db.batch();
      const bookingIds: string[] = [];

      testBookingsQuery.docs.forEach((doc) => {
        batch.delete(doc.ref);
        bookingIds.push(doc.id);
      });

      await batch.commit();

      console.log(`Deleted ${bookingIds.length} test bookings:`, bookingIds);

      return {
        success: true,
        deletedCount: bookingIds.length,
        message: `${bookingIds.length} booking(s) de test supprimé(s).`,
      };
    } catch (error) {
      console.error('=== testCleanupBookings ERROR ===', error);

      if (error instanceof HttpsError) {
        throw error;
      }

      const errorMessage = error instanceof Error ? error.message : 'Erreur inconnue';
      throw new HttpsError('internal', `Erreur: ${errorMessage}`);
    }
  }
);
