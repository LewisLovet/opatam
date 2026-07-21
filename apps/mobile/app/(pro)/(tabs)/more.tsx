/**
 * Pro "More" Screen
 * Menu with links to secondary pro features.
 * Style aligned with client profile.tsx: rounded-square tinted icons,
 * grouped card sections, clean dividers.
 */

import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React from 'react';
import { useTranslation } from 'react-i18next';
import {
  Alert,
  Image,
  Linking,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { reauthenticateUser, updateUserPassword } from '@booking-app/firebase';
import { Card, Input, Text, useToast } from '../../../components';
import { useAuth, useProvider, useSubscriptionStatus } from '../../../contexts';
import {
  useBlockedSlots,
  useNewArticles,
  useNewFeatures,
  useProviderClientsCount,
} from '../../../hooks';
import i18n from '../../../lib/i18n';
import { LanguageSettingRow } from '../../../components/LanguageSettingRow';
import { useTheme } from '../../../theme';

/** Map internal plan IDs to their i18n label keys. "Pro"/"Studio"/"Test"
 *  are product names (identical in both languages); "trial" translates. */
const PLAN_LABEL_KEYS: Record<string, string> = {
  solo: 'proMore.plans.solo',
  team: 'proMore.plans.team',
  trial: 'proMore.plans.trial',
  test: 'proMore.plans.test',
};

/** User-facing plan label — i18n.t called at the moment the label is produced. */
function planLabel(plan?: string | null): string {
  return i18n.t(PLAN_LABEL_KEYS[plan ?? ''] ?? 'proMore.plans.solo');
}

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
  const { t } = useTranslation();

  if (!visible) return null;

  return (
    <View style={deleteStyles.overlay}>
      <View style={[deleteStyles.modal, { backgroundColor: colors.background }]}>
        <View style={[deleteStyles.iconCircle, { backgroundColor: '#fee2e2' }]}>
          <Ionicons name="warning-outline" size={32} color="#dc2626" />
        </View>
        <Text variant="h3" align="center" style={{ marginTop: spacing.md }}>
          {t('proMore.delete.title')}
        </Text>
        <Text variant="body" color="textSecondary" align="center" style={{ marginTop: spacing.sm }}>
          {t('proMore.delete.message')}
        </Text>
        <View style={{ marginTop: spacing.lg, width: '100%' }}>
          <Input
            label={t('proMore.delete.passwordLabel')}
            placeholder={t('proMore.delete.passwordPlaceholder')}
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
            {isDeleting ? (
              <Text variant="body" style={{ color: '#FFFFFF', fontWeight: '600' }}>{t('proMore.delete.deleting')}</Text>
            ) : (
              <Text variant="body" style={{ color: '#FFFFFF', fontWeight: '600' }}>{t('proMore.delete.confirm')}</Text>
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
  const [currentPassword, setCurrentPassword] = React.useState('');
  const [newPassword, setNewPassword] = React.useState('');
  const [confirmPassword, setConfirmPassword] = React.useState('');
  const [loading, setLoading] = React.useState(false);

  const reset = () => {
    setCurrentPassword('');
    setNewPassword('');
    setConfirmPassword('');
  };

  const handleSubmit = async () => {
    if (newPassword.length < 6) {
      showToast({ variant: 'error', message: t('proMore.password.tooShort') });
      return;
    }
    if (newPassword !== confirmPassword) {
      showToast({ variant: 'error', message: t('proMore.password.mismatch') });
      return;
    }

    setLoading(true);
    try {
      await reauthenticateUser(currentPassword);
      await updateUserPassword(newPassword);
      showToast({ variant: 'success', message: t('proMore.password.success') });
      reset();
      onClose();
    } catch (error: any) {
      const msg = error.code === 'auth/wrong-password'
        ? t('proMore.password.wrongCurrent')
        : error.message || t('proMore.password.error');
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
          {t('proMore.password.title')}
        </Text>
        <View style={{ marginTop: spacing.lg, width: '100%', gap: spacing.sm }}>
          <Input
            label={t('proMore.password.currentLabel')}
            placeholder={t('proMore.password.currentPlaceholder')}
            value={currentPassword}
            onChangeText={setCurrentPassword}
            secureTextEntry
            autoCapitalize="none"
          />
          <Input
            label={t('proMore.password.newLabel')}
            placeholder={t('proMore.password.newPlaceholder')}
            value={newPassword}
            onChangeText={setNewPassword}
            secureTextEntry
            autoCapitalize="none"
          />
          <Input
            label={t('proMore.password.confirmLabel')}
            placeholder={t('proMore.password.confirmPlaceholder')}
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
              {loading ? t('proMore.password.submitting') : t('proMore.password.submit')}
            </Text>
          </Pressable>
        </View>
      </View>
    </View>
  );
}

// ---------------------------------------------------------------------------
// Grid Item (for "Mon enseigne" section)
// ---------------------------------------------------------------------------

function GridItem({
  icon,
  label,
  onPress,
  colors,
}: {
  icon: string;
  label: string;
  onPress: () => void;
  colors: any;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        s.gridItem,
        { opacity: pressed ? 0.7 : 1 },
      ]}
    >
      <View style={[s.gridIconContainer, { backgroundColor: colors.primaryLight || '#e4effa' }]}>
        <Ionicons name={icon as any} size={24} color={colors.primary} />
      </View>
      <Text variant="caption" color="textSecondary" style={s.gridLabel} numberOfLines={2}>
        {label}
      </Text>
    </Pressable>
  );
}

// ---------------------------------------------------------------------------
// Menu Item (for list sections)
// ---------------------------------------------------------------------------

function MenuItem({
  icon,
  label,
  badge,
  isNew = false,
  onPress,
  showArrow = true,
  danger = false,
  colors,
}: {
  icon: string;
  label: string;
  badge?: string | number | null;
  /** When true, shows a "Nouveau" pill next to the label until the
   *  user taps the item (parent should call markSeen on press). */
  isNew?: boolean;
  onPress: () => void;
  showArrow?: boolean;
  danger?: boolean;
  colors: any;
}) {
  const { t } = useTranslation();
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
      <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center', gap: 8 }}>
        <Text
          variant="body"
          style={[s.menuLabel, danger && { color: '#DC2626' }, { flex: 0 }]}
        >
          {label}
        </Text>
        {isNew && (
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              gap: 4,
              backgroundColor: colors.primary,
              paddingHorizontal: 8,
              paddingVertical: 3,
              borderRadius: 999,
              // Subtle glow so it pops against light row backgrounds —
              // the previous tiny pill was easy to miss.
              shadowColor: colors.primary,
              shadowOffset: { width: 0, height: 2 },
              shadowOpacity: 0.35,
              shadowRadius: 4,
              elevation: 3,
            }}
          >
            <Ionicons name="sparkles" size={11} color="#FFF" />
            <Text
              variant="caption"
              style={{
                color: '#FFF',
                fontWeight: '800',
                fontSize: 10,
                textTransform: 'uppercase',
                letterSpacing: 0.6,
              }}
            >
              {t('proMore.newBadge')}
            </Text>
          </View>
        )}
      </View>
      {badge != null && (
        <View style={{ backgroundColor: colors.primaryLight || '#e4effa', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 12, marginRight: 4 }}>
          <Text variant="caption" color="primary" style={{ fontWeight: '700', fontSize: 11 }}>{badge}</Text>
        </View>
      )}
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
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { showToast } = useToast();
  const { signOut, deleteAccount, userData } = useAuth();
  const { provider, providerId } = useProvider();
  const { blockedSlots } = useBlockedSlots(providerId ?? null);
  // Count of distinct clients who've ever booked here — drives the
  // small badge next to the "Clients" menu item, same convention as
  // "Avis clients" and "Créneaux bloqués".
  const clientsCount = useProviderClientsCount(providerId ?? undefined);
  const sub = useSubscriptionStatus();
  // "Nouveau" badge state on menu items shipped recently — flips
  // to off as soon as the user taps the row, persisted on-device.
  const { isNew, markSeen } = useNewFeatures();
  // Same pattern but driven by article publication dates rather
  // than a hardcoded feature key, so the Tutoriels & guides entry
  // re-fires "Nouveau" whenever a fresh tutorial is published.
  const { hasNew: hasNewTutorials } = useNewArticles();
  const [showDeleteModal, setShowDeleteModal] = React.useState(false);
  const [isDeleting, setIsDeleting] = React.useState(false);
  const [showPasswordModal, setShowPasswordModal] = React.useState(false);

  const handleDeleteAccount = async (password: string) => {
    setIsDeleting(true);
    try {
      await deleteAccount(password);
      setShowDeleteModal(false);
      router.replace('/(auth)');
    } catch (error: any) {
      showToast({
        variant: 'error',
        message: error.message || t('proMore.delete.error'),
      });
    } finally {
      setIsDeleting(false);
    }
  };

  const handleLogout = () => {
    Alert.alert(
      t('proMore.logout.title'),
      t('proMore.logout.message'),
      [
        { text: t('common.cancel'), style: 'cancel' },
        {
          text: t('proMore.logout.confirm'),
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
          <Text variant="h1" style={{ color: '#FFFFFF' }}>{t('proMore.title')}</Text>
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
                <Text variant="h3">{provider?.businessName || t('proMore.businessFallback')}</Text>
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

        {/* Subscription Card — premium design */}
        <Pressable
          onPress={() => {
            if (sub.isActive) {
              if (sub.paymentSource === 'stripe') {
                Linking.openURL('https://opatam.com/pro/abonnement');
              } else if (sub.paymentSource === 'google' || Platform.OS === 'android') {
                Linking.openURL('https://play.google.com/store/account/subscriptions');
              } else {
                Linking.openURL('https://apps.apple.com/account/subscriptions');
              }
            } else {
              router.push('/(pro)/paywall');
            }
          }}
          style={({ pressed }) => [{ paddingHorizontal: spacing.lg, marginBottom: spacing.lg, opacity: pressed ? 0.92 : 1 }]}
        >
          <View style={s.subCard}>
            <LinearGradient
              colors={
                sub.isActive
                  ? ['#0F172A', '#1E3A5F']
                  : sub.isTrialing
                    ? ['#1E40AF', '#3B82F6']
                    : ['#7C2D12', '#DC2626']
              }
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={s.subCardGradient}
            >
              {/* Decorative circles */}
              <View style={[s.subCardDecorCircle, { top: -20, right: -20, opacity: 0.08 }]} />
              <View style={[s.subCardDecorCircle, { bottom: -30, left: -10, opacity: 0.05, width: 80, height: 80, borderRadius: 40 }]} />

              <View style={s.subCardHeader}>
                <View style={s.subCardIconContainer}>
                  <Ionicons
                    name={sub.isActive ? 'diamond' : sub.isTrialing ? 'time-outline' : 'alert-circle'}
                    size={20}
                    color="#FFFFFF"
                  />
                </View>
                <View style={s.subCardBadge}>
                  <Text style={s.subCardBadgeText}>
                    {sub.isActive
                      ? planLabel(sub.plan)
                      : sub.isTrialing
                        ? t('proMore.plans.trial')
                        : t('proMore.sub.badgeExpired')}
                  </Text>
                </View>
              </View>

              <Text style={s.subCardTitle}>
                {sub.isActive
                  ? t('proMore.sub.planTitle', { plan: planLabel(sub.plan) })
                  : sub.isTrialing
                    ? t('proMore.sub.trialTitle')
                    : t('proMore.sub.noneTitle')}
              </Text>
              <Text style={s.subCardSubtitle}>
                {sub.isActive
                  ? `${t('proMore.sub.activeSubtitle')}${sub.paymentSource === 'stripe' ? t('proMore.sub.viaWeb') : sub.paymentSource === 'apple' ? t('proMore.sub.viaApple') : sub.paymentSource === 'google' ? t('proMore.sub.viaGoogle') : ''}`
                  : sub.isTrialing
                    ? t('proMore.sub.trialSubtitle')
                    : t('proMore.sub.expiredSubtitle')}
              </Text>

              <View style={s.subCardFooter}>
                <Text style={s.subCardAction}>
                  {sub.isActive ? t('proMore.sub.manage') : t('proMore.sub.seePlans')}
                </Text>
                <Ionicons name="chevron-forward" size={16} color="rgba(255,255,255,0.7)" />
              </View>
            </LinearGradient>
          </View>
        </Pressable>

        {/* Subscription expired banner */}
        {sub.needsSubscription && (
          <Pressable
            onPress={() => router.push('/(pro)/paywall')}
            style={{ paddingHorizontal: spacing.lg, marginBottom: spacing.lg }}
          >
            <View style={s.expiredBanner}>
              <View style={s.expiredBannerContent}>
                <Ionicons name="alert-circle" size={22} color="#DC2626" />
                <View style={{ flex: 1 }}>
                  <Text variant="body" style={{ fontWeight: '600', color: '#991B1B' }}>
                    {t('proMore.sub.requiredTitle')}
                  </Text>
                  <Text variant="caption" style={{ color: '#B91C1C', marginTop: 2 }}>
                    {t('proMore.sub.requiredMessage')}
                  </Text>
                </View>
                <Ionicons name="chevron-forward" size={18} color="#DC2626" />
              </View>
            </View>
          </Pressable>
        )}

        {/* Mon enseigne — grille d'icônes */}
        <View style={{ paddingHorizontal: spacing.lg, marginBottom: spacing.lg }}>
          <Text variant="label" color="textSecondary" style={{ marginBottom: spacing.sm, marginLeft: spacing.xs, textTransform: 'uppercase', letterSpacing: 0.5 }}>
            {t('proMore.sections.business')}
          </Text>
          <Card padding="md" shadow="sm">
            <View style={s.grid}>
              <GridItem
                icon="cut-outline"
                label={t('proMore.grid.services')}
                onPress={() => router.push('/(pro)/services')}
                colors={colors}
              />
              <GridItem
                icon="location-outline"
                label={t('proMore.grid.locations')}
                onPress={() => router.push('/(pro)/locations')}
                colors={colors}
              />
              <GridItem
                icon="people-outline"
                label={t('proMore.grid.team')}
                onPress={() => router.push('/(pro)/members')}
                colors={colors}
              />
              <GridItem
                icon="time-outline"
                label={t('proMore.grid.availability')}
                onPress={() => router.push('/(pro)/availability')}
                colors={colors}
              />
            </View>
          </Card>
        </View>

        {/* Profil public — carte mise en avant */}
        <View style={{ paddingHorizontal: spacing.lg, marginBottom: spacing.lg }}>
          <Pressable
            onPress={() => router.push('/(pro)/profile')}
            style={({ pressed }) => ({ opacity: pressed ? 0.85 : 1 })}
          >
            <View style={[s.profileCard, { borderColor: provider?.isPublished ? '#BBF7D0' : colors.border }]}>
              <View style={[s.profileCardGradient, { backgroundColor: provider?.isPublished ? '#F0FDF4' : colors.surfaceSecondary }]}>
                <View style={s.profileCardContent}>
                  <View style={[s.profileCardIcon, { backgroundColor: provider?.isPublished ? '#DCFCE7' : (colors.primaryLight || '#e4effa') }]}>
                    <Ionicons name="globe-outline" size={22} color={provider?.isPublished ? '#16A34A' : colors.primary} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text variant="body" style={{ fontWeight: '600' }}>{t('proMore.storefront.title')}</Text>
                    <Text variant="caption" color="textSecondary" style={{ marginTop: 2 }}>
                      {provider?.isPublished ? t('proMore.storefront.published') : t('proMore.storefront.unpublished')}
                    </Text>
                    <Text variant="caption" color="primary" style={{ marginTop: 4, fontWeight: '600' }}>
                      {t('proMore.storefront.editCta')}
                    </Text>
                  </View>
                  <View style={s.profileCardRight}>
                    <View style={[s.statusBadge, { backgroundColor: provider?.isPublished ? '#DCFCE7' : colors.surfaceSecondary }]}>
                      <View style={[s.statusDot, { backgroundColor: provider?.isPublished ? '#16A34A' : colors.textMuted }]} />
                      <Text variant="caption" style={{ fontWeight: '600', color: provider?.isPublished ? '#16A34A' : colors.textMuted, fontSize: 11 }}>
                        {provider?.isPublished ? t('proMore.storefront.online') : t('proMore.storefront.offline')}
                      </Text>
                    </View>
                    <Ionicons name="chevron-forward" size={18} color={colors.textMuted} style={{ marginTop: 4 }} />
                  </View>
                </View>
              </View>
            </View>
          </Pressable>
        </View>

        {/* Gestion */}
        <View style={{ paddingHorizontal: spacing.lg, marginBottom: spacing.lg }}>
          <Text variant="label" color="textSecondary" style={{ marginBottom: spacing.sm, marginLeft: spacing.xs, textTransform: 'uppercase', letterSpacing: 0.5 }}>
            {t('proMore.sections.management')}
          </Text>
          <Card padding="none" shadow="sm">
            <MenuItem
              icon="people-outline"
              label={t('proMore.menu.clients')}
              badge={clientsCount && clientsCount > 0 ? clientsCount : null}
              isNew={isNew('clients-2026-05')}
              onPress={() => {
                markSeen('clients-2026-05');
                router.push('/(pro)/clients');
              }}
              colors={colors}
            />
            <View style={[s.menuDivider, { backgroundColor: colors.border }]} />
            <MenuItem
              icon="star-outline"
              label={t('proMore.menu.reviews')}
              badge={provider?.rating?.count || null}
              onPress={() => router.push('/(pro)/reviews')}
              colors={colors}
            />
            <View style={[s.menuDivider, { backgroundColor: colors.border }]} />
            <MenuItem
              icon="ban-outline"
              label={t('proMore.menu.blockedSlots')}
              badge={blockedSlots?.length || null}
              onPress={() => router.push('/(pro)/blocked-slots')}
              colors={colors}
            />
            <View style={[s.menuDivider, { backgroundColor: colors.border }]} />
            <MenuItem
              icon="stats-chart-outline"
              label={t('proMore.menu.stats')}
              isNew={isNew('stats-2026-05')}
              onPress={() => {
                markSeen('stats-2026-05');
                router.push('/(pro)/stats');
              }}
              colors={colors}
            />
          </Card>
        </View>

        {/* Paramètres */}
        <View style={{ paddingHorizontal: spacing.lg, marginBottom: spacing.lg }}>
          <Text variant="label" color="textSecondary" style={{ marginBottom: spacing.sm, marginLeft: spacing.xs, textTransform: 'uppercase', letterSpacing: 0.5 }}>
            {t('proMore.sections.settings')}
          </Text>
          <Card padding="none" shadow="sm">
            <MenuItem
              icon="calendar-outline"
              label={t('proMore.menu.bookingSettings')}
              // Surface the auto-review "Nouveau" indicator on the
              // entry point so the Plus-tab dot has a visible
              // counterpart in the menu. Mark seen on tap — making
              // the user actually flip the toggle just to clear the
              // pill is too much friction (and confusing when they
              // don't realise the pill is gated on the toggle).
              isNew={isNew('auto-review-2026-05')}
              onPress={() => {
                markSeen('auto-review-2026-05');
                router.push('/(pro)/booking-settings');
              }}
              colors={colors}
            />
            <View style={[s.menuDivider, { backgroundColor: colors.border }]} />
            <MenuItem
              icon="notifications-outline"
              label={t('proMore.menu.notifications')}
              onPress={() => router.push('/(pro)/notification-settings')}
              colors={colors}
            />
            <View style={[s.menuDivider, { backgroundColor: colors.border }]} />
            <MenuItem
              icon="card-outline"
              label={t('proMore.menu.payments')}
              isNew={isNew('payments-2026-05')}
              onPress={() => {
                markSeen('payments-2026-05');
                router.push('/(pro)/payments');
              }}
              colors={colors}
            />
            <View style={[s.menuDivider, { backgroundColor: colors.border }]} />
            <MenuItem
              icon="lock-closed-outline"
              label={t('proMore.menu.changePassword')}
              onPress={() => setShowPasswordModal(true)}
              colors={colors}
            />
          </Card>
        </View>

        {/* Préférences — sélecteur de langue (choix explicite, persisté ;
            même pattern que l'onglet Profil client, voir lib/i18n.ts) */}
        <View style={{ paddingHorizontal: spacing.lg, marginBottom: spacing.lg }}>
          <Text variant="label" color="textSecondary" style={{ marginBottom: spacing.sm, marginLeft: spacing.xs, textTransform: 'uppercase', letterSpacing: 0.5 }}>
            {t('profile.sections.preferences')}
          </Text>
          <Card padding="none" shadow="sm">
            <LanguageSettingRow />
          </Card>
        </View>

        {/* Support */}
        <View style={{ paddingHorizontal: spacing.lg, marginBottom: spacing.lg }}>
          <Text variant="label" color="textSecondary" style={{ marginBottom: spacing.sm, marginLeft: spacing.xs, textTransform: 'uppercase', letterSpacing: 0.5 }}>
            {t('proMore.sections.support')}
          </Text>
          <Card padding="none" shadow="sm">
            <MenuItem
              icon="book-outline"
              label={t('proMore.menu.tutorials')}
              isNew={hasNewTutorials}
              onPress={() => {
                // The help screen itself calls markVisited on mount,
                // which is what actually clears the badge on next
                // render — no need to do it here too.
                router.push('/(pro)/help');
              }}
              colors={colors}
            />
            <View style={[s.menuDivider, { backgroundColor: colors.border }]} />
            <MenuItem
              icon="help-circle-outline"
              label={t('proMore.menu.help')}
              onPress={() => Linking.openURL('https://opatam.com/contact')}
              colors={colors}
            />
            <View style={[s.menuDivider, { backgroundColor: colors.border }]} />
            <MenuItem
              icon="document-text-outline"
              label={t('proMore.menu.terms')}
              onPress={() => Linking.openURL('https://opatam.com/cgu')}
              colors={colors}
            />
            <View style={[s.menuDivider, { backgroundColor: colors.border }]} />
            <MenuItem
              icon="shield-checkmark-outline"
              label={t('proMore.menu.privacy')}
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
              label={t('proMore.menu.logout')}
              onPress={handleLogout}
              showArrow={false}
              danger
              colors={colors}
            />
            <View style={[s.menuDivider, { backgroundColor: colors.border }]} />
            <MenuItem
              icon="trash-outline"
              label={t('proMore.menu.deleteAccount')}
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
            Opatam v1.3.1
          </Text>
          <Text variant="caption" color="textMuted" align="center" style={{ marginTop: 4 }}>
            {t('proMore.tagline')}
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

      {/* Change Password Modal */}
      <ChangePasswordModal
        visible={showPasswordModal}
        onClose={() => setShowPasswordModal(false)}
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
  profileCard: {
    borderRadius: 14,
    borderWidth: 1,
    overflow: 'hidden',
  },
  profileCardGradient: {
    padding: 14,
  },
  profileCardContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  profileCardIcon: {
    width: 42,
    height: 42,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  profileCardRight: {
    alignItems: 'flex-end',
    marginLeft: 8,
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 20,
    gap: 5,
  },
  statusDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
  },
  grid: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  gridItem: {
    alignItems: 'center',
    flex: 1,
  },
  gridIconContainer: {
    width: 48,
    height: 48,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  gridLabel: {
    marginTop: 6,
    textAlign: 'center',
    fontWeight: '500',
    fontSize: 11,
    lineHeight: 14,
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
  subCard: {
    borderRadius: 16,
    overflow: 'hidden',
    // Shadow
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 6,
  },
  subCardGradient: {
    padding: 20,
    position: 'relative',
    overflow: 'hidden',
  },
  subCardDecorCircle: {
    position: 'absolute',
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: '#FFFFFF',
  },
  subCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 14,
  },
  subCardIconContainer: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: 'rgba(255,255,255,0.15)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  subCardBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.2)',
  },
  subCardBadgeText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  subCardTitle: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '700',
    letterSpacing: 0.2,
  },
  subCardSubtitle: {
    color: 'rgba(255,255,255,0.7)',
    fontSize: 13,
    marginTop: 4,
  },
  subCardFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 16,
    gap: 4,
  },
  subCardAction: {
    color: 'rgba(255,255,255,0.85)',
    fontSize: 13,
    fontWeight: '600',
  },
  expiredBanner: {
    backgroundColor: '#FEF2F2',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#FECACA',
    overflow: 'hidden',
  },
  expiredBannerContent: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    gap: 12,
  },
});
