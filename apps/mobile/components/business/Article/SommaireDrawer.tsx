/**
 * SommaireDrawer
 *
 * Side drawer that slides in from the right with the article's
 * full table of contents. Triggered by the burger button in the
 * detail screen's header. Same heading data as the inline Sommaire,
 * but always-expanded (the drawer surface gives enough room) and
 * auto-closes on jump.
 *
 * Why a drawer rather than just the inline version:
 *   - Quick access without scrolling back to the top
 *   - Familiar burger-menu pattern for "show me the structure"
 *   - On long articles the inline TOC may be far above the user's
 *     current scroll position; the drawer is always one tap away
 *
 * Animation note: React Native's <Modal animationType="slide">
 * always slides from the bottom of the screen (iOS sheet style).
 * To get a right-edge slide we drive the panel translation with
 * Animated and keep the modal itself in `animationType="none"`,
 * fading the backdrop in parallel. We also delay unmounting the
 * Modal until the close animation finishes, so the panel doesn't
 * pop off-screen instantly.
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
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Text } from '../../Text';
import { useTheme } from '../../../theme';
import type { Heading } from '@booking-app/shared';

interface Props {
  visible: boolean;
  headings: Heading[];
  onClose: () => void;
  onJump: (slug: string) => void;
}

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const PANEL_WIDTH = Math.min(SCREEN_WIDTH * 0.8, 360);
const ANIM_MS = 240;

export function SommaireDrawer({ visible, headings, onClose, onJump }: Props) {
  const { colors, spacing, radius } = useTheme();
  const insets = useSafeAreaInsets();

  // The Modal stays mounted slightly past `visible=false` so the
  // close animation can play. `mounted` controls actual unmount.
  const [mounted, setMounted] = React.useState(visible);

  // 0 = fully closed (off-screen right), 1 = fully open.
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
        if (finished) setMounted(false);
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

  if (!mounted) return null;

  return (
    <Modal
      visible={mounted}
      transparent
      animationType="none"
      onRequestClose={onClose}
      statusBarTranslucent
    >
      <View style={styles.root}>
        {/* Backdrop — fades in/out with the panel. Tap to dismiss. */}
        <Animated.View
          style={[styles.backdrop, { opacity: backdropOpacity }]}
        >
          <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
        </Animated.View>

        {/* Right-aligned panel — driven by translateX so it slides
            in from the right edge rather than bottom-up. */}
        <Animated.View
          style={[
            styles.panel,
            {
              backgroundColor: colors.surface,
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
            <Ionicons
              name="list-outline"
              size={20}
              color={colors.text}
            />
            <Text variant="body" style={{ flex: 1, fontWeight: '700' }}>
              Sommaire
            </Text>
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

          {/* Headings list */}
          {headings.length === 0 ? (
            <View style={[styles.empty, { padding: spacing.lg }]}>
              <Text variant="caption" color="textMuted" align="center">
                Cet article n'a pas de sections définies.
              </Text>
            </View>
          ) : (
            <ScrollView
              contentContainerStyle={{
                paddingHorizontal: spacing.md,
                paddingVertical: spacing.sm,
              }}
            >
              {headings.map((h) => (
                <Pressable
                  key={h.slug}
                  onPress={() => {
                    onJump(h.slug);
                    onClose();
                  }}
                  style={({ pressed }) => [
                    styles.row,
                    {
                      paddingLeft:
                        h.level === 1
                          ? spacing.sm
                          : h.level === 2
                            ? spacing.lg
                            : spacing['2xl'],
                      paddingRight: spacing.sm,
                      paddingVertical: 12,
                      borderLeftWidth: 2,
                      borderLeftColor:
                        h.level === 1 ? colors.primary : 'transparent',
                      backgroundColor: pressed
                        ? colors.surfaceSecondary
                        : 'transparent',
                      borderRadius: radius.sm,
                    },
                  ]}
                >
                  <Text
                    variant="bodySmall"
                    style={{
                      color: colors.text,
                      fontWeight: h.level === 1 ? '700' : '500',
                      lineHeight: 20,
                    }}
                    numberOfLines={2}
                  >
                    {h.text}
                  </Text>
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
  closeBtn: {
    width: 32,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  row: {
    marginVertical: 1,
  },
  empty: {
    paddingTop: 40,
  },
});
