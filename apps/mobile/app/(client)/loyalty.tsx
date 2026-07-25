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
 */

import React from 'react';
import { useTranslation } from 'react-i18next';
import {
  View,
  ScrollView,
  StyleSheet,
  Pressable,
  RefreshControl,
  Animated,
  type DimensionValue,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../theme';
import { Text, Card, Avatar, Button, EmptyState, Skeleton, Switch } from '../../components';
import { OverlaySheet } from '../../components/OverlaySheet';
import { useAuth } from '../../contexts';
import {
  useLoyaltyCards,
  formatLoyaltyReward,
  postLoyaltyActivation,
  type LoyaltyCard,
} from '../../hooks/useLoyaltyCards';

/**
 * Pluie de confettis maison : ~20 rectangles colorés qui tombent (~1,5 s).
 * Volontairement sans lib externe — Animated + useNativeDriver suffisent.
 */
function ConfettiRain({ onDone }: { onDone: () => void }) {
  const { colors } = useTheme();
  const palette = [colors.primary, '#F59E0B', '#10B981', '#EC4899'];
  const particles = React.useRef(
    Array.from({ length: 20 }, (_, i) => ({
      anim: new Animated.Value(0),
      left: `${5 + Math.random() * 90}%` as DimensionValue,
      delay: Math.random() * 400,
      drift: (Math.random() - 0.5) * 60,
      spin: (Math.random() - 0.5) * 720,
      size: 5 + Math.random() * 6,
      colorIdx: i % 4,
    })),
  ).current;

  React.useEffect(() => {
    Animated.parallel(
      particles.map((p) =>
        Animated.timing(p.anim, {
          toValue: 1,
          duration: 1100,
          delay: p.delay,
          useNativeDriver: true,
        }),
      ),
    ).start(({ finished }) => {
      if (finished) onDone();
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill}>
      {particles.map((p, i) => (
        <Animated.View
          key={i}
          style={{
            position: 'absolute',
            top: -12,
            left: p.left,
            width: p.size,
            height: p.size * 1.7,
            borderRadius: 2,
            backgroundColor: palette[p.colorIdx],
            opacity: p.anim.interpolate({ inputRange: [0, 0.7, 1], outputRange: [1, 1, 0] }),
            transform: [
              { translateY: p.anim.interpolate({ inputRange: [0, 1], outputRange: [0, 170] }) },
              { translateX: p.anim.interpolate({ inputRange: [0, 1], outputRange: [0, p.drift] }) },
              {
                rotate: p.anim.interpolate({
                  inputRange: [0, 1],
                  outputRange: ['0deg', `${p.spin}deg`],
                }),
              },
            ],
          }}
        />
      ))}
    </View>
  );
}

/**
 * Rangée de tampons : `filled` cercles remplis sur `threshold`.
 * `appearAnims` (cinématique d'activation) : une Animated.Value par tampon
 * rempli — le tampon reste invisible tant que sa valeur est à 0.
 */
function StampRow({
  filled,
  threshold,
  appearAnims,
}: {
  filled: number;
  threshold: number;
  appearAnims?: Animated.Value[] | null;
}) {
  const { colors } = useTheme();
  return (
    <View style={styles.stampRow}>
      {Array.from({ length: threshold }, (_, i) => {
        const isFilled = i < filled;
        const stamp = (
          <View
            style={[
              styles.stamp,
              isFilled
                ? { backgroundColor: colors.primary }
                : {
                    backgroundColor: colors.surfaceSecondary,
                    borderWidth: 1.5,
                    borderColor: colors.border,
                  },
            ]}
          >
            {isFilled && <Ionicons name="checkmark" size={13} color="#FFFFFF" />}
          </View>
        );
        const anim = isFilled ? appearAnims?.[i] : undefined;
        if (!anim) return <View key={i}>{stamp}</View>;
        return (
          <Animated.View
            key={i}
            style={{
              opacity: anim,
              // Le spring dépasse 1 → petit rebond « pop » sur chaque tampon.
              transform: [
                { scale: anim.interpolate({ inputRange: [0, 1], outputRange: [0.2, 1] }) },
              ],
            }}
          >
            {stamp}
          </Animated.View>
        );
      })}
    </View>
  );
}

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
  const { colors, spacing, radius } = useTheme();
  const router = useRouter();
  const { t } = useTranslation();

  const reward = formatLoyaltyReward(card.rewardType, card.rewardValue, t);
  // Progression sur le cycle courant ; carte armée = tous les tampons posés.
  const filled = card.armed ? card.threshold : card.confirmedCount % card.threshold;

  // --- Cinématique d'activation -------------------------------------------
  // Les Animated.Value des tampons sont créées PENDANT le render (et pas dans
  // un effet) pour que la première frame « revealing » parte bien de 0 — un
  // useEffect s'exécute après paint et laisserait flasher la jauge pleine.
  const sectionAnim = React.useRef(new Animated.Value(1)).current;
  const stampAnims = React.useRef<Animated.Value[] | null>(null);
  const [confetti, setConfetti] = React.useState(false);
  if (revealing && !stampAnims.current) {
    stampAnims.current = Array.from({ length: filled }, () => new Animated.Value(0));
    sectionAnim.setValue(0);
  }

  React.useEffect(() => {
    if (!revealing || !stampAnims.current) return;
    // Fondu/scale de la carte, puis tampons UN PAR UN (stagger 120 ms) —
    // rétroactif : la jauge peut se remplir d'un coup, effet « trésor ».
    Animated.sequence([
      Animated.timing(sectionAnim, { toValue: 1, duration: 350, useNativeDriver: true }),
      Animated.stagger(
        120,
        stampAnims.current.map((a) =>
          Animated.spring(a, { toValue: 1, useNativeDriver: true, damping: 12, stiffness: 220 }),
        ),
      ),
    ]).start(({ finished }) => {
      if (finished) setConfetti(true);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [revealing]);

  const handleConfettiDone = () => {
    setConfetti(false);
    stampAnims.current = null;
    onRevealDone();
  };

  const openProvider = card.slug
    ? () => router.push(`/(client)/provider/${card.slug}` as any)
    : undefined;

  return (
    <Pressable
      onPress={openProvider}
      disabled={!openProvider}
      style={({ pressed }) => [pressed && openProvider ? { opacity: 0.85 } : null]}
    >
      <Animated.View
        style={
          revealing
            ? {
                opacity: sectionAnim,
                transform: [
                  { scale: sectionAnim.interpolate({ inputRange: [0, 1], outputRange: [0.94, 1] }) },
                ],
              }
            : null
        }
      >
        <Card padding="lg" shadow="sm">
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
                <Text
                  variant="caption"
                  style={{ color: colors.primary, fontWeight: '600', marginTop: 2 }}
                >
                  {t('loyalty.card.armed')}
                </Text>
              ) : (
                <Text variant="caption" color="textSecondary" style={{ marginTop: 2 }}>
                  {t('loyalty.card.remaining', { count: card.remaining, reward })}
                </Text>
              )}
            </View>
            {openProvider && (
              <Ionicons name="chevron-forward" size={20} color={colors.textMuted} />
            )}
          </View>

          {card.activated ? (
            <>
              <View style={{ marginTop: spacing.md }}>
                <StampRow
                  filled={filled}
                  threshold={card.threshold}
                  appearAnims={revealing ? stampAnims.current : null}
                />
              </View>
              {/* Réglage opt-in emails promos, révocable à tout moment. */}
              <View
                style={[
                  styles.optInRow,
                  { marginTop: spacing.md, borderTopColor: colors.border, paddingTop: spacing.sm },
                ]}
              >
                <Switch
                  value={card.promoEmailsOptIn}
                  onValueChange={(v) => onToggleOptIn(card, v)}
                  label={t(
                    card.promoEmailsOptIn
                      ? 'clientLoyalty.activation.emailsOn'
                      : 'clientLoyalty.activation.emailsOff',
                  )}
                />
              </View>
            </>
          ) : (
            /* Jauge voilée : tampons à peine visibles + voile avec CTA.
               Ni progression ni récompense tant que la carte n'est pas activée. */
            <View
              style={[
                styles.veiledZone,
                {
                  marginTop: spacing.md,
                  backgroundColor: colors.surfaceSecondary,
                  borderRadius: radius.md,
                },
              ]}
            >
              <View style={{ opacity: 0.18 }}>
                <StampRow filled={0} threshold={card.threshold} />
              </View>
              <View style={[StyleSheet.absoluteFill, styles.veilOverlay]}>
                <Button
                  title={t('clientLoyalty.activation.activateButton')}
                  size="sm"
                  onPress={() => onRequestActivation(card)}
                />
              </View>
            </View>
          )}

          {confetti && <ConfettiRain onDone={handleConfettiDone} />}
        </Card>
      </Animated.View>
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
  const [activationTarget, setActivationTarget] = React.useState<LoyaltyCard | null>(null);
  const [optIn, setOptIn] = React.useState(true);
  const [activating, setActivating] = React.useState(false);
  const [activateError, setActivateError] = React.useState(false);
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
    setOptIn(true); // opt-in PRÉ-COCHÉ (révocable dans la carte ensuite)
    setActivateError(false);
    setActivationTarget(card);
  };

  const handleActivate = async () => {
    if (!user || !activationTarget) return;
    const providerId = activationTarget.providerId;
    setActivating(true);
    setActivateError(false);
    const ok = await postLoyaltyActivation(user, providerId, optIn);
    if (!ok) {
      setActivating(false);
      setActivateError(true);
      return;
    }
    setOverrides((prev) => ({
      ...prev,
      [providerId]: { activated: true, promoEmailsOptIn: optIn },
    }));
    // Re-fetch AVANT la cinématique : `armed` est gated par l'activation,
    // seule la donnée fraîche donne la jauge rétroactive correcte. Le flag
    // `refreshing` évite le passage par les skeletons (la liste reste montée).
    setRefreshing(true);
    await refresh();
    setRefreshing(false);
    setActivating(false);
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

      {/* Feuille d'activation (opt-in emails pré-coché, révocable) */}
      <OverlaySheet
        visible={!!activationTarget}
        onClose={() => !activating && setActivationTarget(null)}
        heightPct={0.62}
      >
        {activationTarget && (
          <ScrollView
            contentContainerStyle={{
              paddingHorizontal: spacing.lg,
              paddingTop: spacing.md,
              paddingBottom: insets.bottom + spacing.lg,
              gap: spacing.md,
            }}
            showsVerticalScrollIndicator={false}
          >
            <View style={styles.sheetIconWrap}>
              <View
                style={[styles.sheetIconCircle, { backgroundColor: colors.primaryLight }]}
              >
                <Ionicons name="ribbon" size={34} color={colors.primary} />
              </View>
            </View>
            <Text variant="h2" style={{ textAlign: 'center' }}>
              {t('clientLoyalty.activation.sheetTitle')}
            </Text>
            <Text variant="body" color="textSecondary" style={{ textAlign: 'center' }}>
              {t('clientLoyalty.activation.sheetDescription', {
                businessName: activationTarget.businessName,
              })}
            </Text>

            <Pressable
              onPress={() => setOptIn((v) => !v)}
              style={({ pressed }) => [
                styles.optInCheckRow,
                {
                  backgroundColor: colors.surfaceSecondary,
                  borderRadius: 12,
                  padding: spacing.md,
                  opacity: pressed ? 0.8 : 1,
                },
              ]}
            >
              <Ionicons
                name={optIn ? 'checkbox' : 'square-outline'}
                size={24}
                color={optIn ? colors.primary : colors.textMuted}
              />
              <View style={{ flex: 1, marginLeft: spacing.sm }}>
                <Text variant="bodySmall">
                  {t('clientLoyalty.activation.optInLabel', {
                    businessName: activationTarget.businessName,
                  })}
                </Text>
                <Text variant="caption" color="textMuted" style={{ marginTop: 2 }}>
                  {t('clientLoyalty.activation.optInHint')}
                </Text>
              </View>
            </Pressable>

            {activateError && (
              <Text variant="caption" style={{ color: colors.error, textAlign: 'center' }}>
                {t('clientLoyalty.activation.error')}
              </Text>
            )}

            <Button
              title={t('clientLoyalty.activation.confirmButton')}
              onPress={() => void handleActivate()}
              loading={activating}
              fullWidth
            />
          </ScrollView>
        )}
      </OverlaySheet>
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
  stampRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  stamp: {
    width: 22,
    height: 22,
    borderRadius: 11,
    justifyContent: 'center',
    alignItems: 'center',
  },
  veiledZone: {
    minHeight: 68,
    justifyContent: 'center',
    paddingHorizontal: 12,
    paddingVertical: 12,
    overflow: 'hidden',
  },
  veilOverlay: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  optInRow: {
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  optInCheckRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  sheetIconWrap: {
    alignItems: 'center',
    marginTop: 4,
  },
  sheetIconCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    justifyContent: 'center',
    alignItems: 'center',
  },
});
