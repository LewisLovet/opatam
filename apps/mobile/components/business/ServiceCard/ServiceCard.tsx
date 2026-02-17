/**
 * ServiceCard Component
 * Displays a service with name, description, duration and price
 * Design: colored left border, prominent name, price badge, duration with icon
 */

import React, { useState } from 'react';
import { View, StyleSheet, Pressable } from 'react-native';
import type { NativeSyntheticEvent, TextLayoutEventData } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../../theme';
import { Text } from '../../Text';

export interface ServiceCardProps {
  /** Service name */
  name: string;
  /** Service description */
  description?: string | null;
  /** Duration in minutes */
  duration: number;
  /** Price in euros */
  price: number;
  /** Whether this service is selected */
  selected?: boolean;
  /** Press handler */
  onPress?: () => void;
}

const LEFT_BORDER_WIDTH = 4;

function formatDuration(minutes: number): string {
  if (minutes < 60) {
    return `${minutes} min`;
  }
  const hours = Math.floor(minutes / 60);
  const remainingMinutes = minutes % 60;
  if (remainingMinutes === 0) {
    return `${hours}h`;
  }
  return `${hours}h${remainingMinutes}`;
}

function formatPrice(euros: number): string {
  if (euros === 0) return 'Gratuit';
  return euros % 1 === 0 ? `${euros} €` : `${euros.toFixed(2)} €`;
}

export function ServiceCard({
  name,
  description,
  duration,
  price,
  selected = false,
  onPress,
}: ServiceCardProps) {
  const { colors, spacing, radius, shadows } = useTheme();
  const [descExpanded, setDescExpanded] = useState(false);
  const [descClamped, setDescClamped] = useState(false);

  const content = (
    <View
      style={[
        styles.container,
        {
          borderRadius: radius.lg,
          borderWidth: 1,
          borderColor: selected ? colors.primary : colors.border,
          borderLeftWidth: LEFT_BORDER_WIDTH,
          borderLeftColor: colors.primary,
          backgroundColor: selected ? colors.primaryLight : colors.surface,
          ...shadows.sm,
        },
      ]}
    >
      <View style={[styles.content, { padding: spacing.md }]}>
        {/* Header: Name + Price Badge */}
        <View style={styles.header}>
          <Text variant="body" style={styles.name} numberOfLines={1}>
            {name}
          </Text>
          <View
            style={[
              styles.priceBadge,
              {
                backgroundColor: selected ? colors.primary : colors.primaryLight,
                paddingHorizontal: spacing.sm,
                paddingVertical: spacing.xs,
                borderRadius: radius.md,
              },
            ]}
          >
            <Text
              variant="bodySmall"
              style={[
                styles.priceText,
                { color: selected ? colors.textInverse : colors.primary },
              ]}
            >
              {formatPrice(price)}
            </Text>
          </View>
        </View>

        {/* Description */}
        {description && (
          <View style={{ marginTop: spacing.xs }}>
            {/* Hidden text without line limit to measure real line count */}
            {!descClamped && (
              <Text
                variant="caption"
                style={[styles.description, styles.hiddenMeasure]}
                onTextLayout={(e: NativeSyntheticEvent<TextLayoutEventData>) => {
                  if (e.nativeEvent.lines.length > 2) {
                    setDescClamped(true);
                  }
                }}
              >
                {description}
              </Text>
            )}
            <Text
              variant="caption"
              color="textMuted"
              numberOfLines={descExpanded ? undefined : 2}
              style={styles.description}
            >
              {description}
            </Text>
            {descClamped && (
              <Pressable
                onPress={(e) => {
                  e.stopPropagation();
                  setDescExpanded((v) => !v);
                }}
                hitSlop={8}
              >
                <Text
                  variant="caption"
                  style={{ color: colors.primary, marginTop: 2 }}
                >
                  {descExpanded ? 'Moins' : 'Plus de détails'}
                </Text>
              </Pressable>
            )}
          </View>
        )}

        {/* Footer: Duration with icon */}
        <View style={[styles.footer, { marginTop: spacing.sm }]}>
          <View style={styles.durationContainer}>
            <Ionicons
              name="time-outline"
              size={14}
              color={colors.textSecondary}
              style={{ marginRight: spacing.xs }}
            />
            <Text variant="caption" color="textSecondary">
              {formatDuration(duration)}
            </Text>
          </View>

          {/* Selection indicator */}
          {selected && (
            <Ionicons
              name="checkmark-circle"
              size={20}
              color={colors.primary}
            />
          )}
        </View>
      </View>
    </View>
  );

  if (onPress) {
    return (
      <Pressable
        onPress={onPress}
        style={({ pressed }) => [
          pressed && styles.pressed,
        ]}
      >
        {content}
      </Pressable>
    );
  }

  return content;
}

const styles = StyleSheet.create({
  container: {
    width: '100%',
    overflow: 'hidden',
  },
  content: {},
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  name: {
    fontWeight: '600',
    flex: 1,
    marginRight: 12,
  },
  priceBadge: {
    alignSelf: 'flex-start',
  },
  priceText: {
    fontWeight: '700',
  },
  description: {
    fontStyle: 'italic',
  },
  hiddenMeasure: {
    position: 'absolute',
    opacity: 0,
  },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  durationContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  pressed: {
    opacity: 0.9,
    transform: [{ scale: 0.98 }],
  },
});
