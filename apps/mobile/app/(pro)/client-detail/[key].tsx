/**
 * /pro/client-detail/[key] — fiche client (mobile).
 *
 * Mirrors the web ClientDrawer but as a full-screen route — touch
 * UI prefers a top-level screen with native back over a slide-in
 * panel that competes with the OS's swipe-back gesture.
 *
 * Sections (top to bottom):
 *   - Identity card (avatar lg + name + tags + email + phone)
 *   - KPIs grid + dates + fréquence
 *   - Services préférés (top 3, derived from history)
 *   - Notes privées (TextInput multiline, save with the footer
 *     "Enregistrer" CTA)
 *   - Préférences key/value (add / edit / remove rows inline)
 *   - Marketing placeholder ("en cours de développement")
 *   - Historique des RDV (each row taps into booking-detail)
 *
 * Sticky footer:
 *   - "Nouveau RDV" → opens create-booking pre-filled with
 *     name/email/phone via expo-router params
 *   - "Enregistrer" → patches notes + preferences via the
 *     repository; shown disabled when nothing changed.
 */

import React, { useEffect, useMemo, useState } from 'react';
import {
  View,
  StyleSheet,
  ScrollView,
  Pressable,
  TextInput,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { useTranslation } from 'react-i18next';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../../theme';
import i18n from '../../../lib/i18n';
import { Text, Card, Avatar, Badge, Button, useToast } from '../../../components';
import { useProvider } from '../../../contexts';
import {
  bookingRepository,
  providerClientRepository,
  type WithId,
} from '@booking-app/firebase';
import type {
  Booking,
  BookingStatus,
  ProviderClient,
} from '@booking-app/shared';
import {
  TAG_META_BY_VALUE,
  formatRevenue,
} from '../../../components/business/Clients/tagMeta';

/** BookingStatus (stored value) → camelCase i18n key segment. */
const STATUS_I18N_KEY: Record<BookingStatus, string> = {
  pending: 'pending',
  pending_payment: 'pendingPayment',
  confirmed: 'confirmed',
  cancelled: 'cancelled',
  noshow: 'noshow',
};

const STATUS_COLOR: Record<BookingStatus, string> = {
  pending: '#F59E0B',
  pending_payment: '#F59E0B',
  confirmed: '#10B981',
  cancelled: '#9CA3AF',
  noshow: '#EF4444',
};

export default function ClientDetailScreen() {
  const { t } = useTranslation();
  const { colors, spacing } = useTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { showToast } = useToast();
  const { provider } = useProvider();

  // Expo router URL-decodes the param so values like `email:foo@bar.com`
  // arrive intact.
  const { key: rawKey } = useLocalSearchParams<{ key: string }>();
  const clientKey = typeof rawKey === 'string' ? rawKey : '';

  // Source of truth — the doc itself. Loaded once on mount via the
  // repo's bulk-by-keys path so we get a consistent shape with the
  // list page.
  const [client, setClient] = useState<WithId<ProviderClient> | null>(null);
  const [docLoading, setDocLoading] = useState(true);

  // Bookings — fed by getByClient/getByClientEmail then scoped to
  // this provider. Used for the history list AND derived stats
  // (services préférés).
  const [bookings, setBookings] = useState<WithId<Booking>[]>([]);
  const [historyLoading, setHistoryLoading] = useState(true);

  // Editable state.
  const [notes, setNotes] = useState('');
  const [prefs, setPrefs] = useState<Array<{ key: string; value: string }>>([]);
  const [saving, setSaving] = useState(false);
  // The "saved baseline" used to compute `isDirty`. Has to live in
  // state (not a ref) — useMemo's dep array can't see ref mutations,
  // so a ref-backed baseline left the Save button stuck looking
  // "dirty" even after a successful save. Moving it to state means
  // updating it (after load OR after save) re-runs the memo
  // immediately, and the button switches back to its idle "ghost"
  // appearance.
  const [baseline, setBaseline] = useState<{ notes: string; prefs: string }>({
    notes: '',
    prefs: '[]',
  });

  // ── Load doc + history when the route mounts ───────────────────
  useEffect(() => {
    if (!provider?.id || !clientKey) return;
    let cancelled = false;

    (async () => {
      setDocLoading(true);
      try {
        const map = await providerClientRepository.getByKeys(provider.id, [
          clientKey,
        ]);
        const doc = map.get(clientKey) ?? null;
        if (cancelled) return;
        setClient(doc);
        const initialNotes = doc?.notes ?? '';
        const initialPrefs = doc?.preferences
          ? Object.entries(doc.preferences).map(([k, v]) => ({ key: k, value: v }))
          : [];
        setNotes(initialNotes);
        setPrefs(initialPrefs);
        setBaseline({
          notes: initialNotes,
          prefs: JSON.stringify(initialPrefs),
        });
      } catch (err) {
        console.error('[ClientDetail] load doc:', err);
        if (!cancelled) showToast({ message: i18n.t('proClientDetail.loadError'), variant: 'error' });
      } finally {
        if (!cancelled) setDocLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [provider?.id, clientKey]);

  // Booking history — second effect so the doc shows up first and
  // the history loads in parallel without blocking the avatar/KPIs.
  useEffect(() => {
    if (!provider?.id || !client) return;
    let cancelled = false;

    (async () => {
      setHistoryLoading(true);
      try {
        let raw: WithId<Booking>[] = [];
        if (client.clientId) {
          raw = await bookingRepository.getByClient(client.clientId);
        } else if (client.email) {
          raw = await bookingRepository.getByClientEmail(client.email);
        }
        const scoped = raw.filter((b) => b.providerId === provider.id);
        if (!cancelled) setBookings(scoped);
      } catch (err) {
        console.error('[ClientDetail] load history:', err);
      } finally {
        if (!cancelled) setHistoryLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [provider?.id, client?.id]);

  const isDirty = useMemo(() => {
    return (
      notes !== baseline.notes ||
      JSON.stringify(prefs) !== baseline.prefs
    );
  }, [notes, prefs, baseline]);

  const frequencyLabel = useMemo(
    () => (client ? computeFrequency(client) : null),
    // i18n.language: recompute the human label when the app language changes.
    [client?.confirmedCount, client?.firstBookingAt, client?.lastBookingAt, i18n.language],
  );

  const topServices = useMemo(
    () => computeTopServices(bookings),
    [bookings],
  );

  // ── Save ────────────────────────────────────────────────────────
  const handleSave = async () => {
    if (!isDirty || !client || !provider?.id) return;
    setSaving(true);
    try {
      const prefMap = prefs.reduce<Record<string, string>>((acc, p) => {
        const k = p.key.trim();
        if (k) acc[k] = p.value;
        return acc;
      }, {});
      const trimmedNotes = notes.trim();
      const patch = {
        notes: trimmedNotes ? trimmedNotes : null,
        preferences: Object.keys(prefMap).length > 0 ? prefMap : null,
      };
      await providerClientRepository.updateNotes(
        provider.id,
        client.clientKey,
        patch,
      );
      setClient((c) => (c ? { ...c, ...patch } : c));
      setBaseline({
        notes,
        prefs: JSON.stringify(prefs),
      });
      showToast({ message: t('proClientDetail.saved'), variant: 'success' });
    } catch (err) {
      console.error('[ClientDetail] save:', err);
      showToast({ message: t('proClientDetail.saveError'), variant: 'error' });
    } finally {
      setSaving(false);
    }
  };

  // ── New booking pre-filled ──────────────────────────────────────
  const handleCreateBooking = () => {
    if (!client) return;
    router.push({
      pathname: '/(pro)/create-booking',
      params: {
        clientName: client.name ?? '',
        clientEmail: client.email ?? '',
        clientPhone: client.phone ?? '',
      },
    } as any);
  };

  // ── Render ─────────────────────────────────────────────────────
  if (docLoading) {
    return (
      <View style={[styles.centered, { backgroundColor: colors.background }]}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  if (!client) {
    return (
      <View style={[styles.centered, { backgroundColor: colors.background, paddingHorizontal: spacing.xl }]}>
        <Text variant="body" color="textSecondary" style={{ textAlign: 'center', marginBottom: spacing.md }}>
          {t('proClientDetail.notFound')}
        </Text>
        <Button variant="ghost" onPress={() => router.back()} title={t('common.back')} />
      </View>
    );
  }

  const fullName = client.name || t('proClients.unnamedClient');
  const confirmRate =
    client.bookingsCount > 0
      ? Math.round((client.confirmedCount / client.bookingsCount) * 100)
      : null;
  const noshowRate =
    client.bookingsCount > 0
      ? Math.round((client.noshowCount / client.bookingsCount) * 100)
      : null;

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: colors.background }}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={0}
    >
      {/* Header */}
      <View
        style={[
          styles.header,
          {
            paddingTop: insets.top + spacing.sm,
            paddingHorizontal: spacing.lg,
            paddingBottom: spacing.md,
            borderBottomColor: colors.border,
            backgroundColor: colors.surface,
          },
        ]}
      >
        <View style={styles.headerRow}>
          <Pressable
            onPress={() => router.back()}
            style={({ pressed }) => [styles.backBtn, { opacity: pressed ? 0.6 : 1 }]}
            hitSlop={10}
          >
            <Ionicons name="chevron-back" size={26} color={colors.text} />
          </Pressable>
          <Text variant="h3" style={{ fontWeight: '600' }} numberOfLines={1}>
            {fullName}
          </Text>
          <View style={{ width: 40 }} />
        </View>
      </View>

      <ScrollView
        contentContainerStyle={{
          paddingHorizontal: spacing.lg,
          paddingTop: spacing.md,
          paddingBottom: spacing.xl + 80,
        }}
        keyboardShouldPersistTaps="handled"
        // Auto-scroll the focused TextInput above the keyboard on
        // iOS — without this, tapping into the multiline notes
        // field left it sitting directly behind the keyboard,
        // forcing the user to manually drag the view up. The
        // Android equivalent is `adjustResize` in the manifest,
        // which is already configured globally.
        automaticallyAdjustKeyboardInsets
        // Drag-to-dismiss feels right for a long-form notes field —
        // matches Mail / Notes behaviour on iOS.
        keyboardDismissMode="interactive"
      >
        {/* Identity */}
        <Card padding="md" style={{ marginBottom: spacing.md }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md }}>
            <Avatar imageUrl={client.photoURL} name={fullName} size="lg" />
            <View style={{ flex: 1, minWidth: 0 }}>
              <Text variant="h3" style={{ fontWeight: '700' }} numberOfLines={1}>
                {fullName}
              </Text>
              {client.tags.length > 0 && (
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 6 }}>
                  {client.tags.map((tag) => {
                    const meta = TAG_META_BY_VALUE[tag];
                    return (
                      <Badge
                        key={tag}
                        label={meta.shortLabel}
                        variant={meta.variant}
                        size="sm"
                      />
                    );
                  })}
                </View>
              )}
            </View>
          </View>

          {(client.email || client.phone) && (
            <View style={{ marginTop: spacing.md, gap: 6 }}>
              {client.email && (
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                  <Ionicons name="mail-outline" size={16} color={colors.textMuted} />
                  <Text variant="bodySmall" style={{ color: colors.text, flex: 1 }} numberOfLines={1}>
                    {client.email}
                  </Text>
                </View>
              )}
              {client.phone && (
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                  <Ionicons name="call-outline" size={16} color={colors.textMuted} />
                  <Text variant="bodySmall" style={{ color: colors.text }}>
                    {client.phone}
                  </Text>
                </View>
              )}
            </View>
          )}
        </Card>

        {/* KPIs */}
        <SectionTitle text={t('proClientDetail.overview')} colors={colors} spacing={spacing} />
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: spacing.md }}>
          <KpiCard label={t('proClientDetail.kpi.bookings')} value={client.bookingsCount.toString()} colors={colors} />
          <KpiCard label={t('proClientDetail.kpi.revenue')} value={formatRevenue(client.totalRevenue)} colors={colors} />
          <KpiCard
            label={t('proClientDetail.kpi.confirmation')}
            value={confirmRate != null ? `${confirmRate}%` : '—'}
            colors={colors}
          />
          <KpiCard
            label={t('proClientDetail.kpi.noshow')}
            value={noshowRate != null ? `${noshowRate}%` : '—'}
            colors={colors}
          />
          <KpiCard label={t('proClientDetail.kpi.firstVisit')} value={formatLongDate(client.firstBookingAt)} colors={colors} />
          <KpiCard label={t('proClientDetail.kpi.lastVisit')} value={formatLongDate(client.lastBookingAt)} colors={colors} />
          <KpiCard label={t('proClientDetail.kpi.frequency')} value={frequencyLabel ?? '—'} colors={colors} />
        </View>

        {/* Services préférés */}
        <SectionTitle text={t('proClientDetail.favoriteServices')} colors={colors} spacing={spacing} />
        {historyLoading ? (
          <Text variant="bodySmall" color="textSecondary">
            {t('proClientDetail.computing')}
          </Text>
        ) : topServices.length === 0 ? (
          <Text variant="bodySmall" color="textSecondary">
            {t('proClientDetail.notEnoughData')}
          </Text>
        ) : (
          <View style={{ gap: 8, marginBottom: spacing.md }}>
            {topServices.map((s, i) => (
              <Card key={s.name} padding="md">
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md }}>
                  <View
                    style={{
                      width: 28,
                      height: 28,
                      borderRadius: 6,
                      backgroundColor: colors.primaryLight || '#e4effa',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    {i === 0 ? (
                      <Ionicons name="sparkles" size={14} color={colors.primary} />
                    ) : (
                      <Text variant="caption" style={{ color: colors.primary, fontWeight: '700' }}>
                        {i + 1}
                      </Text>
                    )}
                  </View>
                  <Text variant="body" style={{ flex: 1, fontWeight: '500' }} numberOfLines={1}>
                    {s.name}
                  </Text>
                  <Text variant="bodySmall" color="textSecondary">
                    {t('proClientDetail.timesCount', { count: s.count })}
                  </Text>
                </View>
              </Card>
            ))}
          </View>
        )}

        {/* Notes */}
        <SectionTitle text={t('proClientDetail.privateNotes')} colors={colors} spacing={spacing} />
        <Card padding="md" style={{ marginBottom: spacing.md }}>
          <TextInput
            value={notes}
            onChangeText={setNotes}
            placeholder={t('proClientDetail.notesPlaceholder')}
            placeholderTextColor={colors.textMuted}
            multiline
            style={{
              color: colors.text,
              fontSize: 14,
              minHeight: 80,
              textAlignVertical: 'top',
              paddingVertical: 0,
            }}
          />
          <Text variant="caption" color="textSecondary" style={{ marginTop: 6 }}>
            {t('proClientDetail.notesPrivacy')}
          </Text>
        </Card>

        {/* Preferences */}
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
            marginBottom: spacing.xs,
          }}
        >
          <Text
            variant="label"
            color="textSecondary"
            style={{
              textTransform: 'uppercase',
              letterSpacing: 0.5,
            }}
          >
            {t('proClientDetail.preferences')}
          </Text>
          <Pressable
            onPress={() => setPrefs((p) => [...p, { key: '', value: '' }])}
            style={({ pressed }) => ({
              opacity: pressed ? 0.6 : 1,
              flexDirection: 'row',
              alignItems: 'center',
              gap: 4,
            })}
            hitSlop={6}
          >
            <Ionicons name="add" size={16} color={colors.primary} />
            <Text variant="bodySmall" style={{ color: colors.primary, fontWeight: '600' }}>
              {t('proClientDetail.add')}
            </Text>
          </Pressable>
        </View>
        {prefs.length === 0 ? (
          <Text variant="bodySmall" color="textSecondary" style={{ marginBottom: spacing.md }}>
            {t('proClientDetail.noPreferences')}
          </Text>
        ) : (
          <View style={{ gap: 6, marginBottom: spacing.md }}>
            {prefs.map((p, i) => (
              <View key={i} style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                <TextInput
                  value={p.key}
                  onChangeText={(v) =>
                    setPrefs((arr) => {
                      const next = [...arr];
                      next[i] = { ...next[i], key: v };
                      return next;
                    })
                  }
                  placeholder={t('proClientDetail.prefKeyPlaceholder')}
                  placeholderTextColor={colors.textMuted}
                  style={[
                    styles.prefInput,
                    { borderColor: colors.border, color: colors.text, flex: 1 },
                  ]}
                />
                <TextInput
                  value={p.value}
                  onChangeText={(v) =>
                    setPrefs((arr) => {
                      const next = [...arr];
                      next[i] = { ...next[i], value: v };
                      return next;
                    })
                  }
                  placeholder={t('proClientDetail.prefValuePlaceholder')}
                  placeholderTextColor={colors.textMuted}
                  style={[
                    styles.prefInput,
                    { borderColor: colors.border, color: colors.text, flex: 2 },
                  ]}
                />
                <Pressable
                  onPress={() =>
                    setPrefs((arr) => arr.filter((_, idx) => idx !== i))
                  }
                  hitSlop={8}
                  style={({ pressed }) => ({
                    padding: 6,
                    opacity: pressed ? 0.5 : 1,
                  })}
                >
                  <Ionicons name="trash-outline" size={18} color={colors.textMuted} />
                </Pressable>
              </View>
            ))}
          </View>
        )}

        {/* Marketing placeholder */}
        <Card
          padding="md"
          style={{
            marginBottom: spacing.md,
            borderStyle: 'dashed',
            borderWidth: 1,
            borderColor: colors.border,
          }}
        >
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
            <Ionicons name="megaphone-outline" size={20} color={colors.textMuted} />
            <View style={{ flex: 1 }}>
              <Text variant="bodySmall" style={{ fontWeight: '600' }}>
                {t('proClientDetail.marketingTitle')}
              </Text>
              <Text variant="caption" color="textSecondary">
                {t('proClientDetail.marketingSoon')}
              </Text>
            </View>
          </View>
        </Card>

        {/* History */}
        <SectionTitle text={t('proClientDetail.historyTitle')} colors={colors} spacing={spacing} />
        {historyLoading ? (
          <Text variant="bodySmall" color="textSecondary">
            {t('common.loading')}
          </Text>
        ) : bookings.length === 0 ? (
          <Text variant="bodySmall" color="textSecondary">
            {t('proClientDetail.historyEmpty')}
          </Text>
        ) : (
          <View style={{ gap: 8 }}>
            {bookings.map((b) => (
              <Pressable
                key={b.id}
                onPress={() =>
                  router.push({
                    pathname: '/(pro)/booking-detail/[id]',
                    params: { id: b.id },
                  } as any)
                }
              >
                {({ pressed }) => (
                  <Card padding="md" style={{ opacity: pressed ? 0.85 : 1 }}>
                    <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm }}>
                      <Ionicons name="calendar-outline" size={16} color={colors.textMuted} style={{ marginTop: 2 }} />
                      <View style={{ flex: 1, minWidth: 0 }}>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                          <Text variant="bodySmall" style={{ fontWeight: '600' }} numberOfLines={1}>
                            {b.serviceName}
                          </Text>
                          <Text
                            variant="caption"
                            style={{ color: STATUS_COLOR[b.status] }}
                          >
                            · {t(`proClientDetail.status.${STATUS_I18N_KEY[b.status]}`)}
                          </Text>
                        </View>
                        <Text variant="caption" color="textSecondary">
                          {formatBookingDate(b.datetime)}
                          {b.memberName ? ` · ${b.memberName}` : ''}
                        </Text>
                      </View>
                      <Text variant="bodySmall" style={{ fontWeight: '600' }}>
                        {b.price > 0 ? formatRevenue(b.price) : '—'}
                      </Text>
                    </View>
                  </Card>
                )}
              </Pressable>
            ))}
          </View>
        )}
      </ScrollView>

      {/* Sticky footer */}
      <View
        style={{
          paddingHorizontal: spacing.lg,
          paddingTop: spacing.sm,
          paddingBottom: insets.bottom + spacing.sm,
          backgroundColor: colors.surface,
          borderTopWidth: 1,
          borderTopColor: colors.border,
          flexDirection: 'row',
          gap: spacing.sm,
        }}
      >
        <Button
          variant="primary"
          onPress={handleCreateBooking}
          title={t('proClientDetail.newBooking')}
          style={{ flex: 1 }}
        />
        <Button
          variant={isDirty ? 'primary' : 'ghost'}
          onPress={handleSave}
          disabled={!isDirty || saving}
          title={saving ? '…' : t('common.save')}
          style={{ flex: 1 }}
        />
      </View>
    </KeyboardAvoidingView>
  );
}

// ─── Sub-components ──────────────────────────────────────────────

function SectionTitle({
  text,
  colors,
  spacing,
}: {
  text: string;
  colors: any;
  spacing: any;
}) {
  return (
    <Text
      variant="label"
      color="textSecondary"
      style={{
        textTransform: 'uppercase',
        letterSpacing: 0.5,
        marginBottom: spacing.xs,
      }}
    >
      {text}
    </Text>
  );
}

function KpiCard({
  label,
  value,
  colors,
}: {
  label: string;
  value: string;
  colors: any;
}) {
  return (
    <View
      style={{
        flexBasis: '48%',
        flexGrow: 1,
        borderWidth: 1,
        borderColor: colors.border,
        borderRadius: 10,
        backgroundColor: colors.surface,
        paddingVertical: 10,
        paddingHorizontal: 12,
      }}
    >
      <Text
        variant="caption"
        color="textSecondary"
        style={{
          textTransform: 'uppercase',
          letterSpacing: 0.4,
          fontSize: 10,
        }}
      >
        {label}
      </Text>
      <Text variant="body" style={{ fontWeight: '700', marginTop: 2 }}>
        {value}
      </Text>
    </View>
  );
}

// ─── Helpers ──────────────────────────────────────────────────────

function formatLongDate(d: Date | null): string {
  if (!d || d.getTime() === 0) return '—';
  return d.toLocaleDateString(i18n.language, {
    day: 'numeric',
    month: 'short',
    year: '2-digit',
  });
}

function formatBookingDate(d: Date): string {
  return (
    d.toLocaleDateString(i18n.language, {
      weekday: 'short',
      day: 'numeric',
      month: 'short',
    }) +
    ' · ' +
    d.toLocaleTimeString(i18n.language, { hour: '2-digit', minute: '2-digit' })
  );
}

/**
 * Average gap between two confirmed visits, in human terms.
 * Returns null when we don't have enough data — same logic as the
 * web ClientDrawer so the two surfaces agree.
 */
function computeFrequency(client: ProviderClient): string | null {
  if (
    client.confirmedCount < 2 ||
    !client.firstBookingAt ||
    !client.lastBookingAt
  ) {
    return null;
  }
  const spanMs =
    client.lastBookingAt.getTime() - client.firstBookingAt.getTime();
  if (spanMs <= 0) return null;
  const avgDays = Math.round(
    spanMs / (1000 * 60 * 60 * 24) / (client.confirmedCount - 1),
  );
  if (avgDays < 7) return i18n.t('proClientDetail.frequency.days', { count: avgDays });
  if (avgDays < 60) {
    return i18n.t('proClientDetail.frequency.weeks', { count: Math.round(avgDays / 7) });
  }
  if (avgDays < 720) {
    return i18n.t('proClientDetail.frequency.months', { count: Math.round(avgDays / 30) });
  }
  return i18n.t('proClientDetail.frequency.years', { count: Math.round(avgDays / 365) });
}

function computeTopServices(
  bookings: WithId<Booking>[],
): Array<{ name: string; count: number }> {
  const counts = new Map<string, number>();
  for (const b of bookings) {
    if (b.status === 'cancelled') continue;
    const name = (b.serviceName || '').trim();
    if (!name) continue;
    counts.set(name, (counts.get(name) ?? 0) + 1);
  }
  return [...counts.entries()]
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 3);
}

const styles = StyleSheet.create({
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  header: {
    borderBottomWidth: 1,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  backBtn: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  prefInput: {
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 8,
    fontSize: 14,
  },
});
