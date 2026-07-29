/**
 * OtaUpdateGate — applique la dernière mise à jour OTA dès le premier
 * lancement, au lieu du comportement expo-updates par défaut (bundle
 * embarqué au premier lancement, OTA appliquée seulement au démarrage
 * suivant → « il faut fermer/rouvrir l'app »).
 *
 * Au boot (prod uniquement) : checkForUpdateAsync (course avec un timeout
 * court — pas de réseau = pas d'attente), et SEULEMENT si une mise à jour
 * existe : splash animé plein écran pendant fetchUpdateAsync, puis
 * reloadAsync (rechargement JS immédiat, sans action utilisateur). Le
 * décor vient de `BrandSplash`, partagé avec l'écran d'attente du
 * démarrage — même dégradé, même logo, pour que l'utilisateur perçoive
 * une seule séquence depuis le splash natif.
 * Au moindre pépin (timeout, erreur), on s'efface : l'app démarre
 * normalement et l'OTA s'appliquera au prochain lancement, comme avant.
 */

import React, { useEffect, useRef, useState } from 'react';
import { Animated, StyleSheet } from 'react-native';
import * as Updates from 'expo-updates';
import { useTranslation } from 'react-i18next';
import { BrandSplash, splashStyles } from './BrandSplash';

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

export function OtaUpdateGate() {
  const { t } = useTranslation();
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
    <Animated.View
      style={[StyleSheet.absoluteFill, splashStyles.scene, styles.overlay, { opacity: fade }]}
      pointerEvents="auto"
    >
      <BrandSplash
        phrases={[
          t('components.otaGate.phrase1'),
          t('components.otaGate.phrase2'),
          t('components.otaGate.phrase3'),
        ]}
      />
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    zIndex: 9998, // sous l'UpdateGate bloquant (9999), au-dessus de tout le reste
    elevation: 9998,
  },
});
