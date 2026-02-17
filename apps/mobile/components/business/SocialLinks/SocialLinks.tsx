/**
 * SocialLinks Component
 * Displays social media links with gradient buttons similar to web design
 */

import React from 'react';
import { View, ScrollView, Pressable, StyleSheet, Linking } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useTheme } from '../../../theme';
import { Text } from '../../Text/Text';
import type { SocialLinks as SocialLinksType } from '@booking-app/shared';

interface SocialLinksProps {
  links: SocialLinksType;
}

interface SocialConfig {
  key: keyof SocialLinksType;
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
  getUrl: (handle: string) => string;
  colors: [string, string, ...string[]];
  isGradient: boolean;
}

const socialConfig: SocialConfig[] = [
  {
    key: 'instagram',
    label: 'Instagram',
    icon: 'logo-instagram',
    getUrl: (handle: string) =>
      handle.startsWith('http') ? handle : `https://instagram.com/${handle.replace('@', '')}`,
    colors: ['#833AB4', '#FD1D1D', '#F77737'],
    isGradient: true,
  },
  {
    key: 'facebook',
    label: 'Facebook',
    icon: 'logo-facebook',
    getUrl: (handle: string) =>
      handle.startsWith('http') ? handle : `https://facebook.com/${handle}`,
    colors: ['#1877F2', '#1877F2'],
    isGradient: false,
  },
  {
    key: 'tiktok',
    label: 'TikTok',
    icon: 'logo-tiktok',
    getUrl: (handle: string) =>
      handle.startsWith('http') ? handle : `https://tiktok.com/@${handle.replace('@', '')}`,
    colors: ['#000000', '#000000'],
    isGradient: false,
  },
  {
    key: 'website',
    label: 'Site web',
    icon: 'globe-outline',
    getUrl: (url: string) => (url.startsWith('http') ? url : `https://${url}`),
    colors: ['#6B7280', '#6B7280'],
    isGradient: false,
  },
];

export function SocialLinks({ links }: SocialLinksProps) {
  const { spacing, radius } = useTheme();

  const activeLinks = socialConfig.filter((config) => links[config.key]);

  if (activeLinks.length === 0) return null;

  const handlePress = async (url: string) => {
    try {
      const canOpen = await Linking.canOpenURL(url);
      if (canOpen) {
        await Linking.openURL(url);
      }
    } catch (error) {
      console.error('Error opening URL:', error);
    }
  };

  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: spacing.sm }}>
      {activeLinks.map((config) => {
        const value = links[config.key];
        if (!value) return null;

        const url = config.getUrl(value);

        return (
          <Pressable
            key={config.key}
            onPress={() => handlePress(url)}
            style={({ pressed }) => [
              styles.buttonContainer,
              { opacity: pressed ? 0.8 : 1, transform: [{ scale: pressed ? 0.98 : 1 }] },
            ]}
          >
            {config.isGradient ? (
              <LinearGradient
                colors={config.colors}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={[styles.button, { borderRadius: radius.lg, paddingHorizontal: spacing.md, paddingVertical: spacing.sm }]}
              >
                <Ionicons name={config.icon} size={20} color="white" />
                <Text variant="body" style={styles.label}>
                  {config.label}
                </Text>
                <Ionicons name="open-outline" size={14} color="rgba(255,255,255,0.7)" />
              </LinearGradient>
            ) : (
              <View
                style={[
                  styles.button,
                  {
                    backgroundColor: config.colors[0],
                    borderRadius: radius.lg,
                    paddingHorizontal: spacing.md,
                    paddingVertical: spacing.sm,
                  },
                ]}
              >
                <Ionicons name={config.icon} size={20} color="white" />
                <Text variant="body" style={styles.label}>
                  {config.label}
                </Text>
                <Ionicons name="open-outline" size={14} color="rgba(255,255,255,0.7)" />
              </View>
            )}
          </Pressable>
        );
      })}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  buttonContainer: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
    elevation: 3,
  },
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  label: {
    color: 'white',
    fontWeight: '600',
    fontSize: 14,
  },
});
