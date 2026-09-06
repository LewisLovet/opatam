'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import {
  addDoc,
  collection,
  doc,
  getDocs,
  limit,
  limitToLast,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  where,
} from 'firebase/firestore';
import { db } from '@booking-app/firebase';
import { useAuth } from '@/contexts/AuthContext';
import { Loader2, MessageCircle, PenSquare, Search, Send, X } from 'lucide-react';
import { supportTopicTag } from '@booking-app/shared';

/**
 * Messages — le chat de support côté ADMIN : toutes les conversations des
 * professionnels, temps réel, réponse sur place. Phase d'entraînement :
 * admins uniquement (les commerciaux viendront ensuite).
 *
 * Les compteurs/résumés sont tenus par la Cloud Function
 * onSupportMessageCreate — ici on ne fait qu'écrire des messages
 * (from: 'admin') et remettre SON compteur à zéro à l'ouverture d'un fil.
 */

interface ChatRow {
  id: string;
  businessName: string;
  topic: string | null;
  lastMessageText: string;
  lastMessageFrom: 'pro' | 'admin';
  lastMessageAt: Date | null;
  adminUnread: number;
}

interface MessageChat {
  id: string;
  from: 'pro' | 'admin';
  authorName?: string;
  text: string;
  createdAt: Date | null;
}

function depuis(d: Date | null): string {
  if (!d) return '';
  const min = Math.max(0, Math.round((Date.now() - d.getTime()) / 60_000));
  if (min < 60) return `${Math.max(1, min)} min`;
  const h = Math.round(min / 60);
  if (h < 24) return `${h} h`;
  return `${Math.round(h / 24)} j`;
}

export default function AdminMessagesPage() {
  const { user } = useAuth();
  const [chats, setChats] = useState<ChatRow[] | null>(null);
  const [ouvertId, setOuvertId] = useState<string | null>(null);
  const [messages, setMessages] = useState<MessageChat[]>([]);
  const [texte, setTexte] = useState('');
  const [envoi, setEnvoi] = useState(false);
  const finRef = useRef<HTMLDivElement>(null);

  // ── Nouveau message : le chat s'initie aussi de NOTRE côté ──
  // On cherche un prestataire (searchTokens, comme la recherche publique) et
  // on lui écrit en premier — le doc supportChats est créé par la Cloud
  // Function au premier message, le pro reçoit badge + push.
  const [nouveauOuvert, setNouveauOuvert] = useState(false);
  const [recherche, setRecherche] = useState('');
  const [resultats, setResultats] = useState<Array<{ id: string; businessName: string }>>([]);
  const [cible, setCible] = useState<{ id: string; businessName: string } | null>(null);

  useEffect(() => {
    const terme = recherche.trim().toLowerCase();
    if (terme.length < 2) {
      setResultats([]);
      return;
    }
    const t = setTimeout(async () => {
      try {
        const snap = await getDocs(
          query(
            collection(db, 'providers'),
            where('searchTokens', 'array-contains', terme),
            limit(8),
          ),
        );
        setResultats(
          snap.docs.map((d) => ({
            id: d.id,
            businessName: (d.data().businessName as string) ?? 'Professionnel',
          })),
        );
      } catch {
        setResultats([]);
      }
    }, 250);
    return () => clearTimeout(t);
  }, [recherche]);

  // Toutes les conversations, les plus récentes d'abord.
  useEffect(() => {
    const q = query(collection(db, 'supportChats'), orderBy('updatedAt', 'desc'));
    return onSnapshot(q, (snap) => {
      setChats(
        snap.docs.map((d) => {
          const x = d.data();
          return {
            id: d.id,
            businessName: x.businessName ?? 'Professionnel',
            topic: typeof x.topic === 'string' ? x.topic : null,
            lastMessageText: x.lastMessageText ?? '',
            lastMessageFrom: x.lastMessageFrom === 'admin' ? 'admin' : 'pro',
            lastMessageAt: x.lastMessageAt?.toDate?.() ?? x.updatedAt?.toDate?.() ?? null,
            adminUnread: x.adminUnread ?? 0,
          };
        }),
      );
    });
  }, []);

  // Le fil ouvert.
  useEffect(() => {
    if (!ouvertId) return;
    const q = query(
      collection(db, 'supportChats', ouvertId, 'messages'),
      orderBy('createdAt', 'asc'),
      limitToLast(300),
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
  }, [ouvertId]);

  // Ouverture d'un fil → lu. Un fil tout neuf (initié par nous, aucun
  // message encore) n'a pas de doc supportChats : la cible fait l'en-tête.
  const ouvert = useMemo(() => {
    const existant = chats?.find((c) => c.id === ouvertId) ?? null;
    if (existant) return existant;
    if (cible && cible.id === ouvertId) {
      return {
        id: cible.id,
        businessName: cible.businessName,
        topic: null,
        lastMessageText: '',
        lastMessageFrom: 'admin' as const,
        lastMessageAt: null,
        adminUnread: 0,
      };
    }
    return null;
  }, [chats, ouvertId, cible]);
  useEffect(() => {
    if (!ouvertId || !ouvert || ouvert.adminUnread === 0) return;
    void setDoc(doc(db, 'supportChats', ouvertId), { adminUnread: 0 }, { merge: true }).catch(
      () => undefined,
    );
  }, [ouvertId, ouvert]);

  useEffect(() => {
    finRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const envoyer = async () => {
    const contenu = texte.trim();
    if (!ouvertId || !contenu || envoi || !user) return;
    setEnvoi(true);
    try {
      await addDoc(collection(db, 'supportChats', ouvertId, 'messages'), {
        from: 'admin',
        authorUid: user.id,
        authorName: user.displayName || 'Équipe Opatam',
        text: contenu.slice(0, 2000),
        createdAt: serverTimestamp(),
      });
      setTexte('');
    } finally {
      setEnvoi(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Messages</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            Le chat de support des professionnels — répondez vite, c&apos;est ce qui rassure.
          </p>
        </div>
        <button
          onClick={() => {
            setNouveauOuvert((v) => !v);
            setRecherche('');
            setResultats([]);
          }}
          className="inline-flex items-center gap-2 rounded-xl bg-gray-900 dark:bg-white text-white dark:text-gray-900 px-3.5 py-2 text-sm font-semibold hover:opacity-90"
        >
          {nouveauOuvert ? <X className="w-4 h-4" /> : <PenSquare className="w-4 h-4" />}
          {nouveauOuvert ? 'Fermer' : 'Nouveau message'}
        </button>
      </div>

      {/* Recherche d'un prestataire pour initier une conversation */}
      {nouveauOuvert && (
        <div className="rounded-2xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-3 max-w-md">
          <div className="relative">
            <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              autoFocus
              value={recherche}
              onChange={(e) => setRecherche(e.target.value)}
              placeholder="Nom du prestataire…"
              className="w-full rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-950 pl-9 pr-3 py-2 text-sm text-gray-900 dark:text-white"
            />
          </div>
          {resultats.length > 0 && (
            <div className="mt-2 divide-y divide-gray-50 dark:divide-gray-800/60">
              {resultats.map((r) => (
                <button
                  key={r.id}
                  onClick={() => {
                    setCible(r);
                    setOuvertId(r.id);
                    setNouveauOuvert(false);
                    setRecherche('');
                    setResultats([]);
                  }}
                  className="w-full text-left px-3 py-2 text-sm text-gray-900 dark:text-white hover:bg-gray-50 dark:hover:bg-gray-800/50 rounded-lg"
                >
                  {r.businessName}
                </button>
              ))}
            </div>
          )}
          {recherche.trim().length >= 2 && resultats.length === 0 && (
            <p className="mt-2 px-3 text-xs text-gray-400">Aucun prestataire trouvé.</p>
          )}
        </div>
      )}

      {chats === null ? (
        <Loader2 className="w-5 h-5 animate-spin text-gray-400" />
      ) : chats.length === 0 && !ouvert ? (
        <div className="rounded-2xl border-2 border-dashed border-gray-200 dark:border-gray-800 p-10 text-center">
          <MessageCircle className="w-8 h-8 text-gray-300 dark:text-gray-600 mx-auto" />
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-2">
            Aucune conversation pour l&apos;instant — la bulle de chat est dans l&apos;espace
            pro (web et app).
          </p>
        </div>
      ) : (
        <div className="grid lg:grid-cols-[320px_1fr] gap-4 items-start">
          {/* Liste des conversations */}
          <div className="rounded-2xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 divide-y divide-gray-50 dark:divide-gray-800/60 overflow-hidden lg:sticky lg:top-6 max-h-[75vh] overflow-y-auto">
            {chats.map((c) => (
              <button
                key={c.id}
                onClick={() => setOuvertId(c.id)}
                className={`w-full text-left px-4 py-3 transition-colors ${
                  ouvertId === c.id
                    ? 'bg-gray-50 dark:bg-gray-800/60'
                    : 'hover:bg-gray-50/60 dark:hover:bg-gray-800/40'
                }`}
              >
                <div className="flex items-center justify-between gap-2">
                  <p className="text-sm font-semibold text-gray-900 dark:text-white truncate">
                    {c.businessName}
                    {supportTopicTag(c.topic) && (
                      <span className="ml-1.5 text-[9px] font-semibold uppercase tracking-wide text-violet-700 dark:text-violet-300 bg-violet-50 dark:bg-violet-900/30 rounded-full px-1.5 py-0.5">
                        {supportTopicTag(c.topic)}
                      </span>
                    )}
                  </p>
                  <span className="flex-shrink-0 text-[10px] text-gray-400">
                    {depuis(c.lastMessageAt)}
                  </span>
                </div>
                <div className="flex items-center justify-between gap-2 mt-0.5">
                  <p className="text-xs text-gray-500 dark:text-gray-400 truncate">
                    {c.lastMessageFrom === 'admin' ? 'Vous : ' : ''}
                    {c.lastMessageText}
                  </p>
                  {c.adminUnread > 0 && (
                    <span className="flex-shrink-0 min-w-[18px] h-[18px] px-1 rounded-full bg-red-500 text-white text-[10px] font-bold inline-flex items-center justify-center">
                      {c.adminUnread > 9 ? '9+' : c.adminUnread}
                    </span>
                  )}
                </div>
              </button>
            ))}
          </div>

          {/* Le fil */}
          {ouvert ? (
            <div className="rounded-2xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 flex flex-col h-[75vh] overflow-hidden">
              <div className="px-4 py-3 border-b border-gray-100 dark:border-gray-800 flex items-center justify-between gap-2">
                <p className="text-sm font-semibold text-gray-900 dark:text-white">
                  {ouvert.businessName}
                  {supportTopicTag(ouvert.topic) && (
                    <span className="ml-2 text-[9px] font-semibold uppercase tracking-wide text-violet-700 dark:text-violet-300 bg-violet-50 dark:bg-violet-900/30 rounded-full px-1.5 py-0.5">
                      {supportTopicTag(ouvert.topic)}
                    </span>
                  )}
                </p>
                <a
                  href={`/admin/providers/${ouvert.id}`}
                  className="text-[11px] text-gray-400 hover:underline"
                >
                  Voir la fiche prestataire
                </a>
              </div>
              <div className="flex-1 overflow-y-auto px-4 py-3 space-y-2.5 bg-gray-50 dark:bg-gray-950/40">
                {messages.map((m) => (
                  <div key={m.id} className={`flex ${m.from === 'admin' ? 'justify-end' : 'justify-start'}`}>
                    <div
                      className={`max-w-[75%] rounded-2xl px-3.5 py-2 text-sm leading-relaxed ${
                        m.from === 'admin'
                          ? 'bg-gray-900 dark:bg-white text-white dark:text-gray-900 rounded-br-md'
                          : 'bg-white dark:bg-gray-800 text-gray-900 dark:text-white border border-gray-200 dark:border-gray-700 rounded-bl-md'
                      }`}
                    >
                      {m.from === 'admin' && m.authorName && (
                        <p className="text-[10px] font-semibold opacity-60 mb-0.5">{m.authorName}</p>
                      )}
                      <p className="whitespace-pre-wrap break-words">{m.text}</p>
                      <p className="text-[10px] mt-0.5 text-right opacity-50">
                        {m.createdAt
                          ? m.createdAt.toLocaleString('fr-FR', {
                              day: 'numeric',
                              month: 'short',
                              hour: '2-digit',
                              minute: '2-digit',
                            })
                          : ''}
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
                  placeholder={`Répondre à ${ouvert.businessName}…`}
                  rows={1}
                  className="flex-1 resize-none rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-950 px-3 py-2 text-sm text-gray-900 dark:text-white max-h-32"
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
            </div>
          ) : (
            <div className="rounded-2xl border-2 border-dashed border-gray-200 dark:border-gray-800 h-[75vh] flex items-center justify-center">
              <p className="text-sm text-gray-400">Choisissez une conversation.</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
