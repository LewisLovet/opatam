/**
 * Booking/Reservation Settings Screen
 * Configure min booking notice, max booking advance, slot interval.
 * Mirrors the web ReservationSettingsForm.
 */

import React, { useState, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import {
  View,
  StyleSheet,
  ScrollView,
  Pressable,
  Modal,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import i18n from '../../lib/i18n';
import { useTheme } from '../../theme';
import { Text, Button, Card, Input, useToast } from '../../components';
import { Switch as RNSwitch, TextInput } from 'react-native';
import { useProvider } from '../../contexts';
import { providerService } from '@booking-app/firebase';
import { useNewFeatures } from '../../hooks/useNewFeatures';

// ---------------------------------------------------------------------------
// Options (mirrors web ReservationSettingsForm)
// ---------------------------------------------------------------------------

interface OptionSpec {
  value: number;
  labelKey: string;
  labelParams?: Record<string, number>;
}

const MIN_BOOKING_NOTICE_OPTIONS: OptionSpec[] = [
  { value: 0, labelKey: 'proBookingSettings.options.noMinNotice' },
  { value: 1, labelKey: 'proBookingSettings.options.hours', labelParams: { count: 1 } },
  { value: 2, labelKey: 'proBookingSettings.options.hours', labelParams: { count: 2 } },
  { value: 4, labelKey: 'proBookingSettings.options.hours', labelParams: { count: 4 } },
  { value: 6, labelKey: 'proBookingSettings.options.hours', labelParams: { count: 6 } },
  { value: 12, labelKey: 'proBookingSettings.options.hours', labelParams: { count: 12 } },
  { value: 24, labelKey: 'proBookingSettings.options.hoursWithDays', labelParams: { hours: 24, count: 1 } },
  { value: 48, labelKey: 'proBookingSettings.options.hoursWithDays', labelParams: { hours: 48, count: 2 } },
  { value: 72, labelKey: 'proBookingSettings.options.hoursWithDays', labelParams: { hours: 72, count: 3 } },
  { value: 168, labelKey: 'proBookingSettings.options.hoursWithDays', labelParams: { hours: 168, count: 7 } },
];

const MAX_BOOKING_ADVANCE_OPTIONS: OptionSpec[] = [
  { value: 7, labelKey: 'proBookingSettings.options.days', labelParams: { count: 7 } },
  { value: 14, labelKey: 'proBookingSettings.options.days', labelParams: { count: 14 } },
  { value: 30, labelKey: 'proBookingSettings.options.daysWithMonths', labelParams: { days: 30, count: 1 } },
  { value: 60, labelKey: 'proBookingSettings.options.daysWithMonths', labelParams: { days: 60, count: 2 } },
  { value: 90, labelKey: 'proBookingSettings.options.daysWithMonths', labelParams: { days: 90, count: 3 } },
  { value: 180, labelKey: 'proBookingSettings.options.daysWithMonths', labelParams: { days: 180, count: 6 } },
  { value: 365, labelKey: 'proBookingSettings.options.daysWithYears', labelParams: { days: 365, count: 1 } },
];

const SLOT_INTERVAL_OPTIONS: OptionSpec[] = [
  { value: 5, labelKey: 'proBookingSettings.options.minutes', labelParams: { count: 5 } },
  { value: 10, labelKey: 'proBookingSettings.options.minutes', labelParams: { count: 10 } },
  { value: 15, labelKey: 'proBookingSettings.options.minutes', labelParams: { count: 15 } },
  { value: 20, labelKey: 'proBookingSettings.options.minutes', labelParams: { count: 20 } },
  { value: 30, labelKey: 'proBookingSettings.options.minutes', labelParams: { count: 30 } },
  { value: 45, labelKey: 'proBookingSettings.options.minutes', labelParams: { count: 45 } },
  { value: 60, labelKey: 'proBookingSettings.options.hours', labelParams: { count: 1 } },
];

/** Resolve an option's display label in the current language. */
function optionLabel(option: OptionSpec): string {
  return i18n.t(option.labelKey, option.labelParams);
}

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface SettingsData {
  minBookingNotice: number;
  maxBookingAdvance: number;
  slotInterval: number;
  bookingNotice: string;
  autoReviewReminder: boolean;
}

type PickerField = 'minBookingNotice' | 'maxBookingAdvance' | 'slotInterval';

const PICKER_CONFIG: Record<PickerField, {
  titleKey: string;
  icon: string;
  descriptionKey: string;
  options: OptionSpec[];
}> = {
  minBookingNotice: {
    titleKey: 'proBookingSettings.minNotice.title',
    icon: 'time-outline',
    descriptionKey: 'proBookingSettings.minNotice.description',
    options: MIN_BOOKING_NOTICE_OPTIONS,
  },
  maxBookingAdvance: {
    titleKey: 'proBookingSettings.maxAdvance.title',
    icon: 'calendar-outline',
    descriptionKey: 'proBookingSettings.maxAdvance.description',
    options: MAX_BOOKING_ADVANCE_OPTIONS,
  },
  slotInterval: {
    titleKey: 'proBookingSettings.slotInterval.title',
    icon: 'timer-outline',
    descriptionKey: 'proBookingSettings.slotInterval.description',
    options: SLOT_INTERVAL_OPTIONS,
  },
};

// ---------------------------------------------------------------------------
// Main Screen
// ---------------------------------------------------------------------------

export default function BookingSettingsScreen() {
  const { colors, spacing, radius } = useTheme();
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { showToast } = useToast();
  const { provider, providerId, refreshProvider } = useProvider();
  // Surfaces a "Nouveau" pill next to the auto-review toggle until
  // the pro has touched it once. Marked seen on first toggle change
  // (see onValueChange below) — just landing on the page isn't
  // engagement enough to clear the discovery flag.
  const { isNew, markSeen } = useNewFeatures();
  const showAutoReviewNew = isNew('auto-review-2026-05');

  const [settings, setSettings] = useState<SettingsData>({
    minBookingNotice: 2,
    maxBookingAdvance: 60,
    slotInterval: 15,
    bookingNotice: '',
    autoReviewReminder: true,
  });
  const [originalSettings, setOriginalSettings] = useState<SettingsData>({
    minBookingNotice: 2,
    maxBookingAdvance: 60,
    slotInterval: 15,
    bookingNotice: '',
    autoReviewReminder: true,
  });
  const [saving, setSaving] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [activePicker, setActivePicker] = useState<PickerField | null>(null);

  // Initialize from provider
  useEffect(() => {
    if (provider?.settings) {
      const data: SettingsData = {
        minBookingNotice: provider.settings.minBookingNotice ?? 2,
        maxBookingAdvance: provider.settings.maxBookingAdvance ?? 60,
        slotInterval: provider.settings.slotInterval ?? 15,
        bookingNotice: provider.settings.bookingNotice ?? '',
        autoReviewReminder: provider.settings.autoReviewReminder ?? true,
      };
      setSettings(data);
      setOriginalSettings(data);
    }
  }, [provider]);

  const isDirty = JSON.stringify(settings) !== JSON.stringify(originalSettings);

  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    await refreshProvider();
    setRefreshing(false);
  }, [refreshProvider]);

  const handleSave = async () => {
    if (!providerId || !provider) return;

    setSaving(true);
    try {
      await providerService.updateProvider(providerId, {
        settings: {
          ...provider.settings,
          minBookingNotice: settings.minBookingNotice,
          maxBookingAdvance: settings.maxBookingAdvance,
          slotInterval: settings.slotInterval,
          bookingNotice: settings.bookingNotice.trim() || null,
          autoReviewReminder: settings.autoReviewReminder,
          allowClientCancellation: true,
          cancellationDeadline: 0,
        },
      });
      await refreshProvider();
      setOriginalSettings({ ...settings });
      showToast({ variant: 'success', message: i18n.t('proBookingSettings.toast.saved') });
    } catch (err: any) {
      showToast({ variant: 'error', message: err.message || i18n.t('proBookingSettings.toast.saveError') });
    } finally {
      setSaving(false);
    }
  };

  const getLabel = (field: PickerField, value: number): string => {
    const option = PICKER_CONFIG[field].options.find((o) => o.value === value);
    return option ? optionLabel(option) : String(value);
  };

  const settingsFields: PickerField[] = ['minBookingNotice', 'maxBookingAdvance', 'slotInterval'];

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {/* Header */}
      <View style={{ backgroundColor: colors.primary, paddingTop: insets.top }}>
        <View style={styles.headerRow}>
          <Pressable onPress={() => router.back()} hitSlop={12}>
            <Ionicons name="arrow-back" size={24} color="#FFFFFF" />
          </Pressable>
          <Text variant="h3" style={{ color: '#FFFFFF', flex: 1, marginLeft: spacing.sm }}>
            {t('proBookingSettings.title')}
          </Text>
          {isDirty && (
            <Pressable
              onPress={handleSave}
              disabled={saving}
              style={[styles.saveButton, { backgroundColor: 'rgba(255,255,255,0.2)', borderRadius: radius.md }]}
            >
              {saving ? (
                <ActivityIndicator size="small" color="#FFFFFF" />
              ) : (
                <Text variant="body" style={{ color: '#FFFFFF', fontWeight: '600' }}>
                  {t('common.save')}
                </Text>
              )}
            </Pressable>
          )}
        </View>
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ padding: spacing.lg, paddingBottom: spacing['3xl'] }}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor={colors.primary} />
        }
      >
        <Card padding="none" shadow="sm" style={{ marginBottom: spacing.lg }}>
          {settingsFields.map((field, index) => {
            const config = PICKER_CONFIG[field];
            const isLast = index === settingsFields.length - 1;
            return (
              <React.Fragment key={field}>
                <Pressable
                  onPress={() => setActivePicker(field)}
                  style={styles.settingRow}
                >
                  <View style={[styles.settingIcon, { backgroundColor: colors.primaryLight || '#e4effa', borderRadius: radius.md }]}>
                    <Ionicons name={config.icon as any} size={20} color={colors.primary} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text variant="body" style={{ fontWeight: '500' }}>
                      {t(config.titleKey)}
                    </Text>
                    <Text variant="caption" color="textSecondary" style={{ marginTop: 2 }}>
                      {t(config.descriptionKey)}
                    </Text>
                  </View>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                    <Text variant="body" style={{ color: colors.primary, fontWeight: '600' }}>
                      {getLabel(field, settings[field])}
                    </Text>
                    <Ionicons name="chevron-forward" size={16} color={colors.textMuted} />
                  </View>
                </Pressable>
                {!isLast && <View style={[styles.divider, { backgroundColor: colors.border }]} />}
              </React.Fragment>
            );
          })}
        </Card>

        {/* Booking notice */}
        <Card padding="md" shadow="sm" style={{ marginTop: spacing.md }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginBottom: spacing.sm }}>
            <Ionicons name="alert-circle-outline" size={18} color={colors.primary} />
            <Text variant="bodySmall" style={{ fontWeight: '600', color: colors.text }}>
              {t('proBookingSettings.notice.title')}
            </Text>
          </View>
          <TextInput
            value={settings.bookingNotice}
            onChangeText={(t: string) => { if (t.length <= 1000) setSettings((p) => ({ ...p, bookingNotice: t })); }}
            placeholder={t('proBookingSettings.notice.placeholder')}
            multiline
            numberOfLines={3}
            style={{
              borderWidth: 1,
              borderColor: colors.border,
              borderRadius: 10,
              padding: 12,
              fontSize: 14,
              color: colors.text,
              textAlignVertical: 'top',
              minHeight: 80,
            }}
            placeholderTextColor={colors.textMuted}
          />
          <Text variant="caption" color="textMuted" style={{ textAlign: 'right', marginTop: 4 }}>
            {settings.bookingNotice.length}/1000
          </Text>
          <Text variant="caption" color="textMuted" style={{ marginTop: 2 }}>
            {t('proBookingSettings.notice.hint')}
          </Text>
        </Card>

        {/* Auto review reminder */}
        <Card padding="md" shadow="sm" style={{ marginTop: spacing.md }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm, flex: 1 }}>
              <Ionicons name="star-outline" size={18} color={colors.primary} />
              <View style={{ flex: 1 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                  <Text variant="bodySmall" style={{ fontWeight: '600', color: colors.text }}>
                    {t('proBookingSettings.autoReview.title')}
                  </Text>
                  {showAutoReviewNew && (
                    <View
                      style={{
                        paddingHorizontal: 6,
                        paddingVertical: 2,
                        borderRadius: 999,
                        backgroundColor: '#E1306C',
                      }}
                    >
                      <Text
                        style={{
                          color: '#FFFFFF',
                          fontSize: 9,
                          fontWeight: '800',
                          textTransform: 'uppercase',
                          letterSpacing: 0.4,
                        }}
                      >
                        {t('proBookingSettings.autoReview.newBadge')}
                      </Text>
                    </View>
                  )}
                </View>
                <Text variant="caption" color="textMuted">
                  {t('proBookingSettings.autoReview.description')}
                </Text>
              </View>
            </View>
            <RNSwitch
              value={settings.autoReviewReminder}
              onValueChange={(v) => {
                setSettings((p) => ({ ...p, autoReviewReminder: v }));
                if (showAutoReviewNew) markSeen('auto-review-2026-05');
              }}
              trackColor={{ false: colors.border, true: colors.primary }}
            />
          </View>
        </Card>

        {/* Info box — needs explicit top margin so it doesn't read
            as "part of" the auto-review card above. The previous
            version sat flush against it which made the À propos
            block look glued to the toggle. */}
        <View
          style={[
            styles.infoBox,
            {
              backgroundColor: '#EFF6FF',
              borderRadius: radius.md,
              marginTop: spacing.lg,
            },
          ]}
        >
          <Ionicons name="information-circle-outline" size={18} color="#3B82F6" />
          <View style={{ flex: 1, gap: 4 }}>
            <Text variant="caption" style={{ color: '#1D4ED8', fontWeight: '600' }}>
              {t('proBookingSettings.about.title')}
            </Text>
            <Text variant="caption" style={{ color: '#2563EB' }}>
              {t('proBookingSettings.about.description')}
            </Text>
          </View>
        </View>

        {/* Save button */}
        {isDirty && (
          <View style={{ marginTop: spacing.lg }}>
            <Button
              title={t('proBookingSettings.saveChanges')}
              onPress={handleSave}
              loading={saving}
              disabled={saving}
            />
          </View>
        )}
      </ScrollView>

      {/* Picker Modal */}
      <Modal visible={activePicker !== null} transparent animationType="slide">
        <Pressable
          style={styles.modalOverlay}
          onPress={() => setActivePicker(null)}
        >
          <Pressable
            style={[
              styles.pickerModal,
              { backgroundColor: colors.background, borderTopLeftRadius: 20, borderTopRightRadius: 20 },
            ]}
            onPress={(e) => e.stopPropagation()}
          >
            <View style={styles.pickerHandle}>
              <View style={[styles.handleBar, { backgroundColor: colors.border }]} />
            </View>
            <Text variant="h3" align="center" style={{ marginBottom: spacing.md }}>
              {activePicker ? t(PICKER_CONFIG[activePicker].titleKey) : ''}
            </Text>
            <ScrollView style={{ maxHeight: 350 }}>
              {activePicker && PICKER_CONFIG[activePicker].options.map((option) => {
                const isSelected = settings[activePicker] === option.value;
                return (
                  <Pressable
                    key={option.value}
                    onPress={() => {
                      if (activePicker) {
                        setSettings((prev) => ({ ...prev, [activePicker]: option.value }));
                        setActivePicker(null);
                      }
                    }}
                    style={[
                      styles.pickerOption,
                      {
                        backgroundColor: isSelected ? colors.primary : 'transparent',
                        borderRadius: radius.sm,
                      },
                    ]}
                  >
                    <Text
                      variant="body"
                      style={{
                        color: isSelected ? '#FFFFFF' : colors.text,
                        fontWeight: isSelected ? '600' : '400',
                      }}
                    >
                      {optionLabel(option)}
                    </Text>
                    {isSelected && <Ionicons name="checkmark" size={20} color="#FFFFFF" />}
                  </Pressable>
                );
              })}
            </ScrollView>
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const styles = StyleSheet.create({
  container: { flex: 1 },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  saveButton: {
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  settingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 16,
    gap: 12,
  },
  settingIcon: {
    width: 36,
    height: 36,
    justifyContent: 'center',
    alignItems: 'center',
  },
  divider: {
    height: 1,
    marginLeft: 64,
  },
  infoBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    padding: 12,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  pickerModal: {
    paddingHorizontal: 20,
    paddingBottom: 34,
  },
  pickerHandle: {
    alignItems: 'center',
    paddingVertical: 12,
  },
  handleBar: {
    width: 40,
    height: 4,
    borderRadius: 2,
  },
  pickerOption: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    paddingHorizontal: 16,
    marginVertical: 1,
  },
});
