/**
 * TrialReminderBanner
 * Shows a banner when trial has ≤7 days remaining, with urgency-based colors.
 * Tapping navigates to the paywall screen.
 */

import React from 'react';
import { View, Pressable, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { APP_CONFIG } from '@booking-app/shared/constants';
import { useTheme } from '../theme';
import { Text } from './Text';

interface TrialReminderBannerProps {
  daysRemaining: number;
}

export function TrialReminderBanner({ daysRemaining }: TrialReminderBannerProps) {
  const { colors, spacing, radius } = useTheme();
  const router = useRouter();

  // Only show when ≤7 days remaining
  if (daysRemaining > 7) return null;

  const isUrgent = daysRemaining <= 3;
  const isExpired = daysRemaining === 0;

  // Urgency-based colors
  const bgColor = isExpired || isUrgent ? '#FEF2F2' : '#FFFBEB';
  const accentColor = isExpired || isUrgent ? '#EF4444' : '#F59E0B';
  const textColor = isExpired || isUrgent ? '#991B1B' : '#92400E';

  // Progress
  const totalDays = APP_CONFIG.trialDays;
  const progress = Math.max(0, Math.min(1, daysRemaining / totalDays));

  return (
    <Pressable
      onPress={() => router.push('/(pro)/paywall')}
      style={({ pressed }) => [
        styles.container,
        {
          backgroundColor: bgColor,
          borderRadius: radius.lg,
          padding: spacing.md,
          borderLeftWidth: 4,
          borderLeftColor: accentColor,
          opacity: pressed ? 0.9 : 1,
        },
      ]}
    >
      <View style={styles.header}>
        <View style={styles.titleRow}>
          <Ionicons name="time-outline" size={18} color={accentColor} />
          <Text variant="bodySmall" style={{ color: textColor, fontWeight: '700', flex: 1 }}>
            {isExpired ? 'Essai terminé' : `${daysRemaining} jour${daysRemaining > 1 ? 's' : ''} restant${daysRemaining > 1 ? 's' : ''}`}
          </Text>
          <Ionicons name="chevron-forward" size={16} color={accentColor} />
        </View>

        {!isExpired && (
          <Text variant="caption" style={{ color: textColor, opacity: 0.8, marginTop: 4 }}>
            Activez votre abonnement pour continuer à recevoir des réservations
          </Text>
        )}

        {isExpired && (
          <Text variant="caption" style={{ color: textColor, opacity: 0.8, marginTop: 4 }}>
            Votre page n'est plus visible. Abonnez-vous pour la réactiver
          </Text>
        )}
      </View>

      {/* Progress bar */}
      {!isExpired && (
        <View style={[styles.progressTrack, { marginTop: spacing.sm }]}>
          <View
            style={[
              styles.progressBar,
              {
                backgroundColor: accentColor,
                width: `${progress * 100}%`,
              },
            ]}
          />
        </View>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: {},
  header: {},
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  progressTrack: {
    height: 4,
    backgroundColor: 'rgba(0,0,0,0.08)',
    borderRadius: 2,
    overflow: 'hidden',
  },
  progressBar: {
    height: 4,
    borderRadius: 2,
  },
});
