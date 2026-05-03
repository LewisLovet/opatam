/**
 * Pro — Paiements & acomptes
 *
 * Opens the web settings page (`/pro/parametres?tab=paiements`) in an
 * in-app browser. Single source of truth for the Stripe Connect
 * onboarding + deposits configuration — keeping it web-side avoids
 * duplicating the (complex) UI state machine for KYC + add-on toggle +
 * default deposit % + stripe redirects on mobile.
 *
 * The in-app browser keeps the user inside Opatam (no jarring switch
 * to Safari / Chrome) and is dismissed when they tap "Done" or the
 * Stripe redirect comes back.
 */

import React, { useEffect, useState } from 'react';
import { View, StyleSheet, ActivityIndicator, Alert } from 'react-native';
import { useRouter } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';
import { useTheme } from '../../theme';
import { Text } from '../../components';

const BASE_URL = process.env.EXPO_PUBLIC_APP_URL ?? 'https://opatam.com';

export default function PaymentsRedirectScreen() {
  const { colors, spacing } = useTheme();
  const router = useRouter();
  const [opening, setOpening] = useState(true);

  useEffect(() => {
    let cancelled = false;

    async function open() {
      try {
        // Open the web Paiements section in an in-app browser. The
        // user might need to log in once here (the in-app browser has
        // its own cookie jar separate from the mobile Firebase
        // session). Once logged in the cookie persists for the next
        // open. We deliberately don't pass the Firebase ID token in
        // the URL — that would leak it into history/logs.
        const url = `${BASE_URL}/pro/parametres?tab=paiements`;
        await WebBrowser.openAuthSessionAsync(url, 'opatam://payments-return');
        if (cancelled) return;
        router.back();
      } catch (err) {
        console.error('[payments] in-app browser error:', err);
        if (!cancelled) {
          Alert.alert('Erreur', "Impossible d'ouvrir le portail de paiement.");
          router.back();
        }
      } finally {
        if (!cancelled) setOpening(false);
      }
    }

    open();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {opening && <ActivityIndicator size="large" color={colors.primary} />}
      <Text variant="body" color="textSecondary" style={{ marginTop: spacing.md }}>
        Ouverture du portail de paiement…
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
});
