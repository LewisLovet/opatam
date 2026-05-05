/**
 * Affiliate onboarding reminder — shared helper used by both the
 * scheduled cron (sendAffiliateOnboardingReminders) and the admin
 * test callable (testAffiliateOnboardingReminder).
 *
 * Generates a fresh `onboardingResumeToken` (and its 7-day expiry),
 * stores it on the affiliate doc, and sends the reminder email +
 * push notification with a magic link to /affiliation/finalize.
 *
 * The Stripe AccountLink is NOT generated here — its 5-minute TTL
 * makes it useless in an email. Instead, the magic link points at
 * a server page that, on click, calls /api/affiliates/onboarding
 * and redirects to a fresh AccountLink.
 */

import * as admin from 'firebase-admin';
import { Timestamp } from 'firebase-admin/firestore';
import { sendPushNotifications } from '../utils/expoPushService';
import { sendTemplateEmail } from '../utils/templateEmails';

const APP_URL = 'https://opatam.com';
const TOKEN_TTL_DAYS = 7;

/** Cryptographically random hex token (32 bytes → 64 chars). */
function makeToken(): string {
  const bytes = new Uint8Array(32);
  // crypto from node:crypto via globalThis (available in Cloud Functions Node 18+)
  const c = (globalThis as { crypto?: { getRandomValues: (a: Uint8Array) => Uint8Array } }).crypto;
  if (c?.getRandomValues) {
    c.getRandomValues(bytes);
  } else {
    // Fallback for older runtimes — should never hit in our env.
    for (let i = 0; i < bytes.length; i++) bytes[i] = Math.floor(Math.random() * 256);
  }
  return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
}

export interface SendResult {
  success: boolean;
  pushSent: boolean;
  emailSent: boolean;
  resumeUrl: string;
  error?: string;
}

/**
 * Issue a new onboarding-resume token, persist it, and send the
 * reminder email + push. Used both by the cron and the admin test.
 */
export async function sendAffiliateOnboardingReminder(
  affiliateId: string,
): Promise<SendResult> {
  const db = admin.firestore();
  const ref = db.collection('affiliates').doc(affiliateId);
  const snap = await ref.get();
  if (!snap.exists) throw new Error(`Affiliate ${affiliateId} not found`);

  const data = snap.data()!;
  const token = makeToken();
  const expiresAt = new Date(Date.now() + TOKEN_TTL_DAYS * 24 * 60 * 60 * 1000);

  await ref.update({
    onboardingResumeToken: token,
    onboardingResumeTokenExpiresAt: Timestamp.fromDate(expiresAt),
    onboardingReminderLastSent: Timestamp.now(),
  });

  const resumeUrl = `${APP_URL}/affiliation/finalize?token=${token}`;

  // Push notification — affiliates may not have an Opatam mobile
  // account, so this is best-effort.
  let pushSent = false;
  if (data.userId) {
    try {
      const userDoc = await db.collection('users').doc(data.userId).get();
      const tokens: string[] = userDoc.data()?.pushTokens || [];
      if (tokens.length > 0) {
        await sendPushNotifications(tokens, {
          title: 'Finalisez votre compte affilié',
          body: 'Quelques minutes pour activer vos versements de commissions.',
          data: {
            type: 'affiliate_onboarding_reminder',
            affiliateId,
          },
        });
        pushSent = true;
      }
    } catch (err) {
      console.warn(`[affiliateOnboarding] push failed for ${affiliateId}:`, err);
    }
  }

  // Email — primary channel.
  let emailSent = false;
  try {
    await sendTemplateEmail({
      to: data.email,
      template: 'affiliate_onboarding_reminder',
      data: {
        affiliateName: data.name,
        status: data.stripeAccountStatus,
        resumeUrl,
      },
    });
    emailSent = true;
  } catch (err) {
    console.warn(`[affiliateOnboarding] email failed for ${affiliateId}:`, err);
    return {
      success: false,
      pushSent,
      emailSent: false,
      resumeUrl,
      error: err instanceof Error ? err.message : String(err),
    };
  }

  return { success: true, pushSent, emailSent, resumeUrl };
}
