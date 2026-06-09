/**
 * NotificationsDrawer — PRO notification center.
 *
 * Frosted-glass full-screen overlay: the home screen behind is blurred
 * (expo-blur) and the announcements float as cards on top, bringing the
 * notifications forward. Two states inside one Modal:
 *   - list  : announcement cards (with inline tutorial thumbnail)
 *   - detail: the tapped card's full content + CTA into Tutoriels & guides.
 *
 * Blur degrades gracefully: builds without the native expo-blur module
 * (e.g. an older dev-client) fall back to a translucent dark scrim, so
 * nothing crashes — the real blur appears once the app is rebuilt.
 */

import React from 'react';
import {
  View,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Animated,
  Easing,
  Image,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { BlurView } from 'expo-blur';
import { requireOptionalNativeModule } from 'expo-modules-core';
import { StatusBar } from 'expo-status-bar';
import { Text } from './Text';
import { useTheme } from '../theme';
import type { ProviderNotificationItem } from '../hooks/useProviderNotifications';

// Whether the native blur module is present in this binary. When false
// (older dev-client), we render a translucent scrim instead of crashing.
const BLUR_AVAILABLE = requireOptionalNativeModule('ExpoBlurView') != null;

const ANIM_MS = 260;

interface Props {
  visible: boolean;
  notifications: ProviderNotificationItem[];
  unreadCount: number;
  onClose: () => void;
  onMarkRead: (id: string) => void;
  onMarkAllRead: () => void;
}

function formatDate(ms: number): string {
  if (!ms) return '';
  try {
    return new Date(ms).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' });
  } catch {
    return '';
  }
}

function iconFor(name?: string | null): keyof typeof Ionicons.glyphMap {
  return (name || 'megaphone') as keyof typeof Ionicons.glyphMap;
}

/** Tutorial thumbnail with an optional play badge. */
function Thumb({
  uri,
  isVideo,
  onPress,
  height,
}: {
  uri: string;
  isVideo?: boolean;
  onPress?: () => void;
  height: number;
}) {
  const Wrapper: any = onPress ? Pressable : View;
  return (
    <Wrapper
      onPress={onPress}
      style={[styles.thumbWrap, { height }]}
    >
      <Image source={{ uri }} style={StyleSheet.absoluteFill} resizeMode="cover" />
      {isVideo ? (
        <View style={styles.playOverlay}>
          <View style={styles.playCircle}>
            <Ionicons name="play" size={22} color="#fff" style={{ marginLeft: 2 }} />
          </View>
        </View>
      ) : null}
    </Wrapper>
  );
}

export function NotificationsDrawer({
  visible,
  notifications,
  unreadCount,
  onClose,
  onMarkRead,
  onMarkAllRead,
}: Props) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();

  const [mounted, setMounted] = React.useState(visible);
  const [selectedId, setSelectedId] = React.useState<string | null>(null);
  const progress = React.useRef(new Animated.Value(visible ? 1 : 0)).current;

  React.useEffect(() => {
    if (visible) {
      setMounted(true);
      Animated.timing(progress, {
        toValue: 1,
        duration: ANIM_MS,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }).start();
    } else {
      Animated.timing(progress, {
        toValue: 0,
        duration: ANIM_MS,
        easing: Easing.in(Easing.cubic),
        useNativeDriver: true,
      }).start(({ finished }) => {
        if (finished) {
          setMounted(false);
          setSelectedId(null);
        }
      });
    }
  }, [visible, progress]);

  const translateY = progress.interpolate({ inputRange: [0, 1], outputRange: [24, 0] });

  const selected = selectedId
    ? notifications.find((n) => n.id === selectedId) ?? null
    : null;

  const openDetail = (n: ProviderNotificationItem) => {
    setSelectedId(n.id);
    if (!n.isRead) onMarkRead(n.id);
  };

  const openCta = (slug: string) => {
    onClose();
    setTimeout(() => router.push(`/(pro)/help/${slug}` as any), 60);
  };

  if (!mounted) return null;

  return (
    <Modal
      visible={mounted}
      transparent
      animationType="none"
      onRequestClose={selected ? () => setSelectedId(null) : onClose}
      statusBarTranslucent
    >
      {/* Light status bar so the time / battery stay legible over the
          dark frosted backdrop while the center is open. */}
      <StatusBar style="light" animated />

      {/* Frosted backdrop (or translucent fallback) */}
      <Animated.View style={[StyleSheet.absoluteFill, { opacity: progress }]}>
        {BLUR_AVAILABLE ? (
          <BlurView intensity={40} tint="dark" style={StyleSheet.absoluteFill} />
        ) : (
          <View style={[StyleSheet.absoluteFill, { backgroundColor: 'rgba(15,18,32,0.62)' }]} />
        )}
        <View style={[StyleSheet.absoluteFill, { backgroundColor: 'rgba(10,12,24,0.18)' }]} />
        <Pressable
          style={StyleSheet.absoluteFill}
          onPress={selected ? () => setSelectedId(null) : onClose}
        />
      </Animated.View>

      {/* Floating content */}
      <Animated.View
        pointerEvents="box-none"
        style={[
          StyleSheet.absoluteFill,
          { opacity: progress, transform: [{ translateY }] },
        ]}
      >
        <View style={{ flex: 1, paddingTop: insets.top + 10 }} pointerEvents="box-none">
          {/* Header */}
          <View style={styles.header} pointerEvents="box-none">
            {selected ? (
              <Pressable
                onPress={() => setSelectedId(null)}
                hitSlop={8}
                style={styles.headerBtn}
              >
                <Ionicons name="chevron-back" size={22} color="#fff" />
              </Pressable>
            ) : null}
            <View style={{ flex: 1 }}>
              <Text variant="h3" style={styles.headerTitle}>
                Nouveau
              </Text>
              {!selected ? (
                <Text variant="caption" style={styles.headerSub}>
                  {unreadCount > 0
                    ? `${unreadCount} non lue${unreadCount > 1 ? 's' : ''}`
                    : 'À jour'}
                </Text>
              ) : null}
            </View>
            {!selected && unreadCount > 0 ? (
              <Pressable onPress={onMarkAllRead} hitSlop={8} style={styles.markAllPill}>
                <Text variant="caption" style={{ color: '#fff', fontWeight: '700' }}>
                  Tout lire
                </Text>
              </Pressable>
            ) : null}
            <Pressable onPress={onClose} hitSlop={8} style={styles.headerBtn}>
              <Ionicons name="close" size={20} color="#fff" />
            </Pressable>
          </View>

          {/* Body */}
          {selected ? (
            <ScrollView
              contentContainerStyle={{
                padding: 16,
                paddingBottom: insets.bottom + 28,
              }}
            >
              <View style={[styles.card, { backgroundColor: colors.background }]}>
                <View style={[styles.detailIcon, { backgroundColor: colors.primary + '1A' }]}>
                  <Ionicons name={iconFor(selected.iconName)} size={26} color={colors.primary} />
                </View>
                <Text variant="h3" style={{ fontWeight: '800', marginBottom: 4 }}>
                  {selected.title}
                </Text>
                <Text variant="caption" color="textMuted" style={{ marginBottom: 14 }}>
                  {formatDate(selected.publishedAtMs)}
                </Text>
                {selected.imageUrl ? (
                  <Image
                    source={{ uri: selected.imageUrl }}
                    style={styles.detailImage}
                    resizeMode="cover"
                  />
                ) : null}
                <Text variant="body" style={{ color: colors.text, lineHeight: 22 }}>
                  {selected.modalBody || selected.body}
                </Text>

                {selected.ctaArticleSlug ? (
                  <>
                    {selected.ctaThumbUrl ? (
                      <View style={{ marginTop: 20 }}>
                        <Thumb
                          uri={selected.ctaThumbUrl}
                          isVideo={selected.ctaIsVideo}
                          height={180}
                          onPress={() => openCta(selected.ctaArticleSlug!)}
                        />
                      </View>
                    ) : null}
                    <Pressable
                      onPress={() => openCta(selected.ctaArticleSlug!)}
                      style={({ pressed }) => [
                        styles.ctaBtn,
                        { backgroundColor: colors.primary, opacity: pressed ? 0.9 : 1 },
                      ]}
                    >
                      <Ionicons
                        name={selected.ctaIsVideo ? 'play-circle' : 'book'}
                        size={20}
                        color="#fff"
                      />
                      <Text variant="body" style={{ color: '#fff', fontWeight: '700' }}>
                        {selected.ctaLabel ||
                          (selected.ctaIsVideo ? 'Voir la vidéo' : 'Voir le tutoriel')}
                      </Text>
                    </Pressable>
                  </>
                ) : null}
              </View>
            </ScrollView>
          ) : notifications.length === 0 ? (
            <View style={styles.empty} pointerEvents="box-none">
              <View style={styles.emptyCircle}>
                <Ionicons name="notifications-outline" size={34} color="#fff" />
              </View>
              <Text variant="body" style={{ fontWeight: '700', color: '#fff', marginTop: 16 }}>
                Vous êtes à jour
              </Text>
              <Text
                variant="caption"
                align="center"
                style={{ color: 'rgba(255,255,255,0.7)', marginTop: 6, maxWidth: 240, lineHeight: 18 }}
              >
                Les nouveautés et annonces d'Opatam s'afficheront ici.
              </Text>
            </View>
          ) : (
            <ScrollView
              contentContainerStyle={{
                paddingHorizontal: 16,
                paddingTop: 4,
                paddingBottom: insets.bottom + 28,
              }}
            >
              {notifications.map((n) => (
                <Pressable
                  key={n.id}
                  onPress={() => openDetail(n)}
                  style={({ pressed }) => [
                    styles.card,
                    { backgroundColor: colors.background, opacity: pressed ? 0.95 : 1, marginBottom: 12 },
                  ]}
                >
                  <View style={styles.cardHead}>
                    <View style={[styles.rowIcon, { backgroundColor: colors.primary + '1A' }]}>
                      <Ionicons name={iconFor(n.iconName)} size={18} color={colors.primary} />
                    </View>
                    <View style={{ flex: 1 }}>
                      <View style={styles.rowTitleLine}>
                        {!n.isRead ? (
                          <View style={[styles.dot, { backgroundColor: colors.primary }]} />
                        ) : null}
                        <Text
                          variant="bodySmall"
                          style={{ flex: 1, fontWeight: n.isRead ? '600' : '800', color: colors.text }}
                          numberOfLines={1}
                        >
                          {n.title}
                        </Text>
                        <Text variant="caption" color="textMuted">
                          {formatDate(n.publishedAtMs)}
                        </Text>
                      </View>
                      <Text variant="caption" color="textMuted" numberOfLines={2} style={{ marginTop: 2 }}>
                        {n.body}
                      </Text>
                    </View>
                  </View>
                  {n.ctaThumbUrl ? (
                    <View style={{ marginTop: 12 }}>
                      <Thumb uri={n.ctaThumbUrl} isVideo={n.ctaIsVideo} height={150} />
                    </View>
                  ) : null}
                </Pressable>
              ))}
            </ScrollView>
          )}
        </View>
      </Animated.View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 16,
    paddingBottom: 12,
  },
  headerBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.18)',
  },
  headerTitle: {
    fontWeight: '800',
    color: '#fff',
  },
  headerSub: {
    color: 'rgba(255,255,255,0.7)',
    marginTop: 1,
  },
  markAllPill: {
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 999,
    backgroundColor: 'rgba(255,255,255,0.18)',
  },
  card: {
    borderRadius: 18,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.18,
    shadowRadius: 14,
    elevation: 6,
  },
  cardHead: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
  },
  rowIcon: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 1,
  },
  rowTitleLine: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  dot: {
    width: 7,
    height: 7,
    borderRadius: 4,
  },
  empty: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
    paddingBottom: 80,
  },
  emptyCircle: {
    width: 76,
    height: 76,
    borderRadius: 38,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.14)',
  },
  detailIcon: {
    width: 52,
    height: 52,
    borderRadius: 26,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 14,
  },
  detailImage: {
    width: '100%',
    height: 160,
    borderRadius: 14,
    marginBottom: 16,
  },
  thumbWrap: {
    width: '100%',
    borderRadius: 14,
    overflow: 'hidden',
    backgroundColor: '#000',
  },
  playOverlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0,0,0,0.18)',
  },
  playCircle: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: 'rgba(0,0,0,0.55)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  ctaBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 14,
    borderRadius: 14,
    marginTop: 12,
  },
});
