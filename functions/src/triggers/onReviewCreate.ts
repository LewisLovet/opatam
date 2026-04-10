/**
 * Trigger: onReviewCreate
 *
 * Fires when a new review is created. Sends a push notification
 * and email to the provider.
 */

import { onDocumentCreated } from 'firebase-functions/v2/firestore';
import * as admin from 'firebase-admin';
import { sendPushNotifications } from '../utils/expoPushService';

export const onReviewCreate = onDocumentCreated(
  {
    document: 'reviews/{reviewId}',
    region: 'europe-west1',
  },
  async (event) => {
    const review = event.data?.data();
    if (!review) return;

    const { providerId, rating, clientName, comment } = review;
    if (!providerId) return;

    const db = admin.firestore();

    try {
      // Get provider to check notification preferences
      const providerDoc = await db.collection('providers').doc(providerId).get();
      const provider = providerDoc.data();
      if (!provider) return;

      // Check notification preferences
      const prefs = provider.settings?.notificationPreferences;
      if (prefs?.pushEnabled === false) return;

      // Get user push tokens
      const userDoc = await db.collection('users').doc(providerId).get();
      const pushTokens: string[] = userDoc.data()?.pushTokens || [];

      if (pushTokens.length === 0) return;

      // Build notification
      const stars = '★'.repeat(rating) + '☆'.repeat(5 - rating);
      const title = 'Nouvel avis reçu !';
      const body = comment
        ? `${clientName || 'Un client'} vous a donné ${rating}/5 : "${comment.slice(0, 80)}${comment.length > 80 ? '...' : ''}"`
        : `${clientName || 'Un client'} vous a donné ${rating}/5 ${stars}`;

      await sendPushNotifications(pushTokens, {
        title,
        body,
        data: {
          type: 'new_review',
          providerId,
          reviewId: event.params.reviewId,
        },
      });

      console.log(`[onReviewCreate] Notified provider ${providerId}: ${rating}/5 from ${clientName}`);
    } catch (error) {
      console.error('[onReviewCreate] Error:', error);
    }
  }
);
