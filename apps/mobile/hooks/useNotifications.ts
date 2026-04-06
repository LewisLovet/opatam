/**
 * useNotifications Hook
 * Handles push notification registration and token management
 */

import { useEffect, useRef, useCallback, useState } from 'react';
import * as Notifications from 'expo-notifications';
import { useRouter } from 'expo-router';
import { useAuth } from '../contexts/AuthContext';
import { userRepository } from '@booking-app/firebase';
import { registerForPushNotifications, getNotificationPermissionStatus } from '../utils/notifications';

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
  const router = useRouter();
  const currentTokenRef = useRef<string | null>(null);
  const previousUidRef = useRef<string | null>(null);
  const notificationListener = useRef<Notifications.Subscription | null>(null);
  const responseListener = useRef<Notifications.Subscription | null>(null);
  const [showPermissionPrompt, setShowPermissionPrompt] = useState(false);

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
    const data = response.notification.request.content.data;
    if (!data?.bookingId) return;

    const bookingId = data.bookingId as string;

    // Pro notifications → pro booking detail
    if (data.type === 'new_booking') {
      router.push(`/(pro)/booking-detail/${bookingId}`);
      return;
    }

    // Client notifications → client booking detail
    if (['booking_confirmed', 'booking_cancelled_by_provider', 'booking_rescheduled', 'booking_reminder'].includes(data.type as string)) {
      router.push(`/(client)/booking-detail/${bookingId}`);
      return;
    }

    // Provider cancelled by client → pro booking detail
    if (data.type === 'booking_cancelled_by_client') {
      router.push(`/(pro)/booking-detail/${bookingId}`);
      return;
    }

    // New review → pro reviews page
    if (data.type === 'new_review') {
      router.push('/(pro)/reviews');
      return;
    }

    // Subscription expiry / unpublished reminder → pro settings
    if (data.type === 'subscription_expiry' || data.type === 'unpublished_reminder') {
      router.push('/(pro)/paywall');
      return;
    }

    // Fallback
    router.push(`/(client)/booking-detail/${bookingId}`);
  }, [router]);

  // Check permission and show pre-prompt if needed
  useEffect(() => {
    if (!user?.uid || !userData) return;

    (async () => {
      const status = await getNotificationPermissionStatus();
      if (status === 'granted') {
        registerAndSaveToken();
      } else if (status === 'undetermined') {
        setShowPermissionPrompt(true);
      }
    })();
  }, [user?.uid, userData, registerAndSaveToken]);

  // Called when user accepts the pre-prompt
  const acceptNotifications = useCallback(async () => {
    setShowPermissionPrompt(false);
    await registerAndSaveToken();
  }, [registerAndSaveToken]);

  // Called when user declines the pre-prompt
  const declineNotifications = useCallback(() => {
    setShowPermissionPrompt(false);
  }, []);

  // Set up notification listeners
  useEffect(() => {
    // Listener for notifications received while app is in foreground
    notificationListener.current = Notifications.addNotificationReceivedListener(handleNotification);

    // Listener for when user interacts with notification
    responseListener.current = Notifications.addNotificationResponseReceivedListener(handleNotificationResponse);

    return () => {
      if (notificationListener.current) {
        notificationListener.current.remove();
      }
      if (responseListener.current) {
        responseListener.current.remove();
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
        .catch(() => { /* Ignore — document may have been deleted (account deletion) */ });
      currentTokenRef.current = null;
    }

    previousUidRef.current = currentUid;
  }, [user?.uid]);

  return {
    registerAndSaveToken,
    currentToken: currentTokenRef.current,
    showPermissionPrompt,
    acceptNotifications,
    declineNotifications,
  };
}
