/**
 * Login Screen
 * Email/password authentication with Pro/Client tab toggle
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
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../theme';
import { Text, Button, Input, useToast } from '../../components';
import { useAuth } from '../../contexts';

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
  { size: 100, startX: -30, startY: SCREEN_HEIGHT * 0.1, color: 'rgba(26, 109, 175, 0.12)', duration: 9000, delay: 0 },
  { size: 70, startX: SCREEN_WIDTH - 50, startY: SCREEN_HEIGHT * 0.15, color: 'rgba(41, 139, 206, 0.10)', duration: 11000, delay: 400 },
  { size: 50, startX: SCREEN_WIDTH * 0.4, startY: SCREEN_HEIGHT * 0.5, color: 'rgba(26, 109, 175, 0.08)', duration: 13000, delay: 800 },
  { size: 80, startX: SCREEN_WIDTH - 60, startY: SCREEN_HEIGHT * 0.6, color: 'rgba(41, 139, 206, 0.11)', duration: 10000, delay: 200 },
  { size: 60, startX: 20, startY: SCREEN_HEIGHT * 0.7, color: 'rgba(26, 109, 175, 0.09)', duration: 12000, delay: 600 },
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

type TabType = 'client' | 'pro';

interface FormErrors {
  email?: string;
  password?: string;
}

export default function LoginScreen() {
  const { colors, spacing, radius } = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { showToast } = useToast();
  const { signIn } = useAuth();
  const params = useLocalSearchParams<{ tab?: string }>();

  // Tab state
  const [activeTab, setActiveTab] = useState<TabType>(
    params.tab === 'pro' ? 'pro' : 'client'
  );

  // Form state
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
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

  // Reset form when switching tabs
  const handleTabChange = (tab: TabType) => {
    setActiveTab(tab);
    setEmail('');
    setPassword('');
    setErrors({});
  };

  // Validate form
  const validateForm = (): boolean => {
    const newErrors: FormErrors = {};

    if (!email.trim()) {
      newErrors.email = "L'email est requis";
    } else if (!email.includes('@') || !email.includes('.')) {
      newErrors.email = "Format d'email invalide";
    }

    if (!password) {
      newErrors.password = 'Le mot de passe est requis';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  // Handle login
  const handleLogin = async () => {
    if (!validateForm()) return;

    setIsSubmitting(true);

    try {
      await signIn(email.trim(), password);
      // Navigation is handled reactively by the auth layout guard
      // when AuthContext updates with the authenticated user
    } catch (error: any) {
      showToast({
        variant: 'error',
        message: error.message || 'Erreur de connexion',
      });
      setIsSubmitting(false);
    }
  };

  // Clear error on field change
  const clearError = (field: keyof FormErrors) => {
    if (errors[field]) {
      setErrors((prev) => ({ ...prev, [field]: undefined }));
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
            <Text variant="h1" style={styles.headerTitle}>Connexion</Text>
            <Text
              variant="body"
              color="textSecondary"
              style={{ marginTop: spacing.xs }}
            >
              Content de vous revoir
            </Text>
          </Animated.View>

          {/* Pro/Client Tab Toggle */}
          <Animated.View
            style={[
              { marginTop: spacing.lg },
              { opacity: fadeAnim, transform: [{ translateY: slideAnim }] },
            ]}
          >
            <View
              style={[
                styles.tabContainer,
                {
                  backgroundColor: 'rgba(26, 109, 175, 0.08)',
                  borderRadius: 14,
                  padding: 4,
                },
              ]}
            >
              <Pressable
                onPress={() => handleTabChange('client')}
                style={[
                  styles.tab,
                  {
                    backgroundColor: activeTab === 'client' ? '#FFFFFF' : 'transparent',
                    borderRadius: 10,
                  },
                  activeTab === 'client' && styles.tabActive,
                ]}
              >
                <Ionicons
                  name="person-outline"
                  size={16}
                  color={activeTab === 'client' ? colors.primary : colors.textSecondary}
                  style={{ marginRight: 6 }}
                />
                <Text
                  variant="body"
                  style={{
                    fontWeight: activeTab === 'client' ? '600' : '400',
                    color: activeTab === 'client' ? colors.primary : colors.textSecondary,
                    fontSize: 14,
                  }}
                >
                  Client
                </Text>
              </Pressable>

              <Pressable
                onPress={() => handleTabChange('pro')}
                style={[
                  styles.tab,
                  {
                    backgroundColor: activeTab === 'pro' ? '#FFFFFF' : 'transparent',
                    borderRadius: 10,
                  },
                  activeTab === 'pro' && styles.tabActive,
                ]}
              >
                <Ionicons
                  name="briefcase-outline"
                  size={16}
                  color={activeTab === 'pro' ? colors.primary : colors.textSecondary}
                  style={{ marginRight: 6 }}
                />
                <Text
                  variant="body"
                  style={{
                    fontWeight: activeTab === 'pro' ? '600' : '400',
                    color: activeTab === 'pro' ? colors.primary : colors.textSecondary,
                    fontSize: 14,
                  }}
                >
                  Professionnel
                </Text>
              </Pressable>
            </View>
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

            <View>
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
                autoComplete="password"
                error={errors.password}
                rightIcon={
                  <Ionicons
                    name={showPassword ? 'eye-off-outline' : 'eye-outline'}
                    size={20}
                    color={colors.textSecondary}
                  />
                }
                onRightIconPress={() => setShowPassword(!showPassword)}
              />

              <Pressable
                onPress={() => router.push('/(auth)/forgot-password')}
                style={[styles.forgotPassword, { marginTop: spacing.sm }]}
              >
                <Text variant="caption" color="primary">
                  Mot de passe oublié ?
                </Text>
              </Pressable>
            </View>

            <Button
              variant="primary"
              title="Se connecter"
              onPress={handleLogin}
              loading={isSubmitting}
              disabled={isSubmitting}
              style={{ marginTop: spacing.sm }}
            />
          </Animated.View>

          {/* Footer */}
          <Animated.View
            style={[
              styles.footer,
              { marginTop: spacing.xl },
              { opacity: fadeAnim },
            ]}
          >
            {activeTab === 'client' ? (
              <View style={styles.footerRow}>
                <Text variant="body" color="textSecondary">
                  Pas encore de compte ?{' '}
                </Text>
                <Pressable
                  onPress={() => router.push('/(auth)/client')}
                  style={({ pressed }) => ({ opacity: pressed ? 0.7 : 1 })}
                >
                  <Text variant="body" color="primary" style={{ fontWeight: '600' }}>
                    Créer un compte
                  </Text>
                </Pressable>
              </View>
            ) : (
              <View style={styles.footerColumn}>
                <View style={[styles.proInfoBanner, { backgroundColor: 'rgba(26, 109, 175, 0.06)', borderRadius: radius.lg, padding: spacing.md, borderWidth: 1, borderColor: 'rgba(26, 109, 175, 0.12)' }]}>
                  <Ionicons name="information-circle-outline" size={18} color={colors.primary} style={{ marginRight: 8, marginTop: 1 }} />
                  <Text variant="caption" color="textSecondary" style={{ flex: 1, lineHeight: 18 }}>
                    L'inscription pro se fait sur le site web. Connectez-vous ici si vous avez déjà un compte.
                  </Text>
                </View>
                <Pressable
                  onPress={() => router.push('/(auth)/pro')}
                  style={({ pressed }) => [styles.footerRow, { marginTop: spacing.md, opacity: pressed ? 0.7 : 1 }]}
                >
                  <Text variant="body" color="textSecondary">
                    Pas encore de compte ?{' '}
                  </Text>
                  <Text variant="body" color="primary" style={{ fontWeight: '600' }}>
                    S'inscrire en ligne
                  </Text>
                </Pressable>
              </View>
            )}
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
  tabContainer: {
    flexDirection: 'row',
  },
  tab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
  },
  tabActive: {
    shadowColor: '#1a6daf',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 2,
  },
  form: {
    // Dynamic styles
  },
  forgotPassword: {
    alignSelf: 'flex-end',
  },
  footer: {
    alignItems: 'center',
  },
  footerRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
  },
  footerColumn: {
    width: '100%',
    alignItems: 'center',
  },
  proInfoBanner: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    width: '100%',
  },
});
