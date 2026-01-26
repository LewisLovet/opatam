/**
 * EmptyState Component
 * Centered empty state with icon, title, description and optional action
 * Design: White background with dashed border, primary colored icon
 */

import React from 'react';
import { View, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../../theme';
import { Text } from '../../Text';
import { Button } from '../../Button';

export interface EmptyStateProps {
  /** Icon name from Ionicons */
  icon: keyof typeof Ionicons.glyphMap;
  /** Title text */
  title: string;
  /** Optional description */
  description?: string;
  /** Optional action button label */
  actionLabel?: string;
  /** Optional action handler */
  onAction?: () => void;
}

export function EmptyState({
  icon,
  title,
  description,
  actionLabel,
  onAction,
}: EmptyStateProps) {
  const { colors, spacing, radius } = useTheme();

  return (
    <View
      style={[
        styles.container,
        {
          padding: spacing.xl,
          backgroundColor: colors.surface,
          borderRadius: radius.lg,
          borderWidth: 1,
          borderStyle: 'dashed',
          borderColor: colors.border,
        },
      ]}
    >
      {/* Icon - larger and primary colored */}
      <View style={[styles.iconContainer, { marginBottom: spacing.md }]}>
        <Ionicons
          name={icon}
          size={64}
          color={colors.primary}
          style={{ opacity: 0.6 }}
        />
      </View>

      {/* Title */}
      <Text
        variant="h3"
        align="center"
        style={{ marginBottom: spacing.xs }}
      >
        {title}
      </Text>

      {/* Description */}
      {description && (
        <Text
          variant="body"
          color="textSecondary"
          align="center"
          style={{ marginBottom: actionLabel && onAction ? spacing.md : 0 }}
        >
          {description}
        </Text>
      )}

      {/* Action Button */}
      {actionLabel && onAction && (
        <Button
          title={actionLabel}
          onPress={onAction}
          variant="outline"
          size="sm"
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  iconContainer: {
    justifyContent: 'center',
    alignItems: 'center',
  },
});
