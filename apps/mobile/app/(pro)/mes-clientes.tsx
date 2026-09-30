/**
 * Espace membre — « Mes clientes » : les personnes qu'IL a reçues.
 *
 * Tirée de SES rendez-vous (jamais du fichier clients du salon, réservé au
 * gérant) : une ligne par cliente, avec ses coordonnées, le nombre de
 * visites, la dernière et la prochaine, et d'un geste l'historique.
 */
import React, { useEffect, useMemo, useState } from 'react';
import { View, FlatList, Pressable, Linking, RefreshControl, StyleSheet } from 'react-native';
import { useTranslation } from 'react-i18next';
import { Ionicons } from '@expo/vector-icons';
import { bookingRepository } from '@booking-app/firebase';
import type { Booking } from '@booking-app/shared';
import type { WithId } from '@booking-app/firebase';
import { useTheme } from '../../theme';
import { Text, Card, Loader, EmptyState, Input } from '../../components';
import { BrandedHeader } from '../../components/business/BrandedHeader';
import { useProvider, useEspaceMembre } from '../../contexts';
import i18n from '../../lib/i18n';

interface Cliente {
  cle: string;
  nom: string;
  email: string | null;
  telephone: string | null;
  visites: number;
  derniere: Date | null;
  prochaine: Date | null;
  historique: WithId<Booking>[];
}

// Une visite = un rendez-vous confirmé et passé (il n'y a pas de statut « terminé »).
const HONORES = new Set(['confirmed']);

/** Une cliente = même e-mail, sinon même téléphone, sinon même nom. */
function regrouper(rdvs: WithId<Booking>[], maintenant: Date): Cliente[] {
  const parCle = new Map<string, Cliente>();
  for (const b of rdvs) {
    const info = b.clientInfo ?? ({} as Booking['clientInfo']);
    const email = info?.email?.trim().toLowerCase() || null;
    const tel = info?.phone?.replace(/\s+/g, '') || null;
    const cle = email ? `e:${email}` : tel ? `t:${tel}` : `n:${(info?.name ?? '').trim().toLowerCase()}`;
    const c = parCle.get(cle) ?? {
      cle, nom: info?.name ?? '—', email, telephone: info?.phone ?? null,
      visites: 0, derniere: null, prochaine: null, historique: [],
    };
    const quand = b.datetime instanceof Date ? b.datetime : new Date(b.datetime as unknown as string);
    c.historique.push(b);
    if (HONORES.has(b.status) && quand <= maintenant) {
      c.visites += 1;
      if (!c.derniere || quand > c.derniere) c.derniere = quand;
    }
    if ((b.status === 'confirmed' || b.status === 'pending') && quand > maintenant && (!c.prochaine || quand < c.prochaine)) {
      c.prochaine = quand;
    }
    parCle.set(cle, c);
  }
  return [...parCle.values()].sort((a, b) => (b.derniere?.getTime() ?? 0) - (a.derniere?.getTime() ?? 0));
}

const jour = (d: Date) => new Intl.DateTimeFormat(i18n.language, { day: 'numeric', month: 'short', year: 'numeric' }).format(d);

export default function MesClientesScreen() {
  const { colors, spacing } = useTheme();
  const { t } = useTranslation();
  const { providerId } = useProvider();
  const { monMemberId } = useEspaceMembre();
  const [rdvs, setRdvs] = useState<WithId<Booking>[] | null>(null);
  const [recherche, setRecherche] = useState('');
  const [ouverte, setOuverte] = useState<string | null>(null);
  const [rafraichit, setRafraichit] = useState(false);

  const charger = async () => {
    if (!providerId || !monMemberId) return;
    try {
      setRdvs(await bookingRepository.getByMember(providerId, monMemberId));
    } catch (err) {
      console.error('[mes-clientes]', err);
      setRdvs([]);
    }
  };
  useEffect(() => {
    void charger();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [providerId, monMemberId]);

  const clientes = useMemo(() => {
    const toutes = regrouper(rdvs ?? [], new Date());
    const q = recherche.trim().toLowerCase();
    return q ? toutes.filter((c) => [c.nom, c.email, c.telephone].some((v) => v?.toLowerCase().includes(q))) : toutes;
  }, [rdvs, recherche]);

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <BrandedHeader title={t('espaceMembre.clientes.titre')} />
      {rdvs === null ? (
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <Loader />
        </View>
      ) : (
        <FlatList
          data={clientes}
          keyExtractor={(c) => c.cle}
          contentContainerStyle={{ padding: spacing.lg, gap: spacing.sm }}
          refreshControl={
            <RefreshControl
              refreshing={rafraichit}
              onRefresh={async () => {
                setRafraichit(true);
                await charger();
                setRafraichit(false);
              }}
            />
          }
          ListHeaderComponent={
            <View style={{ marginBottom: spacing.sm }}>
              <Input placeholder={t('espaceMembre.clientes.recherche')} value={recherche} onChangeText={setRecherche} />
            </View>
          }
          ListEmptyComponent={
            <EmptyState icon="people-outline" title={t('espaceMembre.clientes.vide')} description={t('espaceMembre.clientes.videTexte')} />
          }
          renderItem={({ item: c }) => (
            <Card padding="md" shadow="sm">
              <Pressable onPress={() => setOuverte(ouverte === c.cle ? null : c.cle)}>
                <View style={s.ligne}>
                  <View style={{ flex: 1, minWidth: 0 }}>
                    <Text variant="body" style={{ fontWeight: '600' }} numberOfLines={1}>{c.nom}</Text>
                    <Text variant="caption" color="textSecondary">
                      {t('espaceMembre.clientes.visites', { count: c.visites })}
                      {c.derniere ? ` · ${t('espaceMembre.clientes.derniere', { date: jour(c.derniere) })}` : ''}
                    </Text>
                    {c.prochaine && (
                      <Text variant="caption" color="primary" style={{ fontWeight: '600' }}>
                        {t('espaceMembre.clientes.prochaine', { date: jour(c.prochaine) })}
                      </Text>
                    )}
                  </View>
                  {c.telephone ? (
                    <Pressable hitSlop={8} onPress={() => Linking.openURL(`tel:${c.telephone}`)} style={[s.action, { backgroundColor: colors.primaryLight }]}>
                      <Ionicons name="call-outline" size={18} color={colors.primary} />
                    </Pressable>
                  ) : null}
                  {c.email ? (
                    <Pressable hitSlop={8} onPress={() => Linking.openURL(`mailto:${c.email}`)} style={[s.action, { backgroundColor: colors.primaryLight }]}>
                      <Ionicons name="mail-outline" size={18} color={colors.primary} />
                    </Pressable>
                  ) : null}
                </View>
              </Pressable>
              {ouverte === c.cle && (
                <View style={{ marginTop: spacing.sm, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border, paddingTop: spacing.sm, gap: 4 }}>
                  {c.historique.map((b) => (
                    <View key={b.id} style={s.ligne}>
                      <Text variant="caption" style={{ flex: 1 }} numberOfLines={1}>
                        {jour(b.datetime instanceof Date ? b.datetime : new Date(b.datetime as unknown as string))} · {b.serviceName}
                      </Text>
                      <Text variant="caption" color="textSecondary">{t(`espaceMembre.clientes.statut.${b.status}`, { defaultValue: b.status })}</Text>
                    </View>
                  ))}
                </View>
              )}
            </Card>
          )}
        />
      )}
    </View>
  );
}

const s = StyleSheet.create({
  ligne: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  action: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
});
