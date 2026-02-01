/**
 * Expo Push Notification Service
 * Handles sending push notifications via Expo's Push API
 */

import { Expo, ExpoPushMessage, ExpoPushTicket, ExpoPushReceipt } from 'expo-server-sdk';

// Create a new Expo SDK client
const expo = new Expo();

export interface PushNotificationPayload {
  title: string;
  body: string;
  data?: Record<string, unknown>;
  sound?: 'default' | null;
  badge?: number;
}

export interface SendNotificationResult {
  success: boolean;
  sentCount: number;
  failedCount: number;
  invalidTokens: string[];
  errors: string[];
}

/**
 * Send push notification to multiple Expo push tokens
 * @param tokens Array of Expo push tokens
 * @param payload Notification content
 * @returns Result with success/failure counts and invalid tokens
 */
export async function sendPushNotifications(
  tokens: string[],
  payload: PushNotificationPayload
): Promise<SendNotificationResult> {
  const result: SendNotificationResult = {
    success: true,
    sentCount: 0,
    failedCount: 0,
    invalidTokens: [],
    errors: [],
  };

  if (!tokens || tokens.length === 0) {
    result.success = false;
    result.errors.push('No push tokens provided');
    return result;
  }

  // Filter valid Expo push tokens
  const validTokens = tokens.filter((token) => {
    if (!Expo.isExpoPushToken(token)) {
      console.warn(`Invalid Expo push token: ${token}`);
      result.invalidTokens.push(token);
      return false;
    }
    return true;
  });

  if (validTokens.length === 0) {
    result.success = false;
    result.errors.push('No valid Expo push tokens');
    return result;
  }

  // Create the messages
  const messages: ExpoPushMessage[] = validTokens.map((token) => ({
    to: token,
    sound: payload.sound ?? 'default',
    title: payload.title,
    body: payload.body,
    data: payload.data,
    badge: payload.badge,
  }));

  // Chunk messages for batch sending (Expo recommends max 100 per batch)
  const chunks = expo.chunkPushNotifications(messages);
  const tickets: ExpoPushTicket[] = [];

  // Send all chunks
  for (const chunk of chunks) {
    try {
      const ticketChunk = await expo.sendPushNotificationsAsync(chunk);
      tickets.push(...ticketChunk);
    } catch (error) {
      console.error('Error sending push notification chunk:', error);
      result.errors.push(error instanceof Error ? error.message : 'Unknown error');
    }
  }

  // Process tickets to count successes and failures
  for (let i = 0; i < tickets.length; i++) {
    const ticket = tickets[i];
    if (ticket.status === 'ok') {
      result.sentCount++;
    } else if (ticket.status === 'error') {
      result.failedCount++;
      if (ticket.details?.error === 'DeviceNotRegistered') {
        // Token is no longer valid - should be removed from database
        result.invalidTokens.push(validTokens[i]);
      }
      result.errors.push(ticket.message || 'Unknown error');
    }
  }

  result.success = result.sentCount > 0;
  return result;
}

/**
 * Send push notification to a single user by their push tokens
 * @param tokens User's push tokens array
 * @param payload Notification content
 */
export async function sendNotificationToUser(
  tokens: string[],
  payload: PushNotificationPayload
): Promise<SendNotificationResult> {
  return sendPushNotifications(tokens, payload);
}

/**
 * Check push notification receipts
 * Used to verify delivery status after some time
 * @param receiptIds Array of receipt IDs from successful ticket responses
 */
export async function checkPushReceipts(receiptIds: string[]): Promise<{
  successful: string[];
  failed: string[];
  invalidTokens: string[];
}> {
  const result = {
    successful: [] as string[],
    failed: [] as string[],
    invalidTokens: [] as string[],
  };

  if (!receiptIds || receiptIds.length === 0) {
    return result;
  }

  const receiptIdChunks = expo.chunkPushNotificationReceiptIds(receiptIds);

  for (const chunk of receiptIdChunks) {
    try {
      const receipts = await expo.getPushNotificationReceiptsAsync(chunk);

      for (const [receiptId, receipt] of Object.entries(receipts)) {
        if (receipt.status === 'ok') {
          result.successful.push(receiptId);
        } else if (receipt.status === 'error') {
          result.failed.push(receiptId);
          if (receipt.details?.error === 'DeviceNotRegistered') {
            result.invalidTokens.push(receiptId);
          }
        }
      }
    } catch (error) {
      console.error('Error fetching push notification receipts:', error);
    }
  }

  return result;
}
