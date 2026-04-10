/**
 * NotificationInitializer
 * Component that initializes push notifications.
 * Shows a friendly pre-prompt before the system permission dialog.
 * Must be rendered inside AuthProvider.
 */

import { useNotifications } from '../hooks/useNotifications';
import { NotificationPermissionPrompt } from './NotificationPermissionPrompt';

export function NotificationInitializer() {
  const {
    showPermissionPrompt,
    acceptNotifications,
    declineNotifications,
  } = useNotifications();

  return (
    <NotificationPermissionPrompt
      visible={showPermissionPrompt}
      onAccept={acceptNotifications}
      onDecline={declineNotifications}
    />
  );
}
