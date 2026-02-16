/**
 * Pro "More" Screen
 * Menu with links to secondary pro features.
 * Redesigned with grouped cards, icon circles, separators, and red logout section.
 */

import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React from 'react';
import {
  Alert,
  Image,
  Linking,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Card, Text } from '../../../components';
import { useAuth, useProvider } from '../../../contexts';
import { useTheme } from '../../../theme';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface MenuItem {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  description?: string;
  iconColor: string;
  onPress: () => void;
}

// ---------------------------------------------------------------------------
// Menu Item Row Component
// ---------------------------------------------------------------------------

function MenuItemRow({
  item,
  isLast,
  colors,
  spacing,
  radius,
}: {
  item: MenuItem;
  isLast: boolean;
  colors: any;
  spacing: any;
  radius: any;
}) {
  return (
    <View>
      <Pressable
        onPress={item.onPress}
        style={({ pressed }) => [
          styles.menuItemRow,
          {
            backgroundColor: pressed ? colors.surfaceSecondary : colors.surface,
            paddingHorizontal: spacing.lg,
            paddingVertical: spacing.md,
          },
        ]}
      >
        {/* Icon circle */}
        <View
          style={[
            styles.menuIconCircle,
            {
              width: 44,
              height: 44,
              borderRadius: radius.full,
              backgroundColor: colors.surfaceSecondary,
              marginRight: spacing.md,
            },
          ]}
        >
          <Ionicons name={item.icon} size={22} color={item.iconColor} />
        </View>

        {/* Text content */}
        <View style={styles.menuTextContent}>
          <Text variant="body" style={{ fontWeight: '500' }}>
            {item.label}
          </Text>
          {item.description ? (
            <Text variant="caption" color="textSecondary" style={{ marginTop: 2 }}>
              {item.description}
            </Text>
          ) : null}
        </View>

        {/* Chevron */}
        <Ionicons name="chevron-forward" size={20} color={colors.textMuted} />
      </Pressable>

      {/* Separator */}
      {!isLast && (
        <View
          style={[
            styles.separator,
            {
              backgroundColor: colors.divider,
              marginLeft: spacing.lg + 44 + spacing.md,
            },
          ]}
        />
      )}
    </View>
  );
}

// ---------------------------------------------------------------------------
// Main Screen
// ---------------------------------------------------------------------------

export default function MoreScreen() {
  const { colors, spacing, radius } = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { signOut, userData } = useAuth();
  const { provider } = useProvider();

  const handleLogout = async () => {
    await signOut();
    router.replace('/(auth)');
  };

  // Group 1: Gestion
  const gestionItems: MenuItem[] = [
    {
      icon: 'ban-outline',
      label: 'Créneaux bloqués',
      description: 'Gérer les indisponibilités',
      iconColor: colors.primary,
      onPress: () => router.push('/(pro)/blocked-slots'),
    },
    {
      icon: 'stats-chart-outline',
      label: 'Statistiques',
      description: 'Voir les performances',
      iconColor: colors.primary,
      onPress: () => router.push('/(pro)/stats'),
    },
  ];

  // Group 2: Paramètres
  const parametresItems: MenuItem[] = [
    {
      icon: 'notifications-outline',
      label: 'Notifications',
      description: 'Push et email',
      iconColor: colors.primary,
      onPress: () => router.push('/(pro)/notification-settings'),
    },
  ];

  // Group 3: Ma boutique
  const boutiqueItems: MenuItem[] = [
    {
      icon: 'create-outline',
      label: 'Modifier mon enseigne',
      description: 'Services, horaires, infos...',
      iconColor: colors.primary,
      onPress: () => {
        Alert.alert(
          'Redirection vers le web',
          'La modification de votre boutique se fait depuis l\'interface web. Pour une meilleure expérience, nous vous recommandons d\'utiliser un ordinateur.',
          [
            { text: 'Annuler', style: 'cancel' },
            {
              text: 'Continuer',
              onPress: () => Linking.openURL('https://opatam.com/pro/'),
            },
          ],
        );
      },
    },
  ];

  // Group 4: Autre
  const autreItems: MenuItem[] = [
    {
      icon: 'globe-outline',
      label: 'Accéder à mon espace web',
      description: 'opatam.com/pro',
      iconColor: colors.textSecondary,
      onPress: () => Linking.openURL('https://opatam.com/pro'),
    },
    {
      icon: 'help-circle-outline',
      label: 'Aide et contact',
      description: 'Centre d\'aide en ligne',
      iconColor: colors.textSecondary,
      onPress: () => Linking.openURL('https://opatam.com/contact'),
    },
    {
      icon: 'document-text-outline',
      label: 'Conditions d\'utilisation',
      iconColor: colors.textSecondary,
      onPress: () => Linking.openURL('https://opatam.com/cgu'),
    },
    {
      icon: 'shield-checkmark-outline',
      label: 'Politique de confidentialité',
      iconColor: colors.textSecondary,
      onPress: () => Linking.openURL('https://opatam.com/confidentialite'),
    },
  ];

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {/* ── Branded Header ────────────────────────────────────────── */}
      <View style={{ backgroundColor: colors.primary, paddingTop: insets.top }}>
        <View style={{ paddingHorizontal: spacing.lg, paddingTop: spacing.md, paddingBottom: spacing.lg }}>
          <Text variant="h1" style={{ color: '#FFFFFF' }}>Plus</Text>
          {provider?.businessName ? (
            <Text variant="caption" style={{ color: 'rgba(255,255,255,0.7)', marginTop: spacing.xs }}>
              {provider.businessName}
            </Text>
          ) : null}
        </View>
      </View>

      <ScrollView
        contentContainerStyle={[styles.scrollContent, { padding: spacing.lg }]}
        showsVerticalScrollIndicator={false}
      >

        {/* Provider Info Card */}
        <View style={{ marginBottom: spacing.lg }}>
          <Card padding="lg" shadow="sm">
            <View style={styles.providerInfoContainer}>
              {/* Avatar */}
              {provider?.photoURL ? (
                <Image
                  source={{ uri: provider.photoURL }}
                  style={[styles.providerAvatar, { backgroundColor: colors.surfaceSecondary }]}
                />
              ) : (
                <View style={[styles.providerAvatar, { backgroundColor: colors.primary }]}>
                  <Text variant="h2" style={{ color: '#FFFFFF' }}>
                    {(provider?.businessName || '?')
                      .split(' ')
                      .map((w: string) => w[0])
                      .join('')
                      .toUpperCase()
                      .slice(0, 2)}
                  </Text>
                </View>
              )}

              {/* Provider details */}
              <View style={styles.providerDetails}>
                <Text variant="h3">{provider?.businessName || 'Mon établissement'}</Text>
                <Text variant="body" color="textSecondary" style={{ marginTop: 2 }}>
                  {userData?.email || ''}
                </Text>
                {userData?.phone ? (
                  <Text variant="caption" color="textSecondary" style={{ marginTop: 2 }}>
                    {userData.phone}
                  </Text>
                ) : null}
              </View>
            </View>
          </Card>
        </View>

        {/* Group 1: Gestion */}
        <View style={{ marginBottom: spacing.lg }}>
          <Text
            variant="caption"
            color="textSecondary"
            style={{
              marginBottom: spacing.sm,
              textTransform: 'uppercase',
              fontWeight: '600',
              letterSpacing: 0.5,
              paddingLeft: spacing.xs,
            }}
          >
            Gestion
          </Text>
          <Card padding="none" shadow="sm">
            {gestionItems.map((item, index) => (
              <MenuItemRow
                key={item.label}
                item={item}
                isLast={index === gestionItems.length - 1}
                colors={colors}
                spacing={spacing}
                radius={radius}
              />
            ))}
          </Card>
        </View>

        {/* Group 2: Paramètres */}
        <View style={{ marginBottom: spacing.lg }}>
          <Text
            variant="caption"
            color="textSecondary"
            style={{
              marginBottom: spacing.sm,
              textTransform: 'uppercase',
              fontWeight: '600',
              letterSpacing: 0.5,
              paddingLeft: spacing.xs,
            }}
          >
            Paramètres
          </Text>
          <Card padding="none" shadow="sm">
            {parametresItems.map((item, index) => (
              <MenuItemRow
                key={item.label}
                item={item}
                isLast={index === parametresItems.length - 1}
                colors={colors}
                spacing={spacing}
                radius={radius}
              />
            ))}
          </Card>
        </View>

        {/* Group 3: Mon enseigne */}
        <View style={{ marginBottom: spacing.lg }}>
          <Text
            variant="caption"
            color="textSecondary"
            style={{
              marginBottom: spacing.sm,
              textTransform: 'uppercase',
              fontWeight: '600',
              letterSpacing: 0.5,
              paddingLeft: spacing.xs,
            }}
          >
            Mon enseigne
          </Text>
          <Card padding="none" shadow="sm">
            {boutiqueItems.map((item, index) => (
              <MenuItemRow
                key={item.label}
                item={item}
                isLast={index === boutiqueItems.length - 1}
                colors={colors}
                spacing={spacing}
                radius={radius}
              />
            ))}
          </Card>
        </View>

        {/* Group 4: Autre */}
        <View style={{ marginBottom: spacing.xl }}>
          <Text
            variant="caption"
            color="textSecondary"
            style={{
              marginBottom: spacing.sm,
              textTransform: 'uppercase',
              fontWeight: '600',
              letterSpacing: 0.5,
              paddingLeft: spacing.xs,
            }}
          >
            Autre
          </Text>
          <Card padding="none" shadow="sm">
            {autreItems.map((item, index) => (
              <MenuItemRow
                key={item.label}
                item={item}
                isLast={index === autreItems.length - 1}
                colors={colors}
                spacing={spacing}
                radius={radius}
              />
            ))}
          </Card>
        </View>

        {/* Logout Button */}
        <Pressable
          onPress={handleLogout}
          style={({ pressed }) => [
            styles.logoutCard,
            {
              backgroundColor: pressed ? colors.errorLight : colors.errorLight,
              borderRadius: radius.lg,
              borderWidth: 1,
              borderColor: colors.error,
              paddingHorizontal: spacing.lg,
              paddingVertical: spacing.lg,
              opacity: pressed ? 0.8 : 1,
            },
          ]}
        >
          <View style={styles.logoutContent}>
            <View
              style={[
                styles.menuIconCircle,
                {
                  width: 44,
                  height: 44,
                  borderRadius: radius.full,
                  backgroundColor: colors.surface,
                  marginRight: spacing.md,
                },
              ]}
            >
              <Ionicons name="log-out-outline" size={22} color={colors.error} />
            </View>
            <Text variant="body" color="error" style={{ fontWeight: '600' }}>
              Se déconnecter
            </Text>
          </View>
        </Pressable>
      </ScrollView>
    </View>
  );
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
  },
  menuItemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 60,
  },
  menuIconCircle: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  menuTextContent: {
    flex: 1,
  },
  separator: {
    height: 1,
  },
  logoutCard: {},
  logoutContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  providerInfoContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  providerAvatar: {
    width: 64,
    height: 64,
    borderRadius: 32,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 16,
  },
  providerDetails: {
    flex: 1,
  },
});
