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
import { Animated, Easing, Image, Platform, StyleSheet, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import * as Updates from 'expo-updates';
import { useTranslation } from 'react-i18next';

const PRIMARY = '#1a6daf';
const PRIMARY_DARK = '#145a8f';
// Même asset que le splash natif (app.json) : la reprise se fait sans
// couture — l'utilisateur perçoit une seule animation continue.
const APP_ICON = require('../assets/splash-icon-white.png');

const CHECK_TIMEOUT_MS = 5000; // check silencieux — au-delà, on laisse démarrer
const FETCH_TIMEOUT_MS = 15000; // téléchargement visible — au-delà, on s'efface

/**
 * Durée MINIMALE d'affichage une fois le splash apparu.
 *
 * Sur une bonne connexion, une petite OTA se télécharge en quelques
 * centaines de millisecondes : l'écran apparaissait et disparaissait
 * presque aussitôt, donnant un clignotement au lieu d'une transition. On
 * ne retarde jamais un démarrage SANS mise à jour — ce plancher ne
 * s'applique qu'une fois qu'on a décidé d'afficher quelque chose.
 */
const MIN_VISIBLE_MS = 2000;

/**
 * Taille du logo, ALIGNÉE sur le splash natif de `app.json`
 * (`splash.imageWidth` = 220 sur iOS, `android.splash.imageWidth` = 200).
 *
 * C'est la même image, affichée successivement par deux écrans : le
 * moindre écart de taille se lit comme un saut au moment où l'un prend
 * le relais de l'autre. Ces valeurs doivent bouger ENSEMBLE.
 */
const LOGO_SIZE = Platform.OS === 'ios' ? 220 : 200;
/** Anneaux légèrement plus petits que le logo, comme avant (ratio 104/120). */
const RING_SIZE = Math.round(LOGO_SIZE * 0.87);

// ── Aperçu dev-only ──────────────────────────────────────────────────
// Le gate ne se déclenche JAMAIS en dev (Updates désactivé) ; ce hook
// permet au DevFAB d'afficher le splash quelques secondes pour valider
// le rendu sur un vrai écran. Aucun effet en production.
let previewListener: ((ms: number) => void) | null = null;
/** Demande émise avant que le gate ne soit monté — rejouée à son montage.
 *  Sans ce tampon, un appui pendant un rechargement Fast Refresh ne
 *  produisait RIEN, sans le moindre message : le plus déroutant des
 *  comportements pour qui teste. */
let pendingPreviewMs: number | null = null;

export function previewOtaSplash(ms = 8000): void {
  if (previewListener) {
    previewListener(ms);
  } else {
    pendingPreviewMs = ms;
    console.log('[otaSplash] aperçu demandé avant montage — rejoué au montage');
  }
}

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

const PHRASE_ROTATE_MS = 2600;

/** Phrase d'ambiance qui tourne en fondu — on crée une atmosphère
 *  (« Nous préparons votre espace… ») plutôt que d'annoncer une MAJ. */
function RotatingPhrase() {
  const { t } = useTranslation();
  const phrases = [
    t('components.otaGate.phrase1'),
    t('components.otaGate.phrase2'),
    t('components.otaGate.phrase3'),
  ];
  const [index, setIndex] = useState(0);
  const opacity = useRef(new Animated.Value(1)).current;

  useEffect(() => {
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
  }, []);

  return (
    <Animated.Text style={[styles.title, { opacity }]}>{phrases[index]}</Animated.Text>
  );
}

export function OtaUpdateGate() {
  const [downloading, setDownloading] = useState(false);
  const fade = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    // Aperçu dev-only déclenché depuis le DevFAB.
    if (__DEV__) {
      const play = (ms: number) => {
        console.log(`[otaSplash] aperçu ${ms} ms`);
        setDownloading(true);
        Animated.timing(fade, { toValue: 1, duration: 200, useNativeDriver: true }).start();
        setTimeout(() => {
          Animated.timing(fade, { toValue: 0, duration: 300, useNativeDriver: true }).start(
            ({ finished }) => finished && setDownloading(false)
          );
        }, ms);
      };
      previewListener = play;
      if (pendingPreviewMs !== null) {
        const ms = pendingPreviewMs;
        pendingPreviewMs = null;
        play(ms);
      }
      return () => {
        previewListener = null;
      };
    }

    // Jamais hors prod : Updates n'y est pas actif.
    if (!Updates.isEnabled) return;

    let cancelled = false;

    (async () => {
      try {
        const check = await withTimeout(Updates.checkForUpdateAsync(), CHECK_TIMEOUT_MS);
        if (cancelled || !check.isAvailable) return;

        setDownloading(true);
        Animated.timing(fade, { toValue: 1, duration: 200, useNativeDriver: true }).start();
        const shownAt = Date.now();

        await withTimeout(Updates.fetchUpdateAsync(), FETCH_TIMEOUT_MS);
        if (cancelled) return;
        // Laisse l'animation exister : sans ce plancher, une petite OTA
        // sur bonne connexion produit un flash de 300 ms.
        const remaining = MIN_VISIBLE_MS - (Date.now() - shownAt);
        if (remaining > 0) await new Promise((r) => setTimeout(r, remaining));
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
      <RotatingPhrase />
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
