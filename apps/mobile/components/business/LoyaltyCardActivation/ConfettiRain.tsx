/**
 * ConfettiRain
 * Pluie de confettis maison : ~20 rectangles colorés qui tombent (~1,5 s).
 * Volontairement sans lib externe — Animated + useNativeDriver suffisent.
 *
 * Extrait de l'écran Fidélité pour être rejoué à l'identique partout où la
 * carte peut être activée (espace fidélité ET page prestataire).
 */

import React from 'react';
import { View, StyleSheet, Animated, type DimensionValue } from 'react-native';
import { useTheme } from '../../../theme';

export interface ConfettiRainProps {
  /** Appelé quand la dernière particule a fini de tomber. */
  onDone: () => void;
}

export function ConfettiRain({ onDone }: ConfettiRainProps) {
  const { colors } = useTheme();
  const palette = [colors.primary, '#F59E0B', '#10B981', '#EC4899'];
  const particles = React.useRef(
    Array.from({ length: 20 }, (_, i) => ({
      anim: new Animated.Value(0),
      left: `${5 + Math.random() * 90}%` as DimensionValue,
      delay: Math.random() * 400,
      drift: (Math.random() - 0.5) * 60,
      spin: (Math.random() - 0.5) * 720,
      size: 5 + Math.random() * 6,
      colorIdx: i % 4,
    })),
  ).current;

  React.useEffect(() => {
    Animated.parallel(
      particles.map((p) =>
        Animated.timing(p.anim, {
          toValue: 1,
          duration: 1100,
          delay: p.delay,
          useNativeDriver: true,
        }),
      ),
    ).start(({ finished }) => {
      if (finished) onDone();
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill}>
      {particles.map((p, i) => (
        <Animated.View
          key={i}
          style={{
            position: 'absolute',
            top: -12,
            left: p.left,
            width: p.size,
            height: p.size * 1.7,
            borderRadius: 2,
            backgroundColor: palette[p.colorIdx],
            opacity: p.anim.interpolate({ inputRange: [0, 0.7, 1], outputRange: [1, 1, 0] }),
            transform: [
              { translateY: p.anim.interpolate({ inputRange: [0, 1], outputRange: [0, 170] }) },
              { translateX: p.anim.interpolate({ inputRange: [0, 1], outputRange: [0, p.drift] }) },
              {
                rotate: p.anim.interpolate({
                  inputRange: [0, 1],
                  outputRange: ['0deg', `${p.spin}deg`],
                }),
              },
            ],
          }}
        />
      ))}
    </View>
  );
}
