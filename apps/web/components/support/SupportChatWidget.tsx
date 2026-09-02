'use client';

import { useEffect, useRef, useState } from 'react';
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
import { useAuth } from '@/contexts/AuthContext';
import { useSupportChatEnabled } from '@/hooks/useSupportChatEnabled';
import { ArrowLeft, ChevronDown, ChevronRight, MessageCircle, Send, X } from 'lucide-react';
import { SUPPORT_FAQ } from '@booking-app/shared';

/**
 * Chat de support pro ↔ équipe Opatam — la bulle flottante de l'espace pro.
 *
 * Temps réel Firestore des deux côtés : le pro écrit ses messages
 * (from: 'pro', règles de sécurité), la Cloud Function
 * onSupportMessageCreate tient les compteurs et prévient l'équipe.
 * Objectif : rassurer — une question posée ici obtient une réponse
 * humaine, sans quitter l'application.
 */

interface MessageChat {
  id: string;
  from: 'pro' | 'admin';
  authorName?: string;
  text: string;
  createdAt: Date | null;
}

function heure(d: Date | null): string {
  return d
    ? d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })
    : '';
}

export function SupportChatWidget() {
  const { user, isAdmin } = useAuth();
  const providerId = user?.id ?? null;
  // Interrupteur Firebase (config/supportChat) — bulle masquée tant que le
  // chat n'est pas ouvert à ce compte. Les admins le voient toujours.
  const chatActif = useSupportChatEnabled(providerId, isAdmin);

  const [ouvert, setOuvert] = useState(false);
  // Pré-chat : la FAQ oriente AVANT la mise en relation. Un pro qui a déjà
  // une conversation retombe directement sur son fil.
  const [vue, setVue] = useState<'accueil' | 'theme' | 'chat'>('accueil');
  const [themeId, setThemeId] = useState<string | null>(null);
  const [questionOuverte, setQuestionOuverte] = useState<string | null>(null);
  const [aDejaEchange, setADejaEchange] = useState(false);
  const [topicEnAttente, setTopicEnAttente] = useState<string | null>(null);
  const [messages, setMessages] = useState<MessageChat[]>([]);
  const [nonLus, setNonLus] = useState(0);
  const [texte, setTexte] = useState('');
  const [envoi, setEnvoi] = useState(false);
  const finRef = useRef<HTMLDivElement>(null);

  // Compteur de non-lus (réponses de l'équipe) — badge sur la bulle.
  useEffect(() => {
    if (!providerId) return;
    return onSnapshot(
      doc(db, 'supportChats', providerId),
      (snap) => {
        setNonLus(snap.data()?.proUnread ?? 0);
        setADejaEchange(snap.exists());
      },
      () => setNonLus(0),
    );
  }, [providerId]);

  // Ouverture : conversation en cours → le fil ; sinon → l'accueil FAQ.
  useEffect(() => {
    if (ouvert) setVue(aDejaEchange ? 'chat' : 'accueil');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ouvert]);

  // Les messages — abonnés seulement quand le panneau est ouvert.
  useEffect(() => {
    if (!providerId || !ouvert || vue !== 'chat') return;
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
  }, [providerId, ouvert, vue]);

  // Ouverture → lu (les règles n'autorisent que { proUnread: 0 }).
  useEffect(() => {
    if (!providerId || !ouvert || vue !== 'chat' || nonLus === 0) return;
    void setDoc(doc(db, 'supportChats', providerId), { proUnread: 0 }, { merge: true }).catch(
      () => undefined,
    );
  }, [providerId, ouvert, vue, nonLus]);

  useEffect(() => {
    finRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, ouvert]);

  const envoyer = async () => {
    const contenu = texte.trim();
    if (!providerId || !contenu || envoi) return;
    setEnvoi(true);
    try {
      await addDoc(collection(db, 'supportChats', providerId, 'messages'), {
        from: 'pro',
        authorUid: providerId,
        text: contenu.slice(0, 2000),
        // Le thème choisi dans le pré-chat — la Cloud Function le recopie
        // sur la conversation, l'admin le voit avant de lire.
        ...(topicEnAttente ? { topic: topicEnAttente } : {}),
        createdAt: serverTimestamp(),
      });
      setTopicEnAttente(null);
      setTexte('');
    } finally {
      setEnvoi(false);
    }
  };

  if (!providerId || chatActif !== true) return null;

  return (
    <>
      {/* La bulle */}
      <button
        onClick={() => setOuvert((v) => !v)}
        aria-label="Chat avec l'équipe Opatam"
        className="fixed bottom-5 right-5 z-40 w-13 h-13 p-3.5 rounded-full bg-gray-900 dark:bg-white text-white dark:text-gray-900 shadow-lg hover:scale-105 transition-transform"
      >
        {ouvert ? <X className="w-6 h-6" /> : <MessageCircle className="w-6 h-6" />}
        {!ouvert && nonLus > 0 && (
          <span className="absolute -top-1 -right-1 min-w-[20px] h-5 px-1 rounded-full bg-red-500 text-white text-[10px] font-bold inline-flex items-center justify-center">
            {nonLus > 9 ? '9+' : nonLus}
          </span>
        )}
      </button>

      {/* Le panneau */}
      {ouvert && (
        <div className="fixed bottom-20 right-5 z-40 w-[min(92vw,380px)] h-[min(70vh,520px)] rounded-2xl bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 shadow-2xl flex flex-col overflow-hidden">
          <div className="px-4 py-3 bg-gray-900 dark:bg-gray-950 text-white flex items-center gap-2.5">
            {vue !== 'accueil' && !(vue === 'chat' && aDejaEchange) && (
              <button
                onClick={() => setVue(vue === 'chat' ? (themeId ? 'theme' : 'accueil') : 'accueil')}
                aria-label="Retour"
                className="p-1 -ml-1 rounded-lg hover:bg-white/10"
              >
                <ArrowLeft className="w-4 h-4" />
              </button>
            )}
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold">L&apos;équipe Opatam</p>
              <p className="text-[11px] text-gray-300 truncate">
                {vue === 'chat'
                  ? 'Nous répondons en personne — en général sous quelques heures ouvrées.'
                  : 'Une réponse tout de suite, ou un humain juste derrière.'}
              </p>
            </div>
            {vue === 'chat' && !aDejaEchange && (
              <button
                onClick={() => setVue('accueil')}
                className="text-[10px] font-semibold text-gray-300 hover:text-white whitespace-nowrap"
              >
                Questions fréquentes
              </button>
            )}
          </div>

          {/* ── Accueil : les thèmes ── */}
          {vue === 'accueil' && (
            <div className="flex-1 overflow-y-auto px-4 py-4 bg-gray-50 dark:bg-gray-950/40">
              <p className="text-sm font-semibold text-gray-900 dark:text-white mb-1">
                Bonjour 👋
              </p>
              <p className="text-xs text-gray-500 dark:text-gray-400 mb-3">
                Comment pouvons-nous aider ? Choisissez un thème — ou écrivez-nous directement.
              </p>
              <div className="space-y-2">
                {SUPPORT_FAQ.map((theme) => (
                  <button
                    key={theme.id}
                    onClick={() => {
                      setThemeId(theme.id);
                      setQuestionOuverte(null);
                      setVue('theme');
                    }}
                    className="w-full flex items-center justify-between gap-2 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 px-3.5 py-2.5 text-sm font-medium text-gray-900 dark:text-white hover:border-gray-400 dark:hover:border-gray-500 transition-colors text-left"
                  >
                    {theme.titre}
                    <ChevronRight className="w-4 h-4 text-gray-300 flex-shrink-0" />
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* ── Thème : les questions fréquentes ── */}
          {vue === 'theme' && (() => {
            const theme = SUPPORT_FAQ.find((t) => t.id === themeId);
            if (!theme) return null;
            return (
              <div className="flex-1 overflow-y-auto px-4 py-4 bg-gray-50 dark:bg-gray-950/40">
                <p className="text-sm font-semibold text-gray-900 dark:text-white mb-3">
                  {theme.titre}
                </p>
                <div className="space-y-2">
                  {theme.entrees.map((e) => (
                    <div
                      key={e.question}
                      className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 overflow-hidden"
                    >
                      <button
                        onClick={() =>
                          setQuestionOuverte(questionOuverte === e.question ? null : e.question)
                        }
                        aria-expanded={questionOuverte === e.question}
                        className="w-full flex items-center justify-between gap-2 px-3.5 py-2.5 text-left text-sm font-medium text-gray-900 dark:text-white"
                      >
                        {e.question}
                        <ChevronDown
                          className={`w-4 h-4 text-gray-300 flex-shrink-0 transition-transform ${
                            questionOuverte === e.question ? 'rotate-180' : ''
                          }`}
                        />
                      </button>
                      {questionOuverte === e.question && (
                        <div className="px-3.5 pb-3 text-xs text-gray-600 dark:text-gray-300 leading-relaxed">
                          {e.reponse}
                          {e.lienWeb && (
                            <a
                              href={e.lienWeb.href}
                              className="block mt-1.5 font-semibold text-red-600 dark:text-red-400 hover:underline"
                            >
                              {e.lienWeb.label} →
                            </a>
                          )}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            );
          })()}

          {/* ── Pied sticky : l'humain toujours à un clic ── */}
          {(vue === 'accueil' || vue === 'theme') && (
            <div className="p-3 border-t border-gray-100 dark:border-gray-800 bg-white dark:bg-gray-900">
              <button
                onClick={() => {
                  setTopicEnAttente(vue === 'theme' ? themeId : null);
                  setVue('chat');
                }}
                className="w-full rounded-xl bg-gray-900 dark:bg-white text-white dark:text-gray-900 px-3.5 py-2.5 text-sm font-semibold hover:opacity-90"
              >
                {vue === 'theme'
                  ? 'Ça ne répond pas à ma question — écrire à l\u2019équipe'
                  : 'Écrire à l\u2019équipe'}
              </button>
            </div>
          )}

          {vue === 'chat' && (
          <>
          <div className="flex-1 overflow-y-auto px-3.5 py-3 space-y-2.5 bg-gray-50 dark:bg-gray-950/40">
            {messages.length === 0 && (
              <p className="text-xs text-gray-400 text-center pt-8 px-6 leading-relaxed">
                Posez votre première question — configuration, réservations, abonnement… nous
                sommes là pour vous aider à réussir.
              </p>
            )}
            {messages.map((m) => (
              <div key={m.id} className={`flex ${m.from === 'pro' ? 'justify-end' : 'justify-start'}`}>
                <div
                  className={`max-w-[82%] rounded-2xl px-3.5 py-2 text-sm leading-relaxed ${
                    m.from === 'pro'
                      ? 'bg-gray-900 dark:bg-white text-white dark:text-gray-900 rounded-br-md'
                      : 'bg-white dark:bg-gray-800 text-gray-900 dark:text-white border border-gray-200 dark:border-gray-700 rounded-bl-md'
                  }`}
                >
                  {m.from === 'admin' && (
                    <p className="text-[10px] font-semibold text-red-600 dark:text-red-400 mb-0.5">
                      {m.authorName ?? 'Équipe Opatam'}
                    </p>
                  )}
                  <p className="whitespace-pre-wrap break-words">{m.text}</p>
                  <p
                    className={`text-[10px] mt-0.5 text-right ${
                      m.from === 'pro' ? 'text-gray-400 dark:text-gray-500' : 'text-gray-400'
                    }`}
                  >
                    {heure(m.createdAt)}
                  </p>
                </div>
              </div>
            ))}
            <div ref={finRef} />
          </div>

          <div className="p-3 border-t border-gray-100 dark:border-gray-800 flex items-end gap-2">
            <textarea
              value={texte}
              onChange={(e) => setTexte(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  void envoyer();
                }
              }}
              placeholder="Écrivez votre message…"
              rows={1}
              className="flex-1 resize-none rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-950 px-3 py-2 text-sm text-gray-900 dark:text-white max-h-28"
            />
            <button
              onClick={() => void envoyer()}
              disabled={envoi || !texte.trim()}
              aria-label="Envoyer"
              className="p-2.5 rounded-xl bg-red-600 text-white hover:bg-red-700 disabled:opacity-40"
            >
              <Send className="w-4 h-4" />
            </button>
          </div>
          </>
          )}
        </div>
      )}
    </>
  );
}
