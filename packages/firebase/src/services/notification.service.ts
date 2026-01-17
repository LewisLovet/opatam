/**
 * Notification Service - STUB
 *
 * This service will handle sending notifications (email, push, SMS)
 * for various booking events. Implementation will be added later
 * when notification infrastructure is set up.
 */

export class NotificationService {
  /**
   * Called when a new booking is created
   * Sends confirmation email to client and notification to provider
   */
  async onBookingCreated(bookingId: string): Promise<void> {
    // TODO: Implement
    // - Send confirmation email to client with booking details
    // - Send notification to provider about new booking
    // - If pending, include "confirm" action for provider
    console.log('[NotificationService] onBookingCreated:', bookingId);
  }

  /**
   * Called when a booking is confirmed by provider
   * Sends confirmation notification to client
   */
  async onBookingConfirmed(bookingId: string): Promise<void> {
    // TODO: Implement
    // - Send email to client confirming their booking
    // - Include calendar invite (ICS file)
    // - Include cancellation link with token
    console.log('[NotificationService] onBookingConfirmed:', bookingId);
  }

  /**
   * Called when a booking is cancelled
   * Notifies the other party about cancellation
   */
  async onBookingCancelled(bookingId: string): Promise<void> {
    // TODO: Implement
    // - If cancelled by client, notify provider
    // - If cancelled by provider, notify client with apology
    // - Include reason if provided
    console.log('[NotificationService] onBookingCancelled:', bookingId);
  }

  /**
   * Called when a booking is completed
   * Sends review request to client
   */
  async onBookingCompleted(bookingId: string): Promise<void> {
    // TODO: Implement
    // - Send email to client thanking them
    // - Include link to leave a review
    // - Schedule follow-up reminder if no review after X days
    console.log('[NotificationService] onBookingCompleted:', bookingId);
  }

  /**
   * Send reminder notification before booking
   * Called by scheduled function
   */
  async sendReminder(bookingId: string, minutesBefore: number): Promise<void> {
    // TODO: Implement
    // - Send email/SMS reminder to client
    // - Include booking details and location
    // - Include cancellation link
    // - Mark reminder as sent in booking.remindersSent
    console.log('[NotificationService] sendReminder:', bookingId, 'minutes before:', minutesBefore);
  }

  /**
   * Send message notification
   * Called when new message is received
   */
  async onNewMessage(conversationId: string, messageId: string): Promise<void> {
    // TODO: Implement
    // - Send push notification to recipient
    // - If recipient not online, send email after X minutes
    console.log('[NotificationService] onNewMessage:', conversationId, messageId);
  }

  /**
   * Send review notification to provider
   * Called when client leaves a review
   */
  async onNewReview(reviewId: string): Promise<void> {
    // TODO: Implement
    // - Notify provider about new review
    // - Include rating and comment preview
    console.log('[NotificationService] onNewReview:', reviewId);
  }

  /**
   * Send welcome email to new user
   */
  async sendWelcomeEmail(userId: string, userType: 'client' | 'provider'): Promise<void> {
    // TODO: Implement
    // - Send welcome email with getting started guide
    // - For providers, include setup checklist
    console.log('[NotificationService] sendWelcomeEmail:', userId, userType);
  }

  /**
   * Send password reset email
   * Note: Firebase Auth handles the actual email, this is for custom tracking
   */
  async onPasswordResetRequested(email: string): Promise<void> {
    // TODO: Implement
    // - Track password reset request
    // - Optional: Send custom email instead of Firebase default
    console.log('[NotificationService] onPasswordResetRequested:', email);
  }

  /**
   * Send subscription expiring notification
   */
  async onSubscriptionExpiring(providerId: string, daysRemaining: number): Promise<void> {
    // TODO: Implement
    // - Notify provider about subscription expiring
    // - Include renewal link
    console.log('[NotificationService] onSubscriptionExpiring:', providerId, 'days:', daysRemaining);
  }

  /**
   * Send no-show notification
   */
  async onNoShow(bookingId: string): Promise<void> {
    // TODO: Implement
    // - Notify client about no-show recorded
    // - Include policy reminder
    console.log('[NotificationService] onNoShow:', bookingId);
  }
}

// Singleton instance
export const notificationService = new NotificationService();
