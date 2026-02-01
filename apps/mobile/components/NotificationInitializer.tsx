/**
 * NotificationInitializer
 * Component that initializes push notifications
 * Must be rendered inside AuthProvider
 */

import { useNotifications } from '../hooks/useNotifications';

export function NotificationInitializer() {
  // Initialize push notifications
  useNotifications();

  // This component doesn't render anything
  return null;
}
