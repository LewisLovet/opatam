'use client';

import { useState, useEffect } from 'react';
import { Logo } from '@/components/ui';

/**
 * Branded full-screen loading state with a rotating "tip" carousel — used
 * while the pro area boots (auth context + data). Turns dead loading time
 * into a moment of value (reassurance + feature discovery) instead of a bare
 * spinner.
 */

const TIPS: { emoji: string; text: string }[] = [
  { emoji: '📅', text: 'Votre agenda est accessible par vos clients 24h/24, 7j/7.' },
  { emoji: '⏰', text: 'Les rappels automatiques réduisent fortement les rendez-vous manqués.' },
  { emoji: '💸', text: 'Un acompte « Sérénité » dissuade les no-shows et sécurise vos créneaux.' },
  { emoji: '🔗', text: 'Partagez votre lien de réservation sur Instagram, WhatsApp, votre vitrine…' },
  { emoji: '🧩', text: 'Ajoutez des variations et options : le client compose, le prix s’ajuste seul.' },
  { emoji: '⭐', text: 'Demandez un avis après chaque rendez-vous pour gagner en visibilité.' },
  { emoji: '💯', text: 'Sans commission : vous gardez 100 % de vos revenus.' },
];

export function LoadingTips({ message = 'Chargement…' }: { message?: string }) {
  const [i, setI] = useState(0);

  useEffect(() => {
    const id = setInterval(() => setI((v) => (v + 1) % TIPS.length), 2800);
    return () => clearInterval(id);
  }, []);

  const tip = TIPS[i];

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gray-50 dark:bg-gray-900 px-6">
      <div className="flex flex-col items-center">
        <Logo size="lg" />

        {/* Spinner */}
        <div className="mt-8 w-10 h-10 border-[3px] border-primary-200 dark:border-primary-900 border-t-primary-600 rounded-full animate-spin" />
        <p className="mt-4 text-sm text-gray-500 dark:text-gray-400">{message}</p>
      </div>

      {/* Rotating tip */}
      <div className="mt-10 w-full max-w-sm">
        <div
          key={i}
          className="flex items-start gap-3 px-4 py-3.5 rounded-2xl bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700 shadow-sm transition-all duration-300"
        >
          <span className="text-xl leading-none flex-shrink-0">{tip.emoji}</span>
          <p className="text-sm text-gray-600 dark:text-gray-300 leading-relaxed">{tip.text}</p>
        </div>

        {/* Progress dots */}
        <div className="mt-4 flex items-center justify-center gap-1.5">
          {TIPS.map((_, idx) => (
            <span
              key={idx}
              className={`h-1.5 rounded-full transition-all duration-300 ${
                idx === i ? 'w-5 bg-primary-500' : 'w-1.5 bg-gray-300 dark:bg-gray-700'
              }`}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
