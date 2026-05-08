/**
 * Pro — Paiements & acomptes
 *
 * Native screen split into three concerns:
 *   1. Stripe Connect status — read-only here. Activation goes
 *      through the web because the KYC form is heavy (legal,
 *      identity, IBAN) and Stripe doesn't expose a native flow.
 *   2. Add-on Sérénité — activate/deactivate also via web because
 *      it mutates a Stripe subscription item (server-side only).
 *   3. Default deposit (% + refund deadline) — fully editable
 *      inline here. Calls /api/pro/deposits-default with the
 *      Firebase ID token, same as the web Settings page.
 *
 * The provider doc is loaded via real-time Firestore listener
 * (useProvider), so any change made in the in-app browser flow
 * is reflected on this screen as soon as the user comes back.
 */

import React, { useEffect, useMemo, useState } from 'react';
import {
  ScrollView,
  StyleSheet,
  View,
  TextInput,
  Pressable,
  Alert,
  ActivityIndicator,
  Platform,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as WebBrowser from 'expo-web-browser';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { auth as firebaseAuth } from '@booking-app/firebase';
import { useTheme } from '../../theme';
import { Text, Card, Button, Switch, useToast } from '../../components';
import { useProvider } from '../../contexts';

const BASE_URL = process.env.EXPO_PUBLIC_APP_URL ?? 'https://opatam.com';

/** Preset chips for the default deposit percentage — 90% of pros
 *  will pick one of these, the custom input remains for the rest. */
const PERCENT_PRESETS = [10, 20, 30, 50, 100];

/** Refund-window presets in hours. Day-based labels because pros
 *  think in days, not hours, even when the rule is "24h before". */
const HOURS_PRESETS: { value: number; label: string }[] = [
  { value: 0, label: 'Aucun' },
  { value: 24, label: '24h' },
  { value: 48, label: '48h' },
  { value: 72, label: '72h' },
];

export default function PaymentsScreen() {
  const { colors, spacing, radius } = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const toast = useToast();
  const { provider, isLoading } = useProvider();

  // ─── Derived state from the provider doc ──────────────────────────
  const connectStatus = provider?.stripeConnectStatus ?? null;
  const connectActive = connectStatus === 'active';
  const addonActive = !!provider?.depositsAddonActive;
  const depositDefault = provider?.settings?.depositDefault ?? null;

  // ─── Local edit state for the default deposit form ────────────────
  // Synced from the provider doc when not editing; once the user
  // touches anything we keep the local copy until they save/cancel.
  const [editing, setEditing] = useState(false);
  const [enabled, setEnabled] = useState(!!depositDefault);
  const [percent, setPercent] = useState(String(depositDefault?.percent ?? 30));
  const [hours, setHours] = useState(String(depositDefault?.refundDeadlineHours ?? 24));
  const [saving, setSaving] = useState(false);
  const [addonWorking, setAddonWorking] = useState(false);

  useEffect(() => {
    if (editing) return;
    setEnabled(!!depositDefault);
    setPercent(String(depositDefault?.percent ?? 30));
    setHours(String(depositDefault?.refundDeadlineHours ?? 24));
  }, [depositDefault, editing]);

  const dirty = useMemo(() => {
    const persistedEnabled = !!depositDefault;
    const persistedPercent = depositDefault?.percent ?? 30;
    const persistedHours = depositDefault?.refundDeadlineHours ?? 24;
    return (
      enabled !== persistedEnabled ||
      Number(percent) !== persistedPercent ||
      Number(hours) !== persistedHours
    );
  }, [enabled, percent, hours, depositDefault]);

  // ─── Web fallback for Stripe Connect KYC ─────────────────────────
  // (Onboarding requires Stripe's hosted form — no native option.)
  const openWeb = async () => {
    const url = `${BASE_URL}/pro/parametres?tab=paiements`;
    try {
      await WebBrowser.openBrowserAsync(url, {
        presentationStyle: WebBrowser.WebBrowserPresentationStyle.PAGE_SHEET,
      });
    } catch (err) {
      console.error('[payments] in-app browser error:', err);
      Alert.alert('Erreur', "Impossible d'ouvrir le portail de paiement.");
    }
  };

  // ─── Add-on subscribe / unsubscribe via API (no web needed) ─────
  const toggleAddon = async (subscribe: boolean) => {
    if (addonWorking) return;
    const user = firebaseAuth.currentUser;
    if (!user) {
      toast.showToast({ variant: 'error', message: 'Session expirée — reconnectez-vous' });
      return;
    }

    if (!subscribe) {
      // Two-step confirm to make sure the user understands what
      // unsubscribe means (no more 5 €/mois charge).
      const confirmed = await new Promise<boolean>((resolve) => {
        Alert.alert(
          "Désactiver l'abonnement Sérénité ?",
          "Plus de prélèvement de 5 €/mois. Vous gardez l'accès jusqu'à la fin de votre période en cours, puis vous ne pourrez plus demander d'acomptes.",
          [
            { text: 'Annuler', style: 'cancel', onPress: () => resolve(false) },
            { text: 'Désactiver', style: 'destructive', onPress: () => resolve(true) },
          ],
        );
      });
      if (!confirmed) return;
    }

    setAddonWorking(true);
    try {
      const token = await user.getIdToken();
      const path = subscribe
        ? `${BASE_URL}/api/pro/deposits-addon/activate`
        : `${BASE_URL}/api/pro/deposits-addon/deactivate`;
      const res = await fetch(path, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
      toast.showToast({
        variant: 'success',
        message: subscribe ? 'Abonnement Sérénité activé' : 'Abonnement Sérénité désactivé',
      });
      // Provider doc updates via real-time listener — UI catches up.
    } catch (err) {
      toast.showToast({
        variant: 'error',
        message: err instanceof Error ? err.message : 'Erreur',
      });
    } finally {
      setAddonWorking(false);
    }
  };

  // ─── Save default deposit via API ────────────────────────────────
  const saveDeposit = async () => {
    if (saving) return;
    const user = firebaseAuth.currentUser;
    if (!user) {
      toast.showToast({ variant: 'error', message: 'Session expirée — reconnectez-vous' });
      return;
    }
    const percentNum = Number(percent);
    const hoursNum = Number(hours);
    if (enabled && (!Number.isFinite(percentNum) || percentNum < 1 || percentNum > 100)) {
      toast.showToast({ variant: 'error', message: 'Pourcentage entre 1 et 100' });
      return;
    }
    if (!Number.isFinite(hoursNum) || hoursNum < 0 || hoursNum > 720) {
      toast.showToast({ variant: 'error', message: 'Délai entre 0 et 720 heures' });
      return;
    }

    setSaving(true);
    try {
      const token = await user.getIdToken();
      const res = await fetch(`${BASE_URL}/api/pro/deposits-default`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          percent: enabled ? percentNum : null,
          refundDeadlineHours: hoursNum,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
      toast.showToast({ variant: 'success', message: 'Acompte par défaut enregistré' });
      setEditing(false);
    } catch (err) {
      toast.showToast({
        variant: 'error',
        message: err instanceof Error ? err.message : 'Erreur',
      });
    } finally {
      setSaving(false);
    }
  };

  // ─── Render ────────────────────────────────────────────────────────
  if (isLoading || !provider) {
    return (
      <View style={[s.container, s.center, { backgroundColor: colors.background }]}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  // Hero state derived from the two top-level toggles. Drives the
  // colour gradient + headline copy at the top of the screen.
  const heroState: 'fully-active' | 'connect-only' | 'inactive' = !connectActive
    ? 'inactive'
    : addonActive
      ? 'fully-active'
      : 'connect-only';

  return (
    <View style={[s.container, { backgroundColor: colors.background }]}>
      {/* Header */}
      <View style={[s.header, { paddingTop: insets.top + spacing.md, paddingHorizontal: spacing.lg }]}>
        <Pressable
          onPress={() => router.back()}
          style={[s.backBtn, { backgroundColor: colors.surface, borderRadius: radius.full }]}
        >
          <Ionicons name="chevron-back" size={24} color={colors.text} />
        </Pressable>
        <Text variant="h2" style={s.title}>
          Paiements & acomptes
        </Text>
      </View>

      <ScrollView
        contentContainerStyle={{
          paddingHorizontal: spacing.lg,
          paddingTop: spacing.md,
          paddingBottom: insets.bottom + spacing.xl * 2,
          gap: spacing.md,
        }}
        keyboardShouldPersistTaps="handled"
      >
        {/* ── Hero card — top-of-funnel summary ─────────────────────── */}
        <HeroCard
          state={heroState}
          radius={radius}
          spacing={spacing}
          onPressActivate={openWeb}
        />

        {/* ── 1. Stripe Connect ─────────────────────────── */}
        <Card padding="md">
          <SectionHeader
            icon="card-outline"
            title="Compte Stripe"
            subtitle="Le compte qui reçoit les acomptes."
            tint={connectActive ? colors.success : colors.warning}
            colors={colors}
            spacing={spacing}
            trailing={
              <StatusBadge
                ok={connectActive}
                status={
                  connectStatus === 'active'
                    ? 'Actif'
                    : connectStatus === 'pending'
                      ? 'En attente'
                      : connectStatus === 'restricted'
                        ? 'Restreint'
                        : 'Non activé'
                }
              />
            }
          />
          <Text
            variant="bodySmall"
            color="textSecondary"
            style={{ marginTop: spacing.sm }}
          >
            {connectActive
              ? 'Vous pouvez accepter des acomptes. Les fonds sont versés directement sur votre IBAN.'
              : 'Activez Stripe pour pouvoir encaisser des acomptes au moment de la réservation.'}
          </Text>
          <Pressable
            onPress={openWeb}
            style={({ pressed }) => [
              s.linkBtn,
              {
                marginTop: spacing.md,
                opacity: pressed ? 0.6 : 1,
              },
            ]}
          >
            <Text variant="body" style={{ color: colors.primary, fontWeight: '600' }}>
              {connectActive ? 'Gérer mon compte Stripe' : 'Activer les paiements'}
            </Text>
            <Ionicons name="open-outline" size={16} color={colors.primary} />
          </Pressable>
        </Card>

        {/* ── 2. Abonnement Sérénité ─────────────────────────── */}
        {!addonActive ? (
          // ── Pas souscrit : carte produit avec gradient + bullets ──
          <View style={[s.serenityCard, { borderRadius: radius.lg }]}>
            <LinearGradient
              colors={['#1E293B', '#0F172A']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={[s.serenityGradient, { borderRadius: radius.lg }]}
            >
              {/* Decorative dots */}
              <View style={[s.serenityDecor, { backgroundColor: colors.primary, opacity: 0.18, top: -30, right: -30 }]} />
              <View style={[s.serenityDecor, { backgroundColor: colors.primary, opacity: 0.08, bottom: -50, left: -50, width: 140, height: 140, borderRadius: 70 }]} />

              <View style={s.serenityHeader}>
                <View style={s.serenityIconWrap}>
                  <Ionicons name="shield-checkmark" size={22} color="#FFFFFF" />
                </View>
                <View style={s.serenityPrice}>
                  <Text variant="caption" style={{ color: '#FFFFFF', fontWeight: '700' }}>
                    5 €/mois
                  </Text>
                </View>
              </View>

              <Text style={[s.serenityTitle, { color: '#FFFFFF' }]}>
                Abonnement Sérénité
              </Text>
              <Text style={[s.serenitySub, { color: 'rgba(255,255,255,0.75)' }]}>
                Encaissez un acompte au moment de la réservation pour réduire les no-shows.
              </Text>

              <View style={[s.serenityBullets, { gap: spacing.xs }]}>
                {[
                  'Acompte personnalisable par prestation',
                  'Remboursement automatique sous délai',
                  'Annulable à tout moment',
                ].map((b) => (
                  <View key={b} style={s.bulletRow}>
                    <Ionicons name="checkmark" size={14} color="#22C55E" />
                    <Text style={[s.bulletText, { color: 'rgba(255,255,255,0.92)' }]}>
                      {b}
                    </Text>
                  </View>
                ))}
              </View>

              {!connectActive ? (
                <View style={[s.serenityHint, { backgroundColor: 'rgba(255,255,255,0.08)' }]}>
                  <Ionicons name="information-circle-outline" size={14} color="rgba(255,255,255,0.85)" />
                  <Text style={[s.hintText, { color: 'rgba(255,255,255,0.85)' }]}>
                    Activez Stripe Connect d'abord.
                  </Text>
                </View>
              ) : Platform.OS === 'ios' ? (
                <Pressable
                  onPress={openWeb}
                  style={({ pressed }) => [
                    s.serenityCta,
                    { backgroundColor: '#FFFFFF', opacity: pressed ? 0.85 : 1 },
                  ]}
                >
                  <Text style={{ color: '#0F172A', fontWeight: '700', fontSize: 14 }}>
                    Activer sur opatam.com
                  </Text>
                  <Ionicons name="open-outline" size={16} color="#0F172A" />
                </Pressable>
              ) : (
                <Pressable
                  onPress={() => toggleAddon(true)}
                  disabled={addonWorking}
                  style={({ pressed }) => [
                    s.serenityCta,
                    {
                      backgroundColor: '#FFFFFF',
                      opacity: addonWorking ? 0.6 : pressed ? 0.85 : 1,
                    },
                  ]}
                >
                  {addonWorking ? (
                    <ActivityIndicator size="small" color="#0F172A" />
                  ) : (
                    <>
                      <Text style={{ color: '#0F172A', fontWeight: '700', fontSize: 14 }}>
                        Souscrire — 5 €/mois
                      </Text>
                      <Ionicons name="arrow-forward" size={16} color="#0F172A" />
                    </>
                  )}
                </Pressable>
              )}
            </LinearGradient>
          </View>
        ) : (
          // ── Souscrit : carte plus simple, accent succès ──
          <Card padding="md">
            <View style={s.activeAddonRow}>
              <View
                style={[
                  s.activeAddonBadge,
                  { backgroundColor: colors.success + '18' },
                ]}
              >
                <Ionicons name="shield-checkmark" size={20} color={colors.success} />
              </View>
              <View style={{ flex: 1 }}>
                <Text variant="body" style={{ fontWeight: '700' }}>
                  Sérénité actif
                </Text>
                <Text variant="caption" color="textSecondary" style={{ marginTop: 2 }}>
                  5 €/mois · prélevés à la prochaine échéance
                </Text>
              </View>
            </View>
            <Pressable
              onPress={() => toggleAddon(false)}
              disabled={addonWorking}
              style={({ pressed }) => [
                {
                  marginTop: spacing.md,
                  alignSelf: 'flex-start',
                  opacity: addonWorking ? 0.5 : pressed ? 0.6 : 1,
                },
              ]}
            >
              <Text variant="caption" style={{ color: colors.error, fontWeight: '600' }}>
                {addonWorking ? 'Désactivation…' : "Désactiver l'abonnement"}
              </Text>
            </Pressable>
          </Card>
        )}

        {/* ── 3. Default deposit (inline editable) ───────── */}
        <Card padding="md" style={{ opacity: addonActive ? 1 : 0.55 }}>
          <SectionHeader
            icon="cash-outline"
            title="Acompte par défaut"
            subtitle="Appliqué aux prestations qui n'ont pas leur propre montant."
            tint={enabled && addonActive ? colors.primary : colors.textMuted}
            colors={colors}
            spacing={spacing}
            trailing={
              <Switch
                value={enabled && addonActive}
                onValueChange={(v) => {
                  if (!addonActive) return;
                  setEnabled(v);
                  setEditing(true);
                }}
                disabled={!addonActive}
              />
            }
          />

          {!addonActive && (
            <View
              style={[
                s.lockedHint,
                { backgroundColor: colors.surfaceSecondary, marginTop: spacing.sm },
              ]}
            >
              <Ionicons name="lock-closed" size={14} color={colors.textMuted} />
              <Text variant="caption" color="textSecondary">
                Activez Sérénité pour configurer un acompte par défaut.
              </Text>
            </View>
          )}

          {addonActive && enabled && (
            <View style={{ marginTop: spacing.md, gap: spacing.lg }}>
              {/* Big visual % preview */}
              <View
                style={[
                  s.percentPreview,
                  {
                    backgroundColor: colors.primaryLight || '#e4effa',
                    borderColor: colors.primary + '30',
                    borderRadius: radius.lg,
                  },
                ]}
              >
                <Text style={[s.percentBig, { color: colors.primary }]}>
                  {percent || '0'}
                </Text>
                <Text style={[s.percentSign, { color: colors.primary }]}>%</Text>
                <Text variant="caption" color="textSecondary" style={{ marginTop: 4 }}>
                  du prix réservé
                </Text>
              </View>

              {/* Percent presets + custom input */}
              <View>
                <Text
                  variant="caption"
                  color="textSecondary"
                  style={{
                    marginBottom: spacing.xs,
                    textTransform: 'uppercase',
                    letterSpacing: 0.4,
                    fontWeight: '600',
                  }}
                >
                  Pourcentage du prix
                </Text>
                <View style={s.chipRow}>
                  {PERCENT_PRESETS.map((p) => {
                    const active = Number(percent) === p;
                    return (
                      <Pressable
                        key={p}
                        onPress={() => {
                          setPercent(String(p));
                          setEditing(true);
                        }}
                        style={({ pressed }) => [
                          s.chip,
                          {
                            borderColor: active ? colors.primary : colors.border,
                            backgroundColor: active ? colors.primary : 'transparent',
                            opacity: pressed ? 0.7 : 1,
                          },
                        ]}
                      >
                        <Text
                          variant="bodySmall"
                          style={{
                            color: active ? '#FFFFFF' : colors.text,
                            fontWeight: '600',
                          }}
                        >
                          {p}%
                        </Text>
                      </Pressable>
                    );
                  })}
                  <View style={s.customInputWrap}>
                    <TextInput
                      value={percent}
                      onChangeText={(v) => {
                        setPercent(v.replace(/[^0-9]/g, '').slice(0, 3));
                        setEditing(true);
                      }}
                      keyboardType="number-pad"
                      style={[
                        s.customInput,
                        {
                          borderColor: colors.border,
                          color: colors.text,
                        },
                      ]}
                      placeholder="Autre"
                      placeholderTextColor={colors.textMuted}
                      maxLength={3}
                    />
                    <Text style={[s.customInputSuffix, { color: colors.textMuted }]}>%</Text>
                  </View>
                </View>
              </View>

              {/* Refund deadline presets + custom */}
              <View>
                <Text
                  variant="caption"
                  color="textSecondary"
                  style={{
                    marginBottom: spacing.xs,
                    textTransform: 'uppercase',
                    letterSpacing: 0.4,
                    fontWeight: '600',
                  }}
                >
                  Remboursement automatique avant le RDV
                </Text>
                <View style={s.chipRow}>
                  {HOURS_PRESETS.map((h) => {
                    const active = Number(hours) === h.value;
                    return (
                      <Pressable
                        key={h.value}
                        onPress={() => {
                          setHours(String(h.value));
                          setEditing(true);
                        }}
                        style={({ pressed }) => [
                          s.chip,
                          {
                            borderColor: active ? colors.primary : colors.border,
                            backgroundColor: active ? colors.primary : 'transparent',
                            opacity: pressed ? 0.7 : 1,
                          },
                        ]}
                      >
                        <Text
                          variant="bodySmall"
                          style={{
                            color: active ? '#FFFFFF' : colors.text,
                            fontWeight: '600',
                          }}
                        >
                          {h.label}
                        </Text>
                      </Pressable>
                    );
                  })}
                  <View style={s.customInputWrap}>
                    <TextInput
                      value={hours}
                      onChangeText={(v) => {
                        setHours(v.replace(/[^0-9]/g, '').slice(0, 3));
                        setEditing(true);
                      }}
                      keyboardType="number-pad"
                      style={[
                        s.customInput,
                        {
                          borderColor: colors.border,
                          color: colors.text,
                        },
                      ]}
                      placeholder="Autre"
                      placeholderTextColor={colors.textMuted}
                      maxLength={3}
                    />
                    <Text style={[s.customInputSuffix, { color: colors.textMuted }]}>h</Text>
                  </View>
                </View>
                <Text variant="caption" color="textSecondary" style={{ marginTop: spacing.xs }}>
                  « Aucun » = pas de remboursement automatique côté client.
                </Text>
              </View>
            </View>
          )}

          {dirty && (
            <View style={{ flexDirection: 'row', gap: spacing.sm, marginTop: spacing.lg }}>
              <Button
                title="Annuler"
                variant="ghost"
                onPress={() => {
                  setEditing(false);
                }}
                style={{ flex: 1 }}
              />
              <Button
                title="Enregistrer"
                onPress={saveDeposit}
                loading={saving}
                disabled={saving || !addonActive}
                style={{ flex: 1 }}
              />
            </View>
          )}
        </Card>
      </ScrollView>
    </View>
  );
}

// ─── Sub-components ──────────────────────────────────────────────────

function HeroCard({
  state,
  radius,
  spacing,
  onPressActivate,
}: {
  state: 'fully-active' | 'connect-only' | 'inactive';
  radius: any;
  spacing: any;
  onPressActivate: () => void;
}) {
  // Three visual states keyed off how far the pro is into the
  // funnel. Distinct gradients so a glance tells you where you stand.
  const config = {
    'fully-active': {
      colors: ['#0F766E', '#14B8A6'] as [string, string],
      icon: 'sparkles' as const,
      title: 'Acomptes activés',
      subtitle: 'Votre vitrine demande un acompte à la réservation.',
      cta: null,
    },
    'connect-only': {
      colors: ['#1D4ED8', '#3B82F6'] as [string, string],
      icon: 'card' as const,
      title: 'Stripe prêt — il manque Sérénité',
      subtitle: 'Souscrivez à Sérénité pour activer les acomptes.',
      cta: null,
    },
    inactive: {
      colors: ['#7C2D12', '#EA580C'] as [string, string],
      icon: 'alert-circle' as const,
      title: 'Acomptes non disponibles',
      subtitle: 'Activez Stripe Connect pour réduire les no-shows.',
      cta: { label: 'Activer Stripe', onPress: onPressActivate },
    },
  }[state];

  return (
    <View style={[s.heroWrap, { borderRadius: radius.lg }]}>
      <LinearGradient
        colors={config.colors}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={[s.heroGradient, { borderRadius: radius.lg, padding: spacing.lg }]}
      >
        <View style={[s.heroDecorCircle, { top: -30, right: -30 }]} />
        <View style={[s.heroDecorCircle, { bottom: -40, left: -20, width: 100, height: 100, borderRadius: 50, opacity: 0.06 }]} />

        <View style={s.heroIconWrap}>
          <Ionicons name={config.icon} size={26} color="#FFFFFF" />
        </View>
        <Text style={s.heroTitle}>{config.title}</Text>
        <Text style={s.heroSubtitle}>{config.subtitle}</Text>

        {config.cta && (
          <Pressable
            onPress={config.cta.onPress}
            style={({ pressed }) => [
              s.heroCta,
              { backgroundColor: '#FFFFFF', opacity: pressed ? 0.85 : 1 },
            ]}
          >
            <Text style={{ color: config.colors[1], fontWeight: '700', fontSize: 14 }}>
              {config.cta.label}
            </Text>
            <Ionicons name="arrow-forward" size={16} color={config.colors[1]} />
          </Pressable>
        )}
      </LinearGradient>
    </View>
  );
}

function SectionHeader({
  icon,
  title,
  subtitle,
  tint,
  colors,
  spacing,
  trailing,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  subtitle?: string;
  tint: string;
  colors: any;
  spacing: any;
  trailing?: React.ReactNode;
}) {
  return (
    <View style={s.sectionHeaderRow}>
      <View style={[s.sectionHeaderIcon, { backgroundColor: tint + '18' }]}>
        <Ionicons name={icon} size={18} color={tint} />
      </View>
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text variant="body" style={{ fontWeight: '700' }}>
          {title}
        </Text>
        {subtitle && (
          <Text variant="caption" color="textSecondary" style={{ marginTop: 2 }}>
            {subtitle}
          </Text>
        )}
      </View>
      {trailing}
    </View>
  );
}

function StatusBadge({ ok, status }: { ok: boolean; status: string }) {
  const { colors, spacing, radius } = useTheme();
  const bg = ok ? colors.success + '20' : colors.warning + '20';
  const fg = ok ? colors.success : colors.warning;
  return (
    <View
      style={[
        s.badge,
        {
          backgroundColor: bg,
          borderRadius: radius.full,
          paddingHorizontal: spacing.sm,
          paddingVertical: 3,
        },
      ]}
    >
      <Text variant="caption" style={{ color: fg, fontWeight: '700' }}>
        {status}
      </Text>
    </View>
  );
}

const s = StyleSheet.create({
  container: { flex: 1 },
  center: { alignItems: 'center', justifyContent: 'center' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingBottom: 16,
    gap: 12,
  },
  backBtn: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  title: { flex: 1 },

  // Hero
  heroWrap: {
    overflow: 'hidden',
  },
  heroGradient: {
    position: 'relative',
    overflow: 'hidden',
  },
  heroDecorCircle: {
    position: 'absolute',
    width: 160,
    height: 160,
    borderRadius: 80,
    backgroundColor: 'rgba(255,255,255,0.08)',
  },
  heroIconWrap: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(255,255,255,0.18)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  heroTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: '#FFFFFF',
    marginBottom: 4,
  },
  heroSubtitle: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.85)',
    lineHeight: 18,
  },
  heroCta: {
    marginTop: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    alignSelf: 'flex-start',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 999,
  },

  // Section header
  sectionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  sectionHeaderIcon: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },

  // Stripe link button
  linkBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    alignSelf: 'flex-start',
    paddingVertical: 6,
  },

  // Sérénité — non-subscribed product card
  serenityCard: {
    overflow: 'hidden',
  },
  serenityGradient: {
    padding: 18,
    overflow: 'hidden',
    position: 'relative',
  },
  serenityDecor: {
    position: 'absolute',
    width: 100,
    height: 100,
    borderRadius: 50,
  },
  serenityHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  serenityIconWrap: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.15)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  serenityPrice: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
    backgroundColor: 'rgba(255,255,255,0.18)',
  },
  serenityTitle: {
    fontSize: 18,
    fontWeight: '800',
    marginBottom: 4,
  },
  serenitySub: {
    fontSize: 13,
    lineHeight: 18,
  },
  serenityBullets: {
    marginTop: 16,
  },
  bulletRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  bulletText: {
    fontSize: 13,
    flex: 1,
  },
  serenityHint: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 16,
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 8,
  },
  hintText: {
    fontSize: 12,
  },
  serenityCta: {
    marginTop: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 999,
  },

  // Active addon card
  activeAddonRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  activeAddonBadge: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },

  // Locked hint (when addon inactive)
  lockedHint: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 10,
  },

  // Big % preview
  percentPreview: {
    paddingVertical: 22,
    paddingHorizontal: 16,
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'center',
    borderWidth: 1,
    flexWrap: 'wrap',
    gap: 0,
  },
  percentBig: {
    fontSize: 56,
    fontWeight: '800',
    lineHeight: 60,
  },
  percentSign: {
    fontSize: 28,
    fontWeight: '700',
    marginLeft: 4,
    marginTop: 6,
  },

  // Chips
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    alignItems: 'center',
  },
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 999,
    borderWidth: 1,
    minWidth: 56,
    alignItems: 'center',
  },
  customInputWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 4,
    gap: 4,
  },
  customInput: {
    fontSize: 14,
    fontWeight: '600',
    minWidth: 44,
    paddingVertical: 0,
  },
  customInputSuffix: {
    fontSize: 13,
    fontWeight: '600',
  },

  badge: { alignSelf: 'flex-start' },
});
