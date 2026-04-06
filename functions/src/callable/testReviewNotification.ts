/**
 * Test Callable: testReviewNotification
 *
 * Emulator-only callable to test the "new review received" push notification.
 * Simulates what onReviewCreate does but without creating a real review.
 */

import { onCall } from 'firebase-functions/v2/https';
import * as admin from 'firebase-admin';
import { sendPushNotifications } from '../utils/expoPushService';
import { sendTemplateEmail } from '../utils/templateEmails';

export const testReviewNotification = onCall(
  { region: 'europe-west1' },
  async (request) => {
    // Admin check — only authenticated users with isAdmin flag
    if (!request.auth?.uid) {
      throw new Error('Authentication required');
    }
    const db = admin.firestore();
    const callerDoc = await db.collection('users').doc(request.auth.uid).get();
    if (!callerDoc.data()?.isAdmin) {
      throw new Error('Admin access required');
    }

    const { providerId, rating = 5, clientName = 'Client Test', comment = '' } = request.data;

    if (!providerId) {
      throw new Error('providerId is required');
    }

    const providerDoc = await db.collection('providers').doc(providerId).get();
    const provider = providerDoc.data();

    if (!provider) {
      throw new Error('Provider not found');
    }

    const userDoc = await db.collection('users').doc(providerId).get();
    const pushTokens: string[] = userDoc.data()?.pushTokens || [];

    if (pushTokens.length === 0) {
      return { success: false, message: 'No push tokens found for this provider' };
    }

    const stars = '★'.repeat(rating) + '☆'.repeat(5 - rating);
    const title = 'Nouvel avis reçu !';
    const body = comment
      ? `${clientName} vous a donné ${rating}/5 : "${comment.slice(0, 80)}"`
      : `${clientName} vous a donné ${rating}/5 ${stars}`;

    const result = await sendPushNotifications(pushTokens, {
      title,
      body,
      data: {
        type: 'new_review',
        providerId,
      },
    });

    // Send email too
    const email = userDoc.data()?.email;
    if (email) {
      try {
        await sendTemplateEmail({
          to: email,
          template: 'new_review',
          data: {
            businessName: provider.businessName,
            clientName,
            rating,
            comment,
          },
        });
      } catch (emailErr) {
        console.warn('Test review email failed:', emailErr);
      }
    }

    return {
      success: true,
      provider: provider.businessName,
      notification: { title, body },
      pushTokens: pushTokens.length,
      emailSent: !!email,
      result,
    };
  }
);
