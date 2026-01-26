/**
 * MemberCard Component
 * Card for selecting a team member
 */

import React from 'react';
import { View, StyleSheet, Pressable } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../../theme';
import { Text } from '../../Text';
import { Avatar } from '../../Avatar';

export interface MemberCardProps {
  /** Member avatar URL */
  avatarURL?: string | null;
  /** Member name */
  name: string;
  /** Member role/specialty */
  role?: string | null;
  /** Whether this member is selected */
  selected: boolean;
  /** Press handler */
  onPress: () => void;
}

export function MemberCard({
  avatarURL,
  name,
  role,
  selected,
  onPress,
}: MemberCardProps) {
  const { colors, spacing, radius, shadows } = useTheme();

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.container,
        {
          padding: spacing.md,
          borderRadius: radius.lg,
          borderWidth: selected ? 2 : 1,
          borderColor: selected ? colors.primary : colors.border,
          backgroundColor: colors.surface,
          ...shadows.sm,
        },
        pressed && styles.pressed,
      ]}
    >
      <View style={[styles.content, { gap: spacing.md }]}>
        <Avatar
          size="md"
          name={name}
          imageUrl={avatarURL ?? undefined}
        />

        <View style={styles.info}>
          <Text variant="body" style={styles.name} numberOfLines={1}>
            {name}
          </Text>
          {role && (
            <Text variant="caption" color="textSecondary" numberOfLines={1}>
              {role}
            </Text>
          )}
        </View>

        {selected && (
          <View
            style={[
              styles.checkmark,
              {
                backgroundColor: colors.primary,
                borderRadius: radius.full,
                padding: 2,
              },
            ]}
          >
            <Ionicons name="checkmark" size={16} color={colors.textInverse} />
          </View>
        )}
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: {
    width: '100%',
  },
  content: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  info: {
    flex: 1,
  },
  name: {
    fontWeight: '600',
  },
  checkmark: {
    alignSelf: 'center',
  },
  pressed: {
    opacity: 0.9,
    transform: [{ scale: 0.99 }],
  },
});
