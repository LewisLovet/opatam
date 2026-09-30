/**
 * Espace membre — la page d'ACCUEIL du membre connecté.
 *
 * Ce que le gérant voit sur son tableau de bord (abonnement, vitrine,
 * statistiques du salon) n'est pas à lui. Ici : SA journée (rendez-vous du
 * jour, le prochain en tête), ce qui l'attend (à confirmer, la semaine), et
 * des raccourcis vers ses écrans.
 */
import React, { useEffect, useMemo, useState } from 'react';
import { View, ScrollView, Pressable, RefreshControl, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { memberService } from '@booking-app/firebase';
import type { Booking, Member } from '@booking-app/shared';
import type { WithId } from '@booking-app/firebase';
import { useTheme } from '../../theme';
import { Text } from '../Text';
import { Card } from '../Card';
import { useProvider, useEspaceMembre } from '../../contexts';
import { useProviderBookings } from '../../hooks/useProviderBookings';
import { useProBookingBadges } from '../../hooks/useBookingBadges';
import i18n from '../../lib/i18n';

const ACTIFS: Booking['status'][] = ['confirmed', 'pending'];

function debutDuJour(d = new Date()) {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}
/** Dimanche soir de la semaine en cours (semaine du lundi au dimanche). */
function finDeSemaine(d = new Date()) {
  const jour = d.getDay() === 0 ? 7 : d.getDay();
  return new Date(d.getFullYear(), d.getMonth(), d.getDate() + (7 - jour), 23, 59, 59, 999);
}
const heure = (b: Booking) =>
  b.localStartTime ??
  new Intl.DateTimeFormat(i18n.language, { hour: '2-digit', minute: '2-digit' }).format(
    b.datetime instanceof Date ? b.datetime : new Date(b.datetime as unknown as string),
  );

export function AccueilMembre() {
  const { colors, spacing, radius } = useTheme();
  const { t } = useTranslation();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { providerId, provider } = useProvider();
  const { monMemberId, voitSonCA } = useEspaceMembre();
  const [membre, setMembre] = useState<Member | null>(null);
  const [rafraichit, setRafraichit] = useState(false);

  useEffect(() => {
    if (!providerId || !monMemberId) return;
    memberService.getById(providerId, monMemberId).then(setMembre).catch(() => setMembre(null));
  }, [providerId, monMemberId]);

  // Bornes figées au montage (et au rafraîchissement) : un `new Date()` par
  // rendu relancerait la lecture en boucle.
  const [bornes, setBornes] = useState(() => ({ debut: debutDuJour(), fin: finDeSemaine() }));
  const { bookings, isLoading, refresh } = useProviderBookings({
    providerId,
    memberId: monMemberId ?? undefined,
    startDate: bornes.debut,
    endDate: bornes.fin,
    status: ACTIFS,
  });
  const { pendingCount } = useProBookingBadges(providerId, monMemberId);

  const { aujourdhui, prochain, semaine } = useMemo(() => {
    const maintenant = new Date();
    const finJour = new Date(bornes.debut.getTime() + 86_400_000);
    const tries = [...bookings].sort((a, b) => +a.datetime - +b.datetime);
    const duJour = tries.filter((b) => b.datetime >= bornes.debut && b.datetime < finJour);
    return {
      aujourdhui: duJour,
      prochain: tries.find((b) => b.datetime >= maintenant) ?? null,
      semaine: tries.length,
    };
  }, [bookings, bornes]);

  const rafraichir = async () => {
    setRafraichit(true);
    setBornes({ debut: debutDuJour(), fin: finDeSemaine() });
    await refresh();
    setRafraichit(false);
  };

  const prenom = (membre?.name ?? '').trim().split(/\s+/)[0] ?? '';
  const raccourcis: Array<{ icone: keyof typeof Ionicons.glyphMap; libelle: string; route: string }> = [
    { icone: 'add-circle-outline', libelle: t('espaceMembre.accueil.nouveauRdv'), route: '/(pro)/create-booking' },
    { icone: 'remove-circle-outline', libelle: t('espaceMembre.accueil.bloquer'), route: '/(pro)/block-slot' },
    { icone: 'time-outline', libelle: t('espaceMembre.menu.mesHoraires'), route: '/(pro)/availability' },
    { icone: 'people-outline', libelle: t('espaceMembre.menu.mesClientes'), route: '/(pro)/mes-clientes' },
    ...(voitSonCA ? [{ icone: 'stats-chart-outline' as const, libelle: t('espaceMembre.menu.monActivite'), route: '/(pro)/mon-activite' }] : []),
    { icone: 'person-circle-outline', libelle: t('espaceMembre.menu.monProfil'), route: '/(pro)/membre-profil' },
  ];

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <View style={{ backgroundColor: colors.primary, paddingTop: insets.top }}>
        <View style={{ paddingHorizontal: spacing.lg, paddingTop: spacing.md, paddingBottom: spacing.lg }}>
          <Text variant="h1" style={{ color: '#FFFFFF' }}>
            {prenom ? t('espaceMembre.accueil.bonjour', { prenom }) : t('espaceMembre.accueil.bonjourSeul')}
          </Text>
          <Text variant="body" style={{ color: 'rgba(255,255,255,0.85)', marginTop: 2 }}>
            {provider?.businessName ?? ''}
          </Text>
        </View>
      </View>

      <ScrollView
        contentContainerStyle={{ padding: spacing.lg, gap: spacing.lg, paddingBottom: spacing['3xl'] }}
        refreshControl={<RefreshControl refreshing={rafraichit} onRefresh={rafraichir} tintColor={colors.primary} />}
      >
        {/* À confirmer */}
        {pendingCount > 0 && (
          <Pressable onPress={() => router.push('/(pro)/(tabs)/bookings' as never)}>
            <Card padding="md" shadow="sm" style={{ backgroundColor: '#FFFBEB' }}>
              <View style={s.ligne}>
                <Ionicons name="alert-circle" size={20} color="#D97706" />
                <Text variant="body" style={{ flex: 1, fontWeight: '600', color: '#92400E' }}>
                  {t('espaceMembre.accueil.aConfirmer', { count: pendingCount })}
                </Text>
                <Ionicons name="chevron-forward" size={18} color="#92400E" />
              </View>
            </Card>
          </Pressable>
        )}

        {/* Aujourd'hui */}
        <Card padding="lg" shadow="sm">
          <View style={[s.ligne, { marginBottom: spacing.sm }]}>
            <Text variant="h3" style={{ flex: 1 }}>{t('espaceMembre.accueil.aujourdhui')}</Text>
            <Pressable hitSlop={8} onPress={() => router.push('/(pro)/(tabs)/calendar' as never)}>
              <Text variant="bodySmall" color="primary" style={{ fontWeight: '600' }}>{t('espaceMembre.accueil.voirAgenda')}</Text>
            </Pressable>
          </View>
          {isLoading ? (
            <Text variant="bodySmall" color="textSecondary">…</Text>
          ) : aujourdhui.length === 0 ? (
            <Text variant="bodySmall" color="textSecondary">{t('espaceMembre.accueil.rienAujourdhui')}</Text>
          ) : (
            <View style={{ gap: spacing.xs }}>
              {aujourdhui.slice(0, 5).map((b: WithId<Booking>) => {
                const estProchain = prochain?.id === b.id;
                return (
                  <Pressable
                    key={b.id}
                    onPress={() => router.push(`/(pro)/booking-detail/${b.id}` as never)}
                    style={({ pressed }) => [
                      s.rdv,
                      {
                        borderRadius: radius.md,
                        backgroundColor: estProchain ? colors.primaryLight : pressed ? colors.surfaceSecondary : 'transparent',
                      },
                    ]}
                  >
                    <Text variant="body" style={{ fontWeight: '700', width: 56, color: estProchain ? colors.primary : colors.text }}>
                      {heure(b)}
                    </Text>
                    <View style={{ flex: 1, minWidth: 0 }}>
                      <Text variant="body" numberOfLines={1} style={{ fontWeight: '600' }}>{b.clientInfo?.name ?? '—'}</Text>
                      <Text variant="caption" color="textSecondary" numberOfLines={1}>{b.serviceName}</Text>
                    </View>
                    {b.status === 'pending' && <Ionicons name="time-outline" size={16} color="#D97706" />}
                  </Pressable>
                );
              })}
              {aujourdhui.length > 5 && (
                <Text variant="caption" color="textSecondary">
                  {t('espaceMembre.accueil.etAutres', { count: aujourdhui.length - 5 })}
                </Text>
              )}
            </View>
          )}
        </Card>

        {/* La semaine */}
        <Card padding="lg" shadow="sm">
          <View style={s.ligne}>
            <Ionicons name="calendar-outline" size={20} color={colors.primary} />
            <Text variant="body" style={{ flex: 1 }}>
              {t('espaceMembre.accueil.semaine', { count: semaine })}
            </Text>
          </View>
          {prochain && !aujourdhui.some((b) => b.id === prochain.id) && (
            <Text variant="caption" color="textSecondary" style={{ marginTop: spacing.xs }}>
              {t('espaceMembre.accueil.prochain', {
                quand: new Intl.DateTimeFormat(i18n.language, { weekday: 'long', day: 'numeric', month: 'long' }).format(prochain.datetime),
                heure: heure(prochain),
              })}
            </Text>
          )}
        </Card>

        {/* Raccourcis */}
        <View style={s.grille}>
          {raccourcis.map((r) => (
            <Pressable
              key={r.route}
              onPress={() => router.push(r.route as never)}
              style={({ pressed }) => [s.tuile, { backgroundColor: colors.surface, borderColor: colors.border, borderRadius: radius.lg, opacity: pressed ? 0.8 : 1 }]}
            >
              <View style={[s.icone, { backgroundColor: colors.primaryLight, borderRadius: radius.md }]}>
                <Ionicons name={r.icone} size={22} color={colors.primary} />
              </View>
              <Text variant="bodySmall" style={{ fontWeight: '600', marginTop: spacing.sm }} numberOfLines={2}>{r.libelle}</Text>
            </Pressable>
          ))}
        </View>
      </ScrollView>
    </View>
  );
}

const s = StyleSheet.create({
  ligne: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  rdv: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 8, paddingHorizontal: 8 },
  grille: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  tuile: { width: '47%', flexGrow: 1, padding: 14, borderWidth: 1 },
  icone: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
});
