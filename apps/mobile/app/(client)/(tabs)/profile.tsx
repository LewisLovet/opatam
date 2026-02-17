/**
 * Profile Tab Screen
 * User profile information and settings
 */

import React, { useState } from 'react';
import {
  View,
  StyleSheet,
  ScrollView,
  Pressable,
  Alert,
  Image,
  Linking,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../../theme';
import { Text, Card, EmptyState, useToast } from '../../../components';
import { useAuth } from '../../../contexts';

// Menu item component
function MenuItem({
  icon,
  label,
  onPress,
  showArrow = true,
  danger = false,
  colors,
}: {
  icon: string;
  label: string;
  onPress: () => void;
  showArrow?: boolean;
  danger?: boolean;
  colors: any;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.menuItem,
        { backgroundColor: pressed ? colors.surfaceSecondary : 'transparent' },
      ]}
    >
      <View style={[styles.menuIconContainer, { backgroundColor: danger ? '#fee2e2' : (colors.primaryLight || '#e4effa') }]}>
        <Ionicons name={icon as any} size={20} color={danger ? '#dc2626' : colors.primary} />
      </View>
      <Text
        variant="body"
        style={[styles.menuLabel, danger && { color: '#dc2626' }]}
      >
        {label}
      </Text>
      {showArrow && (
        <Ionicons name="chevron-forward" size={20} color={colors.textMuted} />
      )}
    </Pressable>
  );
}

export default function ProfileScreen() {
  const { colors, spacing } = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { showToast } = useToast();
  const { userData, isAuthenticated, signOut } = useAuth();
  const [isLoggingOut, setIsLoggingOut] = useState(false);

  const handleLogout = () => {
    Alert.alert(
      'Déconnexion',
      'Êtes-vous sûr de vouloir vous déconnecter ?',
      [
        { text: 'Annuler', style: 'cancel' },
        {
          text: 'Déconnecter',
          style: 'destructive',
          onPress: async () => {
            setIsLoggingOut(true);
            try {
              await signOut();
              router.replace('/(auth)');
            } catch (error: any) {
              showToast({
                variant: 'error',
                message: error.message || 'Erreur lors de la déconnexion',
              });
            } finally {
              setIsLoggingOut(false);
            }
          },
        },
      ]
    );
  };

  const handleNotImplemented = (feature: string) => {
    showToast({
      variant: 'info',
      message: `${feature} bientôt disponible`,
    });
  };

  // Not authenticated
  if (!isAuthenticated) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <View style={{ backgroundColor: colors.primary, paddingTop: insets.top }}>
          <View style={{ paddingHorizontal: spacing.lg, paddingTop: spacing.md, paddingBottom: spacing.lg }}>
            <Text variant="h1" style={{ color: '#FFFFFF' }}>Plus</Text>
          </View>
        </View>
        <View style={[styles.content, { paddingHorizontal: spacing.lg, paddingTop: spacing.lg }]}>
          <Card padding="lg" shadow="sm">
            <EmptyState
              icon="person-outline"
              title="Connectez-vous"
              description="Accédez à votre profil, vos informations et vos préférences"
              actionLabel="Se connecter"
              onAction={() => router.push('/(auth)/login')}
            />
          </Card>

          {/* App Info */}
          <View style={[styles.appInfo, { marginTop: spacing.xl }]}>
            <Text variant="caption" color="textMuted" align="center">
              Opatam v1.0.0
            </Text>
            <Text variant="caption" color="textMuted" align="center" style={{ marginTop: spacing.xs }}>
              Réservez vos rendez-vous en toute simplicité
            </Text>
          </View>
        </View>
      </View>
    );
  }

  // Get initials for avatar
  const initials = userData?.displayName
    ?.split(' ')
    .map((n) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2) || '?';

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {/* ── Branded Header ── */}
      <View style={{ backgroundColor: colors.primary, paddingTop: insets.top }}>
        <View style={{ paddingHorizontal: spacing.lg, paddingTop: spacing.md, paddingBottom: spacing.lg }}>
          <Text variant="h1" style={{ color: '#FFFFFF' }}>Plus</Text>
        </View>
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingTop: spacing.md, paddingBottom: spacing['3xl'] }}
      >

        {/* User Info Card */}
        <View style={{ paddingHorizontal: spacing.lg, marginBottom: spacing.lg }}>
          <Card padding="lg" shadow="sm">
            <View style={styles.userInfoContainer}>
              {/* Avatar */}
              {userData?.photoURL ? (
                <Image
                  source={{ uri: userData.photoURL }}
                  style={[styles.avatar, { backgroundColor: colors.surfaceSecondary }]}
                />
              ) : (
                <View style={[styles.avatar, { backgroundColor: colors.primary }]}>
                  <Text variant="h2" style={{ color: '#FFFFFF' }}>
                    {initials}
                  </Text>
                </View>
              )}

              {/* User details */}
              <View style={styles.userDetails}>
                <Text variant="h3">{userData?.displayName || 'Utilisateur'}</Text>
                <Text variant="body" color="textSecondary" style={{ marginTop: 2 }}>
                  {userData?.email}
                </Text>
                {userData?.phone && (
                  <Text variant="caption" color="textSecondary" style={{ marginTop: 2 }}>
                    {userData.phone}
                  </Text>
                )}
              </View>
            </View>
          </Card>
        </View>

        {/* Menu Section */}
        <View style={{ paddingHorizontal: spacing.lg, marginBottom: spacing.lg }}>
          <Text variant="label" color="textSecondary" style={{ marginBottom: spacing.sm, marginLeft: spacing.xs, textTransform: 'uppercase', letterSpacing: 0.5 }}>
            Compte
          </Text>
          <Card padding="none" shadow="sm">
            <MenuItem
              icon="person-outline"
              label="Modifier le profil"
              onPress={() => router.push('/(client)/edit-profile')}
              colors={colors}
            />
            <View style={[styles.menuDivider, { backgroundColor: colors.border }]} />
            <MenuItem
              icon="notifications-outline"
              label="Notifications"
              onPress={() => router.push('/(client)/notification-settings')}
              colors={colors}
            />
            <View style={[styles.menuDivider, { backgroundColor: colors.border }]} />
            <MenuItem
              icon="lock-closed-outline"
              label="Sécurité"
              onPress={() => handleNotImplemented('Sécurité')}
              colors={colors}
            />
          </Card>
        </View>

        {/* Support Section */}
        <View style={{ paddingHorizontal: spacing.lg, marginBottom: spacing.lg }}>
          <Text variant="label" color="textSecondary" style={{ marginBottom: spacing.sm, marginLeft: spacing.xs, textTransform: 'uppercase', letterSpacing: 0.5 }}>
            Support
          </Text>
          <Card padding="none" shadow="sm">
            <MenuItem
              icon="help-circle-outline"
              label="Aide et contact"
              onPress={() => Linking.openURL('https://opatam.com/contact')}
              colors={colors}
            />
            <View style={[styles.menuDivider, { backgroundColor: colors.border }]} />
            <MenuItem
              icon="document-text-outline"
              label="Conditions d'utilisation"
              onPress={() => Linking.openURL('https://opatam.com/cgu')}
              colors={colors}
            />
            <View style={[styles.menuDivider, { backgroundColor: colors.border }]} />
            <MenuItem
              icon="shield-checkmark-outline"
              label="Politique de confidentialité"
              onPress={() => Linking.openURL('https://opatam.com/confidentialite')}
              colors={colors}
            />
          </Card>
        </View>

        {/* Logout */}
        <View style={{ paddingHorizontal: spacing.lg, marginBottom: spacing.xl }}>
          <Card padding="none" shadow="sm">
            <MenuItem
              icon="log-out-outline"
              label="Se déconnecter"
              onPress={handleLogout}
              showArrow={false}
              danger
              colors={colors}
            />
          </Card>
        </View>

        {/* App Info */}
        <View style={styles.appInfo}>
          <Text variant="caption" color="textMuted" align="center">
            Opatam v1.0.0
          </Text>
          <Text variant="caption" color="textMuted" align="center" style={{ marginTop: spacing.xs }}>
            Réservez vos rendez-vous en toute simplicité
          </Text>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    // Dynamic styles
  },
  content: {
    flex: 1,
  },
  userInfoContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  avatar: {
    width: 64,
    height: 64,
    borderRadius: 32,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 16,
  },
  userDetails: {
    flex: 1,
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 16,
  },
  menuIconContainer: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  menuLabel: {
    flex: 1,
    fontWeight: '500',
  },
  menuDivider: {
    height: 1,
    marginLeft: 64,
  },
  appInfo: {
    alignItems: 'center',
    paddingHorizontal: 24,
  },
});
