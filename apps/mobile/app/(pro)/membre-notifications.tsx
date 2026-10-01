/**
 * Espace membre — les notifications que le MEMBRE reçoit pour SES
 * rendez-vous : nouveaux / annulés / déplacés, rappel une heure avant,
 * résumé du matin, avis reçus. Chaque interrupteur absent = activé
 * (`users/{uid}.notificationSettings.espaceMembre`), lu par les functions.
 */
import React, { useEffect, useState } from 'react';
import { View, StyleSheet, ScrollView, Switch } from 'react-native';
import { useTranslation } from 'react-i18next';
import { Ionicons } from '@expo/vector-icons';
import { userService } from '@booking-app/firebase';
import type { NotificationSettings } from '@booking-app/shared';
import { useTheme } from '../../theme';
import { Text, useToast } from '../../components';
import { BrandedHeader } from '../../components/business/BrandedHeader';
import { useAuth } from '../../contexts';

type Cle = keyof NonNullable<NotificationSettings['espaceMembre']>;

const LIGNES: Array<{ cle: Cle; icone: keyof typeof Ionicons.glyphMap }> = [
  { cle: 'rendezVous', icone: 'calendar-outline' },
  { cle: 'rappels', icone: 'alarm-outline' },
  { cle: 'resumeDuMatin', icone: 'sunny-outline' },
  { cle: 'avis', icone: 'star-outline' },
];

export default function MembreNotificationsScreen() {
  const { t } = useTranslation();
  const { colors, spacing, radius } = useTheme();
  const { showToast } = useToast();
  const { userData } = useAuth();
  const [reglages, setReglages] = useState<NonNullable<NotificationSettings['espaceMembre']>>({});

  useEffect(() => {
    setReglages(userData?.notificationSettings?.espaceMembre ?? {});
  }, [userData]);

  const changer = async (cle: Cle, valeur: boolean) => {
    if (!userData) return;
    const avant = reglages;
    const apres = { ...reglages, [cle]: valeur };
    setReglages(apres);
    try {
      await userService.updateNotificationSettings(userData.id, { espaceMembre: apres });
    } catch {
      setReglages(avant);
      showToast({ variant: 'error', message: t('proNotifSettings.updateError') });
    }
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <BrandedHeader title={t('espaceMembre.notifications.titre')} />
      <ScrollView contentContainerStyle={{ padding: spacing.lg, paddingBottom: spacing['3xl'] }}>
        <Text variant="caption" color="textSecondary" style={{ marginBottom: spacing.sm }}>
          {t('espaceMembre.notifications.intro')}
        </Text>
        <View style={[s.carte, { backgroundColor: colors.surface, borderColor: colors.border, borderRadius: radius.lg }]}>
          {LIGNES.map(({ cle, icone }, i) => (
            <React.Fragment key={cle}>
              {i > 0 && <View style={[s.separateur, { backgroundColor: colors.border }]} />}
              <View style={s.ligne}>
                <View style={[s.icone, { backgroundColor: colors.primaryLight }]}>
                  <Ionicons name={icone} size={20} color={colors.primary} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text variant="body" style={{ fontWeight: '500' }}>{t(`espaceMembre.notifications.${cle}.label`)}</Text>
                  <Text variant="caption" color="textSecondary">{t(`espaceMembre.notifications.${cle}.description`)}</Text>
                </View>
                <Switch
                  value={reglages[cle] !== false}
                  onValueChange={(v) => changer(cle, v)}
                  trackColor={{ false: colors.border, true: colors.primary + '80' }}
                  thumbColor={reglages[cle] !== false ? colors.primary : '#f4f3f4'}
                />
              </View>
            </React.Fragment>
          ))}
        </View>
      </ScrollView>
    </View>
  );
}

const s = StyleSheet.create({
  carte: { borderWidth: 1, overflow: 'hidden' },
  ligne: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14 },
  icone: { width: 36, height: 36, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  separateur: { height: StyleSheet.hairlineWidth, marginLeft: 62 },
});
