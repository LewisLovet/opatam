/**
 * Client Registration - Social First Screen
 * Choose registration method: Google, Apple, or Email
 */

import React from 'react';
import { View, StyleSheet, Pressable } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../../theme';
import { Text, useToast } from '../../../components';

export default function ClientSocialScreen() {
  const { colors, spacing, radius } = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { showToast } = useToast();

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

  return (
    <View
      style={[
        styles.container,
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

      {/* Header */}
      <View style={[styles.header, { marginTop: spacing.xl }]}>
        <Text variant="h1">Créer un compte</Text>
        <Text
          variant="body"
          color="textSecondary"
          style={{ marginTop: spacing.xs }}
        >
          Réservez en quelques secondes
        </Text>
      </View>

      {/* Social buttons */}
      <View style={[styles.buttonsSection, { gap: 12 }]}>
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

        {/* Email button */}
        <Pressable
          onPress={() => router.push('/(auth)/client/email-form')}
          style={({ pressed }) => [
            styles.socialButton,
            {
              backgroundColor: colors.surfaceSecondary,
              borderColor: colors.surfaceSecondary,
              borderRadius: 12,
              opacity: pressed ? 0.9 : 1,
            },
          ]}
        >
          <Ionicons name="mail-outline" size={20} color={colors.text} style={{ marginRight: 12 }} />
          <Text variant="body" style={{ fontWeight: '500' }}>
            Continuer avec email
          </Text>
        </Pressable>
      </View>

      {/* Legal text */}
      <Text
        variant="caption"
        color="textSecondary"
        style={[styles.legalText, { marginTop: spacing.xl }]}
      >
        En continuant, vous acceptez nos CGU et Politique de confidentialité
      </Text>

      {/* Footer link */}
      <View style={[styles.footer, { marginTop: spacing.lg }]}>
        <Text variant="body" color="textSecondary">
          Déjà un compte ?{' '}
        </Text>
        <Pressable onPress={() => router.push('/(auth)/login')}>
          <Text variant="body" color="primary" style={{ fontWeight: '600' }}>
            Se connecter
          </Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  backButton: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  header: {
    marginBottom: 32,
  },
  buttonsSection: {
    flex: 1,
    justifyContent: 'center',
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
