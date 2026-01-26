/**
 * MemberPicker Component
 * List of selectable team members
 */

import React from 'react';
import { View, StyleSheet, Pressable } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../../theme';
import { Text } from '../../Text';
import { MemberCard } from '../MemberCard';

export interface MemberPickerProps {
  /** Available members */
  members: Array<{
    id: string;
    avatarURL?: string | null;
    name: string;
    role?: string | null;
  }>;
  /** Currently selected member ID */
  selectedId: string | null;
  /** Called when a member is selected */
  onSelect: (id: string | null) => void;
  /** Whether to show "Any" option */
  allowAny?: boolean;
}

export function MemberPicker({
  members,
  selectedId,
  onSelect,
  allowAny = true,
}: MemberPickerProps) {
  const { colors, spacing, radius, shadows } = useTheme();

  return (
    <View style={[styles.container, { gap: spacing.sm }]}>
      {/* "Peu importe" option */}
      {allowAny && (
        <Pressable
          onPress={() => onSelect(null)}
          style={({ pressed }) => [
            styles.anyOption,
            {
              padding: spacing.md,
              borderRadius: radius.lg,
              borderWidth: selectedId === null ? 2 : 1,
              borderColor: selectedId === null ? colors.primary : colors.border,
              backgroundColor: colors.surface,
              ...shadows.sm,
            },
            pressed && styles.pressed,
          ]}
        >
          <View style={[styles.anyContent, { gap: spacing.md }]}>
            <View
              style={[
                styles.anyIcon,
                {
                  backgroundColor: colors.surfaceSecondary,
                  borderRadius: radius.full,
                  width: 40,
                  height: 40,
                },
              ]}
            >
              <Ionicons name="people" size={20} color={colors.textSecondary} />
            </View>

            <View style={styles.anyInfo}>
              <Text variant="body" style={styles.anyName}>
                Peu importe
              </Text>
              <Text variant="caption" color="textSecondary">
                Premier disponible
              </Text>
            </View>

            {selectedId === null && (
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
      )}

      {/* Member list */}
      {members.map((member) => (
        <MemberCard
          key={member.id}
          avatarURL={member.avatarURL}
          name={member.name}
          role={member.role}
          selected={selectedId === member.id}
          onPress={() => onSelect(member.id)}
        />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: '100%',
  },
  anyOption: {
    width: '100%',
  },
  anyContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  anyIcon: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  anyInfo: {
    flex: 1,
  },
  anyName: {
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
