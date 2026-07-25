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
import i18n, { getIntlLocale } from '../../../lib/i18n';
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
  hasLoyaltyAccess,
  isLoyaltyConfigValid,
  isLoyaltyRewardArmed,
  loyaltyRemaining,
  formatPrice,
  effectiveLoyaltyCount,
  LOYALTY_ADJUSTMENT_REASONS,
  type LoyaltyAdjustmentReason,
} from '@booking-app/shared';
import { OverlaySheet } from '../../../components/OverlaySheet';
import { useAuth } from '../../../contexts';
import { API_URL } from '../../../lib/config';
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

  // Fidélité v2 — ajustement manuel de points.
  const [adjustOpen, setAdjustOpen] = useState(false);
  const [adjustLogOpen, setAdjustLogOpen] = useState(false);

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

        {/* Loyalty progression — only when the pro has access AND a valid,
            enabled loyalty config. Derived from confirmedCount, same pure
            helpers as the server-side reward application. */}
        {(() => {
          const loyalty = provider?.settings?.loyalty;
          if (!hasLoyaltyAccess(provider) || !isLoyaltyConfigValid(loyalty)) return null;
          // Compteur EFFECTIF (fidélité v2) : RDV honorés connectés
          // post-lancement + ajustement manuel du pro, plancher 0 —
          // même formule que le serveur au moment d'armer la récompense.
          const adjustment = client.loyaltyAdjustment ?? 0;
          const loyaltyCount = effectiveLoyaltyCount(
            client.loyaltyConfirmedCount ?? 0,
            adjustment,
          );
          const armed = isLoyaltyRewardArmed(loyaltyCount, loyalty.threshold);
          const remaining = loyaltyRemaining(loyaltyCount, loyalty.threshold);
          const rewardLabel =
            loyalty.rewardType === 'percent'
              ? t('proLoyalty.progress.rewardPercent', {
                  percent: loyalty.rewardValue,
                  threshold: loyalty.threshold,
                })
              : t('proLoyalty.progress.rewardAmount', {
                  amount: formatPrice(loyalty.rewardValue, 'EUR', getIntlLocale(i18n.language)),
                  threshold: loyalty.threshold,
                });
          const log = client.loyaltyAdjustmentLog ?? [];
          return (
            <Card padding="md" style={{ marginBottom: spacing.md }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md }}>
                <View
                  style={{
                    width: 32,
                    height: 32,
                    borderRadius: 8,
                    backgroundColor: armed ? 'rgba(16,185,129,0.12)' : colors.primaryLight || '#e4effa',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <Ionicons
                    name={armed ? 'gift' : 'gift-outline'}
                    size={16}
                    color={armed ? '#10B981' : colors.primary}
                  />
                </View>
                <View style={{ flex: 1, minWidth: 0 }}>
                  <Text variant="bodySmall" style={{ fontWeight: '600' }}>
                    {armed
                      ? t('proLoyalty.progress.armed')
                      : t('proLoyalty.progress.next', { count: remaining })}
                  </Text>
                  <Text variant="caption" color="textSecondary">
                    {rewardLabel}
                  </Text>
                  {adjustment !== 0 && (
                    <Text variant="caption" color="textSecondary">
                      {t('proLoyaltyAdjust.manualDelta', {
                        delta: formatSignedDelta(adjustment),
                      })}
                    </Text>
                  )}
                </View>
              </View>

              {/* Ajuster les points */}
              <Pressable
                onPress={() => setAdjustOpen(true)}
                style={({ pressed }) => ({
                  marginTop: spacing.sm,
                  flexDirection: 'row',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 6,
                  paddingVertical: 8,
                  borderRadius: 8,
                  borderWidth: 1,
                  borderColor: colors.border,
                  opacity: pressed ? 0.6 : 1,
                })}
                hitSlop={4}
              >
                <Ionicons name="options-outline" size={15} color={colors.primary} />
                <Text variant="bodySmall" style={{ color: colors.primary, fontWeight: '600' }}>
                  {t('proLoyaltyAdjust.button')}
                </Text>
              </Pressable>

              {/* Historique des ajustements — dépliable */}
              {log.length > 0 && (
                <View style={{ marginTop: spacing.sm }}>
                  <Pressable
                    onPress={() => setAdjustLogOpen((v) => !v)}
                    style={({ pressed }) => ({
                      flexDirection: 'row',
                      alignItems: 'center',
                      gap: 4,
                      opacity: pressed ? 0.6 : 1,
                    })}
                    hitSlop={6}
                  >
                    <Ionicons
                      name={adjustLogOpen ? 'chevron-down' : 'chevron-forward'}
                      size={14}
                      color={colors.textMuted}
                    />
                    <Text variant="caption" color="textSecondary" style={{ fontWeight: '600' }}>
                      {t('proLoyaltyAdjust.historyTitle')} ({log.length})
                    </Text>
                  </Pressable>
                  {adjustLogOpen && (
                    <View style={{ marginTop: 6, gap: 6 }}>
                      {log.map((entry, idx) => (
                        <View
                          key={idx}
                          style={{
                            flexDirection: 'row',
                            alignItems: 'flex-start',
                            gap: 8,
                            paddingLeft: 18,
                          }}
                        >
                          <Text
                            variant="caption"
                            style={{
                              fontWeight: '700',
                              minWidth: 28,
                              color: entry.delta > 0 ? '#10B981' : '#EF4444',
                            }}
                          >
                            {formatSignedDelta(entry.delta)}
                          </Text>
                          <View style={{ flex: 1, minWidth: 0 }}>
                            <Text variant="caption" color="textSecondary">
                              {formatLongDate(entry.at)} · {adjustReasonLabel(entry.reason)}
                            </Text>
                            {entry.note ? (
                              <Text variant="caption" color="textSecondary" numberOfLines={2}>
                                « {entry.note} »
                              </Text>
                            ) : null}
                          </View>
                        </View>
                      ))}
                    </View>
                  )}
                </View>
              )}
            </Card>
          );
        })()}

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
                      <Ionicons name="trophy" size={14} color={colors.primary} />
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

      {/* Bottom sheet — ajustement manuel de points (fidélité v2) */}
      <AdjustPointsSheet
        visible={adjustOpen}
        clientKey={client.clientKey}
        onClose={() => setAdjustOpen(false)}
        onSuccess={({ delta, reason, note, adjustment }) => {
          setAdjustOpen(false);
          // Mise à jour locale : nouveau delta cumulé + entrée en tête du
          // journal — même forme que ce que le serveur vient d'écrire.
          setClient((c) =>
            c
              ? {
                  ...c,
                  loyaltyAdjustment: adjustment,
                  loyaltyAdjustmentLog: [
                    { at: new Date(), delta, reason, note },
                    ...(c.loyaltyAdjustmentLog ?? []),
                  ],
                }
              : c,
          );
          showToast({ message: t('proLoyaltyAdjust.success'), variant: 'success' });
        }}
      />
    </KeyboardAvoidingView>
  );
}

// ─── Sub-components ──────────────────────────────────────────────

/** « +2 » / « −3 » — signe explicite, tiret typographique. */
function formatSignedDelta(delta: number): string {
  return delta > 0 ? `+${delta}` : `−${Math.abs(delta)}`;
}

/** Label traduit d'un slug de justification (fallback : « Autre »). */
function adjustReasonLabel(reason: string): string {
  const known = (LOYALTY_ADJUSTMENT_REASONS as readonly string[]).includes(reason)
    ? reason
    : 'autre';
  return i18n.t(`proLoyaltyAdjust.reasons.${known}`);
}

const ADJUST_DELTA_MIN = -50;
const ADJUST_DELTA_MAX = 50;

/**
 * Bottom sheet d'ajustement manuel de points (fidélité v2).
 *
 * Stepper −/+ (borné −50..50, saute le 0 — un delta nul est refusé par
 * l'API), 6 justifications (slugs stockés, labels traduits), note libre
 * OBLIGATOIRE pour « autre », optionnelle sinon. POST /api/loyalty/adjust
 * avec le Bearer token du pro — le serveur journalise ET prévient le
 * client par email ; ici on ne fait que remonter le résultat au parent.
 */
function AdjustPointsSheet({
  visible,
  clientKey,
  onClose,
  onSuccess,
}: {
  visible: boolean;
  clientKey: string;
  onClose: () => void;
  onSuccess: (r: {
    delta: number;
    reason: LoyaltyAdjustmentReason;
    note: string | null;
    adjustment: number;
  }) => void;
}) {
  const { t } = useTranslation();
  const { colors, spacing } = useTheme();
  const insets = useSafeAreaInsets();
  const { showToast } = useToast();
  const { user } = useAuth();

  const [delta, setDelta] = useState(1);
  const [reason, setReason] = useState<LoyaltyAdjustmentReason>('geste_commercial');
  const [note, setNote] = useState('');
  const [noteError, setNoteError] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // Reset à chaque ouverture — le sheet reste monté pendant l'animation
  // de sortie, on ne peut donc pas compter sur un remontage.
  useEffect(() => {
    if (visible) {
      setDelta(1);
      setReason('geste_commercial');
      setNote('');
      setNoteError(false);
      setSubmitting(false);
    }
  }, [visible]);

  /** Incrémente/décrémente en sautant 0 (delta nul interdit). */
  const step = (dir: 1 | -1) => {
    setDelta((d) => {
      let next = d + dir;
      if (next === 0) next = dir; // 1 → −1 et −1 → 1 sans passer par 0
      return Math.max(ADJUST_DELTA_MIN, Math.min(ADJUST_DELTA_MAX, next));
    });
  };

  const noteRequired = reason === 'autre';
  const trimmedNote = note.trim();
  const canSubmit =
    !submitting && delta !== 0 && (!noteRequired || trimmedNote.length > 0);

  const handleSubmit = async () => {
    if (noteRequired && !trimmedNote) {
      setNoteError(true);
      return;
    }
    if (!canSubmit || !user) return;
    setSubmitting(true);
    try {
      const token = await user.getIdToken();
      // Timeout dur — même pattern que useLoyaltyCards : un serveur
      // injoignable ne doit jamais bloquer le sheet en « … » infini.
      const ctrl = new AbortController();
      const timer = setTimeout(() => ctrl.abort(), 8000);
      const res = await fetch(`${API_URL}/api/loyalty/adjust`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          clientKey,
          delta,
          reason,
          note: trimmedNote ? trimmedNote : null,
        }),
        signal: ctrl.signal,
      }).finally(() => clearTimeout(timer));
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = (await res.json()) as { adjustment?: number };
      onSuccess({
        delta,
        reason,
        note: trimmedNote ? trimmedNote : null,
        adjustment: typeof data.adjustment === 'number' ? data.adjustment : delta,
      });
    } catch (err) {
      console.error('[AdjustPointsSheet] submit:', err);
      showToast({ message: t('proLoyaltyAdjust.error'), variant: 'error' });
      setSubmitting(false);
    }
  };

  return (
    <OverlaySheet visible={visible} onClose={onClose} heightPct={0.85}>
      <ScrollView
        contentContainerStyle={{
          paddingHorizontal: spacing.lg,
          paddingBottom: insets.bottom + spacing.xl,
        }}
        keyboardShouldPersistTaps="handled"
        automaticallyAdjustKeyboardInsets
      >
        <Text variant="h3" style={{ fontWeight: '700', marginBottom: 4 }}>
          {t('proLoyaltyAdjust.title')}
        </Text>
        <Text variant="bodySmall" color="textSecondary" style={{ marginBottom: spacing.lg }}>
          {t('proLoyaltyAdjust.subtitle')}
        </Text>

        {/* Stepper delta */}
        <Text
          variant="label"
          color="textSecondary"
          style={{ textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: spacing.xs }}
        >
          {t('proLoyaltyAdjust.deltaLabel')}
        </Text>
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'center',
            gap: spacing.lg,
            marginBottom: spacing.lg,
          }}
        >
          <Pressable
            onPress={() => step(-1)}
            disabled={delta <= ADJUST_DELTA_MIN}
            style={({ pressed }) => [
              styles.stepBtn,
              {
                borderColor: colors.border,
                backgroundColor: colors.surface,
                opacity: delta <= ADJUST_DELTA_MIN ? 0.35 : pressed ? 0.6 : 1,
              },
            ]}
            hitSlop={6}
          >
            <Ionicons name="remove" size={22} color={colors.text} />
          </Pressable>
          <Text
            variant="h2"
            style={{
              fontWeight: '700',
              minWidth: 84,
              textAlign: 'center',
              color: delta > 0 ? '#10B981' : '#EF4444',
            }}
          >
            {formatSignedDelta(delta)}
          </Text>
          <Pressable
            onPress={() => step(1)}
            disabled={delta >= ADJUST_DELTA_MAX}
            style={({ pressed }) => [
              styles.stepBtn,
              {
                borderColor: colors.border,
                backgroundColor: colors.surface,
                opacity: delta >= ADJUST_DELTA_MAX ? 0.35 : pressed ? 0.6 : 1,
              },
            ]}
            hitSlop={6}
          >
            <Ionicons name="add" size={22} color={colors.text} />
          </Pressable>
        </View>

        {/* Justification */}
        <Text
          variant="label"
          color="textSecondary"
          style={{ textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: spacing.xs }}
        >
          {t('proLoyaltyAdjust.reasonLabel')}
        </Text>
        <View style={{ gap: 6, marginBottom: spacing.lg }}>
          {LOYALTY_ADJUSTMENT_REASONS.map((slug) => {
            const selected = reason === slug;
            return (
              <Pressable
                key={slug}
                onPress={() => {
                  setReason(slug);
                  setNoteError(false);
                }}
                style={({ pressed }) => ({
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: 10,
                  paddingVertical: 10,
                  paddingHorizontal: 12,
                  borderRadius: 10,
                  borderWidth: 1,
                  borderColor: selected ? colors.primary : colors.border,
                  backgroundColor: selected
                    ? colors.primaryLight || '#e4effa'
                    : colors.surface,
                  opacity: pressed ? 0.7 : 1,
                })}
              >
                <Ionicons
                  name={selected ? 'radio-button-on' : 'radio-button-off'}
                  size={18}
                  color={selected ? colors.primary : colors.textMuted}
                />
                <Text
                  variant="bodySmall"
                  style={{ flex: 1, fontWeight: selected ? '600' : '400' }}
                >
                  {t(`proLoyaltyAdjust.reasons.${slug}`)}
                </Text>
              </Pressable>
            );
          })}
        </View>

        {/* Note — obligatoire pour « autre », optionnelle sinon */}
        <Text
          variant="label"
          color="textSecondary"
          style={{ textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: spacing.xs }}
        >
          {noteRequired
            ? t('proLoyaltyAdjust.noteLabelRequired')
            : t('proLoyaltyAdjust.noteLabelOptional')}
        </Text>
        <TextInput
          value={note}
          onChangeText={(v) => {
            setNote(v);
            if (noteError && v.trim()) setNoteError(false);
          }}
          placeholder={
            noteRequired
              ? t('proLoyaltyAdjust.noteRequiredPlaceholder')
              : t('proLoyaltyAdjust.notePlaceholder')
          }
          placeholderTextColor={colors.textMuted}
          multiline
          maxLength={200}
          style={{
            borderWidth: 1,
            borderColor: noteError ? '#EF4444' : colors.border,
            borderRadius: 10,
            paddingHorizontal: 12,
            paddingVertical: 10,
            minHeight: 64,
            textAlignVertical: 'top',
            color: colors.text,
            fontSize: 14,
            backgroundColor: colors.surface,
          }}
        />
        {noteError && (
          <Text variant="caption" style={{ color: '#EF4444', marginTop: 4 }}>
            {t('proLoyaltyAdjust.noteRequiredError')}
          </Text>
        )}

        <Button
          variant="primary"
          onPress={handleSubmit}
          disabled={!canSubmit}
          title={submitting ? '…' : t('proLoyaltyAdjust.submit')}
          style={{ marginTop: spacing.lg }}
        />
        <Button
          variant="ghost"
          onPress={onClose}
          disabled={submitting}
          title={t('common.cancel')}
          style={{ marginTop: spacing.xs }}
        />
      </ScrollView>
    </OverlaySheet>
  );
}

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
  stepBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
