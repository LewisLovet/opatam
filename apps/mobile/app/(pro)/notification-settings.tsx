/**
 * Pro Notification Settings Screen
 * Allows providers to configure push & email notification preferences.
 */

import React, { useState, useEffect } from 'react';
import {
  View,
  StyleSheet,
  ScrollView,
  Switch,
  ActivityIndicator,
  Pressable,
  SafeAreaView,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../theme';
import { Text, useToast } from '../../components';
import { useProvider } from '../../contexts';
import { providerService } from '@booking-app/firebase';
import type { ProviderNotificationPreferences } from '@booking-app/shared';

const DEFAULT_PREFS: ProviderNotificationPreferences = {
  pushEnabled: true,
  emailEnabled: true,
  newBookingNotifications: true,
  confirmationNotifications: true,
  cancellationNotifications: true,
  reminderNotifications: true,
};

// ---------------------------------------------------------------------------
// Setting Row
// ---------------------------------------------------------------------------

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

// ---------------------------------------------------------------------------
// Main Screen
// ---------------------------------------------------------------------------

export default function ProNotificationSettingsScreen() {
  const { colors, spacing, radius } = useTheme();
  const router = useRouter();
  const { provider, providerId, refreshProvider } = useProvider();
  const { showToast } = useToast();

  const [prefs, setPrefs] = useState<ProviderNotificationPreferences>(DEFAULT_PREFS);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (provider?.settings?.notificationPreferences) {
      setPrefs({ ...DEFAULT_PREFS, ...provider.settings.notificationPreferences });
    }
  }, [provider]);

  const updatePref = async (key: keyof ProviderNotificationPreferences, value: boolean) => {
    if (!providerId) return;

    const previous = { ...prefs };
    const updated = { ...prefs, [key]: value };
    setPrefs(updated);

    setSaving(true);
    try {
      await providerService.updateNotificationPreferences(providerId, { [key]: value });
      // Refresh provider context so other screens see the change
      refreshProvider();
    } catch {
      setPrefs(previous);
      showToast({ variant: 'error', message: 'Erreur lors de la mise à jour' });
    } finally {
      setSaving(false);
    }
  };

  const channelsDisabled = !prefs.pushEnabled && !prefs.emailEnabled;

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      {/* Header */}
      <View style={[styles.header, { paddingHorizontal: spacing.lg, paddingVertical: spacing.md }]}>
        <Pressable onPress={() => router.back()} hitSlop={12}>
          <Ionicons name="arrow-back" size={24} color={colors.text} />
        </Pressable>
        <Text variant="h2" style={{ marginLeft: spacing.md, flex: 1 }}>
          Notifications
        </Text>
        {saving && <ActivityIndicator size="small" color={colors.primary} />}
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: spacing['3xl'] }}
      >
        {/* Channels */}
        <View style={{ paddingHorizontal: spacing.lg, marginTop: spacing.md }}>
          <Text
            variant="caption"
            color="textSecondary"
            style={styles.sectionTitle}
          >
            CANAUX
          </Text>
          <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border, borderRadius: radius.lg }]}>
            <SettingRow
              icon="phone-portrait-outline"
              label="Notifications push"
              description="Sur votre téléphone"
              value={prefs.pushEnabled}
              onValueChange={(val) => updatePref('pushEnabled', val)}
              colors={colors}
            />
            <View style={[styles.divider, { backgroundColor: colors.border }]} />
            <SettingRow
              icon="mail-outline"
              label="Notifications email"
              description="Par email"
              value={prefs.emailEnabled}
              onValueChange={(val) => updatePref('emailEnabled', val)}
              colors={colors}
            />
          </View>
        </View>

        {/* Notification types */}
        <View style={{ paddingHorizontal: spacing.lg, marginTop: spacing.xl }}>
          <Text
            variant="caption"
            color="textSecondary"
            style={styles.sectionTitle}
          >
            TYPES DE NOTIFICATION
          </Text>
          <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border, borderRadius: radius.lg }]}>
            <SettingRow
              icon="add-circle-outline"
              label="Nouvelles réservations"
              description="Quand un client prend RDV"
              value={prefs.newBookingNotifications}
              onValueChange={(val) => updatePref('newBookingNotifications', val)}
              disabled={channelsDisabled}
              colors={colors}
            />
            <View style={[styles.divider, { backgroundColor: colors.border }]} />
            <SettingRow
              icon="checkmark-circle-outline"
              label="Confirmations"
              description="Quand un RDV est confirmé"
              value={prefs.confirmationNotifications}
              onValueChange={(val) => updatePref('confirmationNotifications', val)}
              disabled={channelsDisabled}
              colors={colors}
            />
            <View style={[styles.divider, { backgroundColor: colors.border }]} />
            <SettingRow
              icon="close-circle-outline"
              label="Annulations"
              description="Quand un RDV est annulé"
              value={prefs.cancellationNotifications}
              onValueChange={(val) => updatePref('cancellationNotifications', val)}
              disabled={channelsDisabled}
              colors={colors}
            />
            <View style={[styles.divider, { backgroundColor: colors.border }]} />
            <SettingRow
              icon="alarm-outline"
              label="Rappels"
              description="Avant vos rendez-vous"
              value={prefs.reminderNotifications}
              onValueChange={(val) => updatePref('reminderNotifications', val)}
              disabled={channelsDisabled}
              colors={colors}
            />
          </View>

          {channelsDisabled && (
            <Text variant="caption" style={[styles.warning, { color: '#d97706' }]}>
              Activez au moins un canal pour recevoir des notifications.
            </Text>
          )}
        </View>

        {/* Info */}
        <View
          style={[
            styles.infoBox,
            {
              marginHorizontal: spacing.lg,
              marginTop: spacing.xl,
              backgroundColor: '#eff6ff',
              borderColor: '#bfdbfe',
              borderRadius: radius.md,
            },
          ]}
        >
          <Ionicons name="information-circle-outline" size={20} color="#2563eb" />
          <Text variant="caption" style={{ flex: 1, color: '#1e40af', marginLeft: 8 }}>
            Les modifications sont enregistrées automatiquement.
          </Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  sectionTitle: {
    marginBottom: 8,
    marginLeft: 4,
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
  card: {
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
    borderWidth: 1,
  },
});
