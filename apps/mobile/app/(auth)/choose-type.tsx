/**
 * Choose Account Type Screen
 * Select between Client (book services) or Pro (offer services)
 */

import React, { useEffect, useRef } from 'react';
import { View, StyleSheet, Pressable, Animated, Easing, Dimensions } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../theme';
import { Text } from '../../components';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

// Reuse bubbles for visual consistency
interface Bubble {
  size: number;
  startX: number;
  startY: number;
  color: string;
  duration: number;
  delay: number;
}

const BUBBLES: Bubble[] = [
  { size: 120, startX: -30, startY: SCREEN_HEIGHT * 0.1, color: 'rgba(59, 130, 246, 0.15)', duration: 9000, delay: 0 },
  { size: 80, startX: SCREEN_WIDTH - 50, startY: SCREEN_HEIGHT * 0.08, color: 'rgba(6, 182, 212, 0.12)', duration: 11000, delay: 300 },
  { size: 60, startX: SCREEN_WIDTH * 0.4, startY: SCREEN_HEIGHT * 0.5, color: 'rgba(59, 130, 246, 0.1)', duration: 13000, delay: 600 },
  { size: 90, startX: SCREEN_WIDTH - 70, startY: SCREEN_HEIGHT * 0.6, color: 'rgba(6, 182, 212, 0.13)', duration: 10000, delay: 200 },
  { size: 50, startX: 20, startY: SCREEN_HEIGHT * 0.7, color: 'rgba(59, 130, 246, 0.12)', duration: 12000, delay: 500 },
];

function FloatingBubble({ bubble }: { bubble: Bubble }) {
  const translateY = useRef(new Animated.Value(0)).current;
  const scale = useRef(new Animated.Value(0.9)).current;
  const opacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(opacity, { toValue: 1, duration: 800, delay: bubble.delay, useNativeDriver: true }).start();

    const easeInOut = Easing.inOut(Easing.sin);

    const floatY = Animated.loop(
      Animated.sequence([
        Animated.timing(translateY, { toValue: -20, duration: bubble.duration / 2, easing: easeInOut, useNativeDriver: true }),
        Animated.timing(translateY, { toValue: 0, duration: bubble.duration / 2, easing: easeInOut, useNativeDriver: true }),
      ])
    );

    const pulse = Animated.loop(
      Animated.sequence([
        Animated.timing(scale, { toValue: 1, duration: bubble.duration / 2, easing: easeInOut, useNativeDriver: true }),
        Animated.timing(scale, { toValue: 0.9, duration: bubble.duration / 2, easing: easeInOut, useNativeDriver: true }),
      ])
    );

    setTimeout(() => { floatY.start(); pulse.start(); }, bubble.delay);
    return () => { floatY.stop(); pulse.stop(); };
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
          transform: [{ translateY }, { scale }],
          opacity,
        },
      ]}
    />
  );
}

export default function ChooseTypeScreen() {
  const { colors, spacing, radius } = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();

  // Entrance animations
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(40)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, { toValue: 1, duration: 500, useNativeDriver: true }),
      Animated.timing(slideAnim, { toValue: 0, duration: 500, useNativeDriver: true }),
    ]).start();
  }, []);

  return (
    <LinearGradient
      colors={['#DBEAFE', '#EFF6FF', '#F0F7FF']}
      style={styles.container}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
    >
      {/* Bubbles */}
      <View style={styles.bubblesContainer} pointerEvents="none">
        {BUBBLES.map((bubble, index) => (
          <FloatingBubble key={index} bubble={bubble} />
        ))}
      </View>

      <View
        style={[
          styles.content,
          {
            paddingTop: insets.top + spacing.sm,
            paddingBottom: insets.bottom + spacing.xl,
            paddingHorizontal: spacing.lg,
          },
        ]}
      >
        {/* Back button */}
        <Pressable
          onPress={() => router.back()}
          style={({ pressed }) => [styles.backBtn, { opacity: pressed ? 0.6 : 1 }]}
        >
          <Ionicons name="chevron-back" size={24} color="#1E3A5F" />
        </Pressable>

        {/* Title section */}
        <Animated.View
          style={[styles.titleSection, { opacity: fadeAnim }]}
        >
          <Text variant="h1" style={styles.title}>
            Comment allez-vous{'\n'}utiliser OPATAM ?
          </Text>
          <Text variant="body" color="textSecondary" style={styles.subtitle}>
            Choisissez votre profil pour commencer
          </Text>
        </Animated.View>

        {/* Cards */}
        <Animated.View
          style={[
            styles.cardsSection,
            { gap: spacing.lg, opacity: fadeAnim, transform: [{ translateY: slideAnim }] },
          ]}
        >
          {/* Client Card */}
          <Pressable
            onPress={() => router.push('/(auth)/client')}
            style={({ pressed }) => [
              styles.card,
              {
                backgroundColor: '#FFFFFF',
                borderRadius: radius.xl || 20,
                borderColor: 'rgba(59, 130, 246, 0.12)',
                transform: [{ scale: pressed ? 0.97 : 1 }],
              },
            ]}
          >
            <View style={styles.cardInner}>
              {/* Icon */}
              <LinearGradient
                colors={['#EFF6FF', '#DBEAFE']}
                style={styles.cardIconBg}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
              >
                <Ionicons name="search-outline" size={32} color="#3B82F6" />
              </LinearGradient>

              {/* Text */}
              <Text variant="h2" style={styles.cardTitle}>
                Réserver un service
              </Text>
              <Text variant="body" color="textSecondary" style={styles.cardDesc}>
                Trouvez et réservez chez des professionnels près de chez vous
              </Text>

              {/* Bottom row */}
              <View style={styles.cardFooter}>
                <View style={styles.cardChips}>
                  <View style={styles.chip}>
                    <Text variant="caption" style={styles.chipText}>Coiffeurs</Text>
                  </View>
                  <View style={styles.chip}>
                    <Text variant="caption" style={styles.chipText}>Spas</Text>
                  </View>
                  <View style={styles.chip}>
                    <Text variant="caption" style={styles.chipText}>Coachs</Text>
                  </View>
                </View>
                <View style={styles.arrowBtn}>
                  <Ionicons name="arrow-forward" size={20} color="#3B82F6" />
                </View>
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
                transform: [{ scale: pressed ? 0.97 : 1 }],
                overflow: 'hidden',
              },
            ]}
          >
            <LinearGradient
              colors={['#1E40AF', '#2563EB']}
              style={StyleSheet.absoluteFill}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
            />

            <View style={styles.cardInner}>
              {/* Icon */}
              <View style={[styles.cardIconBg, { backgroundColor: 'rgba(255,255,255,0.15)' }]}>
                <Ionicons name="briefcase-outline" size={32} color="#FFFFFF" />
              </View>

              {/* Text */}
              <Text variant="h2" style={[styles.cardTitle, { color: '#FFFFFF' }]}>
                Proposer mes services
              </Text>
              <Text variant="body" style={[styles.cardDesc, { color: 'rgba(255,255,255,0.8)' }]}>
                Gérez vos réservations et développez votre activité
              </Text>

              {/* Bottom row */}
              <View style={styles.cardFooter}>
                <View style={styles.cardChips}>
                  <View style={[styles.chip, styles.chipPro]}>
                    <Text variant="caption" style={[styles.chipText, { color: '#FFFFFF' }]}>Agenda</Text>
                  </View>
                  <View style={[styles.chip, styles.chipPro]}>
                    <Text variant="caption" style={[styles.chipText, { color: '#FFFFFF' }]}>Clients</Text>
                  </View>
                  <View style={[styles.chip, styles.chipPro]}>
                    <Text variant="caption" style={[styles.chipText, { color: '#FFFFFF' }]}>Stats</Text>
                  </View>
                </View>
                <View style={[styles.arrowBtn, { backgroundColor: 'rgba(255,255,255,0.2)' }]}>
                  <Ionicons name="arrow-forward" size={20} color="#FFFFFF" />
                </View>
              </View>
            </View>
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
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.6)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  titleSection: {
    marginTop: 24,
    marginBottom: 32,
  },
  title: {
    fontSize: 26,
    fontWeight: '700',
    lineHeight: 34,
  },
  subtitle: {
    fontSize: 15,
    marginTop: 8,
  },
  cardsSection: {
    flex: 1,
    justifyContent: 'center',
  },
  card: {
    borderWidth: 1,
    shadowColor: '#3B82F6',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.08,
    shadowRadius: 16,
    elevation: 4,
  },
  cardPro: {
    borderWidth: 0,
    shadowOpacity: 0.2,
    shadowRadius: 20,
    elevation: 6,
  },
  cardInner: {
    padding: 24,
  },
  cardIconBg: {
    width: 60,
    height: 60,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  cardTitle: {
    fontSize: 20,
    fontWeight: '700',
  },
  cardDesc: {
    fontSize: 14,
    lineHeight: 20,
    marginTop: 6,
  },
  cardFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 20,
  },
  cardChips: {
    flexDirection: 'row',
    gap: 6,
  },
  chip: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 20,
    backgroundColor: 'rgba(59, 130, 246, 0.08)',
  },
  chipPro: {
    backgroundColor: 'rgba(255,255,255,0.15)',
  },
  chipText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#3B82F6',
  },
  arrowBtn: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: 'rgba(59, 130, 246, 0.1)',
    alignItems: 'center',
    justifyContent: 'center',
  },
});
