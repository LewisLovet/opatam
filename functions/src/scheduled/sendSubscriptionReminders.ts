/**
 * Scheduled: sendSubscriptionReminders
 *
 * Runs daily at 9:00 AM (Europe/Paris) to send reminders to providers
 * whose subscription is about to expire.
 *
 * Sends:
 * - J-7: "Votre abonnement expire dans 7 jours"
 * - J-1: "Votre abonnement expire demain"
 * - J (expired): "Votre page a été dépubliée"
 *
 * Also sends reminders to:
 * - Providers with unpublished pages (active subscription but not published)
 * - Providers who haven't shared their page recently (incite to share)
 *
 * Deduplication via expiryRemindersSent field on provider document.
 */

import { onSchedule } from 'firebase-functions/v2/scheduler';
import * as admin from 'firebase-admin';
import { Timestamp } from 'firebase-admin/firestore';
import { sendPushNotifications } from '../utils/expoPushService';
import { sendTemplateEmail } from '../utils/templateEmails';

const BATCH_SIZE = 10;

export const sendSubscriptionReminders = onSchedule(
  {
    schedule: '0 9 * * *', // Every day at 9:00 AM
    timeZone: 'Europe/Paris',
    region: 'europe-west1',
    timeoutSeconds: 120,
  },
  async () => {
    console.log('=== sendSubscriptionReminders started ===');
    const db = admin.firestore();
    const now = new Date();

    try {
      // ─── 1. Expiration reminders (J-7, J-1, Jour J) ───────────────────

      // Get all providers with active/trialing subscriptions
      const providersSnap = await db
        .collection('providers')
        .where('subscription.status', 'in', ['active', 'trialing'])
        .get();

      console.log(`Found ${providersSnap.size} active/trialing providers to check`);

      for (const doc of providersSnap.docs) {
        const provider = doc.data();
        const providerId = doc.id;
        const validUntil = provider.subscription?.validUntil?.toDate?.();

        if (!validUntil) continue;

        const daysUntilExpiry = Math.ceil((validUntil.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
        const remindersSent: string[] = provider.expiryRemindersSent || [];

        let reminderKey: string | null = null;
        let title = '';
        let body = '';

        if (daysUntilExpiry <= 0 && !remindersSent.includes('expired')) {
          reminderKey = 'expired';
          title = 'Votre page a été dépubliée';
          body = 'Votre abonnement a expiré. Renouvelez pour rester visible et recevoir des réservations.';
        } else if (daysUntilExpiry === 1 && !remindersSent.includes('j-1')) {
          reminderKey = 'j-1';
          title = 'Votre abonnement expire demain';
          body = 'Renouvelez votre abonnement pour continuer à recevoir des réservations.';
        } else if (daysUntilExpiry <= 7 && daysUntilExpiry > 1 && !remindersSent.includes('j-7')) {
          reminderKey = 'j-7';
          title = `Votre abonnement expire dans ${daysUntilExpiry} jours`;
          body = 'Pensez à renouveler pour rester visible sur Opatam.';
        }

        if (reminderKey) {
          // Get user push tokens
          const userDoc = await db.collection('users').doc(providerId).get();
          const pushTokens: string[] = userDoc.data()?.pushTokens || [];
          const email = userDoc.data()?.email;

          // Send push
          if (pushTokens.length > 0) {
            await sendPushNotifications(pushTokens, {
              title,
              body,
              data: { type: 'subscription_expiry', providerId },
            });
          }

          // Send email
          if (email) {
            try {
              await sendTemplateEmail({
                to: email,
                template: 'subscription_expiry',
                data: {
                  businessName: provider.businessName,
                  daysUntilExpiry,
                  isExpired: daysUntilExpiry <= 0,
                },
              });
            } catch (emailErr) {
              console.warn(`Email failed for ${providerId}:`, emailErr);
            }
          }

          // Mark as sent
          await doc.ref.update({
            expiryRemindersSent: admin.firestore.FieldValue.arrayUnion(reminderKey),
          });

          console.log(`Sent ${reminderKey} reminder to ${provider.businessName} (${providerId})`);
        }
      }

      // ─── 2. Unpublished page reminders ────────────────────────────────
      // Trial providers: send on Monday (1), Wednesday (3), Friday (5)
      // Active (paid) providers: send once per week max

      const dayOfWeek = now.getDay(); // 0=Sunday, 1=Monday, ...
      const trialSendDays = [1, 5]; // Monday, Friday
      const oneWeekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);

      const unpublishedSnap = await db
        .collection('providers')
        .where('isPublished', '==', false)
        .where('subscription.status', 'in', ['active', 'trialing'])
        .get();

      for (const doc of unpublishedSnap.docs) {
        const provider = doc.data();
        const providerId = doc.id;
        const lastReminder = provider.unpublishedReminderLastSent?.toDate?.();
        const isTrial = provider.plan === 'trial';

        if (isTrial) {
          // Trial: only send on Mon/Wed/Fri, and not if already sent today
          if (!trialSendDays.includes(dayOfWeek)) continue;
          if (lastReminder && lastReminder > oneDayAgo) continue;
        } else {
          // Paid: max once per week
          if (lastReminder && lastReminder > oneWeekAgo) continue;
        }

        // Get user push tokens
        const userDoc = await db.collection('users').doc(providerId).get();
        const pushTokens: string[] = userDoc.data()?.pushTokens || [];
        const email = userDoc.data()?.email;

        // Send push
        if (pushTokens.length > 0) {
          await sendPushNotifications(pushTokens, {
            title: 'Votre page n\'est pas encore visible !',
            body: 'Publiez votre page pour recevoir des réservations de nouveaux clients.',
            data: { type: 'unpublished_reminder', providerId },
          });
        }

        // Send email
        if (email) {
          try {
            await sendTemplateEmail({
              to: email,
              template: 'unpublished_reminder',
              data: {
                businessName: provider.businessName,
              },
            });
          } catch (emailErr) {
            console.warn(`Unpublished email failed for ${providerId}:`, emailErr);
          }
        }

        // Mark last sent
        await doc.ref.update({
          unpublishedReminderLastSent: Timestamp.now(),
        });

        console.log(`Sent unpublished reminder to ${provider.businessName} (${providerId})`);
      }

      console.log('=== sendSubscriptionReminders completed ===');
    } catch (error) {
      console.error('sendSubscriptionReminders failed:', error);
      throw error;
    }
  }
);
