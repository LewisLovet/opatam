/**
 * Trigger: onBookingWrite
 *
 * Se déclenche quand un booking est créé, modifié ou supprimé.
 * - Recalcule le nextAvailableSlot du provider concerné
 * - Envoie des notifications push selon l'événement
 * - Envoie des emails de confirmation/annulation/modification
 */

import { onDocumentWritten } from 'firebase-functions/v2/firestore';
import * as admin from 'firebase-admin';
import { Timestamp, FieldValue } from 'firebase-admin/firestore';
import { calculateNextAvailableSlot } from '../utils/calculateNextAvailableSlot';
import { handleBookingNotifications } from '../notifications/bookingNotifications';
import { handleBookingEmails } from '../notifications/bookingEmails';

export const onBookingWrite = onDocumentWritten(
  {
    document: 'bookings/{bookingId}',
    region: 'europe-west1',
  },
  async (event) => {
    const bookingId = event.params.bookingId;
    const beforeData = event.data?.before?.data();
    const afterData = event.data?.after?.data();

    const providerId = afterData?.providerId || beforeData?.providerId;

    console.log(`=== onBookingWrite triggered for booking: ${bookingId} ===`);

    // Send push notifications (fire and forget - don't block on errors)
    try {
      await handleBookingNotifications(beforeData, afterData, bookingId);
    } catch (error) {
      console.error('Error sending booking notifications:', error);
      // Don't throw - notifications should not block the trigger
    }

    // Send emails (fire and forget - don't block on errors)
    try {
      await handleBookingEmails(beforeData, afterData, bookingId);
    } catch (error) {
      console.error('Error sending booking emails:', error);
      // Don't throw - emails should not block the trigger
    }

    if (!providerId) {
      console.log('No providerId found, skipping slot recalculation');
      return;
    }

    // Check if we need to recalculate the next available slot
    // Only recalculate if status or datetime changed
    if (beforeData && afterData) {
      const statusChanged = beforeData.status !== afterData.status;
      const dateChanged = beforeData.datetime?.toMillis?.() !== afterData.datetime?.toMillis?.();

      if (!statusChanged && !dateChanged) {
        console.log('No relevant changes for slot recalculation, skipping');
        return;
      }
    }

    // Recalculate next available slot
    try {
      const nextSlot = await calculateNextAvailableSlot(providerId);

      await admin.firestore()
        .collection('providers')
        .doc(providerId)
        .update({
          nextAvailableSlot: nextSlot ? Timestamp.fromDate(nextSlot) : null,
          updatedAt: FieldValue.serverTimestamp(),
        });

      console.log(`Updated nextAvailableSlot to: ${nextSlot?.toISOString() || 'null'}`);
    } catch (error) {
      console.error('Error recalculating next slot:', error);
    }
  }
);
