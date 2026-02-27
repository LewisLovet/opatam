/**
 * Booking/Reservation Settings Screen
 * Configure min booking notice, max booking advance, slot interval.
 * Mirrors the web ReservationSettingsForm.
 */

import React, { useState, useEffect, useCallback } from 'react';
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
import { useTheme } from '../../theme';
import { Text, Button, Card, useToast } from '../../components';
import { useProvider } from '../../contexts';
import { providerService } from '@booking-app/firebase';

// ---------------------------------------------------------------------------
// Options (mirrors web ReservationSettingsForm)
// ---------------------------------------------------------------------------

const MIN_BOOKING_NOTICE_OPTIONS = [
  { value: 0, label: 'Pas de délai minimum' },
  { value: 1, label: '1 heure' },
  { value: 2, label: '2 heures' },
  { value: 4, label: '4 heures' },
  { value: 6, label: '6 heures' },
  { value: 12, label: '12 heures' },
  { value: 24, label: '24 heures (1 jour)' },
  { value: 48, label: '48 heures (2 jours)' },
  { value: 72, label: '72 heures (3 jours)' },
  { value: 168, label: '168 heures (7 jours)' },
];

const MAX_BOOKING_ADVANCE_OPTIONS = [
  { value: 7, label: '7 jours' },
  { value: 14, label: '14 jours' },
  { value: 30, label: '30 jours (1 mois)' },
  { value: 60, label: '60 jours (2 mois)' },
  { value: 90, label: '90 jours (3 mois)' },
  { value: 180, label: '180 jours (6 mois)' },
  { value: 365, label: '365 jours (1 an)' },
];

const SLOT_INTERVAL_OPTIONS = [
  { value: 5, label: '5 minutes' },
  { value: 10, label: '10 minutes' },
  { value: 15, label: '15 minutes' },
  { value: 20, label: '20 minutes' },
  { value: 30, label: '30 minutes' },
  { value: 45, label: '45 minutes' },
  { value: 60, label: '1 heure' },
];

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface SettingsData {
  minBookingNotice: number;
  maxBookingAdvance: number;
  slotInterval: number;
}

type PickerField = 'minBookingNotice' | 'maxBookingAdvance' | 'slotInterval';

const PICKER_CONFIG: Record<PickerField, {
  title: string;
  icon: string;
  description: string;
  options: { value: number; label: string }[];
}> = {
  minBookingNotice: {
    title: 'Délai minimum de réservation',
    icon: 'time-outline',
    description: 'Combien de temps à l\'avance un client doit réserver',
    options: MIN_BOOKING_NOTICE_OPTIONS,
  },
  maxBookingAdvance: {
    title: 'Délai maximum de réservation',
    icon: 'calendar-outline',
    description: 'Jusqu\'à combien de temps à l\'avance un client peut réserver',
    options: MAX_BOOKING_ADVANCE_OPTIONS,
  },
  slotInterval: {
    title: 'Intervalle entre les créneaux',
    icon: 'timer-outline',
    description: 'Fréquence des créneaux proposés aux clients (ex : toutes les 15 min)',
    options: SLOT_INTERVAL_OPTIONS,
  },
};

// ---------------------------------------------------------------------------
// Main Screen
// ---------------------------------------------------------------------------

export default function BookingSettingsScreen() {
  const { colors, spacing, radius } = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { showToast } = useToast();
  const { provider, providerId, refreshProvider } = useProvider();

  const [settings, setSettings] = useState<SettingsData>({
    minBookingNotice: 2,
    maxBookingAdvance: 60,
    slotInterval: 15,
  });
  const [originalSettings, setOriginalSettings] = useState<SettingsData>({
    minBookingNotice: 2,
    maxBookingAdvance: 60,
    slotInterval: 15,
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
          allowClientCancellation: true,
          cancellationDeadline: 0,
        },
      });
      await refreshProvider();
      setOriginalSettings({ ...settings });
      showToast({ variant: 'success', message: 'Paramètres mis à jour' });
    } catch (err: any) {
      showToast({ variant: 'error', message: err.message || 'Erreur lors de l\'enregistrement' });
    } finally {
      setSaving(false);
    }
  };

  const getLabel = (field: PickerField, value: number): string => {
    const option = PICKER_CONFIG[field].options.find((o) => o.value === value);
    return option?.label || String(value);
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
            Paramètres de réservation
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
                  Enregistrer
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
                      {config.title}
                    </Text>
                    <Text variant="caption" color="textSecondary" style={{ marginTop: 2 }}>
                      {config.description}
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

        {/* Info box */}
        <View
          style={[
            styles.infoBox,
            { backgroundColor: '#EFF6FF', borderRadius: radius.md },
          ]}
        >
          <Ionicons name="information-circle-outline" size={18} color="#3B82F6" />
          <View style={{ flex: 1, gap: 4 }}>
            <Text variant="caption" style={{ color: '#1D4ED8', fontWeight: '600' }}>
              À propos de ces paramètres
            </Text>
            <Text variant="caption" style={{ color: '#2563EB' }}>
              Ces règles s'appliquent à toutes les nouvelles réservations.
              Les réservations existantes ne sont pas affectées par ces changements.
            </Text>
          </View>
        </View>

        {/* Save button */}
        {isDirty && (
          <View style={{ marginTop: spacing.lg }}>
            <Button
              title="Enregistrer les modifications"
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
              {activePicker ? PICKER_CONFIG[activePicker].title : ''}
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
                      {option.label}
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
