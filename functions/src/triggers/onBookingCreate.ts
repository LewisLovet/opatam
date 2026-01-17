/**
 * Trigger: onBookingCreate
 *
 * Fires when a new booking document is created.
 * Responsibilities:
 * - Send confirmation email to client
 * - Send push notification to provider admin
 * - Send email notification to assigned member (Teams)
 */

import { onDocumentCreated } from 'firebase-functions/v2/firestore';

// Placeholder - will be implemented in Phase 5
export const onBookingCreate = onDocumentCreated(
  'bookings/{bookingId}',
  async (event) => {
    const snapshot = event.data;
    if (!snapshot) {
      console.log('No data associated with the event');
      return;
    }

    const booking = snapshot.data();
    const bookingId = event.params.bookingId;

    console.log(`New booking created: ${bookingId}`);
    console.log(`Provider: ${booking.providerId}`);
    console.log(`Client: ${booking.clientInfo.name}`);

    // TODO: Implement in Phase 5
    // - Send email to client
    // - Send push notification to provider
    // - Send email to member if Teams
  }
);
