/**
 * Push Notifications Utilities
 * Handles Expo Push Notifications registration and permissions
 */

import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import { Platform } from 'react-native';

// Configure notification handler for foreground notifications
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

/**
 * Register for push notifications and get the Expo Push Token
 * @returns The Expo Push Token string or null if registration fails
 */
export async function registerForPushNotifications(): Promise<string | null> {
  // Push notifications only work on physical devices
  if (!Device.isDevice) {
    console.log('Push notifications require a physical device');
    return null;
  }

  try {
    // Check existing permissions
    const { status: existingStatus } = await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;

    // Request permissions if not already granted
    if (existingStatus !== 'granted') {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }

    // If permissions denied, return null
    if (finalStatus !== 'granted') {
      console.log('Push notification permission denied');
      return null;
    }

    // Set up Android notification channel
    if (Platform.OS === 'android') {
      await setupAndroidNotificationChannel();
    }

    // Get the Expo Push Token
    const tokenData = await Notifications.getExpoPushTokenAsync({
      projectId: process.env.EXPO_PUBLIC_PROJECT_ID,
    });

    return tokenData.data;
  } catch (error) {
    console.error('Error registering for push notifications:', error);
    return null;
  }
}

/**
 * Set up Android notification channel
 * Required for Android 8.0+ (API level 26+)
 */
async function setupAndroidNotificationChannel(): Promise<void> {
  await Notifications.setNotificationChannelAsync('default', {
    name: 'Notifications Opatam',
    importance: Notifications.AndroidImportance.MAX,
    vibrationPattern: [0, 250, 250, 250],
    lightColor: '#FF231F7C',
  });
}

/**
 * Get current notification permissions status
 * @returns The current permission status
 */
export async function getNotificationPermissionStatus(): Promise<Notifications.PermissionStatus> {
  const { status } = await Notifications.getPermissionsAsync();
  return status;
}

/**
 * Check if notifications are enabled
 * @returns true if notifications are granted
 */
export async function areNotificationsEnabled(): Promise<boolean> {
  const status = await getNotificationPermissionStatus();
  return status === 'granted';
}
