/**
 * Onboarding Screen
 * First-time user experience with gradient slides
 * Bottom container stays fixed, only visuals and text slide
 */

import { Ionicons } from '@expo/vector-icons';
import { Image, ImageSource } from 'expo-image';
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

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

// Fixed gradient color for all slides (using Black Pearl palette)
const GRADIENT_COLORS = ['#1a6daf', '#298bce'] as const;
const PRIMARY_COLOR = '#1a6daf';

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
  { size: 100, startX: -30, startY: SCREEN_HEIGHT * 0.08, color: 'rgba(26, 109, 175, 0.15)', duration: 9000, delay: 0 },
  { size: 70, startX: SCREEN_WIDTH - 50, startY: SCREEN_HEIGHT * 0.12, color: 'rgba(41, 139, 206, 0.12)', duration: 11000, delay: 400 },
  { size: 50, startX: SCREEN_WIDTH * 0.4, startY: SCREEN_HEIGHT * 0.35, color: 'rgba(26, 109, 175, 0.10)', duration: 13000, delay: 800 },
  { size: 80, startX: SCREEN_WIDTH - 60, startY: SCREEN_HEIGHT * 0.28, color: 'rgba(41, 139, 206, 0.13)', duration: 10000, delay: 200 },
  { size: 60, startX: 20, startY: SCREEN_HEIGHT * 0.42, color: 'rgba(26, 109, 175, 0.11)', duration: 12000, delay: 600 },
  { size: 45, startX: SCREEN_WIDTH * 0.7, startY: SCREEN_HEIGHT * 0.18, color: 'rgba(41, 139, 206, 0.09)', duration: 14000, delay: 300 },
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

// Image URLs and blurhashes
const IMAGES = {
  lifestyle: {
    uri: 'https://images.unsplash.com/photo-1595476108010-b4d1f102b1b1?w=800&q=80',
    blurhash: 'LKO2?V%2Tw=w]~RBVZRi};RPxuwH',
  },
  coiffure: {
    uri: 'https://images.unsplash.com/photo-1560066984-138dadb4c035?w=400&q=80',
    blurhash: 'L5H2EC=PM+yV0g-mq.wG9c010J}I',
  },
  massage: {
    uri: 'https://images.unsplash.com/photo-1544161515-4ab6ce6db874?w=400&q=80',
    blurhash: 'L8Sp,0%M4n-;~qM{RjWB00xu9F%M',
  },
  coaching: {
    uri: 'https://images.unsplash.com/photo-1571019614242-c5c5dee9f50b?w=400&q=80',
    blurhash: 'LGF~K[00?v~q_3?bIUM{RjM{M{xu',
  },
  beaute: {
    uri: 'https://images.unsplash.com/photo-1522335789203-aabd1fc54bc9?w=400&q=80',
    blurhash: 'LLKnBt~q9F%M~qM{IUM{D%Rjt7Rj',
  },
};

interface Slide {
  title: string;
  subtitle: string;
}

const SLIDES: Slide[] = [
  {
    title: 'Vos rendez-vous, enfin simplifiés',
    subtitle: 'Coiffeur, spa, coach... Réservez en 2 clics, 24h/24',
  },
  {
    title: 'Plus jamais de rendez-vous oublié',
    subtitle: 'Recevez des rappels automatiques par notification',
  },
  {
    title: '+500 professionnels vous attendent',
    subtitle: 'Coiffure • Beauté • Spa • Sport • Santé • Bien-être',
  },
];

// Slide 1 - Lifestyle Image (full screen)
function Slide1Visual() {
  return (
    <Image
      source={IMAGES.lifestyle}
      style={StyleSheet.absoluteFill}
      placeholder={{ blurhash: IMAGES.lifestyle.blurhash }}
      contentFit="cover"
      transition={300}
    />
  );
}

// Slide 2 - Phone Mockup with Notifications + Bubbles
function Slide2Visual() {
  return (
    <View style={styles.visualSlideWithBubbles}>
      {/* Animated bubbles background */}
      <View style={styles.bubblesContainer} pointerEvents="none">
        {BUBBLES.map((bubble, index) => (
          <FloatingBubble key={index} bubble={bubble} />
        ))}
      </View>

      <View style={styles.visualContainer}>
        <View style={styles.phoneFrame}>
          <View style={styles.statusBar}>
            <RNText style={styles.statusTime}>9:41</RNText>
            <View style={styles.statusIcons}>
              <Ionicons name="cellular" size={14} color="#000" />
              <Ionicons name="wifi" size={14} color="#000" style={{ marginLeft: 4 }} />
              <Ionicons name="battery-full" size={14} color="#000" style={{ marginLeft: 4 }} />
            </View>
          </View>

          <View style={styles.notificationsContainer}>
            <View style={styles.notification}>
              <View style={[styles.notificationIcon, { backgroundColor: '#1a6daf' }]}>
                <Ionicons name="calendar" size={16} color="#FFF" />
              </View>
              <View style={styles.notificationContent}>
                <RNText style={styles.notificationApp}>Opatam</RNText>
                <RNText style={styles.notificationTitle}>Rappel RDV demain</RNText>
                <RNText style={styles.notificationBody}>Coiffure chez Marie • 14h00</RNText>
              </View>
              <RNText style={styles.notificationTime}>maintenant</RNText>
            </View>

            <View style={styles.notification}>
              <View style={[styles.notificationIcon, { backgroundColor: '#10B981' }]}>
                <Ionicons name="checkmark-circle" size={16} color="#FFF" />
              </View>
              <View style={styles.notificationContent}>
                <RNText style={styles.notificationApp}>Opatam</RNText>
                <RNText style={styles.notificationTitle}>Réservation confirmée</RNText>
                <RNText style={styles.notificationBody}>Massage relaxant • Lun 15 jan</RNText>
              </View>
              <RNText style={styles.notificationTime}>il y a 2h</RNText>
            </View>
          </View>
        </View>
      </View>
    </View>
  );
}

// Slide 3 - Category Grid + Bubbles
function Slide3Visual() {
  const categories = [
    { image: IMAGES.coiffure, label: 'Coiffure' },
    { image: IMAGES.massage, label: 'Massage' },
    { image: IMAGES.coaching, label: 'Coaching' },
    { image: IMAGES.beaute, label: 'Beauté' },
  ];

  return (
    <View style={styles.visualSlideWithBubbles}>
      {/* Animated bubbles background */}
      <View style={styles.bubblesContainer} pointerEvents="none">
        {BUBBLES.map((bubble, index) => (
          <FloatingBubble key={`slide3-${index}`} bubble={bubble} />
        ))}
      </View>

      <View style={styles.visualContainer}>
        <View style={styles.photoGrid}>
          {categories.map((category, index) => (
            <View key={index} style={styles.gridItem}>
              <Image
                source={category.image}
                style={styles.gridImage}
                placeholder={{ blurhash: category.image.blurhash }}
                contentFit="cover"
                transition={300}
              />
              <LinearGradient
                colors={['transparent', 'rgba(0,0,0,0.6)']}
                style={styles.gridOverlay}
              />
              <RNText style={styles.gridLabel}>{category.label}</RNText>
            </View>
          ))}
        </View>
      </View>
    </View>
  );
}

export default function OnboardingScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const scrollRef = useRef<ScrollView>(null);

  const [currentIndex, setCurrentIndex] = useState(0);

  const isLastSlide = currentIndex === SLIDES.length - 1;
  const isFirstSlide = currentIndex === 0;
  const currentSlide = SLIDES[currentIndex];

  // Preload images
  useEffect(() => {
    const imageSources: ImageSource[] = [
      IMAGES.lifestyle,
      IMAGES.coiffure,
      IMAGES.massage,
      IMAGES.coaching,
      IMAGES.beaute,
    ];
    Image.prefetch(imageSources.map((img) => img.uri));
  }, []);

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

  // Render visual based on slide index
  const renderVisual = (index: number) => {
    switch (index) {
      case 0:
        return <Slide1Visual />;
      case 1:
        return <Slide2Visual />;
      case 2:
        return <Slide3Visual />;
      default:
        return null;
    }
  };

  return (
    <View style={styles.container}>
      {/* Skip button */}
      <Pressable
        onPress={handleSkip}
        style={[
          styles.skipButton,
          { top: insets.top + 16 },
          isFirstSlide && styles.skipButtonOnImage,
        ]}
      >
        <RNText style={[styles.skipText, isFirstSlide && styles.skipTextOnImage]}>
          Passer
        </RNText>
      </Pressable>

      {/* Visuals ScrollView - takes full screen, bottom container overlays */}
      <View style={styles.visualsWrapper}>
        <ScrollView
          ref={scrollRef}
          horizontal
          pagingEnabled
          showsHorizontalScrollIndicator={false}
          onMomentumScrollEnd={handleScrollEnd}
          scrollEventThrottle={16}
          style={StyleSheet.absoluteFill}
        >
          {SLIDES.map((_, index) => (
            <View
              key={index}
              style={[
                styles.visualSlide,
                { width: SCREEN_WIDTH, height: SCREEN_HEIGHT },
                index !== 0 && styles.visualSlideWithBackground,
              ]}
            >
              {renderVisual(index)}
            </View>
          ))}
        </ScrollView>
      </View>

      {/* Fixed bottom container - overlays on top of visuals */}
      <LinearGradient
        colors={GRADIENT_COLORS}
        style={[styles.bottomContainer, { paddingBottom: insets.bottom + 24 }]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
      >
        {/* Title and subtitle - these change based on current slide */}
        <RNText style={styles.slideTitle}>{currentSlide?.title}</RNText>
        <RNText style={styles.slideSubtitle}>{currentSlide?.subtitle}</RNText>

        {/* Dots - fixed position */}
        <View style={styles.dotsContainer}>
          {SLIDES.map((_, dotIndex) => (
            <View
              key={dotIndex}
              style={[
                styles.dot,
                dotIndex === currentIndex ? styles.dotActiveWhite : styles.dotInactiveWhite,
              ]}
            />
          ))}
        </View>

        {/* Button - fixed position */}
        <Pressable
          onPress={handleContinue}
          style={({ pressed }) => [
            styles.ctaButton,
            { opacity: pressed ? 0.9 : 1 },
          ]}
        >
          <RNText style={[styles.ctaText, { color: PRIMARY_COLOR }]}>{ctaText}</RNText>
        </Pressable>
      </LinearGradient>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F9FAFB',
  },
  skipButton: {
    position: 'absolute',
    right: 24,
    zIndex: 10,
    padding: 8,
  },
  skipButtonOnImage: {
    backgroundColor: 'rgba(0,0,0,0.3)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
  },
  skipText: {
    fontSize: 16,
    color: 'rgba(0,0,0,0.5)',
  },
  skipTextOnImage: {
    color: '#fff',
  },

  // Visuals wrapper - takes FULL screen height, bottom container overlays on top
  visualsWrapper: {
    ...StyleSheet.absoluteFillObject,
  },

  // Individual visual slide
  visualSlide: {
    flex: 1,
  },
  visualSlideWithBackground: {
    backgroundColor: '#e4effa', // Light blue pastel for slides 2 and 3
  },
  visualSlideWithBubbles: {
    flex: 1,
    position: 'relative',
  },

  // Bubbles container
  bubblesContainer: {
    ...StyleSheet.absoluteFillObject,
    overflow: 'hidden',
  },
  bubble: {
    position: 'absolute',
  },

  // Fixed bottom container - positioned absolute to overlay on visuals
  bottomContainer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    borderTopLeftRadius: 32,
    borderTopRightRadius: 32,
    paddingHorizontal: 24,
    paddingTop: 32,
    alignItems: 'center',
  },

  slideTitle: {
    fontSize: 26,
    fontWeight: '700',
    color: '#FFFFFF',
    textAlign: 'center',
    marginBottom: 12,
  },
  slideSubtitle: {
    fontSize: 16,
    color: 'rgba(255,255,255,0.85)',
    textAlign: 'center',
    lineHeight: 24,
  },

  // Dots
  dotsContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
    marginTop: 24,
  },
  dot: {
    height: 8,
    borderRadius: 4,
  },
  dotActiveWhite: {
    width: 24,
    backgroundColor: '#FFFFFF',
  },
  dotInactiveWhite: {
    width: 8,
    backgroundColor: 'rgba(255,255,255,0.4)',
  },

  // CTA Button
  ctaButton: {
    backgroundColor: '#FFFFFF',
    paddingVertical: 16,
    paddingHorizontal: 48,
    borderRadius: 16,
    width: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 24,
    minHeight: 56,
  },
  ctaText: {
    fontSize: 18,
    fontWeight: '600',
  },

  // Visual container for slides 2 and 3
  visualContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    width: '100%',
    paddingHorizontal: 24,
  },

  // Slide 2 - Phone Mockup
  phoneFrame: {
    width: 280,
    height: 380,
    backgroundColor: '#FFFFFF',
    borderRadius: 40,
    borderWidth: 8,
    borderColor: '#1F2937',
    overflow: 'hidden',
    shadowColor: '#1a6daf',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.2,
    shadowRadius: 16,
    elevation: 8,
  },
  statusBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingTop: 12,
    paddingBottom: 8,
  },
  statusTime: {
    fontSize: 14,
    fontWeight: '600',
    color: '#000',
  },
  statusIcons: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  notificationsContainer: {
    flex: 1,
    paddingHorizontal: 12,
    paddingTop: 20,
    gap: 12,
  },
  notification: {
    flexDirection: 'row',
    backgroundColor: '#F3F4F6',
    borderRadius: 16,
    padding: 12,
    alignItems: 'flex-start',
  },
  notificationIcon: {
    width: 36,
    height: 36,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  notificationContent: {
    flex: 1,
    marginLeft: 10,
  },
  notificationApp: {
    fontSize: 11,
    color: '#6B7280',
    fontWeight: '500',
  },
  notificationTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#111827',
    marginTop: 2,
  },
  notificationBody: {
    fontSize: 13,
    color: '#4B5563',
    marginTop: 2,
  },
  notificationTime: {
    fontSize: 11,
    color: '#9CA3AF',
  },

  // Slide 3 - Photo Grid
  photoGrid: {
    width: '100%',
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    justifyContent: 'center',
  },
  gridItem: {
    width: (SCREEN_WIDTH - 48 - 12) / 2 - 12,
    height: 120,
    borderRadius: 16,
    overflow: 'hidden',
    position: 'relative',
    shadowColor: '#1a6daf',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 4,
  },
  gridImage: {
    width: '100%',
    height: '100%',
  },
  gridOverlay: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: '50%',
  },
  gridLabel: {
    position: 'absolute',
    bottom: 10,
    left: 12,
    fontSize: 14,
    fontWeight: '600',
    color: '#FFFFFF',
  },
});
