/**
 * OverlaySheet — an animated bottom-sheet rendered as a plain absolute
 * overlay (NOT a React Native <Modal>). This matters when the sheet must
 * appear ON TOP of an already-open Modal: iOS only presents one Modal at a
 * time, so a second <Modal> wouldn't show. As an overlay it always does.
 *
 * Provides the bottom-sheet affordances the user expects: a slide-up
 * animation, a fading backdrop (tap to close), a grabber handle, and
 * swipe-down-to-dismiss. Stays mounted during the exit animation.
 */

import React, { useEffect, useRef, useState } from 'react';
import { Animated, Pressable, View, Dimensions, PanResponder, StyleSheet } from 'react-native';
import { useTheme } from '../theme';

export function OverlaySheet({
  visible,
  onClose,
  heightPct = 0.9,
  children,
}: {
  visible: boolean;
  onClose: () => void;
  /** Sheet height as a fraction of the screen height. */
  heightPct?: number;
  children: React.ReactNode;
}) {
  const { colors, radius } = useTheme();
  const sheetH = Dimensions.get('window').height * heightPct;

  const translateY = useRef(new Animated.Value(sheetH)).current;
  const backdrop = useRef(new Animated.Value(0)).current;
  const [mounted, setMounted] = useState(visible);

  useEffect(() => {
    if (visible) {
      setMounted(true);
      Animated.parallel([
        Animated.timing(backdrop, { toValue: 1, duration: 200, useNativeDriver: true }),
        Animated.spring(translateY, {
          toValue: 0,
          useNativeDriver: true,
          damping: 24,
          stiffness: 240,
          mass: 0.9,
        }),
      ]).start();
    } else if (mounted) {
      Animated.parallel([
        Animated.timing(backdrop, { toValue: 0, duration: 180, useNativeDriver: true }),
        Animated.timing(translateY, { toValue: sheetH, duration: 220, useNativeDriver: true }),
      ]).start(({ finished }) => {
        if (finished) setMounted(false);
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible]);

  // Swipe-down-to-dismiss on the grabber/header zone only (so the inner
  // ScrollView keeps its own gestures).
  const panResponder = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (_, g) => g.dy > 6 && Math.abs(g.dy) > Math.abs(g.dx),
      onPanResponderMove: (_, g) => {
        if (g.dy > 0) translateY.setValue(g.dy);
      },
      onPanResponderRelease: (_, g) => {
        if (g.dy > 120 || g.vy > 0.6) {
          onClose();
        } else {
          Animated.spring(translateY, {
            toValue: 0,
            useNativeDriver: true,
            damping: 24,
            stiffness: 240,
          }).start();
        }
      },
    }),
  ).current;

  if (!mounted) return null;

  return (
    <View style={StyleSheet.absoluteFill}>
      <Animated.View style={[StyleSheet.absoluteFill, { backgroundColor: 'rgba(0,0,0,0.45)', opacity: backdrop }]}>
        <Pressable style={{ flex: 1 }} onPress={onClose} />
      </Animated.View>

      <Animated.View
        style={{
          position: 'absolute',
          left: 0,
          right: 0,
          bottom: 0,
          height: sheetH,
          backgroundColor: colors.background,
          borderTopLeftRadius: radius.xl,
          borderTopRightRadius: radius.xl,
          transform: [{ translateY }],
          overflow: 'hidden',
        }}
      >
        {/* Grabber + swipe-down zone */}
        <View {...panResponder.panHandlers} style={{ alignItems: 'center', paddingTop: 10, paddingBottom: 6 }}>
          <View style={{ width: 40, height: 5, borderRadius: 3, backgroundColor: colors.border }} />
        </View>
        {children}
      </Animated.View>
    </View>
  );
}
