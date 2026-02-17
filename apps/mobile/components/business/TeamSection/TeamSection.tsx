/**
 * TeamSection Component
 * Displays team members in a 3-column grid with avatars and names
 */

import React from 'react';
import { View, StyleSheet, Dimensions } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../../theme';
import { Text } from '../../Text';
import { Avatar } from '../../Avatar';
import type { Member } from '@booking-app/shared';
import type { WithId } from '@booking-app/firebase';

export interface TeamSectionProps {
  members: WithId<Member>[];
}

const GAP = 12;
const GRID_COLUMNS = 3;

export function TeamSection({ members }: TeamSectionProps) {
  const { colors, spacing, radius } = useTheme();

  // Filter out the default system member
  const displayMembers = members.filter((member) => member.name !== 'Principal');

  if (displayMembers.length <= 1) return null;

  // Calculate item width for 3-column grid
  const screenWidth = Dimensions.get('window').width;
  const containerPadding = spacing.lg;
  const itemWidth =
    (screenWidth - containerPadding * 2 - GAP * (GRID_COLUMNS - 1)) /
    GRID_COLUMNS;

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={[styles.header, { gap: spacing.sm }]}>
        <Ionicons
          name="people-outline"
          size={20}
          color={colors.text}
        />
        <Text variant="h3">L'équipe</Text>
      </View>

      {/* Members Grid */}
      <View style={[styles.grid, { gap: GAP, marginTop: spacing.md }]}>
        {displayMembers.map((member) => (
          <View
            key={member.id}
            style={[
              styles.memberCard,
              {
                width: itemWidth,
                padding: spacing.sm,
                backgroundColor: colors.surfaceSecondary,
                borderRadius: radius.md,
              },
            ]}
          >
            <Avatar
              imageUrl={member.photoURL}
              name={member.name}
              size="lg"
            />
            <Text
              variant="caption"
              numberOfLines={1}
              style={{ marginTop: spacing.xs, textAlign: 'center' }}
            >
              {member.name}
            </Text>
          </View>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {},
  header: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  memberCard: {
    alignItems: 'center',
  },
});
