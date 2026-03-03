/**
 * Onboarding Screen
 * Clean, text-focused design with large icons and smooth animations.
 * 3 slides with gradient background, no external images.
 */

import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import React, { useEffect, useRef, useState } from 'react';
import {
  Animated,
  Dimensions,
  NativeScrollEvent,
  NativeSyntheticEvent,
  Pressable,
  Text as RNText,
  ScrollView,
  StyleSheet,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { setOnboardingSeen } from '../../utils';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

const PRIMARY = '#1a6daf';
const PRIMARY_DARK = '#145a8f';

interface Slide {
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  subtitle: string;
  features: { icon: keyof typeof Ionicons.glyphMap; text: string }[];
}

const SLIDES: Slide[] = [
  {
    icon: 'calendar',
    title: 'Vos rendez-vous,\nenfin simplifiés',
    subtitle: 'Réservez en quelques clics, 24h/24, depuis votre téléphone.',
    features: [
      { icon: 'time-outline', text: 'Disponible à tout moment' },
      { icon: 'flash-outline', text: 'Réservation instantanée' },
      { icon: 'thumbs-up-outline', text: 'Simple et gratuit' },
    ],
  },
  {
    icon: 'notifications',
    title: 'Plus jamais de\nrendez-vous oublié',
    subtitle: 'Des rappels intelligents pour ne rien manquer.',
    features: [
      { icon: 'alarm-outline', text: 'Rappels automatiques' },
      { icon: 'chatbubble-outline', text: 'Notifications en temps réel' },
      { icon: 'calendar-outline', text: 'Synchronisation agenda' },
    ],
  },
  {
    icon: 'people',
    title: 'Tous les domaines,\nun seul endroit',
    subtitle: 'Des indépendants de confiance dans tous les secteurs.',
    features: [
      { icon: 'briefcase-outline', text: 'Beauté, sport, coaching, bien-être...' },
      { icon: 'location-outline', text: 'Des pros près de chez vous' },
      { icon: 'star-outline', text: 'Avis vérifiés par la communauté' },
    ],
  },
];

// Animated icon component with scale entrance
function AnimatedIcon({
  name,
  isActive,
}: {
  name: keyof typeof Ionicons.glyphMap;
  isActive: boolean;
}) {
  const scale = useRef(new Animated.Value(0.5)).current;
  const opacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (isActive) {
      Animated.parallel([
        Animated.spring(scale, {
          toValue: 1,
          friction: 6,
          tension: 80,
          useNativeDriver: true,
        }),
        Animated.timing(opacity, {
          toValue: 1,
          duration: 300,
          useNativeDriver: true,
        }),
      ]).start();
    } else {
      scale.setValue(0.5);
      opacity.setValue(0);
    }
  }, [isActive]);

  return (
    <Animated.View
      style={[
        styles.iconCircle,
        { transform: [{ scale }], opacity },
      ]}
    >
      <Ionicons name={name} size={48} color={PRIMARY} />
    </Animated.View>
  );
}

// Animated feature row
function AnimatedFeature({
  icon,
  text,
  delay,
  isActive,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  text: string;
  delay: number;
  isActive: boolean;
}) {
  const translateY = useRef(new Animated.Value(20)).current;
  const opacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (isActive) {
      Animated.parallel([
        Animated.timing(translateY, {
          toValue: 0,
          duration: 400,
          delay,
          useNativeDriver: true,
        }),
        Animated.timing(opacity, {
          toValue: 1,
          duration: 400,
          delay,
          useNativeDriver: true,
        }),
      ]).start();
    } else {
      translateY.setValue(20);
      opacity.setValue(0);
    }
  }, [isActive]);

  return (
    <Animated.View
      style={[
        styles.featureRow,
        { transform: [{ translateY }], opacity },
      ]}
    >
      <View style={styles.featureIconCircle}>
        <Ionicons name={icon} size={18} color="#FFF" />
      </View>
      <RNText style={styles.featureText}>{text}</RNText>
    </Animated.View>
  );
}

export default function OnboardingScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const scrollRef = useRef<ScrollView>(null);
  const [currentIndex, setCurrentIndex] = useState(0);

  const isLastSlide = currentIndex === SLIDES.length - 1;
  const currentSlide = SLIDES[currentIndex];

  const handleScrollEnd = (event: NativeSyntheticEvent<NativeScrollEvent>) => {
    const offsetX = event.nativeEvent.contentOffset.x;
    const index = Math.round(offsetX / SCREEN_WIDTH);
    setCurrentIndex(index);
  };

  const handleSkip = async () => {
    await setOnboardingSeen();
    router.replace('/(auth)');
  };

  const handleContinue = async () => {
    if (isLastSlide) {
      await setOnboardingSeen();
      router.replace('/(auth)');
    } else {
      scrollRef.current?.scrollTo({
        x: (currentIndex + 1) * SCREEN_WIDTH,
        animated: true,
      });
    }
  };

  const ctaText = isLastSlide ? "C'est parti !" : 'Continuer';

  return (
    <View style={styles.container}>
      <LinearGradient
        colors={[PRIMARY, PRIMARY_DARK]}
        style={StyleSheet.absoluteFill}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
      />

      {/* Skip button */}
      <Pressable
        onPress={handleSkip}
        style={[styles.skipButton, { top: insets.top + 12 }]}
      >
        <RNText style={styles.skipText}>Passer</RNText>
      </Pressable>

      {/* Slides */}
      <ScrollView
        ref={scrollRef}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onMomentumScrollEnd={handleScrollEnd}
        scrollEventThrottle={16}
        style={styles.scrollView}
      >
        {SLIDES.map((slide, index) => (
          <View
            key={index}
            style={[styles.slide, { width: SCREEN_WIDTH, paddingTop: insets.top + 60 }]}
          >
            {/* Icon */}
            <AnimatedIcon name={slide.icon} isActive={currentIndex === index} />

            {/* Title */}
            <RNText style={styles.title}>{slide.title}</RNText>

            {/* Subtitle */}
            <RNText style={styles.subtitle}>{slide.subtitle}</RNText>

            {/* Feature list */}
            <View style={styles.featuresContainer}>
              {slide.features.map((feature, i) => (
                <AnimatedFeature
                  key={i}
                  icon={feature.icon}
                  text={feature.text}
                  delay={200 + i * 150}
                  isActive={currentIndex === index}
                />
              ))}
            </View>
          </View>
        ))}
      </ScrollView>

      {/* Bottom section */}
      <View style={[styles.bottomSection, { paddingBottom: insets.bottom + 24 }]}>
        {/* Dots */}
        <View style={styles.dotsContainer}>
          {SLIDES.map((_, dotIndex) => (
            <View
              key={dotIndex}
              style={[
                styles.dot,
                dotIndex === currentIndex ? styles.dotActive : styles.dotInactive,
              ]}
            />
          ))}
        </View>

        {/* CTA Button */}
        <Pressable
          onPress={handleContinue}
          style={({ pressed }) => [
            styles.ctaButton,
            { opacity: pressed ? 0.9 : 1 },
          ]}
        >
          <RNText style={styles.ctaText}>{ctaText}</RNText>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollView: {
    flex: 1,
  },
  skipButton: {
    position: 'absolute',
    right: 24,
    zIndex: 10,
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: 'rgba(255,255,255,0.15)',
    borderRadius: 20,
  },
  skipText: {
    fontSize: 15,
    fontWeight: '500',
    color: 'rgba(255,255,255,0.8)',
  },

  // Slide
  slide: {
    flex: 1,
    alignItems: 'center',
    paddingHorizontal: 32,
  },

  // Icon
  iconCircle: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 32,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.15,
    shadowRadius: 16,
    elevation: 8,
  },

  // Text
  title: {
    fontSize: 28,
    fontWeight: '800',
    color: '#FFFFFF',
    textAlign: 'center',
    lineHeight: 36,
    marginBottom: 16,
  },
  subtitle: {
    fontSize: 16,
    color: 'rgba(255,255,255,0.8)',
    textAlign: 'center',
    lineHeight: 24,
    marginBottom: 36,
    paddingHorizontal: 8,
  },

  // Features
  featuresContainer: {
    width: '100%',
    gap: 16,
  },
  featureRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.12)',
    paddingVertical: 14,
    paddingHorizontal: 18,
    borderRadius: 14,
  },
  featureIconCircle: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 14,
  },
  featureText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#FFFFFF',
    flex: 1,
  },

  // Bottom
  bottomSection: {
    paddingHorizontal: 24,
    alignItems: 'center',
  },
  dotsContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
    marginBottom: 24,
  },
  dot: {
    height: 8,
    borderRadius: 4,
  },
  dotActive: {
    width: 24,
    backgroundColor: '#FFFFFF',
  },
  dotInactive: {
    width: 8,
    backgroundColor: 'rgba(255,255,255,0.35)',
  },
  ctaButton: {
    backgroundColor: '#FFFFFF',
    paddingVertical: 16,
    borderRadius: 16,
    width: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 56,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
  ctaText: {
    fontSize: 18,
    fontWeight: '700',
    color: PRIMARY,
  },
});
