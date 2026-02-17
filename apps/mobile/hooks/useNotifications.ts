/**
 * useNotifications Hook
 * Handles push notification registration and token management
 */

import { useEffect, useRef, useCallback } from 'react';
import * as Notifications from 'expo-notifications';
import { useAuth } from '../contexts/AuthContext';
import { userRepository } from '@booking-app/firebase';
import { registerForPushNotifications } from '../utils/notifications';

interface NotificationResponse {
  notification: Notifications.Notification;
}

/**
 * Hook to manage push notifications
 * - Registers for push notifications when user is authenticated
 * - Saves token to Firestore
 * - Sets up notification listeners
 */
export function useNotifications() {
  const { user, userData } = useAuth();
  const currentTokenRef = useRef<string | null>(null);
  const previousUidRef = useRef<string | null>(null);
  const notificationListener = useRef<Notifications.Subscription | null>(null);
  const responseListener = useRef<Notifications.Subscription | null>(null);

  /**
   * Register for push notifications and save token
   */
  const registerAndSaveToken = useCallback(async () => {
    if (!user?.uid) return;

    try {
      const token = await registerForPushNotifications();

      if (token && token !== currentTokenRef.current) {
        // Save token to Firestore
        await userRepository.addPushToken(user.uid, token);
        currentTokenRef.current = token;
        console.log('Push token registered:', token);
      }
    } catch (error) {
      console.error('Error registering push notifications:', error);
    }
  }, [user?.uid]);

  /**
   * Handle received notification (when app is in foreground)
   */
  const handleNotification = useCallback((notification: Notifications.Notification) => {
    console.log('Notification received:', notification);
    // Handle foreground notification display if needed
  }, []);

  /**
   * Handle notification response (when user taps on notification)
   */
  const handleNotificationResponse = useCallback((response: NotificationResponse) => {
    console.log('Notification tapped:', response);
    const data = response.notification.request.content.data;

    // Handle navigation based on notification data
    if (data?.type === 'booking_reminder') {
      // Navigate to booking details
      // router.push(`/bookings/${data.bookingId}`);
    } else if (data?.type === 'new_message') {
      // Navigate to conversation
      // router.push(`/messages/${data.conversationId}`);
    }
    // Add more notification types as needed
  }, []);

  // Register for notifications when user is authenticated
  useEffect(() => {
    if (user?.uid && userData) {
      registerAndSaveToken();
    }
  }, [user?.uid, userData, registerAndSaveToken]);

  // Set up notification listeners
  useEffect(() => {
    // Listener for notifications received while app is in foreground
    notificationListener.current = Notifications.addNotificationReceivedListener(handleNotification);

    // Listener for when user interacts with notification
    responseListener.current = Notifications.addNotificationResponseReceivedListener(handleNotificationResponse);

    return () => {
      if (notificationListener.current) {
        Notifications.removeNotificationSubscription(notificationListener.current);
      }
      if (responseListener.current) {
        Notifications.removeNotificationSubscription(responseListener.current);
      }
    };
  }, [handleNotification, handleNotificationResponse]);

  // Remove push token from previous account on logout or account switch
  useEffect(() => {
    const currentUid = user?.uid ?? null;
    const previousUid = previousUidRef.current;

    // User logged out or switched account: remove token from previous user
    if (previousUid && previousUid !== currentUid && currentTokenRef.current) {
      userRepository
        .removePushToken(previousUid, currentTokenRef.current)
        .then(() => console.log('Push token removed from previous user:', previousUid))
        .catch((err) => console.error('Error removing push token:', err));
      currentTokenRef.current = null;
    }

    previousUidRef.current = currentUid;
  }, [user?.uid]);

  return {
    registerAndSaveToken,
    currentToken: currentTokenRef.current,
  };
}
