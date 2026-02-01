/**
 * Callable: testPushNotification
 *
 * Test function to send a push notification to a specific user.
 * Used for testing the Expo Push notification system.
 */

import { onCall, CallableRequest, HttpsError } from 'firebase-functions/v2/https';
import * as admin from 'firebase-admin';
import { sendNotificationToUser, PushNotificationPayload } from '../utils/expoPushService';

interface TestPushNotificationData {
  userId: string;
  title?: string;
  body?: string;
}

interface TestPushNotificationResponse {
  success: boolean;
  message: string;
  details: {
    sentCount: number;
    failedCount: number;
    invalidTokens: string[];
  };
}

export const testPushNotification = onCall(
  async (request: CallableRequest<TestPushNotificationData>): Promise<TestPushNotificationResponse> => {
    console.log('=== testPushNotification called ===');

    // Verify authentication
    if (!request.auth) {
      throw new HttpsError('unauthenticated', 'Vous devez être connecté pour envoyer une notification.');
    }

    const { userId, title, body } = request.data;

    if (!userId) {
      throw new HttpsError('invalid-argument', 'userId est requis.');
    }

    const db = admin.firestore();

    try {
      // Get user document
      const userDoc = await db.collection('users').doc(userId).get();

      if (!userDoc.exists) {
        throw new HttpsError('not-found', 'Utilisateur non trouvé.');
      }

      const userData = userDoc.data();
      const pushTokens: string[] = userData?.pushTokens || [];

      if (pushTokens.length === 0) {
        return {
          success: false,
          message: 'Aucun token push enregistré pour cet utilisateur.',
          details: {
            sentCount: 0,
            failedCount: 0,
            invalidTokens: [],
          },
        };
      }

      console.log(`Found ${pushTokens.length} push tokens for user ${userId}`);

      // Prepare notification payload
      const payload: PushNotificationPayload = {
        title: title || 'Test Notification',
        body: body || 'Ceci est une notification de test depuis Opatam!',
        data: {
          type: 'test',
          timestamp: new Date().toISOString(),
        },
        sound: 'default',
      };

      // Send notification
      const result = await sendNotificationToUser(pushTokens, payload);

      console.log('Push notification result:', result);

      // Remove invalid tokens from user's pushTokens array
      if (result.invalidTokens.length > 0) {
        console.log(`Removing ${result.invalidTokens.length} invalid tokens`);
        const updatedTokens = pushTokens.filter(token => !result.invalidTokens.includes(token));
        await db.collection('users').doc(userId).update({
          pushTokens: updatedTokens,
          updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        });
      }

      return {
        success: result.success,
        message: result.success
          ? `Notification envoyée avec succès à ${result.sentCount} appareil(s).`
          : `Échec de l'envoi: ${result.errors.join(', ')}`,
        details: {
          sentCount: result.sentCount,
          failedCount: result.failedCount,
          invalidTokens: result.invalidTokens,
        },
      };
    } catch (error) {
      console.error('=== testPushNotification ERROR ===', error);

      if (error instanceof HttpsError) {
        throw error;
      }

      const errorMessage = error instanceof Error ? error.message : 'Erreur inconnue';
      throw new HttpsError('internal', `Erreur lors de l'envoi: ${errorMessage}`);
    }
  }
);
