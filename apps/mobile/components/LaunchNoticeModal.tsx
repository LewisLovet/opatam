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
import { LinearGradient } from 'expo-linear-gradient';
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
        <View style={[s.card, { backgroundColor: colors.surface }]}>
          <ScrollView bounces={false} showsVerticalScrollIndicator={false} style={{ maxHeight: '100%' }}>
            {/* En-tête de marque : la nouveauté est annoncée par Opatam */}
            <LinearGradient
              colors={['#2A4AA5', '#1B2F6E', '#152551']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={s.hero}
            >
              <View style={s.heroDecor1} />
              <View style={s.heroDecor2} />
              <View style={s.heroTop}>
                <View style={s.badge}>
                  <Ionicons name="rocket-outline" size={12} color="#1B2F6E" />
                  <Text style={s.badgeText}>{t('components.launchNotice.badge')}</Text>
                </View>
                <Pressable onPress={fermer} hitSlop={10} style={s.close}>
                  <Ionicons name="close" size={18} color="#fff" />
                </Pressable>
              </View>
              <View style={s.heroIcon}>
                <Ionicons name={(n.iconName || 'megaphone') as never} size={30} color="#1B2F6E" />
              </View>
              <Text style={s.heroTitle}>{n.title}</Text>
              {n.body ? <Text style={s.heroSub}>{n.body}</Text> : null}
            </LinearGradient>

            <View style={s.body}>
              {n.imageUrl ? <DetailImage uri={n.imageUrl} /> : null}
              <Text variant="body" style={{ color: colors.text, lineHeight: 23, fontSize: 15 }}>
                {n.modalBody || n.body}
              </Text>

              {n.ctaArticleSlug && n.ctaThumbUrl ? (
                <View style={s.tutoCard}>
                  <View style={s.tutoLabelRow}>
                    <Ionicons name="play-circle" size={14} color="#F4C928" />
                    <Text style={s.tutoLabel}>
                      {n.ctaIsVideo ? t('components.launchNotice.videoTuto') : t('components.notificationsDrawer.viewTutorial')}
                    </Text>
                  </View>
                  <Thumb uri={n.ctaThumbUrl} isVideo={n.ctaIsVideo} height={168} onPress={() => ouvrirTuto(n.ctaArticleSlug!)} />
                </View>
              ) : null}

              <View style={[s.actions, { paddingBottom: Math.max(6, insets.bottom - 8) }]}>
                {n.ctaArticleSlug ? (
                  <Pressable
                    onPress={() => ouvrirTuto(n.ctaArticleSlug!)}
                    style={({ pressed }) => [{ opacity: pressed ? 0.9 : 1, borderRadius: 16, overflow: 'hidden' }]}
                  >
                    <LinearGradient colors={['#2A4AA5', '#1B2F6E']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={s.primary}>
                      <Ionicons name={n.ctaIsVideo ? 'play-circle' : 'book'} size={20} color="#fff" />
                      <Text style={s.primaryText}>
                        {n.ctaLabel ||
                          (n.ctaIsVideo
                            ? t('components.notificationsDrawer.watchVideo')
                            : t('components.notificationsDrawer.viewTutorial'))}
                      </Text>
                    </LinearGradient>
                  </Pressable>
                ) : (
                  <Pressable onPress={fermer} style={({ pressed }) => [{ opacity: pressed ? 0.9 : 1, borderRadius: 16, overflow: 'hidden' }]}>
                    <LinearGradient colors={['#2A4AA5', '#1B2F6E']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={s.primary}>
                      <Text style={s.primaryText}>{t('components.launchNotice.gotIt')}</Text>
                    </LinearGradient>
                  </Pressable>
                )}
                <Pressable onPress={fermer} hitSlop={8} style={s.later}>
                  <Text style={{ color: colors.textSecondary, fontSize: 14, fontWeight: '600' }}>
                    {t('components.launchNotice.later')}
                  </Text>
                </Pressable>
              </View>
            </View>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

const s = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(8,15,40,0.65)', alignItems: 'center', justifyContent: 'center', padding: 16 },
  card: {
    width: '100%',
    maxHeight: '88%',
    borderRadius: 26,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 14 },
    shadowOpacity: 0.3,
    shadowRadius: 32,
    elevation: 14,
  },
  hero: { paddingHorizontal: 22, paddingTop: 18, paddingBottom: 24, overflow: 'hidden' },
  heroDecor1: { position: 'absolute', top: -70, right: -50, width: 200, height: 200, borderRadius: 100, backgroundColor: 'rgba(244,201,40,0.14)' },
  heroDecor2: { position: 'absolute', bottom: -90, left: -60, width: 220, height: 220, borderRadius: 110, backgroundColor: 'rgba(255,255,255,0.06)' },
  heroTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 18 },
  badge: { flexDirection: 'row', alignItems: 'center', gap: 5, borderRadius: 999, paddingHorizontal: 10, paddingVertical: 5, backgroundColor: '#F4C928' },
  badgeText: { color: '#1B2F6E', fontSize: 11, fontWeight: '800', letterSpacing: 1.4 },
  close: { width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(255,255,255,0.16)' },
  heroIcon: { width: 60, height: 60, borderRadius: 30, backgroundColor: '#FFFFFF', alignItems: 'center', justifyContent: 'center', marginBottom: 14 },
  heroTitle: { color: '#FFFFFF', fontSize: 25, lineHeight: 30, fontWeight: '800', letterSpacing: -0.4 },
  heroSub: { color: 'rgba(255,255,255,0.82)', fontSize: 14, lineHeight: 20, marginTop: 8 },
  body: { padding: 20, gap: 16 },
  tutoCard: { gap: 8 },
  tutoLabelRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  tutoLabel: { color: '#1B2F6E', fontSize: 11, fontWeight: '800', letterSpacing: 1.2, textTransform: 'uppercase' },
  actions: { gap: 6, paddingTop: 4 },
  primary: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 15 },
  primaryText: { color: '#fff', fontSize: 16, fontWeight: '800' },
  later: { alignItems: 'center', paddingVertical: 10 },
});
