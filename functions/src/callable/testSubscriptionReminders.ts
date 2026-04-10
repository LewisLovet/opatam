/**
 * Test Callable: testSubscriptionReminders
 *
 * Emulator-only callable to test subscription reminder notifications.
 * Triggers the same logic as the scheduled function but for a single provider.
 */

import { onCall } from 'firebase-functions/v2/https';
import * as admin from 'firebase-admin';
import { sendPushNotifications } from '../utils/expoPushService';
import { sendTemplateEmail } from '../utils/templateEmails';

export const testSubscriptionReminders = onCall(
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

    const { providerId, reminderType } = request.data;

    if (!providerId) {
      throw new Error('providerId is required');
    }
    if (!['j-7', 'j-1', 'expired', 'unpublished'].includes(reminderType)) {
      throw new Error('reminderType must be j-7, j-1, expired, or unpublished');
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

    const messages: Record<string, { title: string; body: string }> = {
      'j-7': {
        title: `Votre abonnement expire dans 7 jours`,
        body: 'Pensez à renouveler pour rester visible sur Opatam.',
      },
      'j-1': {
        title: 'Votre abonnement expire demain',
        body: 'Renouvelez votre abonnement pour continuer à recevoir des réservations.',
      },
      expired: {
        title: 'Votre page a été dépubliée',
        body: 'Votre abonnement a expiré. Renouvelez pour rester visible et recevoir des réservations.',
      },
      unpublished: {
        title: 'Votre page n\'est pas encore visible !',
        body: 'Publiez votre page pour recevoir des réservations de nouveaux clients.',
      },
    };

    const msg = messages[reminderType];

    const result = await sendPushNotifications(pushTokens, {
      title: msg.title,
      body: msg.body,
      data: {
        type: reminderType === 'unpublished' ? 'unpublished_reminder' : 'subscription_expiry',
        providerId,
      },
    });

    // Send email too
    const email = userDoc.data()?.email;
    if (email) {
      try {
        const template = reminderType === 'unpublished' ? 'unpublished_reminder' : 'subscription_expiry';
        const daysMap: Record<string, number> = { 'j-7': 7, 'j-1': 1, expired: 0 };
        await sendTemplateEmail({
          to: email,
          template: template as any,
          data: {
            businessName: provider.businessName,
            daysUntilExpiry: daysMap[reminderType] ?? 7,
            isExpired: reminderType === 'expired',
          },
        });
      } catch (emailErr) {
        console.warn('Test subscription email failed:', emailErr);
      }
    }

    return {
      success: true,
      reminderType,
      provider: provider.businessName,
      pushTokens: pushTokens.length,
      result,
    };
  }
);
