/**
 * Callable: cancelBooking
 *
 * Allows cancellation of bookings via token (for web users without account).
 * Called from the public cancellation page.
 */

import { onCall, CallableRequest } from 'firebase-functions/v2/https';

interface CancelBookingData {
  token: string;
  reason?: string;
}

// Placeholder - will be implemented in Phase 4
export const cancelBooking = onCall(
  async (request: CallableRequest<CancelBookingData>) => {
    const { token, reason } = request.data;

    console.log(`Cancel booking requested with token: ${token}`);

    // TODO: Implement in Phase 4
    // - Find booking by cancelToken
    // - Verify booking is cancellable (status = confirmed or pending)
    // - Update booking status to cancelled
    // - Send notifications

    return {
      success: false,
      message: 'Not implemented yet',
    };
  }
);
