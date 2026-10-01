/**
 * Espace membre — « Mes avis » : les avis laissés sur SES rendez-vous
 * (`reviews.memberId`, posé à la création de l'avis depuis le rendez-vous).
 */
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { View, StyleSheet, FlatList, RefreshControl, ActivityIndicator } from 'react-native';
import { useTranslation } from 'react-i18next';
import { Ionicons } from '@expo/vector-icons';
import { reviewService, reviewRepository, type WithId } from '@booking-app/firebase';
import type { Review } from '@booking-app/shared';
import i18n from '../../lib/i18n';
import { useTheme } from '../../theme';
import { Text, Card } from '../../components';
import { BrandedHeader } from '../../components/business/BrandedHeader';
import { useProvider, useEspaceMembre } from '../../contexts';

function Etoiles({ note, taille = 14 }: { note: number; taille?: number }) {
  return (
    <View style={{ flexDirection: 'row', gap: 2 }}>
      {[1, 2, 3, 4, 5].map((i) => (
        <Ionicons key={i} name={i <= Math.round(note) ? 'star' : 'star-outline'} size={taille} color="#F59E0B" />
      ))}
    </View>
  );
}

export default function MesAvisScreen() {
  const { t } = useTranslation();
  const { colors, spacing } = useTheme();
  const { providerId } = useProvider();
  const { monMemberId } = useEspaceMembre();
  const [avis, setAvis] = useState<WithId<Review>[]>([]);
  const [chargement, setChargement] = useState(true);
  const [rafraichit, setRafraichit] = useState(false);

  const charger = useCallback(async () => {
    if (!providerId || !monMemberId) return;
    try {
      setAvis(await reviewService.getMemberReviews(providerId, monMemberId));
    } catch {
      // Index absent ou lecture refusée : on relit tout le salon et on trie ici.
      const tous = await reviewRepository.getAllByProvider(providerId).catch(() => []);
      setAvis(tous.filter((a) => a.memberId === monMemberId));
    }
  }, [providerId, monMemberId]);

  useEffect(() => {
    charger().finally(() => setChargement(false));
  }, [charger]);

  const moyenne = useMemo(() => (avis.length ? avis.reduce((s, a) => s + a.rating, 0) / avis.length : 0), [avis]);
  const date = (d: Date) => new Intl.DateTimeFormat(i18n.language, { day: 'numeric', month: 'long', year: 'numeric' }).format(d);

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <BrandedHeader title={t('espaceMembre.avis.titre')} />
      {chargement ? (
        <View style={s.centre}>
          <ActivityIndicator color={colors.primary} />
        </View>
      ) : (
        <FlatList
          data={avis}
          keyExtractor={(a) => a.id}
          contentContainerStyle={{ padding: spacing.lg, gap: spacing.md, paddingBottom: spacing['3xl'] }}
          refreshControl={
            <RefreshControl
              refreshing={rafraichit}
              onRefresh={async () => {
                setRafraichit(true);
                await charger();
                setRafraichit(false);
              }}
              tintColor={colors.primary}
            />
          }
          ListHeaderComponent={
            avis.length > 0 ? (
              <Card padding="lg" shadow="sm" style={{ alignItems: 'center' }}>
                <Text variant="h1">{moyenne.toFixed(1).replace('.', i18n.language === 'en' ? '.' : ',')}</Text>
                <Etoiles note={moyenne} taille={20} />
                <Text variant="caption" color="textSecondary" style={{ marginTop: 6 }}>
                  {t('espaceMembre.avis.nombre', { count: avis.length })}
                </Text>
              </Card>
            ) : null
          }
          ListEmptyComponent={
            <View style={s.centre}>
              <Ionicons name="star-outline" size={40} color={colors.textMuted} />
              <Text variant="body" color="textSecondary" align="center" style={{ marginTop: spacing.md }}>
                {t('espaceMembre.avis.vide')}
              </Text>
            </View>
          }
          renderItem={({ item }) => (
            <Card padding="md" shadow="sm">
              <View style={s.ligne}>
                <Etoiles note={item.rating} />
                <Text variant="caption" color="textMuted">{date(item.createdAt)}</Text>
              </View>
              <Text variant="body" style={{ fontWeight: '600', marginTop: 6 }}>{item.clientName || t('espaceMembre.avis.anonyme')}</Text>
              {!!item.comment && (
                <Text variant="bodySmall" color="textSecondary" style={{ marginTop: 4 }}>{item.comment}</Text>
              )}
            </Card>
          )}
        />
      )}
    </View>
  );
}

const s = StyleSheet.create({
  centre: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32 },
  ligne: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
});
