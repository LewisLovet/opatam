/**
 * MyProvidersRow — « Vos prestataires »
 *
 * Rangée horizontale des prestataires fréquentés par le client, dérivée de
 * ses réservations (providerId uniques, les plus récents d'abord, max 8),
 * enrichie best-effort par :
 *   1. les cartes de fidélité (GET /api/loyalty/me → photo, slug, progression) ;
 *   2. providerService.getById pour les pros SANS carte fidélité (slug + photo).
 * Aucune erreur bloquante : tout échec d'enrichissement retombe sur le
 * snapshot de la résa (nom + photo) avec avatar initiale.
 *
 * NOTE : import direct (`components/MyProvidersRow`) plutôt que via
 * components/index.ts pour éviter les conflits avec les chantiers parallèles.
 */

import { providerService, type WithId } from '@booking-app/firebase';
import type { Booking } from '@booking-app/shared';
import React, { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useTheme } from '../theme';
import { Avatar } from './Avatar';
import { Card } from './Card';
import { Skeleton } from './Loader';
import { Text } from './Text';
import { useAuth } from '../contexts';
import {
  useLoyaltyCards,
  formatLoyaltyReward,
  type LoyaltyCard,
} from '../hooks/useLoyaltyCards';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface MyProvidersRowProps {
  /** Toutes les résas du client (le composant dérive les pros uniques). */
  bookings: WithId<Booking>[];
  /** Chargement des résas (affiche des skeletons discrets). */
  loading: boolean;
}

/** Infos best-effort récupérées pour un pro sans carte de fidélité. */
interface FetchedProviderInfo {
  slug: string | null;
  photoURL: string | null;
  businessName: string | null;
}

const MAX_PROVIDERS = 8;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function toTime(dt: any): number {
  if (dt instanceof Date) return dt.getTime();
  if (dt?.toDate) return dt.toDate().getTime();
  const d = new Date(dt);
  return Number.isNaN(d.getTime()) ? 0 : d.getTime();
}

/** Jauge de progression — hauteur FIXE quel que soit le seuil, pour que
 *  toutes les cartes de la rangée fassent la même taille (les tampons
 *  passaient à la ligne au-delà de ~8 RDV et déformaient les cartes). */
function MiniGauge({ filled, threshold, onPrimary }: { filled: number; threshold: number; onPrimary?: boolean }) {
  const { colors } = useTheme();
  const pct = threshold > 0 ? Math.min(100, Math.round((filled / threshold) * 100)) : 0;
  return (
    <View
      style={[
        styles.gaugeTrack,
        { backgroundColor: onPrimary ? 'rgba(255,255,255,0.35)' : colors.border },
      ]}
    >
      <View
        style={[
          styles.gaugeFill,
          {
            width: `${pct}%`,
            backgroundColor: onPrimary ? '#FFFFFF' : colors.primary,
          },
        ]}
      />
    </View>
  );
}

// ---------------------------------------------------------------------------
// Card
// ---------------------------------------------------------------------------

function ProviderMiniCard({
  name,
  photoURL,
  slug,
  loyalty,
}: {
  name: string;
  photoURL: string | null;
  slug: string | null;
  loyalty: LoyaltyCard | null;
}) {
  const { colors, spacing } = useTheme();
  const router = useRouter();
  const { t } = useTranslation();

  const onPress = slug
    ? () => router.push(`/(client)/provider/${slug}` as any)
    : undefined;

  const reward = loyalty
    ? formatLoyaltyReward(loyalty.rewardType, loyalty.rewardValue, t)
    : null;
  const filled = loyalty
    ? loyalty.armed
      ? loyalty.threshold
      : loyalty.confirmedCount % loyalty.threshold
    : 0;

  return (
    <Pressable
      onPress={onPress}
      disabled={!onPress}
      style={({ pressed }) => [pressed && onPress ? { opacity: 0.85 } : null]}
    >
      <Card padding="md" shadow="sm" style={styles.miniCard}>
        <Avatar size="lg" name={name} imageUrl={photoURL ?? undefined} />
        <Text
          variant="caption"
          numberOfLines={1}
          style={{ fontWeight: '600', marginTop: spacing.sm, textAlign: 'center', maxWidth: '100%' }}
        >
          {name}
        </Text>
        {loyalty && reward && (
          loyalty.armed ? (
            // Récompense prête : un bouton d'ACTION incite bien plus qu'une
            // jauge pleine — il mène à la page du pro pour réserver.
            <Pressable
              onPress={onPress}
              disabled={!onPress}
              style={({ pressed }) => [
                styles.loyaltyPill,
                {
                  backgroundColor: colors.primary,
                  marginTop: 6,
                  paddingVertical: 7,
                  opacity: pressed ? 0.85 : 1,
                },
              ]}
            >
              <Text
                variant="caption"
                numberOfLines={1}
                style={{ color: '#FFFFFF', fontWeight: '700', fontSize: 11 }}
              >
                {t('home.providers.useReward', { reward })}
              </Text>
            </Pressable>
          ) : (
            // En cours : pastille + jauge de progression.
            <View
              style={[
                styles.loyaltyPill,
                { backgroundColor: colors.primaryLight, marginTop: 6 },
              ]}
            >
              <Text
                variant="caption"
                numberOfLines={1}
                style={{ color: colors.primary, fontWeight: '700', fontSize: 11 }}
              >
                {t('home.providers.progress', {
                  filled,
                  threshold: loyalty.threshold,
                  reward,
                })}
              </Text>
              <MiniGauge filled={filled} threshold={loyalty.threshold} />
            </View>
          )
        )}
      </Card>
    </Pressable>
  );
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export function MyProvidersRow({ bookings, loading }: MyProvidersRowProps) {
  const { spacing, colors } = useTheme();
  const { t } = useTranslation();
  const { isAuthenticated } = useAuth();
  const router = useRouter();

  // Cartes de fidélité — best-effort (les erreurs sont silencieuses ici,
  // l'écran dédié /loyalty gère l'affichage d'erreur).
  const { cards, loading: loadingCards } = useLoyaltyCards(isAuthenticated);
  const cardsByProvider = useMemo(() => {
    const map: Record<string, LoyaltyCard> = {};
    for (const c of cards) map[c.providerId] = c;
    return map;
  }, [cards]);

  // Pros uniques dérivés des résas, plus récents d'abord, max 8.
  const providers = useMemo(() => {
    const sorted = [...bookings].sort((a, b) => toTime(b.datetime) - toTime(a.datetime));
    const seen = new Set<string>();
    const out: { providerId: string; name: string; photoURL: string | null }[] = [];
    for (const b of sorted) {
      if (!b.providerId || seen.has(b.providerId)) continue;
      seen.add(b.providerId);
      out.push({
        providerId: b.providerId,
        name: b.providerName,
        photoURL: b.providerPhoto ?? null,
      });
      if (out.length >= MAX_PROVIDERS) break;
    }
    return out;
  }, [bookings]);

  // Enrichissement best-effort (slug + photo) pour les pros SANS carte de
  // fidélité — la carte fidélité fournit déjà slug/photo pour les autres.
  const [fetched, setFetched] = useState<Record<string, FetchedProviderInfo>>({});
  const missingKey = providers
    .map((p) => p.providerId)
    .filter((id) => !cardsByProvider[id] && !(id in fetched))
    .join(',');
  useEffect(() => {
    if (!isAuthenticated || loadingCards) return;
    const ids = missingKey ? missingKey.split(',') : [];
    if (ids.length === 0) return;
    let cancelled = false;
    (async () => {
      const entries = await Promise.all(
        ids.map(async (id) => {
          try {
            const prov = await providerService.getById(id);
            return [
              id,
              {
                slug: prov?.slug ?? null,
                photoURL: prov?.photoURL ?? null,
                businessName: prov?.businessName ?? null,
              },
            ] as const;
          } catch {
            return [id, { slug: null, photoURL: null, businessName: null }] as const;
          }
        }),
      );
      if (!cancelled) setFetched((prev) => ({ ...prev, ...Object.fromEntries(entries) }));
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAuthenticated, loadingCards, missingKey]);

  // Masqué si non connecté, ou aucune résa une fois chargé.
  if (!isAuthenticated) return null;
  if (!loading && providers.length === 0) return null;

  return (
    <View style={{ marginBottom: spacing.xl }}>
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: spacing.md,
          paddingHorizontal: spacing.lg,
        }}
      >
        <Text variant="h3">{t('home.providers.title')}</Text>
        {/* Accès direct à l'espace fidélité depuis l'accueil. */}
        <Pressable onPress={() => router.push('/(client)/loyalty' as any)} hitSlop={8}>
          <Text variant="caption" style={{ color: colors.primary, fontWeight: '600' }}>
            {t('home.providers.seeLoyalty')}
          </Text>
        </Pressable>
      </View>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ paddingHorizontal: spacing.lg, gap: spacing.md }}
      >
        {loading && providers.length === 0
          ? [0, 1, 2].map((i) => (
              <Card key={i} padding="md" shadow="sm" style={styles.miniCard}>
                <Skeleton width={48} height={48} borderRadius={24} />
                <View style={{ marginTop: spacing.sm }}>
                  <Skeleton width={80} height={12} />
                </View>
                <View style={{ marginTop: 6 }}>
                  <Skeleton width={60} height={10} />
                </View>
              </Card>
            ))
          : providers.map((p) => {
              const card = cardsByProvider[p.providerId] ?? null;
              const info = fetched[p.providerId];
              return (
                <ProviderMiniCard
                  key={p.providerId}
                  name={card?.businessName || info?.businessName || p.name}
                  photoURL={card?.photoURL ?? info?.photoURL ?? p.photoURL}
                  slug={card?.slug ?? info?.slug ?? null}
                  loyalty={card}
                />
              );
            })}
      </ScrollView>
    </View>
  );
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const styles = StyleSheet.create({
  loyaltyPill: {
    alignItems: 'center',
    borderRadius: 10,
    paddingHorizontal: 8,
    paddingVertical: 5,
    maxWidth: '100%',
  },
  miniCard: {
    // Dimensions FIXES : toutes les cartes de la rangée font la même
    // taille, avec ou sans programme de fidélité, quel que soit le seuil.
    width: 140,
    height: 148,
    alignItems: 'center',
  },
  gaugeTrack: {
    width: 100,
    height: 5,
    borderRadius: 2.5,
    marginTop: 6,
    overflow: 'hidden',
  },
  gaugeFill: {
    height: '100%',
    borderRadius: 2.5,
  },
});
