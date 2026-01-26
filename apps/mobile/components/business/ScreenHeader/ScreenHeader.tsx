/**
 * ScreenHeader Component
 * Fixed header with title and optional left/right actions
 * Design: White background with subtle shadow for separation
 */

import React from 'react';
import { View, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../../../theme';
import { Text } from '../../Text';
import { IconButton } from '../../IconButton';

export interface ScreenHeaderAction {
  /** Icon element */
  icon: React.ReactNode;
  /** Press handler */
  onPress: () => void;
  /** Accessibility label */
  accessibilityLabel?: string;
}

export interface ScreenHeaderProps {
  /** Header title */
  title: string;
  /** Left action button */
  leftAction?: ScreenHeaderAction;
  /** Right action button */
  rightAction?: ScreenHeaderAction;
  /** Whether to include safe area padding at top */
  safeArea?: boolean;
}

const HEADER_HEIGHT = 56;

export function ScreenHeader({
  title,
  leftAction,
  rightAction,
  safeArea = true,
}: ScreenHeaderProps) {
  const { colors, spacing, shadows } = useTheme();
  const insets = useSafeAreaInsets();

  return (
    <View
      style={[
        styles.container,
        shadows.sm,
        {
          paddingTop: safeArea ? insets.top : 0,
          backgroundColor: colors.surface,
        },
      ]}
    >
      <View
        style={[
          styles.header,
          {
            height: HEADER_HEIGHT,
            paddingHorizontal: spacing.sm,
          },
        ]}
      >
        {/* Left Action */}
        <View style={styles.actionContainer}>
          {leftAction && (
            <IconButton
              icon={leftAction.icon}
              onPress={leftAction.onPress}
              variant="ghost"
              accessibilityLabel={leftAction.accessibilityLabel}
            />
          )}
        </View>

        {/* Title */}
        <Text variant="h3" numberOfLines={1} style={styles.title}>
          {title}
        </Text>

        {/* Right Action */}
        <View style={styles.actionContainer}>
          {rightAction && (
            <IconButton
              icon={rightAction.icon}
              onPress={rightAction.onPress}
              variant="ghost"
              accessibilityLabel={rightAction.accessibilityLabel}
            />
          )}
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: '100%',
    zIndex: 10,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  actionContainer: {
    width: 48,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    flex: 1,
    textAlign: 'center',
  },
});
