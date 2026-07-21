/**
 * DevFAB - Development Floating Action Button
 * Navigation menu and theme configurator for development
 * Only visible in __DEV__ mode
 */

import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  View,
  Pressable,
  StyleSheet,
  Modal,
  Animated,
  Dimensions,
  PanResponder,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { useTheme } from '../../theme';
import { Text } from '../Text';
import { ThemeConfigurator } from './ThemeConfigurator';
import { APP_LOCALES, setAppLocale, type AppLocale } from '../../lib/i18n';
import {
  resetAllOpatamStorage,
  resetNewFeaturesSeen,
  resetOnboarding,
} from '../../utils';

/** AsyncStorage key for the FAB's last position — survives reloads
 *  so a dev who parked it top-left finds it there next time. */
const POSITION_KEY = '@opatam/devfab_position';
const FAB_SIZE = 44;
const EDGE_PADDING = 16;
const TAP_THRESHOLD = 5; // px — anything below counts as a tap, not a drag

interface MenuItem {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  action: () => void;
}

export function DevFAB() {
  const { colors, radius, shadows, spacing } = useTheme();
  const router = useRouter();
  // useTranslation pour la réactivité : le label FR ⇄ EN se met à jour
  // quand la langue change (menu dev volontairement non traduit).
  const { i18n } = useTranslation();
  const devLocale: AppLocale = APP_LOCALES.includes(i18n.language as AppLocale) ? (i18n.language as AppLocale) : 'fr';
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isConfiguratorOpen, setIsConfiguratorOpen] = useState(false);

  // ─── Drag-to-move ──────────────────────────────────────────────
  // Translation from the FAB's "home" position (bottom-right). The
  // FAB itself stays anchored bottom/right via styles.fab; we only
  // animate translateX/translateY relative to that anchor.
  // Negative X moves it left, negative Y moves it up.
  const pan = useRef(new Animated.ValueXY({ x: 0, y: 0 })).current;
  // Track whether the user actually dragged so we don't fire
  // toggleMenu on a "drag end" tap event.
  const draggedRef = useRef(false);
  const [hydrated, setHydrated] = useState(false);

  // Restore last position from storage on mount.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const raw = await AsyncStorage.getItem(POSITION_KEY);
        if (raw && !cancelled) {
          const saved = JSON.parse(raw) as { x: number; y: number };
          if (
            typeof saved.x === 'number' &&
            typeof saved.y === 'number' &&
            Number.isFinite(saved.x) &&
            Number.isFinite(saved.y)
          ) {
            pan.setValue(saved);
          }
        }
      } catch {
        /* ignore — first launch / corrupt JSON */
      } finally {
        if (!cancelled) setHydrated(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [pan]);

  const panResponder = useMemo(
    () =>
      PanResponder.create({
        // Don't claim the gesture on touch start — let it reach the
        // inner Pressable (so taps work normally).
        onStartShouldSetPanResponder: () => false,
        // Claim only once the finger has actually moved past the
        // tap threshold. Distinguishes drags from accidental
        // micro-movements during a tap.
        onMoveShouldSetPanResponder: (_, gs) =>
          Math.abs(gs.dx) > TAP_THRESHOLD ||
          Math.abs(gs.dy) > TAP_THRESHOLD,
        onPanResponderGrant: () => {
          draggedRef.current = true;
          // Move current value to offset so dx/dy from the gesture
          // adds on top of where the FAB already sits.
          pan.extractOffset();
        },
        onPanResponderMove: Animated.event(
          [null, { dx: pan.x, dy: pan.y }],
          { useNativeDriver: false },
        ),
        onPanResponderRelease: () => {
          pan.flattenOffset();
          // Read the current X/Y after flattenOffset.
          // @ts-expect-error — _value exists at runtime even though
          // it's not in the public typings.
          const currentX = pan.x._value as number;
          // @ts-expect-error
          const currentY = pan.y._value as number;

          // Snap horizontally to the closest edge — common UX for
          // floating debug overlays. The FAB's anchor is bottom-right
          // with right: 16, so:
          //   x = 0   → docked right
          //   x = -(width - FAB_SIZE - 2*EDGE_PADDING) → docked left
          const screenW = Dimensions.get('window').width;
          const fabAbsoluteRight = EDGE_PADDING - currentX; // distance from right edge
          const fabAbsoluteCenter = screenW - fabAbsoluteRight - FAB_SIZE / 2;
          const targetX =
            fabAbsoluteCenter < screenW / 2
              ? -(screenW - FAB_SIZE - EDGE_PADDING * 2) // left edge
              : 0; // right edge

          // Clamp Y so the FAB stays on-screen.
          const screenH = Dimensions.get('window').height;
          // Default position is bottom: 24, so y = 0 means at the
          // bottom. We can move up to roughly screen height minus
          // padding.
          const minY = -(screenH - FAB_SIZE - EDGE_PADDING * 4);
          const maxY = 0;
          const targetY = Math.max(minY, Math.min(maxY, currentY));

          Animated.spring(pan, {
            toValue: { x: targetX, y: targetY },
            useNativeDriver: false,
            friction: 8,
            tension: 60,
          }).start(() => {
            // Persist after the spring lands.
            AsyncStorage.setItem(
              POSITION_KEY,
              JSON.stringify({ x: targetX, y: targetY }),
            ).catch(() => {});
            // Reset the drag flag a tick later so onPress (if it
            // fires from the same gesture) is correctly suppressed.
            setTimeout(() => {
              draggedRef.current = false;
            }, 50);
          });
        },
      }),
    [pan],
  );

  // Don't render in production
  if (!__DEV__) {
    return null;
  }

  const menuItems: MenuItem[] = [
    {
      icon: 'color-palette-outline',
      label: 'Design System',
      action: () => {
        setIsMenuOpen(false);
        router.push('/design-system');
      },
    },
    {
      icon: 'cube-outline',
      label: 'Composants Métier',
      action: () => {
        setIsMenuOpen(false);
        router.push('/business-components');
      },
    },
    {
      icon: 'home-outline',
      label: 'Accueil',
      action: () => {
        setIsMenuOpen(false);
        router.push('/');
      },
    },
    {
      icon: 'settings-outline',
      label: 'Thème',
      action: () => {
        setIsMenuOpen(false);
        setIsConfiguratorOpen(true);
      },
    },
    {
      // Bascule la langue de l'app (même mécanique que le sélecteur du
      // profil : setAppLocale persiste le choix dans @opatam/app_locale —
      // « Purger @opatam/* » ramène donc à la langue système).
      icon: 'language-outline',
      label: `Langue : ${devLocale.toUpperCase()} → ${APP_LOCALES[(APP_LOCALES.indexOf(devLocale) + 1) % APP_LOCALES.length].toUpperCase()}`,
      action: () => {
        void setAppLocale(APP_LOCALES[(APP_LOCALES.indexOf(devLocale) + 1) % APP_LOCALES.length]);
        setIsMenuOpen(false);
      },
    },
    {
      icon: 'refresh-outline',
      label: 'Reset Onboarding',
      action: async () => {
        await resetOnboarding();
        setIsMenuOpen(false);
        router.replace('/');
      },
    },
    {
      // Brings back every "Nouveau" pill + the home discovery
      // banner so the dev can re-test those flows after they've
      // been dismissed. Doesn't log out, doesn't touch the theme.
      icon: 'sparkles-outline',
      label: 'Reset Découverte',
      action: async () => {
        await resetNewFeaturesSeen();
        setIsMenuOpen(false);
        router.replace('/');
      },
    },
    {
      // Wipes EVERY @opatam/* AsyncStorage key — simulates a
      // fresh install. Scoped so it doesn't touch react-nav state
      // or third-party libs that might also use AsyncStorage.
      icon: 'trash-outline',
      label: 'Purger @opatam/*',
      action: async () => {
        await resetAllOpatamStorage();
        setIsMenuOpen(false);
        router.replace('/');
      },
    },
  ];

  const toggleMenu = () => {
    // Suppress the open if the gesture was actually a drag (the
    // Pressable's onPress can still fire after a release if the
    // finger never left its hit area). Reset on the next tap.
    if (draggedRef.current) {
      draggedRef.current = false;
      return;
    }
    setIsMenuOpen(!isMenuOpen);
  };

  return (
    <>
      {/* FAB Button — wrapped in an Animated.View so it can be
          dragged anywhere on screen. Position is anchored
          bottom-right via styles.fab; pan transforms move it from
          there. Hidden until storage hydration finishes so we
          don't flash at the default position then jump. */}
      <Animated.View
        {...panResponder.panHandlers}
        style={[
          styles.fab,
          {
            transform: [
              { translateX: pan.x },
              { translateY: pan.y },
            ],
            opacity: hydrated ? 1 : 0,
          },
        ]}
      >
        <Pressable
          onPress={toggleMenu}
          style={({ pressed }) => [
            styles.fabInner,
            {
              backgroundColor: colors.primary,
              borderRadius: radius.full,
              ...shadows.md,
            },
            pressed && styles.fabPressed,
          ]}
        >
          <Ionicons
            name={isMenuOpen ? 'close' : 'code-slash'}
            size={18}
            color={colors.textInverse}
          />
        </Pressable>
      </Animated.View>

      {/* Menu Modal */}
      <Modal
        visible={isMenuOpen}
        transparent
        animationType="fade"
        onRequestClose={() => setIsMenuOpen(false)}
      >
        <Pressable
          style={styles.overlay}
          onPress={() => setIsMenuOpen(false)}
        >
          <View
            style={[
              styles.menu,
              {
                backgroundColor: colors.surface,
                borderRadius: radius.lg,
                ...shadows.xl,
              },
            ]}
          >
            <Text
              variant="label"
              color="textSecondary"
              style={[styles.menuTitle, { paddingHorizontal: spacing.lg, paddingTop: spacing.md }]}
            >
              DEV MENU
            </Text>
            {menuItems.map((item, index) => (
              <Pressable
                key={index}
                onPress={item.action}
                style={({ pressed }) => [
                  styles.menuItem,
                  {
                    paddingHorizontal: spacing.lg,
                    paddingVertical: spacing.md,
                  },
                  pressed && { backgroundColor: colors.surfaceSecondary },
                ]}
              >
                <Ionicons
                  name={item.icon}
                  size={20}
                  color={colors.primary}
                  style={{ marginRight: spacing.md }}
                />
                <Text variant="body">{item.label}</Text>
              </Pressable>
            ))}
            <View style={{ height: spacing.sm }} />
          </View>
        </Pressable>
      </Modal>

      {/* Theme Configurator */}
      <ThemeConfigurator
        visible={isConfiguratorOpen}
        onClose={() => setIsConfiguratorOpen(false)}
      />
    </>
  );
}

const styles = StyleSheet.create({
  // Outer — handles positioning (anchored bottom-right) + the
  // animated translate. No visual styling; it's a wrapper for
  // PanResponder to hook into.
  fab: {
    position: 'absolute',
    bottom: EDGE_PADDING,
    right: EDGE_PADDING,
    width: FAB_SIZE,
    height: FAB_SIZE,
    zIndex: 1000,
  },
  // Inner — the visible Pressable. Same size as fab so the drag
  // hit area matches the button.
  fabInner: {
    width: FAB_SIZE,
    height: FAB_SIZE,
    justifyContent: 'center',
    alignItems: 'center',
  },
  fabPressed: {
    opacity: 0.9,
    transform: [{ scale: 0.95 }],
  },
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.3)',
    justifyContent: 'flex-end',
    alignItems: 'flex-end',
    padding: 24,
    paddingBottom: 100, // Above the FAB
  },
  menu: {
    minWidth: 200,
    overflow: 'hidden',
  },
  menuTitle: {
    letterSpacing: 1,
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
  },
});
