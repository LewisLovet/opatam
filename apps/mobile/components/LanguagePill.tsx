/**
 * LanguagePill — compact FR/EN switcher for entry screens (onboarding,
 * welcome), where the visitor must be able to change language BEFORE
 * reaching the app (the profile/Plus selector is too deep for a first
 * launch). Same mechanics as the profile selector: setAppLocale persists
 * the explicit choice in @opatam/app_locale.
 *
 * "FR"/"EN" labels are universal — no dictionary keys needed.
 */

import React from 'react';
import { Pressable, StyleSheet, View, Text as RNText } from 'react-native';
import { useTranslation } from 'react-i18next';
import { Ionicons } from '@expo/vector-icons';
import { setAppLocale, type AppLocale } from '../lib/i18n';

const LOCALES: AppLocale[] = ['fr', 'en'];

interface LanguagePillProps {
  /** 'dark' = on a colored/gradient background (white translucent pill),
   *  'light' = on a light background (gray translucent pill). */
  variant?: 'dark' | 'light';
}

export function LanguagePill({ variant = 'light' }: LanguagePillProps) {
  const { i18n } = useTranslation();
  const current: AppLocale = i18n.language === 'en' ? 'en' : 'fr';

  const onDark = variant === 'dark';
  const pillBg = onDark ? 'rgba(255,255,255,0.18)' : 'rgba(17,24,39,0.06)';
  const idleText = onDark ? 'rgba(255,255,255,0.85)' : '#6B7280';
  const activeBg = onDark ? '#FFFFFF' : '#111827';
  const activeText = onDark ? '#1a6daf' : '#FFFFFF';

  return (
    <View
      style={[styles.pill, { backgroundColor: pillBg }]}
      accessibilityRole="radiogroup"
      accessibilityLabel="Langue / Language"
    >
      <Ionicons
        name="globe-outline"
        size={13}
        color={idleText}
        style={styles.globe}
      />
      {LOCALES.map((l) => {
        const active = l === current;
        return (
          <Pressable
            key={l}
            onPress={() => {
              if (!active) void setAppLocale(l);
            }}
            accessibilityRole="radio"
            accessibilityState={{ selected: active }}
            accessibilityLabel={l === 'fr' ? 'Français' : 'English'}
            hitSlop={6}
            style={[styles.segment, active && { backgroundColor: activeBg }]}
          >
            <RNText
              style={[
                styles.segmentText,
                { color: active ? activeText : idleText },
              ]}
            >
              {l.toUpperCase()}
            </RNText>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 999,
    paddingHorizontal: 6,
    paddingVertical: 3,
    gap: 2,
  },
  globe: {
    marginLeft: 2,
    marginRight: 3,
  },
  segment: {
    borderRadius: 999,
    paddingHorizontal: 9,
    paddingVertical: 4,
  },
  segmentText: {
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.3,
  },
});
