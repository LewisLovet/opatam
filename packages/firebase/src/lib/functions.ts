/**
 * Firebase Cloud Functions client configuration
 */

import { getFunctions, httpsCallable, type Functions, type HttpsCallableResult } from 'firebase/functions';
import { getFirebaseApp } from './config';

/**
 * Get Firebase Functions instance
 */
export function getFirebaseFunctions(): Functions {
  // Default region is us-central1 (same as Cloud Functions default)
  return getFunctions(getFirebaseApp());
}

/**
 * Firebase Functions instance (singleton)
 */
export const functions = getFirebaseFunctions();

// ============================================
// Callable Functions
// ============================================

/**
 * Test push notification response
 */
export interface TestPushNotificationResponse {
  success: boolean;
  message: string;
  details: {
    sentCount: number;
    failedCount: number;
    invalidTokens: string[];
  };
}

/**
 * Test push notification request
 */
export interface TestPushNotificationRequest {
  userId: string;
  title?: string;
  body?: string;
}

/**
 * Call testPushNotification Cloud Function
 */
export async function callTestPushNotification(
  data: TestPushNotificationRequest
): Promise<TestPushNotificationResponse> {
  const callable = httpsCallable<TestPushNotificationRequest, TestPushNotificationResponse>(
    functions,
    'testPushNotification'
  );
  const result: HttpsCallableResult<TestPushNotificationResponse> = await callable(data);
  return result.data;
}

// Re-export for convenience
export { httpsCallable, type Functions, type HttpsCallableResult };
