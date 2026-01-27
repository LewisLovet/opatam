/**
 * Pro Registration Screen
 * Redirect to web for provider registration
 */

import React from 'react';
import { View, StyleSheet, Pressable, Linking } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../theme';
import { Text, Button } from '../../components';

export default function ProScreen() {
  const { colors, spacing, radius } = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();

  const handleOpenWeb = () => {
    Linking.openURL('https://opatam.com/pro/register?source=mobile');
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
        <Text variant="h1">Espace Professionnel</Text>
      </View>

      {/* Content */}
      <View style={styles.content}>
        {/* Icon */}
        <View
          style={[
            styles.iconContainer,
            { backgroundColor: colors.primaryLight },
          ]}
        >
          <Ionicons name="briefcase-outline" size={64} color={colors.primary} />
        </View>

        <Text variant="h2" style={[styles.title, { marginTop: spacing.xl }]}>
          Créez votre compte pro sur notre site
        </Text>

        <Text
          variant="body"
          color="textSecondary"
          style={[styles.description, { marginTop: spacing.sm }]}
        >
          L'inscription se fait sur ordinateur pour configurer facilement votre activité.
        </Text>

        {/* Open web button */}
        <Pressable
          onPress={handleOpenWeb}
          style={({ pressed }) => [
            styles.webButton,
            {
              backgroundColor: colors.primary,
              borderRadius: 12,
              marginTop: spacing.xl,
              opacity: pressed ? 0.9 : 1,
            },
          ]}
        >
          <Ionicons name="globe-outline" size={20} color="#FFFFFF" style={{ marginRight: 8 }} />
          <Text variant="body" style={{ fontWeight: '600', color: '#FFFFFF' }}>
            Ouvrir opatam.com/pro
          </Text>
        </Pressable>

        {/* Separator */}
        <View style={[styles.separator, { marginVertical: spacing.xl }]}>
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

        {/* Login section */}
        <Text variant="body" color="textSecondary">
          Déjà inscrit ?
        </Text>

        <Button
          variant="outline"
          title="Se connecter"
          onPress={() => router.push('/(auth)/login')}
          style={{ marginTop: spacing.md, width: '100%' }}
        />
      </View>

      {/* Info banner */}
      <View
        style={[
          styles.infoBanner,
          {
            backgroundColor: colors.primaryLight,
            borderRadius: radius.md,
            padding: spacing.md,
          },
        ]}
      >
        <Text variant="body" style={{ textAlign: 'center' }}>
          💡 Essai gratuit 7 jours - Sans carte bancaire
        </Text>
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
    // Dynamic styles
  },
  content: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconContainer: {
    width: 120,
    height: 120,
    borderRadius: 60,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    textAlign: 'center',
  },
  description: {
    textAlign: 'center',
    maxWidth: 280,
  },
  webButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    height: 52,
    width: '100%',
    paddingHorizontal: 24,
  },
  separator: {
    flexDirection: 'row',
    alignItems: 'center',
    width: '100%',
  },
  separatorLine: {
    flex: 1,
    height: 1,
  },
  infoBanner: {
    width: '100%',
  },
});
