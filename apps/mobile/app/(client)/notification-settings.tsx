/**
 * Notification Settings Screen
 * Allows clients to configure their notification preferences
 */

import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import {
  View,
  StyleSheet,
  ScrollView,
  Switch,
  ActivityIndicator,
  Pressable,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../theme';
import { Text, useToast } from '../../components';
import { useAuth } from '../../contexts';
import { userService } from '@booking-app/firebase';
import type { NotificationSettings } from '@booking-app/shared';

const DEFAULT_SETTINGS: NotificationSettings = {
  pushEnabled: true,
  emailEnabled: true,
  reminderNotifications: true,
  confirmationNotifications: true,
  cancellationNotifications: true,
  rescheduleNotifications: true,
};

function SettingRow({
  icon,
  label,
  description,
  value,
  onValueChange,
  disabled,
  colors,
}: {
  icon: string;
  label: string;
  description: string;
  value: boolean;
  onValueChange: (val: boolean) => void;
  disabled?: boolean;
  colors: any;
}) {
  return (
    <View style={[styles.settingRow, { opacity: disabled ? 0.5 : 1 }]}>
      <View style={[styles.settingIcon, { backgroundColor: colors.primaryLight || '#e4effa' }]}>
        <Ionicons name={icon as any} size={20} color={colors.primary} />
      </View>
      <View style={styles.settingText}>
        <Text variant="body" style={{ fontWeight: '500' }}>{label}</Text>
        <Text variant="caption" color="textSecondary">{description}</Text>
      </View>
      <Switch
        value={value}
        onValueChange={onValueChange}
        disabled={disabled}
        trackColor={{ false: colors.border, true: colors.primary + '80' }}
        thumbColor={value ? colors.primary : '#f4f3f4'}
      />
    </View>
  );
}

export default function NotificationSettingsScreen() {
  const { colors, spacing, radius } = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { userData } = useAuth();
  const { showToast } = useToast();
  const { t } = useTranslation();
  const [settings, setSettings] = useState<NotificationSettings>(DEFAULT_SETTINGS);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (userData?.notificationSettings) {
      setSettings(userData.notificationSettings);
    }
  }, [userData]);

  const updateSetting = async (key: keyof NotificationSettings, value: boolean) => {
    if (!userData) return;

    const newSettings = { ...settings, [key]: value };
    setSettings(newSettings);

    setSaving(true);
    try {
      await userService.updateNotificationSettings(userData.id, { [key]: value });
    } catch (error) {
      // Revert on error
      setSettings(settings);
      showToast({ variant: 'error', message: t('notifSettings.updateError') });
    } finally {
      setSaving(false);
    }
  };

  const channelsDisabled = !settings.pushEnabled && !settings.emailEnabled;

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{
          paddingTop: insets.top + spacing.md,
          paddingBottom: insets.bottom + spacing['3xl'],
        }}
      >
        {/* Header */}
        <View style={[styles.header, { paddingHorizontal: spacing.lg }]}>
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
            {t('notifSettings.title')}
          </Text>
          <View style={styles.headerSpacer} />
        </View>
        {/* Master Toggles */}
        <View style={{ paddingHorizontal: spacing.lg, marginTop: spacing.lg }}>
          <Text variant="label" color="textSecondary" style={styles.sectionTitle}>
            {t('notifSettings.sections.channels')}
          </Text>
          <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <SettingRow
              icon="phone-portrait-outline"
              label={t('notifSettings.push.label')}
              description={t('notifSettings.push.description')}
              value={settings.pushEnabled}
              onValueChange={(val) => updateSetting('pushEnabled', val)}
              colors={colors}
            />
            <View style={[styles.divider, { backgroundColor: colors.border }]} />
            <SettingRow
              icon="mail-outline"
              label={t('notifSettings.email.label')}
              description={t('notifSettings.email.description')}
              value={settings.emailEnabled}
              onValueChange={(val) => updateSetting('emailEnabled', val)}
              colors={colors}
            />
          </View>
        </View>

        {/* Per-type Toggles */}
        <View style={{ paddingHorizontal: spacing.lg, marginTop: spacing.xl }}>
          <Text variant="label" color="textSecondary" style={styles.sectionTitle}>
            {t('notifSettings.sections.types')}
          </Text>
          <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <SettingRow
              icon="checkmark-circle-outline"
              label={t('notifSettings.confirmations.label')}
              description={t('notifSettings.confirmations.description')}
              value={settings.confirmationNotifications}
              onValueChange={(val) => updateSetting('confirmationNotifications', val)}
              disabled={channelsDisabled}
              colors={colors}
            />
            <View style={[styles.divider, { backgroundColor: colors.border }]} />
            <SettingRow
              icon="close-circle-outline"
              label={t('notifSettings.cancellations.label')}
              description={t('notifSettings.cancellations.description')}
              value={settings.cancellationNotifications}
              onValueChange={(val) => updateSetting('cancellationNotifications', val)}
              disabled={channelsDisabled}
              colors={colors}
            />
            <View style={[styles.divider, { backgroundColor: colors.border }]} />
            <SettingRow
              icon="swap-horizontal-outline"
              label={t('notifSettings.reschedules.label')}
              description={t('notifSettings.reschedules.description')}
              value={settings.rescheduleNotifications}
              onValueChange={(val) => updateSetting('rescheduleNotifications', val)}
              disabled={channelsDisabled}
              colors={colors}
            />
            <View style={[styles.divider, { backgroundColor: colors.border }]} />
            <SettingRow
              icon="alarm-outline"
              label={t('notifSettings.reminders.label')}
              description={t('notifSettings.reminders.description')}
              value={settings.reminderNotifications}
              onValueChange={(val) => updateSetting('reminderNotifications', val)}
              disabled={channelsDisabled}
              colors={colors}
            />
          </View>
          {channelsDisabled && (
            <Text variant="caption" style={[styles.warning, { color: '#d97706' }]}>
              {t('notifSettings.channelsWarning')}
            </Text>
          )}
        </View>

        {/* Info */}
        <View style={[styles.infoBox, { marginHorizontal: spacing.lg, marginTop: spacing.xl, backgroundColor: '#eff6ff', borderColor: '#bfdbfe' }]}>
          <Ionicons name="information-circle-outline" size={20} color="#2563eb" />
          <Text variant="caption" style={{ flex: 1, color: '#1e40af', marginLeft: 8 }}>
            {t('notifSettings.autoSaveInfo')}
          </Text>
          {saving && <ActivityIndicator size="small" color="#2563eb" />}
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
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
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
  sectionTitle: {
    marginBottom: 8,
    marginLeft: 4,
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
  card: {
    borderRadius: 12,
    borderWidth: 1,
    overflow: 'hidden',
  },
  settingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 16,
  },
  settingIcon: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  settingText: {
    flex: 1,
    marginRight: 12,
  },
  divider: {
    height: 1,
    marginLeft: 64,
  },
  warning: {
    marginTop: 8,
    marginLeft: 4,
  },
  infoBox: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: 10,
    borderWidth: 1,
  },
});
