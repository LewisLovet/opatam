/**
 * Login Screen
 * Email/password authentication with social options
 */

import React, { useState } from 'react';
import {
  View,
  StyleSheet,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  Pressable,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../theme';
import { Text, Button, Input, useToast } from '../../components';
import { useAuth } from '../../contexts';

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

  // Form state
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [errors, setErrors] = useState<FormErrors>({});
  const [isSubmitting, setIsSubmitting] = useState(false);

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
      // Navigation handled by index.tsx based on userData.role
      router.replace('/');
    } catch (error: any) {
      showToast({
        variant: 'error',
        message: error.message || 'Erreur de connexion',
      });
    } finally {
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
        style={{ backgroundColor: colors.background }}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {/* Back button */}
        <Pressable
          onPress={() => router.back()}
          style={[
            styles.backButton,
            { backgroundColor: colors.surface, borderRadius: radius.full },
          ]}
        >
          <Ionicons name="chevron-back" size={24} color={colors.text} />
        </Pressable>

        {/* Header */}
        <View style={[styles.header, { marginTop: spacing.xl }]}>
          <Text variant="h1">Connexion</Text>
          <Text
            variant="body"
            color="textSecondary"
            style={{ marginTop: spacing.xs }}
          >
            Content de vous revoir 👋
          </Text>
        </View>

        {/* Social buttons */}
        <View style={[styles.socialSection, { marginTop: spacing.xl, gap: 12 }]}>
          {/* Google button */}
          <Pressable
            onPress={handleGoogleSignIn}
            style={({ pressed }) => [
              styles.socialButton,
              {
                backgroundColor: '#FFFFFF',
                borderColor: '#E5E7EB',
                borderRadius: 12,
                opacity: pressed ? 0.9 : 1,
              },
            ]}
          >
            <View style={styles.googleIcon}>
              <Text style={{ fontSize: 18, fontWeight: '700' }}>G</Text>
            </View>
            <Text variant="body" style={{ fontWeight: '500' }}>
              Continuer avec Google
            </Text>
          </Pressable>

          {/* Apple button */}
          <Pressable
            onPress={handleAppleSignIn}
            style={({ pressed }) => [
              styles.socialButton,
              {
                backgroundColor: '#000000',
                borderColor: '#000000',
                borderRadius: 12,
                opacity: pressed ? 0.9 : 1,
              },
            ]}
          >
            <Ionicons name="logo-apple" size={20} color="#FFFFFF" style={{ marginRight: 12 }} />
            <Text variant="body" style={{ fontWeight: '500', color: '#FFFFFF' }}>
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
        </View>

        {/* Form */}
        <View style={[styles.form, { gap: spacing.md }]}>
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
        </View>

        {/* Footer */}
        <View style={[styles.footer, { marginTop: spacing.xl }]}>
          <Text variant="body" color="textSecondary">
            Pas encore de compte ?{' '}
          </Text>
          <Pressable onPress={() => router.push('/(auth)/client')}>
            <Text variant="body" color="primary" style={{ fontWeight: '600' }}>
              Créer un compte
            </Text>
          </Pressable>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flexGrow: 1,
  },
  backButton: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  header: {
    // Dynamic styles
  },
  socialSection: {
    // Dynamic styles
  },
  socialButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    height: 52,
    width: '100%',
    borderWidth: 1,
  },
  googleIcon: {
    width: 20,
    height: 20,
    marginRight: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  separator: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  separatorLine: {
    flex: 1,
    height: 1,
  },
  form: {
    // Dynamic styles
  },
  forgotPassword: {
    alignSelf: 'flex-end',
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
  },
});
