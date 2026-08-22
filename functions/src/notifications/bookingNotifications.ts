/**
 * Booking Notifications Service
 * Handles sending push notifications for booking-related events
 */

import * as admin from 'firebase-admin';
import { providerLocale, PUSH_TEXTS, INTL_LOCALE, type ProviderLocale } from '../lib/providerPushI18n';
import { providerTimeZone } from '../lib/morningAgenda';
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
  /** Address-privacy: true when the location hides its exact address until
   *  the appointment nears — lets the reminder push announce availability. */
  locationProtected?: boolean | null;
  cancelledBy?: 'client' | 'provider' | null;
  /** Optional — present only on bookings that required a deposit.
   *  Used to flag the new-booking push when the deposit was actually
   *  paid (status flipped from pending_payment → confirmed). */
  deposit?: {
    amount: number;          // cents
    status: 'pending' | 'paid' | 'refunded' | 'failed';
  } | null;
}

/**
 * Format a date in French format
 * Example: "lundi 3 février à 14h30"
 */
/**
 * Date ET HEURE, dans la langue et le fuseau du prestataire.
 *
 * L'HEURE EST INDISPENSABLE : `formatDateFr` rendait « vendredi 22 août à
 * 14h30 » et une première version de ce formateur s'arrêtait au mois — les
 * push de nouvelle réservation, d'annulation et de modification perdaient
 * l'horaire, c'est-à-dire l'information la plus utile.
 *
 * `toLocaleString` et non `toLocaleDateString` : c'est Intl qui place le
 * connecteur propre à chaque langue — « à » en français, « às » en portugais,
 * « um » en allemand, « alle ore » en italien.
 */
function formatDateProvider(date: Date, intl: string, timeZone: string): string {
  return date.toLocaleString(intl, {
    weekday: 'long', day: 'numeric', month: 'long',
    hour: '2-digit', minute: '2-digit',
    timeZone,
  });
}

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
type ProviderNotifType = 'newBooking' | 'confirmation' | 'cancellation' | 'reminder' | 'dailyAgenda';

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
 * Tout ce qu'il faut savoir du prestataire pour lui écrire : à qui, dans
 * quelle langue, et a-t-il autorisé ce type de notification.
 *
 * UNE seule lecture Firestore. Les deux helpers précédents — vérification de
 * préférence et récupération du userId — lisaient chacun la même fiche : deux
 * lectures par notification, et aucun des deux ne rapportait la langue.
 */
export interface ProviderPushContext {
  userId: string;
  locale: ProviderLocale;
  /** Libellés dans la langue du prestataire. */
  t: (typeof PUSH_TEXTS)[ProviderLocale];
  /** Étiquette Intl correspondante, pour les dates et heures. */
  intl: string;
  /** Fuseau du prestataire — une notification annonce SON heure. */
  timeZone: string;
  allowed: (type: ProviderNotifType) => boolean;
}

export async function loadProviderPushContext(
  providerId: string,
): Promise<ProviderPushContext | null> {
  try {
    const doc = await admin.firestore().collection('providers').doc(providerId).get();
    if (!doc.exists) {
      console.log(`Provider ${providerId} not found`);
      return null;
    }
    const data = doc.data()!;
    const userId = data.userId;
    if (!userId) return null;

    const prefs = data.settings?.notificationPreferences;
    const locale = providerLocale(data);

    return {
      userId,
      locale,
      t: PUSH_TEXTS[locale],
      intl: INTL_LOCALE[locale],
      timeZone: providerTimeZone(data.countryCode),
      allowed: (type) => {
        if (!prefs) return true; // Aucune préférence = tout activé (défaut)
        if (!prefs.pushEnabled) return false; // Interrupteur général
        const map: Record<ProviderNotifType, string> = {
          newBooking: 'newBookingNotifications',
          confirmation: 'confirmationNotifications',
          cancellation: 'cancellationNotifications',
          reminder: 'reminderNotifications',
          // Résumé du matin : la clé n'existe pas sur les préférences déjà
          // enregistrées → `!== false` la laisse ACTIVE par défaut.
          dailyAgenda: 'dailyAgendaPush',
        };
        return prefs[map[type]] !== false;
      },
    };
  } catch (error) {
    console.error(`Error loading provider push context ${providerId}:`, error);
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

  const ctx = await loadProviderPushContext(booking.providerId);
  if (!ctx) return;
  if (!ctx.allowed('newBooking')) {
    console.log('Provider has disabled newBooking push notifications, skipping');
    return;
  }
  const providerUserId = ctx.userId;

  const pushTokens = await getUserPushTokens(providerUserId);
  if (pushTokens.length === 0) {
    console.log('Provider has no push tokens, skipping notification');
    return;
  }

  const datetime = booking.datetime.toDate();
  const dateStr = formatDateProvider(datetime, ctx.intl, ctx.timeZone);

  // Highlight the deposit when one was paid as part of the booking.
  // Surfaces the value of the Sérénité add-on at every relevant push.
  // Backward compat: title prefix and body suffix are pure text — old
  // mobile clients render them fine. The `data.type` stays
  // 'new_booking' so legacy push routers continue to work; new
  // optional `depositAmount` field is read by recent clients only.
  const depositPaid =
    booking.deposit?.status === 'paid' && (booking.deposit.amount ?? 0) > 0;
  const depositEuros = depositPaid
    ? formatDepositAmount(booking.deposit!.amount)
    : null;

  const title = depositPaid ? ctx.t.nouveauRdvAcompte : ctx.t.nouveauRdv;
  const ligne = ctx.t.ligneRdv(booking.clientInfo.name, booking.serviceName, dateStr);
  const body = depositPaid
    ? `${ligne} · ${ctx.t.acompteEncaisse(depositEuros!)}`
    : ligne;

  const result = await sendPushNotifications(pushTokens, {
    title,
    body,
    data: {
      type: 'new_booking',
      bookingId,
      ...(depositPaid
        ? { depositAmount: booking.deposit!.amount, depositPaid: true }
        : {}),
    },
  });

  console.log('notifyProviderNewBooking result:', result);

  if (result.invalidTokens.length > 0) {
    await removeInvalidTokens(providerUserId, result.invalidTokens);
  }
}

/** Format cents → "30 €" / "29,50 €". Kept local rather than imported
 *  from shared because shared's formatPrice returns "Gratuit" for 0,
 *  which would never apply here (we only call it on paid deposits)
 *  but the explicit local version makes the intent clearer. */
function formatDepositAmount(cents: number): string {
  const euros = cents / 100;
  if (euros % 1 === 0) return `${euros} €`;
  return `${euros.toFixed(2).replace('.', ',')} €`;
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
 * Rappel PRESTATAIRE ~1 h avant un rendez-vous.
 *
 * Les rappels 24 h / 2 h existants ne partent qu'aux CLIENTES — le
 * prestataire n'était jamais prévenu qu'un rendez-vous approche. Gate :
 * `reminderNotifications`, qui cesse d'être un réglage sans effet.
 */
export async function notifyProviderBookingSoon(
  booking: BookingData,
  minutesUntil: number,
  bookingId: string
): Promise<void> {
  console.log('notifyProviderBookingSoon:', booking.providerId, bookingId);

  const ctx = await loadProviderPushContext(booking.providerId);
  if (!ctx) return;
  if (!ctx.allowed('reminder')) {
    console.log('Provider has disabled reminder push notifications, skipping');
    return;
  }
  const providerUserId = ctx.userId;
  const pushTokens = await getUserPushTokens(providerUserId);
  if (pushTokens.length === 0) return;

  const datetime = booking.datetime.toDate();
  const timeStr = datetime.toLocaleTimeString(ctx.intl, {
    hour: '2-digit', minute: '2-digit', timeZone: ctx.timeZone,
  });
  const clientName = booking.clientInfo?.name || ctx.t.uneCliente;
  const mins = Math.round(minutesUntil);

  const result = await sendPushNotifications(pushTokens, {
    title: mins >= 55 ? ctx.t.rdvDansUneHeure : ctx.t.rdvDansNMinutes(mins),
    body: `${timeStr} — ${clientName} · ${booking.serviceName}`,
    data: { type: 'provider_booking_soon', bookingId },
  });
  if (result.invalidTokens.length > 0) {
    await removeInvalidTokens(providerUserId, result.invalidTokens);
  }
}

/**
 * Résumé du matin : « Aujourd'hui N rendez-vous, le premier à HH:MM ».
 * Appelé par le cron sendProviderMorningAgenda. Gate : `dailyAgendaPush`
 * (absent = activé — envoyé tous les matins par défaut).
 */
export async function notifyProviderDailyAgenda(
  providerId: string,
  bookingsCount: number,
  firstTime: string
): Promise<void> {
  const ctx = await loadProviderPushContext(providerId);
  if (!ctx) return;
  if (!ctx.allowed('dailyAgenda')) {
    console.log(`Provider ${providerId} has disabled daily agenda push, skipping`);
    return;
  }
  const providerUserId = ctx.userId;
  const pushTokens = await getUserPushTokens(providerUserId);
  if (pushTokens.length === 0) return;

  const body =
    bookingsCount === 1
      ? ctx.t.journeeUn(firstTime)
      : ctx.t.journeePlusieurs(bookingsCount, firstTime);

  const result = await sendPushNotifications(pushTokens, {
    title: ctx.t.journee,
    body,
    data: { type: 'provider_daily_agenda' },
  });
  if (result.invalidTokens.length > 0) {
    await removeInvalidTokens(providerUserId, result.invalidTokens);
  }
}

/**
 * Send notification to provider when client cancels
 */
export async function notifyProviderBookingCancelled(booking: BookingData): Promise<void> {
  console.log('notifyProviderBookingCancelled:', booking.providerId);

  const ctx = await loadProviderPushContext(booking.providerId);
  if (!ctx) return;
  if (!ctx.allowed('cancellation')) {
    console.log('Provider has disabled cancellation push notifications, skipping');
    return;
  }
  const providerUserId = ctx.userId;

  const pushTokens = await getUserPushTokens(providerUserId);
  if (pushTokens.length === 0) {
    console.log('Provider has no push tokens, skipping notification');
    return;
  }

  const datetime = booking.datetime.toDate();
  const dateStr = formatDateProvider(datetime, ctx.intl, ctx.timeZone);

  const result = await sendPushNotifications(pushTokens, {
    title: ctx.t.rdvAnnule,
    body: ctx.t.annuleParClient(booking.clientInfo.name, dateStr),
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
 * Notify the provider when a prestation is added to OR removed from an
 * existing booking (multi-prestation). Reuses the `newBooking` preference —
 * same "booking activity" opt-in.
 */
export async function notifyProviderServiceChange(
  booking: BookingData,
  bookingId: string,
  added: boolean
): Promise<void> {
  console.log('notifyProviderServiceChange:', booking.providerId, bookingId, added);

  const ctx = await loadProviderPushContext(booking.providerId);
  if (!ctx) return;
  if (!ctx.allowed('newBooking')) {
    console.log('Provider has disabled newBooking push notifications, skipping');
    return;
  }
  const providerUserId = ctx.userId;

  const pushTokens = await getUserPushTokens(providerUserId);
  if (pushTokens.length === 0) return;

  const dateStr = formatDateProvider(booking.datetime.toDate(), ctx.intl, ctx.timeZone);

  const result = await sendPushNotifications(pushTokens, {
    title: added ? ctx.t.prestationAjoutee : ctx.t.prestationRetiree,
    body: ctx.t.ligneRdv(booking.clientInfo.name, booking.serviceName, dateStr),
    data: { type: 'booking_updated', bookingId },
  });

  console.log('notifyProviderServiceChange result:', result);

  if (result.invalidTokens.length > 0) {
    await removeInvalidTokens(providerUserId, result.invalidTokens);
  }
}

/**
 * Send reminder notification to client before their booking
 */
export async function notifyClientBookingReminder(
  booking: BookingData,
  reminderType: '2h' | '24h' | '48h',
  minutesUntil?: number,
  bookingId?: string
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
  } else if (reminderType === '48h') {
    timeLabel = 'dans 2 jours';
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

  const baseBody = reminderType === '24h'
    ? `Rappel : votre RDV ${booking.serviceName} est demain, le ${dateStr}`
    : reminderType === '48h'
      ? `Rappel : votre RDV ${booking.serviceName} est dans 2 jours, le ${dateStr}`
      : `Rappel : votre RDV ${booking.serviceName} est ${timeLabel} (${dateStr})`;
  // For a protected location, make it explicit that the exact address is now
  // available (without putting the address itself on the lock screen).
  const body = booking.locationProtected
    ? `${baseBody}. 📍 L'adresse exacte est maintenant disponible, appuyez pour la voir.`
    : baseBody;

  const result = await sendPushNotifications(pushTokens, {
    title: 'Rappel de rendez-vous',
    body,
    data: {
      type: 'booking_reminder',
      ...(bookingId ? { bookingId } : {}),
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
  // Données de démo seedées (captures store) : jamais de push.
  if ((afterData ?? beforeData)?.demoSeed) {
    console.log('demoSeed booking, skipping all notifications');
    return;
  }

  // Creation - no push notification needed (client is already using the app)
  // Email confirmation is sent separately via bookingEmails
  if (!beforeData && afterData) {
    const booking = afterData as BookingData;
    // Deposit-pending bookings defer the provider notification: nothing to
    // act on yet, and a "new booking" alert before the deposit clears would
    // be confusing.
    if (booking.status === 'pending_payment') {
      console.log('Booking created in pending_payment, deferring provider notification');
      return;
    }
    console.log('Booking created, notifying provider');
    await notifyProviderNewBooking(booking, bookingId);
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
      // If we're transitioning out of pending_payment (deposit just paid),
      // also fire the provider's "new booking" alert that we deferred at
      // creation time.
      if (oldStatus === 'pending_payment') {
        console.log('Deposit paid, firing deferred provider notification');
        await notifyProviderNewBooking(booking, bookingId);
      }
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
      return;
    }

    // Prestation added to / removed from an existing booking: detect via the
    // PRESTATION COUNT (items), NOT raw duration. Adjusting a booking's
    // duration rewrites `duration`/`endDatetime` without touching the
    // prestation list, so it must not fire an "ajoutée/retirée" notification.
    // An empty/absent items array means a single-service booking (= 1).
    const beforeCount = Array.isArray(beforeData.items) && beforeData.items.length > 0
      ? beforeData.items.length
      : beforeData.serviceId ? 1 : 0;
    const afterCount = Array.isArray(afterData.items) && afterData.items.length > 0
      ? afterData.items.length
      : afterData.serviceId ? 1 : 0;
    if (
      oldStatus === newStatus &&
      oldDatetime === newDatetime &&
      afterCount !== beforeCount
    ) {
      const added = afterCount > beforeCount;
      console.log(`Service ${added ? 'added to' : 'removed from'} booking, notifying provider`);
      await notifyProviderServiceChange(booking, bookingId, added);
    }
  }
}
