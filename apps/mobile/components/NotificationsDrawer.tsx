/**
 * NotificationsDrawer
 *
 * Right-edge drawer (same animation pattern as SommaireDrawer) that
 * hosts the PRO notification center. Two states inside a single Modal
 * (so we never stack Modals, which iOS doesn't render):
 *   - list  : the announcements, newest first, unread highlighted
 *   - detail: a tapped announcement's full content + optional CTA that
 *             deep-links into Tutoriels & guides.
 *
 * Opening an item marks it read. Driven by useProviderNotifications.
 */

import React from 'react';
import {
  View,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Dimensions,
  Animated,
  Easing,
  Image,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Text } from './Text';
import { useTheme } from '../theme';
import type { ProviderNotificationItem } from '../hooks/useProviderNotifications';

interface Props {
  visible: boolean;
  notifications: ProviderNotificationItem[];
  unreadCount: number;
  onClose: () => void;
  onMarkRead: (id: string) => void;
  onMarkAllRead: () => void;
}

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const PANEL_WIDTH = Math.min(SCREEN_WIDTH * 0.9, 420);
const ANIM_MS = 240;

function formatDate(ms: number): string {
  if (!ms) return '';
  try {
    return new Date(ms).toLocaleDateString('fr-FR', {
      day: 'numeric',
      month: 'short',
    });
  } catch {
    return '';
  }
}

function iconFor(name?: string | null): keyof typeof Ionicons.glyphMap {
  const n = (name || 'megaphone') as keyof typeof Ionicons.glyphMap;
  return n;
}

export function NotificationsDrawer({
  visible,
  notifications,
  unreadCount,
  onClose,
  onMarkRead,
  onMarkAllRead,
}: Props) {
  const { colors, spacing, radius } = useTheme();
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

  const translateX = progress.interpolate({
    inputRange: [0, 1],
    outputRange: [PANEL_WIDTH, 0],
  });
  const backdropOpacity = progress.interpolate({
    inputRange: [0, 1],
    outputRange: [0, 1],
  });

  const selected = selectedId
    ? notifications.find((n) => n.id === selectedId) ?? null
    : null;

  const openDetail = (n: ProviderNotificationItem) => {
    setSelectedId(n.id);
    if (!n.isRead) onMarkRead(n.id);
  };

  const openCta = (slug: string) => {
    onClose();
    // Let the close animation start, then navigate.
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
      <View style={styles.root}>
        <Animated.View style={[styles.backdrop, { opacity: backdropOpacity }]}>
          <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
        </Animated.View>

        <Animated.View
          style={[
            styles.panel,
            {
              backgroundColor: colors.background,
              paddingTop: insets.top,
              paddingBottom: insets.bottom,
              width: PANEL_WIDTH,
              transform: [{ translateX }],
            },
          ]}
        >
          {/* Header */}
          <View
            style={[
              styles.panelHeader,
              {
                paddingHorizontal: spacing.lg,
                paddingVertical: spacing.md,
                borderBottomColor: colors.border,
              },
            ]}
          >
            {selected ? (
              <Pressable
                onPress={() => setSelectedId(null)}
                hitSlop={8}
                style={[styles.headerIcon, { backgroundColor: colors.surfaceSecondary }]}
              >
                <Ionicons name="chevron-back" size={20} color={colors.text} />
              </Pressable>
            ) : (
              <View style={[styles.headerIcon, { backgroundColor: colors.primary + '1A' }]}>
                <Ionicons name="notifications" size={18} color={colors.primary} />
              </View>
            )}
            <View style={{ flex: 1 }}>
              <Text variant="body" style={{ fontWeight: '800' }}>
                {selected ? 'Notification' : 'Notifications'}
              </Text>
              {!selected && (
                <Text variant="caption" color="textMuted">
                  {unreadCount > 0
                    ? `${unreadCount} non lue${unreadCount > 1 ? 's' : ''}`
                    : 'À jour'}
                </Text>
              )}
            </View>
            {!selected && unreadCount > 0 && (
              <Pressable
                onPress={onMarkAllRead}
                hitSlop={8}
                style={({ pressed }) => [
                  styles.markAllPill,
                  { backgroundColor: colors.primary + '14', opacity: pressed ? 0.6 : 1 },
                ]}
              >
                <Text variant="caption" style={{ color: colors.primary, fontWeight: '700' }}>
                  Tout lire
                </Text>
              </Pressable>
            )}
            <Pressable
              onPress={onClose}
              style={({ pressed }) => [
                styles.closeBtn,
                {
                  backgroundColor: colors.surfaceSecondary,
                  borderRadius: radius.full,
                  opacity: pressed ? 0.7 : 1,
                },
              ]}
              hitSlop={8}
            >
              <Ionicons name="close" size={18} color={colors.text} />
            </Pressable>
          </View>

          {/* Body */}
          {selected ? (
            <ScrollView contentContainerStyle={{ padding: spacing.lg }}>
              <View
                style={[
                  styles.detailIcon,
                  { backgroundColor: colors.primary + '1A' },
                ]}
              >
                <Ionicons name={iconFor(selected.iconName)} size={26} color={colors.primary} />
              </View>
              <Text variant="h3" style={{ fontWeight: '800', marginBottom: 6 }}>
                {selected.title}
              </Text>
              <Text variant="caption" color="textMuted" style={{ marginBottom: 16 }}>
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
                <Pressable
                  onPress={() => openCta(selected.ctaArticleSlug!)}
                  style={({ pressed }) => [
                    styles.ctaBtn,
                    { backgroundColor: colors.primary, opacity: pressed ? 0.9 : 1 },
                  ]}
                >
                  <Ionicons name="play-circle" size={20} color="#fff" />
                  <Text variant="body" style={{ color: '#fff', fontWeight: '700' }}>
                    {selected.ctaLabel || 'Voir le tutoriel'}
                  </Text>
                </Pressable>
              ) : null}
            </ScrollView>
          ) : notifications.length === 0 ? (
            <View style={styles.empty}>
              <View style={[styles.emptyCircle, { backgroundColor: colors.primary + '12' }]}>
                <Ionicons name="notifications-outline" size={34} color={colors.primary} />
              </View>
              <Text variant="body" style={{ fontWeight: '700', marginTop: 16 }}>
                Vous êtes à jour
              </Text>
              <Text
                variant="caption"
                color="textMuted"
                align="center"
                style={{ marginTop: 6, maxWidth: 240, lineHeight: 18 }}
              >
                Les nouveautés et annonces d'Opatam s'afficheront ici.
              </Text>
            </View>
          ) : (
            <ScrollView contentContainerStyle={{ paddingVertical: spacing.sm }}>
              {notifications.map((n) => (
                <Pressable
                  key={n.id}
                  onPress={() => openDetail(n)}
                  style={({ pressed }) => [
                    styles.row,
                    {
                      paddingHorizontal: spacing.lg,
                      paddingVertical: spacing.md,
                      backgroundColor: pressed
                        ? colors.surfaceSecondary
                        : n.isRead
                          ? 'transparent'
                          : colors.primary + '0D',
                      borderBottomColor: colors.border,
                    },
                  ]}
                >
                  <View
                    style={[
                      styles.rowIcon,
                      { backgroundColor: colors.primary + '1A' },
                    ]}
                  >
                    <Ionicons name={iconFor(n.iconName)} size={18} color={colors.primary} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <View style={styles.rowTitleLine}>
                      {!n.isRead && (
                        <View style={[styles.dot, { backgroundColor: colors.primary }]} />
                      )}
                      <Text
                        variant="bodySmall"
                        style={{ flex: 1, fontWeight: n.isRead ? '500' : '700', color: colors.text }}
                        numberOfLines={1}
                      >
                        {n.title}
                      </Text>
                      <Text variant="caption" color="textMuted">
                        {formatDate(n.publishedAtMs)}
                      </Text>
                    </View>
                    <Text
                      variant="caption"
                      color="textMuted"
                      numberOfLines={2}
                      style={{ marginTop: 2 }}
                    >
                      {n.body}
                    </Text>
                  </View>
                  {n.ctaArticleSlug ? (
                    <Ionicons name="chevron-forward" size={16} color={colors.textMuted} />
                  ) : null}
                </Pressable>
              ))}
            </ScrollView>
          )}
        </Animated.View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    flexDirection: 'row',
    justifyContent: 'flex-end',
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.4)',
  },
  panel: {
    height: '100%',
    shadowColor: '#000',
    shadowOffset: { width: -2, height: 0 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 12,
  },
  panelHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  headerIcon: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
  },
  markAllPill: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 999,
  },
  emptyCircle: {
    width: 72,
    height: 72,
    borderRadius: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
  closeBtn: {
    width: 32,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  rowIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 2,
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
    paddingTop: 80,
    paddingHorizontal: 24,
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
  ctaBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 14,
    borderRadius: 14,
    marginTop: 24,
  },
});
