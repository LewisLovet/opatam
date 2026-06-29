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
import type {
  BookingSelectedVariation,
  BookingSelectedOption,
  BookingSelectedInfo,
} from '@booking-app/shared';
import { resolveRevealedAddress } from '../utils/addressReveal';

// Types for booking data from Firestore
interface BookingData {
  providerId: string;
  clientId: string | null;
  serviceName: string;
  datetime: admin.firestore.Timestamp;
  duration?: number;
  price?: number;
  priceMax?: number | null;
  originalPrice?: number | null;
  items?: {
    serviceName: string;
    duration: number;
    price: number;
    originalPrice?: number | null;
    selectedVariations?: BookingSelectedVariation[];
    selectedOptions?: BookingSelectedOption[];
    selectedInfo?: BookingSelectedInfo[];
  }[];
  // Mono-booking choices (no items[] breakdown).
  selectedVariations?: BookingSelectedVariation[];
  selectedOptions?: BookingSelectedOption[];
  selectedInfo?: BookingSelectedInfo[];
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
  locationId?: string;
  locationProtected?: boolean;
  memberName?: string;
  deposit?: {
    amount: number;
    refundDeadlineHours: number;
    status: 'pending' | 'paid' | 'refunded' | 'failed';
  } | null;
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
async function toEmailData(
  booking: BookingData,
  bookingId: string,
  opts?: { forceRevealAddress?: boolean },
): Promise<BookingEmailData | null> {
  if (!booking.clientInfo?.email) {
    console.log('[EMAIL] No client email, skipping');
    return null;
  }

  const providerSlug = await getProviderSlug(booking.providerId);

  // Fetch bookingNotice + reminder lead times from provider settings
  let bookingNotice: string | null = null;
  let reminderLeadHours: number[] = [];
  try {
    const providerDoc = await admin.firestore().collection('providers').doc(booking.providerId).get();
    const settings = providerDoc.data()?.settings;
    bookingNotice = settings?.bookingNotice || null;
    reminderLeadHours = Array.isArray(settings?.reminderTimes) ? settings.reminderTimes : [];
  } catch {
    // Non-blocking
  }

  // Surface the deposit only once it's actually paid — at the
  // pending/failed states there's nothing reassuring to show the client.
  const depositPaid =
    booking.deposit && booking.deposit.status === 'paid'
      ? {
          amount: booking.deposit.amount,
          refundDeadlineHours: booking.deposit.refundDeadlineHours,
        }
      : null;

  // Address privacy: reveal the exact street only when allowed; otherwise the
  // masked approx area already on the booking is used.
  const resolvedAddress = await resolveRevealedAddress(
    {
      locationProtected: booking.locationProtected,
      locationAddress: booking.locationAddress,
      status: booking.status,
      datetime: booking.datetime.toDate(),
      providerId: booking.providerId,
      locationId: booking.locationId || '',
    },
    { forceReveal: opts?.forceRevealAddress },
  );

  // When the address is still masked, tell the client WHEN it'll arrive — i.e.
  // when their earliest reminder is sent (reminders force-reveal the address).
  let addressAvailableAt: Date | null = null;
  if (resolvedAddress.pending) {
    const leadH = reminderLeadHours.length ? Math.max(...reminderLeadHours) : 24;
    const candidate = booking.datetime.toDate().getTime() - leadH * 60 * 60 * 1000;
    // Only show a date if it's still in the future; otherwise the notice falls
    // back to the generic "with your reminder" wording.
    addressAvailableAt = candidate > Date.now() ? new Date(candidate) : null;
  }

  return {
    clientEmail: booking.clientInfo.email,
    clientName: booking.clientInfo.name,
    serviceName: booking.serviceName,
    datetime: booking.datetime.toDate(),
    duration: booking.duration || 60,
    price: booking.price || 0,
    priceMax: booking.priceMax || null,
    originalPrice: booking.originalPrice ?? null,
    items: booking.items?.map((i) => ({
      serviceName: i.serviceName,
      duration: i.duration,
      price: i.price,
      originalPrice: i.originalPrice ?? null,
      selectedVariations: i.selectedVariations,
      selectedOptions: i.selectedOptions,
      selectedInfo: i.selectedInfo,
    })),
    selectedVariations: booking.selectedVariations,
    selectedOptions: booking.selectedOptions,
    selectedInfo: booking.selectedInfo,
    providerName: booking.providerName,
    providerSlug,
    locationName: booking.locationName,
    locationAddress: resolvedAddress.address,
    addressPending: resolvedAddress.pending,
    accessInstructions: resolvedAddress.accessInstructions,
    addressAvailableAt,
    memberName: booking.memberName,
    cancelToken: booking.cancelToken,
    bookingId,
    bookingNotice,
    depositPaid,
  };
}

/**
 * Send confirmation email to client when booking is confirmed
 */
export async function emailClientBookingConfirmed(
  booking: BookingData,
  bookingId: string,
  updateContext?: { type: 'added' | 'removed'; serviceName: string }
): Promise<void> {
  console.log('[EMAIL] emailClientBookingConfirmed:', booking.clientInfo?.email);

  if (!(await isClientEmailAllowed(booking.clientId, 'confirmation'))) {
    console.log('[EMAIL] Client has disabled confirmation emails, skipping');
    return;
  }

  const emailData = await toEmailData(booking, bookingId);
  if (!emailData) return;

  const result = await sendConfirmationEmail({ ...emailData, updateContext });
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

  const depositPaid =
    booking.deposit && booking.deposit.status === 'paid'
      ? { amount: booking.deposit.amount }
      : null;

  const result = await sendProviderNewBookingEmail({
    providerEmail,
    clientName: booking.clientInfo.name,
    clientPhone: booking.clientInfo.phone,
    serviceName: booking.serviceName,
    datetime: booking.datetime.toDate(),
    duration: booking.duration || 60,
    price: booking.price || 0,
    priceMax: booking.priceMax || null,
    originalPrice: booking.originalPrice ?? null,
    items: booking.items?.map((i) => ({
      serviceName: i.serviceName,
      duration: i.duration,
      price: i.price,
      originalPrice: i.originalPrice ?? null,
      selectedVariations: i.selectedVariations,
      selectedOptions: i.selectedOptions,
      selectedInfo: i.selectedInfo,
    })),
    selectedVariations: booking.selectedVariations,
    selectedOptions: booking.selectedOptions,
    selectedInfo: booking.selectedInfo,
    providerName: booking.providerName,
    locationName: booking.locationName,
    locationAddress: booking.locationAddress,
    memberName: booking.memberName,
    depositPaid,
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

  // Surface the deposit outcome in the cancellation email. We have
  // exactly two cases worth telling the client about:
  //   - status='refunded' → "remboursé X€" (green callout)
  //   - status='paid'     → "non remboursé X€" (red callout, delay
  //                         expired and pro chose not to refund)
  // No deposit at all → no callout.
  let refundedAmount: number | null = null;
  let unrefundedAmount: number | null = null;
  if (booking.deposit) {
    if (booking.deposit.status === 'refunded') {
      refundedAmount = booking.deposit.amount;
    } else if (booking.deposit.status === 'paid') {
      unrefundedAmount = booking.deposit.amount;
    }
  }

  const result = await sendCancellationEmail({
    clientEmail: booking.clientInfo.email,
    clientName: booking.clientInfo.name,
    serviceName: booking.serviceName,
    datetime: booking.datetime.toDate(),
    reason: booking.cancelReason,
    providerName: booking.providerName,
    providerSlug,
    locationName: booking.locationName,
    refundedAmount,
    unrefundedAmount,
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

  // Mirror the client-side logic: if the deposit was refunded as part
  // of the cancellation, tell the pro it'll come off their next payout.
  // If the deposit was paid but kept (delay expired, no force-refund),
  // remind them they get to keep the funds.
  let providerRefundedAmount: number | null = null;
  let providerUnrefundedAmount: number | null = null;
  if (booking.deposit) {
    if (booking.deposit.status === 'refunded') {
      providerRefundedAmount = booking.deposit.amount;
    } else if (booking.deposit.status === 'paid') {
      providerUnrefundedAmount = booking.deposit.amount;
    }
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
    refundedAmount: providerRefundedAmount,
    unrefundedAmount: providerUnrefundedAmount,
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
  reminderType: '2h' | '24h' | '48h',
  minutesUntil?: number
): Promise<void> {
  console.log('[EMAIL] emailClientBookingReminder:', booking.clientInfo?.email, reminderType);

  if (!(await isClientEmailAllowed(booking.clientId, 'reminder'))) {
    console.log('[EMAIL] Client has disabled reminder emails, skipping');
    return;
  }

  // Reminder always reveals the exact address + access instructions.
  const emailData = await toEmailData(booking, bookingId, { forceRevealAddress: true });
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

    // Deposit-required bookings start in `pending_payment`. The client is
    // mid-Checkout — sending "ta réservation est confirmée" now would lie.
    // Both confirmation emails are deferred until the deposit is actually
    // paid (handled in the update branch below, on pending_payment →
    // confirmed transition).
    if (booking.status === 'pending_payment') {
      console.log('[EMAIL] Booking created in pending_payment, deferring confirmation emails until deposit is paid');
      return;
    }

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

  // Update - check for status transitions, cancellation, or reschedule
  if (beforeData && afterData) {
    const booking = afterData as BookingData;
    const oldStatus = beforeData.status;
    const newStatus = afterData.status;

    // Deposit paid: pending_payment → confirmed. Send the confirmation
    // emails that were deferred at creation time.
    if (oldStatus === 'pending_payment' && newStatus === 'confirmed') {
      console.log('[EMAIL] Deposit paid, sending deferred confirmation emails');
      await Promise.all([
        emailClientBookingConfirmed(booking, bookingId),
        emailProviderNewBooking(booking, bookingId),
      ]);
      return;
    }

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
      return;
    }

    // Prestation added or removed (multi-prestation): status & datetime
    // unchanged, but the duration changed. Re-send the now-updated
    // confirmation so the client sees the current prestations + total. Only
    // for confirmed bookings — a "confirmée" email would be wrong on a
    // pending one.
    // An empty/absent items array means a single-service booking (= 1).
    const beforeCount = Array.isArray(beforeData.items) && beforeData.items.length > 0
      ? beforeData.items.length
      : beforeData.serviceId ? 1 : 0;
    const afterCount = Array.isArray(afterData.items) && afterData.items.length > 0
      ? afterData.items.length
      : afterData.serviceId ? 1 : 0;
    if (
      oldStatus === newStatus &&
      newStatus === 'confirmed' &&
      oldDatetime === newDatetime &&
      afterCount !== beforeCount
    ) {
      const added = afterCount > beforeCount;
      const beforeItems = Array.isArray(beforeData.items) ? beforeData.items : [];
      const afterItems = Array.isArray(afterData.items) ? afterData.items : [];
      const changedName: string = added
        ? afterItems.length
          ? afterItems[afterItems.length - 1].serviceName
          : afterData.serviceName
        : beforeItems.length
          ? beforeItems[beforeItems.length - 1].serviceName
          : beforeData.serviceName;
      console.log(`[EMAIL] Prestation ${added ? 'added' : 'removed'}, emailing updated booking to client`);
      await emailClientBookingConfirmed(booking, bookingId, {
        type: added ? 'added' : 'removed',
        serviceName: changedName,
      });
    }
  }
}
