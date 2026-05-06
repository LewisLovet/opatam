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
} from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as WebBrowser from 'expo-web-browser';
import { Ionicons } from '@expo/vector-icons';
import { auth as firebaseAuth } from '@booking-app/firebase';
import { useTheme } from '../../theme';
import { Text, Card, Button, Switch, useToast } from '../../components';
import { useProvider } from '../../contexts';

const BASE_URL = process.env.EXPO_PUBLIC_APP_URL ?? 'https://opatam.com';

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
          'Plus de prélèvement de 5 €/mois. Vous gardez l\'accès jusqu\'à la fin de votre période en cours, puis vous ne pourrez plus demander d\'acomptes.',
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
        contentContainerStyle={{ padding: spacing.lg, paddingBottom: insets.bottom + spacing.xl * 2 }}
        keyboardShouldPersistTaps="handled"
      >
        {/* ── 1. Stripe Connect ─────────────────────────── */}
        <Card padding="md" style={{ marginBottom: spacing.md }}>
          <View style={s.rowBetween}>
            <Text variant="label" color="textSecondary" style={s.sectionLabel}>
              Compte Stripe
            </Text>
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
          </View>
          <Text variant="body" style={{ marginTop: spacing.sm, color: colors.text }}>
            {connectActive
              ? 'Vous pouvez accepter des acomptes. Les fonds sont versés directement sur votre IBAN.'
              : 'Activez Stripe pour pouvoir encaisser des acomptes au moment de la réservation.'}
          </Text>
          <Button
            title={connectActive ? 'Gérer mon compte Stripe' : 'Activer les paiements'}
            variant={connectActive ? 'ghost' : 'primary'}
            onPress={openWeb}
            style={{ marginTop: spacing.md }}
          />
        </Card>

        {/* ── 2. Abonnement Sérénité ─────────────────────────── */}
        <Card
          padding="md"
          style={{ marginBottom: spacing.md, opacity: connectActive ? 1 : 0.5 }}
        >
          {!addonActive ? (
            // ─── État: pas souscrit ─────────────────────────────────
            <>
              <View style={s.rowBetween}>
                <Text variant="label" color="textSecondary" style={s.sectionLabel}>
                  Abonnement Sérénité
                </Text>
                <View
                  style={[
                    s.badge,
                    {
                      backgroundColor: colors.primary + '20',
                      borderRadius: radius.full,
                      paddingHorizontal: spacing.sm,
                      paddingVertical: 2,
                    },
                  ]}
                >
                  <Text variant="caption" style={{ color: colors.primary, fontWeight: '600' }}>
                    5 €/mois
                  </Text>
                </View>
              </View>
              <Text variant="body" style={{ marginTop: spacing.sm, color: colors.text }}>
                Encaissez un acompte au moment de la réservation pour réduire les no-shows.
                Annulable à tout moment.
              </Text>
              {!connectActive ? (
                <Text variant="caption" color="textSecondary" style={{ marginTop: spacing.sm }}>
                  Activez Stripe Connect d'abord.
                </Text>
              ) : (
                <Button
                  title="Souscrire à Sérénité — 5 €/mois"
                  onPress={() => toggleAddon(true)}
                  loading={addonWorking}
                  disabled={addonWorking}
                  style={{ marginTop: spacing.md }}
                />
              )}
            </>
          ) : (
            // ─── État: souscrit ─────────────────────────────────────
            <>
              <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm }}>
                <Ionicons
                  name="checkmark-circle"
                  size={22}
                  color={colors.success}
                  style={{ marginTop: 2 }}
                />
                <View style={{ flex: 1 }}>
                  <Text variant="body" style={{ color: colors.text, fontWeight: '600' }}>
                    Abonnement Sérénité actif
                  </Text>
                  <Text variant="caption" color="textSecondary" style={{ marginTop: 2 }}>
                    5 €/mois facturés sur votre prochaine échéance.
                  </Text>
                </View>
              </View>
              <Pressable
                onPress={() => toggleAddon(false)}
                disabled={addonWorking}
                style={{ marginTop: spacing.md, opacity: addonWorking ? 0.5 : 1 }}
              >
                <Text variant="caption" style={{ color: colors.error, textDecorationLine: 'underline' }}>
                  {addonWorking ? 'Désactivation…' : "Désactiver l'abonnement"}
                </Text>
              </Pressable>
            </>
          )}
        </Card>

        {/* ── 3. Default deposit (inline editable) ───────── */}
        <Card
          padding="md"
          style={{ marginBottom: spacing.md, opacity: addonActive ? 1 : 0.5 }}
        >
          <View style={s.rowBetween}>
            <Text variant="label" color="textSecondary" style={s.sectionLabel}>
              Acompte par défaut
            </Text>
            <Switch
              value={enabled}
              onValueChange={(v) => {
                if (!addonActive) return;
                setEnabled(v);
                setEditing(true);
              }}
              disabled={!addonActive}
            />
          </View>
          <Text variant="body" style={{ marginTop: spacing.sm, color: colors.text }}>
            S'applique automatiquement à toutes les prestations qui n'ont pas leur propre acompte.
          </Text>

          {enabled && (
            <View style={{ marginTop: spacing.md, gap: spacing.md }}>
              <View>
                <Text variant="caption" color="textSecondary" style={{ marginBottom: spacing.xs }}>
                  Pourcentage du prix
                </Text>
                <View style={s.inputWrap}>
                  <TextInput
                    value={percent}
                    onChangeText={(v) => {
                      setPercent(v.replace(/[^0-9]/g, ''));
                      setEditing(true);
                    }}
                    keyboardType="number-pad"
                    editable={addonActive && enabled}
                    style={[
                      s.input,
                      {
                        borderColor: colors.border,
                        color: colors.text,
                        backgroundColor: colors.surface,
                      },
                    ]}
                    placeholder="30"
                    placeholderTextColor={colors.textSecondary}
                  />
                  <Text variant="body" style={[s.suffix, { color: colors.textSecondary }]}>
                    %
                  </Text>
                </View>
              </View>

              <View>
                <Text variant="caption" color="textSecondary" style={{ marginBottom: spacing.xs }}>
                  Délai de remboursement (avant le RDV)
                </Text>
                <View style={s.inputWrap}>
                  <TextInput
                    value={hours}
                    onChangeText={(v) => {
                      setHours(v.replace(/[^0-9]/g, ''));
                      setEditing(true);
                    }}
                    keyboardType="number-pad"
                    editable={addonActive && enabled}
                    style={[
                      s.input,
                      {
                        borderColor: colors.border,
                        color: colors.text,
                        backgroundColor: colors.surface,
                      },
                    ]}
                    placeholder="24"
                    placeholderTextColor={colors.textSecondary}
                  />
                  <Text variant="body" style={[s.suffix, { color: colors.textSecondary }]}>
                    heures
                  </Text>
                </View>
                <Text variant="caption" color="textSecondary" style={{ marginTop: spacing.xs }}>
                  0 = pas de remboursement automatique.
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

// ─── Helpers ──────────────────────────────────────────────────────────

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
          paddingVertical: 2,
        },
      ]}
    >
      <Text variant="caption" style={{ color: fg, fontWeight: '600' }}>
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
  sectionLabel: { textTransform: 'uppercase', letterSpacing: 0.5 },
  rowBetween: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  badge: { alignSelf: 'flex-start' },
  inputWrap: { position: 'relative' },
  input: {
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingRight: 56,
    paddingVertical: 12,
    fontSize: 16,
  },
  suffix: { position: 'absolute', right: 14, top: 12 },
});
