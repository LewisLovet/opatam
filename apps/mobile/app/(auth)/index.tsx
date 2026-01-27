/**
 * Welcome Gate Screen
 * Choose between Client or Pro registration
 */

import React from 'react';
import { View, StyleSheet, Pressable } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../theme';
import { Text } from '../../components';

export default function WelcomeGateScreen() {
  const { colors, spacing, radius, shadows } = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();

  return (
    <View
      style={[
        styles.container,
        {
          backgroundColor: colors.background,
          paddingTop: insets.top + spacing.xl,
          paddingBottom: insets.bottom + spacing.lg,
          paddingHorizontal: spacing.lg,
        },
      ]}
    >
      {/* Logo section */}
      <View style={styles.logoSection}>
        <View
          style={[
            styles.logoContainer,
            { backgroundColor: colors.primaryLight },
          ]}
        >
          <Text variant="h1" color="primary" style={styles.logoText}>
            OPATAM
          </Text>
        </View>

        <Text variant="h1" style={[styles.title, { marginTop: spacing.lg }]}>
          Bienvenue sur Opatam
        </Text>
      </View>

      {/* Cards section */}
      <View style={[styles.cardsSection, { gap: spacing.md }]}>
        {/* Client Card */}
        <Pressable
          onPress={() => router.push('/(auth)/client')}
          style={({ pressed }) => [
            styles.card,
            {
              backgroundColor: colors.surface,
              borderColor: colors.border,
              borderRadius: radius.lg,
              padding: spacing.lg,
              ...shadows.sm,
              opacity: pressed ? 0.9 : 1,
            },
          ]}
        >
          <View style={styles.cardContent}>
            <View
              style={[
                styles.cardIcon,
                { backgroundColor: colors.primaryLight },
              ]}
            >
              <Ionicons name="person-outline" size={28} color={colors.primary} />
            </View>

            <View style={styles.cardTextContainer}>
              <Text variant="h3">Je cherche un professionnel</Text>
              <Text variant="caption" color="textSecondary" style={{ marginTop: spacing.xs }}>
                Réservez chez coiffeurs, spas, coachs...
              </Text>
            </View>

            <Ionicons name="chevron-forward" size={20} color={colors.textSecondary} />
          </View>
        </Pressable>

        {/* Pro Card */}
        <Pressable
          onPress={() => router.push('/(auth)/pro')}
          style={({ pressed }) => [
            styles.card,
            {
              backgroundColor: colors.surface,
              borderColor: colors.border,
              borderRadius: radius.lg,
              padding: spacing.lg,
              ...shadows.sm,
              opacity: pressed ? 0.9 : 1,
            },
          ]}
        >
          {/* Badge */}
          <View
            style={[
              styles.badge,
              {
                backgroundColor: colors.success,
                borderRadius: radius.sm,
                paddingHorizontal: spacing.sm,
                paddingVertical: spacing.xs,
              },
            ]}
          >
            <Text variant="caption" style={{ color: '#FFFFFF', fontWeight: '600' }}>
              Essai 7j gratuit
            </Text>
          </View>

          <View style={styles.cardContent}>
            <View
              style={[
                styles.cardIcon,
                { backgroundColor: colors.primaryLight },
              ]}
            >
              <Ionicons name="briefcase-outline" size={28} color={colors.primary} />
            </View>

            <View style={styles.cardTextContainer}>
              <Text variant="h3">Je suis professionnel</Text>
              <Text variant="caption" color="textSecondary" style={{ marginTop: spacing.xs }}>
                Gérez vos réservations et développez votre activité
              </Text>
            </View>

            <Ionicons name="chevron-forward" size={20} color={colors.textSecondary} />
          </View>
        </Pressable>
      </View>

      {/* Footer link */}
      <View style={styles.footer}>
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
  logoSection: {
    alignItems: 'center',
    paddingVertical: 32,
  },
  logoContainer: {
    width: 100,
    height: 100,
    borderRadius: 50,
    alignItems: 'center',
    justifyContent: 'center',
  },
  logoText: {
    fontSize: 18,
    fontWeight: '800',
    letterSpacing: 2,
  },
  title: {
    textAlign: 'center',
  },
  cardsSection: {
    flex: 1,
    justifyContent: 'center',
  },
  card: {
    borderWidth: 1,
    width: '100%',
  },
  cardContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  cardIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  cardTextContainer: {
    flex: 1,
  },
  badge: {
    position: 'absolute',
    top: -10,
    right: 12,
    zIndex: 1,
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    paddingTop: 16,
  },
});
