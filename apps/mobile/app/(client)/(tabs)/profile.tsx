/**
 * Profile Tab Screen
 * User profile information and settings
 */

import { reauthenticateUser, updateUserPassword } from '@booking-app/firebase';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
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
import { Card, EmptyState, Input, Text, useToast } from '../../../components';
import { useAuth } from '../../../contexts';
import { setAppLocale, type AppLocale } from '../../../lib/i18n';
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
  const [password, setPassword] = useState('');
  const { t } = useTranslation();

  if (!visible) return null;

  return (
    <View style={deleteStyles.overlay}>
      <View style={[deleteStyles.modal, { backgroundColor: colors.background }]}>
        <View style={[deleteStyles.iconCircle, { backgroundColor: '#fee2e2' }]}>
          <Ionicons name="warning-outline" size={32} color="#dc2626" />
        </View>
        <Text variant="h3" align="center" style={{ marginTop: spacing.md }}>
          {t('profile.delete.title')}
        </Text>
        <Text variant="body" color="textSecondary" align="center" style={{ marginTop: spacing.sm }}>
          {t('profile.delete.message')}
        </Text>
        <View style={{ marginTop: spacing.lg, width: '100%' }}>
          <Input
            label={t('profile.delete.passwordLabel')}
            placeholder={t('profile.delete.passwordPlaceholder')}
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
            <Text variant="body" style={{ fontWeight: '600' }}>{t('common.cancel')}</Text>
          </Pressable>
          <Pressable
            onPress={() => onConfirm(password)}
            disabled={isDeleting || !password}
            style={[deleteStyles.deleteButton, { opacity: (!password || isDeleting) ? 0.5 : 1 }]}
          >
            <Text variant="body" style={{ color: '#FFFFFF', fontWeight: '600' }}>
              {isDeleting ? t('profile.delete.deleting') : t('profile.delete.confirm')}
            </Text>
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

// Change password modal
function ChangePasswordModal({
  visible,
  onClose,
  colors,
  spacing,
}: {
  visible: boolean;
  onClose: () => void;
  colors: any;
  spacing: any;
}) {
  const { showToast } = useToast();
  const { t } = useTranslation();
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const reset = () => {
    setCurrentPassword('');
    setNewPassword('');
    setConfirmPassword('');
  };

  const handleSubmit = async () => {
    if (newPassword.length < 6) {
      showToast({ variant: 'error', message: t('profile.password.tooShort') });
      return;
    }
    if (newPassword !== confirmPassword) {
      showToast({ variant: 'error', message: t('profile.password.mismatch') });
      return;
    }

    setLoading(true);
    try {
      await reauthenticateUser(currentPassword);
      await updateUserPassword(newPassword);
      showToast({ variant: 'success', message: t('profile.password.success') });
      reset();
      onClose();
    } catch (error: any) {
      const msg = error.code === 'auth/wrong-password'
        ? t('profile.password.wrongCurrent')
        : error.message || t('profile.password.error');
      showToast({ variant: 'error', message: msg });
    } finally {
      setLoading(false);
    }
  };

  if (!visible) return null;

  const canSubmit = currentPassword && newPassword.length >= 6 && confirmPassword && !loading;

  return (
    <View style={deleteStyles.overlay}>
      <View style={[deleteStyles.modal, { backgroundColor: colors.background }]}>
        <View style={[deleteStyles.iconCircle, { backgroundColor: colors.primaryLight || '#e4effa' }]}>
          <Ionicons name="lock-closed-outline" size={32} color={colors.primary} />
        </View>
        <Text variant="h3" align="center" style={{ marginTop: spacing.md }}>
          {t('profile.password.title')}
        </Text>
        <View style={{ marginTop: spacing.lg, width: '100%', gap: spacing.sm }}>
          <Input
            label={t('profile.password.currentLabel')}
            placeholder={t('profile.password.currentPlaceholder')}
            value={currentPassword}
            onChangeText={setCurrentPassword}
            secureTextEntry
            autoCapitalize="none"
          />
          <Input
            label={t('profile.password.newLabel')}
            placeholder={t('profile.password.newPlaceholder')}
            value={newPassword}
            onChangeText={setNewPassword}
            secureTextEntry
            autoCapitalize="none"
          />
          <Input
            label={t('profile.password.confirmLabel')}
            placeholder={t('profile.password.confirmPlaceholder')}
            value={confirmPassword}
            onChangeText={setConfirmPassword}
            secureTextEntry
            autoCapitalize="none"
          />
        </View>
        <View style={[deleteStyles.actions, { marginTop: spacing.lg }]}>
          <Pressable
            onPress={() => { reset(); onClose(); }}
            disabled={loading}
            style={[deleteStyles.cancelButton, { borderColor: colors.border }]}
          >
            <Text variant="body" style={{ fontWeight: '600' }}>{t('common.cancel')}</Text>
          </Pressable>
          <Pressable
            onPress={handleSubmit}
            disabled={!canSubmit}
            style={[deleteStyles.deleteButton, { backgroundColor: colors.primary, opacity: canSubmit ? 1 : 0.5 }]}
          >
            <Text variant="body" style={{ color: '#FFFFFF', fontWeight: '600' }}>
              {loading ? t('profile.password.submitting') : t('profile.password.submit')}
            </Text>
          </Pressable>
        </View>
      </View>
    </View>
  );
}

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
  const { t, i18n } = useTranslation();
  const currentLocale: AppLocale = i18n.language === 'en' ? 'en' : 'fr';
  const { userData, isAuthenticated, signOut, deleteAccount } = useAuth();
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  const handleLogout = () => {
    Alert.alert(
      t('profile.logout.title'),
      t('profile.logout.message'),
      [
        { text: t('common.cancel'), style: 'cancel' },
        {
          text: t('profile.logout.confirm'),
          style: 'destructive',
          onPress: async () => {
            setIsLoggingOut(true);
            try {
              await signOut();
              router.replace('/(auth)');
            } catch (error: any) {
              showToast({
                variant: 'error',
                message: error.message || t('profile.logout.error'),
              });
            } finally {
              setIsLoggingOut(false);
            }
          },
        },
      ]
    );
  };

  const handleDeleteAccount = async (password: string) => {
    setIsDeleting(true);
    try {
      await deleteAccount(password);
      setShowDeleteModal(false);
      router.replace('/(auth)');
    } catch (error: any) {
      showToast({
        variant: 'error',
        message: error.message || t('profile.delete.error'),
      });
    } finally {
      setIsDeleting(false);
    }
  };

  const handleNotImplemented = (feature: string) => {
    showToast({
      variant: 'info',
      message: t('profile.comingSoon', { feature }),
    });
  };

  const handleLocaleChange = (next: AppLocale) => {
    if (next === currentLocale) return;
    // Choix explicite : bascule immédiate + persistance AsyncStorage.
    void setAppLocale(next);
  };

  // Not authenticated
  if (!isAuthenticated) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <View style={{ backgroundColor: colors.primary, paddingTop: insets.top }}>
          <View style={{ paddingHorizontal: spacing.lg, paddingTop: spacing.md, paddingBottom: spacing.lg }}>
            <Text variant="h1" style={{ color: '#FFFFFF' }}>{t('profile.title')}</Text>
          </View>
        </View>
        <View style={[styles.content, { paddingHorizontal: spacing.lg, paddingTop: spacing.lg }]}>
          <Card padding="lg" shadow="sm">
            <EmptyState
              icon="person-outline"
              title={t('profile.notAuth.title')}
              description={t('profile.notAuth.description')}
              actionLabel={t('profile.notAuth.action')}
              onAction={() => router.push('/(auth)/login')}
            />
          </Card>

          {/* App Info */}
          <View style={[styles.appInfo, { marginTop: spacing.xl }]}>
            <Text variant="caption" color="textMuted" align="center">
              Opatam v1.2.2
            </Text>
            <Text variant="caption" color="textMuted" align="center" style={{ marginTop: spacing.xs }}>
              {t('profile.tagline')}
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
          <Text variant="h1" style={{ color: '#FFFFFF' }}>{t('profile.title')}</Text>
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
                <Text variant="h3">{userData?.displayName || t('profile.defaultUser')}</Text>
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
            {t('profile.sections.account')}
          </Text>
          <Card padding="none" shadow="sm">
            <MenuItem
              icon="person-outline"
              label={t('profile.menu.editProfile')}
              onPress={() => router.push('/(client)/edit-profile')}
              colors={colors}
            />
            <View style={[styles.menuDivider, { backgroundColor: colors.border }]} />
            <MenuItem
              icon="notifications-outline"
              label={t('profile.menu.notifications')}
              onPress={() => router.push('/(client)/notification-settings')}
              colors={colors}
            />
            <View style={[styles.menuDivider, { backgroundColor: colors.border }]} />
            <MenuItem
              icon="lock-closed-outline"
              label={t('profile.menu.changePassword')}
              onPress={() => setShowPasswordModal(true)}
              colors={colors}
            />
          </Card>
        </View>

        {/* Preferences Section — language selector (explicit choice,
            persisted; overrides the device language, see lib/i18n.ts) */}
        <View style={{ paddingHorizontal: spacing.lg, marginBottom: spacing.lg }}>
          <Text variant="label" color="textSecondary" style={{ marginBottom: spacing.sm, marginLeft: spacing.xs, textTransform: 'uppercase', letterSpacing: 0.5 }}>
            {t('profile.sections.preferences')}
          </Text>
          <Card padding="none" shadow="sm">
            {([
              { locale: 'fr' as AppLocale, label: t('profile.language.french') },
              { locale: 'en' as AppLocale, label: t('profile.language.english') },
            ]).map((option, idx) => (
              <React.Fragment key={option.locale}>
                {idx > 0 && <View style={[styles.menuDivider, { backgroundColor: colors.border }]} />}
                <Pressable
                  onPress={() => handleLocaleChange(option.locale)}
                  style={({ pressed }) => [
                    styles.menuItem,
                    { backgroundColor: pressed ? colors.surfaceSecondary : 'transparent' },
                  ]}
                >
                  <View style={[styles.menuIconContainer, { backgroundColor: colors.primaryLight || '#e4effa' }]}>
                    <Ionicons name="language-outline" size={20} color={colors.primary} />
                  </View>
                  <Text variant="body" style={styles.menuLabel}>
                    {option.label}
                  </Text>
                  {currentLocale === option.locale && (
                    <Ionicons name="checkmark" size={20} color={colors.primary} />
                  )}
                </Pressable>
              </React.Fragment>
            ))}
          </Card>
        </View>

        {/* Support Section */}
        <View style={{ paddingHorizontal: spacing.lg, marginBottom: spacing.lg }}>
          <Text variant="label" color="textSecondary" style={{ marginBottom: spacing.sm, marginLeft: spacing.xs, textTransform: 'uppercase', letterSpacing: 0.5 }}>
            {t('profile.sections.support')}
          </Text>
          <Card padding="none" shadow="sm">
            <MenuItem
              icon="help-circle-outline"
              label={t('profile.menu.help')}
              onPress={() => Linking.openURL('https://opatam.com/contact')}
              colors={colors}
            />
            <View style={[styles.menuDivider, { backgroundColor: colors.border }]} />
            <MenuItem
              icon="document-text-outline"
              label={t('profile.menu.terms')}
              onPress={() => Linking.openURL('https://opatam.com/cgu')}
              colors={colors}
            />
            <View style={[styles.menuDivider, { backgroundColor: colors.border }]} />
            <MenuItem
              icon="shield-checkmark-outline"
              label={t('profile.menu.privacy')}
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
              label={t('profile.menu.logout')}
              onPress={handleLogout}
              showArrow={false}
              danger
              colors={colors}
            />
            <View style={[styles.menuDivider, { backgroundColor: colors.border }]} />
            <MenuItem
              icon="trash-outline"
              label={t('profile.menu.deleteAccount')}
              onPress={() => setShowDeleteModal(true)}
              showArrow={false}
              danger
              colors={colors}
            />
          </Card>
        </View>

        {/* App Info */}
        <View style={styles.appInfo}>
          <Text variant="caption" color="textMuted" align="center">
            Opatam v1.0.8
          </Text>
          <Text variant="caption" color="textMuted" align="center" style={{ marginTop: spacing.xs }}>
            {t('profile.tagline')}
          </Text>
        </View>
      </ScrollView>

      {/* Change Password Modal */}
      <ChangePasswordModal
        visible={showPasswordModal}
        onClose={() => setShowPasswordModal(false)}
        colors={colors}
        spacing={spacing}
      />

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
