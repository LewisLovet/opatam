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
  const [texte, setTexte] = useState('');
  const [envoi, setEnvoi] = useState(false);
  const listeRef = useRef<FlatList>(null);

  useEffect(() => {
    if (!providerId) return;
    const q = query(
      collection(db, 'supportChats', providerId, 'messages'),
      orderBy('createdAt', 'asc'),
      limitToLast(200),
    );
    return onSnapshot(q, (snap) => {
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
    if (!providerId) return;
    void setDoc(doc(db, 'supportChats', providerId), { proUnread: 0 }, { merge: true }).catch(
      () => undefined,
    );
  }, [providerId, messages?.length]);

  const envoyer = async () => {
    const contenu = texte.trim();
    if (!providerId || !contenu || envoi) return;
    setEnvoi(true);
    try {
      await addDoc(collection(db, 'supportChats', providerId, 'messages'), {
        from: 'pro',
        authorUid: providerId,
        text: contenu.slice(0, 2000),
        createdAt: serverTimestamp(),
      });
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
      {/* En-tête */}
      <View
        style={[
          s.entete,
          {
            paddingTop: insets.top + spacing.sm,
            paddingHorizontal: spacing.lg,
            paddingBottom: spacing.md,
            backgroundColor: colors.surface,
            borderBottomColor: colors.border,
          },
        ]}
      >
        <Pressable onPress={() => router.back()} hitSlop={12} style={{ marginRight: spacing.md }}>
          <Ionicons name="arrow-back" size={24} color={colors.text} />
        </Pressable>
        <View style={{ flex: 1 }}>
          <Text variant="h3">{t('proSupport.title')}</Text>
          <Text variant="caption" color="textSecondary">
            {t('proSupport.subtitle')}
          </Text>
        </View>
      </View>

      {/* Fil */}
      {messages === null ? (
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
      )}

      {/* Saisie */}
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
    </KeyboardAvoidingView>
  );
}

const s = StyleSheet.create({
  entete: { flexDirection: 'row', alignItems: 'center', borderBottomWidth: 1 },
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
