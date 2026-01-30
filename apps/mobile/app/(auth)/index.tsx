/**
 * Welcome Gate Screen
 * Choose between Client or Pro registration
 */

import React, { useEffect, useRef } from 'react';
import { View, StyleSheet, Pressable, Animated, Dimensions } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../theme';
import { Text } from '../../components';

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
    // Fade in
    Animated.timing(opacity, {
      toValue: 1,
      duration: 1000,
      delay: bubble.delay,
      useNativeDriver: true,
    }).start();

    // Floating animation Y
    const floatY = Animated.loop(
      Animated.sequence([
        Animated.timing(translateY, {
          toValue: -30,
          duration: bubble.duration / 2,
          useNativeDriver: true,
        }),
        Animated.timing(translateY, {
          toValue: 0,
          duration: bubble.duration / 2,
          useNativeDriver: true,
        }),
      ])
    );

    // Floating animation X (subtle horizontal movement)
    const floatX = Animated.loop(
      Animated.sequence([
        Animated.timing(translateX, {
          toValue: 15,
          duration: bubble.duration / 2 + 1000,
          useNativeDriver: true,
        }),
        Animated.timing(translateX, {
          toValue: -15,
          duration: bubble.duration / 2 + 1000,
          useNativeDriver: true,
        }),
      ])
    );

    // Scale pulse
    const pulse = Animated.loop(
      Animated.sequence([
        Animated.timing(scale, {
          toValue: 1,
          duration: bubble.duration / 2,
          useNativeDriver: true,
        }),
        Animated.timing(scale, {
          toValue: 0.85,
          duration: bubble.duration / 2,
          useNativeDriver: true,
        }),
      ])
    );

    // Start animations with delay
    setTimeout(() => {
      floatY.start();
      floatX.start();
      pulse.start();
    }, bubble.delay);

    return () => {
      floatY.stop();
      floatX.stop();
      pulse.stop();
    };
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

export default function WelcomeGateScreen() {
  const { colors, spacing, radius } = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();

  // Card entrance animations
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(30)).current;
  const logoScale = useRef(new Animated.Value(0.8)).current;

  useEffect(() => {
    // Entrance animations
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 600,
        useNativeDriver: true,
      }),
      Animated.timing(slideAnim, {
        toValue: 0,
        duration: 600,
        useNativeDriver: true,
      }),
      Animated.spring(logoScale, {
        toValue: 1,
        tension: 50,
        friction: 7,
        useNativeDriver: true,
      }),
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
            paddingTop: insets.top + spacing.xl,
            paddingBottom: insets.bottom + spacing.lg,
            paddingHorizontal: spacing.lg,
          },
        ]}
      >
        {/* Logo section with animation */}
        <Animated.View
          style={[
            styles.logoSection,
            {
              opacity: fadeAnim,
              transform: [{ scale: logoScale }],
            },
          ]}
        >
          <LinearGradient
            colors={['#3B82F6', '#06B6D4']}
            style={styles.logoContainer}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
          >
            <Text variant="h1" style={styles.logoText}>
              OPATAM
            </Text>
          </LinearGradient>

          <Text variant="h1" style={[styles.title, { marginTop: spacing.xl }]}>
            Bienvenue sur Opatam
          </Text>

          <Text
            variant="body"
            color="textSecondary"
            style={[styles.subtitle, { marginTop: spacing.sm }]}
          >
            Que souhaitez-vous faire ?
          </Text>
        </Animated.View>

        {/* Cards section with entrance animation */}
        <Animated.View
          style={[
            styles.cardsSection,
            { gap: spacing.md },
            {
              opacity: fadeAnim,
              transform: [{ translateY: slideAnim }],
            },
          ]}
        >
          {/* Client Card */}
          <Pressable
            onPress={() => router.push('/(auth)/client')}
            style={({ pressed }) => [
              styles.card,
              styles.cardClient,
              {
                backgroundColor: '#FFFFFF',
                borderColor: 'rgba(59, 130, 246, 0.15)',
                borderRadius: radius.xl || 20,
                padding: spacing.lg,
                transform: [{ scale: pressed ? 0.97 : 1 }],
              },
            ]}
          >
            <View style={styles.cardContent}>
              <LinearGradient
                colors={['#EFF6FF', '#DBEAFE']}
                style={styles.cardIcon}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
              >
                <Ionicons name="person-outline" size={26} color="#3B82F6" />
              </LinearGradient>

              <View style={styles.cardTextContainer}>
                <Text variant="h3" style={styles.cardTitle}>
                  Je cherche un professionnel
                </Text>
                <Text variant="caption" color="textSecondary" style={styles.cardSubtitle}>
                  Réservez chez coiffeurs, spas, coachs...
                </Text>
              </View>

              <View style={styles.arrowContainer}>
                <Ionicons name="arrow-forward" size={18} color="#3B82F6" />
              </View>
            </View>
          </Pressable>

          {/* Pro Card */}
          <Pressable
            onPress={() => router.push('/(auth)/pro')}
            style={({ pressed }) => [
              styles.card,
              styles.cardPro,
              {
                borderRadius: radius.xl || 20,
                padding: spacing.lg,
                transform: [{ scale: pressed ? 0.97 : 1 }],
                overflow: 'hidden',
              },
            ]}
          >
            {/* Background gradient for pro card */}
            <LinearGradient
              colors={['#EFF6FF', '#DBEAFE']}
              style={StyleSheet.absoluteFill}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
            />

            <View style={styles.cardContent}>
              <LinearGradient
                colors={['#3B82F6', '#2563EB']}
                style={styles.cardIcon}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
              >
                <Ionicons name="briefcase-outline" size={26} color="#FFFFFF" />
              </LinearGradient>

              <View style={styles.cardTextContainer}>
                <Text variant="h3" style={styles.cardTitle}>
                  Je suis professionnel
                </Text>
                <Text variant="caption" color="textSecondary" style={styles.cardSubtitle}>
                  Gérez vos réservations et développez votre activité
                </Text>
              </View>

              <View style={[styles.arrowContainer, styles.arrowContainerPro]}>
                <Ionicons name="arrow-forward" size={18} color="#FFFFFF" />
              </View>
            </View>
          </Pressable>
        </Animated.View>

        {/* Login section - more prominent */}
        <Animated.View style={[styles.loginSection, { opacity: fadeAnim }]}>
          <View style={[styles.loginDivider, { marginBottom: spacing.md }]}>
            <View style={[styles.dividerLine, { backgroundColor: 'rgba(59, 130, 246, 0.2)' }]} />
            <Text variant="caption" color="textSecondary" style={styles.dividerText}>
              Déjà inscrit ?
            </Text>
            <View style={[styles.dividerLine, { backgroundColor: 'rgba(59, 130, 246, 0.2)' }]} />
          </View>

          <Pressable
            onPress={() => router.push('/(auth)/login')}
            style={({ pressed }) => [
              styles.loginButton,
              {
                borderColor: '#3B82F6',
                borderRadius: radius.lg || 16,
                transform: [{ scale: pressed ? 0.98 : 1 }],
              },
            ]}
          >
            <Ionicons name="log-in-outline" size={20} color="#3B82F6" style={{ marginRight: 8 }} />
            <Text variant="body" color="primary" style={styles.loginButtonText}>
              Se connecter
            </Text>
          </Pressable>
        </Animated.View>
      </View>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  bubblesContainer: {
    ...StyleSheet.absoluteFillObject,
    overflow: 'hidden',
  },
  bubble: {
    position: 'absolute',
  },
  content: {
    flex: 1,
  },
  logoSection: {
    alignItems: 'center',
    paddingVertical: 24,
  },
  logoContainer: {
    width: 100,
    height: 100,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#3B82F6',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.3,
    shadowRadius: 16,
    elevation: 8,
  },
  logoText: {
    fontSize: 16,
    fontWeight: '800',
    letterSpacing: 3,
    color: '#FFFFFF',
  },
  title: {
    textAlign: 'center',
    fontSize: 28,
    fontWeight: '700',
  },
  subtitle: {
    textAlign: 'center',
    fontSize: 16,
  },
  cardsSection: {
    flex: 1,
    justifyContent: 'center',
  },
  card: {
    width: '100%',
  },
  cardClient: {
    borderWidth: 1,
    shadowColor: '#3B82F6',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.08,
    shadowRadius: 16,
    elevation: 4,
  },
  cardPro: {
    borderWidth: 2,
    borderColor: '#3B82F6',
    shadowColor: '#3B82F6',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.15,
    shadowRadius: 20,
    elevation: 6,
  },
  cardContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  cardIcon: {
    width: 52,
    height: 52,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 14,
  },
  cardTextContainer: {
    flex: 1,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: '600',
  },
  cardSubtitle: {
    marginTop: 4,
    lineHeight: 18,
  },
  arrowContainer: {
    width: 36,
    height: 36,
    borderRadius: 12,
    backgroundColor: 'rgba(59, 130, 246, 0.1)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  arrowContainerPro: {
    backgroundColor: '#3B82F6',
  },
  loginSection: {
    paddingTop: 8,
    paddingBottom: 8,
  },
  loginDivider: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  dividerLine: {
    flex: 1,
    height: 1,
  },
  dividerText: {
    paddingHorizontal: 16,
  },
  loginButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    height: 52,
    borderWidth: 2,
    backgroundColor: 'rgba(59, 130, 246, 0.05)',
  },
  loginButtonText: {
    fontWeight: '600',
    fontSize: 15,
  },
});
