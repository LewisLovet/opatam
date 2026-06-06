/**
 * LoadingTips — full-screen branded loading state with a rotating "tip"
 * carousel. Turns dead loading time (account finalisation, data boot) into a
 * moment of value (reassurance + feature discovery) instead of a bare spinner.
 * Mirrors the web LoadingTips (same copy).
 */

import React, { useState, useEffect, useRef } from 'react';
import { View, ActivityIndicator, Animated } from 'react-native';
import { useTheme } from '../theme';
import { Text } from './Text';

const TIPS: { emoji: string; text: string }[] = [
  { emoji: '📅', text: 'Votre agenda est accessible par vos clients 24h/24, 7j/7.' },
  { emoji: '⏰', text: 'Les rappels automatiques réduisent fortement les rendez-vous manqués.' },
  { emoji: '💸', text: 'Un acompte « Sérénité » dissuade les no-shows et sécurise vos créneaux.' },
  { emoji: '🔗', text: 'Partagez votre lien de réservation sur Instagram, WhatsApp, votre vitrine…' },
  { emoji: '🧩', text: 'Ajoutez des variations et options : le client compose, le prix s’ajuste seul.' },
  { emoji: '⭐', text: 'Demandez un avis après chaque rendez-vous pour gagner en visibilité.' },
  { emoji: '💯', text: 'Sans commission : vous gardez 100 % de vos revenus.' },
];

export function LoadingTips({ message = 'Chargement…' }: { message?: string }) {
  const { colors, spacing, radius } = useTheme();
  const [i, setI] = useState(0);
  const fade = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const id = setInterval(() => setI((v) => (v + 1) % TIPS.length), 2800);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    fade.setValue(0);
    Animated.timing(fade, { toValue: 1, duration: 300, useNativeDriver: true }).start();
  }, [i, fade]);

  const tip = TIPS[i];

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
        {message}
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
          {TIPS.map((_, idx) => (
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
