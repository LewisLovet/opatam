/**
 * BrandSplash — la scène visuelle du démarrage, partagée.
 *
 * Deux écrans l'utilisent, pour deux raisons différentes :
 *  - `OtaUpdateGate`, pendant le téléchargement d'une mise à jour, avec
 *    ses phrases d'ambiance ;
 *  - `AppBootSplash`, quand l'app a encore besoin d'un instant après le
 *    splash natif — là où un `ActivityIndicator` nu cassait la
 *    continuité visuelle.
 *
 * Le même dégradé, le même logo, les mêmes anneaux : l'utilisateur perçoit
 * UNE animation continue depuis le splash natif, pas trois écrans qui se
 * succèdent. C'est aussi pourquoi la taille du logo est verrouillée sur
 * `splash.imageWidth` de `app.json` — tout écart se lit comme un saut.
 *
 * La scène est factorisée ICI plutôt que dupliquée : deux copies de la
 * même animation finissent toujours par diverger sur un détail.
 */

import React, { useEffect, useRef, useState } from 'react';
import { Animated, Easing, Image, Platform, StyleSheet, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';

export const SPLASH_PRIMARY = '#1a6daf';
export const SPLASH_PRIMARY_DARK = '#145a8f';

// Même asset que le splash natif (app.json) : la reprise se fait sans
// couture — l'utilisateur perçoit une seule animation continue.
const APP_ICON = require('../assets/splash-icon-white.png');

/**
 * Taille du logo, ALIGNÉE sur le splash natif de `app.json`
 * (`splash.imageWidth` = 220 sur iOS, `android.splash.imageWidth` = 200).
 * Ces valeurs doivent bouger ENSEMBLE.
 */
const LOGO_SIZE = Platform.OS === 'ios' ? 220 : 200;
/** Anneaux un peu plus petits que le logo (ratio d'origine 104/120). */
const RING_SIZE = Math.round(LOGO_SIZE * 0.87);

const PHRASE_ROTATE_MS = 2600;

/** Logo sur anneaux pulsants. */
export function PulsingLogo() {
  const rings = useRef([new Animated.Value(0), new Animated.Value(0), new Animated.Value(0)]).current;

  useEffect(() => {
    const loops = rings.map((v, i) =>
      Animated.loop(
        Animated.sequence([
          Animated.delay(i * 700),
          Animated.timing(v, {
            toValue: 1,
            duration: 2100,
            easing: Easing.out(Easing.ease),
            useNativeDriver: true,
          }),
        ])
      )
    );
    loops.forEach((l) => l.start());
    return () => loops.forEach((l) => l.stop());
  }, [rings]);

  return (
    <View style={styles.logoWrap}>
      {rings.map((v, i) => (
        <Animated.View
          key={i}
          pointerEvents="none"
          style={[
            styles.ring,
            {
              opacity: v.interpolate({ inputRange: [0, 0.15, 1], outputRange: [0, 0.22, 0] }),
              transform: [{ scale: v.interpolate({ inputRange: [0, 1], outputRange: [0.7, 2.2] }) }],
            },
          ]}
        />
      ))}
      <Image source={APP_ICON} style={styles.logoImg} resizeMode="contain" />
    </View>
  );
}

/** Trois points qui respirent en décalé, façon « ça travaille ». */
export function LoadingDots() {
  const dots = useRef([new Animated.Value(0), new Animated.Value(0), new Animated.Value(0)]).current;

  useEffect(() => {
    const loops = dots.map((v, i) =>
      Animated.loop(
        Animated.sequence([
          Animated.delay(i * 220),
          Animated.timing(v, { toValue: 1, duration: 420, useNativeDriver: true }),
          Animated.timing(v, { toValue: 0, duration: 420, useNativeDriver: true }),
          Animated.delay((2 - i) * 220),
        ])
      )
    );
    loops.forEach((l) => l.start());
    return () => loops.forEach((l) => l.stop());
  }, [dots]);

  return (
    <View style={styles.dotsRow}>
      {dots.map((v, i) => (
        <Animated.View
          key={i}
          style={[
            styles.dot,
            {
              opacity: v.interpolate({ inputRange: [0, 1], outputRange: [0.35, 1] }),
              transform: [{ translateY: v.interpolate({ inputRange: [0, 1], outputRange: [0, -6] }) }],
            },
          ]}
        />
      ))}
    </View>
  );
}

/** Phrase d'ambiance qui tourne en fondu. */
export function RotatingPhrase({ phrases }: { phrases: string[] }) {
  const [index, setIndex] = useState(0);
  const opacity = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    if (phrases.length <= 1) return;
    const interval = setInterval(() => {
      Animated.timing(opacity, { toValue: 0, duration: 350, useNativeDriver: true }).start(
        ({ finished }) => {
          if (!finished) return;
          setIndex((i) => (i + 1) % phrases.length);
          Animated.timing(opacity, { toValue: 1, duration: 350, useNativeDriver: true }).start();
        }
      );
    }, PHRASE_ROTATE_MS);
    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phrases.length]);

  if (!phrases.length) return null;
  return <Animated.Text style={[styles.title, { opacity }]}>{phrases[index]}</Animated.Text>;
}

export interface BrandSplashProps {
  /** Phrases d'ambiance. Vide = logo et points seuls (démarrage court). */
  phrases?: string[];
}

/** Fond dégradé + logo pulsant + phrase optionnelle + points. */
export function BrandSplash({ phrases = [] }: BrandSplashProps) {
  return (
    <>
      <LinearGradient
        colors={[SPLASH_PRIMARY, SPLASH_PRIMARY_DARK]}
        style={StyleSheet.absoluteFill}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
      />
      <PulsingLogo />
      <RotatingPhrase phrases={phrases} />
      <LoadingDots />
    </>
  );
}

export const splashStyles = StyleSheet.create({
  /** Conteneur plein écran centré, à combiner avec `absoluteFill`. */
  scene: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 40,
  },
});

const styles = StyleSheet.create({
  logoWrap: {
    width: LOGO_SIZE,
    height: LOGO_SIZE,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 28,
  },
  ring: {
    position: 'absolute',
    width: RING_SIZE,
    height: RING_SIZE,
    borderRadius: RING_SIZE / 2,
    backgroundColor: '#FFFFFF',
  },
  logoImg: {
    width: LOGO_SIZE,
    height: LOGO_SIZE,
  },
  title: {
    fontSize: 21,
    fontWeight: '800',
    color: '#FFFFFF',
    textAlign: 'center',
  },
  dotsRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 28,
  },
  dot: {
    width: 9,
    height: 9,
    borderRadius: 5,
    backgroundColor: '#FFFFFF',
  },
});
