/**
 * Scheduled: sendSubscriptionReminders
 *
 * Runs daily at 9:00 AM (Europe/Paris).
 *
 * Sends two families of reminders:
 *
 * 1. Subscription expiry (every day):
 *    - J-7: "Votre abonnement expire dans 7 jours"
 *    - J-1: "Votre abonnement expire demain"
 *    - J (expired): "Votre page a été dépubliée"
 *    Dedupe: `expiryRemindersSent: string[]` on the provider doc.
 *
 * 2. Unpublished page (Monday + Friday only):
 *    All trial + paid providers whose `isPublished == false`.
 *    Dedupe: `unpublishedReminderLastSent` (skip if sent in last 24h).
 *
 * Both push notifications and email are sent.
 */

import { onSchedule } from 'firebase-functions/v2/scheduler';
import * as admin from 'firebase-admin';
import { Timestamp } from 'firebase-admin/firestore';
import { sendPushNotifications } from '../utils/expoPushService';
import { sendTemplateEmail } from '../utils/templateEmails';

const BATCH_SIZE = 10;

// Mirrors the labels used by /api/affiliates/verify so the email shows the
// same wording as the signup page.
const DURATION_LABELS: Record<string, string> = {
  once: 'le 1er mois',
  repeating_3: 'les 3 premiers mois',
  repeating_12: 'la 1ère année',
  forever: 'tous les mois',
};
function buildDiscountLabel(discount: number, duration?: string | null): string {
  const span = duration && DURATION_LABELS[duration] ? DURATION_LABELS[duration] : 'votre abonnement';
  return `-${discount}% sur ${span}`;
}

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
        // 'upcoming' (J-7/J-3/J-1) · 'expired' (J0) · 'winback' (J+3/J+7)
        let emailVariant: 'upcoming' | 'expired' | 'winback' = 'upcoming';

        // Ordered by exclusive day windows. Beyond ~14 days post-expiry we
        // stop entirely (no key matches) so we never spam dormant accounts.
        if (daysUntilExpiry <= -7 && daysUntilExpiry > -14 && !remindersSent.includes('winback-7')) {
          reminderKey = 'winback-7';
          emailVariant = 'winback';
          title = 'Votre page Opatam vous attend';
          body = 'Réactivez votre abonnement pour redevenir visible et recevoir des réservations.';
        } else if (daysUntilExpiry <= -3 && daysUntilExpiry > -7 && !remindersSent.includes('winback-3')) {
          reminderKey = 'winback-3';
          emailVariant = 'winback';
          title = 'Vos clients ne vous trouvent plus';
          body = 'Votre page est en pause. Réactivez votre abonnement en 1 minute.';
        } else if (daysUntilExpiry <= 0 && daysUntilExpiry > -3 && !remindersSent.includes('expired')) {
          reminderKey = 'expired';
          emailVariant = 'expired';
          title = 'Votre page a été dépubliée';
          body = 'Votre essai est terminé. Activez votre abonnement pour rester visible.';
        } else if (daysUntilExpiry === 1 && !remindersSent.includes('j-1')) {
          reminderKey = 'j-1';
          title = 'Votre essai se termine demain';
          body = 'Activez votre abonnement pour continuer à recevoir des réservations.';
        } else if (daysUntilExpiry === 3 && !remindersSent.includes('j-3')) {
          reminderKey = 'j-3';
          title = "Plus que 3 jours d'essai";
          body = 'Activez votre abonnement pour rester visible sans interruption.';
        } else if (daysUntilExpiry <= 7 && daysUntilExpiry > 3 && !remindersSent.includes('j-7')) {
          reminderKey = 'j-7';
          title = `Votre essai se termine dans ${daysUntilExpiry} jours`;
          body = 'Pensez à activer votre abonnement pour rester visible sur Opatam.';
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
              // Affiliate offer (the pro signed up with a referral code) —
              // surfaced ONLY in this email, with the "activate from web" note,
              // since the Stripe coupon can't apply on the in-app purchase.
              let affiliateOffer: { code: string; discountLabel: string } | null = null;
              if (provider.affiliateId) {
                try {
                  const affSnap = await db.collection('affiliates').doc(provider.affiliateId).get();
                  const aff = affSnap.data();
                  if (aff?.isActive && typeof aff.discount === 'number' && aff.discount > 0) {
                    affiliateOffer = {
                      code: provider.affiliateCode || aff.code || '',
                      discountLabel: buildDiscountLabel(aff.discount, aff.discountDuration),
                    };
                  }
                } catch (affErr) {
                  console.warn(`Affiliate lookup failed for ${providerId}:`, affErr);
                }
              }

              await sendTemplateEmail({
                to: email,
                template: 'subscription_expiry',
                data: {
                  businessName: provider.businessName,
                  daysUntilExpiry,
                  isExpired: daysUntilExpiry <= 0,
                  variant: emailVariant,
                  affiliateOffer,
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
      // All providers (trial + paid) get a reminder every Monday and
      // Friday until they publish. The Firestore where('isPublished', '==',
      // false) below is the safety net: a published provider is filtered
      // out at the query level, so the cron physically can't email
      // someone whose page is up.

      const dayOfWeek = now.getDay(); // 0=Sunday, 1=Monday, ...
      const sendDays = [1, 5]; // Monday, Friday
      const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);

      const unpublishedSnap = await db
        .collection('providers')
        .where('isPublished', '==', false)
        .where('subscription.status', 'in', ['active', 'trialing'])
        .get();

      // Skip the whole loop if today isn't a send day. The dedupe below
      // (`lastReminder > oneDayAgo`) guarantees at most one email per day
      // even if someone re-runs the cron.
      if (!sendDays.includes(dayOfWeek)) {
        console.log(`Day ${dayOfWeek} is not a send day (Mon/Fri only), skipping unpublished reminders`);
      }

      for (const doc of (sendDays.includes(dayOfWeek) ? unpublishedSnap.docs : [])) {
        const provider = doc.data();
        const providerId = doc.id;
        const lastReminder = provider.unpublishedReminderLastSent?.toDate?.();

        // Don't send twice in the same day.
        if (lastReminder && lastReminder > oneDayAgo) continue;

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

      // ─── 3. Activation reminder (published but 0 booking) ─────────────
      // Trial providers who published their page but haven't received a
      // single booking yet, between ~3 and ~20 days of account age. Goal:
      // nudge them to SHARE the page so they get their first booking — the
      // activation milestone that drives conversion. Sent once (flag
      // `activationReminderSent`).
      const activationSnap = await db
        .collection('providers')
        .where('subscription.status', '==', 'trialing')
        .where('isPublished', '==', true)
        .get();

      for (const doc of activationSnap.docs) {
        const provider = doc.data();
        const providerId = doc.id;

        if (provider.activationReminderSent) continue;

        const createdAt: Date | undefined = provider.createdAt?.toDate?.();
        if (!createdAt) continue;
        const ageDays = (now.getTime() - createdAt.getTime()) / (1000 * 60 * 60 * 24);
        if (ageDays < 3 || ageDays > 20) continue;

        // Only nudge those with ZERO bookings so far (limit 1 = cheap).
        const bookingsSnap = await db
          .collection('bookings')
          .where('providerId', '==', providerId)
          .limit(1)
          .get();
        if (!bookingsSnap.empty) {
          // Has at least one booking → activated, no nudge. Flag so we
          // never re-check this provider.
          await doc.ref.update({ activationReminderSent: true });
          continue;
        }

        const userDoc = await db.collection('users').doc(providerId).get();
        const pushTokens: string[] = userDoc.data()?.pushTokens || [];
        const email = userDoc.data()?.email;

        if (pushTokens.length > 0) {
          await sendPushNotifications(pushTokens, {
            title: 'Décrochez votre première réservation',
            body: 'Partagez votre page pour attirer vos premiers clients.',
            data: { type: 'activation', providerId },
          });
        }

        if (email) {
          try {
            await sendTemplateEmail({
              to: email,
              template: 'activation_no_booking',
              data: { businessName: provider.businessName },
            });
          } catch (emailErr) {
            console.warn(`Activation email failed for ${providerId}:`, emailErr);
          }
        }

        await doc.ref.update({ activationReminderSent: true });
        console.log(`Sent activation reminder to ${provider.businessName} (${providerId})`);
      }

      console.log('=== sendSubscriptionReminders completed ===');
    } catch (error) {
      console.error('sendSubscriptionReminders failed:', error);
      throw error;
    }
  }
);
