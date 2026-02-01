/**
 * Firebase Cloud Functions
 *
 * This file serves as the entry point for all Cloud Functions.
 * Functions are organized into:
 * - triggers: Firestore document triggers (onCreate, onUpdate, etc.)
 * - scheduled: Scheduled tasks (reminders, cleanup, etc.)
 * - callable: HTTPS callable functions
 */

import * as admin from 'firebase-admin';

// Initialize Firebase Admin SDK
admin.initializeApp();

// Export triggers
export { onBookingWrite } from './triggers/onBookingWrite';
// export { onBookingCreate } from './triggers/onBookingCreate';
// export { onBookingUpdate } from './triggers/onBookingUpdate';
// export { onReviewCreate } from './triggers/onReviewCreate';
// export { onMessageCreate } from './triggers/onMessageCreate';

// Export scheduled functions
export { recalculateExpiredSlots } from './scheduled/recalculateExpiredSlots';
// export { sendReminders } from './scheduled/sendReminders';
// export { completeBookings } from './scheduled/completeBookings';
// export { sendMemberDigest } from './scheduled/sendMemberDigest';

// Export callable functions
export { testFunction } from './callable/testFunction';
export { recalculateNextSlot } from './callable/recalculateNextSlot';
export { testCalculateNextSlot } from './callable/testCalculateNextSlot';
export { recalculateAllProviders } from './callable/recalculateAllProviders';
export { testPushNotification } from './callable/testPushNotification';
// export { cancelBooking } from './callable/cancelBooking';
// export { getMemberPlanning } from './callable/getMemberPlanning';
