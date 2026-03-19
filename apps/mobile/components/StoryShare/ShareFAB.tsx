/**
 * ShareFAB — Floating Action Button with expandable share options
 *
 * 3 actions:
 * - Créer une story (with label) → opens StoryShareModal
 * - Copier le lien
 * - Partager (native share sheet)
 */

import React, { useState, useRef, useCallback, useEffect } from 'react';
import {
  View,
  StyleSheet,
  Pressable,
  Animated,
  Share,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import * as Clipboard from 'expo-clipboard';
import { useTheme } from '../../theme';
import { Text } from '../Text';

interface ShareFABProps {
  shopUrl: string;
  businessName: string;
  onCreateStory: () => void;
}

export function ShareFAB({ shopUrl, businessName, onCreateStory }: ShareFABProps) {
  const { colors, radius, shadows } = useTheme();
  const [isOpen, setIsOpen] = useState(false);

  // Animations
  const rotateAnim = useRef(new Animated.Value(0)).current;
  const scaleAnim = useRef(new Animated.Value(1)).current;
  const optionAnims = useRef([
    new Animated.Value(0),
    new Animated.Value(0),
    new Animated.Value(0),
  ]).current;
  const backdropAnim = useRef(new Animated.Value(0)).current;

  // Pulse on mount
  useEffect(() => {
    const pulse = Animated.sequence([
      Animated.timing(scaleAnim, { toValue: 1.1, duration: 600, useNativeDriver: true }),
      Animated.timing(scaleAnim, { toValue: 1, duration: 600, useNativeDriver: true }),
    ]);
    const timeout = setTimeout(() => {
      Animated.loop(pulse, { iterations: 2 }).start();
    }, 2000);
    return () => clearTimeout(timeout);
  }, [scaleAnim]);

  const toggleMenu = useCallback(() => {
    const opening = !isOpen;
    setIsOpen(opening);

    Animated.spring(rotateAnim, {
      toValue: opening ? 1 : 0,
      friction: 8,
      tension: 60,
      useNativeDriver: true,
    }).start();

    Animated.timing(backdropAnim, {
      toValue: opening ? 1 : 0,
      duration: 200,
      useNativeDriver: true,
    }).start();

    if (opening) {
      optionAnims.forEach((anim, i) => {
        Animated.spring(anim, {
          toValue: 1,
          friction: 7,
          tension: 50,
          delay: i * 60,
          useNativeDriver: true,
        }).start();
      });
    } else {
      optionAnims.forEach((anim) => {
        Animated.timing(anim, { toValue: 0, duration: 150, useNativeDriver: true }).start();
      });
    }
  }, [isOpen, rotateAnim, backdropAnim, optionAnims]);

  const closeMenu = useCallback(() => {
    setIsOpen(false);
    Animated.spring(rotateAnim, { toValue: 0, friction: 8, tension: 60, useNativeDriver: true }).start();
    Animated.timing(backdropAnim, { toValue: 0, duration: 150, useNativeDriver: true }).start();
    optionAnims.forEach((anim) => {
      Animated.timing(anim, { toValue: 0, duration: 120, useNativeDriver: true }).start();
    });
  }, [rotateAnim, backdropAnim, optionAnims]);

  const handleOptionPress = useCallback((action: () => void) => {
    closeMenu();
    setTimeout(action, 100);
  }, [closeMenu]);

  const handleCopyLink = useCallback(async () => {
    try {
      await Clipboard.setStringAsync(shopUrl);
      Alert.alert('Lien copié', 'Le lien a été copié dans le presse-papiers.');
    } catch {
      Alert.alert('Erreur', 'Impossible de copier le lien.');
    }
  }, [shopUrl]);

  const handleShare = useCallback(async () => {
    try {
      await Share.share({
        message: `Réservez chez ${businessName} : ${shopUrl}`,
        url: shopUrl,
      });
    } catch {}
  }, [shopUrl, businessName]);

  const options = [
    { key: 'share', icon: 'share-outline' as const, bg: '#8B5CF6', iconColor: '#fff', onPress: handleShare },
    { key: 'copy', icon: 'copy-outline' as const, bg: '#3B82F6', iconColor: '#fff', onPress: handleCopyLink },
    { key: 'story', icon: 'sparkles' as const, bg: '#E1306C', iconColor: '#fff', label: 'Créer une story', onPress: onCreateStory },
  ];

  const rotate = rotateAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '135deg'],
  });

  return (
    <>
      {/* Backdrop */}
      {isOpen && (
        <Animated.View
          style={[StyleSheet.absoluteFill, { backgroundColor: 'rgba(0,0,0,0.2)', opacity: backdropAnim }]}
          pointerEvents="auto"
        >
          <Pressable style={StyleSheet.absoluteFill} onPress={toggleMenu} />
        </Animated.View>
      )}

      <View style={styles.fabContainer} pointerEvents="box-none">
        {/* Options */}
        {options.map((option, index) => {
          const anim = optionAnims[index];

          return (
            <Animated.View
              key={option.key}
              style={[
                styles.optionRow,
                {
                  opacity: anim,
                  transform: [
                    { scale: anim.interpolate({ inputRange: [0, 1], outputRange: [0.3, 1] }) },
                    { translateY: anim.interpolate({ inputRange: [0, 1], outputRange: [20, 0] }) },
                  ],
                },
              ]}
              pointerEvents={isOpen ? 'auto' : 'none'}
            >
              {/* Label (only for story) */}
              {option.label && (
                <Pressable
                  onPress={() => handleOptionPress(option.onPress)}
                  style={({ pressed }) => [
                    styles.optionLabel,
                    {
                      backgroundColor: colors.surface,
                      ...shadows.sm,
                    },
                    pressed && { opacity: 0.7 },
                  ]}
                >
                  <Text style={[styles.optionLabelText, { color: colors.text }]}>
                    {option.label}
                  </Text>
                </Pressable>
              )}

              <Pressable
                onPress={() => handleOptionPress(option.onPress)}
                style={({ pressed }) => [
                  styles.fabSecondary,
                  {
                    backgroundColor: option.bg,
                    borderRadius: radius.full,
                    ...shadows.md,
                    transform: [{ scale: pressed ? 0.88 : 1 }],
                  },
                ]}
              >
                <Ionicons name={option.icon} size={20} color={option.iconColor} />
              </Pressable>
            </Animated.View>
          );
        })}

        {/* Primary FAB */}
        <Animated.View
          style={[
            styles.fabWrapper,
            { transform: [{ scale: isOpen ? 1 : scaleAnim }] },
          ]}
        >
          <View style={[styles.fabGlow, { backgroundColor: colors.primary }]} />

          <Pressable
            onPress={toggleMenu}
            style={({ pressed }) => [
              styles.fab,
              {
                borderRadius: radius.full,
                ...shadows.lg,
                transform: [{ scale: pressed ? 0.92 : 1 }],
              },
            ]}
          >
            <LinearGradient
              colors={['#1a8cff', colors.primary, '#0d5baf']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={[styles.fabGradient, { borderRadius: radius.full }]}
            >
              <View style={styles.fabShine} />
              <Animated.View style={{ transform: [{ rotate }] }}>
                <Ionicons name={isOpen ? 'close' : 'share-social'} size={26} color="#fff" />
              </Animated.View>
            </LinearGradient>
          </Pressable>
        </Animated.View>
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  fabContainer: {
    position: 'absolute',
    bottom: 24,
    right: 20,
    alignItems: 'flex-end',
    gap: 12,
  },
  optionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  optionLabel: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 10,
  },
  optionLabelText: {
    fontSize: 13,
    fontWeight: '600',
  },
  fabSecondary: {
    width: 46,
    height: 46,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.2,
    shadowRadius: 5,
    elevation: 5,
  },
  fabWrapper: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  fabGlow: {
    position: 'absolute',
    width: 68,
    height: 68,
    borderRadius: 34,
    opacity: 0.2,
  },
  fab: {
    width: 58,
    height: 58,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  fabGradient: {
    width: 58,
    height: 58,
    alignItems: 'center',
    justifyContent: 'center',
  },
  fabShine: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: '45%',
    borderTopLeftRadius: 29,
    borderTopRightRadius: 29,
    backgroundColor: 'rgba(255,255,255,0.15)',
  },
});
