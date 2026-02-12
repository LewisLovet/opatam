/**
 * Pro Registration Screen
 * Redirect to web for provider registration
 */

import React, { useEffect, useRef } from 'react';
import { View, StyleSheet, Pressable, Linking, Animated, Dimensions } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../theme';
import { Text, Button } from '../../components';

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
  { size: 120, startX: -40, startY: SCREEN_HEIGHT * 0.1, color: 'rgba(26, 109, 175, 0.15)', duration: 9000, delay: 0 },
  { size: 80, startX: SCREEN_WIDTH - 60, startY: SCREEN_HEIGHT * 0.2, color: 'rgba(41, 139, 206, 0.12)', duration: 11000, delay: 350 },
  { size: 60, startX: SCREEN_WIDTH * 0.3, startY: SCREEN_HEIGHT * 0.5, color: 'rgba(26, 109, 175, 0.10)', duration: 13000, delay: 650 },
  { size: 90, startX: SCREEN_WIDTH - 70, startY: SCREEN_HEIGHT * 0.55, color: 'rgba(41, 139, 206, 0.13)', duration: 10000, delay: 200 },
  { size: 70, startX: 30, startY: SCREEN_HEIGHT * 0.7, color: 'rgba(26, 109, 175, 0.11)', duration: 12000, delay: 500 },
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

export default function ProScreen() {
  const { colors, spacing, radius } = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();

  // Animations
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(20)).current;
  const iconScale = useRef(new Animated.Value(0.8)).current;

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
      Animated.spring(iconScale, {
        toValue: 1,
        tension: 50,
        friction: 7,
        useNativeDriver: true,
      }),
    ]).start();
  }, []);

  const handleOpenWeb = () => {
    Linking.openURL('https://opatam.com/pro/register?source=mobile');
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
          <Text variant="h1" style={styles.headerTitle}>Espace Professionnel</Text>
        </Animated.View>

        {/* Content */}
        <Animated.View
          style={[
            styles.content,
            { opacity: fadeAnim, transform: [{ translateY: slideAnim }] },
          ]}
        >
          {/* Icon */}
          <Animated.View style={{ transform: [{ scale: iconScale }] }}>
            <LinearGradient
              colors={[colors.primary, '#298bce']}
              style={styles.iconContainer}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
            >
              <Ionicons name="briefcase-outline" size={56} color="#FFFFFF" />
            </LinearGradient>
          </Animated.View>

          <Text variant="h2" style={[styles.title, { marginTop: spacing.xl }]}>
            Créez votre compte pro sur notre site
          </Text>

          <Text
            variant="body"
            color="textSecondary"
            style={[styles.description, { marginTop: spacing.sm }]}
          >
            L'inscription se fait sur ordinateur pour configurer facilement votre activité.
          </Text>

          {/* Open web button */}
          <Pressable
            onPress={handleOpenWeb}
            style={({ pressed }) => [
              styles.webButton,
              {
                backgroundColor: colors.primary,
                borderRadius: 16,
                marginTop: spacing.xl,
                transform: [{ scale: pressed ? 0.98 : 1 }],
              },
            ]}
          >
            <View style={styles.webButtonIconContainer}>
              <Ionicons name="globe-outline" size={18} color="#FFFFFF" />
            </View>
            <Text variant="body" style={styles.webButtonText}>
              Ouvrir opatam.com/pro
            </Text>
          </Pressable>

          {/* Separator */}
          <View style={[styles.separator, { marginVertical: spacing.xl }]}>
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

          {/* Login section */}
          <Text variant="body" color="textSecondary">
            Déjà inscrit ?
          </Text>

          <Button
            variant="outline"
            title="Se connecter"
            onPress={() => router.push('/(auth)/login')}
            style={{ marginTop: spacing.md, width: '100%' }}
          />
        </Animated.View>

        {/* Info banner */}
        <Animated.View
          style={[
            styles.infoBanner,
            {
              backgroundColor: 'rgba(26, 109, 175, 0.08)',
              borderRadius: radius.lg,
              padding: spacing.md,
              borderWidth: 1,
              borderColor: 'rgba(26, 109, 175, 0.15)',
            },
            { opacity: fadeAnim },
          ]}
        >
          <View style={styles.infoBannerContent}>
            <Ionicons name="sparkles" size={18} color={colors.primary} style={{ marginRight: 8 }} />
            <Text variant="body" color="primary" style={styles.infoBannerText}>
              Essai gratuit 30 jours - Sans carte bancaire
            </Text>
          </View>
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
    // Dynamic styles
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: '700',
  },
  content: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconContainer: {
    width: 110,
    height: 110,
    borderRadius: 32,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#1a6daf',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.25,
    shadowRadius: 16,
    elevation: 8,
  },
  title: {
    textAlign: 'center',
  },
  description: {
    textAlign: 'center',
    maxWidth: 280,
  },
  webButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    height: 56,
    width: '100%',
    paddingHorizontal: 24,
    shadowColor: '#1a6daf',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 12,
    elevation: 4,
  },
  webButtonIconContainer: {
    width: 32,
    height: 32,
    borderRadius: 10,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  webButtonText: {
    fontWeight: '600',
    color: '#FFFFFF',
    fontSize: 15,
  },
  separator: {
    flexDirection: 'row',
    alignItems: 'center',
    width: '100%',
  },
  separatorLine: {
    flex: 1,
    height: 1,
  },
  infoBanner: {
    width: '100%',
  },
  infoBannerContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  infoBannerText: {
    fontWeight: '600',
  },
});
