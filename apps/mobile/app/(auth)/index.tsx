/**
 * Welcome Screen
 * Primary choice: Sign in or Create account
 */

import React, { useEffect, useRef } from 'react';
import { View, StyleSheet, Pressable, Animated, Easing, Dimensions } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../theme';
import { Text, Logo } from '../../components';
import { APP_CONFIG } from '@booking-app/shared/constants';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

// Bubble configuration
interface Bubble {
  size: number;
  startX: number;
  startY: number;
  color: string;
  duration: number;
  delay: number;
}

const BUBBLES: Bubble[] = [
  { size: 140, startX: -40, startY: SCREEN_HEIGHT * 0.15, color: 'rgba(59, 130, 246, 0.18)', duration: 8000, delay: 0 },
  { size: 100, startX: SCREEN_WIDTH - 70, startY: SCREEN_HEIGHT * 0.12, color: 'rgba(6, 182, 212, 0.15)', duration: 10000, delay: 500 },
  { size: 70, startX: SCREEN_WIDTH * 0.3, startY: SCREEN_HEIGHT * 0.55, color: 'rgba(59, 130, 246, 0.12)', duration: 12000, delay: 1000 },
  { size: 120, startX: SCREEN_WIDTH - 90, startY: SCREEN_HEIGHT * 0.45, color: 'rgba(6, 182, 212, 0.16)', duration: 9000, delay: 300 },
  { size: 60, startX: 30, startY: SCREEN_HEIGHT * 0.65, color: 'rgba(59, 130, 246, 0.14)', duration: 11000, delay: 800 },
  { size: 90, startX: SCREEN_WIDTH * 0.5, startY: SCREEN_HEIGHT * 0.25, color: 'rgba(6, 182, 212, 0.13)', duration: 13000, delay: 200 },
  { size: 50, startX: SCREEN_WIDTH * 0.15, startY: SCREEN_HEIGHT * 0.35, color: 'rgba(59, 130, 246, 0.15)', duration: 14000, delay: 600 },
  { size: 80, startX: SCREEN_WIDTH * 0.7, startY: SCREEN_HEIGHT * 0.7, color: 'rgba(6, 182, 212, 0.14)', duration: 11000, delay: 400 },
  { size: 45, startX: SCREEN_WIDTH * 0.85, startY: SCREEN_HEIGHT * 0.3, color: 'rgba(59, 130, 246, 0.12)', duration: 15000, delay: 900 },
];

// Animated floating bubble component
function FloatingBubble({ bubble }: { bubble: Bubble }) {
  const translateY = useRef(new Animated.Value(0)).current;
  const translateX = useRef(new Animated.Value(0)).current;
  const scale = useRef(new Animated.Value(0.8)).current;
  const opacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(opacity, {
      toValue: 1,
      duration: 1000,
      delay: bubble.delay,
      useNativeDriver: true,
    }).start();

    const easeInOut = Easing.inOut(Easing.sin);

    const floatY = Animated.loop(
      Animated.sequence([
        Animated.timing(translateY, { toValue: -30, duration: bubble.duration / 2, easing: easeInOut, useNativeDriver: true }),
        Animated.timing(translateY, { toValue: 0, duration: bubble.duration / 2, easing: easeInOut, useNativeDriver: true }),
      ])
    );

    const floatX = Animated.loop(
      Animated.sequence([
        Animated.timing(translateX, { toValue: 15, duration: bubble.duration / 3, easing: easeInOut, useNativeDriver: true }),
        Animated.timing(translateX, { toValue: -15, duration: bubble.duration / 3, easing: easeInOut, useNativeDriver: true }),
        Animated.timing(translateX, { toValue: 0, duration: bubble.duration / 3, easing: easeInOut, useNativeDriver: true }),
      ])
    );

    const pulse = Animated.loop(
      Animated.sequence([
        Animated.timing(scale, { toValue: 1, duration: bubble.duration / 2, easing: easeInOut, useNativeDriver: true }),
        Animated.timing(scale, { toValue: 0.85, duration: bubble.duration / 2, easing: easeInOut, useNativeDriver: true }),
      ])
    );

    setTimeout(() => {
      floatY.start();
      floatX.start();
      pulse.start();
    }, bubble.delay);

    return () => { floatY.stop(); floatX.stop(); pulse.stop(); };
  }, []);

  return (
    <Animated.View
      style={[
        styles.bubble,
        {
          width: bubble.size,
          height: bubble.size,
          borderRadius: bubble.size / 2,
          backgroundColor: bubble.color,
          left: bubble.startX,
          top: bubble.startY,
          transform: [{ translateY }, { translateX }, { scale }],
          opacity,
        },
      ]}
    />
  );
}

export default function WelcomeScreen() {
  const { spacing, radius } = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();

  // Entrance animations
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(30)).current;
  const logoScale = useRef(new Animated.Value(0.8)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, { toValue: 1, duration: 600, useNativeDriver: true }),
      Animated.timing(slideAnim, { toValue: 0, duration: 600, useNativeDriver: true }),
      Animated.spring(logoScale, { toValue: 1, tension: 50, friction: 7, useNativeDriver: true }),
    ]).start();
  }, []);

  return (
    <LinearGradient
      colors={['#DBEAFE', '#EFF6FF', '#F0F7FF']}
      style={styles.container}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
    >
      {/* Animated bubbles background */}
      <View style={styles.bubblesContainer} pointerEvents="none">
        {BUBBLES.map((bubble, index) => (
          <FloatingBubble key={index} bubble={bubble} />
        ))}
      </View>

      <View
        style={[
          styles.content,
          {
            paddingTop: insets.top + spacing['2xl'],
            paddingBottom: insets.bottom + spacing.lg,
            paddingHorizontal: spacing.lg,
          },
        ]}
      >
        {/* Logo + tagline */}
        <Animated.View
          style={[
            styles.logoSection,
            { opacity: fadeAnim, transform: [{ scale: logoScale }] },
          ]}
        >
          <Logo size="3xl" showText={false} />

          <Text variant="h1" style={[styles.title, { marginTop: spacing.xl }]}>
            Bienvenue sur {APP_CONFIG.name}
          </Text>

          <Text
            variant="body"
            color="textSecondary"
            style={[styles.subtitle, { marginTop: spacing.sm }]}
          >
            Réservez ou gérez vos rendez-vous{'\n'}en toute simplicité
          </Text>
        </Animated.View>

        {/* CTA buttons */}
        <Animated.View
          style={[
            styles.ctaSection,
            { gap: spacing.md, opacity: fadeAnim, transform: [{ translateY: slideAnim }] },
          ]}
        >
          {/* Se connecter — primary action */}
          <Pressable
            onPress={() => router.push('/(auth)/login')}
            style={({ pressed }) => [
              styles.primaryBtn,
              { borderRadius: radius.xl || 20, transform: [{ scale: pressed ? 0.97 : 1 }] },
            ]}
          >
            <LinearGradient
              colors={['#3B82F6', '#2563EB']}
              style={[StyleSheet.absoluteFill, { borderRadius: radius.xl || 20 }]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
            />
            <Ionicons name="log-in-outline" size={22} color="#FFFFFF" style={{ marginRight: 10 }} />
            <Text variant="body" style={styles.primaryBtnText}>Se connecter</Text>
          </Pressable>

          {/* Séparateur */}
          <View style={styles.divider}>
            <View style={styles.dividerLine} />
            <Text variant="caption" color="textSecondary" style={styles.dividerText}>
              ou
            </Text>
            <View style={styles.dividerLine} />
          </View>

          {/* Créer un compte — secondary action */}
          <Pressable
            onPress={() => router.push('/(auth)/choose-type')}
            style={({ pressed }) => [
              styles.secondaryBtn,
              { borderRadius: radius.xl || 20, transform: [{ scale: pressed ? 0.97 : 1 }] },
            ]}
          >
            <Ionicons name="person-add-outline" size={20} color="#3B82F6" style={{ marginRight: 10 }} />
            <Text variant="body" style={styles.secondaryBtnText}>Créer un compte</Text>
          </Pressable>
        </Animated.View>
      </View>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  bubblesContainer: { ...StyleSheet.absoluteFillObject, overflow: 'hidden' },
  bubble: { position: 'absolute' },
  content: { flex: 1 },
  logoSection: {
    alignItems: 'center',
    flex: 1,
    justifyContent: 'center',
  },
  title: {
    textAlign: 'center',
    fontSize: 28,
    fontWeight: '700',
  },
  subtitle: {
    textAlign: 'center',
    fontSize: 16,
    lineHeight: 24,
  },
  ctaSection: {
    paddingBottom: 8,
  },
  primaryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    height: 56,
    overflow: 'hidden',
    shadowColor: '#2563EB',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.25,
    shadowRadius: 12,
    elevation: 6,
  },
  primaryBtnText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 17,
  },
  divider: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: 'rgba(59, 130, 246, 0.2)',
  },
  dividerText: {
    paddingHorizontal: 16,
  },
  secondaryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    height: 56,
    borderWidth: 2,
    borderColor: '#3B82F6',
    backgroundColor: 'rgba(59, 130, 246, 0.05)',
  },
  secondaryBtnText: {
    color: '#3B82F6',
    fontWeight: '700',
    fontSize: 17,
  },
});
