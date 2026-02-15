/**
 * Client Registration Screen
 * Direct email/password registration with animated background
 */

import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  StyleSheet,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  Animated,
  Dimensions,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../../theme';
import { Text, Button, Input, useToast } from '../../../components';
import { useAuth } from '../../../contexts';

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
  { size: 110, startX: -35, startY: SCREEN_HEIGHT * 0.08, color: 'rgba(26, 109, 175, 0.14)', duration: 9000, delay: 0 },
  { size: 75, startX: SCREEN_WIDTH - 55, startY: SCREEN_HEIGHT * 0.14, color: 'rgba(41, 139, 206, 0.11)', duration: 11000, delay: 300 },
  { size: 55, startX: SCREEN_WIDTH * 0.35, startY: SCREEN_HEIGHT * 0.5, color: 'rgba(26, 109, 175, 0.09)', duration: 13000, delay: 700 },
  { size: 85, startX: SCREEN_WIDTH - 65, startY: SCREEN_HEIGHT * 0.55, color: 'rgba(41, 139, 206, 0.12)', duration: 10000, delay: 150 },
  { size: 65, startX: 25, startY: SCREEN_HEIGHT * 0.65, color: 'rgba(26, 109, 175, 0.10)', duration: 12000, delay: 500 },
  { size: 45, startX: SCREEN_WIDTH * 0.6, startY: SCREEN_HEIGHT * 0.32, color: 'rgba(41, 139, 206, 0.08)', duration: 14000, delay: 800 },
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

interface FormErrors {
  firstName?: string;
  email?: string;
  password?: string;
  phone?: string;
}

export default function ClientRegisterScreen() {
  const { colors, spacing, radius } = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { showToast } = useToast();
  const { signUp } = useAuth();

  // Form state
  const [firstName, setFirstName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [phone, setPhone] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [errors, setErrors] = useState<FormErrors>({});
  const [isSubmitting, setIsSubmitting] = useState(false);

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

  // Validate form
  const validateForm = (): boolean => {
    const newErrors: FormErrors = {};

    if (!firstName.trim()) {
      newErrors.firstName = 'Le prénom est requis';
    } else if (firstName.trim().length < 2) {
      newErrors.firstName = 'Le prénom doit contenir au moins 2 caractères';
    }

    if (!email.trim()) {
      newErrors.email = "L'email est requis";
    } else if (!email.includes('@') || !email.includes('.')) {
      newErrors.email = "Format d'email invalide";
    }

    if (!password) {
      newErrors.password = 'Le mot de passe est requis';
    } else if (password.length < 6) {
      newErrors.password = 'Le mot de passe doit contenir au moins 6 caractères';
    }

    if (!phone.trim()) {
      newErrors.phone = 'Le numéro de téléphone est requis';
    } else {
      const cleanedPhone = phone.replace(/\s/g, '');
      if (!/^0[67]\d{8}$/.test(cleanedPhone)) {
        newErrors.phone = 'Format invalide (ex: 06 12 34 56 78)';
      }
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  // Clear error on field change
  const clearError = (field: keyof FormErrors) => {
    if (errors[field]) {
      setErrors((prev) => ({ ...prev, [field]: undefined }));
    }
  };

  // Handle submit
  const handleSubmit = async () => {
    if (!validateForm()) return;

    setIsSubmitting(true);

    try {
      const cleanedPhone = phone.replace(/\s/g, '');
      await signUp(email.trim(), password, firstName.trim(), cleanedPhone);

      showToast({
        variant: 'success',
        message: 'Compte créé avec succès',
      });

      // Navigation is handled reactively by the auth layout guard
    } catch (error: any) {
      showToast({
        variant: 'error',
        message: error.message || "Erreur lors de l'inscription",
      });
      setIsSubmitting(false);
    }
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

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <ScrollView
          contentContainerStyle={[
            styles.container,
            {
              paddingTop: insets.top + spacing.md,
              paddingBottom: insets.bottom + spacing.lg,
              paddingHorizontal: spacing.lg,
            },
          ]}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
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
              { marginTop: spacing.lg },
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

          {/* Form */}
          <Animated.View
            style={[
              styles.form,
              { gap: spacing.md, marginTop: spacing.xl },
              { opacity: fadeAnim, transform: [{ translateY: slideAnim }] },
            ]}
          >
            <Input
              label="Prénom"
              placeholder="Votre prénom"
              value={firstName}
              onChangeText={(text) => {
                setFirstName(text);
                clearError('firstName');
              }}
              autoCapitalize="words"
              autoComplete="given-name"
              error={errors.firstName}
            />

            <Input
              label="Email"
              placeholder="votre@email.com"
              value={email}
              onChangeText={(text) => {
                setEmail(text);
                clearError('email');
              }}
              keyboardType="email-address"
              autoCapitalize="none"
              autoComplete="email"
              error={errors.email}
            />

            <Input
              label="Mot de passe"
              placeholder="Votre mot de passe"
              value={password}
              onChangeText={(text) => {
                setPassword(text);
                clearError('password');
              }}
              secureTextEntry={!showPassword}
              autoCapitalize="none"
              autoComplete="new-password"
              error={errors.password}
              helperText="Min. 6 caractères"
              rightIcon={
                <Ionicons
                  name={showPassword ? 'eye-off-outline' : 'eye-outline'}
                  size={20}
                  color={colors.textSecondary}
                />
              }
              onRightIconPress={() => setShowPassword(!showPassword)}
            />

            <Input
              label="Téléphone"
              placeholder="06 12 34 56 78"
              value={phone}
              onChangeText={(text) => {
                setPhone(text);
                clearError('phone');
              }}
              keyboardType="phone-pad"
              autoComplete="tel"
              error={errors.phone}
            />

            <Button
              variant="primary"
              title="Créer mon compte"
              onPress={handleSubmit}
              loading={isSubmitting}
              disabled={isSubmitting}
              style={{ marginTop: spacing.sm }}
            />
          </Animated.View>

          {/* Legal text */}
          <Animated.View style={[{ marginTop: spacing.lg }, { opacity: fadeAnim }]}>
            <Text
              variant="caption"
              color="textSecondary"
              style={styles.legalText}
            >
              En créant un compte, vous acceptez nos CGU et Politique de confidentialité
            </Text>
          </Animated.View>

          {/* Footer link */}
          <Animated.View
            style={[
              styles.footer,
              { marginTop: spacing.md },
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
        </ScrollView>
      </KeyboardAvoidingView>
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
    flexGrow: 1,
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
  form: {
    // Dynamic styles
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
