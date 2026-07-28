/**
 * Loyalty Screen (client)
 * « Mes cartes de fidélité » — une carte à tampons par prestataire chez qui
 * le client a un historique ET dont la carte de fidélité est active.
 * Données : GET /api/loyalty/me (payload sanitisé, voir useLoyaltyCards).
 *
 * Fidélité v2 : la carte doit être ACTIVÉE par le client (jauge voilée tant
 * que non activée). L'activation (POST /api/loyalty/activate) embarque un
 * opt-in emails promos révocable, puis joue une cinématique de révélation
 * (tampons rétroactifs un par un + confettis maison, Animated natif).
 *
 * La carte et la feuille d'activation vivent dans
 * `components/business/LoyaltyCardActivation` : la page publique du
 * prestataire permet la même activation, avec la même cérémonie.
 */

import React from 'react';
import { useTranslation } from 'react-i18next';
import { View, ScrollView, StyleSheet, Pressable, RefreshControl } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../theme';
import { Text, Card, Avatar, EmptyState, Skeleton } from '../../components';
import {
  LoyaltyActivationCard,
  LoyaltyActivationSheet,
} from '../../components/business/LoyaltyCardActivation';
import { useAuth } from '../../contexts';
import {
  useLoyaltyCards,
  formatLoyaltyReward,
  postLoyaltyActivation,
  type LoyaltyCard,
} from '../../hooks/useLoyaltyCards';

function LoyaltyCardItem({
  card,
  revealing,
  onRequestActivation,
  onToggleOptIn,
  onRevealDone,
}: {
  card: LoyaltyCard;
  /** true = jouer la cinématique de révélation (vient d'être activée). */
  revealing: boolean;
  onRequestActivation: (card: LoyaltyCard) => void;
  onToggleOptIn: (card: LoyaltyCard, value: boolean) => void;
  onRevealDone: () => void;
}) {
  const { colors, spacing } = useTheme();
  const router = useRouter();
  const { t } = useTranslation();

  const reward = formatLoyaltyReward(card.rewardType, card.rewardValue, t);
  // Progression sur le cycle courant ; carte armée = tous les tampons posés.
  const filled = card.armed ? card.threshold : card.confirmedCount % card.threshold;

  const openProvider = card.slug
    ? () => router.push(`/(client)/provider/${card.slug}` as any)
    : undefined;

  // Corps de carte + cinématique : composant partagé avec la page du
  // prestataire (components/business/LoyaltyCardActivation).
  const header = (
    <View style={styles.cardHeader}>
      <Avatar
        size="md"
        name={card.businessName}
        imageUrl={card.photoURL ?? undefined}
        style={{ marginRight: spacing.md }}
      />
      <View style={{ flex: 1 }}>
        <Text variant="body" style={{ fontWeight: '600' }} numberOfLines={1}>
          {card.businessName}
        </Text>
        {!card.activated ? (
          <Text variant="caption" color="textSecondary" style={{ marginTop: 2 }}>
            {t('clientLoyalty.activation.teaser')}
          </Text>
        ) : card.armed ? (
          <Text variant="caption" style={{ color: colors.primary, fontWeight: '600', marginTop: 2 }}>
            {t('loyalty.card.armed')}
          </Text>
        ) : (
          <Text variant="caption" color="textSecondary" style={{ marginTop: 2 }}>
            {t('loyalty.card.remaining', { count: card.remaining, reward })}
          </Text>
        )}
      </View>
      {openProvider && <Ionicons name="chevron-forward" size={20} color={colors.textMuted} />}
    </View>
  );

  return (
    <Pressable
      onPress={openProvider}
      disabled={!openProvider}
      style={({ pressed }) => [pressed && openProvider ? { opacity: 0.85 } : null]}
    >
      <LoyaltyActivationCard
        header={header}
        threshold={card.threshold}
        filled={filled}
        activated={card.activated}
        revealing={revealing}
        onRequestActivation={() => onRequestActivation(card)}
        onRevealDone={onRevealDone}
        optIn={{
          value: card.promoEmailsOptIn,
          onChange: (v) => onToggleOptIn(card, v),
        }}
      />
    </Pressable>
  );
}

export default function LoyaltyScreen() {
  const { colors, spacing } = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { t } = useTranslation();
  const { user, isAuthenticated } = useAuth();
  const { cards, loading, error, refresh } = useLoyaltyCards(isAuthenticated);
  const [refreshing, setRefreshing] = React.useState(false);

  // --- Activation ----------------------------------------------------------
  // L'appel réseau et l'opt-in pré-coché vivent dans LoyaltyActivationSheet ;
  // l'écran ne garde que la cible et la suite (overrides, refresh, révélation).
  const [activationTarget, setActivationTarget] = React.useState<LoyaltyCard | null>(null);
  const [revealingId, setRevealingId] = React.useState<string | null>(null);
  // Écrasements locaux (activation / opt-in optimiste) par providerId —
  // filet si le refresh post-activation échoue.
  const [overrides, setOverrides] = React.useState<
    Record<string, { activated: boolean; promoEmailsOptIn: boolean }>
  >({});

  const displayCards = cards.map((c) => {
    const o = overrides[c.providerId];
    return o ? { ...c, ...o } : c;
  });

  const handleRefresh = async () => {
    setRefreshing(true);
    await refresh();
    setRefreshing(false);
  };

  const openActivation = (card: LoyaltyCard) => {
    setActivationTarget(card);
  };

  const handleActivated = async (promoEmailsOptIn: boolean) => {
    if (!activationTarget) return;
    const providerId = activationTarget.providerId;
    setOverrides((prev) => ({
      ...prev,
      [providerId]: { activated: true, promoEmailsOptIn },
    }));
    // Re-fetch AVANT la cinématique : `armed` est gated par l'activation,
    // seule la donnée fraîche donne la jauge rétroactive correcte. Le flag
    // `refreshing` évite le passage par les skeletons (la liste reste montée).
    setRefreshing(true);
    await refresh();
    setRefreshing(false);
    setActivationTarget(null);
    setRevealingId(providerId);
  };

  const handleToggleOptIn = async (card: LoyaltyCard, value: boolean) => {
    if (!user) return;
    // Optimiste : on bascule tout de suite, on revient en arrière si échec.
    setOverrides((prev) => ({
      ...prev,
      [card.providerId]: { activated: true, promoEmailsOptIn: value },
    }));
    const ok = await postLoyaltyActivation(user, card.providerId, value);
    if (!ok) {
      setOverrides((prev) => ({
        ...prev,
        [card.providerId]: { activated: true, promoEmailsOptIn: !value },
      }));
    }
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {/* Header — fond primary jusque sous la status bar, comme les autres
          écrans (bookings, etc.) : la safe area ne doit jamais rester blanche. */}
      <View style={{ backgroundColor: colors.primary, paddingTop: insets.top }}>
        <View
          style={[
            styles.header,
            { paddingHorizontal: spacing.md, paddingBottom: spacing.md },
          ]}
        >
          <Pressable
            onPress={() => router.back()}
            style={({ pressed }) => [styles.backButton, { opacity: pressed ? 0.7 : 1 }]}
          >
            <Ionicons name="chevron-back" size={24} color="#FFFFFF" />
          </Pressable>
          <Text variant="h2" style={[styles.headerTitle, { color: '#FFFFFF' }]}>
            {t('loyalty.title')}
          </Text>
          <View style={styles.headerSpacer} />
        </View>
      </View>

      {/* Not authenticated */}
      {!isAuthenticated ? (
        <View style={{ paddingHorizontal: spacing.lg, paddingTop: spacing.lg }}>
          <Card padding="lg" shadow="sm">
            <EmptyState
              icon="person-outline"
              title={t('loyalty.notAuth.title')}
              description={t('loyalty.notAuth.description')}
              actionLabel={t('loyalty.notAuth.action')}
              onAction={() => router.push('/(auth)/login')}
            />
          </Card>
        </View>
      ) : loading && !refreshing ? (
        /* Loading skeletons */
        <View style={{ paddingHorizontal: spacing.lg, paddingTop: spacing.lg, gap: spacing.md }}>
          {[0, 1, 2].map((i) => (
            <Card key={i} padding="lg" shadow="sm">
              <View style={styles.cardHeader}>
                <Skeleton width={48} height={48} borderRadius={24} />
                <View style={{ flex: 1, marginLeft: spacing.md, gap: spacing.xs }}>
                  <Skeleton width="60%" height={16} />
                  <Skeleton width="80%" height={12} />
                </View>
              </View>
              <View style={{ marginTop: spacing.md }}>
                <Skeleton width="70%" height={22} />
              </View>
            </Card>
          ))}
        </View>
      ) : error ? (
        /* Error + retry */
        <View style={{ paddingHorizontal: spacing.lg, paddingTop: spacing.lg }}>
          <Card padding="lg" shadow="sm">
            <EmptyState
              icon="alert-circle-outline"
              title={t('loyalty.error.title')}
              description={t('loyalty.error.description')}
              actionLabel={t('common.retry')}
              onAction={() => void refresh()}
            />
          </Card>
        </View>
      ) : cards.length === 0 ? (
        /* Empty */
        <View style={{ paddingHorizontal: spacing.lg, paddingTop: spacing.lg }}>
          <Card padding="lg" shadow="sm">
            <EmptyState
              icon="ribbon-outline"
              title={t('loyalty.empty.title')}
              description={t('loyalty.empty.description')}
            />
          </Card>
        </View>
      ) : (
        /* Cards list */
        <ScrollView
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={handleRefresh}
              tintColor={colors.primary}
            />
          }
          contentContainerStyle={{
            paddingHorizontal: spacing.lg,
            paddingTop: spacing.lg,
            paddingBottom: insets.bottom + spacing['3xl'],
            gap: spacing.md,
          }}
        >
          {displayCards.map((card) => (
            <LoyaltyCardItem
              key={card.providerId}
              card={card}
              revealing={revealingId === card.providerId}
              onRequestActivation={openActivation}
              onToggleOptIn={handleToggleOptIn}
              onRevealDone={() => setRevealingId(null)}
            />
          ))}
        </ScrollView>
      )}

      {/* Feuille d'activation (opt-in emails pré-coché, révocable) —
          composant partagé avec la page du prestataire. */}
      <LoyaltyActivationSheet
        visible={!!activationTarget}
        providerId={activationTarget?.providerId ?? null}
        businessName={activationTarget?.businessName ?? ''}
        threshold={activationTarget?.threshold ?? 0}
        onClose={() => setActivationTarget(null)}
        onActivated={handleActivated}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingBottom: 8,
  },
  backButton: {
    width: 44,
    height: 44,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitle: {
    flex: 1,
    textAlign: 'center',
  },
  headerSpacer: {
    width: 44,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
  },
});
