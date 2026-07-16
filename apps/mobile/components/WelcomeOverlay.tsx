/**
 * WelcomeOverlay — celebratory full-screen overlay shown once, right after a
 * provider finishes registration. Mirrors the web WelcomeOverlay (confetti +
 * 🎉). Pure JS (react-native-confetti-cannon is Animated-based, no native
 * module), so it loads via Metro without an EAS rebuild.
 */

import React from 'react';
import { View, Modal, Pressable, Dimensions } from 'react-native';
import { useTranslation } from 'react-i18next';
import ConfettiCannon from 'react-native-confetti-cannon';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../theme';
import { Text } from './Text';

export function WelcomeOverlay({
  visible,
  onDismiss,
  businessName,
}: {
  visible: boolean;
  onDismiss: () => void;
  businessName?: string | null;
}) {
  const { colors, spacing, radius } = useTheme();
  const { t } = useTranslation();
  const { width } = Dimensions.get('window');

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onDismiss}>
      <View
        style={{
          flex: 1,
          backgroundColor: 'rgba(15, 23, 42, 0.55)',
          alignItems: 'center',
          justifyContent: 'center',
          padding: spacing.xl,
        }}
      >
        {/* Confetti — two bursts from the top corners */}
        {visible && (
          <>
            <ConfettiCannon
              count={120}
              origin={{ x: width * 0.1, y: -20 }}
              autoStart
              fadeOut
              explosionSpeed={350}
              fallSpeed={2800}
            />
            <ConfettiCannon
              count={120}
              origin={{ x: width * 0.9, y: -20 }}
              autoStart
              fadeOut
              explosionSpeed={350}
              fallSpeed={3000}
            />
          </>
        )}

        <View
          style={{
            width: '100%',
            maxWidth: 360,
            backgroundColor: colors.background,
            borderRadius: radius.xl,
            paddingVertical: spacing.xl,
            paddingHorizontal: spacing.lg,
            alignItems: 'center',
            gap: spacing.sm,
          }}
        >
          <Text style={{ fontSize: 56, lineHeight: 64 }}>🎉</Text>
          <Text variant="h2" align="center" style={{ fontWeight: '800' }}>
            {businessName
              ? t('components.welcomeOverlay.titleWithName', { businessName })
              : t('components.welcomeOverlay.title')}
          </Text>
          <Text variant="body" color="textSecondary" align="center" style={{ marginTop: 2 }}>
            {t('components.welcomeOverlay.subtitle')}
          </Text>

          <Pressable
            onPress={onDismiss}
            style={({ pressed }) => ({
              alignSelf: 'stretch',
              marginTop: spacing.md,
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'center',
              gap: spacing.xs,
              paddingVertical: spacing.md,
              borderRadius: 999,
              backgroundColor: colors.primary,
              opacity: pressed ? 0.9 : 1,
            })}
          >
            <Text variant="body" style={{ fontWeight: '700', color: '#FFFFFF' }}>
              {t('components.welcomeOverlay.cta')}
            </Text>
            <Ionicons name="arrow-forward" size={18} color="#FFFFFF" />
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}
