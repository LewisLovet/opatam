/**
 * ServiceCategory Component
 * Groups services by category with optional collapse functionality
 * Features a refined header with animated chevron, accent bar, and tinted badge
 */

import React, { useEffect, useRef, useState } from 'react';
import {
  View,
  StyleSheet,
  Pressable,
  LayoutAnimation,
  Platform,
  UIManager,
  Animated,
  Easing,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../../theme';
import { Text } from '../../Text';
import { ServiceCard } from '../ServiceCard';

// Enable LayoutAnimation on Android
if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

export interface ServiceCategoryProps {
  /** Category title */
  title: string;
  /** Services in this category */
  services: Array<{
    id: string;
    name: string;
    description?: string | null;
    duration: number;
    price: number;
  }>;
  /** Currently selected service ID */
  selectedId?: string | null;
  /** Called when a service is selected */
  onSelectService?: (id: string) => void;
  /** Whether the category can be collapsed */
  collapsible?: boolean;
  /** Default expanded state */
  defaultExpanded?: boolean;
}

export function ServiceCategory({
  title,
  services,
  selectedId = null,
  onSelectService,
  collapsible = false,
  defaultExpanded = true,
}: ServiceCategoryProps) {
  const { colors, spacing, radius } = useTheme();
  const [isExpanded, setIsExpanded] = useState(defaultExpanded);

  // Chevron rotation animation using RN Animated
  const chevronAnim = useRef(new Animated.Value(defaultExpanded ? 1 : 0)).current;

  useEffect(() => {
    Animated.timing(chevronAnim, {
      toValue: isExpanded ? 1 : 0,
      duration: 260,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();
  }, [isExpanded, chevronAnim]);

  const chevronRotation = chevronAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '90deg'],
  });

  const toggleExpanded = () => {
    if (collapsible) {
      LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
      setIsExpanded(!isExpanded);
    }
  };

  return (
    <View style={styles.container}>
      {/* Header */}
      {collapsible ? (
        <Pressable
          onPress={toggleExpanded}
          style={({ pressed }) => [
            styles.header,
            {
              backgroundColor: pressed
                ? colors.border
                : colors.surfaceSecondary,
              borderRadius: radius.lg,
              paddingVertical: spacing.md,
              paddingHorizontal: spacing.lg,
              marginBottom: isExpanded ? spacing.md : 0,
            },
          ]}
        >
          {/* Accent bar */}
          <View
            style={[
              styles.accentBar,
              {
                backgroundColor: colors.primary,
                borderRadius: radius.full,
              },
            ]}
          />

          <View style={styles.headerContent}>
            <View style={styles.headerLeft}>
              <Text
                variant="h3"
                style={{ fontSize: 17, letterSpacing: 0.1 }}
              >
                {title}
              </Text>
            </View>

            <View style={styles.headerRight}>
              {/* Badge */}
              <View
                style={[
                  styles.badge,
                  {
                    backgroundColor: `${colors.primary}14`,
                    borderRadius: radius.full,
                  },
                ]}
              >
                <Text
                  variant="caption"
                  style={{
                    fontSize: 12,
                    fontWeight: '600',
                    color: colors.primary,
                  }}
                >
                  {services.length}
                </Text>
              </View>

              {/* Animated chevron */}
              <Animated.View style={{ transform: [{ rotate: chevronRotation }] }}>
                <Ionicons
                  name="chevron-forward"
                  size={16}
                  color={colors.textMuted}
                />
              </Animated.View>
            </View>
          </View>
        </Pressable>
      ) : (
        <View
          style={[
            styles.header,
            {
              backgroundColor: colors.surfaceSecondary,
              borderRadius: radius.lg,
              paddingVertical: spacing.md,
              paddingHorizontal: spacing.lg,
              marginBottom: spacing.md,
            },
          ]}
        >
          {/* Accent bar */}
          <View
            style={[
              styles.accentBar,
              {
                backgroundColor: colors.primary,
                borderRadius: radius.full,
              },
            ]}
          />

          <View style={styles.headerContent}>
            <View style={styles.headerLeft}>
              <Text
                variant="h3"
                style={{ fontSize: 17, letterSpacing: 0.1 }}
              >
                {title}
              </Text>
            </View>

            {/* Badge */}
            <View
              style={[
                styles.badge,
                {
                  backgroundColor: `${colors.primary}14`,
                  borderRadius: radius.full,
                },
              ]}
            >
              <Text
                variant="caption"
                style={{
                  fontSize: 12,
                  fontWeight: '600',
                  color: colors.primary,
                }}
              >
                {services.length}
              </Text>
            </View>
          </View>
        </View>
      )}

      {/* Services list */}
      {isExpanded && (
        <View style={[styles.servicesList, { gap: spacing.sm }]}>
          {services.map((service) => (
            <ServiceCard
              key={service.id}
              name={service.name}
              description={service.description}
              duration={service.duration}
              price={service.price}
              selected={selectedId === service.id}
              onPress={onSelectService ? () => onSelectService(service.id) : undefined}
            />
          ))}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: '100%',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    overflow: 'hidden',
  },
  accentBar: {
    width: 3,
    height: 20,
    marginRight: 12,
  },
  headerContent: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  badge: {
    minWidth: 24,
    height: 24,
    paddingHorizontal: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  servicesList: {
    width: '100%',
  },
});
