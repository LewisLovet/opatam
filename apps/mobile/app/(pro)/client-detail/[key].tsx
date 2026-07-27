/**
 * /pro/client-detail/[key] — fiche client (mobile).
 *
 * Mirrors the web ClientDrawer but as a full-screen route — touch
 * UI prefers a top-level screen with native back over a slide-in
 * panel that competes with the OS's swipe-back gesture.
 *
 * Refonte 2026-07 — la fiche doit se lire en 3 secondes : QUI est ce
 * client, COMBIEN il vaut, OÙ il en est de sa fidélité, QUAND il
 * revient. D'où la hiérarchie :
 *
 *   1. Héro identitaire (avatar xl, nom, tags, actions appel/SMS/email)
 *   2. 4 tuiles de chiffres clés (honorés · CA · ratés · dernière venue)
 *   3. Détails secondaires en lignes discrètes (1ʳᵉ visite, fréquence…)
 *   4. Fidélité — pièce maîtresse : carte à tampons + ajustement manuel
 *   5. Services préférés / Notes privées / Préférences / Marketing
 *   6. Sections repliables : historique des RDV, historique des
 *      ajustements (le pro déplie ce qu'il cherche)
 *
 * Sticky footer :
 *   - « Nouveau RDV » → create-booking pré-rempli (name/email/phone)
 *   - « Enregistrer » → patch notes + préférences via le repository ;
 *     désactivé tant que rien n'a changé.
 */

import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  View,
  StyleSheet,
  ScrollView,
  Pressable,
  TextInput,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Animated,
  Linking,
} from 'react-native';
import { useTranslation } from 'react-i18next';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
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

/**
 * Statut → clé de couleur du thème (jamais de hex en dur : le mode
 * sombre et le configurateur de thème doivent pouvoir tout repeindre).
 */
const STATUS_COLOR_KEY: Record<BookingStatus, 'warning' | 'success' | 'textMuted' | 'error'> = {
  pending: 'warning',
  pending_payment: 'warning',
  confirmed: 'success',
  cancelled: 'textMuted',
  noshow: 'error',
};

export default function ClientDetailScreen() {
  const { t } = useTranslation();
  const { colors, spacing, radius } = useTheme();
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
  // Sections repliables — l'historique des RDV est fermé par défaut :
  // c'est la section la plus longue et la moins consultée au premier
  // coup d'œil.
  const [historyOpen, setHistoryOpen] = useState(false);

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

  /**
   * Vue fidélité — calculée une seule fois pour la section ET pour la
   * feuille d'ajustement (qui a besoin du seuil et du compte effectif
   * pour dessiner la carte à tampons). `null` = pas d'accès fidélité
   * ou config invalide → aucune UI fidélité.
   */
  const loyaltyView = useMemo(() => {
    const loyalty = provider?.settings?.loyalty;
    if (!client) return null;
    if (!hasLoyaltyAccess(provider) || !isLoyaltyConfigValid(loyalty)) return null;
    // Compteur EFFECTIF (fidélité v2) : RDV honorés connectés
    // post-lancement + ajustement manuel du pro, plancher 0 —
    // même formule que le serveur au moment d'armer la récompense.
    const adjustment = client.loyaltyAdjustment ?? 0;
    const count = effectiveLoyaltyCount(client.loyaltyConfirmedCount ?? 0, adjustment);
    return {
      threshold: loyalty.threshold,
      rewardType: loyalty.rewardType,
      rewardValue: loyalty.rewardValue,
      adjustment,
      count,
      armed: isLoyaltyRewardArmed(count, loyalty.threshold),
      remaining: loyaltyRemaining(count, loyalty.threshold),
      log: client.loyaltyAdjustmentLog ?? [],
    };
  }, [
    provider,
    client?.loyaltyAdjustment,
    client?.loyaltyConfirmedCount,
    client?.loyaltyAdjustmentLog,
  ]);

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

  /** tel: / sms: / mailto: — toast d'erreur si l'appareil ne sait pas ouvrir. */
  const openContact = (url: string) => {
    Linking.openURL(url).catch(() => {
      showToast({ message: t('proClientDetail.contact.error'), variant: 'error' });
    });
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
  const missedCount = client.cancelledCount + client.noshowCount;

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
          <Text variant="h3" style={{ flex: 1, fontWeight: '600' }} numberOfLines={1}>
            {fullName}
          </Text>
          <View style={{ width: 40 }} />
        </View>
      </View>

      <ScrollView
        contentContainerStyle={{
          paddingHorizontal: spacing.lg,
          paddingTop: spacing.lg,
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
        {/* ── 1. Héro identitaire ─────────────────────────────── */}
        <View
          style={{
            backgroundColor: colors.primaryLight,
            borderRadius: radius.xl,
            padding: spacing.lg,
          }}
        >
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md }}>
            <Avatar imageUrl={client.photoURL} name={fullName} size="lg" />
            <View style={{ flex: 1, minWidth: 0 }}>
              <Text variant="h2" style={{ fontWeight: '700' }} numberOfLines={2}>
                {fullName}
              </Text>
              {client.tags.length > 0 && (
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: spacing.sm }}>
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
            <View style={{ marginTop: spacing.md, gap: 4 }}>
              {client.email && (
                <Text variant="caption" color="textSecondary" numberOfLines={1}>
                  {client.email}
                </Text>
              )}
              {client.phone && (
                <Text variant="caption" color="textSecondary">
                  {client.phone}
                </Text>
              )}
            </View>
          )}

          {/* Actions de contact — appel / SMS / email */}
          {(client.email || client.phone) && (
            <View style={{ flexDirection: 'row', gap: spacing.sm, marginTop: spacing.md }}>
              {client.phone && (
                <ContactAction
                  icon="call-outline"
                  label={t('proClientDetail.contact.call')}
                  onPress={() => openContact(`tel:${client.phone}`)}
                />
              )}
              {client.phone && (
                <ContactAction
                  icon="chatbubble-outline"
                  label={t('proClientDetail.contact.sms')}
                  onPress={() => openContact(`sms:${client.phone}`)}
                />
              )}
              {client.email && (
                <ContactAction
                  icon="mail-outline"
                  label={t('proClientDetail.contact.email')}
                  onPress={() => openContact(`mailto:${client.email}`)}
                />
              )}
            </View>
          )}
        </View>

        {/* ── 2. Chiffres clés (grille 2×2) ───────────────────── */}
        <SectionTitle text={t('proClientDetail.overview')} />
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm }}>
          <StatTile
            icon="checkmark-circle"
            tint={colors.success}
            label={t('proClientDetail.kpi.honored')}
            value={client.confirmedCount.toString()}
          />
          <StatTile
            icon="wallet-outline"
            tint={colors.primary}
            label={t('proClientDetail.kpi.revenue')}
            value={formatRevenue(client.totalRevenue)}
          />
          <StatTile
            icon="close-circle-outline"
            tint={missedCount > 0 ? colors.error : colors.textMuted}
            label={t('proClientDetail.kpi.missed')}
            value={missedCount.toString()}
          />
          <StatTile
            icon="time-outline"
            tint={colors.textSecondary}
            label={t('proClientDetail.kpi.lastVisit')}
            value={formatLongDate(client.lastBookingAt)}
          />
        </View>

        {/* ── 3. Détails secondaires ──────────────────────────── */}
        <SectionTitle text={t('proClientDetail.details')} />
        <Card padding="md">
          <DetailRow
            label={t('proClientDetail.kpi.firstVisit')}
            value={formatLongDate(client.firstBookingAt)}
          />
          <DetailRow
            label={t('proClientDetail.kpi.frequency')}
            value={frequencyLabel ?? '—'}
          />
          <DetailRow
            label={t('proClientDetail.kpi.bookings')}
            value={client.bookingsCount.toString()}
          />
          <DetailRow
            label={t('proClientDetail.kpi.confirmation')}
            value={confirmRate != null ? `${confirmRate}%` : '—'}
          />
          <DetailRow
            label={t('proClientDetail.kpi.noshow')}
            value={noshowRate != null ? `${noshowRate}%` : '—'}
            last
          />
        </Card>

        {/* ── 4. Fidélité — pièce maîtresse ───────────────────── */}
        {loyaltyView && (
          <>
            <SectionTitle text={t('proClientDetail.loyaltyTitle')} />
            <Card padding="md">
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md }}>
                <View
                  style={{
                    width: 40,
                    height: 40,
                    borderRadius: radius.md,
                    backgroundColor: loyaltyView.armed ? colors.successLight : colors.primaryLight,
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <Ionicons
                    name={loyaltyView.armed ? 'gift' : 'gift-outline'}
                    size={20}
                    color={loyaltyView.armed ? colors.successDark : colors.primary}
                  />
                </View>
                <View style={{ flex: 1, minWidth: 0 }}>
                  <Text variant="body" style={{ fontWeight: '700' }}>
                    {loyaltyView.armed
                      ? t('proLoyalty.progress.armed')
                      : t('proLoyalty.progress.next', { count: loyaltyView.remaining })}
                  </Text>
                  <Text variant="caption" color="textSecondary">
                    {formatRewardLabel(loyaltyView, t)}
                  </Text>
                </View>
              </View>

              {/* Jauge à tampons — la progression se lit d'un coup d'œil */}
              <View style={{ marginTop: spacing.md }}>
                <StampRow
                  filled={
                    loyaltyView.armed
                      ? loyaltyView.threshold
                      : loyaltyView.count % loyaltyView.threshold
                  }
                  total={loyaltyView.threshold}
                />
                <Text variant="caption" color="textSecondary" style={{ marginTop: spacing.sm }}>
                  {t('proLoyaltyAdjust.effectiveCount', { count: loyaltyView.count })}
                  {loyaltyView.adjustment !== 0
                    ? ` · ${t('proLoyaltyAdjust.manualDelta', {
                        delta: formatSignedDelta(loyaltyView.adjustment),
                      })}`
                    : ''}
                </Text>
              </View>

              {/* Ajuster les points */}
              <Button
                variant="outline"
                size="sm"
                fullWidth
                onPress={() => setAdjustOpen(true)}
                title={t('proLoyaltyAdjust.button')}
                leftIcon={<Ionicons name="options-outline" size={15} color={colors.primary} />}
                style={{ marginTop: spacing.md }}
              />

              {/* Historique des ajustements — repliable */}
              {loyaltyView.log.length > 0 && (
                <View style={{ marginTop: spacing.md }}>
                  <CollapsibleHeader
                    title={t('proLoyaltyAdjust.historyTitle')}
                    count={loyaltyView.log.length}
                    open={adjustLogOpen}
                    onToggle={() => setAdjustLogOpen((v) => !v)}
                  />
                  {adjustLogOpen && (
                    <View style={{ marginTop: spacing.sm, gap: spacing.sm }}>
                      {loyaltyView.log.map((entry, idx) => (
                        <View
                          key={idx}
                          style={{
                            flexDirection: 'row',
                            alignItems: 'flex-start',
                            gap: spacing.sm,
                          }}
                        >
                          <Text
                            variant="caption"
                            style={{
                              fontWeight: '700',
                              minWidth: 30,
                              color: entry.delta > 0 ? colors.success : colors.error,
                            }}
                          >
                            {formatSignedDelta(entry.delta)}
                          </Text>
                          <View style={{ flex: 1, minWidth: 0 }}>
                            <Text variant="caption" color="textSecondary">
                              {formatLongDate(entry.at)} · {adjustReasonLabel(entry.reason)}
                            </Text>
                            {entry.note ? (
                              <Text variant="caption" color="textMuted" numberOfLines={2}>
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
          </>
        )}

        {/* ── 5. Services préférés ────────────────────────────── */}
        <SectionTitle text={t('proClientDetail.favoriteServices')} />
        {historyLoading ? (
          <Text variant="bodySmall" color="textSecondary">
            {t('proClientDetail.computing')}
          </Text>
        ) : topServices.length === 0 ? (
          <Text variant="bodySmall" color="textSecondary">
            {t('proClientDetail.notEnoughData')}
          </Text>
        ) : (
          <Card padding="md">
            {topServices.map((s, i) => (
              <View
                key={s.name}
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: spacing.md,
                  paddingVertical: spacing.sm,
                  borderBottomWidth: i === topServices.length - 1 ? 0 : StyleSheet.hairlineWidth,
                  borderBottomColor: colors.divider,
                }}
              >
                <View
                  style={{
                    width: 28,
                    height: 28,
                    borderRadius: radius.sm,
                    backgroundColor: colors.primaryLight,
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
                <Text variant="bodySmall" style={{ flex: 1, fontWeight: '600' }} numberOfLines={1}>
                  {s.name}
                </Text>
                <Text variant="caption" color="textSecondary">
                  {t('proClientDetail.timesCount', { count: s.count })}
                </Text>
              </View>
            ))}
          </Card>
        )}

        {/* ── 6. Notes privées ────────────────────────────────── */}
        <SectionTitle text={t('proClientDetail.privateNotes')} />
        <Card padding="md">
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
          <Text variant="caption" color="textMuted" style={{ marginTop: spacing.sm }}>
            {t('proClientDetail.notesPrivacy')}
          </Text>
        </Card>

        {/* ── 7. Préférences ──────────────────────────────────── */}
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
            marginTop: spacing.xl,
            marginBottom: spacing.sm,
          }}
        >
          <Text
            variant="label"
            color="textSecondary"
            style={{ textTransform: 'uppercase', letterSpacing: 0.6 }}
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
          <Text variant="bodySmall" color="textSecondary">
            {t('proClientDetail.noPreferences')}
          </Text>
        ) : (
          <View style={{ gap: spacing.sm }}>
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
                    {
                      borderColor: colors.border,
                      color: colors.text,
                      backgroundColor: colors.surface,
                      flex: 1,
                    },
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
                    {
                      borderColor: colors.border,
                      color: colors.text,
                      backgroundColor: colors.surface,
                      flex: 2,
                    },
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

        {/* ── 8. Historique des RDV — repliable ───────────────── */}
        <View style={{ marginTop: spacing.xl }}>
          <CollapsibleHeader
            title={t('proClientDetail.historyTitle')}
            count={historyLoading ? undefined : bookings.length}
            open={historyOpen}
            onToggle={() => setHistoryOpen((v) => !v)}
            uppercase
          />
        </View>
        {historyOpen && (
          <View style={{ marginTop: spacing.sm }}>
            {historyLoading ? (
              <Text variant="bodySmall" color="textSecondary">
                {t('common.loading')}
              </Text>
            ) : bookings.length === 0 ? (
              <Text variant="bodySmall" color="textSecondary">
                {t('proClientDetail.historyEmpty')}
              </Text>
            ) : (
              <View style={{ gap: spacing.sm }}>
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
                          <View
                            style={{
                              width: 8,
                              height: 8,
                              borderRadius: 4,
                              marginTop: 6,
                              backgroundColor: colors[STATUS_COLOR_KEY[b.status]],
                            }}
                          />
                          <View style={{ flex: 1, minWidth: 0 }}>
                            <Text variant="bodySmall" style={{ fontWeight: '600' }} numberOfLines={1}>
                              {b.serviceName}
                            </Text>
                            <Text variant="caption" color="textSecondary">
                              {formatBookingDate(b.datetime)}
                              {b.memberName ? ` · ${b.memberName}` : ''}
                            </Text>
                            <Text
                              variant="caption"
                              style={{ color: colors[STATUS_COLOR_KEY[b.status]], fontWeight: '600' }}
                            >
                              {t(`proClientDetail.status.${STATUS_I18N_KEY[b.status]}`)}
                            </Text>
                          </View>
                          <Text variant="bodySmall" style={{ fontWeight: '700' }}>
                            {b.price > 0 ? formatRevenue(b.price) : '—'}
                          </Text>
                        </View>
                      </Card>
                    )}
                  </Pressable>
                ))}
              </View>
            )}
          </View>
        )}

        {/* ── 9. Marketing (à venir) ──────────────────────────── */}
        <Card
          padding="md"
          shadow="none"
          style={{
            marginTop: spacing.xl,
            borderStyle: 'dashed',
            backgroundColor: colors.surfaceSecondary,
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
        baseCount={loyaltyView?.count ?? 0}
        threshold={loyaltyView?.threshold ?? 0}
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

/** « −10 % tous les 6 RDV » / « −5 € tous les 6 RDV ». */
function formatRewardLabel(
  loyalty: { rewardType: 'percent' | 'amount'; rewardValue: number; threshold: number },
  t: (k: string, o?: Record<string, unknown>) => string,
): string {
  return loyalty.rewardType === 'percent'
    ? t('proLoyalty.progress.rewardPercent', {
        percent: loyalty.rewardValue,
        threshold: loyalty.threshold,
      })
    : t('proLoyalty.progress.rewardAmount', {
        amount: formatPrice(loyalty.rewardValue, 'EUR', getIntlLocale(i18n.language)),
        threshold: loyalty.threshold,
      });
}

const ADJUST_DELTA_MIN = -50;
const ADJUST_DELTA_MAX = 50;

/**
 * Bottom sheet d'ajustement manuel de points (fidélité v2).
 *
 * Le choix du nombre de points est VISUEL : une carte de fidélité à
 * tampons (voir StampCardPicker) où le pro tape l'emplacement
 * correspondant au nouveau total. Le delta se déduit de l'écart avec
 * le compte effectif actuel, borné à ±50 (limite de l'API).
 *
 * Le reste ne change pas : 6 justifications (slugs stockés, labels
 * traduits), note libre OBLIGATOIRE pour « autre », POST
 * /api/loyalty/adjust avec le Bearer token du pro — le serveur
 * journalise ET prévient le client par email ; ici on ne fait que
 * remonter le résultat au parent.
 */
function AdjustPointsSheet({
  visible,
  clientKey,
  baseCount,
  threshold,
  onClose,
  onSuccess,
}: {
  visible: boolean;
  clientKey: string;
  /** Compte EFFECTIF actuel du client (point de départ de la carte). */
  baseCount: number;
  /** Seuil du programme = nombre d'emplacements sur la carte. */
  threshold: number;
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

  // Le pro choisit un NOUVEAU TOTAL ; le delta s'en déduit. Bien plus
  // parlant qu'un stepper : « je tape le 5ᵉ tampon » = « le client en
  // aura 5 ».
  const [target, setTarget] = useState(baseCount);
  const [reason, setReason] = useState<LoyaltyAdjustmentReason>('geste_commercial');
  const [note, setNote] = useState('');
  const [noteError, setNoteError] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // Reset à chaque ouverture — le sheet reste monté pendant l'animation
  // de sortie, on ne peut donc pas compter sur un remontage.
  useEffect(() => {
    if (visible) {
      setTarget(baseCount);
      setReason('geste_commercial');
      setNote('');
      setNoteError(false);
      setSubmitting(false);
    }
  }, [visible, baseCount]);

  const delta = target - baseCount;
  // Bornes API (±50) + plancher 0 sur le total.
  const minTarget = Math.max(0, baseCount + ADJUST_DELTA_MIN);
  const maxTarget = baseCount + ADJUST_DELTA_MAX;
  const clampTarget = (n: number) => Math.max(minTarget, Math.min(maxTarget, n));

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
    <OverlaySheet visible={visible} onClose={onClose} heightPct={0.9}>
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

        {/* Carte à tampons — choix visuel du nouveau total */}
        <Text
          variant="label"
          color="textSecondary"
          style={{ textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: spacing.sm }}
        >
          {t('proLoyaltyAdjust.deltaLabel')}
        </Text>
        <StampCardPicker
          baseCount={baseCount}
          target={target}
          threshold={threshold}
          minTarget={minTarget}
          maxTarget={maxTarget}
          onChange={(n) => setTarget(clampTarget(n))}
        />

        {/* Justification */}
        <Text
          variant="label"
          color="textSecondary"
          style={{
            textTransform: 'uppercase',
            letterSpacing: 0.5,
            marginTop: spacing.xl,
            marginBottom: spacing.xs,
          }}
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
                  backgroundColor: selected ? colors.primaryLight : colors.surface,
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
            borderColor: noteError ? colors.error : colors.border,
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
          <Text variant="caption" style={{ color: colors.error, marginTop: 4 }}>
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

/**
 * Carte de fidélité virtuelle interactive.
 *
 * Le pro tape un emplacement pour fixer le NOUVEAU TOTAL : taper le
 * 5ᵉ quand le client en a 3 ⇒ « +2 ». Retaper un tampon déjà acquis
 * retire les suivants ; retaper le dernier tampon posé le retire lui
 * aussi (permet de revenir à 0 sur le cycle).
 *
 * La carte affiche TOUJOURS le cycle du total visé — les ±1 sous la
 * carte permettent donc de franchir un cycle entier (offrir une carte
 * complète) sans quitter la métaphore.
 */
function StampCardPicker({
  baseCount,
  target,
  threshold,
  minTarget,
  maxTarget,
  onChange,
}: {
  baseCount: number;
  target: number;
  threshold: number;
  minTarget: number;
  maxTarget: number;
  onChange: (next: number) => void;
}) {
  const { t } = useTranslation();
  const { colors, spacing, radius, shadows } = useTheme();

  // Un seuil invalide ne devrait pas arriver (le bouton n'existe que
  // sous une config valide) mais on ne veut ni division par zéro ni
  // boucle infinie de rendu.
  const size = Number.isInteger(threshold) && threshold >= 1 ? threshold : 1;

  /** Début du cycle contenant `n` (un multiple exact clôt son cycle). */
  const cycleStartOf = (n: number) =>
    n > 0 && n % size === 0 ? n - size : Math.floor(n / size) * size;

  const cycleStart = cycleStartOf(target);
  const posInCycle = target - cycleStart;
  const delta = target - baseCount;
  const rewardReached = target > 0 && target % size === 0;

  // Une Animated.Value par emplacement — le « tamponnage » est un
  // simple ressort de scale, natif (pas de re-render par frame).
  const anims = useMemo(
    () => Array.from({ length: size }, () => new Animated.Value(1)),
    [size],
  );
  // Le cycle affiché peut changer sous les pieds des animations ; on
  // garde la dernière position connue pour n'animer que les tampons
  // réellement ajoutés.
  const prevRef = useRef({ cycleStart, posInCycle });

  useEffect(() => {
    const prev = prevRef.current;
    prevRef.current = { cycleStart, posInCycle };
    // Changement de cycle ou retrait : pas d'animation d'apposition.
    if (prev.cycleStart !== cycleStart || posInCycle <= prev.posInCycle) return;
    const added: number[] = [];
    for (let i = prev.posInCycle; i < posInCycle; i++) added.push(i);
    if (added.length === 0) return;
    added.forEach((i) => anims[i]?.setValue(0.4));
    Animated.stagger(
      60,
      added.map((i) =>
        Animated.spring(anims[i], {
          toValue: 1,
          useNativeDriver: true,
          damping: 10,
          stiffness: 260,
        }),
      ),
    ).start();
  }, [cycleStart, posInCycle, anims]);

  /** Tap sur l'emplacement `i` (0-based) du cycle affiché. */
  const handleSlot = (i: number) => {
    const value = cycleStart + i + 1;
    // Retaper le dernier tampon posé le retire (sinon on ne pourrait
    // jamais revenir au début du cycle).
    onChange(value === target ? value - 1 : value);
  };

  const deltaLabel =
    delta > 0
      ? t('proLoyaltyAdjust.deltaAdd', { count: delta })
      : delta < 0
        ? t('proLoyaltyAdjust.deltaRemove', { count: Math.abs(delta) })
        : t('proLoyaltyAdjust.deltaNone');

  return (
    <View>
      {/* La carte */}
      <View
        style={[
          {
            borderRadius: radius.xl,
            overflow: 'hidden',
            borderWidth: 2,
            borderColor: rewardReached ? colors.success : 'transparent',
          },
          shadows.md,
        ]}
      >
        <LinearGradient
          colors={[colors.primary, colors.primaryDark]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={{ padding: spacing.lg }}
        >
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'space-between',
              marginBottom: spacing.md,
            }}
          >
            <Text
              variant="label"
              style={{
                color: colors.textInverse,
                fontWeight: '700',
                textTransform: 'uppercase',
                letterSpacing: 0.8,
              }}
            >
              {t('proLoyaltyAdjust.cardTitle')}
            </Text>
            <View
              style={{
                paddingHorizontal: 10,
                paddingVertical: 3,
                borderRadius: radius.full,
                backgroundColor: colors.overlay,
              }}
            >
              <Text variant="caption" style={{ color: colors.textInverse, fontWeight: '700' }}>
                {posInCycle}/{size}
              </Text>
            </View>
          </View>

          {/* Emplacements */}
          <View style={styles.slotRow}>
            {Array.from({ length: size }, (_, i) => {
              const value = cycleStart + i + 1;
              const filled = value <= target;
              const isNew = value > baseCount && value <= target;
              const isRemoved = value > target && value <= baseCount;
              // Hors des bornes de l'API (±50 autour du compte actuel) :
              // l'emplacement reste visible mais n'est plus cliquable.
              const disabled = value > maxTarget || value < minTarget;
              return (
                <Pressable
                  key={i}
                  onPress={() => handleSlot(i)}
                  disabled={disabled}
                  hitSlop={4}
                  style={({ pressed }) => ({ opacity: disabled ? 0.35 : pressed ? 0.7 : 1 })}
                >
                  <Animated.View
                    style={[
                      styles.slot,
                      { borderRadius: radius.full, transform: [{ scale: anims[i] ?? 1 }] },
                      filled
                        ? {
                            backgroundColor: isNew ? colors.success : colors.textInverse,
                            borderWidth: 0,
                          }
                        : {
                            borderWidth: 2,
                            borderStyle: 'dashed',
                            borderColor: isRemoved ? colors.error : colors.textInverse,
                            backgroundColor: colors.palette.transparent,
                          },
                    ]}
                  >
                    {filled ? (
                      <Ionicons
                        name="checkmark"
                        size={18}
                        color={isNew ? colors.textInverse : colors.primary}
                      />
                    ) : isRemoved ? (
                      <Ionicons name="remove" size={16} color={colors.error} />
                    ) : (
                      <Text variant="caption" style={{ color: colors.textInverse, opacity: 0.6 }}>
                        {value}
                      </Text>
                    )}
                  </Animated.View>
                </Pressable>
              );
            })}
          </View>

          <Text
            variant="caption"
            style={{ color: colors.textInverse, opacity: 0.85, marginTop: spacing.md }}
          >
            {rewardReached
              ? t('proLoyaltyAdjust.rewardReached')
              : t('proLoyaltyAdjust.cardHint')}
          </Text>
        </LinearGradient>
      </View>

      {/* Delta + réglage fin ±1 (pour dépasser un cycle) */}
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: spacing.md,
          marginTop: spacing.md,
        }}
      >
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text
            variant="body"
            style={{
              fontWeight: '700',
              color: delta > 0 ? colors.success : delta < 0 ? colors.error : colors.textMuted,
            }}
          >
            {deltaLabel}
          </Text>
          <Text variant="caption" color="textSecondary">
            {t('proLoyaltyAdjust.newTotal', { count: target })}
          </Text>
        </View>
        <View style={{ flexDirection: 'row', gap: spacing.sm }}>
          <Pressable
            onPress={() => onChange(target - 1)}
            disabled={target <= minTarget}
            hitSlop={6}
            style={({ pressed }) => [
              styles.stepBtn,
              {
                borderColor: colors.border,
                backgroundColor: colors.surface,
                borderRadius: radius.full,
                opacity: target <= minTarget ? 0.35 : pressed ? 0.6 : 1,
              },
            ]}
          >
            <Ionicons name="remove" size={20} color={colors.text} />
          </Pressable>
          <Pressable
            onPress={() => onChange(target + 1)}
            disabled={target >= maxTarget}
            hitSlop={6}
            style={({ pressed }) => [
              styles.stepBtn,
              {
                borderColor: colors.border,
                backgroundColor: colors.surface,
                borderRadius: radius.full,
                opacity: target >= maxTarget ? 0.35 : pressed ? 0.6 : 1,
              },
            ]}
          >
            <Ionicons name="add" size={20} color={colors.text} />
          </Pressable>
        </View>
      </View>
    </View>
  );
}

/** Jauge à tampons en lecture seule (section fidélité de la fiche). */
function StampRow({ filled, total }: { filled: number; total: number }) {
  const { colors } = useTheme();
  const count = Number.isInteger(total) && total >= 1 ? total : 0;
  return (
    <View style={styles.stampRow}>
      {Array.from({ length: count }, (_, i) => {
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
            {isFilled && <Ionicons name="checkmark" size={13} color={colors.textInverse} />}
          </View>
        );
      })}
    </View>
  );
}

/** Titre de section — majuscules discrètes, respiration au-dessus. */
function SectionTitle({ text }: { text: string }) {
  const { spacing } = useTheme();
  return (
    <Text
      variant="label"
      color="textSecondary"
      style={{
        textTransform: 'uppercase',
        letterSpacing: 0.6,
        marginTop: spacing.xl,
        marginBottom: spacing.sm,
      }}
    >
      {text}
    </Text>
  );
}

/** Tuile de chiffre clé — gros nombre, petit libellé (grille 2×2). */
function StatTile({
  icon,
  tint,
  label,
  value,
}: {
  icon: React.ComponentProps<typeof Ionicons>['name'];
  tint: string;
  label: string;
  value: string;
}) {
  const { colors, spacing, radius } = useTheme();
  return (
    <View
      style={{
        flexBasis: '47%',
        flexGrow: 1,
        borderRadius: radius.lg,
        backgroundColor: colors.surfaceSecondary,
        paddingVertical: spacing.md,
        paddingHorizontal: spacing.md,
      }}
    >
      <Ionicons name={icon} size={18} color={tint} />
      <Text variant="h3" style={{ fontWeight: '700', marginTop: spacing.sm }} numberOfLines={1}>
        {value}
      </Text>
      <Text variant="caption" color="textSecondary" numberOfLines={1}>
        {label}
      </Text>
    </View>
  );
}

/** Ligne libellé → valeur, séparateur hairline (bloc « Détails »). */
function DetailRow({
  label,
  value,
  last,
}: {
  label: string;
  value: string;
  last?: boolean;
}) {
  const { colors, spacing } = useTheme();
  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: spacing.md,
        paddingVertical: spacing.sm,
        borderBottomWidth: last ? 0 : StyleSheet.hairlineWidth,
        borderBottomColor: colors.divider,
      }}
    >
      <Text variant="bodySmall" color="textSecondary" style={{ flex: 1 }} numberOfLines={1}>
        {label}
      </Text>
      <Text variant="bodySmall" style={{ fontWeight: '600' }} numberOfLines={1}>
        {value}
      </Text>
    </View>
  );
}

/** Bouton pilule de contact (appel / SMS / email). */
function ContactAction({
  icon,
  label,
  onPress,
}: {
  icon: React.ComponentProps<typeof Ionicons>['name'];
  label: string;
  onPress: () => void;
}) {
  const { colors, spacing, radius } = useTheme();
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => ({
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 6,
        paddingVertical: spacing.sm,
        borderRadius: radius.md,
        backgroundColor: colors.surface,
        opacity: pressed ? 0.7 : 1,
      })}
    >
      <Ionicons name={icon} size={16} color={colors.primary} />
      <Text variant="caption" style={{ color: colors.primary, fontWeight: '600' }}>
        {label}
      </Text>
    </Pressable>
  );
}

/** En-tête de section repliable (chevron + compteur optionnel). */
function CollapsibleHeader({
  title,
  count,
  open,
  onToggle,
  uppercase,
}: {
  title: string;
  count?: number;
  open: boolean;
  onToggle: () => void;
  uppercase?: boolean;
}) {
  const { colors } = useTheme();
  return (
    <Pressable
      onPress={onToggle}
      hitSlop={6}
      style={({ pressed }) => ({
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        opacity: pressed ? 0.6 : 1,
      })}
    >
      <Text
        variant="label"
        color="textSecondary"
        style={
          uppercase
            ? { textTransform: 'uppercase', letterSpacing: 0.6, fontWeight: '600' }
            : { fontWeight: '600' }
        }
      >
        {title}
        {count != null ? ` (${count})` : ''}
      </Text>
      <Ionicons
        name={open ? 'chevron-up' : 'chevron-down'}
        size={16}
        color={colors.textMuted}
      />
    </Pressable>
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
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
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
  slotRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  slot: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
