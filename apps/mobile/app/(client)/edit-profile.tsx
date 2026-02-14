/**
 * Edit Profile Screen
 * Allows user to modify their profile information
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
import { userService } from '@booking-app/firebase';
import { useTheme } from '../../theme';
import { Text, Button, Input, useToast } from '../../components';
import { useAuth } from '../../contexts';

interface FormErrors {
  displayName?: string;
  phone?: string;
  city?: string;
}

export default function EditProfileScreen() {
  const { colors, spacing, radius } = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { showToast } = useToast();
  const { user, userData, refreshUserData } = useAuth();

  // Form state - pre-filled with current values
  const [displayName, setDisplayName] = useState(userData?.displayName || '');
  const [phone, setPhone] = useState(userData?.phone || '');
  const [city, setCity] = useState(userData?.city || '');
  const [errors, setErrors] = useState<FormErrors>({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Validate form
  const validateForm = (): boolean => {
    const newErrors: FormErrors = {};

    // Display name validation
    if (!displayName.trim()) {
      newErrors.displayName = 'Le prénom est requis';
    } else if (displayName.trim().length < 2) {
      newErrors.displayName = 'Le prénom doit contenir au moins 2 caractères';
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

    // City - no specific validation

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  // Clear error on field change
  const clearError = (field: keyof FormErrors) => {
    if (errors[field]) {
      setErrors((prev) => ({ ...prev, [field]: undefined }));
    }
  };

  // Handle save
  const handleSave = async () => {
    if (!validateForm()) return;
    if (!user?.uid) return;

    setIsSubmitting(true);

    try {
      const cleanedPhone = phone.trim() ? phone.replace(/\s/g, '') : null;

      await userService.updateProfile(user.uid, {
        displayName: displayName.trim(),
        phone: cleanedPhone,
        city: city.trim() || null,
      });

      // Refresh user data in context
      await refreshUserData();

      showToast({
        variant: 'success',
        message: 'Profil mis à jour',
      });

      router.back();
    } catch (error: any) {
      showToast({
        variant: 'error',
        message: error.message || 'Erreur lors de la mise à jour',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: colors.background }}
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
        {/* Header */}
        <View style={styles.header}>
          <Pressable
            onPress={() => router.back()}
            style={({ pressed }) => [
              styles.backButton,
              {
                backgroundColor: colors.surface,
                borderRadius: radius.full,
                opacity: pressed ? 0.7 : 1,
              },
            ]}
          >
            <Ionicons name="chevron-back" size={24} color={colors.text} />
          </Pressable>
          <Text variant="h2" style={styles.headerTitle}>
            Modifier mon profil
          </Text>
          <View style={styles.headerSpacer} />
        </View>

        {/* Form */}
        <View style={[styles.form, { gap: spacing.md, marginTop: spacing.xl }]}>
          <Input
            label="Prénom"
            placeholder="Votre prénom"
            value={displayName}
            onChangeText={(text) => {
              setDisplayName(text);
              clearError('displayName');
            }}
            autoCapitalize="words"
            error={errors.displayName}
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
            error={errors.phone}
          />

          <Input
            label="Ville"
            placeholder="Votre ville (optionnel)"
            value={city}
            onChangeText={(text) => {
              setCity(text);
              clearError('city');
            }}
            autoCapitalize="words"
            error={errors.city}
          />

          <Button
            variant="primary"
            title="Enregistrer"
            onPress={handleSave}
            loading={isSubmitting}
            disabled={isSubmitting}
            style={{ marginTop: spacing.lg }}
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
  header: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  backButton: {
    width: 44,
    height: 44,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitle: {
    flex: 1,
    textAlign: 'center',
  },
  headerSpacer: {
    width: 44,
  },
  form: {
    // Dynamic styles
  },
});
