import React from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';
import { Card, Text } from '../../components';
import { useTheme } from '../../theme';
import { formatPrice } from '@booking-app/shared';

/** Compact client entry — initial avatar + name + RDV count + CA. */
interface ClientEntry {
  clientHash: string;
  bookingsCount: number;
  revenue: number;
  /** Resolved from providerClients before passing in. */
  name?: string;
}

export function TopClientsPanel({ data }: { data: ClientEntry[] }) {
  const { t } = useTranslation();
  const { colors, spacing, radius } = useTheme();
  return (
    <Card padding="lg" shadow="sm" style={{ marginBottom: spacing.xl }}>
      <View style={{ marginBottom: spacing.md }}>
        <Text variant="h3">{t('proStats.topClients.title')}</Text>
        <Text variant="caption" color="textMuted" style={{ marginTop: 2 }}>
          {t('proStats.topClients.subtitle')}
        </Text>
      </View>
      {data.length === 0 ? (
        <Text variant="caption" color="textMuted">
          {t('proStats.topClients.empty')}
        </Text>
      ) : (
        data.slice(0, 5).map((c, i) => {
          const display = c.name ?? maskHash(c.clientHash);
          const initial = display.charAt(0).toUpperCase();
          return (
            <View
              key={c.clientHash}
              style={[
                s.row,
                {
                  paddingVertical: spacing.sm,
                  borderBottomColor: colors.border,
                  borderBottomWidth: i === Math.min(data.length, 5) - 1 ? 0 : StyleSheet.hairlineWidth,
                },
              ]}
            >
              <Text variant="caption" color="textMuted" style={{ width: 14, fontVariant: ['tabular-nums'] }}>
                {i + 1}
              </Text>
              <View
                style={[
                  s.avatar,
                  { backgroundColor: colors.primaryLight, borderRadius: radius.full },
                ]}
              >
                <Text variant="body" style={{ fontWeight: '700', color: colors.primary }}>
                  {initial}
                </Text>
              </View>
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text variant="body" style={{ fontWeight: '600' }} numberOfLines={1}>
                  {display}
                </Text>
                <Text variant="caption" color="textMuted" style={{ fontSize: 11 }}>
                  {t('proStats.bookingsCount', { count: c.bookingsCount })}
                </Text>
              </View>
              <Text variant="body" style={{ fontWeight: '700' }}>
                {formatPrice(c.revenue)}
              </Text>
            </View>
          );
        })
      )}
    </Card>
  );
}

/** Mask a `email:foo@bar.com` hash when no provider client doc was
 *  found yet (e.g. cron hasn't ticked between booking + display). */
function maskHash(hash: string): string {
  if (hash.startsWith('email:')) {
    const [user, domain] = hash.slice(6).split('@');
    if (!user || !domain) return hash.slice(6);
    return `${user[0]}***@${domain}`;
  }
  return hash;
}

const s = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  avatar: {
    width: 34,
    height: 34,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
