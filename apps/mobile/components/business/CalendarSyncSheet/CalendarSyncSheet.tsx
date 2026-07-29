/**
 * CalendarSyncSheet — abonnement du planning à l'agenda du téléphone.
 *
 * Le pro s'abonne UNE fois : ensuite ses rendez-vous arrivent seuls dans
 * Apple Calendar (ou Google Agenda, ou Outlook), une annulation retire
 * l'événement, un déplacement le fait bouger. Aucune connexion Google,
 * aucun module natif — on ouvre simplement un lien `webcal://` que le
 * système reconnaît et l'agenda fait le reste.
 *
 * C'est pour ça que le parcours vit dans l'APP et non sur le web :
 * l'abonnement doit se prendre sur l'appareil qui porte l'agenda. Passer
 * par un ordinateur obligerait à transporter l'URL jusqu'au téléphone.
 *
 * Deux choses à dire au pro, et elles sont dans l'écran :
 *  - le délai de rafraîchissement lui appartient (réglage de son agenda),
 *    sinon il croira que c'est cassé en voyant un RDV arriver en retard ;
 *  - l'agenda est en lecture seule, les modifications se font ici.
 */

import React from 'react';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, Linking, Pressable, ScrollView, View } from 'react-native';
import * as Clipboard from 'expo-clipboard';
import { Ionicons } from '@expo/vector-icons';
import { OverlaySheet } from '../../OverlaySheet';
import { Text } from '../../Text';
import { Button } from '../../Button';
import { useToast } from '../../Toast';
import { useTheme } from '../../../theme';
import { useAuth } from '../../../contexts';
import { API_URL } from '../../../lib/config';

export interface CalendarSyncSheetProps {
  visible: boolean;
  onClose: () => void;
}

interface FeedState {
  enabled: boolean;
  url: string | null;
  webcalUrl: string | null;
  lastAccessAt: string | null;
}

export function CalendarSyncSheet({ visible, onClose }: CalendarSyncSheetProps) {
  const { colors, spacing, radius } = useTheme();
  const { t } = useTranslation();
  const { user } = useAuth();
  const { showToast } = useToast();

  const [state, setState] = React.useState<FeedState | null>(null);
  const [loading, setLoading] = React.useState(false);
  const [working, setWorking] = React.useState(false);

  const call = React.useCallback(
    async (method: 'GET' | 'POST' | 'DELETE'): Promise<FeedState | null> => {
      if (!user) return null;
      const token = await user.getIdToken();
      const ctrl = new AbortController();
      const timer = setTimeout(() => ctrl.abort(), 10000);
      try {
        const res = await fetch(`${API_URL}/api/pro/calendar-feed`, {
          method,
          headers: { Authorization: `Bearer ${token}` },
          signal: ctrl.signal,
        });
        if (!res.ok) return null;
        return (await res.json()) as FeedState;
      } catch {
        return null;
      } finally {
        clearTimeout(timer);
      }
    },
    [user],
  );

  // Chaque ouverture relit l'état : le pro a pu se désabonner depuis son
  // agenda, ou régénérer le lien depuis le web.
  React.useEffect(() => {
    if (!visible) return;
    let cancelled = false;
    setLoading(true);
    void call('GET').then((next) => {
      if (!cancelled) {
        setState(next);
        setLoading(false);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [visible, call]);

  const activate = async () => {
    setWorking(true);
    const next = await call('POST');
    setWorking(false);
    if (!next) {
      showToast({ variant: 'error', message: t('calendarSync.error') });
      return;
    }
    setState(next);
  };

  const subscribe = async () => {
    if (!state?.webcalUrl) return;
    // `openURL` suffit : contrairement à `canOpenURL`, il n'exige pas de
    // déclarer le schéma dans le manifeste — donc pas de nouveau build.
    Linking.openURL(state.webcalUrl).catch(() => {
      showToast({ variant: 'error', message: t('calendarSync.openFailed') });
    });
  };

  /**
   * Abonnement Google en un clic.
   *
   * Google Agenda accepte une URL d'abonnement en paramètre `cid` : la
   * page s'ouvre avec « Ajouter ce calendrier ? » et il ne reste qu'à
   * confirmer. Bien mieux qu'un copier-coller.
   *
   * MAIS l'application mobile Google Agenda ne sait pas ajouter un
   * calendrier par URL — seul le site le permet. Le lien ouvre donc le
   * navigateur, et sur téléphone Google renvoie souvent vers son app.
   * D'où l'avertissement affiché juste en dessous : cette opération se
   * fait depuis un ordinateur. Une fois faite, elle redescend toute
   * seule dans l'app mobile.
   */
  const addToGoogle = async () => {
    if (!state?.webcalUrl) return;
    const url = `https://calendar.google.com/calendar/r?cid=${encodeURIComponent(state.webcalUrl)}`;
    Linking.openURL(url).catch(() => {
      showToast({ variant: 'error', message: t('calendarSync.openFailed') });
    });
  };

  const copy = async () => {
    if (!state?.url) return;
    await Clipboard.setStringAsync(state.url);
    showToast({ variant: 'success', message: t('calendarSync.copied') });
  };

  const disable = async () => {
    setWorking(true);
    const next = await call('DELETE');
    setWorking(false);
    if (next) setState(next);
  };

  const lastAccessLabel = React.useMemo(() => {
    if (!state?.lastAccessAt) return null;
    const ms = Date.now() - Date.parse(state.lastAccessAt);
    if (Number.isNaN(ms)) return null;
    const minutes = Math.max(0, Math.round(ms / 60000));
    if (minutes < 60) return t('calendarSync.lastSyncMinutes', { count: minutes });
    const hours = Math.round(minutes / 60);
    if (hours < 48) return t('calendarSync.lastSyncHours', { count: hours });
    return t('calendarSync.lastSyncDays', { count: Math.round(hours / 24) });
  }, [state?.lastAccessAt, t]);

  return (
    <OverlaySheet visible={visible} onClose={working ? () => {} : onClose} heightPct={0.72}>
      <ScrollView contentContainerStyle={{ padding: spacing.lg, paddingBottom: spacing['3xl'] }}>
        <View style={{ alignItems: 'center', marginBottom: spacing.lg }}>
          <View
            style={{
              width: 52,
              height: 52,
              borderRadius: radius.lg,
              backgroundColor: colors.primaryLight,
              alignItems: 'center',
              justifyContent: 'center',
              marginBottom: spacing.md,
            }}
          >
            <Ionicons name="sync-outline" size={26} color={colors.primary} />
          </View>
          <Text variant="h3" style={{ textAlign: 'center' }}>
            {t('calendarSync.title')}
          </Text>
          <Text
            variant="bodySmall"
            color="textSecondary"
            style={{ textAlign: 'center', marginTop: spacing.xs }}
          >
            {t('calendarSync.subtitle')}
          </Text>
        </View>

        {loading ? (
          <ActivityIndicator color={colors.primary} style={{ marginVertical: spacing.xl }} />
        ) : !state?.enabled ? (
          <>
            <Text variant="bodySmall" color="textSecondary" style={{ marginBottom: spacing.lg }}>
              {t('calendarSync.intro')}
            </Text>
            <Button
              title={t('calendarSync.activate')}
              onPress={activate}
              loading={working}
              fullWidth
            />
          </>
        ) : (
          <>
            <Button
              title={t('calendarSync.addToCalendar')}
              onPress={subscribe}
              fullWidth
              leftIcon={<Ionicons name="calendar-outline" size={18} color="#FFFFFF" />}
            />

            <Pressable
              onPress={addToGoogle}
              style={({ pressed }) => ({
                marginTop: spacing.sm,
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'center',
                gap: spacing.sm,
                paddingVertical: spacing.md,
                borderRadius: radius.md,
                borderWidth: 1,
                borderColor: colors.border,
                backgroundColor: pressed ? colors.surfaceSecondary : 'transparent',
              })}
            >
              <Ionicons name="logo-google" size={16} color={colors.textSecondary} />
              <Text variant="bodySmall" style={{ fontWeight: '600' }}>
                {t('calendarSync.addToGoogle')}
              </Text>
            </Pressable>
            <Text variant="caption" color="textMuted" style={{ marginTop: spacing.xs }}>
              {t('calendarSync.googleHint')}
            </Text>

            <Pressable
              onPress={copy}
              style={({ pressed }) => ({
                marginTop: spacing.md,
                padding: spacing.md,
                borderRadius: radius.md,
                borderWidth: 1,
                borderColor: colors.border,
                backgroundColor: pressed ? colors.surfaceSecondary : 'transparent',
              })}
            >
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
                <Ionicons name="copy-outline" size={16} color={colors.textSecondary} />
                <Text variant="caption" color="textSecondary" style={{ flex: 1 }}>
                  {t('calendarSync.copyHint')}
                </Text>
              </View>
              <Text variant="caption" numberOfLines={1} style={{ marginTop: spacing.xs }}>
                {state.url}
              </Text>
            </Pressable>

            {/* Preuve que ça tourne vraiment — et signal quand ça s'arrête. */}
            {lastAccessLabel && (
              <Text variant="caption" color="textMuted" style={{ marginTop: spacing.md }}>
                {lastAccessLabel}
              </Text>
            )}

            <View
              style={{
                marginTop: spacing.lg,
                padding: spacing.md,
                borderRadius: radius.md,
                backgroundColor: colors.surfaceSecondary,
              }}
            >
              <Text variant="caption" color="textSecondary">
                {t('calendarSync.noticeDelay')}
              </Text>
              <Text variant="caption" color="textSecondary" style={{ marginTop: spacing.xs }}>
                {t('calendarSync.noticeReadOnly')}
              </Text>
            </View>

            {/* Pas de « régénérer le lien » : la notion ne parle à
                personne, et se retrouver déconnecté de son agenda sans
                comprendre pourquoi est pire que le risque qu'elle couvre.
                Désactiver puis réactiver produit le même effet, avec des
                mots que le pro comprend. */}
            <Button
              title={t('calendarSync.disable')}
              variant="ghost"
              size="sm"
              onPress={disable}
              loading={working}
              fullWidth
              style={{ marginTop: spacing.lg }}
            />
          </>
        )}
      </ScrollView>
    </OverlaySheet>
  );
}
