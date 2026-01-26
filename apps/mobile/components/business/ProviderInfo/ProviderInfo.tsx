/**
 * ProviderInfo Component
 * Info section for provider detail page
 * Design: Primary colored icons, clickable phone with background
 */

import React from 'react';
import { View, StyleSheet, Pressable, Linking } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../../theme';
import { Text } from '../../Text';
import { Divider } from '../../Divider';

export interface ProviderInfoProps {
  /** Business description */
  description: string | null;
  /** Street address */
  address: string;
  /** City */
  city: string;
  /** Phone number */
  phone: string | null;
}

export function ProviderInfo({
  description,
  address,
  city,
  phone,
}: ProviderInfoProps) {
  const { colors, spacing, radius } = useTheme();

  const handlePhonePress = () => {
    if (phone) {
      Linking.openURL(`tel:${phone}`);
    }
  };

  return (
    <View style={styles.container}>
      {/* Description */}
      {description && (
        <>
          <View style={[styles.section, { paddingVertical: spacing.md }]}>
            <Text variant="label" color="textSecondary" style={{ marginBottom: spacing.sm }}>
              À propos
            </Text>
            <Text variant="body" color="textSecondary">
              {description}
            </Text>
          </View>
          <Divider spacing={0} />
        </>
      )}

      {/* Address - combined on fewer lines */}
      <View style={[styles.section, { paddingVertical: spacing.md }]}>
        <View style={styles.row}>
          <Ionicons
            name="location-outline"
            size={20}
            color={colors.primary}
            style={{ marginRight: spacing.md }}
          />
          <View style={styles.textContainer}>
            <Text variant="body">{address}, {city}</Text>
          </View>
        </View>
      </View>

      {/* Phone - with clickable background */}
      {phone && (
        <>
          <Divider spacing={0} />
          <View style={[styles.section, { paddingVertical: spacing.md }]}>
            <View style={styles.row}>
              <Ionicons
                name="call-outline"
                size={20}
                color={colors.primary}
                style={{ marginRight: spacing.md }}
              />
              <Pressable
                onPress={handlePhonePress}
                style={({ pressed }) => [
                  styles.phoneButton,
                  {
                    backgroundColor: colors.primaryLight,
                    paddingHorizontal: spacing.sm,
                    paddingVertical: spacing.xs,
                    borderRadius: radius.sm,
                  },
                  pressed && { opacity: 0.7 },
                ]}
              >
                <Text variant="body" color="primary">
                  {phone}
                </Text>
              </Pressable>
            </View>
          </View>
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: '100%',
  },
  section: {
    // padding applied dynamically
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  textContainer: {
    flex: 1,
  },
  phoneButton: {
    // styles applied dynamically
  },
});
