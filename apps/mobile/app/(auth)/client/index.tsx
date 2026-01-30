/**
 * Client Registration - Social First Screen
 * Choose registration method: Google, Apple, or Email
 */

import React, { useEffect, useRef } from 'react';
import { View, StyleSheet, Pressable, Animated, Dimensions } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../../theme';
import { Text, useToast } from '../../../components';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

// Bubble configuration for background animation
interface Bubble {
  size: number;
  startX: number;
  startY: number;
  color: string;
  duration: number;
  delay: number;
}

const BUBBLES: Bubble[] = [
  { size: 110, startX: -35, startY: SCREEN_HEIGHT * 0.12, color: 'rgba(26, 109, 175, 0.14)', duration: 9000, delay: 0 },
  { size: 75, startX: SCREEN_WIDTH - 55, startY: SCREEN_HEIGHT * 0.18, color: 'rgba(41, 139, 206, 0.11)', duration: 11000, delay: 300 },
  { size: 55, startX: SCREEN_WIDTH * 0.35, startY: SCREEN_HEIGHT * 0.55, color: 'rgba(26, 109, 175, 0.09)', duration: 13000, delay: 700 },
  { size: 85, startX: SCREEN_WIDTH - 65, startY: SCREEN_HEIGHT * 0.58, color: 'rgba(41, 139, 206, 0.12)', duration: 10000, delay: 150 },
  { size: 65, startX: 25, startY: SCREEN_HEIGHT * 0.68, color: 'rgba(26, 109, 175, 0.10)', duration: 12000, delay: 500 },
  { size: 45, startX: SCREEN_WIDTH * 0.6, startY: SCREEN_HEIGHT * 0.35, color: 'rgba(41, 139, 206, 0.08)', duration: 14000, delay: 800 },
];

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

    const floatY = Animated.loop(
      Animated.sequence([
        Animated.timing(translateY, {
          toValue: -25,
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

    const floatX = Animated.loop(
      Animated.sequence([
        Animated.timing(translateX, {
          toValue: 12,
          duration: bubble.duration / 2 + 800,
          useNativeDriver: true,
        }),
        Animated.timing(translateX, {
          toValue: -12,
          duration: bubble.duration / 2 + 800,
          useNativeDriver: true,
        }),
      ])
    );

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

export default function ClientSocialScreen() {
  const { colors, spacing, radius } = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { showToast } = useToast();

  // Animations
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(20)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 500,
        useNativeDriver: true,
      }),
      Animated.timing(slideAnim, {
        toValue: 0,
        duration: 500,
        useNativeDriver: true,
      }),
    ]).start();
  }, []);

  const handleGoogleSignIn = () => {
    showToast({
      variant: 'info',
      message: 'Google Sign-In bientôt disponible',
    });
  };

  const handleAppleSignIn = () => {
    showToast({
      variant: 'info',
      message: 'Apple Sign-In bientôt disponible',
    });
  };

  return (
    <LinearGradient
      colors={['#e4effa', '#f2f8fd', '#FFFFFF']}
      style={styles.gradientContainer}
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
          styles.container,
          {
            paddingTop: insets.top + spacing.md,
            paddingBottom: insets.bottom + spacing.lg,
            paddingHorizontal: spacing.lg,
          },
        ]}
      >
        {/* Back button */}
        <Pressable
          onPress={() => router.back()}
          style={({ pressed }) => [
            styles.backButton,
            {
              backgroundColor: '#FFFFFF',
              borderRadius: radius.full,
              shadowColor: colors.primary,
              shadowOffset: { width: 0, height: 2 },
              shadowOpacity: 0.1,
              shadowRadius: 8,
              elevation: 3,
              transform: [{ scale: pressed ? 0.95 : 1 }],
            },
          ]}
        >
          <Ionicons name="chevron-back" size={24} color={colors.primary} />
        </Pressable>

        {/* Header */}
        <Animated.View
          style={[
            styles.header,
            { marginTop: spacing.xl },
            { opacity: fadeAnim, transform: [{ translateY: slideAnim }] },
          ]}
        >
          <Text variant="h1" style={styles.headerTitle}>Créer un compte</Text>
          <Text
            variant="body"
            color="textSecondary"
            style={{ marginTop: spacing.xs }}
          >
            Réservez en quelques secondes
          </Text>
        </Animated.View>

        {/* Social buttons */}
        <Animated.View
          style={[
            styles.buttonsSection,
            { gap: 12 },
            { opacity: fadeAnim, transform: [{ translateY: slideAnim }] },
          ]}
        >
          {/* Google button */}
          <Pressable
            onPress={handleGoogleSignIn}
            style={({ pressed }) => [
              styles.socialButton,
              {
                backgroundColor: '#FFFFFF',
                borderColor: 'rgba(26, 109, 175, 0.15)',
                borderRadius: 16,
                transform: [{ scale: pressed ? 0.98 : 1 }],
              },
            ]}
          >
            <View style={[styles.socialIconContainer, { backgroundColor: 'rgba(26, 109, 175, 0.08)' }]}>
              <Ionicons name="logo-google" size={18} color={colors.primary} />
            </View>
            <Text variant="body" style={styles.socialButtonText}>
              Continuer avec Google
            </Text>
          </Pressable>

          {/* Apple button */}
          <Pressable
            onPress={handleAppleSignIn}
            style={({ pressed }) => [
              styles.socialButton,
              {
                backgroundColor: colors.primary,
                borderColor: colors.primary,
                borderRadius: 16,
                transform: [{ scale: pressed ? 0.98 : 1 }],
              },
            ]}
          >
            <View style={[styles.socialIconContainer, { backgroundColor: 'rgba(255, 255, 255, 0.2)' }]}>
              <Ionicons name="logo-apple" size={18} color="#FFFFFF" />
            </View>
            <Text variant="body" style={[styles.socialButtonText, { color: '#FFFFFF' }]}>
              Continuer avec Apple
            </Text>
          </Pressable>

          {/* Separator */}
          <View style={[styles.separator, { marginVertical: spacing.md }]}>
            <View style={[styles.separatorLine, { backgroundColor: colors.border }]} />
            <Text
              variant="caption"
              color="textSecondary"
              style={{ paddingHorizontal: spacing.md }}
            >
              ou
            </Text>
            <View style={[styles.separatorLine, { backgroundColor: colors.border }]} />
          </View>

          {/* Email button */}
          <Pressable
            onPress={() => router.push('/(auth)/client/email-form')}
            style={({ pressed }) => [
              styles.socialButton,
              {
                backgroundColor: '#FFFFFF',
                borderColor: 'rgba(26, 109, 175, 0.15)',
                borderRadius: 16,
                transform: [{ scale: pressed ? 0.98 : 1 }],
              },
            ]}
          >
            <View style={[styles.socialIconContainer, { backgroundColor: 'rgba(26, 109, 175, 0.08)' }]}>
              <Ionicons name="mail-outline" size={18} color={colors.primary} />
            </View>
            <Text variant="body" style={styles.socialButtonText}>
              Continuer avec email
            </Text>
          </Pressable>
        </Animated.View>

        {/* Legal text */}
        <Animated.View style={{ opacity: fadeAnim }}>
          <Text
            variant="caption"
            color="textSecondary"
            style={[styles.legalText, { marginTop: spacing.xl }]}
          >
            En continuant, vous acceptez nos CGU et Politique de confidentialité
          </Text>
        </Animated.View>

        {/* Footer link */}
        <Animated.View
          style={[
            styles.footer,
            { marginTop: spacing.lg },
            { opacity: fadeAnim },
          ]}
        >
          <Text variant="body" color="textSecondary">
            Déjà un compte ?{' '}
          </Text>
          <Pressable
            onPress={() => router.push('/(auth)/login')}
            style={({ pressed }) => ({ opacity: pressed ? 0.7 : 1 })}
          >
            <Text variant="body" color="primary" style={{ fontWeight: '600' }}>
              Se connecter
            </Text>
          </Pressable>
        </Animated.View>
      </View>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  gradientContainer: {
    flex: 1,
  },
  bubblesContainer: {
    ...StyleSheet.absoluteFillObject,
    overflow: 'hidden',
  },
  bubble: {
    position: 'absolute',
  },
  container: {
    flex: 1,
  },
  backButton: {
    width: 44,
    height: 44,
    justifyContent: 'center',
    alignItems: 'center',
  },
  header: {
    marginBottom: 32,
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: '700',
  },
  buttonsSection: {
    flex: 1,
    justifyContent: 'center',
  },
  socialButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    height: 56,
    width: '100%',
    borderWidth: 1,
    shadowColor: '#1a6daf',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 3,
  },
  socialIconContainer: {
    width: 32,
    height: 32,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  socialButtonText: {
    fontWeight: '600',
    fontSize: 15,
  },
  separator: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  separatorLine: {
    flex: 1,
    height: 1,
  },
  legalText: {
    textAlign: 'center',
    paddingHorizontal: 24,
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
  },
});
