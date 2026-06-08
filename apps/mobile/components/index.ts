/**
 * Mobile UI Components - Main Export
 *
 * Usage:
 * import { Button, Text, Card } from '@/components';
 */

// Text
export { Text, type TextProps } from './Text';

// Button
export {
  Button,
  type ButtonProps,
  type ButtonVariant,
  type ButtonSize,
} from './Button';

// Input
export { Input, type InputProps } from './Input';

// Card
export { Card, type CardProps } from './Card';

// Badge
export {
  Badge,
  type BadgeProps,
  type BadgeVariant,
  type BadgeSize,
} from './Badge';

// Avatar
export { Avatar, type AvatarProps, type AvatarSize } from './Avatar';

// Divider
export { Divider, type DividerProps } from './Divider';

// Loader
export { Loader, Skeleton, type LoaderProps, type SkeletonProps } from './Loader';

// IconButton
export {
  IconButton,
  type IconButtonProps,
  type IconButtonVariant,
  type IconButtonSize,
} from './IconButton';

// Switch
export { Switch, type SwitchProps } from './Switch';

// DevFAB (development only)
export { DevFAB, ThemeConfigurator } from './DevFAB';

// ExpandableText
export { ExpandableText, type ExpandableTextProps } from './ExpandableText';

// Toast
export {
  Toast,
  ToastProvider,
  useToast,
  type ToastProps,
  type ToastVariant,
} from './Toast';

// LoadingScreen
export { LoadingScreen } from './LoadingScreen';

// Business Components
export * from './business';

// Notification Initializer
export { NotificationInitializer } from './NotificationInitializer';
export { NotificationPermissionPrompt } from './NotificationPermissionPrompt';

// Meta SDK — sync Firebase auth state into the SDK (Advanced Matching)
export { MetaAuthSync } from './MetaAuthSync';

// iOS App Tracking Transparency prompt
export { TrackingInitializer } from './TrackingInitializer';

// Location Initializer (priming for the foreground permission prompt)
export { LocationInitializer } from './LocationInitializer';
export { LocationPermissionPrompt } from './LocationPermissionPrompt';

// Logo
export { Logo, LogoWhite } from './Logo';

// Subscription Modals
export { SubscriptionRequiredModal } from './SubscriptionRequiredModal';
export { UpgradeToStudioModal } from './UpgradeToStudioModal';

// Trial Reminder
export { TrialReminderBanner } from './TrialReminderBanner';

// Update / maintenance gate (driven by Firestore config/mobile)
export { UpdateGate } from './UpdateGate';

// In-app notification center (pro)
export { NotificationsDrawer } from './NotificationsDrawer';
