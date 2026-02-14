/**
 * Booking Emails Service
 * Handles sending emails for booking-related events
 * Works alongside push notifications in the onBookingWrite trigger
 */

import * as admin from 'firebase-admin';
import {
  sendConfirmationEmail,
  sendCancellationEmail,
  sendRescheduleEmail,
  sendReminderEmail,
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
  cancelToken?: string;
  locationName?: string;
  locationAddress?: string;
  memberName?: string;
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

  const emailData = await toEmailData(booking, bookingId);
  if (!emailData) return;

  const result = await sendConfirmationEmail(emailData);
  console.log('[EMAIL] Confirmation email result:', result);
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

  const providerSlug = await getProviderSlug(booking.providerId);

  const result = await sendCancellationEmail({
    clientEmail: booking.clientInfo.email,
    clientName: booking.clientInfo.name,
    serviceName: booking.serviceName,
    datetime: booking.datetime.toDate(),
    providerName: booking.providerName,
    providerSlug,
    locationName: booking.locationName,
  });

  console.log('[EMAIL] Cancellation email result:', result);
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

  const emailData = await toEmailData(booking, bookingId);
  if (!emailData) return;

  const result = await sendReminderEmail(emailData, reminderType, minutesUntil);
  console.log('[EMAIL] Reminder email result:', result);
}

/**
 * Process booking write event and send appropriate emails
 * This is called from onBookingWrite trigger alongside notifications
 *
 * NOTE: Confirmation and cancellation emails are sent by Next.js API routes
 * (/api/bookings/confirmation-email and /api/bookings/cancel-email).
 * This handler only processes reschedule emails (datetime changes).
 */
export async function handleBookingEmails(
  beforeData: admin.firestore.DocumentData | undefined,
  afterData: admin.firestore.DocumentData | undefined,
  bookingId: string
): Promise<void> {
  // Only process updates (reschedule)
  if (!beforeData || !afterData) {
    return;
  }

  const booking = afterData as BookingData;
  const newStatus = afterData.status;

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
