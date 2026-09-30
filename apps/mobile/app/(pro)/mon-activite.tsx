/**
 * Espace membre — « Mon activité » : SON chiffre d'affaires, si le gérant
 * l'a choisi (`settings.memberRevenueVisible`). Jamais celui du salon.
 *
 * Calculé sur SES rendez-vous confirmés et passés, dans la devise FIGÉE de
 * chacun : deux devises ne s'additionnent jamais (un total par devise).
 */
import React, { useEffect, useMemo, useState } from 'react';
import { View, ScrollView } from 'react-native';
import { useTranslation } from 'react-i18next';
import { Ionicons } from '@expo/vector-icons';
import { bookingRepository } from '@booking-app/firebase';
import { deviseDeLaReservation, formatPrice, type Booking } from '@booking-app/shared';
import type { WithId } from '@booking-app/firebase';
import { useTheme } from '../../theme';
import { Text, Card, Loader } from '../../components';
import { BrandedHeader } from '../../components/business/BrandedHeader';
import { useProvider, useEspaceMembre } from '../../contexts';
import i18n from '../../lib/i18n';

interface Periode {
  cle: 'mois' | 'moisDernier' | 'annee';
  debut: Date;
  fin: Date;
}

function periodes(maintenant: Date): Periode[] {
  const a = maintenant.getFullYear();
  const m = maintenant.getMonth();
  return [
    { cle: 'mois', debut: new Date(a, m, 1), fin: maintenant },
    { cle: 'moisDernier', debut: new Date(a, m - 1, 1), fin: new Date(a, m, 1) },
    { cle: 'annee', debut: new Date(a, 0, 1), fin: maintenant },
  ];
}

export default function MonActiviteScreen() {
  const { colors, spacing } = useTheme();
  const { t } = useTranslation();
  const { providerId, provider } = useProvider();
  const { monMemberId, voitSonCA } = useEspaceMembre();
  const [rdvs, setRdvs] = useState<WithId<Booking>[] | null>(null);

  useEffect(() => {
    if (!providerId || !monMemberId || !voitSonCA) return;
    bookingRepository
      .getByMember(providerId, monMemberId)
      .then(setRdvs)
      .catch(() => setRdvs([]));
  }, [providerId, monMemberId, voitSonCA]);

  const chiffres = useMemo(() => {
    const maintenant = new Date();
    const honores = (rdvs ?? []).filter((b) => b.status === 'confirmed' && b.datetime <= maintenant);
    return periodes(maintenant).map((p) => {
      const dedans = honores.filter((b) => b.datetime >= p.debut && b.datetime < p.fin);
      const parDevise = new Map<string, number>();
      for (const b of dedans) {
        const devise = deviseDeLaReservation(b, provider ?? null);
        parDevise.set(devise, (parDevise.get(devise) ?? 0) + (b.price ?? 0));
      }
      return { ...p, rdv: dedans.length, parDevise: [...parDevise] };
    });
  }, [rdvs, provider]);

  if (!voitSonCA) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.background }}>
        <BrandedHeader title={t('espaceMembre.activite.titre')} />
        <View style={{ padding: spacing.xl, alignItems: 'center' }}>
          <Ionicons name="eye-off-outline" size={36} color={colors.textMuted} />
          <Text variant="body" color="textSecondary" align="center" style={{ marginTop: spacing.md }}>
            {t('espaceMembre.activite.masque')}
          </Text>
        </View>
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <BrandedHeader title={t('espaceMembre.activite.titre')} subtitle={t('espaceMembre.activite.sousTitre')} />
      {rdvs === null ? (
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <Loader />
        </View>
      ) : (
        <ScrollView contentContainerStyle={{ padding: spacing.lg, gap: spacing.md }}>
          {chiffres.map((c) => (
            <Card key={c.cle} padding="lg" shadow="sm">
              <Text variant="caption" color="textSecondary" style={{ textTransform: 'uppercase', fontWeight: '600', letterSpacing: 0.5 }}>
                {t(`espaceMembre.activite.${c.cle}`)}
              </Text>
              <View style={{ marginTop: spacing.xs }}>
                {c.parDevise.length === 0 ? (
                  <Text variant="h2">{formatPrice(0, provider?.currency, i18n.language)}</Text>
                ) : (
                  c.parDevise.map(([devise, montant]) => (
                    <Text key={devise} variant="h2">{formatPrice(montant, devise, i18n.language)}</Text>
                  ))
                )}
              </View>
              <Text variant="caption" color="textSecondary" style={{ marginTop: 2 }}>
                {t('espaceMembre.activite.rdv', { count: c.rdv })}
              </Text>
            </Card>
          ))}
          <Text variant="caption" color="textSecondary">{t('espaceMembre.activite.note')}</Text>
        </ScrollView>
      )}
    </View>
  );
}
