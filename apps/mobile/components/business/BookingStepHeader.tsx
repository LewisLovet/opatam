/**
 * BookingStepHeader — the blue top bar used across the client booking flow
 * (member → choices → date → confirm). The client layout sets the status bar
 * to "light" (white icons), so the safe-area top must be a dark/primary colour
 * for the icons to be legible and to stay consistent with the rest of the app.
 */

import React from 'react';
import { View, Pressable } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../theme';
import { Text } from '../Text';

export function BookingStepHeader({
  title,
  onBack,
}: {
  title: string;
  onBack: () => void;
}) {
  const { colors, spacing, radius } = useTheme();
  const insets = useSafeAreaInsets();
  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        paddingTop: insets.top + spacing.md,
        paddingBottom: spacing.md,
        paddingHorizontal: spacing.lg,
        backgroundColor: colors.primary,
      }}
    >
      <Pressable
        onPress={onBack}
        style={{
          width: 44,
          height: 44,
          justifyContent: 'center',
          alignItems: 'center',
          backgroundColor: 'rgba(255,255,255,0.2)',
          borderRadius: radius.full,
        }}
      >
        <Ionicons name="chevron-back" size={24} color="#FFFFFF" />
      </Pressable>
      <Text
        variant="h2"
        style={{ flex: 1, textAlign: 'center', color: '#FFFFFF' }}
        numberOfLines={1}
      >
        {title}
      </Text>
      <View style={{ width: 44 }} />
    </View>
  );
}
