import { useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Linking,
  Platform,
  ActivityIndicator,
  Image,
  ScrollView,
  Animated,
  Easing,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
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

const BLUE = '#3B82F6';
const APP_ICON = require('../assets/icon.png');

type ReleaseNotes = { features: string[]; fixes: string[] };

type Block =
  | { kind: 'maintenance'; message?: string | null }
  | {
      kind: 'update';
      message?: string | null;
      latestVersion?: string | null;
      notes: ReleaseNotes;
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

/** App logo over animated, looping pulse rings — keeps the screen alive. */
function PulsingLogo() {
  const rings = useRef([new Animated.Value(0), new Animated.Value(0), new Animated.Value(0)]).current;
  const float = useRef(new Animated.Value(0)).current;

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
    const floatLoop = Animated.loop(
      Animated.sequence([
        Animated.timing(float, {
          toValue: 1,
          duration: 1800,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(float, {
          toValue: 0,
          duration: 1800,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
      ])
    );
    loops.forEach((l) => l.start());
    floatLoop.start();
    return () => {
      loops.forEach((l) => l.stop());
      floatLoop.stop();
    };
  }, [rings, float]);

  const translateY = float.interpolate({ inputRange: [0, 1], outputRange: [0, -8] });

  return (
    <View style={styles.logoWrap}>
      {rings.map((v, i) => (
        <Animated.View
          key={i}
          pointerEvents="none"
          style={[
            styles.ring,
            {
              opacity: v.interpolate({ inputRange: [0, 0.15, 1], outputRange: [0, 0.45, 0] }),
              transform: [{ scale: v.interpolate({ inputRange: [0, 1], outputRange: [0.7, 2.2] }) }],
            },
          ]}
        />
      ))}
      <Animated.View style={[styles.logoCard, { transform: [{ translateY }] }]}>
        <Image source={APP_ICON} style={styles.logoImg} resizeMode="contain" />
      </Animated.View>
    </View>
  );
}

function NoteRow({ icon, color, text }: { icon: any; color: string; text: string }) {
  return (
    <View style={styles.noteRow}>
      <View style={[styles.noteIcon, { backgroundColor: `${color}1A` }]}>
        <Ionicons name={icon} size={15} color={color} />
      </View>
      <Text style={styles.noteText}>{text}</Text>
    </View>
  );
}

export function UpdateGate() {
  const insets = useSafeAreaInsets();
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
            latestVersion: cfg.latestVersion,
            notes: {
              features: cfg.releaseNotes?.features ?? [],
              fixes: cfg.releaseNotes?.fixes ?? [],
            },
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
    if (block.kind !== 'update') return;
    const url = Platform.OS === 'ios' ? block.iosStoreUrl : block.androidStoreUrl;
    if (url) void Linking.openURL(url);
  };

  const hasStoreUrl =
    block.kind === 'update' &&
    (Platform.OS === 'ios' ? !!block.iosStoreUrl : !!block.androidStoreUrl);

  const notes = block.kind === 'update' ? block.notes : { features: [], fixes: [] };
  const hasNotes = notes.features.length > 0 || notes.fixes.length > 0;

  return (
    <View style={styles.overlay} pointerEvents="auto">
      {/* Blue header with animated logo */}
      <View style={[styles.header, { paddingTop: insets.top + 28 }]}>
        <PulsingLogo />
      </View>

      {/* Content */}
      <ScrollView
        style={styles.body}
        contentContainerStyle={[styles.bodyContent, { paddingBottom: insets.bottom + 28 }]}
        showsVerticalScrollIndicator={false}
      >
        <Text style={styles.title}>
          {isMaintenance ? 'Maintenance en cours' : 'Mise à jour requise'}
        </Text>

        {block.kind === 'update' && block.latestVersion ? (
          <View style={styles.versionPill}>
            <Text style={styles.versionPillText}>Version {block.latestVersion}</Text>
          </View>
        ) : null}

        <Text style={styles.message}>
          {block.message ||
            (isMaintenance
              ? "Opatam est temporairement indisponible. Merci de réessayer dans quelques instants."
              : "Une nouvelle version d'Opatam est disponible. Mettez à jour l'application pour continuer.")}
        </Text>

        {/* Release notes */}
        {!isMaintenance && hasNotes ? (
          <View style={styles.notesCard}>
            {notes.features.length > 0 && (
              <View style={styles.notesGroup}>
                <View style={styles.notesGroupHead}>
                  <Ionicons name="rocket" size={16} color={BLUE} />
                  <Text style={styles.notesGroupTitle}>Nouveautés</Text>
                </View>
                {notes.features.map((f, i) => (
                  <NoteRow key={`f${i}`} icon="add-circle" color={BLUE} text={f} />
                ))}
              </View>
            )}
            {notes.fixes.length > 0 && (
              <View style={[styles.notesGroup, notes.features.length > 0 && styles.notesGroupSpaced]}>
                <View style={styles.notesGroupHead}>
                  <Ionicons name="build" size={16} color="#10B981" />
                  <Text style={styles.notesGroupTitle}>Corrections</Text>
                </View>
                {notes.fixes.map((f, i) => (
                  <NoteRow key={`b${i}`} icon="checkmark-circle" color="#10B981" text={f} />
                ))}
              </View>
            )}
          </View>
        ) : null}

        {/* CTA */}
        {isMaintenance ? (
          <ActivityIndicator color={BLUE} style={{ marginTop: 28 }} />
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
      </ScrollView>
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
    zIndex: 9999,
    elevation: 9999,
  },
  header: {
    backgroundColor: BLUE,
    alignItems: 'center',
    justifyContent: 'flex-end',
    paddingBottom: 48,
    borderBottomLeftRadius: 32,
    borderBottomRightRadius: 32,
  },
  logoWrap: {
    width: 140,
    height: 140,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ring: {
    position: 'absolute',
    width: 96,
    height: 96,
    borderRadius: 48,
    backgroundColor: '#FFFFFF',
  },
  logoCard: {
    width: 92,
    height: 92,
    borderRadius: 24,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.18,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 8 },
    elevation: 8,
  },
  logoImg: {
    width: 60,
    height: 60,
  },
  body: {
    flex: 1,
  },
  bodyContent: {
    paddingHorizontal: 28,
    paddingTop: 28,
    alignItems: 'center',
  },
  title: {
    fontSize: 23,
    fontWeight: '700',
    color: '#111827',
    textAlign: 'center',
  },
  versionPill: {
    marginTop: 10,
    backgroundColor: '#EFF6FF',
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 999,
  },
  versionPillText: {
    color: BLUE,
    fontSize: 13,
    fontWeight: '600',
  },
  message: {
    fontSize: 15,
    lineHeight: 22,
    color: '#6B7280',
    textAlign: 'center',
    marginTop: 12,
  },
  notesCard: {
    alignSelf: 'stretch',
    backgroundColor: '#F9FAFB',
    borderRadius: 18,
    borderWidth: 1,
    borderColor: '#F1F3F5',
    padding: 18,
    marginTop: 24,
  },
  notesGroup: {},
  notesGroupSpaced: {
    marginTop: 18,
    paddingTop: 18,
    borderTopWidth: 1,
    borderTopColor: '#EDEFF2',
  },
  notesGroupHead: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 12,
  },
  notesGroupTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#374151',
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  noteRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    marginBottom: 10,
  },
  noteIcon: {
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 1,
  },
  noteText: {
    flex: 1,
    fontSize: 14.5,
    lineHeight: 20,
    color: '#374151',
  },
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: BLUE,
    paddingHorizontal: 28,
    paddingVertical: 16,
    borderRadius: 14,
    marginTop: 28,
    alignSelf: 'stretch',
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
