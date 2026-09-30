'use client';

import { useState } from 'react';
import Link from 'next/link';
import { BellRing, CalendarClock, CheckCircle2, ChevronDown, EyeOff, MessageSquare, MoonStar } from 'lucide-react';
import type { AdminOverview, OverviewProRef } from '@/services/admin/types';
import { Avatar, Panel, PanelTitle } from './primitives';

type Ton = 'amber' | 'rose' | 'sky';
const TONS: Record<Ton, string> = {
  amber: 'bg-amber-50 text-amber-700 dark:bg-amber-500/10 dark:text-amber-400',
  rose: 'bg-rose-50 text-rose-700 dark:bg-rose-500/10 dark:text-rose-400',
  sky: 'bg-sky-50 text-sky-700 dark:bg-sky-500/10 dark:text-sky-400',
};

const jour = (iso: string) => new Date(iso).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' });
const ilYa = (iso: string) => {
  const j = Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000);
  return j <= 0 ? "aujourd'hui" : j === 1 ? 'hier' : `il y a ${j} j`;
};

interface Ligne {
  key: string;
  icon: React.ReactNode;
  label: string;
  ton: Ton;
  items: OverviewProRef[];
  detail: (p: OverviewProRef) => string;
  lien: (p: OverviewProRef) => string;
}

/**
 * Ce qui demande une action, pas seulement un regard : les essais qui se
 * terminent, les payants qui ne reçoivent plus rien, les inscrits bloqués
 * avant la publication, les messages sans réponse.
 */
export function TodoPanel({ todo }: { todo: AdminOverview['todo'] }) {
  const [ouvert, setOuvert] = useState<string | null>(null);
  const lignes: Ligne[] = [
    {
      key: 'trials',
      icon: <CalendarClock className="h-4 w-4" />,
      label: 'Essais qui finissent sous 7 j',
      ton: 'amber',
      items: todo.trialsEnding,
      detail: (p) => (p.date ? `fin le ${jour(p.date)}` : ''),
      lien: (p) => `/admin/providers/${p.id}`,
    },
    {
      key: 'idle',
      icon: <MoonStar className="h-4 w-4" />,
      label: 'Payants sans réservation depuis 14 j',
      ton: 'rose',
      items: todo.idlePaying,
      detail: (p) => (p.date ? `dernière ${ilYa(p.date)}` : 'aucune depuis 60 j'),
      lien: (p) => `/admin/providers/${p.id}`,
    },
    {
      key: 'unpublished',
      icon: <EyeOff className="h-4 w-4" />,
      label: 'Inscrits sans page publiée',
      ton: 'amber',
      items: todo.unpublished,
      detail: (p) => (p.date ? `inscrit ${ilYa(p.date)}` : ''),
      lien: (p) => `/admin/providers/${p.id}`,
    },
    {
      key: 'messages',
      icon: <MessageSquare className="h-4 w-4" />,
      label: 'Messages en attente de réponse',
      ton: 'sky',
      items: todo.pendingMessages,
      detail: (p) => (p.date ? ilYa(p.date) : ''),
      lien: () => '/admin/messages',
    },
  ];
  const total = lignes.reduce((s, l) => s + l.items.length, 0);

  return (
    <Panel className="flex flex-col">
      <PanelTitle
        icon={<BellRing className="h-4 w-4" />}
        accent="amber"
        title="À faire"
        right={
          total > 0 ? (
            <span className="rounded-full bg-amber-100 dark:bg-amber-500/15 px-2 py-0.5 text-xs font-semibold text-amber-700 dark:text-amber-400">
              {total}
            </span>
          ) : null
        }
      />
      <div className="flex-1 divide-y divide-gray-100 dark:divide-gray-700/60 px-2 pb-2">
        {lignes.map((l) => {
          const vide = l.items.length === 0;
          const deplie = ouvert === l.key && !vide;
          return (
            <div key={l.key}>
              <button
                type="button"
                disabled={vide}
                onClick={() => setOuvert(deplie ? null : l.key)}
                className="flex w-full items-center gap-3 rounded-xl px-3 py-3 text-left transition-colors hover:bg-gray-50 dark:hover:bg-gray-700/30 disabled:cursor-default disabled:hover:bg-transparent"
              >
                <span className={`flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg ${vide ? 'bg-gray-50 text-gray-300 dark:bg-gray-700/40 dark:text-gray-600' : TONS[l.ton]}`}>
                  {vide ? <CheckCircle2 className="h-4 w-4" /> : l.icon}
                </span>
                <span className={`flex-1 text-sm ${vide ? 'text-gray-400 dark:text-gray-500' : 'font-medium text-gray-800 dark:text-gray-100'}`}>
                  {l.label}
                </span>
                {vide ? (
                  <span className="text-xs text-gray-300 dark:text-gray-600">rien</span>
                ) : (
                  <>
                    <span className={`rounded-full px-2 py-0.5 text-xs font-bold ${TONS[l.ton]}`}>{l.items.length}</span>
                    <ChevronDown className={`h-4 w-4 text-gray-400 transition-transform ${deplie ? 'rotate-180' : ''}`} />
                  </>
                )}
              </button>
              {deplie && (
                <ul className="mb-2 ml-14 mr-3 space-y-1">
                  {l.items.slice(0, 8).map((p) => (
                    <li key={p.id}>
                      <Link
                        href={l.lien(p)}
                        className="flex items-center gap-2 rounded-lg px-2 py-1.5 text-sm hover:bg-gray-50 dark:hover:bg-gray-700/30"
                      >
                        <Avatar name={p.name} photoURL={p.photoURL} size={22} />
                        <span className="flex-1 truncate text-gray-800 dark:text-gray-100">{p.name}</span>
                        <span className="text-[11px] text-gray-400">{l.detail(p)}</span>
                      </Link>
                    </li>
                  ))}
                  {l.items.length > 8 && (
                    <li className="px-2 text-[11px] text-gray-400">et {l.items.length - 8} autre{l.items.length - 8 > 1 ? 's' : ''}</li>
                  )}
                </ul>
              )}
            </div>
          );
        })}
      </div>
    </Panel>
  );
}
