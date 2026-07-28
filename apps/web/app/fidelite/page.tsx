/**
 * /fidelite — page « vos cartes de fidélité vivent dans l'application ».
 *
 * Les liens profonds ont été retirés : un prestataire a l'application mais
 * réserve chez un confrère en tant que client, et l'interception l'envoyait
 * dans un espace qui n'est pas le sien. Aucune URL du site n'ouvre plus
 * l'app automatiquement — seule la bannière App Store le propose, sur appui
 * explicite. Cette page est donc TOUJOURS affichée, téléphone comme
 * ordinateur, et renvoie vers les stores.
 */

import type { Metadata } from 'next';
import Link from 'next/link';
import { getLocale } from 'next-intl/server';

import { PlayStoreWaitlistButton } from '@/components/common/PlayStoreWaitlistButton';

const STORE_IOS = 'https://apps.apple.com/app/opatam/id6759246218';
// Pas de lien Play Store : l'app Android n'est pas publiée et le lien
// direct menait à une page d'erreur. Le bouton ouvre la liste d'attente.

const TEXTS = {
  fr: {
    title: 'Votre carte de fidélité',
    subtitle:
      "Vos cartes de fidélité vivent dans l'application Opatam : installez-la, connectez-vous, et retrouvez vos rendez-vous cumulés chez chacun de vos prestataires.",
    step1: "Téléchargez l'application",
    step2: 'Connectez-vous avec votre compte',
    step3: 'Activez votre carte — vos rendez-vous déjà honorés y sont comptés',
    back: "Retour à l'accueil",
    badge: 'Télécharger sur',
    soon: 'Bientôt sur',
  },
  en: {
    title: 'Your loyalty card',
    subtitle:
      'Your loyalty cards live in the Opatam app: install it, sign in, and find the appointments you have collected with each of your providers.',
    step1: 'Download the app',
    step2: 'Sign in with your account',
    step3: 'Activate your card — the appointments you already had are counted',
    back: 'Back to home',
    badge: 'Download on',
    soon: 'Coming soon to',
  },
  it: {
    title: 'La tua carta fedeltà',
    subtitle:
      "Le tue carte fedeltà vivono nell'app Opatam: installala, accedi e ritrova gli appuntamenti accumulati presso ciascun professionista.",
    step1: "Scarica l'applicazione",
    step2: 'Accedi con il tuo account',
    step3: 'Attiva la tua carta — gli appuntamenti già effettuati sono conteggiati',
    back: 'Torna alla home',
    badge: 'Scarica su',
    soon: 'Presto su',
  },
  pt: {
    title: 'O seu cartão de fidelização',
    subtitle:
      'Os seus cartões de fidelização estão na aplicação Opatam: instale-a, inicie sessão e encontre as marcações acumuladas em cada um dos seus profissionais.',
    step1: 'Descarregue a aplicação',
    step2: 'Inicie sessão com a sua conta',
    step3: 'Ative o seu cartão — as marcações já realizadas são contabilizadas',
    back: 'Voltar ao início',
    badge: 'Descarregar na',
    soon: 'Brevemente em',
  },
} as const;

export const metadata: Metadata = {
  title: 'Carte de fidélité',
  robots: { index: false, follow: true },
};

export default async function LoyaltyLandingPage() {
  const locale = (await getLocale()) as 'fr' | 'en' | 'it' | 'pt';
  const t = TEXTS[locale] ?? TEXTS.fr;

  return (
    <main className="min-h-[70vh] flex items-center justify-center px-4 py-16">
      <div className="w-full max-w-lg text-center">
        <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-primary-600 text-white mb-6">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-8 h-8">
            <rect x="2" y="5" width="20" height="14" rx="3" />
            <path d="M2 10h20" />
          </svg>
        </div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-3">{t.title}</h1>
        <p className="text-gray-600 dark:text-gray-300 leading-relaxed mb-8">{t.subtitle}</p>

        <ol className="text-left space-y-3 mb-8">
          {[t.step1, t.step2, t.step3].map((step, i) => (
            <li key={step} className="flex gap-3 items-start">
              <span className="flex-shrink-0 w-6 h-6 rounded-full bg-primary-50 dark:bg-primary-900/30 text-primary-600 dark:text-primary-400 text-sm font-semibold flex items-center justify-center">
                {i + 1}
              </span>
              <span className="text-sm text-gray-700 dark:text-gray-300">{step}</span>
            </li>
          ))}
        </ol>

        <div className="flex flex-wrap gap-3 justify-center">
          <a
            href={STORE_IOS}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 bg-gray-900 text-white px-5 py-3 rounded-xl hover:bg-gray-800 transition-colors"
          >
            <span className="text-left leading-tight">
              <span className="block text-[10px] opacity-80">{t.badge}</span>
              <span className="block text-sm font-semibold">App Store</span>
            </span>
          </a>
          <PlayStoreWaitlistButton className="inline-flex items-center gap-2 bg-gray-900 text-white px-5 py-3 rounded-xl hover:bg-gray-800 transition-colors">
            <span className="text-left leading-tight">
              <span className="block text-[10px] opacity-80">{t.soon}</span>
              <span className="block text-sm font-semibold">Google Play</span>
            </span>
          </PlayStoreWaitlistButton>
        </div>

        <Link
          href="/"
          className="inline-block mt-8 text-sm text-gray-500 hover:text-gray-700 dark:text-gray-400"
        >
          {t.back}
        </Link>
      </div>
    </main>
  );
}
