/**
 * OtaUpdateGate — applique la dernière mise à jour OTA dès le premier
 * lancement, au lieu du comportement expo-updates par défaut (bundle
 * embarqué au premier lancement, OTA appliquée seulement au démarrage
 * suivant → « il faut fermer/rouvrir l'app »).
 *
 * Au boot (prod uniquement) : checkForUpdateAsync (course avec un timeout
 * court — pas de réseau = pas d'attente), et SEULEMENT si une mise à jour
 * existe : splash animé plein écran pendant fetchUpdateAsync, puis
 * reloadAsync (rechargement JS immédiat, sans action utilisateur).
 * Au moindre pépin (timeout, erreur), on s'efface : l'app démarre
 * normalement et l'OTA s'appliquera au prochain lancement, comme avant.
 */

import React, { useEffect, useRef, useState } from 'react';
import { Animated, Easing, Image, StyleSheet, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import * as Updates from 'expo-updates';
import { useTranslation } from 'react-i18next';

const PRIMARY = '#1a6daf';
const PRIMARY_DARK = '#145a8f';
const APP_ICON = require('../assets/splash-icon.png');

const CHECK_TIMEOUT_MS = 5000; // check silencieux — au-delà, on laisse démarrer
const FETCH_TIMEOUT_MS = 15000; // téléchargement visible — au-delà, on s'efface

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return Promise.race([
    promise,
    new Promise<never>((_, reject) => setTimeout(() => reject(new Error('ota-timeout')), ms)),
  ]);
}

/** Logo sur anneaux pulsants — même langage visuel que l'UpdateGate. */
function PulsingLogo() {
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
              opacity: v.interpolate({ inputRange: [0, 0.15, 1], outputRange: [0, 0.4, 0] }),
              transform: [{ scale: v.interpolate({ inputRange: [0, 1], outputRange: [0.7, 2.2] }) }],
            },
          ]}
        />
      ))}
      <View style={styles.logoCard}>
        <Image source={APP_ICON} style={styles.logoImg} resizeMode="contain" />
      </View>
    </View>
  );
}

/** Trois points qui respirent en décalé, façon « ça travaille ». */
function LoadingDots() {
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

export function OtaUpdateGate() {
  const { t } = useTranslation();
  const [downloading, setDownloading] = useState(false);
  const fade = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    // Jamais en dev / dev-client : Updates n'y est pas actif.
    if (__DEV__ || !Updates.isEnabled) return;

    let cancelled = false;

    (async () => {
      try {
        const check = await withTimeout(Updates.checkForUpdateAsync(), CHECK_TIMEOUT_MS);
        if (cancelled || !check.isAvailable) return;

        setDownloading(true);
        Animated.timing(fade, { toValue: 1, duration: 200, useNativeDriver: true }).start();

        await withTimeout(Updates.fetchUpdateAsync(), FETCH_TIMEOUT_MS);
        if (cancelled) return;
        await Updates.reloadAsync();
      } catch {
        // Timeout ou erreur réseau : on laisse l'app démarrer telle quelle,
        // l'OTA téléchargée (ou pas) s'appliquera au prochain lancement.
        if (!cancelled) {
          Animated.timing(fade, { toValue: 0, duration: 200, useNativeDriver: true }).start(
            ({ finished }) => {
              if (finished && !cancelled) setDownloading(false);
            }
          );
        }
      }
    })();

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (!downloading) return null;

  return (
    <Animated.View style={[StyleSheet.absoluteFill, styles.overlay, { opacity: fade }]} pointerEvents="auto">
      <LinearGradient
        colors={[PRIMARY, PRIMARY_DARK]}
        style={StyleSheet.absoluteFill}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
      />
      <PulsingLogo />
      <Text style={styles.title}>{t('components.otaGate.title')}</Text>
      <Text style={styles.subtitle}>{t('components.otaGate.subtitle')}</Text>
      <LoadingDots />
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    zIndex: 9998, // sous l'UpdateGate bloquant (9999), au-dessus de tout le reste
    elevation: 9998,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 40,
  },
  logoWrap: {
    width: 150,
    height: 150,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 28,
  },
  ring: {
    position: 'absolute',
    width: 104,
    height: 104,
    borderRadius: 52,
    backgroundColor: '#FFFFFF',
  },
  logoCard: {
    width: 100,
    height: 100,
    borderRadius: 28,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#0B2A6B',
    shadowOpacity: 0.25,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: 10 },
    elevation: 10,
  },
  logoImg: {
    width: 78,
    height: 78,
  },
  title: {
    fontSize: 21,
    fontWeight: '800',
    color: '#FFFFFF',
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 15,
    lineHeight: 22,
    color: 'rgba(255,255,255,0.85)',
    textAlign: 'center',
    marginTop: 10,
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
