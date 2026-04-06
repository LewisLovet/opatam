/**
 * Firebase Cloud Functions
 *
 * This file serves as the entry point for all Cloud Functions.
 * Functions are organized into:
 * - triggers: Firestore document triggers (onCreate, onUpdate, etc.)
 * - scheduled: Scheduled tasks (reminders, cleanup, etc.)
 * - callable (test): HTTPS callable functions for dev/testing only (emulator)
 */

import * as admin from 'firebase-admin';

// Initialize Firebase Admin SDK
admin.initializeApp();

// ─── Production functions (deployed) ─────────────────────────────────────────

// Callable
export { requestPasswordReset } from './callable/requestPasswordReset';

// Triggers
export { onBookingWrite } from './triggers/onBookingWrite';
export { onUserWrite, onProviderWrite, onBookingWriteStats, onReviewWrite } from './triggers/onStatsUpdate';
export { onReviewCreate } from './triggers/onReviewCreate';

// Scheduled
export { recalculateExpiredSlots } from './scheduled/recalculateExpiredSlots';
export { sendBookingReminders } from './scheduled/sendBookingReminders';
export { sendDailyAgendaSummary } from './scheduled/sendDailyAgendaSummary';
export { aggregatePageViews } from './scheduled/aggregatePageViews';
export { checkExpiredTrials } from './scheduled/checkExpiredTrials';
export { sendSubscriptionReminders } from './scheduled/sendSubscriptionReminders';

// ─── Notification test functions (prod-safe, admin-only) ───────────────────
// These are deployed to production but require an authenticated admin user.
export { testSubscriptionReminders } from './callable/testSubscriptionReminders';
export { testReviewNotification } from './callable/testReviewNotification';

// ─── Test/Dev callable functions (emulator only) ─────────────────────────────
// These are only exported when running in the Firebase emulator.
// They will NOT be deployed to production with `firebase deploy --only functions`.

const isEmulator = process.env.FUNCTIONS_EMULATOR === 'true';

if (isEmulator) {
  /* eslint-disable @typescript-eslint/no-require-imports */
  exports.testFunction = require('./callable/testFunction').testFunction;
  exports.recalculateNextSlot = require('./callable/recalculateNextSlot').recalculateNextSlot;
  exports.testCalculateNextSlot = require('./callable/testCalculateNextSlot').testCalculateNextSlot;
  exports.recalculateAllProviders = require('./callable/recalculateAllProviders').recalculateAllProviders;
  exports.testPushNotification = require('./callable/testPushNotification').testPushNotification;
  exports.testCreateBooking = require('./callable/testCreateBooking').testCreateBooking;
  exports.testCleanupBookings = require('./callable/testCleanupBookings').testCleanupBookings;
  exports.testDailyAgendaSummary = require('./callable/testDailyAgendaSummary').testDailyAgendaSummary;
  exports.testAggregatePageViews = require('./callable/testAggregatePageViews').testAggregatePageViews;
  /* eslint-enable @typescript-eslint/no-require-imports */
}
