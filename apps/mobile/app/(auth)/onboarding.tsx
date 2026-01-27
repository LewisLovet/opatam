/**
 * Onboarding Screen
 * First-time user experience with 3 slides
 */

import React, { useState, useRef } from 'react';
import {
  View,
  StyleSheet,
  ScrollView,
  Dimensions,
  Pressable,
  NativeSyntheticEvent,
  NativeScrollEvent,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../theme';
import { Text, Button } from '../../components';
import { setOnboardingSeen } from '../../utils';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

interface Slide {
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  description: string;
}

const SLIDES: Slide[] = [
  {
    icon: 'calendar-outline',
    title: 'Réservez en 30 secondes',
    description: 'Trouvez et réservez chez vos professionnels préférés en quelques clics',
  },
  {
    icon: 'notifications-outline',
    title: 'Rappels automatiques',
    description: 'Ne manquez plus jamais un rendez-vous grâce aux notifications',
  },
  {
    icon: 'star-outline',
    title: 'Service gratuit',
    description: '0% de commission pour les clients',
  },
];

export default function OnboardingScreen() {
  const { colors, spacing } = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const scrollRef = useRef<ScrollView>(null);

  const [currentIndex, setCurrentIndex] = useState(0);

  const isLastSlide = currentIndex === SLIDES.length - 1;

  const handleScroll = (event: NativeSyntheticEvent<NativeScrollEvent>) => {
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

  return (
    <View
      style={[
        styles.container,
        {
          backgroundColor: colors.background,
          paddingTop: insets.top,
          paddingBottom: insets.bottom + spacing.lg,
        },
      ]}
    >
      {/* Skip button */}
      <Pressable
        onPress={handleSkip}
        style={[styles.skipButton, { paddingHorizontal: spacing.lg, paddingVertical: spacing.md }]}
      >
        <Text variant="body" color="primary">
          Passer →
        </Text>
      </Pressable>

      {/* Slides */}
      <ScrollView
        ref={scrollRef}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onScroll={handleScroll}
        scrollEventThrottle={16}
        style={styles.scrollView}
      >
        {SLIDES.map((slide, index) => (
          <View key={index} style={[styles.slide, { width: SCREEN_WIDTH }]}>
            <View
              style={[
                styles.iconContainer,
                { backgroundColor: colors.primaryLight },
              ]}
            >
              <Ionicons name={slide.icon} size={80} color={colors.primary} />
            </View>

            <Text variant="h1" style={[styles.title, { marginTop: spacing.xl }]}>
              {slide.title}
            </Text>

            <Text
              variant="body"
              color="textSecondary"
              style={[styles.description, { marginTop: spacing.md, paddingHorizontal: spacing.xl }]}
            >
              {slide.description}
            </Text>
          </View>
        ))}
      </ScrollView>

      {/* Bottom section */}
      <View style={[styles.bottomSection, { paddingHorizontal: spacing.lg, gap: spacing.lg }]}>
        {/* Pagination dots */}
        <View style={[styles.pagination, { gap: spacing.sm }]}>
          {SLIDES.map((_, index) => (
            <View
              key={index}
              style={[
                styles.dot,
                {
                  backgroundColor:
                    index === currentIndex ? colors.primary : colors.border,
                },
              ]}
            />
          ))}
        </View>

        {/* Continue button */}
        <Button
          variant="primary"
          title={isLastSlide ? 'Commencer' : 'Continuer'}
          onPress={handleContinue}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  skipButton: {
    alignSelf: 'flex-end',
  },
  scrollView: {
    flex: 1,
  },
  slide: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconContainer: {
    width: 160,
    height: 160,
    borderRadius: 80,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    textAlign: 'center',
  },
  description: {
    textAlign: 'center',
    maxWidth: 300,
  },
  bottomSection: {
    width: '100%',
  },
  pagination: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
});
