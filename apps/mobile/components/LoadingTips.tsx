/**
 * LoadingTips — full-screen branded loading state with a rotating "tip"
 * carousel. Turns dead loading time (account finalisation, data boot) into a
 * moment of value (reassurance + feature discovery) instead of a bare spinner.
 * Mirrors the web LoadingTips (same copy).
 */

import React, { useState, useEffect, useRef } from 'react';
import { View, ActivityIndicator, Animated } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useTheme } from '../theme';
import { Text } from './Text';

// Emojis stay code-side; the tip texts live in the dictionary
// (components.loadingTips.tips) and are zipped by index.
const TIP_EMOJIS = ['📅', '⏰', '💸', '🔗', '🧩', '⭐', '💯'];

export function LoadingTips({ message }: { message?: string }) {
  const { colors, spacing, radius } = useTheme();
  const { t } = useTranslation();
  const tipTexts = t('components.loadingTips.tips', { returnObjects: true }) as string[];
  const [i, setI] = useState(0);
  const fade = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const id = setInterval(() => setI((v) => (v + 1) % TIP_EMOJIS.length), 2800);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    fade.setValue(0);
    Animated.timing(fade, { toValue: 1, duration: 300, useNativeDriver: true }).start();
  }, [i, fade]);

  const tip = { emoji: TIP_EMOJIS[i], text: tipTexts[i] ?? '' };

  return (
    <View
      style={{
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: colors.background,
        padding: spacing.xl,
      }}
    >
      <ActivityIndicator size="large" color={colors.primary} />
      <Text variant="bodySmall" color="textSecondary" style={{ marginTop: spacing.md }}>
        {message ?? t('common.loading')}
      </Text>

      <View style={{ marginTop: spacing.xl, width: '100%', maxWidth: 360, alignSelf: 'center' }}>
        <Animated.View
          style={{
            opacity: fade,
            flexDirection: 'row',
            alignItems: 'flex-start',
            gap: spacing.sm,
            padding: spacing.md,
            borderRadius: radius.lg,
            backgroundColor: colors.surface ?? colors.surfaceSecondary,
            borderWidth: 1,
            borderColor: colors.border,
          }}
        >
          <Text style={{ fontSize: 22, lineHeight: 26 }}>{tip.emoji}</Text>
          <Text variant="bodySmall" color="textSecondary" style={{ flex: 1, lineHeight: 20 }}>
            {tip.text}
          </Text>
        </Animated.View>

        <View style={{ flexDirection: 'row', justifyContent: 'center', gap: 6, marginTop: spacing.md }}>
          {TIP_EMOJIS.map((_, idx) => (
            <View
              key={idx}
              style={{
                height: 6,
                borderRadius: 3,
                width: idx === i ? 20 : 6,
                backgroundColor: idx === i ? colors.primary : colors.border,
              }}
            />
          ))}
        </View>
      </View>
    </View>
  );
}
