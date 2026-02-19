/**
 * Booking Emails Service
 * Handles sending emails for booking-related events
 * Works alongside push notifications in the onBookingWrite trigger
 */

import * as admin from 'firebase-admin';
import {
  sendConfirmationEmail,
  sendCancellationEmail,
  sendProviderCancellationEmail,
  sendRescheduleEmail,
  sendReminderEmail,
  sendProviderNewBookingEmail,
  type BookingEmailData,
} from '../utils/resendService';

// Types for booking data from Firestore
interface BookingData {
  providerId: string;
  clientId: string | null;
  serviceName: string;
  datetime: admin.firestore.Timestamp;
  duration?: number;
  price?: number;
  clientInfo: {
    name: string;
    email: string;
    phone: string;
  };
  providerName: string;
  status: string;
  cancelledBy?: 'client' | 'provider' | null;
  cancelReason?: string;
  cancelToken?: string;
  locationName?: string;
  locationAddress?: string;
  memberName?: string;
}

// Notification event types for email preference checks
type ClientEmailNotifType = 'confirmation' | 'cancellation' | 'reschedule' | 'reminder';

/**
 * Check if a client has email enabled for a given notification type
 * Returns true by default if no settings are configured (opt-out model)
 */
async function isClientEmailAllowed(clientId: string | null, type: ClientEmailNotifType): Promise<boolean> {
  if (!clientId) return true; // Guest bookings always get emails (no account to configure)
  try {
    const userDoc = await admin.firestore().collection('users').doc(clientId).get();
    if (!userDoc.exists) return true;

    const settings = userDoc.data()?.notificationSettings;
    if (!settings) return true;
    if (!settings.emailEnabled) return false;

    const map: Record<ClientEmailNotifType, string> = {
      confirmation: 'confirmationNotifications',
      cancellation: 'cancellationNotifications',
      reschedule: 'rescheduleNotifications',
      reminder: 'reminderNotifications',
    };
    return settings[map[type]] !== false;
  } catch (error) {
    console.error(`Error checking client email prefs for ${clientId}:`, error);
    return true; // Fail-open
  }
}

/**
 * Check if a provider has email enabled for a given notification type
 * Returns true by default if no settings are configured (opt-out model)
 */
async function isProviderEmailAllowed(providerId: string, type: 'newBooking' | 'cancellation'): Promise<boolean> {
  try {
    const providerDoc = await admin.firestore().collection('providers').doc(providerId).get();
    if (!providerDoc.exists) return false;

    const prefs = providerDoc.data()?.settings?.notificationPreferences;
    if (!prefs) return true; // No preferences = all enabled (default)
    if (!prefs.emailEnabled) return false; // Master toggle off

    const map: Record<string, string> = {
      newBooking: 'newBookingNotifications',
      cancellation: 'cancellationNotifications',
    };
    return prefs[map[type]] !== false;
  } catch (error) {
    console.error(`Error checking provider email prefs for ${providerId}:`, error);
    return true; // Fail-open
  }
}

/**
 * Get provider's email from their user document
 */
async function getProviderEmail(providerId: string): Promise<string | null> {
  try {
    const providerDoc = await admin.firestore().collection('providers').doc(providerId).get();
    if (!providerDoc.exists) return null;

    const userId = providerDoc.data()?.userId;
    if (!userId) return null;

    const userDoc = await admin.firestore().collection('users').doc(userId).get();
    if (!userDoc.exists) return null;

    return userDoc.data()?.email || null;
  } catch (error) {
    console.error(`Error fetching provider email for ${providerId}:`, error);
    return null;
  }
}

/**
 * Get provider's slug from provider document
 */
async function getProviderSlug(providerId: string): Promise<string | undefined> {
  try {
    const providerDoc = await admin.firestore().collection('providers').doc(providerId).get();
    if (!providerDoc.exists) {
      return undefined;
    }
    return providerDoc.data()?.slug;
  } catch (error) {
    console.error(`Error fetching provider slug for ${providerId}:`, error);
    return undefined;
  }
}

/**
 * Convert booking data to email data format
 */
async function toEmailData(booking: BookingData, bookingId: string): Promise<BookingEmailData | null> {
  if (!booking.clientInfo?.email) {
    console.log('[EMAIL] No client email, skipping');
    return null;
  }

  const providerSlug = await getProviderSlug(booking.providerId);

  return {
    clientEmail: booking.clientInfo.email,
    clientName: booking.clientInfo.name,
    serviceName: booking.serviceName,
    datetime: booking.datetime.toDate(),
    duration: booking.duration || 60, // Default 60 min if not set
    price: booking.price || 0,
    providerName: booking.providerName,
    providerSlug,
    locationName: booking.locationName,
    locationAddress: booking.locationAddress,
    memberName: booking.memberName,
    cancelToken: booking.cancelToken,
    bookingId,
  };
}

/**
 * Send confirmation email to client when booking is confirmed
 */
export async function emailClientBookingConfirmed(
  booking: BookingData,
  bookingId: string
): Promise<void> {
  console.log('[EMAIL] emailClientBookingConfirmed:', booking.clientInfo?.email);

  if (!(await isClientEmailAllowed(booking.clientId, 'confirmation'))) {
    console.log('[EMAIL] Client has disabled confirmation emails, skipping');
    return;
  }

  const emailData = await toEmailData(booking, bookingId);
  if (!emailData) return;

  const result = await sendConfirmationEmail(emailData);
  console.log('[EMAIL] Confirmation email result:', result);
}

/**
 * Send email notification to provider when a new booking is created
 */
export async function emailProviderNewBooking(
  booking: BookingData,
  bookingId: string
): Promise<void> {
  console.log('[EMAIL] emailProviderNewBooking:', booking.providerId);

  if (!(await isProviderEmailAllowed(booking.providerId, 'newBooking'))) {
    console.log('[EMAIL] Provider has disabled new booking emails, skipping');
    return;
  }

  const providerEmail = await getProviderEmail(booking.providerId);
  if (!providerEmail) {
    console.log('[EMAIL] No provider email found, skipping');
    return;
  }

  const result = await sendProviderNewBookingEmail({
    providerEmail,
    clientName: booking.clientInfo.name,
    clientPhone: booking.clientInfo.phone,
    serviceName: booking.serviceName,
    datetime: booking.datetime.toDate(),
    duration: booking.duration || 60,
    price: booking.price || 0,
    providerName: booking.providerName,
    locationName: booking.locationName,
    locationAddress: booking.locationAddress,
    memberName: booking.memberName,
  });

  console.log('[EMAIL] Provider new booking email result:', result);
}

/**
 * Send cancellation email to client when provider cancels
 */
export async function emailClientBookingCancelled(
  booking: BookingData,
  bookingId: string
): Promise<void> {
  console.log('[EMAIL] emailClientBookingCancelled:', booking.clientInfo?.email);

  if (!booking.clientInfo?.email) {
    console.log('[EMAIL] No client email, skipping');
    return;
  }

  if (!(await isClientEmailAllowed(booking.clientId, 'cancellation'))) {
    console.log('[EMAIL] Client has disabled cancellation emails, skipping');
    return;
  }

  const providerSlug = await getProviderSlug(booking.providerId);

  const result = await sendCancellationEmail({
    clientEmail: booking.clientInfo.email,
    clientName: booking.clientInfo.name,
    serviceName: booking.serviceName,
    datetime: booking.datetime.toDate(),
    reason: booking.cancelReason,
    providerName: booking.providerName,
    providerSlug,
    locationName: booking.locationName,
  });

  console.log('[EMAIL] Cancellation email result:', result);
}

/**
 * Send cancellation email to provider when client cancels (or as confirmation when provider cancels)
 */
export async function emailProviderBookingCancelled(
  booking: BookingData,
  bookingId: string
): Promise<void> {
  console.log('[EMAIL] emailProviderBookingCancelled:', booking.providerId);

  if (!(await isProviderEmailAllowed(booking.providerId, 'cancellation'))) {
    console.log('[EMAIL] Provider has disabled cancellation emails, skipping');
    return;
  }

  const providerEmail = await getProviderEmail(booking.providerId);
  if (!providerEmail) {
    console.log('[EMAIL] No provider email found, skipping');
    return;
  }

  const result = await sendProviderCancellationEmail({
    providerEmail,
    clientName: booking.clientInfo.name,
    clientPhone: booking.clientInfo.phone,
    serviceName: booking.serviceName,
    datetime: booking.datetime.toDate(),
    reason: booking.cancelReason,
    providerName: booking.providerName,
    locationName: booking.locationName,
    memberName: booking.memberName,
    cancelledBy: booking.cancelledBy || 'client',
  });

  console.log('[EMAIL] Provider cancellation email result:', result);
}

/**
 * Send reschedule email to client when booking datetime changes
 */
export async function emailClientBookingRescheduled(
  booking: BookingData,
  bookingId: string,
  oldDatetime: Date
): Promise<void> {
  console.log('[EMAIL] emailClientBookingRescheduled:', booking.clientInfo?.email);

  if (!(await isClientEmailAllowed(booking.clientId, 'reschedule'))) {
    console.log('[EMAIL] Client has disabled reschedule emails, skipping');
    return;
  }

  const emailData = await toEmailData(booking, bookingId);
  if (!emailData) return;

  const result = await sendRescheduleEmail({
    ...emailData,
    oldDatetime,
  });

  console.log('[EMAIL] Reschedule email result:', result);
}

/**
 * Send reminder email to client before their booking
 */
export async function emailClientBookingReminder(
  booking: BookingData,
  bookingId: string,
  reminderType: '2h' | '24h',
  minutesUntil?: number
): Promise<void> {
  console.log('[EMAIL] emailClientBookingReminder:', booking.clientInfo?.email, reminderType);

  if (!(await isClientEmailAllowed(booking.clientId, 'reminder'))) {
    console.log('[EMAIL] Client has disabled reminder emails, skipping');
    return;
  }

  const emailData = await toEmailData(booking, bookingId);
  if (!emailData) return;

  const result = await sendReminderEmail(emailData, reminderType, minutesUntil);
  console.log('[EMAIL] Reminder email result:', result);
}

/**
 * Process booking write event and send appropriate emails
 * This is called from onBookingWrite trigger alongside notifications
 *
 * Handles:
 * - Creation: confirmation email to client + new booking email to provider
 * - Update (cancellation): cancellation email to client (provider cancels) or provider (client cancels)
 * - Update (reschedule): reschedule email to client
 */
export async function handleBookingEmails(
  beforeData: admin.firestore.DocumentData | undefined,
  afterData: admin.firestore.DocumentData | undefined,
  bookingId: string
): Promise<void> {
  // Creation - send confirmation email to client + notification email to provider
  if (!beforeData && afterData) {
    const booking = afterData as BookingData;
    console.log('[EMAIL] Booking created, sending confirmation emails');

    // Send both emails in parallel (fire and forget pattern per email)
    await Promise.all([
      emailClientBookingConfirmed(booking, bookingId),
      emailProviderNewBooking(booking, bookingId),
    ]);
    return;
  }

  // Deletion - no email needed
  if (!afterData) {
    return;
  }

  // Update - check for cancellation or reschedule
  if (beforeData && afterData) {
    const booking = afterData as BookingData;
    const oldStatus = beforeData.status;
    const newStatus = afterData.status;

    // Status changed to cancelled - email both parties
    if (oldStatus !== 'cancelled' && newStatus === 'cancelled') {
      const cancelledBy = afterData.cancelledBy;
      console.log(`[EMAIL] Booking cancelled by ${cancelledBy}, sending emails`);

      if (cancelledBy === 'provider') {
        // Provider cancelled → email client
        await emailClientBookingCancelled(booking, bookingId);
      } else if (cancelledBy === 'client') {
        // Client cancelled → email provider
        await emailProviderBookingCancelled(booking, bookingId);
      }
      return;
    }

    // Datetime changed (reschedule) - email client
    const oldDatetime = beforeData.datetime?.toMillis?.();
    const newDatetime = afterData.datetime?.toMillis?.();

    if (oldDatetime && newDatetime && oldDatetime !== newDatetime) {
      if (newStatus === 'pending' || newStatus === 'confirmed') {
        console.log('[EMAIL] Booking rescheduled, emailing client');
        await emailClientBookingRescheduled(booking, bookingId, beforeData.datetime.toDate());
      }
    }
  }
}
