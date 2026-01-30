/**
 * TimeSlotSection Component
 * Collapsible colored container for time slots grouped by period (morning/afternoon/evening)
 * Uses React Native Animated for smooth collapse/expand animations
 * Scrollable when there are many slots
 */

import React, { useRef, useEffect } from 'react';
import { View, StyleSheet, Pressable, Animated, ScrollView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../../theme';
import { Text } from '../../Text';

export interface TimeSlotSectionProps {
  /** Section title (e.g., "Matin", "Après-midi", "Soir") */
  title: string;
  /** Icon name from Ionicons */
  icon: keyof typeof Ionicons.glyphMap;
  /** Background color for the section */
  backgroundColor: string;
  /** Accent color for the icon and selected state */
  accentColor: string;
  /** Array of time strings */
  slots: string[];
  /** Whether section is expanded */
  isExpanded: boolean;
  /** Toggle expand/collapse */
  onToggle: () => void;
  /** Currently selected slot time */
  selectedSlot: string | null;
  /** Called when a slot is selected */
  onSelectSlot: (time: string) => void;
}

// Max rows before scrolling kicks in
const MAX_VISIBLE_ROWS = 3;
const ROW_HEIGHT = 52; // slot height + gap

export function TimeSlotSection({
  title,
  icon,
  backgroundColor,
  accentColor,
  slots,
  isExpanded,
  onToggle,
  selectedSlot,
  onSelectSlot,
}: TimeSlotSectionProps) {
  const { colors, spacing, radius } = useTheme();

  // Animation value for collapse/expand
  const animatedHeight = useRef(new Animated.Value(isExpanded ? 1 : 0)).current;
  const animatedRotation = useRef(new Animated.Value(isExpanded ? 1 : 0)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(animatedHeight, {
        toValue: isExpanded ? 1 : 0,
        duration: 250,
        useNativeDriver: false,
      }),
      Animated.timing(animatedRotation, {
        toValue: isExpanded ? 1 : 0,
        duration: 250,
        useNativeDriver: true,
      }),
    ]).start();
  }, [isExpanded, animatedHeight, animatedRotation]);

  // Chevron rotation interpolation
  const chevronRotation = animatedRotation.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '180deg'],
  });

  // Don't render section if no slots
  if (slots.length === 0) {
    return null;
  }

  // Calculate dimensions
  const numRows = Math.ceil(slots.length / 4);
  const needsScroll = numRows > MAX_VISIBLE_ROWS;
  const contentHeight = numRows * ROW_HEIGHT + spacing.md;
  const maxVisibleHeight = MAX_VISIBLE_ROWS * ROW_HEIGHT + spacing.md;
  const expandedHeight = needsScroll ? maxVisibleHeight : contentHeight;

  return (
    <View
      style={[
        styles.container,
        {
          backgroundColor,
          borderRadius: radius.xl,
          marginBottom: spacing.md,
          overflow: 'hidden',
        },
      ]}
    >
      {/* Header */}
      <Pressable
        onPress={onToggle}
        style={[
          styles.header,
          {
            paddingVertical: spacing.md,
            paddingHorizontal: spacing.md,
          },
        ]}
      >
        <View style={styles.headerLeft}>
          <View
            style={[
              styles.iconCircle,
              { backgroundColor: accentColor },
            ]}
          >
            <Ionicons name={icon} size={18} color="#FFFFFF" />
          </View>
          <View style={styles.titleContainer}>
            <Text variant="body" style={[styles.title, { color: accentColor }]}>
              {title}
            </Text>
            <Text variant="caption" style={{ color: accentColor, opacity: 0.7 }}>
              {slots.length} créneau{slots.length > 1 ? 'x' : ''}
            </Text>
          </View>
        </View>
        <Animated.View
          style={[
            styles.chevronContainer,
            {
              backgroundColor: accentColor + '20',
              transform: [{ rotate: chevronRotation }],
            },
          ]}
        >
          <Ionicons name="chevron-down" size={18} color={accentColor} />
        </Animated.View>
      </Pressable>

      {/* Slots Grid - Animated */}
      <Animated.View
        style={[
          styles.slotsOuterContainer,
          {
            height: animatedHeight.interpolate({
              inputRange: [0, 1],
              outputRange: [0, expandedHeight],
            }),
            opacity: animatedHeight,
          },
        ]}
      >
        <ScrollView
          nestedScrollEnabled
          showsVerticalScrollIndicator={needsScroll}
          scrollEnabled={needsScroll && isExpanded}
          contentContainerStyle={[
            styles.slotsScrollContent,
            { paddingHorizontal: spacing.md, paddingBottom: spacing.sm },
          ]}
        >
          <View style={[styles.slotsGrid, { gap: 8 }]}>
            {slots.map((time) => {
              const isSelected = selectedSlot === time;
              return (
                <Pressable
                  key={time}
                  onPress={() => onSelectSlot(time)}
                  style={({ pressed }) => [
                    styles.slot,
                    {
                      backgroundColor: isSelected ? accentColor : '#FFFFFF',
                      borderColor: isSelected ? accentColor : 'rgba(0,0,0,0.08)',
                      borderRadius: radius.md,
                      opacity: pressed ? 0.8 : 1,
                      shadowColor: '#000',
                      shadowOffset: { width: 0, height: 1 },
                      shadowOpacity: isSelected ? 0.15 : 0.05,
                      shadowRadius: 3,
                      elevation: isSelected ? 3 : 1,
                    },
                  ]}
                >
                  <Text
                    variant="body"
                    style={[
                      styles.slotText,
                      { color: isSelected ? '#FFFFFF' : colors.text },
                    ]}
                  >
                    {time}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </ScrollView>

        {/* Scroll indicator hint */}
        {needsScroll && isExpanded && (
          <View style={[styles.scrollHint, { backgroundColor: backgroundColor }]}>
            <View style={[styles.scrollHintBar, { backgroundColor: accentColor + '40' }]} />
          </View>
        )}
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 2,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  iconCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  titleContainer: {
    gap: 2,
  },
  title: {
    fontWeight: '700',
    fontSize: 15,
  },
  chevronContainer: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  slotsOuterContainer: {
    overflow: 'hidden',
  },
  slotsScrollContent: {
    flexGrow: 1,
  },
  slotsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  slot: {
    width: '23.5%',
    paddingVertical: 12,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
  },
  slotText: {
    fontWeight: '600',
    fontSize: 14,
  },
  scrollHint: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  scrollHintBar: {
    width: 40,
    height: 4,
    borderRadius: 2,
  },
});
