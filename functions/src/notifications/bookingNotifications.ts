/**
 * Booking Notifications Service
 * Handles sending push notifications for booking-related events
 */

import * as admin from 'firebase-admin';
import { sendPushNotifications, type SendNotificationResult } from '../utils/expoPushService';

// Types for booking data from Firestore
interface BookingData {
  providerId: string;
  clientId: string | null;
  serviceName: string;
  datetime: admin.firestore.Timestamp;
  clientInfo: {
    name: string;
    email: string;
    phone: string;
  };
  providerName: string;
  status: string;
  cancelledBy?: 'client' | 'provider' | null;
}

/**
 * Format a date in French format
 * Example: "lundi 3 février à 14h30"
 */
function formatDateFr(date: Date): string {
  const days = ['dimanche', 'lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi'];
  const months = ['janvier', 'février', 'mars', 'avril', 'mai', 'juin',
                  'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre'];

  // Use Paris timezone since Cloud Functions run in UTC
  const parisDate = new Date(date.toLocaleString('en-US', { timeZone: 'Europe/Paris' }));
  const dayName = days[parisDate.getDay()];
  const dayNum = parisDate.getDate();
  const month = months[parisDate.getMonth()];
  const hours = parisDate.getHours();
  const minutes = parisDate.getMinutes().toString().padStart(2, '0');

  return `${dayName} ${dayNum} ${month} à ${hours}h${minutes}`;
}

// Notification event types for preference checks
type ClientNotifType = 'confirmation' | 'cancellation' | 'reschedule' | 'reminder';
type ProviderNotifType = 'newBooking' | 'confirmation' | 'cancellation' | 'reminder';

/**
 * Get user's push tokens from Firestore
 * Returns empty array if user doesn't exist or has no tokens
 */
async function getUserPushTokens(userId: string): Promise<string[]> {
  try {
    const userDoc = await admin.firestore().collection('users').doc(userId).get();
    if (!userDoc.exists) {
      console.log(`User ${userId} not found`);
      return [];
    }
    const userData = userDoc.data();
    return userData?.pushTokens || [];
  } catch (error) {
    console.error(`Error fetching push tokens for user ${userId}:`, error);
    return [];
  }
}

/**
 * Check if a client has push enabled for a given notification type
 * Returns true by default if no settings are configured (opt-out model)
 */
async function isClientPushAllowed(clientId: string, type: ClientNotifType): Promise<boolean> {
  try {
    const userDoc = await admin.firestore().collection('users').doc(clientId).get();
    if (!userDoc.exists) return false;

    const settings = userDoc.data()?.notificationSettings;
    if (!settings) return true; // No settings = all enabled (default)
    if (!settings.pushEnabled) return false; // Master toggle off

    const map: Record<ClientNotifType, string> = {
      confirmation: 'confirmationNotifications',
      cancellation: 'cancellationNotifications',
      reschedule: 'rescheduleNotifications',
      reminder: 'reminderNotifications',
    };
    return settings[map[type]] !== false;
  } catch (error) {
    console.error(`Error checking client push prefs for ${clientId}:`, error);
    return true; // Fail-open: send if we can't check
  }
}

/**
 * Check if a provider has push enabled for a given notification type
 * Returns true by default if no preferences are configured (opt-out model)
 */
async function isProviderPushAllowed(providerId: string, type: ProviderNotifType): Promise<boolean> {
  try {
    const providerDoc = await admin.firestore().collection('providers').doc(providerId).get();
    if (!providerDoc.exists) return false;

    const prefs = providerDoc.data()?.settings?.notificationPreferences;
    if (!prefs) return true; // No preferences = all enabled (default)
    if (!prefs.pushEnabled) return false; // Master toggle off

    const map: Record<ProviderNotifType, string> = {
      newBooking: 'newBookingNotifications',
      confirmation: 'confirmationNotifications',
      cancellation: 'cancellationNotifications',
      reminder: 'reminderNotifications',
    };
    return prefs[map[type]] !== false;
  } catch (error) {
    console.error(`Error checking provider push prefs for ${providerId}:`, error);
    return true; // Fail-open
  }
}

/**
 * Get provider's userId from provider document
 */
async function getProviderUserId(providerId: string): Promise<string | null> {
  try {
    const providerDoc = await admin.firestore().collection('providers').doc(providerId).get();
    if (!providerDoc.exists) {
      console.log(`Provider ${providerId} not found`);
      return null;
    }
    return providerDoc.data()?.userId || null;
  } catch (error) {
    console.error(`Error fetching provider ${providerId}:`, error);
    return null;
  }
}

/**
 * Remove invalid tokens from user's pushTokens array
 */
async function removeInvalidTokens(userId: string, invalidTokens: string[]): Promise<void> {
  if (invalidTokens.length === 0) return;

  try {
    const userDoc = await admin.firestore().collection('users').doc(userId).get();
    if (!userDoc.exists) return;

    const currentTokens: string[] = userDoc.data()?.pushTokens || [];
    const updatedTokens = currentTokens.filter(token => !invalidTokens.includes(token));

    if (updatedTokens.length !== currentTokens.length) {
      await admin.firestore().collection('users').doc(userId).update({
        pushTokens: updatedTokens,
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      });
      console.log(`Removed ${invalidTokens.length} invalid tokens from user ${userId}`);
    }
  } catch (error) {
    console.error(`Error removing invalid tokens for user ${userId}:`, error);
  }
}

/**
 * Send notification to provider when a new booking is created
 */
export async function notifyProviderNewBooking(booking: BookingData, bookingId: string): Promise<void> {
  console.log('notifyProviderNewBooking:', booking.providerId, bookingId);

  if (!(await isProviderPushAllowed(booking.providerId, 'newBooking'))) {
    console.log('Provider has disabled newBooking push notifications, skipping');
    return;
  }

  const providerUserId = await getProviderUserId(booking.providerId);
  if (!providerUserId) {
    console.log('Provider userId not found, skipping notification');
    return;
  }

  const pushTokens = await getUserPushTokens(providerUserId);
  if (pushTokens.length === 0) {
    console.log('Provider has no push tokens, skipping notification');
    return;
  }

  const datetime = booking.datetime.toDate();
  const dateStr = formatDateFr(datetime);

  const result = await sendPushNotifications(pushTokens, {
    title: 'Nouveau rendez-vous',
    body: `${booking.clientInfo.name} - ${booking.serviceName} le ${dateStr}`,
    data: {
      type: 'new_booking',
      bookingId,
    },
  });

  console.log('notifyProviderNewBooking result:', result);

  if (result.invalidTokens.length > 0) {
    await removeInvalidTokens(providerUserId, result.invalidTokens);
  }
}

/**
 * Send notification to client when their booking is confirmed
 */
export async function notifyClientBookingConfirmed(booking: BookingData): Promise<void> {
  console.log('notifyClientBookingConfirmed:', booking.clientId);

  if (!booking.clientId) {
    console.log('No clientId (guest booking), skipping push notification');
    return;
  }

  if (!(await isClientPushAllowed(booking.clientId, 'confirmation'))) {
    console.log('Client has disabled confirmation push notifications, skipping');
    return;
  }

  const pushTokens = await getUserPushTokens(booking.clientId);
  if (pushTokens.length === 0) {
    console.log('Client has no push tokens, skipping notification');
    return;
  }

  const datetime = booking.datetime.toDate();
  const dateStr = formatDateFr(datetime);

  const result = await sendPushNotifications(pushTokens, {
    title: 'Rendez-vous confirmé',
    body: `Votre RDV ${booking.serviceName} est confirmé pour le ${dateStr}`,
    data: {
      type: 'booking_confirmed',
    },
  });

  console.log('notifyClientBookingConfirmed result:', result);

  if (result.invalidTokens.length > 0) {
    await removeInvalidTokens(booking.clientId, result.invalidTokens);
  }
}

/**
 * Send notification to provider when client cancels
 */
export async function notifyProviderBookingCancelled(booking: BookingData): Promise<void> {
  console.log('notifyProviderBookingCancelled:', booking.providerId);

  if (!(await isProviderPushAllowed(booking.providerId, 'cancellation'))) {
    console.log('Provider has disabled cancellation push notifications, skipping');
    return;
  }

  const providerUserId = await getProviderUserId(booking.providerId);
  if (!providerUserId) {
    console.log('Provider userId not found, skipping notification');
    return;
  }

  const pushTokens = await getUserPushTokens(providerUserId);
  if (pushTokens.length === 0) {
    console.log('Provider has no push tokens, skipping notification');
    return;
  }

  const datetime = booking.datetime.toDate();
  const dateStr = formatDateFr(datetime);

  const result = await sendPushNotifications(pushTokens, {
    title: 'Rendez-vous annulé',
    body: `${booking.clientInfo.name} a annulé son RDV du ${dateStr}`,
    data: {
      type: 'booking_cancelled_by_client',
    },
  });

  console.log('notifyProviderBookingCancelled result:', result);

  if (result.invalidTokens.length > 0) {
    await removeInvalidTokens(providerUserId, result.invalidTokens);
  }
}

/**
 * Send notification to client when provider cancels
 */
export async function notifyClientBookingCancelled(booking: BookingData): Promise<void> {
  console.log('notifyClientBookingCancelled:', booking.clientId);

  if (!booking.clientId) {
    console.log('No clientId (guest booking), skipping push notification');
    return;
  }

  if (!(await isClientPushAllowed(booking.clientId, 'cancellation'))) {
    console.log('Client has disabled cancellation push notifications, skipping');
    return;
  }

  const pushTokens = await getUserPushTokens(booking.clientId);
  if (pushTokens.length === 0) {
    console.log('Client has no push tokens, skipping notification');
    return;
  }

  const datetime = booking.datetime.toDate();
  const dateStr = formatDateFr(datetime);

  const result = await sendPushNotifications(pushTokens, {
    title: 'Rendez-vous annulé',
    body: `Votre RDV ${booking.serviceName} du ${dateStr} a été annulé par ${booking.providerName}`,
    data: {
      type: 'booking_cancelled_by_provider',
    },
  });

  console.log('notifyClientBookingCancelled result:', result);

  if (result.invalidTokens.length > 0) {
    await removeInvalidTokens(booking.clientId, result.invalidTokens);
  }
}

/**
 * Send notification to client when booking is rescheduled
 */
export async function notifyClientBookingRescheduled(
  booking: BookingData,
  oldDatetime: Date
): Promise<void> {
  console.log('notifyClientBookingRescheduled:', booking.clientId);

  if (!booking.clientId) {
    console.log('No clientId (guest booking), skipping push notification');
    return;
  }

  if (!(await isClientPushAllowed(booking.clientId, 'reschedule'))) {
    console.log('Client has disabled reschedule push notifications, skipping');
    return;
  }

  const pushTokens = await getUserPushTokens(booking.clientId);
  if (pushTokens.length === 0) {
    console.log('Client has no push tokens, skipping notification');
    return;
  }

  const newDatetime = booking.datetime.toDate();
  const newDateStr = formatDateFr(newDatetime);

  const result = await sendPushNotifications(pushTokens, {
    title: 'Rendez-vous modifié',
    body: `Votre RDV ${booking.serviceName} a été déplacé au ${newDateStr}`,
    data: {
      type: 'booking_rescheduled',
    },
  });

  console.log('notifyClientBookingRescheduled result:', result);

  if (result.invalidTokens.length > 0) {
    await removeInvalidTokens(booking.clientId, result.invalidTokens);
  }
}

/**
 * Send reminder notification to client before their booking
 */
export async function notifyClientBookingReminder(
  booking: BookingData,
  reminderType: '2h' | '24h',
  minutesUntil?: number
): Promise<void> {
  console.log('notifyClientBookingReminder:', booking.clientId, reminderType);

  if (!booking.clientId) {
    console.log('No clientId (guest booking), skipping push notification');
    return;
  }

  if (!(await isClientPushAllowed(booking.clientId, 'reminder'))) {
    console.log('Client has disabled reminder push notifications, skipping');
    return;
  }

  const pushTokens = await getUserPushTokens(booking.clientId);
  if (pushTokens.length === 0) {
    console.log('Client has no push tokens, skipping notification');
    return;
  }

  const datetime = booking.datetime.toDate();
  const dateStr = formatDateFr(datetime);

  // Dynamic timing label
  let timeLabel: string;
  if (reminderType === '24h') {
    timeLabel = 'demain';
  } else if (minutesUntil != null) {
    if (minutesUntil < 60) {
      const mins = Math.round(minutesUntil);
      timeLabel = mins <= 1 ? 'dans 1 minute' : `dans ${mins} minutes`;
    } else {
      const hours = Math.floor(minutesUntil / 60);
      const mins = Math.round(minutesUntil % 60);
      if (mins === 0) {
        timeLabel = hours === 1 ? 'dans 1 heure' : `dans ${hours} heures`;
      } else {
        timeLabel = `dans ${hours}h${mins.toString().padStart(2, '0')}`;
      }
    }
  } else {
    timeLabel = 'dans 2 heures';
  }

  const body = reminderType === '24h'
    ? `Rappel : votre RDV ${booking.serviceName} est demain, le ${dateStr}`
    : `Rappel : votre RDV ${booking.serviceName} est ${timeLabel} (${dateStr})`;

  const result = await sendPushNotifications(pushTokens, {
    title: 'Rappel de rendez-vous',
    body,
    data: {
      type: 'booking_reminder',
    },
  });

  console.log('notifyClientBookingReminder result:', result);

  if (result.invalidTokens.length > 0) {
    await removeInvalidTokens(booking.clientId, result.invalidTokens);
  }
}

/**
 * Process booking write event and send appropriate notifications
 * This is the main entry point called from onBookingWrite trigger
 *
 * Notifies both clients and providers via push notifications.
 */
export async function handleBookingNotifications(
  beforeData: admin.firestore.DocumentData | undefined,
  afterData: admin.firestore.DocumentData | undefined,
  bookingId: string
): Promise<void> {
  // Creation - no push notification needed (client is already using the app)
  // Email confirmation is sent separately via bookingEmails
  if (!beforeData && afterData) {
    console.log('Booking created, notifying provider');
    await notifyProviderNewBooking(afterData as BookingData, bookingId);
    return;
  }

  // Deletion - no notification needed
  if (beforeData && !afterData) {
    console.log('Booking deleted, no notification needed');
    return;
  }

  // Update - check what changed
  if (beforeData && afterData) {
    const booking = afterData as BookingData;
    const oldStatus = beforeData.status;
    const newStatus = afterData.status;

    // Status changed to confirmed - notify client
    if (oldStatus !== 'confirmed' && newStatus === 'confirmed') {
      console.log('Booking confirmed, notifying client');
      await notifyClientBookingConfirmed(booking);
      return;
    }

    // Status changed to cancelled
    if (oldStatus !== 'cancelled' && newStatus === 'cancelled') {
      const cancelledBy = afterData.cancelledBy;

      if (cancelledBy === 'client') {
        console.log('Booking cancelled by client, notifying provider');
        await notifyProviderBookingCancelled(booking);
      } else if (cancelledBy === 'provider') {
        // Provider cancelled - notify client
        console.log('Booking cancelled by provider, notifying client');
        await notifyClientBookingCancelled(booking);
      }
      return;
    }

    // Datetime changed (reschedule) - notify client
    const oldDatetime = beforeData.datetime?.toMillis?.();
    const newDatetime = afterData.datetime?.toMillis?.();

    if (oldDatetime && newDatetime && oldDatetime !== newDatetime) {
      if (newStatus === 'pending' || newStatus === 'confirmed') {
        console.log('Booking rescheduled, notifying client');
        await notifyClientBookingRescheduled(booking, beforeData.datetime.toDate());
      }
    }
  }
}
