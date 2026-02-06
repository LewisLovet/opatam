/**
 * Callable: testPushNotification
 *
 * Test function to send push notifications to a specific user.
 * Supports different notification types to test all booking scenarios.
 */

import { onCall, CallableRequest, HttpsError } from 'firebase-functions/v2/https';
import * as admin from 'firebase-admin';
import { sendNotificationToUser, PushNotificationPayload } from '../utils/expoPushService';

type NotificationType =
  | 'simple'
  | 'new_booking'
  | 'booking_confirmed'
  | 'booking_cancelled_by_client'
  | 'booking_cancelled_by_provider'
  | 'booking_rescheduled';

interface TestPushNotificationData {
  userId: string;
  type?: NotificationType;
  title?: string;
  body?: string;
}

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

/**
 * Get notification content based on type
 */
function getNotificationContent(type: NotificationType): { title: string; body: string } {
  const now = new Date();
  const dateStr = now.toLocaleDateString('fr-FR', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  });
  const timeStr = `${now.getHours()}h${now.getMinutes().toString().padStart(2, '0')}`;

  switch (type) {
    case 'new_booking':
      return {
        title: 'Nouveau rendez-vous',
        body: `Marie Dupont - Coupe femme le ${dateStr} à ${timeStr}`,
      };

    case 'booking_confirmed':
      return {
        title: 'Rendez-vous confirmé',
        body: `Votre RDV Coupe femme est confirmé pour le ${dateStr} à ${timeStr}`,
      };

    case 'booking_cancelled_by_client':
      return {
        title: 'Rendez-vous annulé',
        body: `Marie Dupont a annulé son RDV du ${dateStr} à ${timeStr}`,
      };

    case 'booking_cancelled_by_provider':
      return {
        title: 'Rendez-vous annulé',
        body: `Votre RDV Coupe femme du ${dateStr} a été annulé par Salon Hugo`,
      };

    case 'booking_rescheduled':
      return {
        title: 'Rendez-vous modifié',
        body: `Votre RDV Coupe femme a été déplacé au ${dateStr} à ${timeStr}`,
      };

    case 'simple':
    default:
      return {
        title: 'Test Notification',
        body: 'Ceci est une notification de test depuis Opatam!',
      };
  }
}

export const testPushNotification = onCall(
  async (request: CallableRequest<TestPushNotificationData>): Promise<TestPushNotificationResponse> => {
    console.log('=== testPushNotification called ===');

    // Verify authentication
    if (!request.auth) {
      throw new HttpsError('unauthenticated', 'Vous devez être connecté pour envoyer une notification.');
    }

    const { userId, type = 'simple', title, body } = request.data;

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
          notificationType: type,
          details: {
            sentCount: 0,
            failedCount: 0,
            invalidTokens: [],
          },
        };
      }

      console.log(`Found ${pushTokens.length} push tokens for user ${userId}`);

      // Get notification content based on type
      const defaultContent = getNotificationContent(type);

      // Prepare notification payload (custom title/body override defaults)
      const payload: PushNotificationPayload = {
        title: title || defaultContent.title,
        body: body || defaultContent.body,
        data: {
          type,
          timestamp: new Date().toISOString(),
        },
        sound: 'default',
      };

      console.log('Sending notification:', payload);

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
          ? `Notification "${type}" envoyée avec succès à ${result.sentCount} appareil(s).`
          : `Échec de l'envoi: ${result.errors.join(', ')}`,
        notificationType: type,
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
