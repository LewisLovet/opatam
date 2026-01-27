/**
 * Forgot Password Screen
 * Password reset via email
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
import { forgotPasswordSchema } from '@booking-app/shared';
import { useTheme } from '../../theme';
import { Text, Button, Input, useToast } from '../../components';
import { useAuth } from '../../contexts';

interface FormErrors {
  email?: string;
}

export default function ForgotPasswordScreen() {
  const { colors, spacing, radius } = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { showToast } = useToast();
  const { resetPassword } = useAuth();

  // Form state
  const [email, setEmail] = useState('');
  const [errors, setErrors] = useState<FormErrors>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [emailSent, setEmailSent] = useState(false);

  // Validate form
  const validateForm = (): boolean => {
    const result = forgotPasswordSchema.safeParse({ email });

    if (!result.success) {
      const fieldErrors: FormErrors = {};
      result.error.errors.forEach((err) => {
        const field = err.path[0] as keyof FormErrors;
        if (field) {
          fieldErrors[field] = err.message;
        }
      });
      setErrors(fieldErrors);
      return false;
    }

    setErrors({});
    return true;
  };

  // Handle password reset
  const handleResetPassword = async () => {
    if (!validateForm()) return;

    setIsSubmitting(true);

    try {
      await resetPassword(email);
      setEmailSent(true);
      showToast({
        variant: 'success',
        message: 'Email de réinitialisation envoyé',
      });
    } catch (error: any) {
      showToast({
        variant: 'error',
        message: error.message || "Erreur lors de l'envoi",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  // Success state
  if (emailSent) {
    return (
      <View
        style={[
          styles.successContainer,
          {
            backgroundColor: colors.background,
            paddingTop: insets.top + spacing.md,
            paddingBottom: insets.bottom + spacing.lg,
            paddingHorizontal: spacing.lg,
          },
        ]}
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

        <View style={styles.successContent}>
          <View
            style={[
              styles.successIcon,
              { backgroundColor: colors.primaryLight },
            ]}
          >
            <Ionicons name="mail-outline" size={48} color={colors.primary} />
          </View>

          <Text variant="h2" style={[styles.successTitle, { marginTop: spacing.lg }]}>
            Email envoyé !
          </Text>

          <Text
            variant="body"
            color="textSecondary"
            style={[styles.successText, { marginTop: spacing.sm }]}
          >
            Vérifiez votre boîte mail et cliquez sur le lien.
          </Text>

          <Button
            variant="primary"
            title="Retour à la connexion"
            onPress={() => router.replace('/(auth)/login')}
            style={{ marginTop: spacing.xl, width: '100%' }}
          />

          <Pressable
            onPress={handleResetPassword}
            disabled={isSubmitting}
            style={{ marginTop: spacing.md }}
          >
            <Text variant="body" color="primary">
              Pas reçu ? Renvoyer
            </Text>
          </Pressable>
        </View>
      </View>
    );
  }

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
          <Text variant="h1">Mot de passe oublié</Text>
          <Text
            variant="body"
            color="textSecondary"
            style={{ marginTop: spacing.xs }}
          >
            Entrez votre email pour recevoir un lien de réinitialisation
          </Text>
        </View>

        {/* Form */}
        <View style={[styles.form, { marginTop: spacing.xl, gap: spacing.md }]}>
          <Input
            label="Email"
            placeholder="votre@email.com"
            value={email}
            onChangeText={(text) => {
              setEmail(text);
              if (errors.email) setErrors({});
            }}
            keyboardType="email-address"
            autoCapitalize="none"
            autoComplete="email"
            error={errors.email}
          />

          <Button
            variant="primary"
            title="Envoyer le lien"
            onPress={handleResetPassword}
            loading={isSubmitting}
            disabled={isSubmitting}
            style={{ marginTop: spacing.md }}
          />
        </View>

        {/* Footer */}
        <View style={[styles.footer, { marginTop: spacing.xl }]}>
          <Text variant="body" color="textSecondary">
            Vous vous souvenez ?{' '}
          </Text>
          <Pressable onPress={() => router.replace('/(auth)/login')}>
            <Text variant="body" color="primary" style={{ fontWeight: '600' }}>
              Se connecter
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
  successContainer: {
    flex: 1,
  },
  successContent: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  successIcon: {
    width: 96,
    height: 96,
    borderRadius: 48,
    alignItems: 'center',
    justifyContent: 'center',
  },
  successTitle: {
    textAlign: 'center',
  },
  successText: {
    textAlign: 'center',
    maxWidth: 280,
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
  form: {
    // Dynamic styles
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
  },
});
