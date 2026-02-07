'use client';

import Link from 'next/link';
import { useState, useEffect, useRef } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { Header } from '@/components/layout/Header';
import { Footer } from '@/components/layout/Footer';
import { SUBSCRIPTION_PLANS, APP_CONFIG } from '@booking-app/shared/constants';
import {
  CalendarCheck,
  BadgePercent,
  CreditCard,
  Calendar,
  Bell,
  UserPlus,
  Globe,
  Zap,
  Smartphone,
  Lock,
  Star,
  ChevronDown,
  Check,
  Quote,
  LayoutDashboard,
  Users,
  BarChart3,
  Settings,
  Home,
  ArrowRight,
  QrCode,
  Share2,
} from 'lucide-react';

// ─── Helpers ────────────────────────────────────────────────────────
function formatPrice(cents: number): string {
  return (cents / 100).toFixed(2).replace('.', ',');
}

// ─── FAQ Data ───────────────────────────────────────────────────────
const faqItems = [
  {
    question: 'Est-ce que je dois payer une commission sur les reservations ?',
    answer:
      'Non, jamais. OPATAM fonctionne avec un abonnement mensuel fixe (a partir de 14,90\u20AC/mois). Vous ne payez aucune commission sur vos reservations, quel que soit le nombre de clients ou le montant des prestations. C\'est notre engagement fondamental.',
  },
  {
    question: 'Combien de temps faut-il pour configurer mon profil ?',
    answer:
      'En moyenne, 5 minutes. Vous renseignez votre activite, vos prestations et vos horaires, et votre page de reservation est en ligne immediatement. Notre assistant vous guide pas a pas. Aucune competence technique n\'est requise.',
  },
  {
    question: 'Mes clients doivent-ils creer un compte pour reserver ?',
    answer:
      'Non. Vos clients reservent en renseignant simplement leur nom, email et telephone. Pas de compte a creer, pas de mot de passe a retenir. C\'est rapide et sans friction pour eux.',
  },
  {
    question: 'Est-ce que je peux annuler mon abonnement a tout moment ?',
    answer:
      'Oui, sans aucune condition. Il n\'y a aucun engagement de duree. Vous pouvez annuler votre abonnement en un clic depuis votre espace, et il reste actif jusqu\'a la fin de la periode en cours.',
  },
  {
    question: 'Comment mes clients trouvent-ils ma page de reservation ?',
    answer:
      'Vous recevez un lien unique (par exemple : opatam.com/p/votre-nom) et un QR code personnalise que vous pouvez partager par SMS, email, WhatsApp, reseaux sociaux, ou afficher dans votre etablissement. Vos clients scannent le QR code ou cliquent sur le lien pour reserver directement.',
  },
  {
    question: 'OPATAM est-il adapte a une equipe de plusieurs personnes ?',
    answer:
      'Oui. Le plan Studio (29,90\u20AC/mois) est concu pour les equipes. Vous pouvez gerer jusqu\'a 5 agendas synchronises, assigner des prestations a chaque membre, et gerer plusieurs lieux. Des membres supplementaires peuvent etre ajoutes pour 9,90\u20AC/mois chacun.',
  },
  {
    question: 'Que se passe-t-il a la fin de l\'essai gratuit ?',
    answer:
      'Rien d\'automatique. A la fin des 7 jours d\'essai, vous choisissez librement de vous abonner ou non. Aucune carte bancaire n\'est demandee a l\'inscription, donc aucun prelevement surprise. Vos donnees restent accessibles.',
  },
];

// ─── Comparison Data ────────────────────────────────────────────────
const comparisonRows = [
  { label: 'Tarif mensuel', opatam: '14,90\u20AC', others: 'De 0\u20AC* a 90\u20AC/mois' },
  { label: 'Commissions sur vos reservations', opatam: '0%', others: "Jusqu'a 20% ou 1\u20AC par RDV" },
  { label: "Periode d'essai", opatam: '7 jours gratuits', others: 'Souvent limitee ou absente' },
  { label: 'Rappels automatiques', opatam: 'Inclus', others: 'Parfois en option payante' },
  { label: 'Vitrine en ligne personnalisee', opatam: 'Inclus', others: 'Incluse mais modeles limites' },
  { label: 'Engagement', opatam: 'Sans engagement', others: "Variable selon l'offre" },
  { label: 'Cout reel annuel (exemple)', opatam: '178,80\u20AC', others: 'De 300\u20AC a 1 080\u20AC**' },
];

// ─── Testimonials Data ──────────────────────────────────────────────
const testimonials = [
  {
    name: 'Marie L.',
    role: 'Coiffeuse independante',
    city: 'Lyon',
    initials: 'ML',
    text: "Depuis que j'utilise OPATAM, mes no-shows ont baisse de 60%. Les rappels automatiques changent tout. Et surtout, 0% de commission, c'est ce qui m'a convaincu de quitter Planity.",
  },
  {
    name: 'Karim B.',
    role: 'Barbier',
    city: 'Paris',
    initials: 'KB',
    text: "J'ai configure mon profil en 10 minutes. Le soir meme, j'avais deja 3 reservations. L'interface est claire, mes clients adorent pouvoir reserver en ligne a n'importe quelle heure.",
  },
  {
    name: 'Sophie D.',
    role: "Gerante d'institut de beaute",
    city: 'Marseille',
    initials: 'SD',
    text: "On est 3 dans mon institut et OPATAM Studio nous permet de gerer les agendas de toute l'equipe. Le rapport qualite-prix est imbattable par rapport a ce qu'on payait avant.",
  },
];

// ─── Trust brands ───────────────────────────────────────────────────
const trustBrands = [
  'Salon Marie Coiffure',
  'Studio Zen Massage',
  'Coach Fit Pro',
  'Atelier des Ongles',
  'Barber House',
  'Yoga Equilibre',
];

// ═════════════════════════════════════════════════════════════════════
// COMPONENT
// ═════════════════════════════════════════════════════════════════════
export default function LandingPage() {
  // ── State ─────────────────────────────────────────────────────────
  const [openFaq, setOpenFaq] = useState<number>(0);
  const [isYearly, setIsYearly] = useState(false);
  const [showStickyCta, setShowStickyCta] = useState(false);
  const heroRef = useRef<HTMLDivElement>(null);

  // ── Sticky CTA observer ───────────────────────────────────────────
  useEffect(() => {
    const heroEl = heroRef.current;
    if (!heroEl) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        setShowStickyCta(!entry.isIntersecting);
      },
      { threshold: 0 }
    );

    observer.observe(heroEl);
    return () => observer.disconnect();
  }, []);

  // ── Pricing helpers ───────────────────────────────────────────────
  const proMonthly = formatPrice(SUBSCRIPTION_PLANS.solo.monthlyPrice);
  const proYearlyPerMonth = formatPrice(SUBSCRIPTION_PLANS.solo.yearlyPrice / 12);
  const proYearlyTotal = formatPrice(SUBSCRIPTION_PLANS.solo.yearlyPrice);

  const studioMonthly = formatPrice(SUBSCRIPTION_PLANS.team.baseMonthlyPrice);
  const studioYearlyPerMonth = formatPrice(SUBSCRIPTION_PLANS.team.baseYearlyPrice / 12);
  const studioYearlyTotal = formatPrice(SUBSCRIPTION_PLANS.team.baseYearlyPrice);

  const memberMonthly = formatPrice(SUBSCRIPTION_PLANS.team.memberMonthlyPrice);

  return (
    <div className="min-h-screen flex flex-col">
      {/* ── Section 1 - Header ─────────────────────────────────────── */}
      <Header />

      <main className="flex-1 overflow-x-hidden">
        {/* ── Section 2 - Hero ───────────────────────────────────────── */}
        <section
          ref={heroRef}
          className="relative bg-gradient-to-b from-primary-50 to-white dark:from-gray-900 dark:to-gray-900 pt-16 pb-20 sm:pt-24 sm:pb-28"
        >
          {/* Decorative gradient blur - animated blobs */}
          <div className="absolute inset-x-0 top-0 -z-10 transform-gpu overflow-hidden blur-3xl" aria-hidden="true">
            <div
              className="animate-blob-drift relative left-[calc(50%-11rem)] aspect-[1155/678] w-[36.125rem] -translate-x-1/2 bg-gradient-to-tr from-primary-200 to-primary-400 opacity-20 sm:left-[calc(50%-30rem)] sm:w-[72.1875rem]"
              style={{
                clipPath:
                  'polygon(74.1% 44.1%, 100% 61.6%, 97.5% 26.9%, 85.5% 0.1%, 80.7% 2%, 72.5% 32.5%, 60.2% 62.4%, 52.4% 68.1%, 47.5% 58.3%, 45.2% 34.5%, 27.5% 76.7%, 0.1% 64.9%, 17.9% 100%, 27.6% 76.8%, 76.1% 97.7%, 74.1% 44.1%)',
              }}
            />
          </div>
          {/* Second decorative blob - offset animation */}
          <div className="absolute inset-x-0 top-20 -z-10 transform-gpu overflow-hidden blur-3xl" aria-hidden="true">
            <div
              className="animate-blob-drift-2 relative left-[calc(50%+5rem)] aspect-[1155/678] w-[28rem] -translate-x-1/2 bg-gradient-to-bl from-primary-300 to-primary-500 opacity-15 sm:left-[calc(50%+15rem)] sm:w-[50rem]"
              style={{
                clipPath:
                  'polygon(20% 0%, 80% 10%, 100% 35%, 95% 65%, 75% 100%, 30% 90%, 0% 60%, 5% 30%)',
              }}
            />
          </div>

          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="lg:grid lg:grid-cols-2 lg:gap-12 lg:items-center">
              {/* Left: Copy */}
              <div className="text-center lg:text-left max-w-2xl mx-auto lg:mx-0">
                <h1 className="animate-fade-in-up text-4xl sm:text-5xl lg:text-6xl font-bold text-gray-900 dark:text-white tracking-tight">
                  Gerez vos rendez-vous en ligne, sans commission
                </h1>
                <p className="animate-fade-in-up animation-delay-150 mt-6 text-lg sm:text-xl text-gray-600 dark:text-gray-400">
                  {APP_CONFIG.name} est la plateforme de reservation en ligne pour les professionnels de services. Vos
                  clients reservent 24h/24, vous recevez des rappels automatiques et vous ne payez aucune commission.
                  Pret en 5 minutes.
                </p>

                {/* Trust bar */}
                <div className="animate-fade-in-up animation-delay-300 mt-8 flex flex-wrap items-center justify-center lg:justify-start gap-x-6 gap-y-3 text-sm font-medium text-gray-600 dark:text-gray-400">
                  <span className="flex items-center gap-2">
                    <CalendarCheck className="w-5 h-5 text-primary-600 dark:text-primary-400" />
                    Pret en 5 min
                  </span>
                  <span className="flex items-center gap-2">
                    <BadgePercent className="w-5 h-5 text-primary-600 dark:text-primary-400" />
                    0% de commission
                  </span>
                  <span className="flex items-center gap-2">
                    <CreditCard className="w-5 h-5 text-primary-600 dark:text-primary-400" />
                    Des {proMonthly}&euro;/mois
                  </span>
                </div>

                {/* CTAs */}
                <div className="animate-fade-in-up animation-delay-500 mt-10 flex flex-col sm:flex-row items-center gap-4 justify-center lg:justify-start">
                  <Link
                    href="/register"
                    className="inline-flex items-center justify-center bg-primary-600 text-white hover:bg-primary-700 hover:shadow-lg hover:shadow-primary-600/25 px-8 py-4 text-lg font-semibold rounded-lg transition-all duration-200 w-full sm:w-auto"
                  >
                    Demarrer mon essai gratuit
                  </Link>
                  <Link
                    href="/p/demo"
                    className="inline-flex items-center justify-center border border-primary-300 dark:border-primary-700 text-primary-600 dark:text-primary-400 hover:bg-primary-50 dark:hover:bg-primary-900/20 px-8 py-4 text-lg font-semibold rounded-lg transition-all duration-200 w-full sm:w-auto"
                  >
                    Voir une demo
                  </Link>
                </div>
                <p className="animate-fade-in animation-delay-700 mt-4 text-sm text-gray-500 dark:text-gray-500 text-center lg:text-left">
                  {APP_CONFIG.trialDays} jours gratuits, sans carte bancaire, sans engagement
                </p>

                {/* Mobile mini mockup calendar */}
                <div className="mt-10 lg:hidden mx-auto max-w-xs">
                  <div className="border border-gray-200 dark:border-gray-700 rounded-2xl shadow-lg overflow-hidden bg-white dark:bg-gray-800">
                    {/* Title bar with dots */}
                    <div className="flex items-center gap-2 px-3 py-2.5 bg-gray-50 dark:bg-gray-900 border-b border-gray-200 dark:border-gray-700">
                      <div className="flex gap-1.5">
                        <div className="w-2.5 h-2.5 rounded-full bg-red-400" />
                        <div className="w-2.5 h-2.5 rounded-full bg-yellow-400" />
                        <div className="w-2.5 h-2.5 rounded-full bg-green-400" />
                      </div>
                      <div className="flex-1 text-center text-[10px] text-gray-400">Mon agenda</div>
                    </div>
                    {/* Mini calendar grid */}
                    <div className="p-4">
                      <div className="grid grid-cols-3 gap-2">
                        {['Lun', 'Mar', 'Mer'].map((day) => (
                          <div key={day} className="text-center">
                            <p className="text-[10px] font-medium text-gray-500 mb-1.5">{day}</p>
                            <div className="space-y-1">
                              <div className="h-5 rounded bg-primary-200 dark:bg-primary-800" />
                              <div className="h-8 rounded bg-primary-400 dark:bg-primary-600" />
                              <div className="h-3 rounded bg-gray-100 dark:bg-gray-700" />
                              <div className="h-6 rounded bg-primary-300 dark:bg-primary-700" />
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Right: Dashboard mockup (desktop) */}
              <div className="hidden lg:block mt-12 lg:mt-0 animate-fade-in-up animation-delay-500">
                <div className="relative mx-auto max-w-lg animate-float">
                  <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl border border-gray-200 dark:border-gray-700 overflow-hidden hover:shadow-3xl transition-shadow duration-500">
                    {/* Title bar */}
                    <div className="flex items-center gap-2 px-4 py-3 bg-gray-50 dark:bg-gray-900 border-b border-gray-200 dark:border-gray-700">
                      <div className="flex gap-1.5">
                        <div className="w-3 h-3 rounded-full bg-red-400" />
                        <div className="w-3 h-3 rounded-full bg-yellow-400" />
                        <div className="w-3 h-3 rounded-full bg-green-400" />
                      </div>
                      <div className="flex-1 text-center text-xs text-gray-400">opatam.com/dashboard</div>
                    </div>
                    {/* Content */}
                    <div className="p-6">
                      <div className="flex items-center gap-3 mb-6">
                        <Calendar className="w-8 h-8 text-primary-600 dark:text-primary-400" />
                        <div>
                          <p className="text-sm font-semibold text-gray-900 dark:text-white">Mon agenda</p>
                          <p className="text-xs text-gray-500">Semaine du 3 fevrier</p>
                        </div>
                      </div>
                      {/* Fake calendar blocks */}
                      <div className="grid grid-cols-5 gap-2">
                        {['Lun', 'Mar', 'Mer', 'Jeu', 'Ven'].map((day) => (
                          <div key={day} className="text-center">
                            <p className="text-xs font-medium text-gray-500 mb-2">{day}</p>
                            <div className="space-y-1.5">
                              <div className="h-6 rounded bg-primary-200 dark:bg-primary-800" />
                              <div className="h-10 rounded bg-primary-400 dark:bg-primary-600" />
                              <div className="h-4 rounded bg-gray-100 dark:bg-gray-700" />
                              <div className="h-8 rounded bg-primary-300 dark:bg-primary-700" />
                              <div className="h-5 rounded bg-gray-100 dark:bg-gray-700" />
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ── Section 3 - Trust / Social Proof Bar ───────────────────── */}
        <section className="py-10 bg-white dark:bg-gray-900 border-b border-gray-100 dark:border-gray-800">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <p className="text-sm uppercase tracking-wide text-gray-500 dark:text-gray-500 text-center mb-6">
              Ils gerent leurs rendez-vous avec {APP_CONFIG.name}
            </p>
            <div className="overflow-hidden">
              <div className="flex items-center gap-6 sm:gap-10 animate-scroll-x w-max">
                {/* First set */}
                {trustBrands.map((brand) => (
                  <span
                    key={brand}
                    className="text-gray-400 dark:text-gray-600 font-medium text-sm sm:text-base whitespace-nowrap"
                  >
                    {brand}
                  </span>
                ))}
                {/* Duplicate for seamless loop */}
                {trustBrands.map((brand) => (
                  <span
                    key={`dup-${brand}`}
                    className="text-gray-400 dark:text-gray-600 font-medium text-sm sm:text-base whitespace-nowrap"
                  >
                    {brand}
                  </span>
                ))}
              </div>
            </div>
          </div>
        </section>

        {/* ── Section 4 - Benefits "Pourquoi OPATAM" ─────────────────── */}
        <section id="fonctionnalites" className="py-16 sm:py-24 bg-white dark:bg-gray-900">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="text-center max-w-3xl mx-auto mb-16">
              <h2 className="text-2xl sm:text-3xl lg:text-4xl font-bold text-gray-900 dark:text-white">
                Tout ce dont vous avez besoin pour gerer vos rendez-vous
              </h2>
              <p className="mt-4 text-lg text-gray-600 dark:text-gray-400">
                Fini les appels manques, les no-shows et les agendas papier. {APP_CONFIG.name} automatise la gestion de
                vos reservations pour que vous puissiez vous concentrer sur votre metier.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
              {/* Card 1 - Agenda */}
              <div className="group bg-white dark:bg-gray-800 rounded-2xl p-8 border border-gray-100 dark:border-gray-700 transition-all duration-300 hover:-translate-y-1 hover:shadow-xl hover:border-primary-200 dark:hover:border-primary-800">
                <div className="w-14 h-14 rounded-xl bg-primary-100 dark:bg-primary-900/30 flex items-center justify-center mb-6 transition-transform duration-300 group-hover:scale-110">
                  <Calendar className="w-7 h-7 text-primary-600 dark:text-primary-400" />
                </div>
                <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-3">Agenda en ligne 24h/24</h3>
                <p className="text-gray-600 dark:text-gray-400">
                  Vos clients reservent directement en ligne, meme a 23h, meme le dimanche. Fini les appels en pleine
                  prestation. Votre agenda se remplit tout seul.
                </p>
              </div>

              {/* Card 2 - Rappels */}
              <div className="group bg-white dark:bg-gray-800 rounded-2xl p-8 border border-gray-100 dark:border-gray-700 transition-all duration-300 hover:-translate-y-1 hover:shadow-xl hover:border-primary-200 dark:hover:border-primary-800">
                <div className="w-14 h-14 rounded-xl bg-primary-100 dark:bg-primary-900/30 flex items-center justify-center mb-6 transition-transform duration-300 group-hover:scale-110">
                  <Bell className="w-7 h-7 text-primary-600 dark:text-primary-400" />
                </div>
                <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-3">Rappels automatiques</h3>
                <p className="text-gray-600 dark:text-gray-400">
                  Vos clients recoivent un rappel par email et notification push avant chaque rendez-vous. Resultat :
                  jusqu&apos;a 75% de no-shows en moins.
                </p>
              </div>

              {/* Card 3 - 0% commission */}
              <div className="group bg-white dark:bg-gray-800 rounded-2xl p-8 border border-gray-100 dark:border-gray-700 transition-all duration-300 hover:-translate-y-1 hover:shadow-xl hover:border-primary-200 dark:hover:border-primary-800">
                <div className="w-14 h-14 rounded-xl bg-primary-100 dark:bg-primary-900/30 flex items-center justify-center mb-6 transition-transform duration-300 group-hover:scale-110">
                  <BadgePercent className="w-7 h-7 text-primary-600 dark:text-primary-400" />
                </div>
                <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-3">
                  0% de commission, toujours
                </h3>
                <p className="text-gray-600 dark:text-gray-400">
                  Contrairement a Planity ou Fresha, {APP_CONFIG.name} ne prend aucune commission sur vos reservations.
                  Vous payez un prix fixe, point final. Pas de mauvaise surprise sur votre chiffre d&apos;affaires.
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* ── Section 5 - How it works (PRO version) ─────────────────── */}
        <section className="py-16 sm:py-24 bg-gray-50 dark:bg-gray-800">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="text-center max-w-3xl mx-auto mb-16">
              <h2 className="text-2xl sm:text-3xl lg:text-4xl font-bold text-gray-900 dark:text-white">
                Pret en 5 minutes, en 3 etapes
              </h2>
              <p className="mt-4 text-lg text-gray-600 dark:text-gray-400">
                Pas de formation, pas de technicien a appeler. Vous creez votre page et recevez vos premieres
                reservations aujourd&apos;hui.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-8 lg:gap-12">
              {[
                {
                  icon: UserPlus,
                  title: 'Creez votre profil',
                  description:
                    'Renseignez votre activite, vos prestations et vos horaires. Notre assistant vous guide pas a pas.',
                },
                {
                  icon: Globe,
                  title: 'Publiez votre vitrine',
                  description:
                    'Votre page professionnelle est en ligne en un clic. Partagez le lien a vos clients par SMS, email ou reseaux sociaux.',
                },
                {
                  icon: CalendarCheck,
                  title: 'Recevez des reservations',
                  description:
                    'Vos clients reservent en autonomie, 24h/24. Vous recevez une notification a chaque nouveau rendez-vous.',
                },
              ].map((step, index) => {
                const Icon = step.icon;
                return (
                  <div key={step.title} className="relative text-center">
                    {/* Connector line for desktop */}
                    {index < 2 && (
                      <div className="hidden md:block absolute top-10 left-[60%] w-[80%] h-0.5 bg-gray-200 dark:bg-gray-700" />
                    )}

                    <div className="relative inline-flex items-center justify-center w-20 h-20 rounded-2xl bg-primary-100 dark:bg-primary-900/30 text-primary-600 dark:text-primary-400 mb-6">
                      <Icon className="w-10 h-10" />
                      <span className="absolute -top-2 -right-2 w-8 h-8 rounded-full bg-primary-600 text-white text-sm font-bold flex items-center justify-center">
                        {index + 1}
                      </span>
                    </div>

                    <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-3">{step.title}</h3>
                    <p className="text-gray-600 dark:text-gray-400 max-w-xs mx-auto">{step.description}</p>
                  </div>
                );
              })}
            </div>

            {/* CTA */}
            <div className="mt-12 text-center">
              <Link
                href="/register"
                className="inline-flex items-center justify-center bg-primary-600 text-white hover:bg-primary-700 px-8 py-4 text-lg font-semibold rounded-lg transition-colors"
              >
                Creer mon profil gratuitement
              </Link>
              <p className="mt-4 text-sm text-gray-500 dark:text-gray-500">
                Essai gratuit {APP_CONFIG.trialDays} jours — Aucune carte bancaire requise
              </p>
            </div>
          </div>
        </section>

        {/* ── Section 5b - QR Code Feature ─────────────────────────────── */}
        <section className="py-16 sm:py-24 bg-white dark:bg-gray-900">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="lg:grid lg:grid-cols-2 lg:gap-16 lg:items-center">
              {/* Left: QR Code Visual */}
              <div className="flex justify-center lg:justify-end mb-10 lg:mb-0">
                <div className="relative">
                  {/* Phone mockup */}
                  <div className="w-64 sm:w-72 bg-white dark:bg-gray-800 rounded-[2rem] shadow-2xl border border-gray-200 dark:border-gray-700 p-4 pb-6">
                    {/* Phone notch */}
                    <div className="w-20 h-5 bg-gray-100 dark:bg-gray-700 rounded-full mx-auto mb-4" />
                    {/* Camera scanning QR */}
                    <div className="bg-gray-50 dark:bg-gray-900 rounded-2xl p-6 flex flex-col items-center">
                      {/* Real QR code pointing to demo booking page */}
                      <div className="bg-white rounded-xl p-3 relative">
                        <QRCodeSVG
                          value={`${APP_CONFIG.url}/p/demo/reserver`}
                          size={136}
                          level="H"
                          marginSize={0}
                        />
                        {/* Scan line animation */}
                        <div className="absolute inset-x-3 h-0.5 bg-primary-500/60 animate-pulse top-1/2" />
                      </div>
                      <p className="text-xs text-gray-500 dark:text-gray-400 mt-3 text-center">
                        Scanner pour reserver
                      </p>
                    </div>
                    {/* Page preview below */}
                    <div className="mt-3 bg-primary-50 dark:bg-primary-900/20 rounded-xl p-3">
                      <div className="flex items-center gap-2 mb-2">
                        <div className="w-6 h-6 rounded-full bg-primary-200 dark:bg-primary-800" />
                        <div className="h-2.5 w-20 bg-primary-200 dark:bg-primary-800 rounded" />
                      </div>
                      <div className="space-y-1.5">
                        <div className="h-2 w-full bg-primary-100 dark:bg-primary-900/30 rounded" />
                        <div className="h-2 w-3/4 bg-primary-100 dark:bg-primary-900/30 rounded" />
                      </div>
                    </div>
                  </div>

                  {/* Floating badge */}
                  <div className="absolute -bottom-3 -right-3 bg-primary-600 text-white rounded-xl px-3 py-2 shadow-lg shadow-primary-500/25 flex items-center gap-2">
                    <QrCode className="w-4 h-4" />
                    <span className="text-xs font-semibold">Scan &amp; Book</span>
                  </div>
                </div>
              </div>

              {/* Right: Copy */}
              <div className="text-center lg:text-left">
                <div className="inline-flex items-center gap-2 bg-primary-50 dark:bg-primary-900/20 text-primary-700 dark:text-primary-300 text-sm font-medium px-3 py-1.5 rounded-full mb-4">
                  <QrCode className="w-4 h-4" />
                  Nouveau
                </div>
                <h2 className="text-2xl sm:text-3xl lg:text-4xl font-bold text-gray-900 dark:text-white">
                  Un QR code pour reserver en un scan
                </h2>
                <p className="mt-4 text-lg text-gray-600 dark:text-gray-400">
                  Generez votre QR code personnalise et affichez-le dans votre etablissement, sur vos cartes de visite ou vos reseaux sociaux. Vos clients scannent et reservent instantanement.
                </p>

                <ul className="mt-6 space-y-3 text-left">
                  {[
                    { icon: QrCode, text: 'QR code genere automatiquement pour votre page' },
                    { icon: Share2, text: 'Telechargez, imprimez ou partagez en un clic' },
                    { icon: Smartphone, text: 'Vos clients reservent depuis leur telephone' },
                  ].map((item) => {
                    const Icon = item.icon;
                    return (
                      <li key={item.text} className="flex items-start gap-3">
                        <div className="w-8 h-8 rounded-lg bg-primary-100 dark:bg-primary-900/30 flex items-center justify-center flex-shrink-0 mt-0.5">
                          <Icon className="w-4 h-4 text-primary-600 dark:text-primary-400" />
                        </div>
                        <span className="text-gray-700 dark:text-gray-300">{item.text}</span>
                      </li>
                    );
                  })}
                </ul>

                <div className="mt-8">
                  <Link
                    href="/register"
                    className="inline-flex items-center gap-2 bg-primary-600 text-white hover:bg-primary-700 px-6 py-3 font-semibold rounded-lg transition-colors"
                  >
                    Creer mon QR code
                    <ArrowRight className="w-4 h-4" />
                  </Link>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ── Section 6 - Demo Visual ────────────────────────────────── */}
        <section id="demo" className="py-16 sm:py-24 bg-white dark:bg-gray-900">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="text-center max-w-3xl mx-auto mb-12">
              <h2 className="text-2xl sm:text-3xl lg:text-4xl font-bold text-gray-900 dark:text-white">
                Un outil simple et puissant
              </h2>
              <p className="mt-4 text-lg text-gray-600 dark:text-gray-400">
                Decouvrez l&apos;interface que des centaines de professionnels utilisent chaque jour pour gerer leur
                activite.
              </p>
              <Link
                href="/p/demo"
                className="mt-4 inline-flex items-center gap-2 text-primary-600 dark:text-primary-400 font-medium hover:underline"
              >
                Voir la page de reservation en live
                <ArrowRight className="w-4 h-4" />
              </Link>
            </div>

            {/* Dashboard mockup */}
            <div className="relative aspect-video max-w-5xl mx-auto bg-white dark:bg-gray-800 rounded-2xl shadow-2xl border border-gray-200 dark:border-gray-700 overflow-hidden">
              <div className="flex h-full">
                {/* Sidebar */}
                <div className="hidden sm:flex flex-col items-center gap-4 w-16 bg-gray-50 dark:bg-gray-900 border-r border-gray-200 dark:border-gray-700 py-6">
                  <Home className="w-5 h-5 text-gray-400" />
                  <Calendar className="w-5 h-5 text-primary-600 dark:text-primary-400" />
                  <Users className="w-5 h-5 text-gray-400" />
                  <BarChart3 className="w-5 h-5 text-gray-400" />
                  <Settings className="w-5 h-5 text-gray-400" />
                </div>

                {/* Center: Weekly calendar */}
                <div className="flex-1 p-4 sm:p-6">
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-2">
                      <LayoutDashboard className="w-5 h-5 text-primary-600 dark:text-primary-400" />
                      <span className="text-sm font-semibold text-gray-900 dark:text-white">Agenda</span>
                    </div>
                    <span className="text-xs text-gray-500">Semaine du 3 fevrier</span>
                  </div>
                  <div className="grid grid-cols-5 gap-1.5 sm:gap-2 h-[calc(100%-2.5rem)]">
                    {['Lun', 'Mar', 'Mer', 'Jeu', 'Ven'].map((day, i) => (
                      <div key={day} className="flex flex-col">
                        <p className="text-[10px] sm:text-xs font-medium text-gray-500 mb-1.5 text-center">{day}</p>
                        <div className="flex-1 space-y-1">
                          <div
                            className="rounded bg-primary-200 dark:bg-primary-800"
                            style={{ height: `${20 + (i * 7) % 25}%` }}
                          />
                          <div
                            className="rounded bg-primary-400 dark:bg-primary-600"
                            style={{ height: `${30 - (i * 5) % 15}%` }}
                          />
                          <div
                            className="rounded bg-gray-100 dark:bg-gray-700"
                            style={{ height: `${10 + (i * 3) % 10}%` }}
                          />
                          <div
                            className="rounded bg-primary-300 dark:bg-primary-700"
                            style={{ height: `${15 + (i * 4) % 12}%` }}
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Right: Details panel */}
                <div className="hidden md:block w-56 bg-gray-50 dark:bg-gray-900 border-l border-gray-200 dark:border-gray-700 p-4">
                  <p className="text-xs font-semibold text-gray-900 dark:text-white mb-3">Prochain rendez-vous</p>
                  <div className="space-y-3">
                    {[
                      { time: '10:00', name: 'Alice M.', service: 'Coupe + Brushing' },
                      { time: '11:30', name: 'Thomas R.', service: 'Barbe' },
                      { time: '14:00', name: 'Julie K.', service: 'Coloration' },
                    ].map((rdv) => (
                      <div
                        key={rdv.time}
                        className="bg-white dark:bg-gray-800 rounded-lg p-2.5 border border-gray-100 dark:border-gray-700"
                      >
                        <p className="text-[10px] text-primary-600 dark:text-primary-400 font-semibold">{rdv.time}</p>
                        <p className="text-xs font-medium text-gray-900 dark:text-white">{rdv.name}</p>
                        <p className="text-[10px] text-gray-500">{rdv.service}</p>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            {/* Mini-stats */}
            <div className="mt-10 flex flex-wrap items-center justify-center gap-x-10 gap-y-4 text-sm font-medium text-gray-600 dark:text-gray-400">
              <span className="flex items-center gap-2">
                <Zap className="w-5 h-5 text-primary-600 dark:text-primary-400" />
                Pret en 5 min
              </span>
              <span className="flex items-center gap-2">
                <Smartphone className="w-5 h-5 text-primary-600 dark:text-primary-400" />
                Compatible mobile
              </span>
              <span className="flex items-center gap-2">
                <Lock className="w-5 h-5 text-primary-600 dark:text-primary-400" />
                Donnees securisees
              </span>
            </div>
          </div>
        </section>

        {/* ── Section 7 - Testimonials ───────────────────────────────── */}
        <section id="temoignages" className="py-16 sm:py-24 bg-gray-50 dark:bg-gray-800">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="text-center mb-12">
              <h2 className="text-2xl sm:text-3xl lg:text-4xl font-bold text-gray-900 dark:text-white">
                Ils ont adopte {APP_CONFIG.name}
              </h2>
            </div>

            {/* Testimonial cards - horizontal scroll on mobile, grid on desktop */}
            <div className="flex gap-6 overflow-x-auto snap-x snap-mandatory pb-4 md:grid md:grid-cols-3 md:overflow-x-visible md:snap-none md:pb-0 scrollbar-hide">
              {testimonials.map((t) => (
                <div
                  key={t.name}
                  className="flex-shrink-0 w-[85vw] sm:w-[380px] md:w-auto snap-center bg-white dark:bg-gray-900 rounded-2xl p-8 border border-gray-100 dark:border-gray-700 relative transition-all duration-300 hover:-translate-y-1 hover:shadow-xl hover:border-primary-200 dark:hover:border-primary-800"
                >
                  {/* Decorative quote */}
                  <Quote className="absolute top-4 right-4 w-8 h-8 text-primary-100 dark:text-primary-900/30" />

                  {/* Stars */}
                  <div className="flex gap-0.5 mb-4">
                    {Array.from({ length: 5 }).map((_, i) => (
                      <Star key={i} className="w-4 h-4 fill-yellow-400 text-yellow-400" />
                    ))}
                  </div>

                  <p className="text-gray-700 dark:text-gray-300 text-sm leading-relaxed mb-6">
                    &ldquo;{t.text}&rdquo;
                  </p>

                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-primary-100 dark:bg-primary-900/30 flex items-center justify-center text-sm font-bold text-primary-700 dark:text-primary-300">
                      {t.initials}
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-gray-900 dark:text-white">{t.name}</p>
                      <p className="text-xs text-gray-500">
                        {t.role}, {t.city}
                      </p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ── Section 8 - Comparison ─────────────────────────────────── */}
        <section className="py-16 sm:py-24 bg-white dark:bg-gray-900">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="text-center max-w-3xl mx-auto mb-12">
              <h2 className="text-2xl sm:text-3xl lg:text-4xl font-bold text-gray-900 dark:text-white">
                {APP_CONFIG.name}, la solution pensee pour votre rentabilite
              </h2>
              <p className="mt-4 text-lg text-gray-600 dark:text-gray-400">
                Comparez ce qui compte vraiment : un tarif transparent, sans commission cachee, et toutes les
                fonctionnalites essentielles incluses des le depart.
              </p>
            </div>

            {/* Desktop Table */}
            <div className="hidden md:block max-w-3xl mx-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr>
                    <th className="text-left py-4 px-4 font-semibold text-gray-900 dark:text-white">Critere</th>
                    <th className="py-4 px-4 font-semibold text-white bg-primary-600 rounded-t-lg">
                      {APP_CONFIG.name}
                    </th>
                    <th className="py-4 px-4 font-semibold text-gray-500 dark:text-gray-400">
                      Autres solutions
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {comparisonRows.map((row, i) => (
                    <tr key={row.label} className={i % 2 === 0 ? 'bg-gray-50 dark:bg-gray-800/50' : ''}>
                      <td className="py-3 px-4 font-medium text-gray-900 dark:text-white">{row.label}</td>
                      <td className="py-3 px-4 text-center bg-primary-50 dark:bg-primary-900/20 font-semibold text-primary-700 dark:text-primary-300">
                        {row.opatam}
                      </td>
                      <td className="py-3 px-4 text-center text-gray-500 dark:text-gray-400">
                        {row.others}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Mobile stacked cards */}
            <div className="md:hidden space-y-3">
              {comparisonRows.map((row) => (
                <div
                  key={row.label}
                  className="bg-white dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700 p-4"
                >
                  <p className="text-sm font-semibold text-gray-900 dark:text-white mb-3">{row.label}</p>
                  <div className="grid grid-cols-2 gap-2 text-sm">
                    <div className="bg-primary-50 dark:bg-primary-900/20 rounded-lg p-2.5 text-center">
                      <p className="text-xs text-gray-500 mb-0.5">{APP_CONFIG.name}</p>
                      <p className="font-semibold text-primary-700 dark:text-primary-300">{row.opatam}</p>
                    </div>
                    <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-2.5 text-center">
                      <p className="text-xs text-gray-500 mb-0.5">Autres solutions</p>
                      <p className="font-medium text-gray-600 dark:text-gray-300">{row.others}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* Footnote */}
            <p className="mt-6 text-xs text-gray-500 dark:text-gray-500 text-center max-w-2xl mx-auto">
              * Les offres &laquo; gratuites &raquo; incluent generalement des commissions prelevees sur chaque
              reservation, des fonctionnalites limitees ou du support restreint. ** Estimation basee sur un tarif moyen
              de 25&euro; a 90&euro;/mois, hors commissions additionnelles.
            </p>
          </div>
        </section>

        {/* ── Section 9 - Pricing ────────────────────────────────────── */}
        <section id="tarifs" className="py-16 sm:py-24 bg-gray-50 dark:bg-gray-800">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="text-center max-w-3xl mx-auto mb-12">
              <h2 className="text-2xl sm:text-3xl lg:text-4xl font-bold text-gray-900 dark:text-white">
                Un prix juste, sans surprise
              </h2>
              <p className="mt-4 text-lg text-gray-600 dark:text-gray-400">
                Deux plans simples. Pas de commission cachee. Pas de frais supplementaires. Annulez quand vous voulez.
              </p>
            </div>

            {/* Monthly / Yearly toggle */}
            <div className="flex items-center justify-center gap-3 mb-12">
              <span
                className={`text-sm font-medium ${!isYearly ? 'text-gray-900 dark:text-white' : 'text-gray-500 dark:text-gray-400'}`}
              >
                Mensuel
              </span>
              <button
                onClick={() => setIsYearly(!isYearly)}
                className={`relative w-14 h-7 rounded-full transition-colors ${isYearly ? 'bg-primary-600' : 'bg-gray-300 dark:bg-gray-600'}`}
                aria-label="Basculer entre mensuel et annuel"
              >
                <span
                  className={`absolute top-0.5 left-0.5 w-6 h-6 rounded-full bg-white shadow transition-transform ${isYearly ? 'translate-x-7' : ''}`}
                />
              </button>
              <span
                className={`text-sm font-medium ${isYearly ? 'text-gray-900 dark:text-white' : 'text-gray-500 dark:text-gray-400'}`}
              >
                Annuel
              </span>
              {isYearly && (
                <span className="ml-2 inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400">
                  Economisez 33%
                </span>
              )}
            </div>

            {/* Pricing cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8 max-w-4xl mx-auto items-stretch">
              {/* Pro card */}
              <div className="flex flex-col bg-white dark:bg-gray-900 rounded-2xl p-8 border border-gray-200 dark:border-gray-700 transition-all duration-300 hover:-translate-y-1 hover:shadow-xl hover:border-gray-300 dark:hover:border-gray-600">
                <div className="flex items-center gap-3 mb-2">
                  <div className="w-11 h-11 rounded-xl bg-primary-50 dark:bg-primary-900/30 flex items-center justify-center">
                    <Zap className="w-5 h-5 text-primary-600 dark:text-primary-400" />
                  </div>
                  <h3 className="text-xl font-bold text-gray-900 dark:text-white">
                    {SUBSCRIPTION_PLANS.solo.name}
                  </h3>
                </div>
                <p className="text-sm text-gray-600 dark:text-gray-400 mb-6">
                  {SUBSCRIPTION_PLANS.solo.description}
                </p>

                <div className="mb-6">
                  <div className="flex items-baseline gap-1">
                    <span className="text-4xl font-extrabold text-gray-900 dark:text-white">
                      {isYearly ? proYearlyPerMonth : proMonthly}&euro;
                    </span>
                    <span className="text-base text-gray-500 font-medium">/mois</span>
                  </div>
                  {isYearly && (
                    <p className="text-sm text-gray-500 mt-1">
                      Facture {proYearlyTotal}&euro;/an
                    </p>
                  )}
                </div>

                <div className="border-t border-gray-100 dark:border-gray-800 mb-6" />

                <ul className="space-y-3 flex-1">
                  {SUBSCRIPTION_PLANS.solo.features.map((f) => (
                    <li key={f} className="flex items-start gap-3 text-sm text-gray-700 dark:text-gray-300">
                      <div className="flex items-center justify-center w-5 h-5 rounded-full bg-primary-50 dark:bg-primary-900/20 flex-shrink-0 mt-0.5">
                        <Check className="w-3 h-3 text-primary-600 dark:text-primary-400" />
                      </div>
                      {f}
                    </li>
                  ))}
                </ul>

                <Link
                  href="/register"
                  className="mt-8 block w-full text-center bg-gray-900 dark:bg-white text-white dark:text-gray-900 hover:bg-gray-800 dark:hover:bg-gray-100 px-6 py-3.5 font-semibold rounded-xl transition-all duration-200 hover:shadow-lg"
                >
                  Demarrer l&apos;essai gratuit
                </Link>
              </div>

              {/* Studio card (popular) */}
              <div className="relative flex flex-col bg-white dark:bg-gray-900 rounded-2xl p-8 border-2 border-primary-500 shadow-xl shadow-primary-500/10 transition-all duration-300 hover:-translate-y-1 hover:shadow-2xl hover:shadow-primary-500/15">
                {/* Popular badge */}
                <span className="absolute -top-3.5 left-1/2 -translate-x-1/2 inline-flex items-center gap-1.5 px-4 py-1.5 rounded-full text-xs font-bold bg-gradient-to-r from-primary-600 to-primary-500 text-white shadow-lg shadow-primary-500/25">
                  <Star className="w-3.5 h-3.5" />
                  Populaire
                </span>

                {/* Subtle gradient bg */}
                <div className="absolute inset-0 rounded-2xl bg-gradient-to-b from-primary-50/40 via-white to-white dark:from-primary-900/10 dark:via-gray-900 dark:to-gray-900 pointer-events-none" />

                <div className="relative">
                  <div className="flex items-center gap-3 mb-2">
                    <div className="w-11 h-11 rounded-xl bg-primary-100 dark:bg-primary-900/30 flex items-center justify-center">
                      <Users className="w-5 h-5 text-primary-600 dark:text-primary-400" />
                    </div>
                    <h3 className="text-xl font-bold text-gray-900 dark:text-white">
                      {SUBSCRIPTION_PLANS.team.name}
                    </h3>
                  </div>
                  <p className="text-sm text-gray-600 dark:text-gray-400 mb-6">
                    {SUBSCRIPTION_PLANS.team.description}
                  </p>

                  <div className="mb-6">
                    <div className="flex items-baseline gap-1">
                      <span className="text-4xl font-extrabold text-gray-900 dark:text-white">
                        {isYearly ? studioYearlyPerMonth : studioMonthly}&euro;
                      </span>
                      <span className="text-base text-gray-500 font-medium">/mois</span>
                    </div>
                    {isYearly && (
                      <p className="text-sm text-gray-500 mt-1">
                        Facture {studioYearlyTotal}&euro;/an
                      </p>
                    )}
                    <p className="text-xs text-primary-600/80 dark:text-primary-400/80 font-medium mt-1.5">
                      +{memberMonthly}&euro;/mois par membre supplementaire
                    </p>
                  </div>

                  <div className="border-t border-primary-100 dark:border-primary-900/30 mb-6" />

                  <ul className="space-y-3 flex-1">
                    {SUBSCRIPTION_PLANS.team.features.map((f) => (
                      <li key={f} className="flex items-start gap-3 text-sm text-gray-700 dark:text-gray-300">
                        <div className="flex items-center justify-center w-5 h-5 rounded-full bg-primary-100 dark:bg-primary-900/20 flex-shrink-0 mt-0.5">
                          <Check className="w-3 h-3 text-primary-600 dark:text-primary-400" />
                        </div>
                        {f}
                      </li>
                    ))}
                  </ul>

                  <Link
                    href="/register"
                    className="mt-8 block w-full text-center bg-primary-600 text-white hover:bg-primary-700 px-6 py-3.5 font-semibold rounded-xl transition-all duration-200 shadow-lg shadow-primary-500/25 hover:shadow-xl hover:shadow-primary-500/30"
                  >
                    Demarrer l&apos;essai gratuit
                  </Link>
                </div>
              </div>
            </div>

            <p className="mt-8 text-sm text-gray-500 dark:text-gray-500 text-center">
              {APP_CONFIG.trialDays} jours d&apos;essai gratuit sur tous les plans. Aucune carte bancaire requise.
            </p>
          </div>
        </section>

        {/* ── Section 10 - FAQ ───────────────────────────────────────── */}
        <section className="py-16 sm:py-24 bg-white dark:bg-gray-900">
          <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="text-center mb-12">
              <h2 className="text-2xl sm:text-3xl lg:text-4xl font-bold text-gray-900 dark:text-white">
                Questions frequentes
              </h2>
            </div>

            <div className="space-y-4">
              {faqItems.map((item, index) => {
                const isOpen = openFaq === index;
                return (
                  <div
                    key={index}
                    className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden"
                  >
                    <button
                      onClick={() => setOpenFaq(isOpen ? -1 : index)}
                      className="w-full flex items-center justify-between p-5 text-left"
                    >
                      <span className="text-sm font-semibold text-gray-900 dark:text-white pr-4">
                        {item.question}
                      </span>
                      <ChevronDown
                        className={`w-5 h-5 text-gray-500 flex-shrink-0 transition-transform ${isOpen ? 'rotate-180' : ''}`}
                      />
                    </button>
                    {isOpen && (
                      <div className="px-5 pb-5">
                        <p className="text-sm text-gray-600 dark:text-gray-400 leading-relaxed">{item.answer}</p>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </section>

        {/* ── Section 11 - Final CTA ─────────────────────────────────── */}
        <section className="py-16 sm:py-24 bg-primary-600">
          <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
            <h2 className="text-2xl sm:text-3xl lg:text-4xl font-bold text-white">Pret a remplir votre agenda ?</h2>
            <p className="mt-4 text-lg text-white/80">
              Rejoignez les professionnels qui ont choisi la simplicite et la transparence. Votre premiere reservation
              est a 5 minutes.
            </p>

            <div className="mt-10">
              <Link
                href="/register"
                className="inline-flex items-center justify-center bg-white text-primary-700 hover:bg-gray-50 px-8 py-4 text-lg font-semibold shadow-lg rounded-lg transition-colors"
              >
                Demarrer mon essai gratuit
              </Link>
            </div>
            <p className="mt-4 text-sm text-white/80">
              {APP_CONFIG.trialDays} jours gratuits — Sans carte bancaire — Sans engagement
            </p>
          </div>
        </section>

        {/* ── Section 12 - Marketplace redirect ──────────────────────── */}
        <section className="py-8 bg-gray-50 dark:bg-gray-800">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
            <p className="text-sm text-gray-600 dark:text-gray-400">
              Vous cherchez un professionnel pres de chez vous ?{' '}
              <Link
                href="/recherche"
                className="text-primary-600 dark:text-primary-400 hover:text-primary-700 dark:hover:text-primary-300 font-medium inline-flex items-center gap-1 transition-colors"
              >
                Rechercher un pro <ArrowRight className="w-4 h-4" />
              </Link>
            </p>
          </div>
        </section>
      </main>

      {/* ── Section 13 - Footer ────────────────────────────────────── */}
      <Footer />

      {/* ── Sticky mobile CTA ────────────────────────────────────────── */}
      <div
        className={`fixed bottom-0 left-0 right-0 z-50 md:hidden transition-transform duration-300 ${
          showStickyCta ? 'translate-y-0' : 'translate-y-full'
        }`}
      >
        <div className="bg-white dark:bg-gray-900 border-t border-gray-200 dark:border-gray-700 px-4 py-3 shadow-lg">
          <Link
            href="/register"
            className="block w-full text-center bg-primary-600 text-white hover:bg-primary-700 px-6 py-3 font-semibold rounded-lg transition-colors"
          >
            Essai gratuit {APP_CONFIG.trialDays} jours
          </Link>
        </div>
      </div>
    </div>
  );
}
