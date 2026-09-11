/**
 * Fenêtre « Nouveau » au démarrage — pour les MISES À JOUR MAJEURES seulement.
 *
 * Ce n'est pas un second système : c'est une notification in-app ordinaire
 * (même contenu, même image, même tutoriel vidéo lié) que l'équipe a marquée
 * « afficher au démarrage » dans l'admin. Règles, pour ne pas user le canal :
 *   - une seule par lancement, la plus récente ;
 *   - jamais deux fois : elle est marquée LUE dès l'affichage (notificationReads),
 *     ce qui vaut sur tous les appareils du compte ;
 *   - elle expire : passé 14 jours après publication, elle reste dans le
 *     panneau mais ne s'impose plus ;
 *   - pas pendant l'accueil de bienvenue, ni pour une page non publiée
 *     (le prestataire a d'autres priorités) — c'est l'appelant qui gate.
 */

import React, { useEffect, useRef, useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Text } from './Text';
import { useTheme } from '../theme';
import { DetailImage, Thumb } from './NotificationsDrawer';
import type { ProviderNotificationItem } from '../hooks/useProviderNotifications';

/** Au-delà, la nouveauté n'est plus « nouvelle » : plus de fenêtre. */
export const LAUNCH_NOTICE_MAX_AGE_DAYS = 14;

/** La notification à imposer au démarrage, ou `null`. */
export function pickLaunchNotice(
  notifications: ProviderNotificationItem[],
  now: number = Date.now(),
): ProviderNotificationItem | null {
  const limite = now - LAUNCH_NOTICE_MAX_AGE_DAYS * 86_400_000;
  return (
    notifications.find(
      (n) => n.showAtLaunch === true && !n.isRead && n.publishedAtMs > 0 && n.publishedAtMs >= limite,
    ) ?? null
  );
}

interface Props {
  notice: ProviderNotificationItem | null;
  /** Autres fenêtres prioritaires ouvertes (bienvenue…) : on attend. */
  enabled: boolean;
  onMarkRead: (id: string) => void;
}

export function LaunchNoticeModal({ notice, enabled, onMarkRead }: Props) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const [ouvert, setOuvert] = useState<ProviderNotificationItem | null>(null);
  // Une seule fenêtre par lancement, même si la liste change ensuite.
  const dejaMontre = useRef(false);

  useEffect(() => {
    if (!enabled || !notice || dejaMontre.current) return;
    dejaMontre.current = true;
    setOuvert(notice);
    // Lue dès l'affichage : plus jamais imposée, sur aucun appareil.
    onMarkRead(notice.id);
  }, [enabled, notice, onMarkRead]);

  if (!ouvert) return null;
  const n = ouvert;
  const fermer = () => setOuvert(null);
  const ouvrirTuto = (slug: string) => {
    fermer();
    setTimeout(() => router.push(`/(pro)/help/${slug}` as never), 60);
  };

  return (
    <Modal visible transparent animationType="fade" onRequestClose={fermer}>
      <View style={s.overlay}>
        <View style={[s.card, { backgroundColor: colors.surface, maxHeight: '86%' }]}>
          <ScrollView contentContainerStyle={{ padding: 22, paddingBottom: 18 }} showsVerticalScrollIndicator={false}>
            <View style={s.head}>
              <View style={[s.badge, { backgroundColor: colors.primary }]}>
                <Ionicons name="rocket-outline" size={12} color="#fff" />
                <Text style={s.badgeText}>{t('components.launchNotice.badge')}</Text>
              </View>
              <Pressable onPress={fermer} hitSlop={10} style={[s.close, { backgroundColor: colors.surfaceSecondary }]}>
                <Ionicons name="close" size={18} color={colors.textSecondary} />
              </Pressable>
            </View>

            <View style={[s.icon, { backgroundColor: colors.primary + '1A' }]}>
              <Ionicons name={(n.iconName || 'megaphone') as never} size={28} color={colors.primary} />
            </View>
            <Text variant="h2" style={{ fontWeight: '800', marginBottom: 12 }}>{n.title}</Text>

            {n.imageUrl ? <DetailImage uri={n.imageUrl} /> : null}

            <Text variant="body" style={{ color: colors.text, lineHeight: 22 }}>
              {n.modalBody || n.body}
            </Text>

            {n.ctaArticleSlug && n.ctaThumbUrl ? (
              <View style={{ marginTop: 18 }}>
                <Thumb uri={n.ctaThumbUrl} isVideo={n.ctaIsVideo} height={170} onPress={() => ouvrirTuto(n.ctaArticleSlug!)} />
              </View>
            ) : null}
          </ScrollView>

          <View style={[s.actions, { borderTopColor: colors.border, paddingBottom: Math.max(14, insets.bottom) }]}>
            <Pressable onPress={fermer} style={[s.secondary, { borderColor: colors.border }]}>
              <Text variant="body" style={{ color: colors.text, fontWeight: '600' }}>
                {t('components.launchNotice.later')}
              </Text>
            </Pressable>
            {n.ctaArticleSlug ? (
              <Pressable
                onPress={() => ouvrirTuto(n.ctaArticleSlug!)}
                style={({ pressed }) => [s.primary, { backgroundColor: colors.primary, opacity: pressed ? 0.9 : 1 }]}
              >
                <Ionicons name={n.ctaIsVideo ? 'play-circle' : 'book'} size={18} color="#fff" />
                <Text variant="body" style={{ color: '#fff', fontWeight: '700' }}>
                  {n.ctaLabel ||
                    (n.ctaIsVideo
                      ? t('components.notificationsDrawer.watchVideo')
                      : t('components.notificationsDrawer.viewTutorial'))}
                </Text>
              </Pressable>
            ) : (
              <Pressable onPress={fermer} style={({ pressed }) => [s.primary, { backgroundColor: colors.primary, opacity: pressed ? 0.9 : 1 }]}>
                <Text variant="body" style={{ color: '#fff', fontWeight: '700' }}>
                  {t('components.launchNotice.gotIt')}
                </Text>
              </Pressable>
            )}
          </View>
        </View>
      </View>
    </Modal>
  );
}

const s = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(8,15,40,0.6)', alignItems: 'center', justifyContent: 'center', padding: 18 },
  card: {
    width: '100%',
    borderRadius: 24,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.25,
    shadowRadius: 30,
    elevation: 12,
  },
  head: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 },
  badge: { flexDirection: 'row', alignItems: 'center', gap: 5, borderRadius: 999, paddingHorizontal: 10, paddingVertical: 5 },
  badgeText: { color: '#fff', fontSize: 11, fontWeight: '800', letterSpacing: 1.2 },
  close: { width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  icon: { width: 56, height: 56, borderRadius: 28, alignItems: 'center', justifyContent: 'center', marginBottom: 12 },
  actions: { flexDirection: 'row', gap: 10, paddingHorizontal: 18, paddingTop: 12, borderTopWidth: 1 },
  secondary: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingVertical: 13, borderRadius: 14, borderWidth: 1 },
  primary: { flex: 1.4, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 13, borderRadius: 14 },
});
