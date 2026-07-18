/**
 * Loyalty Screen (client)
 * « Mes cartes de fidélité » — une carte à tampons par prestataire chez qui
 * le client a un historique ET dont la carte de fidélité est active.
 * Données : GET /api/loyalty/me (payload sanitisé, voir useLoyaltyCards).
 */

import React from 'react';
import { useTranslation } from 'react-i18next';
import {
  View,
  ScrollView,
  StyleSheet,
  Pressable,
  RefreshControl,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../theme';
import { Text, Card, Avatar, EmptyState, Skeleton } from '../../components';
import { useAuth } from '../../contexts';
import {
  useLoyaltyCards,
  formatLoyaltyReward,
  type LoyaltyCard,
} from '../../hooks/useLoyaltyCards';

/** Rangée de tampons : `filled` cercles remplis sur `threshold`. */
function StampRow({ filled, threshold }: { filled: number; threshold: number }) {
  const { colors } = useTheme();
  return (
    <View style={styles.stampRow}>
      {Array.from({ length: threshold }, (_, i) => {
        const isFilled = i < filled;
        return (
          <View
            key={i}
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
      })}
    </View>
  );
}

function LoyaltyCardItem({ card }: { card: LoyaltyCard }) {
  const { colors, spacing } = useTheme();
  const router = useRouter();
  const { t } = useTranslation();

  const reward = formatLoyaltyReward(card.rewardType, card.rewardValue, t);
  // Progression sur le cycle courant ; carte armée = tous les tampons posés.
  const filled = card.armed ? card.threshold : card.confirmedCount % card.threshold;

  const openProvider = card.slug
    ? () => router.push(`/(client)/provider/${card.slug}` as any)
    : undefined;

  return (
    <Pressable
      onPress={openProvider}
      disabled={!openProvider}
      style={({ pressed }) => [pressed && openProvider ? { opacity: 0.85 } : null]}
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
            {card.armed ? (
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

        <View style={{ marginTop: spacing.md }}>
          <StampRow filled={filled} threshold={card.threshold} />
        </View>
      </Card>
    </Pressable>
  );
}

export default function LoyaltyScreen() {
  const { colors, spacing } = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { t } = useTranslation();
  const { isAuthenticated } = useAuth();
  const { cards, loading, error, refresh } = useLoyaltyCards(isAuthenticated);
  const [refreshing, setRefreshing] = React.useState(false);

  const handleRefresh = async () => {
    setRefreshing(true);
    await refresh();
    setRefreshing(false);
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {/* Header */}
      <View
        style={[
          styles.header,
          { paddingTop: insets.top + spacing.sm, paddingHorizontal: spacing.md },
        ]}
      >
        <Pressable
          onPress={() => router.back()}
          style={({ pressed }) => [styles.backButton, { opacity: pressed ? 0.7 : 1 }]}
        >
          <Ionicons name="chevron-back" size={24} color={colors.text} />
        </Pressable>
        <Text variant="h2" style={styles.headerTitle}>
          {t('loyalty.title')}
        </Text>
        <View style={styles.headerSpacer} />
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
          {cards.map((card) => (
            <LoyaltyCardItem key={card.providerId} card={card} />
          ))}
        </ScrollView>
      )}
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
});
