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
import { EyeOff, Loader2, MessageCircle, PenSquare, Search, Send, X } from 'lucide-react';
import { acquisitionChannelLabel, supportTopicTag } from '@booking-app/shared';

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

/** Prestataire dont la page n'est pas publiée — à relancer depuis ce chat. */
interface NonPublie {
  id: string;
  businessName: string;
  category: string | null;
  city: string | null;
  createdAt: Date | null;
  plan: string | null;
  subscriptionStatus: string | null;
  acquisitionChannel: string | null;
  /** Dernier e-mail automatique « votre page n'est pas publiée » (cron). */
  relanceAutoLe: Date | null;
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

  // ── Pages non publiées : la liste de relance ──
  // Égalité seule + tri en mémoire (pas d'index composite à déployer) ;
  // les comptes de test sont écartés. Un clic « Écrire » ouvre le fil en
  // haut de page, exactement comme « Nouveau message ».
  const [nonPublies, setNonPublies] = useState<NonPublie[] | null>(null);
  useEffect(() => {
    getDocs(query(collection(db, 'providers'), where('isPublished', '==', false)))
      .then((snap) => {
        const rows: NonPublie[] = snap.docs
          .filter((d) => d.data().isTest !== true)
          .map((d) => {
            const x = d.data();
            return {
              id: d.id,
              businessName: (x.businessName as string) || 'Professionnel',
              category: typeof x.category === 'string' ? x.category : null,
              city: Array.isArray(x.cities) && typeof x.cities[0] === 'string' ? x.cities[0] : null,
              createdAt: x.createdAt?.toDate?.() ?? null,
              plan: x.subscription?.plan ?? x.plan ?? null,
              subscriptionStatus: x.subscription?.status ?? null,
              acquisitionChannel: x.acquisitionSource?.channel ?? null,
              relanceAutoLe: x.unpublishedReminderLastSent?.toDate?.() ?? null,
            };
          })
          .sort((a, b) => (b.createdAt?.getTime() ?? 0) - (a.createdAt?.getTime() ?? 0));
        setNonPublies(rows);
      })
      .catch(() => setNonPublies([]));
  }, []);

  const ecrireA = (p: { id: string; businessName: string }) => {
    setCible(p);
    setOuvertId(p.id);
    setNouveauOuvert(false);
    if (typeof window !== 'undefined') window.scrollTo({ top: 0, behavior: 'smooth' });
  };

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

      {/* ── Pages non publiées — à relancer ── */}
      <section className="rounded-2xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 overflow-hidden">
        <div className="px-5 py-4 border-b border-gray-100 dark:border-gray-800 flex items-start justify-between gap-3 flex-wrap">
          <div>
            <h2 className="text-sm font-semibold text-gray-900 dark:text-white flex items-center gap-2">
              <EyeOff className="w-4 h-4 text-amber-500" />
              Pages non publiées
              {nonPublies && (
                <span className="text-[11px] font-semibold text-amber-700 dark:text-amber-300 bg-amber-50 dark:bg-amber-900/30 rounded-full px-2 py-0.5">
                  {nonPublies.length}
                </span>
              )}
            </h2>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
              Inscrits sans page en ligne : écrivez-leur ici pour comprendre ce qui bloque et les
              relancer. Les plus récents d&apos;abord.
            </p>
          </div>
        </div>

        {nonPublies === null ? (
          <div className="px-5 py-6">
            <Loader2 className="w-5 h-5 animate-spin text-gray-400" />
          </div>
        ) : nonPublies.length === 0 ? (
          <p className="px-5 py-8 text-sm text-gray-400 text-center">
            Toutes les pages sont publiées.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-[11px] uppercase tracking-wider text-gray-400 border-b border-gray-100 dark:border-gray-800">
                  <th className="px-5 py-2.5 font-semibold">Prestataire</th>
                  <th className="px-3 py-2.5 font-semibold">Inscrit</th>
                  <th className="px-3 py-2.5 font-semibold">Abonnement</th>
                  <th className="px-3 py-2.5 font-semibold">Source</th>
                  <th className="px-3 py-2.5 font-semibold">Relance auto</th>
                  <th className="px-3 py-2.5 font-semibold">Chat</th>
                  <th className="px-5 py-2.5 font-semibold text-right"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                {nonPublies.map((p) => {
                  const conversation = chats?.find((c) => c.id === p.id) ?? null;
                  // Le mot d'accueil silencieux ne compte pas comme un échange.
                  const echange = conversation && conversation.lastMessageFrom === 'pro';
                  return (
                    <tr key={p.id} className="hover:bg-gray-50/60 dark:hover:bg-gray-800/40">
                      <td className="px-5 py-3">
                        <a
                          href={`/admin/providers/${p.id}`}
                          className="font-semibold text-gray-900 dark:text-white hover:underline"
                        >
                          {p.businessName}
                        </a>
                        <p className="text-[11px] text-gray-400">
                          {[p.category, p.city].filter(Boolean).join(' · ') || '—'}
                        </p>
                      </td>
                      <td className="px-3 py-3 text-xs text-gray-600 dark:text-gray-300 whitespace-nowrap">
                        {p.createdAt
                          ? `il y a ${depuis(p.createdAt)} · ${p.createdAt.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })}`
                          : '—'}
                      </td>
                      <td className="px-3 py-3 text-xs text-gray-600 dark:text-gray-300 whitespace-nowrap">
                        {p.plan ?? '—'}
                        {p.subscriptionStatus && (
                          <span className="text-gray-400"> · {p.subscriptionStatus}</span>
                        )}
                      </td>
                      <td className="px-3 py-3 text-xs text-gray-600 dark:text-gray-300">
                        {p.acquisitionChannel ? (
                          acquisitionChannelLabel(p.acquisitionChannel)
                        ) : (
                          <span className="text-gray-300 dark:text-gray-600">—</span>
                        )}
                      </td>
                      <td className="px-3 py-3 text-xs text-gray-600 dark:text-gray-300 whitespace-nowrap">
                        {p.relanceAutoLe ? `il y a ${depuis(p.relanceAutoLe)}` : <span className="text-gray-300 dark:text-gray-600">jamais</span>}
                      </td>
                      <td className="px-3 py-3 text-xs whitespace-nowrap">
                        {echange ? (
                          <span className="text-emerald-700 dark:text-emerald-400 font-medium">
                            a répondu · {depuis(conversation!.lastMessageAt)}
                          </span>
                        ) : conversation && conversation.lastMessageFrom === 'admin' && conversation.lastMessageText && !conversation.lastMessageText.startsWith('Bienvenue sur votre messagerie') ? (
                          <span className="text-gray-500">relancé · {depuis(conversation.lastMessageAt)}</span>
                        ) : (
                          <span className="text-gray-300 dark:text-gray-600">aucun échange</span>
                        )}
                      </td>
                      <td className="px-5 py-3 text-right">
                        <button
                          onClick={() => ecrireA({ id: p.id, businessName: p.businessName })}
                          className="inline-flex items-center gap-1.5 rounded-lg bg-gray-900 dark:bg-white text-white dark:text-gray-900 px-3 py-1.5 text-xs font-semibold hover:opacity-90"
                        >
                          <PenSquare className="w-3.5 h-3.5" />
                          Écrire
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
