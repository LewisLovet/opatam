/**
 * ActivateLoyaltyButton
 *
 * Le CTA « Activer ma carte ». Volontairement plus travaillé que le Button
 * standard — c'est le geste que tout l'écran cherche à provoquer : dégradé
 * de la couleur primaire du thème, pilule bien arrondie, ombre portée douce,
 * icône de carte à gauche et léger enfoncement au toucher (natif).
 *
 * Toutes les couleurs viennent de `useTheme()` : le dégradé suit la couleur
 * primaire configurée, jamais une valeur en dur.
 */

import React from 'react';
import { useTranslation } from 'react-i18next';
import { Animated, Pressable, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../../theme';
import { Text } from '../../Text';

export interface ActivateLoyaltyButtonProps {
  onPress: () => void;
  /** true = pleine largeur (feuille d'activation) ; false = pilule compacte. */
  fullWidth?: boolean;
  /** Icône de gauche — une carte par défaut. */
  icon?: keyof typeof Ionicons.glyphMap;
}

export function ActivateLoyaltyButton({
  onPress,
  fullWidth = false,
  icon = 'card-outline',
}: ActivateLoyaltyButtonProps) {
  const { colors, spacing, radius } = useTheme();
  const { t } = useTranslation();

  const scale = React.useRef(new Animated.Value(1)).current;
  const springTo = (toValue: number) =>
    Animated.spring(scale, {
      toValue,
      useNativeDriver: true,
      damping: 15,
      stiffness: 300,
    }).start();

  return (
    <Animated.View
      style={{
        transform: [{ scale }],
        alignSelf: fullWidth ? 'stretch' : 'flex-start',
        borderRadius: radius.full,
        // Ombre portée douce, teintée de la couleur primaire.
        shadowColor: colors.primary,
        shadowOpacity: 0.32,
        shadowRadius: 10,
        shadowOffset: { width: 0, height: 4 },
        elevation: 5,
      }}
    >
      <Pressable
        onPress={onPress}
        onPressIn={() => springTo(0.96)}
        onPressOut={() => springTo(1)}
        style={{ borderRadius: radius.full, overflow: 'hidden' }}
      >
        <LinearGradient
          colors={[colors.primary, colors.primaryDark]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'center',
            gap: spacing.sm,
            paddingVertical: spacing.sm + 3,
            paddingHorizontal: spacing.lg,
          }}
        >
          <View
            style={{
              width: 24,
              height: 24,
              borderRadius: 12,
              alignItems: 'center',
              justifyContent: 'center',
              backgroundColor: 'rgba(255,255,255,0.18)',
            }}
          >
            <Ionicons name={icon} size={15} color="#FFFFFF" />
          </View>
          <Text variant="body" style={{ color: '#FFFFFF', fontWeight: '700' }}>
            {t('clientLoyalty.activation.activateButton')}
          </Text>
        </LinearGradient>
      </Pressable>
    </Animated.View>
  );
}
