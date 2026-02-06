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
 * Process booking write event and send appropriate emails
 * This is called from onBookingWrite trigger alongside notifications
 *
 * NOTE: Currently only emailing CLIENTS, not providers.
 * Same logic as push notifications.
 */
export async function handleBookingEmails(
  beforeData: admin.firestore.DocumentData | undefined,
  afterData: admin.firestore.DocumentData | undefined,
  bookingId: string
): Promise<void> {
  // Creation - send confirmation email if created with status = confirmed
  if (!beforeData && afterData) {
    const booking = afterData as BookingData;
    if (booking.status === 'confirmed') {
      console.log('[EMAIL] Booking created with status=confirmed, emailing client');
      await emailClientBookingConfirmed(booking, bookingId);
    } else {
      console.log('[EMAIL] Booking created with status=' + booking.status + ', no email needed');
    }
    return;
  }

  // Deletion - no email needed
  if (beforeData && !afterData) {
    console.log('[EMAIL] Booking deleted, no email needed');
    return;
  }

  // Update - check what changed
  if (beforeData && afterData) {
    const booking = afterData as BookingData;
    const oldStatus = beforeData.status;
    const newStatus = afterData.status;

    // Status changed to confirmed - email client
    if (oldStatus !== 'confirmed' && newStatus === 'confirmed') {
      console.log('[EMAIL] Booking confirmed, emailing client');
      await emailClientBookingConfirmed(booking, bookingId);
      return;
    }

    // Status changed to cancelled - always email client as confirmation
    if (oldStatus !== 'cancelled' && newStatus === 'cancelled') {
      const cancelledBy = afterData.cancelledBy;
      console.log(`[EMAIL] Booking cancelled by ${cancelledBy || 'unknown'}, emailing client confirmation`);
      await emailClientBookingCancelled(booking, bookingId);
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
