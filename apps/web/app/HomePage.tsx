'use client';

import { Footer } from '@/components/layout/Footer';
import { Header } from '@/components/layout/Header';
import { APP_CONFIG, SUBSCRIPTION_PLANS } from '@booking-app/shared/constants';
import {
  ArrowRight,
  BadgePercent,
  BarChart3,
  Bell,
  Calendar,
  CalendarCheck,
  Camera,
  Check,
  ChevronDown,
  CreditCard,
  Dumbbell,
  Globe,
  Heart,
  Lightbulb,
  Lock,
  Mail,
  MapPin,
  QrCode,
  Quote,
  Shield,
  Smartphone,
  Sparkles,
  Star,
  Users,
  Wrench,
  Zap,
} from 'lucide-react';
import Image from 'next/image';
import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import { PlayStoreWaitlistModal } from '@/components/common/PlayStoreWaitlistModal';
import { SocialLinks } from '@/components/common/SocialLinks';
import { TutorialsSection } from '@/components/home/TutorialsSection';
import { HowItWorksAnimated } from '@/components/home/HowItWorksAnimated';
import { HeroVideo } from '@/components/home/HeroVideo';
import { StorySection } from '@/components/home/StorySection';
import type { ArticleCardData } from '@/app/blog/components/ArticleCard';

// ─── Helpers ────────────────────────────────────────────────────────
function formatPrice(cents: number): string {
  return (cents / 100).toFixed(2).replace('.', ',');
}

// ─── FAQ Data ───────────────────────────────────────────────────────
const faqItems = [
  {
    question: 'Quel est le meilleur logiciel de prise de rendez-vous en ligne pour indépendants ?',
    answer:
      'OPATAM est conçu spécifiquement pour les indépendants et les petites équipes : agenda en ligne, page de réservation personnalisée, rappels automatiques 24h et 2h avant, application mobile — sans commission, prêt en 5 minutes. Plus de 15 métiers de service y trouvent leur compte.',
  },
  {
    question: 'Comment permettre à mes clients de réserver en ligne sans créer de compte ?',
    answer:
      'Vos clients tapent leur nom, leur email et leur téléphone — c\'est tout. Pas de compte à créer, pas de mot de passe. Vous récupérez un lien personnalisé et un QR code à mettre dans votre bio Instagram, sur vos flyers, ou à afficher en boutique. Réservation finalisée en 3 clics.',
  },
  {
    question: 'Comment gérer les rendez-vous de mon équipe depuis un seul outil ?',
    answer:
      'Le plan Studio (29,90\u20AC/mois) gère jusqu\'à 10 agendas synchronisés. Chaque membre a son propre planning et ses propres prestations. Vous pouvez les notifier de chaque nouveau rendez-vous, leur envoyer le récap quotidien le soir d\'avant, et garder la vue d\'ensemble sur toute l\'équipe.',
  },
  {
    question: 'Comment réduire les rendez-vous manqués et les oublis de mes clients ?',
    answer:
      'OPATAM envoie automatiquement un rappel 24h avant le rendez-vous, puis un second 2h avant. Vos clients reçoivent aussi une confirmation instantanée à la réservation. Concrètement : moins d\'oublis, plus de créneaux qui tiennent, plus de revenus à la fin du mois.',
  },
  {
    question: 'Combien coûte un logiciel de réservation en ligne professionnel ?',
    answer:
      'Deux formules sans engagement : Pro à 19,90\u20AC/mois (ou 199\u20AC/an) pour les indépendants, Studio à 29,90\u20AC/mois (ou 299\u20AC/an) pour les équipes jusqu\'à 10 personnes. Essai gratuit de 30 jours, sans carte bancaire. Et zéro commission sur vos réservations — vous gardez 100% de ce que vous facturez.',
  },
  {
    question: 'Peut-on utiliser un agenda de réservation en ligne sur téléphone ?',
    answer:
      'Oui. L\'application mobile iOS et Android vous laisse consulter votre agenda, valider les nouveaux rendez-vous et recevoir les notifications en temps réel. Vous configurez sur votre ordinateur, vous gérez votre quotidien depuis votre poche — entre deux rendez-vous, dans le métro, où vous voulez.',
  },
  {
    question: 'Est-ce qu\'OPATAM est adapté aux métiers de la beauté, du bien-être et du coaching ?',
    answer:
      'Coiffeurs, esthéticiennes, barbiers, prothésistes ongulaires, masseurs, sophrologues, coachs sportifs, thérapeutes, photographes, artisans, formateurs… Chaque pro personnalise ses prestations, ses durées, ses tarifs et son agenda comme il l\'entend.',
  },
];

// ─── Comparison Data ────────────────────────────────────────────────
const comparisonRows = [
  { label: 'Tarif mensuel', opatam: '19,90\u20AC', others: 'De 0\u20AC* à 90\u20AC/mois' },
  { label: 'Commissions sur vos réservations', opatam: '0%', others: "Jusqu'à 20% ou 1\u20AC par RDV" },
  { label: "Période d'essai", opatam: '30 jours gratuits', others: 'Souvent limitée ou absente' },
  { label: 'Rappels automatiques', opatam: 'Inclus', others: 'Parfois en option payante' },
  { label: 'Vitrine en ligne personnalisée', opatam: 'Inclus', others: 'Incluse mais modèles limités' },
  { label: 'Engagement', opatam: 'Sans engagement', others: "Variable selon l'offre" },
  { label: 'Coût réel annuel (exemple)', opatam: '199,00\u20AC', others: 'De 300\u20AC à 1 080\u20AC**' },
];

// ─── Testimonials Data ──────────────────────────────────────────────
const testimonials = [
  {
    name: 'Marie L.',
    role: 'Coiffeuse indépendante',
    city: 'Lyon',
    initials: 'ML',
    text: "0% de commission, c'est ce qui m'a convaincue. Je garde 100% de ce que je gagne. Et l'outil est tellement simple que j'ai été en ligne en 10 minutes.",
  },
  {
    name: 'Karim B.',
    role: 'Barbier',
    city: 'Paris',
    initials: 'KB',
    text: "Le soir de l'inscription, j'avais déjà trois réservations via le lien dans ma bio Instagram. Plus besoin de répondre aux DM à 22h pour caler un créneau.",
  },
  {
    name: 'Sophie D.',
    role: "Gérante d'institut de beauté",
    city: 'Marseille',
    initials: 'SD',
    text: "On est trois dans l'institut, chacune a son agenda sur le sien. Pour moitié moins cher que ce qu'on payait avant — et mieux pensé pour notre métier.",
  },
];

// ─── Features Data ──────────────────────────────────────────────────
// To use a real screenshot, place the image in /public/images/features/ and set the image path below.
// If image is null, the CSS mockup fallback is displayed instead.
const mainFeatures = [
  {
    title: 'Un agenda qui se remplit tout seul',
    description:
      "Vos créneaux disponibles, vos pauses, vos jours off — tout est visible en un coup d'œil. Les rappels partent automatiquement à vos clients. Plus jamais de SMS de relance à écrire à 22h.",
    icon: Calendar,
    mockup: 'agenda' as const,
    image: null as string | null, // e.g. '/images/features/agenda.png'
  },
  {
    title: 'Vos clients réservent pendant que vous dormez',
    description:
      'Votre page de réservation est en ligne 24h/24. Vos clients choisissent leur prestation et leur créneau en trois clics — sans créer de compte, sans vous DM. Au réveil, votre planning est rempli.',
    icon: Globe,
    mockup: 'booking' as const,
    image: null as string | null, // e.g. '/images/features/booking-mobile.png'
  },
  {
    title: 'Tout votre agenda dans votre poche',
    description:
      "Vous configurez vos prestations et vos horaires depuis votre ordinateur. Au quotidien, vous suivez votre planning, vous validez les nouveaux rendez-vous et vous recevez vos alertes directement dans l'application mobile.",
    icon: Smartphone,
    mockup: 'mobile' as const,
    image: null as string | null, // e.g. '/images/features/mobile-app.png'
  },
  {
    title: "Toute l'équipe synchronisée",
    description:
      "Chaque membre a son propre planning, ses propres prestations, son propre code d'accès. Vous gardez la vue d'ensemble. Plus de carnet partagé, plus de « on s'est marché dessus ».",
    icon: Users,
    mockup: 'team' as const,
    image: null as string | null, // e.g. '/images/features/team.png'
  },
];

const secondaryFeatures = [
  { icon: Globe, title: 'Votre vitrine en ligne', description: 'Une vraie page pro avec vos prestations, vos avis et vos photos — partageable en un lien' },
  { icon: QrCode, title: 'QR Code à afficher', description: 'Un QR Code à coller sur votre comptoir ou sur vos cartes. Vos clientes scannent, elles réservent' },
  { icon: Bell, title: 'Plus jamais d\'oubli', description: 'Rappel automatique 24h et 2h avant chaque rendez-vous. Vos no-shows baissent, votre journée tient' },
  { icon: BarChart3, title: 'Vos chiffres en clair', description: 'Réservations, vues de votre page, activité de la semaine — tout sur un seul écran, mis à jour en direct' },
  { icon: MapPin, title: 'Plusieurs adresses, un agenda', description: "Salon, domicile, déplacement — jusqu'à 10 lieux avec des disponibilités différentes pour chacun" },
  { icon: Mail, title: 'Le récap de demain, ce soir', description: "Chaque soir, vous recevez par email l'agenda du lendemain. Plus de surprise au réveil" },
  { icon: Smartphone, title: 'L\'app iOS et Android', description: 'Votre agenda dans votre poche, notifs en temps réel à chaque réservation' },
  { icon: Shield, title: 'Hébergé en Europe', description: 'Conforme RGPD, données hébergées en France. Vous restez propriétaire de tout' },
];

const sectors = [
  { icon: Sparkles, title: 'Beauté & Esthétique', examples: 'Coiffeurs, esthéticiennes, barbiers, prothésistes ongulaires' },
  { icon: Heart, title: 'Bien-être', examples: 'Masseurs, sophrologues, naturopathes, ostéopathes' },
  { icon: Dumbbell, title: 'Sport & Coaching', examples: 'Coachs sportifs, personal trainers, salles de sport' },
  { icon: Lightbulb, title: 'Coaching', examples: 'Coachs de vie, thérapeutes, consultants en développement' },
  { icon: Wrench, title: 'Artisans', examples: 'Plombiers, électriciens, serruriers, peintres' },
  { icon: Camera, title: 'Audiovisuel', examples: 'Photographes, vidéastes, créateurs de contenu' },
];

// ═════════════════════════════════════════════════════════════════════
// COMPONENT
// ═════════════════════════════════════════════════════════════════════
interface LandingPageProps {
  /** Optional list of published tutorials surfaced just above the FAQ. */
  tutorials?: ArticleCardData[];
}

export default function LandingPage({ tutorials = [] }: LandingPageProps) {
  // ── State ─────────────────────────────────────────────────────────
  const [openFaq, setOpenFaq] = useState<number>(0);
  const [isYearly, setIsYearly] = useState(false);
  const [showStickyCta, setShowStickyCta] = useState(false);
  const [showPlayStoreModal, setShowPlayStoreModal] = useState(false);
  const heroRef = useRef<HTMLElement>(null);

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

  return (
    <div className="min-h-screen flex flex-col">
      {/* ── Section 1 - Header ─────────────────────────────────────── */}
      <Header />

      <main className="flex-1 overflow-x-hidden">
        {/* ── Section 2 - Hero (cinematic full-bleed) ──────────────────
            Video plays as a full-bleed background; a dark gradient
            guarantees text legibility on any frame. Content is
            centered vertically and packed densely (headline, sub,
            three trust pills, CTAs, disclaimer) so the copy carries
            the message — the video stays atmospheric, not dominant.
            Same experience on mobile (video is compressed to ~2.8MB
            and the loader is the LCP). */}
        <section
          ref={heroRef}
          className="relative min-h-[640px] h-[72vh] max-h-[820px] overflow-hidden bg-gray-900"
        >
          {/* Background loader + video (sibling layers, parent sized) */}
          <HeroVideo variant="background" />

          {/* Vertical dark gradient — keeps text readable on any
              frame and gives the bottom CTAs the most contrast. */}
          <div
            aria-hidden="true"
            className="absolute inset-0 bg-gradient-to-b from-black/40 via-black/55 to-black/80"
          />
          {/* Extra left-side darkening on wide viewports where the
              copy is left-aligned. No effect on mobile (centered). */}
          <div
            aria-hidden="true"
            className="hidden lg:block absolute inset-0 bg-gradient-to-r from-black/40 via-black/10 to-transparent"
          />

          {/* Foreground content — vertically centered so the copy
              occupies the optical middle of the frame, not the very
              bottom corner. */}
          <div className="relative z-10 h-full flex flex-col justify-center max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16 sm:py-20">
            <div className="max-w-3xl text-center lg:text-left mx-auto lg:mx-0">
              <h1 className="animate-fade-in-up text-4xl sm:text-5xl lg:text-6xl font-bold text-white tracking-tight drop-shadow-lg">
                Vos rendez-vous ne devraient plus vivre dans vos DM.
              </h1>
              <p className="animate-fade-in-up animation-delay-150 mt-5 sm:mt-6 text-base sm:text-lg lg:text-xl text-white/90 max-w-2xl mx-auto lg:mx-0 drop-shadow-md">
                Le logiciel de réservation en ligne pour les indépendants. Vos clients réservent 24h/24, les rappels partent automatiquement, et vous gardez 100% de vos gains. Prêt en 5 minutes.
              </p>

              {/* Trust pills — frosted-glass chips so they read on the
                  video without losing the cinematic feel. Three core
                  proof points: speed, no commission, entry price. */}
              <div className="animate-fade-in-up animation-delay-300 mt-6 sm:mt-7 flex flex-wrap items-center justify-center lg:justify-start gap-2 sm:gap-3">
                <span className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/10 backdrop-blur-sm border border-white/20 text-white text-xs sm:text-sm font-medium">
                  <CalendarCheck className="w-4 h-4 text-primary-300" />
                  Prêt en 5 min
                </span>
                <span className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/10 backdrop-blur-sm border border-white/20 text-white text-xs sm:text-sm font-medium">
                  <BadgePercent className="w-4 h-4 text-primary-300" />
                  0% de commission
                </span>
                <span className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/10 backdrop-blur-sm border border-white/20 text-white text-xs sm:text-sm font-medium">
                  <CreditCard className="w-4 h-4 text-primary-300" />
                  Dès {proMonthly}&euro;/mois
                </span>
              </div>

              {/* CTAs — primary solid; secondary frosted-glass outline. */}
              <div className="animate-fade-in-up animation-delay-500 mt-7 sm:mt-8 flex flex-col sm:flex-row items-center gap-4 justify-center lg:justify-start">
                <Link
                  href="/register"
                  className="inline-flex items-center justify-center bg-primary-600 text-white hover:bg-primary-500 hover:shadow-xl hover:shadow-primary-600/40 px-8 py-4 text-lg font-semibold rounded-lg transition-all duration-200 w-full sm:w-auto"
                >
                  Créer ma page
                </Link>
                <Link
                  href="/p/demo"
                  className="inline-flex items-center justify-center border border-white/40 bg-white/10 backdrop-blur-sm text-white hover:bg-white/20 hover:border-white/70 px-8 py-4 text-lg font-semibold rounded-lg transition-all duration-200 w-full sm:w-auto"
                >
                  Voir une démo
                </Link>
              </div>
              <p className="animate-fade-in animation-delay-700 mt-4 text-sm text-white/80 text-center lg:text-left">
                {APP_CONFIG.trialDays} jours gratuits, sans carte bancaire, sans engagement
              </p>
            </div>
          </div>
        </section>

        {/* ── App Store strip ─────────────────────────────────────────
            Trust pills moved up into the Hero; this band is the
            dedicated install path for iOS (live) and Android
            (waitlist). Stacked + perfectly centered: small caption
            above, two badges below. Reads as a clean utility band,
            not as competing chrome. */}
        <section className="bg-white dark:bg-gray-900 border-b border-gray-100 dark:border-gray-800 py-6 sm:py-7">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex flex-col items-center gap-3">
              <span className="text-xs sm:text-sm font-medium uppercase tracking-wider text-gray-500 dark:text-gray-400">
                Aussi disponible sur mobile
              </span>
              <div className="flex flex-row flex-wrap justify-center gap-3">
                <a
                  href="https://apps.apple.com/us/app/opatam-agenda-rendez-vous/id6759246218"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2.5 px-4 py-2.5 bg-black text-white rounded-xl hover:bg-gray-800 transition-colors shadow-sm"
                >
                  <svg className="w-6 h-6" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.81-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M13 3.5c.73-.83 1.94-1.46 2.94-1.5.13 1.17-.34 2.35-1.04 3.19-.69.85-1.83 1.51-2.95 1.42-.15-1.15.41-2.35 1.05-3.11z" />
                  </svg>
                  <div className="text-left">
                    <div className="text-[10px] leading-tight opacity-80">Télécharger sur l&apos;</div>
                    <div className="text-sm font-semibold leading-tight">App Store</div>
                  </div>
                </a>
                <button
                  onClick={() => setShowPlayStoreModal(true)}
                  className="inline-flex items-center gap-2.5 px-4 py-2.5 bg-black/80 text-white rounded-xl hover:bg-gray-800 transition-colors shadow-sm relative"
                >
                  <svg className="w-6 h-6" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M3,20.5V3.5C3,2.91 3.34,2.39 3.84,2.15L13.69,12L3.84,21.85C3.34,21.6 3,21.09 3,20.5M16.81,15.12L6.05,21.34L14.54,12.85L16.81,15.12M20.16,10.81C20.5,11.08 20.75,11.5 20.75,12C20.75,12.5 20.53,12.9 20.18,13.18L17.89,14.5L15.39,12L17.89,9.5L20.16,10.81M6.05,2.66L16.81,8.88L14.54,11.15L6.05,2.66Z" />
                  </svg>
                  <div className="text-left">
                    <div className="text-[10px] leading-tight opacity-80">Bientôt sur</div>
                    <div className="text-sm font-semibold leading-tight">Google Play</div>
                  </div>
                  <span className="absolute -top-2 -right-2 px-2 py-0.5 bg-primary-500 text-white text-[10px] font-bold rounded-full shadow">
                    Bientôt
                  </span>
                </button>
              </div>
            </div>
          </div>
        </section>

        {/* ── Tutoriels ─────────────────────────────────────────────────
            Surfaced right after the Hero so the promise is made
            tangible before any other proof point. Hidden when the
            list is empty — the section component handles that. */}
        <TutorialsSection tutorials={tutorials} />

        {/* ── Section 3 - Social Proof Metrics ──────────────────────── */}
        <section className="py-10 bg-white dark:bg-gray-900 border-b border-gray-100 dark:border-gray-800">
          <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-8 text-center">
              {[
                { value: '15+', label: 'Secteurs d\'activité' },
                { value: '24/7', label: 'Réservation en ligne' },
                { value: '0%', label: 'Commission' },
                { value: '5 min', label: 'Pour démarrer' },
              ].map((stat) => (
                <div key={stat.label}>
                  <p className="text-3xl sm:text-4xl font-extrabold text-primary-600 dark:text-primary-400">{stat.value}</p>
                  <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">{stat.label}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ── Section 3b - Instagram / Snapchat story feature ─────── */}
        <StorySection />

        {/* ── Section 4 - Main Features (Alternating) ──────────────── */}
        <section id="fonctionnalites" className="py-16 sm:py-24 bg-white dark:bg-gray-900">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="text-center max-w-3xl mx-auto mb-16">
              <h2 className="text-2xl sm:text-3xl lg:text-4xl font-bold text-gray-900 dark:text-white">
                Reprenez le contrôle de votre quotidien
              </h2>
              <p className="mt-4 text-lg text-gray-600 dark:text-gray-400">
                Fini les DM Instagram à 22h, les agendas papier, les SMS de relance. {APP_CONFIG.name} s'occupe de l'administratif pour que vous restiez concentré sur votre métier.
              </p>
            </div>

            <div className="space-y-20 lg:space-y-28">
              {mainFeatures.map((feature, index) => {
                const Icon = feature.icon;
                const isReversed = index % 2 === 1;
                return (
                  <div
                    key={feature.title}
                    className={`flex flex-col ${isReversed ? 'lg:flex-row-reverse' : 'lg:flex-row'} items-center gap-10 lg:gap-16`}
                  >
                    {/* Text */}
                    <div className="flex-1 text-center lg:text-left">
                      <div className="inline-flex items-center justify-center w-12 h-12 rounded-xl bg-primary-100 dark:bg-primary-900/30 mb-4">
                        <Icon className="w-6 h-6 text-primary-600 dark:text-primary-400" />
                      </div>
                      <h3 className="text-2xl sm:text-3xl font-bold text-gray-900 dark:text-white">
                        {feature.title}
                      </h3>
                      <p className="mt-4 text-lg text-gray-600 dark:text-gray-400 max-w-lg mx-auto lg:mx-0">
                        {feature.description}
                      </p>
                    </div>

                    {/* Mockup visual — real image if available, CSS fallback otherwise */}
                    <div className="flex-1 w-full max-w-lg">
                      {feature.image ? (
                        <div className="rounded-2xl shadow-2xl border border-gray-200 dark:border-gray-700 overflow-hidden">
                          <Image
                            src={feature.image}
                            alt={feature.title}
                            width={960}
                            height={640}
                            className="w-full h-auto"
                            priority={index === 0}
                          />
                        </div>
                      ) : (
                        <>
                          {feature.mockup === 'agenda' && (
                            <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl border border-gray-200 dark:border-gray-700 overflow-hidden">
                              <div className="flex items-center gap-2 px-4 py-3 bg-gray-50 dark:bg-gray-900 border-b border-gray-200 dark:border-gray-700">
                                <div className="flex gap-1.5">
                                  <div className="w-3 h-3 rounded-full bg-red-400" />
                                  <div className="w-3 h-3 rounded-full bg-yellow-400" />
                                  <div className="w-3 h-3 rounded-full bg-green-400" />
                                </div>
                                <div className="flex-1 text-center text-xs text-gray-400">opatam.com/pro/calendar</div>
                              </div>
                              <div className="p-5">
                                <div className="flex items-center gap-3 mb-5">
                                  <Calendar className="w-6 h-6 text-primary-600 dark:text-primary-400" />
                                  <div>
                                    <p className="text-sm font-semibold text-gray-900 dark:text-white">Mon agenda</p>
                                    <p className="text-xs text-gray-500">Semaine du 3 février</p>
                                  </div>
                                </div>
                                <div className="grid grid-cols-5 gap-2">
                                  {['Lun', 'Mar', 'Mer', 'Jeu', 'Ven'].map((day, i) => (
                                    <div key={day} className="text-center">
                                      <p className="text-xs font-medium text-gray-500 mb-2">{day}</p>
                                      <div className="space-y-1.5">
                                        <div className="rounded bg-primary-200 dark:bg-primary-800" style={{ height: `${18 + (i * 7) % 20}px` }} />
                                        <div className="rounded bg-primary-400 dark:bg-primary-600" style={{ height: `${28 - (i * 3) % 10}px` }} />
                                        <div className="rounded bg-gray-100 dark:bg-gray-700" style={{ height: `${10 + (i * 2) % 8}px` }} />
                                        <div className="rounded bg-primary-300 dark:bg-primary-700" style={{ height: `${16 + (i * 4) % 12}px` }} />
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            </div>
                          )}

                          {feature.mockup === 'booking' && (
                            <div className="mx-auto w-64 sm:w-72">
                              <div className="bg-white dark:bg-gray-800 rounded-[2rem] shadow-2xl border border-gray-200 dark:border-gray-700 p-4 pb-6">
                                <div className="w-20 h-5 bg-gray-100 dark:bg-gray-700 rounded-full mx-auto mb-4" />
                                <div className="space-y-3">
                                  <div className="flex items-center gap-3 p-3 bg-gray-50 dark:bg-gray-900 rounded-xl">
                                    <div className="w-12 h-12 rounded-full bg-primary-200 dark:bg-primary-800" />
                                    <div>
                                      <div className="h-3 w-28 bg-gray-300 dark:bg-gray-600 rounded mb-1.5" />
                                      <div className="h-2 w-20 bg-gray-200 dark:bg-gray-700 rounded" />
                                    </div>
                                  </div>
                                  <div className="p-3 bg-primary-50 dark:bg-primary-900/20 rounded-xl">
                                    <p className="text-xs font-semibold text-primary-700 dark:text-primary-300 mb-2">Choisir une prestation</p>
                                    {['Coupe femme — 35€', 'Brushing — 25€', 'Coloration — 55€'].map((s) => (
                                      <div key={s} className="flex items-center justify-between py-2 border-b border-primary-100 dark:border-primary-800 last:border-0">
                                        <span className="text-xs text-gray-700 dark:text-gray-300">{s}</span>
                                        <div className="w-4 h-4 rounded-full border-2 border-primary-400" />
                                      </div>
                                    ))}
                                  </div>
                                  <div className="bg-primary-600 text-white text-center py-2.5 rounded-xl text-sm font-semibold">
                                    Réserver
                                  </div>
                                </div>
                              </div>
                            </div>
                          )}

                          {feature.mockup === 'mobile' && (
                            <div className="mx-auto w-64 sm:w-72">
                              <div className="bg-white dark:bg-gray-800 rounded-[2rem] shadow-2xl border border-gray-200 dark:border-gray-700 p-4 pb-6">
                                <div className="w-20 h-5 bg-gray-100 dark:bg-gray-700 rounded-full mx-auto mb-4" />
                                <div className="space-y-3">
                                  <div className="bg-primary-600 rounded-xl p-3">
                                    <p className="text-xs font-semibold text-white mb-1">Aujourd&apos;hui</p>
                                    <p className="text-2xl font-bold text-white">4 RDV</p>
                                    <p className="text-xs text-primary-200">Prochain dans 25 min</p>
                                  </div>
                                  <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-xl p-3 flex items-start gap-2">
                                    <Bell className="w-4 h-4 text-green-600 dark:text-green-400 flex-shrink-0 mt-0.5" />
                                    <div>
                                      <p className="text-xs font-semibold text-green-800 dark:text-green-300">Nouvelle réservation</p>
                                      <p className="text-[10px] text-green-600 dark:text-green-400">Alice M. — Coupe + Brushing — 14h00</p>
                                    </div>
                                  </div>
                                  {[
                                    { time: '10:00', name: 'Marie L.', service: 'Brushing' },
                                    { time: '11:30', name: 'Thomas R.', service: 'Barbe' },
                                  ].map((rdv) => (
                                    <div key={rdv.time} className="flex items-center gap-3 p-2.5 bg-gray-50 dark:bg-gray-900 rounded-lg">
                                      <div className="text-xs font-bold text-primary-600 dark:text-primary-400 w-10">{rdv.time}</div>
                                      <div className="flex-1">
                                        <p className="text-xs font-medium text-gray-900 dark:text-white">{rdv.name}</p>
                                        <p className="text-[10px] text-gray-500">{rdv.service}</p>
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            </div>
                          )}

                          {feature.mockup === 'team' && (
                            <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl border border-gray-200 dark:border-gray-700 overflow-hidden">
                              <div className="flex items-center gap-2 px-4 py-3 bg-gray-50 dark:bg-gray-900 border-b border-gray-200 dark:border-gray-700">
                                <div className="flex gap-1.5">
                                  <div className="w-3 h-3 rounded-full bg-red-400" />
                                  <div className="w-3 h-3 rounded-full bg-yellow-400" />
                                  <div className="w-3 h-3 rounded-full bg-green-400" />
                                </div>
                                <div className="flex-1 text-center text-xs text-gray-400">opatam.com/pro/members</div>
                              </div>
                              <div className="p-5">
                                <div className="flex items-center gap-3 mb-5">
                                  <Users className="w-6 h-6 text-primary-600 dark:text-primary-400" />
                                  <p className="text-sm font-semibold text-gray-900 dark:text-white">Mon équipe</p>
                                </div>
                                <div className="space-y-3">
                                  {[
                                    { name: 'Marie D.', role: 'Coiffeuse', rdv: '6 RDV aujourd\'hui', color: 'bg-primary-400' },
                                    { name: 'Julie K.', role: 'Coloriste', rdv: '4 RDV aujourd\'hui', color: 'bg-emerald-400' },
                                    { name: 'Thomas R.', role: 'Barbier', rdv: '5 RDV aujourd\'hui', color: 'bg-amber-400' },
                                  ].map((member) => (
                                    <div key={member.name} className="flex items-center gap-3 p-3 bg-gray-50 dark:bg-gray-900 rounded-xl">
                                      <div className={`w-10 h-10 rounded-full ${member.color} flex items-center justify-center text-white text-xs font-bold`}>
                                        {member.name.split(' ').map(n => n[0]).join('')}
                                      </div>
                                      <div className="flex-1">
                                        <p className="text-sm font-medium text-gray-900 dark:text-white">{member.name}</p>
                                        <p className="text-xs text-gray-500">{member.role}</p>
                                      </div>
                                      <span className="text-xs font-medium text-primary-600 dark:text-primary-400">{member.rdv}</span>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            </div>
                          )}
                        </>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </section>

        {/* ── Section 5 - Secondary Features Grid ──────────────────── */}
        <section className="py-16 sm:py-24 bg-gray-50 dark:bg-gray-800">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="text-center max-w-3xl mx-auto mb-12">
              <h2 className="text-2xl sm:text-3xl lg:text-4xl font-bold text-gray-900 dark:text-white">
                Et tout le reste, déjà inclus
              </h2>
              <p className="mt-4 text-lg text-gray-600 dark:text-gray-400">
                Pas de modules à débloquer, pas d'options payantes cachées. Ce que vous voyez, c'est ce que vous avez.
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
              {secondaryFeatures.map((feature) => {
                const Icon = feature.icon;
                return (
                  <div
                    key={feature.title}
                    className="group bg-white dark:bg-gray-900 rounded-xl p-6 border border-gray-100 dark:border-gray-700 transition-all duration-300 hover:-translate-y-1 hover:shadow-lg hover:border-primary-200 dark:hover:border-primary-800"
                  >
                    <div className="w-12 h-12 rounded-xl bg-primary-100 dark:bg-primary-900/30 flex items-center justify-center mb-4 transition-transform duration-300 group-hover:scale-110">
                      <Icon className="w-6 h-6 text-primary-600 dark:text-primary-400" />
                    </div>
                    <h3 className="text-base font-semibold text-gray-900 dark:text-white mb-2">{feature.title}</h3>
                    <p className="text-sm text-gray-600 dark:text-gray-400">{feature.description}</p>
                  </div>
                );
              })}
            </div>
          </div>
        </section>

        {/* ── Section 6 - Sectors ───────────────────────────────────── */}
        <section className="py-16 sm:py-24 bg-white dark:bg-gray-900">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="text-center max-w-3xl mx-auto mb-12">
              <h2 className="text-2xl sm:text-3xl lg:text-4xl font-bold text-gray-900 dark:text-white">
                Pensé pour les indépendants. Tous les indépendants.
              </h2>
              <p className="mt-4 text-lg text-gray-600 dark:text-gray-400">
                De la coiffeuse à domicile au tatoueur de studio, du coach sportif au thérapeute — {APP_CONFIG.name} s&apos;adapte à votre métier, pas l&apos;inverse.
              </p>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4 lg:gap-6">
              {sectors.map((sector) => {
                const Icon = sector.icon;
                return (
                  <div
                    key={sector.title}
                    className="group text-center p-5 bg-gray-50 dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700 transition-all duration-300 hover:-translate-y-1 hover:shadow-lg hover:border-primary-200 dark:hover:border-primary-800"
                  >
                    <div className="w-12 h-12 rounded-xl bg-primary-100 dark:bg-primary-900/30 flex items-center justify-center mx-auto mb-3 transition-transform duration-300 group-hover:scale-110">
                      <Icon className="w-6 h-6 text-primary-600 dark:text-primary-400" />
                    </div>
                    <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-1">{sector.title}</h3>
                    <p className="text-xs text-gray-500 dark:text-gray-400">{sector.examples}</p>
                  </div>
                );
              })}
            </div>
          </div>
        </section>

        {/* ── Section 7 - How it works (animated) ─────────────────── */}
        <HowItWorksAnimated />

        {/* ── Section 8 - Testimonials ───────────────────────────────── */}
        <section id="temoignages" className="py-16 sm:py-24 bg-gray-50 dark:bg-gray-800">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="text-center mb-12">
              <h2 className="text-2xl sm:text-3xl lg:text-4xl font-bold text-gray-900 dark:text-white">
                Ce qu'en disent les indépendants qui l'utilisent
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

        {/* ── Section 9 - Comparison ─────────────────────────────────── */}
        <section className="py-16 sm:py-24 bg-white dark:bg-gray-900">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="text-center max-w-3xl mx-auto mb-12">
              <h2 className="text-2xl sm:text-3xl lg:text-4xl font-bold text-gray-900 dark:text-white">
                Pourquoi {APP_CONFIG.name}, et pas les autres
              </h2>
              <p className="mt-4 text-lg text-gray-600 dark:text-gray-400">
                Un prix clair, zéro commission, toutes les fonctionnalités essentielles dès le premier jour. Pas de petite ligne, pas de plan caché.
              </p>
            </div>

            {/* Desktop Table */}
            <div className="hidden md:block max-w-3xl mx-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr>
                    <th className="text-left py-4 px-4 font-semibold text-gray-900 dark:text-white">Critère</th>
                    <th className="py-4 px-4 font-semibold text-white bg-primary-600 rounded-t-lg">
                      {APP_CONFIG.name}
                    </th>
                    <th className="py-4 px-4 font-semibold text-gray-500 dark:text-gray-400">
                      Autres applications
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
                      <p className="text-xs text-gray-500 mb-0.5">Autres applications</p>
                      <p className="font-medium text-gray-600 dark:text-gray-300">{row.others}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* Footnote */}
            <p className="mt-6 text-xs text-gray-500 dark:text-gray-500 text-center max-w-2xl mx-auto">
              * Les offres &laquo; gratuites &raquo; incluent généralement des commissions prélevées sur chaque
              réservation, des fonctionnalités limitées ou du support restreint. ** Estimation basée sur un tarif moyen
              de 25&euro; à 90&euro;/mois, hors commissions additionnelles.
            </p>
          </div>
        </section>

        {/* ── Section 10 - Pricing ───────────────────────────────────── */}
        <section id="tarifs" className="py-16 sm:py-24 bg-gray-50 dark:bg-gray-800">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="text-center max-w-3xl mx-auto mb-12">
              <h2 className="text-2xl sm:text-3xl lg:text-4xl font-bold text-gray-900 dark:text-white">
                Un prix juste, sans surprise
              </h2>
              <p className="mt-4 text-lg text-gray-600 dark:text-gray-400">
                Deux formules. Aucune commission. Vous annulez quand vous voulez.
              </p>
            </div>

            {/* ── Early adopter pricing block ── */}
            <div className="max-w-5xl mx-auto">
              <div className="relative overflow-hidden rounded-3xl p-[1px]">
                {/* Animated golden border */}
                <div className="absolute inset-0 rounded-3xl bg-gradient-to-r from-amber-500/0 via-amber-400/60 to-amber-500/0 animate-shimmer pointer-events-none" />

                <div className="relative rounded-[calc(1.5rem-1px)] bg-gradient-to-b from-gray-900 via-gray-900 to-gray-950 dark:from-gray-950 dark:via-gray-950 dark:to-black overflow-hidden">
                  {/* Decorative glow orbs */}
                  <div className="absolute -top-32 left-1/2 -translate-x-1/2 w-96 h-96 rounded-full bg-amber-500/8 blur-3xl pointer-events-none" />
                  <div className="absolute -bottom-40 -left-20 w-72 h-72 rounded-full bg-primary-500/5 blur-3xl pointer-events-none" />
                  <div className="absolute -bottom-40 -right-20 w-72 h-72 rounded-full bg-amber-400/5 blur-3xl pointer-events-none" />

                  {/* ─ Top section: guarantee message ─ */}
                  <div className="relative px-6 pt-10 pb-8 sm:px-10 sm:pt-12 sm:pb-10">
                    <div className="flex flex-col items-center text-center">
                      {/* Badge */}
                      <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-amber-500/10 border border-amber-500/20 mb-5">
                        <div className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
                        <span className="text-xs font-semibold tracking-wider uppercase text-amber-400">Offre de lancement</span>
                      </div>

                      {/* Icon + Headline inline */}
                      <div className="flex items-center gap-4 mb-4">
                        <div className="w-12 h-12 sm:w-14 sm:h-14 rounded-2xl bg-gradient-to-br from-amber-400 to-amber-600 flex items-center justify-center shadow-lg shadow-amber-500/25 flex-shrink-0">
                          <Lock className="w-6 h-6 sm:w-7 sm:h-7 text-white" />
                        </div>
                        <h3 className="text-2xl sm:text-3xl font-bold text-white text-left">
                          Tarif garanti{' '}
                          <span className="bg-gradient-to-r from-amber-300 via-yellow-300 to-amber-300 bg-clip-text text-transparent">
                            à vie
                          </span>
                        </h3>
                      </div>

                      <p className="text-base text-gray-400 max-w-lg mb-6">
                        Inscrivez-vous maintenant : votre tarif est bloqué à vie. Même si on augmente nos prix demain, vous restez à 19,90\u20AC.
                      </p>

                      {/* Trust points */}
                      <div className="flex flex-col sm:flex-row items-center gap-3 sm:gap-6 text-sm mb-2">
                        <div className="flex items-center gap-2 text-amber-300/90">
                          <Check className="w-4 h-4" />
                          <span>Prix bloqué à vie</span>
                        </div>
                        <div className="flex items-center gap-2 text-amber-300/90">
                          <Check className="w-4 h-4" />
                          <span>Aucune augmentation</span>
                        </div>
                        <div className="flex items-center gap-2 text-amber-300/90">
                          <Check className="w-4 h-4" />
                          <span>Premiers inscrits uniquement</span>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* ─ Separator ─ */}
                  <div className="mx-6 sm:mx-10 border-t border-gray-700/50" />

                  {/* ─ Middle section: toggle + cards ─ */}
                  <div className="relative px-6 py-8 sm:px-10 sm:py-10">
                    {/* Monthly / Yearly toggle */}
                    <div className="flex items-center justify-center gap-3 mb-8">
                      <span
                        className={`text-sm font-medium ${!isYearly ? 'text-white' : 'text-gray-500'}`}
                      >
                        Mensuel
                      </span>
                      <button
                        onClick={() => setIsYearly(!isYearly)}
                        className={`relative w-14 h-7 rounded-full transition-colors ${isYearly ? 'bg-primary-600' : 'bg-gray-600'}`}
                        aria-label="Basculer entre mensuel et annuel"
                      >
                        <span
                          className={`absolute top-0.5 left-0.5 w-6 h-6 rounded-full bg-white shadow transition-transform ${isYearly ? 'translate-x-7' : ''}`}
                        />
                      </button>
                      <span
                        className={`text-sm font-medium ${isYearly ? 'text-white' : 'text-gray-500'}`}
                      >
                        Annuel
                      </span>
                      {isYearly && (
                        <span className="ml-2 inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-green-500/15 text-green-400 border border-green-500/20">
                          Économisez 17%
                        </span>
                      )}
                    </div>

                    {/* Pricing cards */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-stretch pt-4">
                      {/* Pro card */}
                      <div className="flex flex-col bg-white dark:bg-gray-800 rounded-2xl p-7 transition-all duration-300 hover:-translate-y-1 hover:shadow-xl hover:shadow-black/20">
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
                              Facturé {proYearlyTotal}&euro;/an
                            </p>
                          )}
                          <p className="text-sm font-semibold text-emerald-600 dark:text-emerald-400 mt-2">
                            Sans engagement
                          </p>
                        </div>

                        <div className="border-t border-gray-100 dark:border-gray-700 mb-6" />

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
                          Creer ma page
                        </Link>
                      </div>

                      {/* Studio card (popular) */}
                      <div className="relative flex flex-col bg-white dark:bg-gray-800 rounded-2xl p-7 border-2 border-primary-500 shadow-xl shadow-primary-500/10 transition-all duration-300 hover:-translate-y-1 hover:shadow-2xl hover:shadow-primary-500/15">
                        {/* Popular badge */}
                        <span className="absolute -top-3.5 left-1/2 -translate-x-1/2 inline-flex items-center gap-1.5 px-4 py-1.5 rounded-full text-xs font-bold bg-gradient-to-r from-primary-600 to-primary-500 text-white shadow-lg shadow-primary-500/25">
                          <Star className="w-3.5 h-3.5" />
                          Populaire
                        </span>

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
                                Facturé {studioYearlyTotal}&euro;/an
                              </p>
                            )}
                            <p className="text-xs text-primary-700 dark:text-primary-300 font-semibold mt-1.5">
                              Jusqu&apos;à 10 membres inclus
                            </p>
                            <p className="text-sm font-semibold text-emerald-600 dark:text-emerald-400 mt-2">
                              Sans engagement
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
                            Creer ma page
                          </Link>
                        </div>
                      </div>
                    </div>

                    {/* Bottom note */}
                    <p className="mt-8 text-sm text-gray-500 text-center">
                      {APP_CONFIG.trialDays} jours d&apos;essai gratuit sur tous les plans. Aucune carte bancaire requise.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* TutorialsSection moved up — see right after the Hero. */}

        {/* ── Section 11 - FAQ ───────────────────────────────────────── */}
        <section id="faq" className="py-16 sm:py-24 bg-white dark:bg-gray-900">
          <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="text-center mb-12">
              <h2 className="text-2xl sm:text-3xl lg:text-4xl font-bold text-gray-900 dark:text-white">
                Questions fréquentes
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

        {/* ── Section 12 - Final CTA ─────────────────────────────────── */}
        <section className="py-16 sm:py-24 bg-primary-600">
          <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
            <h2 className="text-2xl sm:text-3xl lg:text-4xl font-bold text-white">Reprenez votre soirée.</h2>
            <p className="mt-4 text-lg text-white/80">
              Votre première page de réservation est en ligne en 5 minutes. 30 jours d'essai gratuit, sans carte bancaire, sans engagement.
            </p>

            <div className="mt-10">
              <Link
                href="/register"
                className="inline-flex items-center justify-center bg-white text-primary-700 hover:bg-gray-50 px-8 py-4 text-lg font-semibold shadow-lg rounded-lg transition-colors"
              >
                Creer ma page
              </Link>
            </div>
            <p className="mt-4 text-sm text-white/80">
              {APP_CONFIG.trialDays} jours gratuits — Sans carte bancaire — Sans engagement
            </p>

            <div className="mt-8 flex flex-row flex-wrap gap-3 justify-center">
              <a
                href="https://apps.apple.com/us/app/opatam-agenda-rendez-vous/id6759246218"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2.5 px-5 py-3 bg-white/10 backdrop-blur text-white border border-white/20 rounded-xl hover:bg-white/20 transition-colors"
              >
                <svg className="w-6 h-6" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.81-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M13 3.5c.73-.83 1.94-1.46 2.94-1.5.13 1.17-.34 2.35-1.04 3.19-.69.85-1.83 1.51-2.95 1.42-.15-1.15.41-2.35 1.05-3.11z" />
                </svg>
                <div className="text-left">
                  <div className="text-[10px] leading-tight opacity-80">Disponible sur l&apos;</div>
                  <div className="text-sm font-semibold leading-tight">App Store</div>
                </div>
              </a>
              <button
                onClick={() => setShowPlayStoreModal(true)}
                className="inline-flex items-center gap-2.5 px-5 py-3 bg-white/5 backdrop-blur text-white border border-white/15 rounded-xl hover:bg-white/15 transition-colors relative"
              >
                <svg className="w-6 h-6" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M3,20.5V3.5C3,2.91 3.34,2.39 3.84,2.15L13.69,12L3.84,21.85C3.34,21.6 3,21.09 3,20.5M16.81,15.12L6.05,21.34L14.54,12.85L16.81,15.12M20.16,10.81C20.5,11.08 20.75,11.5 20.75,12C20.75,12.5 20.53,12.9 20.18,13.18L17.89,14.5L15.39,12L17.89,9.5L20.16,10.81M6.05,2.66L16.81,8.88L14.54,11.15L6.05,2.66Z" />
                </svg>
                <div className="text-left">
                  <div className="text-[10px] leading-tight opacity-70">Bientôt sur</div>
                  <div className="text-sm font-semibold leading-tight">Google Play</div>
                </div>
                <span className="absolute -top-2 -right-2 px-2 py-0.5 bg-primary-500 text-white text-[10px] font-bold rounded-full shadow">
                  Bientôt
                </span>
              </button>
            </div>

            {/* Social links */}
            <div className="mt-8">
              <p className="text-sm text-white/50 mb-3">Suivez-nous</p>
              <SocialLinks variant="light" className="justify-center" />
            </div>
          </div>
        </section>

        {/* ── Section 13 - Marketplace redirect ──────────────────────── */}
        <section className="py-8 bg-gray-50 dark:bg-gray-800">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
            <p className="text-sm text-gray-600 dark:text-gray-400">
              Vous cherchez un professionnel près de chez vous ?{' '}
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

      {/* ── Section 14 - Footer ────────────────────────────────────── */}
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

      {/* Play Store Waitlist Modal */}
      <PlayStoreWaitlistModal
        isOpen={showPlayStoreModal}
        onClose={() => setShowPlayStoreModal(false)}
      />
    </div>
  );
}
