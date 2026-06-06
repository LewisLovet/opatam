import { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Linking,
  Platform,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Application from 'expo-application';
import { db, doc, onSnapshot } from '@booking-app/firebase';
import type { MobileAppConfig } from '@booking-app/shared';

/**
 * Blocking gate driven by the Firestore `config/mobile` document
 * (edited from the admin back-office at /admin/app).
 *
 * Two block modes, both non-dismissable and rendered as a full-screen
 * absolute overlay ON TOP of the whole app:
 *   - maintenance: the app is unavailable for everyone.
 *   - forceUpdate + installed version < minSupportedVersion: the user
 *     must update from the store before continuing.
 *
 * Fails OPEN: any read error / missing doc leaves the app fully usable.
 */

type Block =
  | { kind: 'maintenance'; message?: string | null }
  | {
      kind: 'update';
      message?: string | null;
      iosStoreUrl?: string | null;
      androidStoreUrl?: string | null;
    }
  | null;

/** Compare two "x.y.z" strings. Returns -1, 0 or 1 (a vs b). */
function compareVersions(a: string, b: string): number {
  const pa = a.split('.').map((n) => parseInt(n, 10) || 0);
  const pb = b.split('.').map((n) => parseInt(n, 10) || 0);
  const len = Math.max(pa.length, pb.length);
  for (let i = 0; i < len; i++) {
    const x = pa[i] ?? 0;
    const y = pb[i] ?? 0;
    if (x > y) return 1;
    if (x < y) return -1;
  }
  return 0;
}

export function UpdateGate() {
  const [block, setBlock] = useState<Block>(null);

  useEffect(() => {
    const installed = Application.nativeApplicationVersion ?? '0.0.0';

    const ref = doc(db, 'config', 'mobile');
    const unsub = onSnapshot(
      ref,
      (snap) => {
        if (!snap.exists()) {
          setBlock(null);
          return;
        }
        const cfg = snap.data() as MobileAppConfig;

        if (cfg.maintenance) {
          setBlock({ kind: 'maintenance', message: cfg.message });
          return;
        }

        const min = cfg.minSupportedVersion || '0.0.0';
        if (cfg.forceUpdate && compareVersions(installed, min) < 0) {
          setBlock({
            kind: 'update',
            message: cfg.message,
            iosStoreUrl: cfg.iosStoreUrl,
            androidStoreUrl: cfg.androidStoreUrl,
          });
          return;
        }

        setBlock(null);
      },
      // Fail open on any permission / network error.
      () => setBlock(null)
    );

    return unsub;
  }, []);

  if (!block) return null;

  const isMaintenance = block.kind === 'maintenance';

  const openStore = () => {
    const url =
      Platform.OS === 'ios'
        ? block.kind === 'update'
          ? block.iosStoreUrl
          : null
        : block.kind === 'update'
          ? block.androidStoreUrl
          : null;
    if (url) {
      void Linking.openURL(url);
    }
  };

  const hasStoreUrl =
    block.kind === 'update' &&
    (Platform.OS === 'ios' ? !!block.iosStoreUrl : !!block.androidStoreUrl);

  return (
    <View style={styles.overlay} pointerEvents="auto">
      <View style={styles.card}>
        <View style={[styles.iconCircle, isMaintenance && styles.iconCircleMaint]}>
          <Ionicons
            name={isMaintenance ? 'construct' : 'rocket'}
            size={36}
            color={isMaintenance ? '#2563EB' : '#3B82F6'}
          />
        </View>

        <Text style={styles.title}>
          {isMaintenance ? 'Maintenance en cours' : 'Mise à jour requise'}
        </Text>

        <Text style={styles.message}>
          {block.message ||
            (isMaintenance
              ? "Opatam est temporairement indisponible. Merci de réessayer dans quelques instants."
              : "Une nouvelle version d'Opatam est disponible. Mettez à jour l'application pour continuer.")}
        </Text>

        {isMaintenance ? (
          <ActivityIndicator color="#3B82F6" style={{ marginTop: 24 }} />
        ) : hasStoreUrl ? (
          <TouchableOpacity style={styles.button} onPress={openStore} activeOpacity={0.85}>
            <Ionicons name="download-outline" size={20} color="#fff" />
            <Text style={styles.buttonText}>Mettre à jour</Text>
          </TouchableOpacity>
        ) : (
          <Text style={styles.hint}>
            Rendez-vous sur {Platform.OS === 'ios' ? "l'App Store" : 'Google Play'} pour
            installer la dernière version.
          </Text>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 28,
    zIndex: 9999,
    elevation: 9999,
  },
  card: {
    width: '100%',
    maxWidth: 380,
    alignItems: 'center',
  },
  iconCircle: {
    width: 84,
    height: 84,
    borderRadius: 42,
    backgroundColor: '#EFF6FF',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 24,
  },
  iconCircleMaint: {
    backgroundColor: '#EFF6FF',
  },
  title: {
    fontSize: 22,
    fontWeight: '700',
    color: '#111827',
    textAlign: 'center',
    marginBottom: 12,
  },
  message: {
    fontSize: 15,
    lineHeight: 22,
    color: '#6B7280',
    textAlign: 'center',
  },
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#3B82F6',
    paddingHorizontal: 28,
    paddingVertical: 15,
    borderRadius: 14,
    marginTop: 28,
    width: '100%',
  },
  buttonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  hint: {
    fontSize: 14,
    color: '#9CA3AF',
    textAlign: 'center',
    marginTop: 24,
  },
});
