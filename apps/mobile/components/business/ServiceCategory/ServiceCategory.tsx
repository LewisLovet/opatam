/**
 * ServiceCategory Component
 * Groups services by category with optional collapse functionality
 */

import React, { useState } from 'react';
import { View, StyleSheet, Pressable, LayoutAnimation, Platform, UIManager } from 'react-native';
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
  const { colors, spacing } = useTheme();
  const [isExpanded, setIsExpanded] = useState(defaultExpanded);

  const toggleExpanded = () => {
    if (collapsible) {
      LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
      setIsExpanded(!isExpanded);
    }
  };

  const HeaderComponent = collapsible ? Pressable : View;

  return (
    <View style={styles.container}>
      <HeaderComponent
        onPress={collapsible ? toggleExpanded : undefined}
        style={[styles.header, { marginBottom: spacing.md }]}
      >
        <Text variant="h3">{title}</Text>
        {collapsible && (
          <Ionicons
            name={isExpanded ? 'chevron-up' : 'chevron-down'}
            size={20}
            color={colors.textSecondary}
          />
        )}
      </HeaderComponent>

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
    justifyContent: 'space-between',
  },
  servicesList: {
    width: '100%',
  },
});
