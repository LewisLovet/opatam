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
  Mail,
  MapPin,
  QrCode,
  Quote,
  Shield,
  Smartphone,
  Sparkles,
  Star,
  UserPlus,
  Users,
  Wrench,
  Zap,
} from 'lucide-react';
import Image from 'next/image';
import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';

// ─── Helpers ────────────────────────────────────────────────────────
function formatPrice(cents: number): string {
  return (cents / 100).toFixed(2).replace('.', ',');
}

// ─── FAQ Data ───────────────────────────────────────────────────────
const faqItems = [
  {
    question: 'Quel est le meilleur logiciel de prise de rendez-vous en ligne pour indépendants ?',
    answer:
      'OPATAM est conçu spécialement pour les indépendants et petites équipes : agenda en ligne, page de réservation personnalisée, rappels automatiques, application mobile — le tout sans commission et prêt en 5 minutes. Plus de 15 secteurs d\'activité sont pris en charge (beauté, bien-être, coaching, artisans, et bien d\'autres).',
  },
  {
    question: 'Existe-t-il une alternative à Planity ou Doctolib sans commission ?',
    answer:
      'Oui. Contrairement aux plateformes qui prélèvent un pourcentage sur chaque réservation, OPATAM fonctionne avec un abonnement fixe à partir de 17,90\u20AC/mois — 0% de commission, quel que soit votre volume de rendez-vous. Vous gardez 100% de vos revenus.',
  },
  {
    question: 'Comment permettre à mes clients de réserver en ligne sans créer de compte ?',
    answer:
      'Avec OPATAM, vos clients réservent en renseignant simplement leur nom, email et téléphone — en 3 clics. Aucun compte à créer, aucun mot de passe. Vous recevez un lien personnalisé et un QR code à partager sur vos réseaux, par SMS ou à afficher en boutique.',
  },
  {
    question: 'Comment gérer les rendez-vous de mon équipe depuis un seul outil ?',
    answer:
      'Le plan Studio (29,90\u20AC/mois) permet de gérer jusqu\'à 5 agendas synchronisés. Chaque membre a son propre planning et ses prestations. Vous pouvez leur envoyer le récap quotidien de leur journée, les notifier individuellement de chaque rendez-vous, et garder la vue d\'ensemble sur toute l\'équipe.',
  },
  {
    question: 'Comment réduire les rendez-vous manqués et les oublis de mes clients ?',
    answer:
      'OPATAM envoie automatiquement un rappel par email et notification push 24h avant le rendez-vous, puis un second rappel 2h avant. Vos clients reçoivent aussi une confirmation instantanée à la réservation. Résultat : moins d\'oublis, moins de créneaux perdus.',
  },
  {
    question: 'Combien coûte un logiciel de réservation en ligne professionnel ?',
    answer:
      'OPATAM propose deux formules sans engagement : le plan Pro à 17,90\u20AC/mois (ou 179\u20AC/an) pour les indépendants, et le plan Studio à 29,90\u20AC/mois (ou 239\u20AC/an) pour les équipes jusqu\'à 5 personnes. Essai gratuit de 30 jours, sans carte bancaire.',
  },
  {
    question: 'Peut-on utiliser un agenda de réservation en ligne sur téléphone ?',
    answer:
      'Oui. OPATAM propose une application mobile qui vous permet de consulter votre agenda, recevoir les alertes de nouveaux rendez-vous en temps réel et gérer votre planning où que vous soyez. La configuration initiale se fait sur ordinateur ou tablette, et le quotidien se gère depuis votre poche.',
  },
  {
    question: 'Est-ce qu\'OPATAM est adapté aux métiers de la beauté, du bien-être et du coaching ?',
    answer:
      'Absolument. OPATAM est multi-secteurs : coiffeurs, esthéticiennes, masseurs, coachs sportifs, thérapeutes, photographes, formateurs, artisans… Chaque professionnel personnalise ses prestations, ses durées et ses tarifs selon son activité.',
  },
];

// ─── Comparison Data ────────────────────────────────────────────────
const comparisonRows = [
  { label: 'Tarif mensuel', opatam: '17,90\u20AC', others: 'De 0\u20AC* à 90\u20AC/mois' },
  { label: 'Commissions sur vos réservations', opatam: '0%', others: "Jusqu'à 20% ou 1\u20AC par RDV" },
  { label: "Période d'essai", opatam: '30 jours gratuits', others: 'Souvent limitée ou absente' },
  { label: 'Rappels automatiques', opatam: 'Inclus', others: 'Parfois en option payante' },
  { label: 'Vitrine en ligne personnalisée', opatam: 'Inclus', others: 'Incluse mais modèles limités' },
  { label: 'Engagement', opatam: 'Sans engagement', others: "Variable selon l'offre" },
  { label: 'Coût réel annuel (exemple)', opatam: '179,00\u20AC', others: 'De 300\u20AC à 1 080\u20AC**' },
];

// ─── Testimonials Data ──────────────────────────────────────────────
const testimonials = [
  {
    name: 'Marie L.',
    role: 'Coiffeuse indépendante',
    city: 'Lyon',
    initials: 'ML',
    text: "0% de commission, c'est ce qui m'a convaincue. Je garde 100% de ce que je gagne, et l'outil est hyper simple à utiliser.",
  },
  {
    name: 'Karim B.',
    role: 'Barbier',
    city: 'Paris',
    initials: 'KB',
    text: "J'ai configuré mon profil en 10 minutes. Le soir même, j'avais déjà 3 réservations. L'interface est claire, mes clients adorent pouvoir réserver en ligne à n'importe quelle heure.",
  },
  {
    name: 'Sophie D.',
    role: "Gérante d'institut de beauté",
    city: 'Marseille',
    initials: 'SD',
    text: "On est 3 dans mon institut et OPATAM Studio nous permet de gérer les agendas de toute l'équipe. Le rapport qualité-prix est imbattable par rapport à ce qu'on payait avant.",
  },
];

// ─── Features Data ──────────────────────────────────────────────────
// To use a real screenshot, place the image in /public/images/features/ and set the image path below.
// If image is null, the CSS mockup fallback is displayed instead.
const mainFeatures = [
  {
    title: 'Un agenda qui travaille pour vous',
    description:
      "Visualisez votre semaine en un coup d'œil. Vos créneaux se remplissent automatiquement, les rappels partent tout seuls, et vous gardez le contrôle depuis votre téléphone ou votre ordinateur.",
    icon: Calendar,
    mockup: 'agenda' as const,
    image: null as string | null, // e.g. '/images/features/agenda.png'
  },
  {
    title: 'Vos clients réservent même quand vous dormez',
    description:
      'Votre page de réservation personnalisée est accessible 24h/24. Vos clients choisissent la prestation, le créneau et réservent en 3 clics — sans créer de compte.',
    icon: Globe,
    mockup: 'booking' as const,
    image: null as string | null, // e.g. '/images/features/booking-mobile.png'
  },
  {
    title: 'Configurez sur votre ordinateur, gérez depuis votre poche',
    description:
      "Créez vos services, configurez vos horaires et gérez vos membres depuis votre ordinateur ou tablette. Au quotidien, suivez vos rendez-vous et recevez vos alertes en temps réel directement sur l'application mobile — où que vous soyez.",
    icon: Smartphone,
    mockup: 'mobile' as const,
    image: null as string | null, // e.g. '/images/features/mobile-app.png'
  },
  {
    title: "Toute votre équipe, un seul outil",
    description:
      "Chaque membre a son propre agenda, ses prestations et son code d'accès au planning. Envoyez-leur le récap de leur journée, notifiez-les de chaque nouveau rendez-vous individuellement, et gardez la vue d'ensemble sur toute l'équipe.",
    icon: Users,
    mockup: 'team' as const,
    image: null as string | null, // e.g. '/images/features/team.png'
  },
];

const secondaryFeatures = [
  { icon: Globe, title: 'Vitrine en ligne', description: 'Votre page pro avec services, avis, photos et infos pratiques' },
  { icon: QrCode, title: 'QR Code personnalisé', description: 'Affichez-le en boutique ou sur vos cartes — vos clients scannent et réservent' },
  { icon: Bell, title: 'Rappels automatiques', description: 'Vos clients reçoivent un rappel 24h et 2h avant leur rendez-vous' },
  { icon: BarChart3, title: 'Tableau de bord', description: 'Suivez vos réservations, vos vues et votre activité en temps réel' },
  { icon: MapPin, title: 'Multi-lieux', description: "Gérez jusqu'à 5 adresses avec des disponibilités par lieu" },
  { icon: Mail, title: 'Récap quotidien', description: "Recevez chaque soir l'agenda du lendemain, pour vous et votre équipe" },
  { icon: Smartphone, title: 'App mobile', description: 'Gérez vos rendez-vous depuis votre téléphone, où que vous soyez' },
  { icon: Shield, title: 'Données sécurisées', description: 'Hébergement en Europe, conforme RGPD, vos données vous appartiennent' },
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
                  Gérez vos rendez-vous en ligne, sans commission
                </h1>
                <p className="animate-fade-in-up animation-delay-150 mt-6 text-lg sm:text-xl text-gray-600 dark:text-gray-400">
                  {APP_CONFIG.name} est la plateforme de réservation en ligne pour les professionnels de services. Vos
                  clients réservent 24h/24, vous recevez des rappels automatiques et vous ne payez aucune commission.
                  Prêt en 5 minutes.
                </p>

                {/* Trust bar */}
                <div className="animate-fade-in-up animation-delay-300 mt-8 flex flex-wrap items-center justify-center lg:justify-start gap-x-6 gap-y-3 text-sm font-medium text-gray-600 dark:text-gray-400">
                  <span className="flex items-center gap-2">
                    <CalendarCheck className="w-5 h-5 text-primary-600 dark:text-primary-400" />
                    Prêt en 5 min
                  </span>
                  <span className="flex items-center gap-2">
                    <BadgePercent className="w-5 h-5 text-primary-600 dark:text-primary-400" />
                    0% de commission
                  </span>
                  <span className="flex items-center gap-2">
                    <CreditCard className="w-5 h-5 text-primary-600 dark:text-primary-400" />
                    Dès {proMonthly}&euro;/mois
                  </span>
                </div>

                {/* CTAs */}
                <div className="animate-fade-in-up animation-delay-500 mt-10 flex flex-col sm:flex-row items-center gap-4 justify-center lg:justify-start">
                  <Link
                    href="/register"
                    className="inline-flex items-center justify-center bg-primary-600 text-white hover:bg-primary-700 hover:shadow-lg hover:shadow-primary-600/25 px-8 py-4 text-lg font-semibold rounded-lg transition-all duration-200 w-full sm:w-auto"
                  >
                    Démarrer mon essai gratuit
                  </Link>
                  <Link
                    href="/p/demo"
                    className="inline-flex items-center justify-center border border-primary-300 dark:border-primary-700 text-primary-600 dark:text-primary-400 hover:bg-primary-50 dark:hover:bg-primary-900/20 px-8 py-4 text-lg font-semibold rounded-lg transition-all duration-200 w-full sm:w-auto"
                  >
                    Voir une démo
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

        {/* ── Section 4 - Main Features (Alternating) ──────────────── */}
        <section id="fonctionnalites" className="py-16 sm:py-24 bg-white dark:bg-gray-900">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="text-center max-w-3xl mx-auto mb-16">
              <h2 className="text-2xl sm:text-3xl lg:text-4xl font-bold text-gray-900 dark:text-white">
                Tout ce dont vous avez besoin pour gérer vos rendez-vous
              </h2>
              <p className="mt-4 text-lg text-gray-600 dark:text-gray-400">
                Fini les appels manqués, les agendas papier. {APP_CONFIG.name} automatise la gestion de
                vos réservations pour que vous puissiez vous concentrer sur votre métier.
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
                Et bien plus encore
              </h2>
              <p className="mt-4 text-lg text-gray-600 dark:text-gray-400">
                Toutes les fonctionnalités essentielles, incluses dès le départ.
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
                Quelle que soit votre activité, {APP_CONFIG.name} s&apos;adapte à votre métier
              </h2>
              <p className="mt-4 text-lg text-gray-600 dark:text-gray-400">
                Plus de 15 secteurs d&apos;activité couverts — de la beauté au coaching, des artisans à l&apos;audiovisuel.
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

        {/* ── Section 7 - How it works ─────────────────────────────── */}
        <section className="py-16 sm:py-24 bg-gray-50 dark:bg-gray-800">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="text-center max-w-3xl mx-auto mb-16">
              <h2 className="text-2xl sm:text-3xl lg:text-4xl font-bold text-gray-900 dark:text-white">
                Prêt en 5 minutes, en 3 étapes
              </h2>
              <p className="mt-4 text-lg text-gray-600 dark:text-gray-400">
                Pas de formation, pas de technicien à appeler. Vous créez votre page et recevez vos premières
                réservations aujourd&apos;hui.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-8 lg:gap-12">
              {[
                {
                  icon: UserPlus,
                  title: 'Créez votre profil',
                  description:
                    'Renseignez votre activité, vos prestations et vos horaires. Notre assistant vous guide pas à pas.',
                },
                {
                  icon: Globe,
                  title: 'Publiez votre vitrine',
                  description:
                    'Votre page professionnelle est en ligne en un clic. Partagez le lien à vos clients par SMS, email ou réseaux sociaux.',
                },
                {
                  icon: CalendarCheck,
                  title: 'Recevez des réservations',
                  description:
                    'Vos clients réservent en autonomie, 24h/24. Vous recevez une notification à chaque nouveau rendez-vous.',
                },
              ].map((step, index) => {
                const Icon = step.icon;
                return (
                  <div key={step.title} className="relative text-center">
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

            <div className="mt-12 text-center">
              <Link
                href="/register"
                className="inline-flex items-center justify-center bg-primary-600 text-white hover:bg-primary-700 px-8 py-4 text-lg font-semibold rounded-lg transition-colors"
              >
                Créer mon profil gratuitement
              </Link>
              <p className="mt-4 text-sm text-gray-500 dark:text-gray-500">
                Essai gratuit {APP_CONFIG.trialDays} jours — Aucune carte bancaire requise
              </p>
            </div>
          </div>
        </section>

        {/* ── Section 8 - Testimonials ───────────────────────────────── */}
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

        {/* ── Section 9 - Comparison ─────────────────────────────────── */}
        <section className="py-16 sm:py-24 bg-white dark:bg-gray-900">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="text-center max-w-3xl mx-auto mb-12">
              <h2 className="text-2xl sm:text-3xl lg:text-4xl font-bold text-gray-900 dark:text-white">
                {APP_CONFIG.name}, la solution pensée pour votre rentabilité
              </h2>
              <p className="mt-4 text-lg text-gray-600 dark:text-gray-400">
                Comparez ce qui compte vraiment : un tarif transparent, sans commission cachée, et toutes les
                fonctionnalités essentielles incluses dès le départ.
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
                Deux plans simples. Pas de commission cachée. Pas de frais supplémentaires. Annulez quand vous voulez.
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
                  Économisez 33%
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
                      Facturé {proYearlyTotal}&euro;/an
                    </p>
                  )}
                  <p className="text-sm font-semibold text-emerald-600 dark:text-emerald-400 mt-2">
                    Sans engagement
                  </p>
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
                  Démarrer l&apos;essai gratuit
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
                        Facturé {studioYearlyTotal}&euro;/an
                      </p>
                    )}
                    <p className="text-xs text-primary-700 dark:text-primary-300 font-semibold mt-1.5">
                      Jusqu&apos;à 5 membres inclus
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
                    Démarrer l&apos;essai gratuit
                  </Link>
                </div>
              </div>
            </div>

            <p className="mt-8 text-sm text-gray-500 dark:text-gray-500 text-center">
              {APP_CONFIG.trialDays} jours d&apos;essai gratuit sur tous les plans. Aucune carte bancaire requise.
            </p>
          </div>
        </section>

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
            <h2 className="text-2xl sm:text-3xl lg:text-4xl font-bold text-white">Prêt à remplir votre agenda ?</h2>
            <p className="mt-4 text-lg text-white/80">
              Rejoignez les professionnels qui ont choisi la simplicité et la transparence. Votre première réservation
              est à 5 minutes.
            </p>

            <div className="mt-10">
              <Link
                href="/register"
                className="inline-flex items-center justify-center bg-white text-primary-700 hover:bg-gray-50 px-8 py-4 text-lg font-semibold shadow-lg rounded-lg transition-colors"
              >
                Démarrer mon essai gratuit
              </Link>
            </div>
            <p className="mt-4 text-sm text-white/80">
              {APP_CONFIG.trialDays} jours gratuits — Sans carte bancaire — Sans engagement
            </p>
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
    </div>
  );
}
