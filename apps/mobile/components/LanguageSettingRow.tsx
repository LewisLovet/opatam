/**
 * LanguageSettingRow — the « Langue » entry of the Preferences section
 * (client Profile tab + pro More tab). One tappable row showing the current
 * language, opening a bottom-sheet Modal with the available languages.
 *
 * Uses a React Native <Modal> (not OverlaySheet) so it can live anywhere in
 * the tree — an absolute overlay would be clipped by the parent Card.
 * Language names are shown in their own language (universal), and the
 * current locale is derived via normalizeAppLocale so 'it' is recognized
 * (the old `=== 'en' ? 'en' : 'fr'` ternary silently mapped Italian to
 * French, which is why the checkmark misbehaved).
 */

import React, { useState } from 'react';
import { Modal, Pressable, StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Text } from './Text';
import { useTheme } from '../theme';
import { APP_LOCALES, normalizeAppLocale, setAppLocale, type AppLocale } from '../lib/i18n';

const NATIVE_LABELS: Record<AppLocale, string> = {
  fr: 'Français',
  en: 'English',
  it: 'Italiano',
};

export function LanguageSettingRow() {
  const { t, i18n } = useTranslation();
  const { colors, radius, spacing } = useTheme();
  const insets = useSafeAreaInsets();
  const [open, setOpen] = useState(false);

  const current = normalizeAppLocale(i18n.language);

  const handleSelect = async (locale: AppLocale) => {
    // Persist + switch BEFORE closing: the sheet re-renders with the new
    // checkmark, then closes — no stale-state flash.
    if (locale !== current) await setAppLocale(locale);
    setOpen(false);
  };

  return (
    <>
      <Pressable
        onPress={() => setOpen(true)}
        accessibilityRole="button"
        accessibilityLabel={t('profile.language.title')}
        style={({ pressed }) => [
          styles.row,
          { backgroundColor: pressed ? colors.surfaceSecondary : 'transparent' },
        ]}
      >
        <View style={[styles.iconContainer, { backgroundColor: colors.primaryLight || '#e4effa' }]}>
          <Ionicons name="language-outline" size={20} color={colors.primary} />
        </View>
        <Text variant="body" style={styles.label}>
          {t('profile.language.title')}
        </Text>
        <Text variant="body" color="textSecondary" style={{ marginRight: 6 }}>
          {NATIVE_LABELS[current]}
        </Text>
        <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
      </Pressable>

      <Modal visible={open} transparent animationType="fade" onRequestClose={() => setOpen(false)}>
        <View style={styles.backdrop}>
          <Pressable style={StyleSheet.absoluteFill} onPress={() => setOpen(false)} />
          <View
            style={[
              styles.sheet,
              {
                backgroundColor: colors.background,
                borderTopLeftRadius: radius.xl,
                borderTopRightRadius: radius.xl,
                paddingBottom: insets.bottom + spacing.lg,
              },
            ]}
          >
            <View style={[styles.grabber, { backgroundColor: colors.border }]} />
            <Text variant="h3" style={{ marginBottom: spacing.md, paddingHorizontal: spacing.lg }}>
              {t('auth.onboarding.chooseLanguage')}
            </Text>
            {APP_LOCALES.map((locale) => {
              const selected = locale === current;
              return (
                <Pressable
                  key={locale}
                  onPress={() => void handleSelect(locale)}
                  accessibilityRole="radio"
                  accessibilityState={{ selected }}
                  style={({ pressed }) => [
                    styles.option,
                    {
                      backgroundColor: selected
                        ? colors.primaryLight || '#e4effa'
                        : pressed
                          ? colors.surfaceSecondary
                          : 'transparent',
                    },
                  ]}
                >
                  <Text
                    variant="body"
                    style={[styles.optionLabel, selected && { color: colors.primary, fontWeight: '700' }]}
                  >
                    {NATIVE_LABELS[locale]}
                  </Text>
                  {selected && <Ionicons name="checkmark-circle" size={22} color={colors.primary} />}
                </Pressable>
              );
            })}
          </View>
        </View>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 16,
  },
  iconContainer: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  label: {
    flex: 1,
    fontWeight: '500',
  },
  backdrop: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0,0,0,0.45)',
  },
  sheet: {
    paddingTop: 8,
  },
  grabber: {
    alignSelf: 'center',
    width: 40,
    height: 5,
    borderRadius: 3,
    marginBottom: 12,
  },
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginHorizontal: 16,
    marginBottom: 8,
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderRadius: 12,
  },
  optionLabel: {
    fontSize: 16,
    fontWeight: '500',
  },
});
