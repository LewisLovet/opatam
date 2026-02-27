/**
 * Pro "More" Screen
 * Menu with links to secondary pro features.
 * Style aligned with client profile.tsx: rounded-square tinted icons,
 * grouped card sections, clean dividers.
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
import { Card, Input, Text, useToast } from '../../../components';
import { useAuth, useProvider } from '../../../contexts';
import { useTheme } from '../../../theme';

// Delete account confirmation modal
function DeleteAccountModal({
  visible,
  onCancel,
  onConfirm,
  isDeleting,
  colors,
  spacing,
}: {
  visible: boolean;
  onCancel: () => void;
  onConfirm: (password: string) => void;
  isDeleting: boolean;
  colors: any;
  spacing: any;
}) {
  const [password, setPassword] = React.useState('');

  if (!visible) return null;

  return (
    <View style={deleteStyles.overlay}>
      <View style={[deleteStyles.modal, { backgroundColor: colors.background }]}>
        <View style={[deleteStyles.iconCircle, { backgroundColor: '#fee2e2' }]}>
          <Ionicons name="warning-outline" size={32} color="#dc2626" />
        </View>
        <Text variant="h3" align="center" style={{ marginTop: spacing.md }}>
          Supprimer votre compte
        </Text>
        <Text variant="body" color="textSecondary" align="center" style={{ marginTop: spacing.sm }}>
          Cette action est irréversible. Toutes vos données (établissement, services, réservations) seront supprimées définitivement.
        </Text>
        <View style={{ marginTop: spacing.lg, width: '100%' }}>
          <Input
            label="Mot de passe"
            placeholder="Entrez votre mot de passe"
            value={password}
            onChangeText={setPassword}
            secureTextEntry
            autoCapitalize="none"
          />
        </View>
        <View style={[deleteStyles.actions, { marginTop: spacing.lg }]}>
          <Pressable
            onPress={onCancel}
            disabled={isDeleting}
            style={[deleteStyles.cancelButton, { borderColor: colors.border }]}
          >
            <Text variant="body" style={{ fontWeight: '600' }}>Annuler</Text>
          </Pressable>
          <Pressable
            onPress={() => onConfirm(password)}
            disabled={isDeleting || !password}
            style={[deleteStyles.deleteButton, { opacity: (!password || isDeleting) ? 0.5 : 1 }]}
          >
            {isDeleting ? (
              <Text variant="body" style={{ color: '#FFFFFF', fontWeight: '600' }}>Suppression...</Text>
            ) : (
              <Text variant="body" style={{ color: '#FFFFFF', fontWeight: '600' }}>Supprimer</Text>
            )}
          </Pressable>
        </View>
      </View>
    </View>
  );
}

const deleteStyles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 100,
    paddingHorizontal: 24,
  },
  modal: {
    width: '100%',
    borderRadius: 16,
    padding: 24,
    alignItems: 'center',
  },
  iconCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    justifyContent: 'center',
    alignItems: 'center',
  },
  actions: {
    flexDirection: 'row',
    gap: 12,
    width: '100%',
  },
  cancelButton: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: 'center',
  },
  deleteButton: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 12,
    backgroundColor: '#dc2626',
    alignItems: 'center',
  },
});

// ---------------------------------------------------------------------------
// Menu Item
// ---------------------------------------------------------------------------

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
        s.menuItem,
        { backgroundColor: pressed ? colors.surfaceSecondary : 'transparent' },
      ]}
    >
      <View style={[s.menuIconContainer, { backgroundColor: danger ? '#FEE2E2' : (colors.primaryLight || '#e4effa') }]}>
        <Ionicons name={icon as any} size={20} color={danger ? '#DC2626' : colors.primary} />
      </View>
      <Text
        variant="body"
        style={[s.menuLabel, danger && { color: '#DC2626' }]}
      >
        {label}
      </Text>
      {showArrow && (
        <Ionicons name="chevron-forward" size={20} color={colors.textMuted} />
      )}
    </Pressable>
  );
}

// ---------------------------------------------------------------------------
// Main Screen
// ---------------------------------------------------------------------------

export default function MoreScreen() {
  const { colors, spacing } = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { showToast } = useToast();
  const { signOut, deleteAccount, userData } = useAuth();
  const { provider } = useProvider();
  const [showDeleteModal, setShowDeleteModal] = React.useState(false);
  const [isDeleting, setIsDeleting] = React.useState(false);

  const handleDeleteAccount = async (password: string) => {
    setIsDeleting(true);
    try {
      await deleteAccount(password);
      setShowDeleteModal(false);
      router.replace('/(auth)');
    } catch (error: any) {
      showToast({
        variant: 'error',
        message: error.message || 'Erreur lors de la suppression',
      });
    } finally {
      setIsDeleting(false);
    }
  };

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
            await signOut();
            router.replace('/(auth)');
          },
        },
      ],
    );
  };

  return (
    <View style={[s.container, { backgroundColor: colors.background }]}>
      {/* ── Branded Header ── */}
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
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingTop: spacing.md, paddingBottom: spacing['3xl'] }}
      >
        {/* Provider Info Card */}
        <View style={{ paddingHorizontal: spacing.lg, marginBottom: spacing.lg }}>
          <Card padding="lg" shadow="sm">
            <View style={s.providerInfoContainer}>
              {provider?.photoURL ? (
                <Image
                  source={{ uri: provider.photoURL }}
                  style={[s.avatar, { backgroundColor: colors.surfaceSecondary }]}
                />
              ) : (
                <View style={[s.avatar, { backgroundColor: colors.primary }]}>
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
              <View style={s.providerDetails}>
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

        {/* Mon enseigne */}
        <View style={{ paddingHorizontal: spacing.lg, marginBottom: spacing.lg }}>
          <Text variant="label" color="textSecondary" style={{ marginBottom: spacing.sm, marginLeft: spacing.xs, textTransform: 'uppercase', letterSpacing: 0.5 }}>
            Mon enseigne
          </Text>
          <Card padding="none" shadow="sm">
            <MenuItem
              icon="cut-outline"
              label="Prestations"
              onPress={() => router.push('/(pro)/services')}
              colors={colors}
            />
            <View style={[s.menuDivider, { backgroundColor: colors.border }]} />
            <MenuItem
              icon="location-outline"
              label="Lieux"
              onPress={() => router.push('/(pro)/locations')}
              colors={colors}
            />
            <View style={[s.menuDivider, { backgroundColor: colors.border }]} />
            <MenuItem
              icon="people-outline"
              label="Équipe"
              onPress={() => router.push('/(pro)/members')}
              colors={colors}
            />
            <View style={[s.menuDivider, { backgroundColor: colors.border }]} />
            <MenuItem
              icon="time-outline"
              label="Disponibilités"
              onPress={() => router.push('/(pro)/availability')}
              colors={colors}
            />
          </Card>
        </View>

        {/* Profil & Publication */}
        <View style={{ paddingHorizontal: spacing.lg, marginBottom: spacing.lg }}>
          <Text variant="label" color="textSecondary" style={{ marginBottom: spacing.sm, marginLeft: spacing.xs, textTransform: 'uppercase', letterSpacing: 0.5 }}>
            Profil
          </Text>
          <Card padding="none" shadow="sm">
            <MenuItem
              icon="person-circle-outline"
              label="Profil & Publication"
              onPress={() => router.push('/(pro)/profile')}
              colors={colors}
            />
          </Card>
        </View>

        {/* Gestion */}
        <View style={{ paddingHorizontal: spacing.lg, marginBottom: spacing.lg }}>
          <Text variant="label" color="textSecondary" style={{ marginBottom: spacing.sm, marginLeft: spacing.xs, textTransform: 'uppercase', letterSpacing: 0.5 }}>
            Gestion
          </Text>
          <Card padding="none" shadow="sm">
            <MenuItem
              icon="star-outline"
              label="Avis clients"
              onPress={() => router.push('/(pro)/reviews')}
              colors={colors}
            />
            <View style={[s.menuDivider, { backgroundColor: colors.border }]} />
            <MenuItem
              icon="ban-outline"
              label="Créneaux bloqués"
              onPress={() => router.push('/(pro)/blocked-slots')}
              colors={colors}
            />
            <View style={[s.menuDivider, { backgroundColor: colors.border }]} />
            <MenuItem
              icon="stats-chart-outline"
              label="Statistiques"
              onPress={() => router.push('/(pro)/stats')}
              colors={colors}
            />
          </Card>
        </View>

        {/* Paramètres */}
        <View style={{ paddingHorizontal: spacing.lg, marginBottom: spacing.lg }}>
          <Text variant="label" color="textSecondary" style={{ marginBottom: spacing.sm, marginLeft: spacing.xs, textTransform: 'uppercase', letterSpacing: 0.5 }}>
            Paramètres
          </Text>
          <Card padding="none" shadow="sm">
            <MenuItem
              icon="calendar-outline"
              label="Paramètres de réservation"
              onPress={() => router.push('/(pro)/booking-settings')}
              colors={colors}
            />
            <View style={[s.menuDivider, { backgroundColor: colors.border }]} />
            <MenuItem
              icon="notifications-outline"
              label="Notifications"
              onPress={() => router.push('/(pro)/notification-settings')}
              colors={colors}
            />
          </Card>
        </View>

        {/* Support */}
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
            <View style={[s.menuDivider, { backgroundColor: colors.border }]} />
            <MenuItem
              icon="document-text-outline"
              label="Conditions d'utilisation"
              onPress={() => Linking.openURL('https://opatam.com/cgu')}
              colors={colors}
            />
            <View style={[s.menuDivider, { backgroundColor: colors.border }]} />
            <MenuItem
              icon="shield-checkmark-outline"
              label="Politique de confidentialité"
              onPress={() => Linking.openURL('https://opatam.com/confidentialite')}
              colors={colors}
            />
          </Card>
        </View>

        {/* Logout & Delete */}
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
            <View style={[s.menuDivider, { backgroundColor: colors.border }]} />
            <MenuItem
              icon="trash-outline"
              label="Supprimer mon compte"
              onPress={() => setShowDeleteModal(true)}
              showArrow={false}
              danger
              colors={colors}
            />
          </Card>
        </View>

        {/* App Info */}
        <View style={s.appInfo}>
          <Text variant="caption" color="textMuted" align="center">
            Opatam v1.0.4
          </Text>
          <Text variant="caption" color="textMuted" align="center" style={{ marginTop: 4 }}>
            Gérez votre activité en toute simplicité
          </Text>
        </View>
      </ScrollView>

      {/* Delete Account Modal */}
      <DeleteAccountModal
        visible={showDeleteModal}
        onCancel={() => setShowDeleteModal(false)}
        onConfirm={handleDeleteAccount}
        isDeleting={isDeleting}
        colors={colors}
        spacing={spacing}
      />
    </View>
  );
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const s = StyleSheet.create({
  container: {
    flex: 1,
  },
  providerInfoContainer: {
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
  providerDetails: {
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
