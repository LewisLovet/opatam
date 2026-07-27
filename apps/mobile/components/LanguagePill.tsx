/**
 * LanguagePill — sélecteur de langue compact des écrans d'entrée
 * (onboarding, accueil auth), là où le visiteur doit pouvoir changer de
 * langue AVANT d'atteindre l'app (le sélecteur du profil est trop profond
 * pour un premier lancement).
 *
 * Un bouton (globe + langue courante) qui ouvre la liste : aligner toutes
 * les langues côte à côte devenait trop large dès la 4ᵉ, et l'empreinte du
 * bouton reste constante quel que soit le nombre de langues à venir.
 *
 * Les noms de langue sont affichés dans leur propre langue — universels,
 * aucune clé de dictionnaire nécessaire.
 */

import React, { useState } from 'react';
import { Modal, Pressable, StyleSheet, View, Text as RNText } from 'react-native';
import { useTranslation } from 'react-i18next';
import { Ionicons } from '@expo/vector-icons';
import { APP_LOCALES, normalizeAppLocale, setAppLocale, type AppLocale } from '../lib/i18n';

const SHORT: Record<AppLocale, string> = { fr: 'FR', en: 'EN', it: 'IT', pt: 'PT' };
const NATIVE_LABEL: Record<AppLocale, string> = {
  fr: 'Français',
  en: 'English',
  it: 'Italiano',
  pt: 'Português',
};

interface LanguagePillProps {
  /** 'dark' = sur un fond coloré/dégradé (pastille blanche translucide),
   *  'light' = sur un fond clair (pastille grise translucide). */
  variant?: 'dark' | 'light';
}

export function LanguagePill({ variant = 'light' }: LanguagePillProps) {
  const { i18n } = useTranslation();
  const [open, setOpen] = useState(false);
  const current = normalizeAppLocale(i18n.language);

  const onDark = variant === 'dark';
  const pillBg = onDark ? 'rgba(255,255,255,0.18)' : 'rgba(17,24,39,0.06)';
  const pillText = onDark ? '#FFFFFF' : '#374151';

  const choose = async (l: AppLocale) => {
    if (l !== current) await setAppLocale(l);
    setOpen(false);
  };

  return (
    <>
      <Pressable
        onPress={() => setOpen(true)}
        accessibilityRole="button"
        accessibilityLabel="Langue / Language"
        hitSlop={6}
        style={[styles.pill, { backgroundColor: pillBg }]}
      >
        <Ionicons name="globe-outline" size={13} color={pillText} style={styles.globe} />
        <RNText style={[styles.pillText, { color: pillText }]}>{SHORT[current]}</RNText>
        <Ionicons name="chevron-down" size={12} color={pillText} style={styles.chevron} />
      </Pressable>

      <Modal visible={open} transparent animationType="fade" onRequestClose={() => setOpen(false)}>
        <Pressable style={styles.backdrop} onPress={() => setOpen(false)}>
          {/* Pressable interne : un tap sur la feuille ne doit pas la fermer. */}
          <Pressable style={styles.sheet} onPress={() => {}}>
            <View style={styles.grabber} />
            {APP_LOCALES.map((l) => {
              const selected = l === current;
              return (
                <Pressable
                  key={l}
                  onPress={() => void choose(l)}
                  accessibilityRole="radio"
                  accessibilityState={{ selected }}
                  style={({ pressed }) => [
                    styles.option,
                    selected && styles.optionSelected,
                    pressed && !selected && styles.optionPressed,
                  ]}
                >
                  <RNText style={[styles.optionText, selected && styles.optionTextSelected]}>
                    {NATIVE_LABEL[l]}
                  </RNText>
                  {selected && <Ionicons name="checkmark-circle" size={22} color="#1a6daf" />}
                </Pressable>
              );
            })}
          </Pressable>
        </Pressable>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 999,
    paddingLeft: 8,
    paddingRight: 6,
    paddingVertical: 5,
  },
  globe: {
    marginRight: 4,
  },
  chevron: {
    marginLeft: 2,
  },
  pillText: {
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.3,
  },
  backdrop: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0,0,0,0.45)',
  },
  sheet: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingTop: 8,
    paddingBottom: 32,
  },
  grabber: {
    alignSelf: 'center',
    width: 40,
    height: 5,
    borderRadius: 3,
    backgroundColor: '#E5E7EB',
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
  optionSelected: {
    backgroundColor: '#e4effa',
  },
  optionPressed: {
    backgroundColor: '#F3F4F6',
  },
  optionText: {
    fontSize: 16,
    fontWeight: '500',
    color: '#111827',
  },
  optionTextSelected: {
    color: '#1a6daf',
    fontWeight: '700',
  },
});
