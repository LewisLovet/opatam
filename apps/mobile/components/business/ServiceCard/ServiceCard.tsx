/**
 * ServiceCard Component
 * Displays a service with name, description, duration and price
 * Design: colored left border, prominent name, price badge, duration with icon
 */

import React, { useState } from 'react';
import { View, StyleSheet, Pressable, Image, Modal, Dimensions } from 'react-native';
import type { NativeSyntheticEvent, TextLayoutEventData } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../../theme';
import { Text } from '../../Text';

export interface ServiceCardProps {
  /** Service name */
  name: string;
  /** Service description */
  description?: string | null;
  /** Photo URL */
  photoURL?: string | null;
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
  photoURL,
  duration,
  price,
  selected = false,
  onPress,
}: ServiceCardProps) {
  const { colors, spacing, radius, shadows } = useTheme();
  const [descExpanded, setDescExpanded] = useState(false);
  const [descClamped, setDescClamped] = useState(false);
  const [photoFullscreen, setPhotoFullscreen] = useState(false);

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
        {/* Top row: Photo + Name + Price */}
        <View style={{ flexDirection: 'row', alignItems: 'flex-start' }}>
          {photoURL && (
            <Pressable onPress={() => setPhotoFullscreen(true)} style={{ position: 'relative' }}>
              <Image
                source={{ uri: photoURL }}
                style={{
                  width: 56,
                  height: 56,
                  borderRadius: radius.md,
                  marginRight: spacing.sm,
                }}
                resizeMode="cover"
              />
              <View style={{
                position: 'absolute',
                bottom: 2,
                right: spacing.sm + 2,
                backgroundColor: 'rgba(0,0,0,0.45)',
                borderRadius: 4,
                padding: 2,
              }}>
                <Ionicons name="expand-outline" size={10} color="#fff" />
              </View>
            </Pressable>
          )}
          <View style={{ flex: 1 }}>
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

            {/* Duration */}
            <View style={[styles.durationContainer, { marginTop: spacing.xs }]}>
              <Ionicons
                name="time-outline"
                size={14}
                color={colors.textSecondary}
                style={{ marginRight: spacing.xs }}
              />
              <Text variant="caption" color="textSecondary">
                {formatDuration(duration)}
              </Text>
              {selected && (
                <Ionicons
                  name="checkmark-circle"
                  size={20}
                  color={colors.primary}
                  style={{ marginLeft: 'auto' }}
                />
              )}
            </View>
          </View>
        </View>

        {/* Description — below the photo+title row */}
        {description && (
          <View style={{ marginTop: spacing.sm }}>
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
      </View>
    </View>
  );

  const fullscreenModal = photoURL ? (
    <Modal visible={photoFullscreen} transparent animationType="fade">
      <Pressable
        onPress={() => setPhotoFullscreen(false)}
        style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.85)', justifyContent: 'center', alignItems: 'center' }}
      >
        <Pressable
          onPress={() => setPhotoFullscreen(false)}
          style={{ position: 'absolute', top: 50, right: 20, zIndex: 10 }}
        >
          <Ionicons name="close-circle" size={36} color="#fff" />
        </Pressable>
        <Image
          source={{ uri: photoURL }}
          style={{
            width: Dimensions.get('window').width - 40,
            height: Dimensions.get('window').width - 40,
            borderRadius: 12,
          }}
          resizeMode="contain"
        />
      </Pressable>
    </Modal>
  ) : null;

  if (onPress) {
    return (
      <>
        <Pressable
          onPress={onPress}
          style={({ pressed }) => [
            pressed && styles.pressed,
          ]}
        >
          {content}
        </Pressable>
        {fullscreenModal}
      </>
    );
  }

  return (
    <>
      {content}
      {fullscreenModal}
    </>
  );
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
