/**
 * Test Callable: testAffiliateOnboardingReminder
 *
 * Admin-only. Triggers the same reminder logic as the scheduled
 * function, for a single affiliate ID. Bypasses the 14-day dedupe
 * (it always rotates the resume token + sends).
 */

import { onCall } from 'firebase-functions/v2/https';
import * as admin from 'firebase-admin';
import { sendAffiliateOnboardingReminder } from '../notifications/affiliateOnboarding';

export const testAffiliateOnboardingReminder = onCall(
  { region: 'europe-west1' },
  async (request) => {
    if (!request.auth?.uid) {
      throw new Error('Authentication required');
    }
    const db = admin.firestore();
    const callerDoc = await db.collection('users').doc(request.auth.uid).get();
    if (!callerDoc.data()?.isAdmin) {
      throw new Error('Admin access required');
    }

    const { affiliateId } = request.data;
    if (!affiliateId) throw new Error('affiliateId is required');

    const result = await sendAffiliateOnboardingReminder(affiliateId);

    const affiliateDoc = await db.collection('affiliates').doc(affiliateId).get();
    const affiliate = affiliateDoc.data();

    return {
      success: result.success,
      affiliate: affiliate?.name,
      email: affiliate?.email,
      stripeAccountStatus: affiliate?.stripeAccountStatus,
      pushSent: result.pushSent,
      emailSent: result.emailSent,
      resumeUrl: result.resumeUrl,
      error: result.error,
    };
  },
);
