/**
 * TrialReminderBanner
 * Premium incitation card shown when the trial has ≤14 days remaining
 * (or is over). Urgency-based gradient + a clear white CTA button.
 * Tapping anywhere navigates to the paywall screen.
 */

import React from 'react';
import { View, Pressable, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { APP_CONFIG } from '@booking-app/shared/constants';
import { useTheme } from '../theme';
import { Text } from './Text';

interface TrialReminderBannerProps {
  daysRemaining: number;
}

export function TrialReminderBanner({ daysRemaining }: TrialReminderBannerProps) {
  const { spacing, radius } = useTheme();
  const router = useRouter();
  const { t } = useTranslation();

  // Only show when ≤14 days remaining
  if (daysRemaining > 14) return null;

  const isUrgent = daysRemaining <= 3;
  const isExpired = daysRemaining === 0;

  // Urgency-based gradient + the solid accent used for the CTA label.
  const gradient: [string, string] = isExpired
    ? ['#EF4444', '#E11D48']
    : isUrgent
      ? ['#F43F5E', '#F97316']
      : ['#F59E0B', '#F97316'];
  const accentColor = isExpired || isUrgent ? '#DC2626' : '#D97706';

  // Progress (remaining trial)
  const totalDays = APP_CONFIG.trialDays;
  const progress = Math.max(0, Math.min(1, daysRemaining / totalDays));

  return (
    <Pressable
      onPress={() => router.push('/(pro)/paywall')}
      style={({ pressed }) => [
        { borderRadius: radius.lg, overflow: 'hidden', opacity: pressed ? 0.92 : 1 },
      ]}
    >
      <LinearGradient
        colors={gradient}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={{ padding: spacing.md }}
      >
        {/* Header row */}
        <View style={styles.titleRow}>
          <View style={styles.iconCircle}>
            <Ionicons
              name={isExpired ? 'alert-circle' : 'time-outline'}
              size={20}
              color="#FFFFFF"
            />
          </View>
          <View style={{ flex: 1 }}>
            <Text variant="body" style={{ color: '#FFFFFF', fontWeight: '800' }}>
              {isExpired
                ? t('components.trialReminderBanner.expiredTitle')
                : t('components.trialReminderBanner.daysRemaining', { count: daysRemaining })}
            </Text>
            <Text variant="caption" style={{ color: 'rgba(255,255,255,0.9)', marginTop: 2 }}>
              {isExpired
                ? t('components.trialReminderBanner.expiredMessage')
                : t('components.trialReminderBanner.activeMessage')}
            </Text>
          </View>
        </View>

        {/* Progress bar (only while the trial is still running) */}
        {!isExpired && (
          <View style={[styles.progressTrack, { marginTop: spacing.sm }]}>
            <View style={[styles.progressBar, { width: `${progress * 100}%` }]} />
          </View>
        )}

        {/* CTA — white pill button with the accent-colored label */}
        <View style={[styles.cta, { marginTop: spacing.md }]}>
          <Text style={{ color: accentColor, fontWeight: '800', fontSize: 14 }}>
            {isExpired
              ? t('components.trialReminderBanner.reactivateCta')
              : t('components.trialReminderBanner.seeOffersCta')}
          </Text>
          <Ionicons name="arrow-forward" size={16} color={accentColor} />
        </View>
      </LinearGradient>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  iconCircle: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: 'rgba(255,255,255,0.22)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  progressTrack: {
    height: 5,
    backgroundColor: 'rgba(255,255,255,0.3)',
    borderRadius: 3,
    overflow: 'hidden',
  },
  progressBar: {
    height: 5,
    borderRadius: 3,
    backgroundColor: '#FFFFFF',
  },
  cta: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    paddingVertical: 11,
  },
});
