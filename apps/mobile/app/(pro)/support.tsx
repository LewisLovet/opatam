/**
 * Messagerie Opatam — le chat de support pro ↔ équipe, dans l'app.
 *
 * Temps réel Firestore (mêmes règles que le web : le pro n'écrit que des
 * messages `from: 'pro'`, les compteurs sont tenus par la Cloud Function).
 * La réponse d'un admin arrive aussi en notification push (trigger
 * onSupportMessageCreate) — cet écran est la destination naturelle.
 */

import React, { useEffect, useRef, useState } from 'react';
import {
  View,
  StyleSheet,
  FlatList,
  TextInput,
  Pressable,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import {
  addDoc,
  collection,
  doc,
  limitToLast,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
} from 'firebase/firestore';
import { db } from '@booking-app/firebase';
import { useTheme } from '../../theme';
import { Text } from '../../components';
import { useProvider } from '../../contexts';
import { useSupportChatEnabled } from '../../hooks';
import { SUPPORT_FAQ } from '@booking-app/shared';

interface MessageChat {
  id: string;
  from: 'pro' | 'admin';
  authorName?: string;
  text: string;
  createdAt: Date | null;
}

export default function SupportScreen() {
  const { t } = useTranslation();
  const { colors, spacing, radius } = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { provider } = useProvider();
  const providerId = provider?.id ?? null;

  const [messages, setMessages] = useState<MessageChat[] | null>(null);
  // Pré-chat : FAQ d'orientation avant la mise en relation. 'auto' = on
  // attend le premier snapshot pour router (fil existant → chat direct).
  const [vue, setVue] = useState<'auto' | 'accueil' | 'theme' | 'chat'>('auto');
  const [themeId, setThemeId] = useState<string | null>(null);
  const [questionOuverte, setQuestionOuverte] = useState<string | null>(null);
  const [topicEnAttente, setTopicEnAttente] = useState<string | null>(null);
  const [texte, setTexte] = useState('');
  const [envoi, setEnvoi] = useState(false);
  const listeRef = useRef<FlatList>(null);

  // Interrupteur Firebase (config/supportChat) — l'entrée de menu est déjà
  // masquée, ceci couvre les arrivées par notification ou lien direct.
  // `null` = config pas encore chargée : on attend avant de conclure.
  const chatActif = useSupportChatEnabled(providerId);
  useEffect(() => {
    if (chatActif === false) router.back();
  }, [chatActif, router]);

  useEffect(() => {
    if (!providerId) return;
    const q = query(
      collection(db, 'supportChats', providerId, 'messages'),
      orderBy('createdAt', 'asc'),
      limitToLast(200),
    );
    return onSnapshot(q, (snap) => {
      setVue((v) => (v === 'auto' ? (snap.docs.length > 0 ? 'chat' : 'accueil') : v));
      setMessages(
        snap.docs.map((d) => {
          const x = d.data();
          return {
            id: d.id,
            from: x.from === 'admin' ? 'admin' : 'pro',
            authorName: typeof x.authorName === 'string' ? x.authorName : undefined,
            text: typeof x.text === 'string' ? x.text : '',
            createdAt: x.createdAt?.toDate?.() ?? null,
          };
        }),
      );
    });
  }, [providerId]);

  // Écran ouvert → messages lus (les règles n'admettent que { proUnread: 0 }).
  useEffect(() => {
    if (!providerId || vue !== 'chat') return;
    void setDoc(doc(db, 'supportChats', providerId), { proUnread: 0 }, { merge: true }).catch(
      () => undefined,
    );
  }, [providerId, vue, messages?.length]);

  const envoyer = async () => {
    const contenu = texte.trim();
    if (!providerId || !contenu || envoi) return;
    setEnvoi(true);
    try {
      await addDoc(collection(db, 'supportChats', providerId, 'messages'), {
        from: 'pro',
        authorUid: providerId,
        text: contenu.slice(0, 2000),
        // Thème du pré-chat — recopié sur la conversation par la Cloud Function.
        ...(topicEnAttente ? { topic: topicEnAttente } : {}),
        createdAt: serverTimestamp(),
      });
      setTopicEnAttente(null);
      setTexte('');
    } finally {
      setEnvoi(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: colors.background }}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      {/* En-tête — bandeau primary, même convention que les autres écrans
          pro poussés (référence : members.tsx / availability.tsx). */}
      <View style={{ backgroundColor: colors.primary, paddingTop: insets.top }}>
        <View
          style={[
            s.entete,
            { paddingHorizontal: spacing.lg, paddingVertical: spacing.md },
          ]}
        >
          <Pressable
            onPress={() => {
              if (vue === 'theme') setVue('accueil');
              else if (vue === 'chat' && (messages?.length ?? 0) === 0) setVue(themeId ? 'theme' : 'accueil');
              else router.back();
            }}
            hitSlop={12}
            style={({ pressed }) => [{ opacity: pressed ? 0.7 : 1 }]}
          >
            <Ionicons name="chevron-back" size={24} color="#FFFFFF" />
          </Pressable>
          <View style={{ flex: 1, alignItems: 'center' }}>
            <Text variant="h3" style={{ fontWeight: '600', color: '#FFFFFF' }}>
              {t('proSupport.title')}
            </Text>
            <Text variant="caption" style={{ color: 'rgba(255,255,255,0.75)' }} numberOfLines={1}>
              {t('proSupport.subtitle')}
            </Text>
          </View>
          {/* Espaceur symétrique du chevron pour garder le titre centré */}
          <View style={{ width: 24 }} />
        </View>
      </View>

      {/* Pré-chat : accueil (thèmes) et questions fréquentes */}
      {(vue === 'accueil' || vue === 'theme') && (
        <FlatList
          data={vue === 'accueil' ? SUPPORT_FAQ : SUPPORT_FAQ.filter((th) => th.id === themeId)}
          keyExtractor={(th) => th.id}
          contentContainerStyle={{ padding: spacing.lg, gap: spacing.sm }}
          ListHeaderComponent={
            vue === 'accueil' ? (
              <View style={{ marginBottom: spacing.sm }}>
                <Text variant="h3">{t('proSupport.faq.greeting')}</Text>
                <Text variant="caption" color="textSecondary" style={{ marginTop: 2 }}>
                  {t('proSupport.faq.choose')}
                </Text>
              </View>
            ) : null
          }
          renderItem={({ item: th }) =>
            vue === 'accueil' ? (
              <Pressable
                onPress={() => {
                  setThemeId(th.id);
                  setQuestionOuverte(null);
                  setVue('theme');
                }}
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  borderWidth: 1,
                  borderColor: colors.border,
                  borderRadius: radius.lg,
                  backgroundColor: colors.surface,
                  paddingHorizontal: spacing.md,
                  paddingVertical: spacing.md,
                }}
              >
                <Text variant="body" style={{ fontWeight: '600' }}>{th.titre}</Text>
                <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
              </Pressable>
            ) : (
              <View style={{ gap: spacing.sm }}>
                <Text variant="body" style={{ fontWeight: '700', marginBottom: 2 }}>{th.titre}</Text>
                {th.entrees.map((e) => (
                  <View
                    key={e.question}
                    style={{
                      borderWidth: 1,
                      borderColor: colors.border,
                      borderRadius: radius.lg,
                      backgroundColor: colors.surface,
                      overflow: 'hidden',
                    }}
                  >
                    <Pressable
                      onPress={() => setQuestionOuverte(questionOuverte === e.question ? null : e.question)}
                      style={{
                        flexDirection: 'row',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        paddingHorizontal: spacing.md,
                        paddingVertical: spacing.md,
                        gap: spacing.sm,
                      }}
                    >
                      <Text variant="bodySmall" style={{ fontWeight: '600', flex: 1 }}>{e.question}</Text>
                      <Ionicons
                        name={questionOuverte === e.question ? 'chevron-up' : 'chevron-down'}
                        size={16}
                        color={colors.textMuted}
                      />
                    </Pressable>
                    {questionOuverte === e.question && (
                      <Text
                        variant="bodySmall"
                        color="textSecondary"
                        style={{ paddingHorizontal: spacing.md, paddingBottom: spacing.md, lineHeight: 20 }}
                      >
                        {e.reponse}
                      </Text>
                    )}
                  </View>
                ))}
              </View>
            )
          }
        />
      )}

      {/* Pied sticky du pré-chat : l'humain toujours à un tap */}
      {(vue === 'accueil' || vue === 'theme') && (
        <View
          style={{
            paddingHorizontal: spacing.lg,
            paddingTop: spacing.sm,
            paddingBottom: insets.bottom + spacing.sm,
            borderTopWidth: 1,
            borderTopColor: colors.border,
            backgroundColor: colors.surface,
          }}
        >
          <Pressable
            onPress={() => {
              setTopicEnAttente(vue === 'theme' ? themeId : null);
              setVue('chat');
            }}
            style={{
              borderRadius: radius.lg,
              backgroundColor: colors.primary,
              paddingVertical: spacing.md,
              alignItems: 'center',
            }}
          >
            <Text variant="body" style={{ color: '#fff', fontWeight: '700' }}>
              {vue === 'theme' ? t('proSupport.faq.notAnswered') : t('proSupport.faq.writeUs')}
            </Text>
          </Pressable>
        </View>
      )}

      {/* Fil */}
      {vue === 'chat' && (messages === null ? (
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <ActivityIndicator color={colors.primary} />
        </View>
      ) : (
        <FlatList
          ref={listeRef}
          data={messages}
          keyExtractor={(m) => m.id}
          contentContainerStyle={{ padding: spacing.lg, gap: spacing.sm, flexGrow: 1 }}
          onContentSizeChange={() => listeRef.current?.scrollToEnd({ animated: false })}
          ListEmptyComponent={
            <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: spacing.xl }}>
              <Ionicons name="chatbubbles-outline" size={40} color={colors.textMuted} />
              <Text variant="bodySmall" color="textSecondary" style={{ textAlign: 'center', marginTop: spacing.md }}>
                {t('proSupport.empty')}
              </Text>
            </View>
          }
          renderItem={({ item: m }) => (
            <View style={{ alignItems: m.from === 'pro' ? 'flex-end' : 'flex-start' }}>
              <View
                style={{
                  maxWidth: '82%',
                  borderRadius: radius.lg,
                  paddingHorizontal: spacing.md,
                  paddingVertical: spacing.sm,
                  backgroundColor: m.from === 'pro' ? colors.primary : colors.surface,
                  borderWidth: m.from === 'pro' ? 0 : 1,
                  borderColor: colors.border,
                }}
              >
                {m.from === 'admin' && (
                  <Text variant="caption" style={{ color: colors.primary, fontWeight: '700', marginBottom: 2 }}>
                    {m.authorName ?? t('proSupport.team')}
                  </Text>
                )}
                <Text
                  variant="body"
                  style={{ color: m.from === 'pro' ? '#fff' : colors.text }}
                >
                  {m.text}
                </Text>
                {m.createdAt && (
                  <Text
                    variant="caption"
                    style={{
                      color: m.from === 'pro' ? 'rgba(255,255,255,0.6)' : colors.textMuted,
                      textAlign: 'right',
                      marginTop: 2,
                      fontSize: 10,
                    }}
                  >
                    {m.createdAt.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </Text>
                )}
              </View>
            </View>
          )}
        />
      ))}

      {/* Saisie */}
      {vue === 'chat' && (
      <View
        style={[
          s.saisie,
          {
            paddingHorizontal: spacing.md,
            paddingTop: spacing.sm,
            paddingBottom: insets.bottom + spacing.sm,
            backgroundColor: colors.surface,
            borderTopColor: colors.border,
          },
        ]}
      >
        <TextInput
          value={texte}
          onChangeText={setTexte}
          placeholder={t('proSupport.placeholder')}
          placeholderTextColor={colors.textMuted}
          multiline
          style={[
            s.champ,
            {
              backgroundColor: colors.background,
              borderColor: colors.border,
              color: colors.text,
              borderRadius: radius.lg,
            },
          ]}
        />
        <Pressable
          onPress={() => void envoyer()}
          disabled={envoi || !texte.trim()}
          style={[
            s.envoyer,
            { backgroundColor: colors.primary, opacity: envoi || !texte.trim() ? 0.4 : 1 },
          ]}
        >
          <Ionicons name="send" size={18} color="#fff" />
        </Pressable>
      </View>
      )}
    </KeyboardAvoidingView>
  );
}

const s = StyleSheet.create({
  entete: { flexDirection: 'row', alignItems: 'center' },
  saisie: { flexDirection: 'row', alignItems: 'flex-end', gap: 8, borderTopWidth: 1 },
  champ: {
    flex: 1,
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 10,
    fontSize: 15,
    maxHeight: 110,
  },
  envoyer: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
