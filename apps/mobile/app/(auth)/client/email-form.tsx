/**
 * Client Registration - Email Form
 * Email/password registration with validation
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
import { useTheme } from '../../../theme';
import { Text, Button, Input, useToast } from '../../../components';
import { useAuth } from '../../../contexts';

interface FormErrors {
  firstName?: string;
  email?: string;
  password?: string;
  phone?: string;
}

export default function EmailFormScreen() {
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

  // Validate form
  const validateForm = (): boolean => {
    const newErrors: FormErrors = {};

    // First name validation
    if (!firstName.trim()) {
      newErrors.firstName = 'Le prénom est requis';
    } else if (firstName.trim().length < 2) {
      newErrors.firstName = 'Le prénom doit contenir au moins 2 caractères';
    }

    // Email validation
    if (!email.trim()) {
      newErrors.email = "L'email est requis";
    } else if (!email.includes('@') || !email.includes('.')) {
      newErrors.email = "Format d'email invalide";
    }

    // Password validation
    if (!password) {
      newErrors.password = 'Le mot de passe est requis';
    } else if (password.length < 6) {
      newErrors.password = 'Le mot de passe doit contenir au moins 6 caractères';
    }

    // Phone validation (required)
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
      // when AuthContext updates with the authenticated user
    } catch (error: any) {
      showToast({
        variant: 'error',
        message: error.message || "Erreur lors de l'inscription",
      });
      setIsSubmitting(false);
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
          <Text variant="h1">Inscription</Text>
        </View>

        {/* Form */}
        <View style={[styles.form, { marginTop: spacing.xl, gap: spacing.md }]}>
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
            style={{ marginTop: spacing.md }}
          />
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
  form: {
    // Dynamic styles
  },
});
