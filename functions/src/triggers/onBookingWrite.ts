/**
 * Trigger: onBookingWrite
 *
 * Se déclenche quand un booking est créé, modifié ou supprimé.
 * Recalcule le nextAvailableSlot du provider concerné.
 */

import { onDocumentWritten } from 'firebase-functions/v2/firestore';
import * as admin from 'firebase-admin';
import { Timestamp, FieldValue } from 'firebase-admin/firestore';
import { calculateNextAvailableSlot } from '../utils/calculateNextAvailableSlot';

export const onBookingWrite = onDocumentWritten(
  'bookings/{bookingId}',
  async (event) => {
    const beforeData = event.data?.before?.data();
    const afterData = event.data?.after?.data();

    const providerId = afterData?.providerId || beforeData?.providerId;

    if (!providerId) {
      console.log('No providerId found, skipping');
      return;
    }

    // Éviter les recalculs inutiles
    // Ne recalculer que si le status ou la date a changé
    if (beforeData && afterData) {
      const statusChanged = beforeData.status !== afterData.status;
      const dateChanged = beforeData.datetime?.toMillis?.() !== afterData.datetime?.toMillis?.();

      if (!statusChanged && !dateChanged) {
        console.log('No relevant changes, skipping recalculation');
        return;
      }
    }

    console.log(`=== onBookingWrite triggered for provider: ${providerId} ===`);

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
      console.error('Error in onBookingWrite:', error);
    }
  }
);
