import type { Metadata } from 'next';
import Link from 'next/link';
import {
  ArrowRight,
  Calendar,
  CalendarCheck,
  Camera,
  Check,
  Instagram,
  Lock,
  MapPin,
  MessageSquare,
  Sparkles,
  X,
  Zap,
} from 'lucide-react';
import { Header } from '@/components/layout/Header';
import { Footer } from '@/components/layout/Footer';
import { HeroVideo } from '@/components/home/HeroVideo';

// ---------------------------------------------------------------------------
// /nail-artist — vertical landing for nail artists / prothésistes ongulaires
// ---------------------------------------------------------------------------
//
// SEO strategy: target the keyword `application rendez-vous nail art` as
// the primary, with the H1 + title + meta description anchored on it.
// Secondaries (`agenda nail artist`, `logiciel onglerie`, `prothésiste
// ongulaire`) are woven into the body so the page covers both the modern-
// indé persona and the formal-salon persona without duplicating content.
//
// This is the first page of an upcoming vertical-landing system (one per
// trade). Each vertical gets its OWN page with structurally different
// content — no shared template — to avoid Google's "doorway pages"
// penalty. We extract reusable bits (Hero pattern, FAQ format) only after
// 3-4 verticals land and patterns emerge.
//
// Video assets are passed in via HeroVideo props. Drop the nail-specific
// files at /public/nail-hero.mp4 (16:9) and /public/nail-hero-mobile.mp4
// (9:16) — until those exist, the component falls back to broken video,
// so the launch checklist is: upload assets ➜ deploy.
// ---------------------------------------------------------------------------

export const metadata: Metadata = {
  title: 'Application de rendez-vous nail art — Opatam',
  description:
    "Le logiciel de réservation pensé pour les nail artists et prothésistes ongulaires. Acomptes anti-no-show, lien Instagram, agenda mobile, 0 % commission. Essai gratuit 30 jours.",
  alternates: { canonical: 'https://opatam.com/nail-artist' },
  openGraph: {
    title: "Application de rendez-vous nail art — Opatam",
    description:
      "Centralisez vos réservations, encaissez vos acomptes et finissez-en avec les DM Instagram à 22h. Le logiciel pensé pour les nail artists indépendantes.",
    url: 'https://opatam.com/nail-artist',
    type: 'website',
    images: [
      {
        url: 'https://opatam.com/logo-opatam.png',
        width: 1200,
        height: 630,
        alt: 'Opatam — application de rendez-vous nail art',
      },
    ],
  },
};

// Pain points specific to nail artists — derived from real user
// research on /p/* nail artists in the existing user base.
const painPoints = [
  {
    icon: Instagram,
    title: 'Vous gérez vos RDV en DM Instagram',
    body:
      "Vingt messages à 22h, des créneaux qui se chevauchent, des clientes qu'on perd parce qu'on a tardé à répondre. Vos DM sont devenus un deuxième planning — sauf qu'il n'est pas fiable.",
  },
  {
    icon: X,
    title: 'Trois no-shows par mois, c\'est 200 € envolés',
    body:
      "Une pose complète, c'est 1h30 à 3h. Une cliente qui ne vient pas, c'est tout un créneau perdu — plus le matériel préparé. Sans acompte, vous payez les annulations à sa place.",
  },
  {
    icon: MapPin,
    title: 'À domicile, en salon, chez les clientes',
    body:
      "Vous travaillez sur plusieurs lieux. Vos horaires changent selon les jours. Un agenda papier ou Google Calendar ne tient pas la charge — vous oubliez des RDV, vous doublez d'autres.",
  },
];

// Concrete features, each tied to a pain point above. Order is
// deliberate: we lead with the Instagram link (highest emotional
// resonance for the persona) and end with the multi-location.
const features = [
  {
    icon: Instagram,
    title: 'Un lien de réservation Instagram',
    body:
      "Mettez votre lien Opatam dans votre bio Instagram. Vos clientes réservent en 30 secondes depuis leur téléphone, sans créer de compte, sans passer par les DM. Vous récupérez leurs coordonnées propres dans votre fiche client.",
  },
  {
    icon: Lock,
    title: 'Acomptes intégrés contre les no-shows',
    body:
      "Avec l'option Sérénité, vous demandez un acompte au moment de la réservation. La cliente paie en CB depuis votre lien de réservation. Si elle ne vient pas, vous gardez l'acompte. Magie : les no-shows chutent de 60 à 80 % en moyenne.",
  },
  {
    icon: CalendarCheck,
    title: 'Rappels automatiques 24h et 2h avant',
    body:
      "Vos clientes reçoivent une confirmation immédiate par email, puis un rappel 24h avant et un dernier 2h avant. Plus besoin de relancer manuellement. Vous économisez 30 minutes par jour de SMS de rappel.",
  },
  {
    icon: MapPin,
    title: 'Multi-lieux, agenda mobile, mode itinérant',
    body:
      "Renseignez vos différents lieux d'exercice (salon, à domicile, déplacement chez la cliente). Vos créneaux s'adaptent automatiquement. L'application iOS et Android vous permet de tout gérer depuis votre poche, entre deux RDV.",
  },
  {
    icon: Camera,
    title: 'Portfolio Instagram intégré dans votre fiche',
    body:
      "Votre page publique Opatam affiche votre portfolio (poses, nail art, demi-bras, etc.) avec vos prestations et tarifs. Vos clientes voient vos créations, choisissent leur prestation et réservent — dans la même fenêtre.",
  },
];

// Trade-specific FAQ. Each item answers an objection we've heard from
// nail artists on signup calls — keep it specific, no generic SaaS
// answers.
const faqItems = [
  {
    q: 'Est-ce que mes clientes peuvent réserver depuis leur téléphone sans créer de compte ?',
    a: "Oui — c'est l'un des choix forts d'Opatam. Vos clientes cliquent sur votre lien (Instagram, SMS, QR code en boutique), choisissent leur prestation et leur créneau, renseignent juste leur prénom, email et numéro. Aucun mot de passe, aucun compte. Tout se passe sur leur téléphone, en moins d'une minute.",
  },
  {
    q: 'Comment je récupère mes clientes qui réservaient en DM Instagram avant ?',
    a: "On a prévu plusieurs canaux : le lien Opatam dans votre bio Instagram, un QR code à afficher en boutique, et la possibilité de partager votre lien personnalisé en réponse automatique aux DM avec un message du type « Tu peux réserver directement ici ». Vos clientes habituées prennent le pli en deux semaines.",
  },
  {
    q: 'Combien je dois fixer comme acompte ?',
    a: "Vous choisissez librement. Sur Opatam, la plupart des nail artists demandent entre 10 € et 30 % du prix de la prestation. L'acompte est encaissé par CB au moment de la réservation, déduit du total à payer en cabine, et conservé si la cliente ne vient pas. C'est légal, transparent (vos clientes voient le montant avant de confirmer), et ça réduit drastiquement les no-shows.",
  },
  {
    q: "Ça marche pour une nail artist à domicile ou itinérante ?",
    a: "Très bien. Vous pouvez configurer plusieurs lieux (votre salon, votre domicile, le domicile des clientes pour un déplacement), et chaque prestation peut être proposée sur un ou plusieurs lieux. Les clientes voient les options disponibles. Vous gérez tout depuis l'app mobile entre deux poses.",
  },
  {
    q: 'Vous prenez combien de commission sur mes réservations ?',
    a: "Zéro. Opatam est un abonnement mensuel ou annuel fixe (19,90 €/mois en formule Pro, ou 199 €/an), sans aucun pourcentage prélevé sur vos prestations. Contrairement à Treatwell ou aux marketplaces, ce que la cliente paie va directement chez vous. Les acomptes sont encaissés via Stripe — vous touchez l'intégralité du montant moins les frais bancaires Stripe (~1,4 % + 0,25 €).",
  },
  {
    q: "Combien de temps pour configurer mon agenda nail art ?",
    a: "Cinq à dix minutes pour publier votre page de réservation. Vous créez vos prestations (pose complète, remplissage, nail art, etc.) avec leurs durées et tarifs, vous définissez vos horaires d'ouverture, vous activez le lien — c'est en ligne. Vous pouvez ensuite affiner (acomptes, multi-lieux, équipe) à votre rythme.",
  },
];

export default function NailArtistPage() {
  // FAQ schema for rich snippets in Google search results. Keep in
  // sync with the `faqItems` array above — Google penalises mismatch
  // between visible content and structured data.
  const faqSchema = {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: faqItems.map((item) => ({
      '@type': 'Question',
      name: item.q,
      acceptedAnswer: { '@type': 'Answer', text: item.a },
    })),
  };

  const softwareSchema = {
    '@context': 'https://schema.org',
    '@type': 'SoftwareApplication',
    name: 'Opatam — application de rendez-vous nail art',
    applicationCategory: 'BusinessApplication',
    operatingSystem: 'Web, iOS, Android',
    audience: {
      '@type': 'Audience',
      audienceType: 'Nail artists et prothésistes ongulaires',
    },
    offers: {
      '@type': 'Offer',
      price: '19.90',
      priceCurrency: 'EUR',
    },
    aggregateRating: {
      '@type': 'AggregateRating',
      ratingValue: '4.8',
      reviewCount: '12',
    },
  };

  return (
    <>
      <Header />
      <main className="bg-white">
        {/* ── HERO ─────────────────────────────────────────────────── */}
        <section className="relative overflow-hidden bg-gradient-to-br from-purple-50 via-pink-50 to-white">
          <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8 py-16 sm:py-20 lg:py-24">
            <div className="grid lg:grid-cols-2 gap-12 lg:gap-16 items-center">
              <div>
                <div className="inline-flex items-center gap-2 rounded-full bg-purple-100 px-3 py-1 text-xs font-medium text-purple-700 mb-6">
                  <Sparkles className="w-3.5 h-3.5" />
                  Pour les nail artists et prothésistes ongulaires
                </div>
                <h1 className="text-3xl sm:text-4xl lg:text-5xl font-bold text-gray-900 leading-tight">
                  L&apos;application de rendez-vous nail art conçue pour les indépendantes
                </h1>
                <p className="mt-5 text-lg sm:text-xl text-gray-600 leading-relaxed">
                  Centralisez vos réservations, encaissez vos acomptes et finissez-en avec les
                  DM Instagram à 22h. Opatam remplace votre agenda papier, vos relances no-show
                  et votre lien Calendly bricolé — en une seule app, sans commission.
                </p>
                <div className="mt-8 flex flex-col sm:flex-row gap-3">
                  <Link
                    href="/inscription/pro"
                    className="inline-flex items-center justify-center gap-2 rounded-xl bg-primary-600 hover:bg-primary-700 px-6 py-3.5 text-white text-base font-semibold shadow-lg hover:shadow-xl transition-all"
                  >
                    Créer mon agenda nail art gratuitement
                    <ArrowRight className="w-4 h-4" />
                  </Link>
                  <Link
                    href="/p/demo"
                    className="inline-flex items-center justify-center gap-2 rounded-xl border border-gray-300 bg-white hover:bg-gray-50 px-6 py-3.5 text-gray-800 text-base font-medium transition-colors"
                  >
                    Voir une démo
                  </Link>
                </div>
                <p className="mt-5 text-sm text-gray-500">
                  Essai gratuit 30 jours · Sans carte bancaire · 0 % commission
                </p>
              </div>

              <div className="relative">
                <HeroVideo
                  variant="panel"
                  desktopSrc="/nail-hero.mp4"
                  mobileSrc="/nail-hero-mobile.mp4"
                  loaderTagline="L'agenda nail art, pensé pour vous"
                />
              </div>
            </div>
          </div>
        </section>

        {/* ── PAIN POINTS ──────────────────────────────────────────── */}
        <section className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8 py-16 sm:py-20">
          <div className="text-center max-w-2xl mx-auto">
            <h2 className="text-2xl sm:text-3xl lg:text-4xl font-bold text-gray-900">
              Vos vraies douleurs au quotidien
            </h2>
            <p className="mt-4 text-base sm:text-lg text-gray-600">
              On a écouté des dizaines de nail artists, à domicile, en salon ou itinérantes.
              Voici ce qui leur fait perdre du temps et de l&apos;argent — et ce qu&apos;Opatam change.
            </p>
          </div>
          <div className="mt-12 grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {painPoints.map((p) => (
              <div
                key={p.title}
                className="rounded-2xl border border-gray-200 bg-white p-6 hover:border-purple-200 hover:shadow-md transition-all"
              >
                <div className="inline-flex items-center justify-center w-11 h-11 rounded-xl bg-red-50 text-red-600 mb-4">
                  <p.icon className="w-5 h-5" />
                </div>
                <h3 className="text-lg font-semibold text-gray-900">{p.title}</h3>
                <p className="mt-2 text-sm text-gray-600 leading-relaxed">{p.body}</p>
              </div>
            ))}
          </div>
        </section>

        {/* ── FEATURES ─────────────────────────────────────────────── */}
        <section className="bg-gradient-to-b from-purple-50/40 to-white py-16 sm:py-20">
          <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
            <div className="text-center max-w-2xl mx-auto">
              <h2 className="text-2xl sm:text-3xl lg:text-4xl font-bold text-gray-900">
                Comment Opatam vous aide concrètement
              </h2>
              <p className="mt-4 text-base sm:text-lg text-gray-600">
                Une application de rendez-vous nail art pensée pour votre métier — pas un outil
                générique qu&apos;on a vaguement adapté.
              </p>
            </div>
            <div className="mt-12 grid md:grid-cols-2 gap-6">
              {features.map((f) => (
                <div
                  key={f.title}
                  className="rounded-2xl bg-white border border-gray-200 p-6 sm:p-7 hover:border-purple-300 hover:shadow-lg transition-all"
                >
                  <div className="inline-flex items-center justify-center w-12 h-12 rounded-xl bg-gradient-to-br from-purple-100 to-pink-100 text-purple-700 mb-4">
                    <f.icon className="w-5 h-5" />
                  </div>
                  <h3 className="text-lg sm:text-xl font-semibold text-gray-900">{f.title}</h3>
                  <p className="mt-2 text-sm sm:text-base text-gray-600 leading-relaxed">{f.body}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ── COMPARATIF ───────────────────────────────────────────── */}
        <section className="mx-auto max-w-5xl px-4 sm:px-6 lg:px-8 py-16 sm:py-20">
          <div className="text-center max-w-2xl mx-auto">
            <h2 className="text-2xl sm:text-3xl lg:text-4xl font-bold text-gray-900">
              Opatam vs Planity vs Treatwell pour les nail artists
            </h2>
            <p className="mt-4 text-base sm:text-lg text-gray-600">
              Vous hésitez entre les options du marché ? Voici ce qui change vraiment pour
              vous.
            </p>
          </div>
          <div className="mt-10 overflow-x-auto">
            <table className="w-full text-sm border-collapse">
              <thead>
                <tr className="border-b-2 border-gray-200">
                  <th className="text-left py-3 px-2 font-semibold text-gray-500"></th>
                  <th className="text-left py-3 px-3 font-semibold text-purple-700">
                    Opatam
                  </th>
                  <th className="text-left py-3 px-3 font-semibold text-gray-700">
                    Planity
                  </th>
                  <th className="text-left py-3 px-3 font-semibold text-gray-700">
                    Treatwell
                  </th>
                </tr>
              </thead>
              <tbody className="text-gray-700">
                <tr className="border-b border-gray-100">
                  <td className="py-3 px-2 font-medium">Commission</td>
                  <td className="py-3 px-3 text-purple-700 font-semibold">0 %</td>
                  <td className="py-3 px-3">0 %</td>
                  <td className="py-3 px-3 text-red-600">15 à 25 %</td>
                </tr>
                <tr className="border-b border-gray-100">
                  <td className="py-3 px-2 font-medium">Acomptes intégrés</td>
                  <td className="py-3 px-3 text-purple-700 font-semibold">Oui (Sérénité)</td>
                  <td className="py-3 px-3">Limité</td>
                  <td className="py-3 px-3">Oui</td>
                </tr>
                <tr className="border-b border-gray-100">
                  <td className="py-3 px-2 font-medium">Mise en place</td>
                  <td className="py-3 px-3 text-purple-700 font-semibold">5 min, en autonomie</td>
                  <td className="py-3 px-3">Onboarding accompagné</td>
                  <td className="py-3 px-3">Onboarding long</td>
                </tr>
                <tr className="border-b border-gray-100">
                  <td className="py-3 px-2 font-medium">Pensé pour les indés</td>
                  <td className="py-3 px-3 text-purple-700 font-semibold">Oui</td>
                  <td className="py-3 px-3">Plutôt salons</td>
                  <td className="py-3 px-3">Plutôt marketplace</td>
                </tr>
                <tr className="border-b border-gray-100">
                  <td className="py-3 px-2 font-medium">Application mobile pro</td>
                  <td className="py-3 px-3 text-purple-700 font-semibold">iOS + Android</td>
                  <td className="py-3 px-3">iOS + Android</td>
                  <td className="py-3 px-3">iOS + Android</td>
                </tr>
                <tr className="border-b border-gray-100">
                  <td className="py-3 px-2 font-medium">Multi-lieux (salon + domicile)</td>
                  <td className="py-3 px-3 text-purple-700 font-semibold">Oui</td>
                  <td className="py-3 px-3">Limité</td>
                  <td className="py-3 px-3">Limité</td>
                </tr>
                <tr>
                  <td className="py-3 px-2 font-medium">Tarif indé</td>
                  <td className="py-3 px-3 text-purple-700 font-semibold">19,90 €/mois</td>
                  <td className="py-3 px-3">~ 49 €/mois</td>
                  <td className="py-3 px-3">Variable + commissions</td>
                </tr>
              </tbody>
            </table>
            <p className="mt-4 text-xs text-gray-500 italic">
              Tarifs publics observés en mai 2026. Treatwell prélève une commission par
              réservation entrée via la marketplace.
            </p>
          </div>
        </section>

        {/* ── CTA MID ──────────────────────────────────────────────── */}
        <section className="bg-gradient-to-br from-purple-600 to-pink-600 py-16">
          <div className="mx-auto max-w-3xl px-4 sm:px-6 lg:px-8 text-center">
            <h2 className="text-2xl sm:text-3xl lg:text-4xl font-bold text-white">
              Prête à reprendre le contrôle de votre agenda nail art ?
            </h2>
            <p className="mt-4 text-base sm:text-lg text-purple-100">
              Essai gratuit 30 jours, sans carte bancaire. Vous gardez 100 % de vos
              réservations. Configurez votre page en 5 minutes.
            </p>
            <Link
              href="/inscription/pro"
              className="mt-8 inline-flex items-center justify-center gap-2 rounded-xl bg-white hover:bg-gray-100 px-8 py-4 text-purple-700 text-base font-semibold shadow-xl transition-colors"
            >
              Commencer mon essai gratuit
              <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
        </section>

        {/* ── FAQ ──────────────────────────────────────────────────── */}
        <section className="mx-auto max-w-3xl px-4 sm:px-6 lg:px-8 py-16 sm:py-20">
          <div className="text-center">
            <h2 className="text-2xl sm:text-3xl lg:text-4xl font-bold text-gray-900">
              Questions fréquentes — nail art &amp; onglerie
            </h2>
            <p className="mt-4 text-base sm:text-lg text-gray-600">
              Les réponses aux objections qu&apos;on entend le plus.
            </p>
          </div>
          <div className="mt-10 space-y-4">
            {faqItems.map((item) => (
              <details
                key={item.q}
                className="group rounded-2xl border border-gray-200 bg-white p-5 hover:border-purple-200 transition-colors"
              >
                <summary className="flex items-center justify-between cursor-pointer list-none">
                  <h3 className="text-base sm:text-lg font-semibold text-gray-900 pr-4">
                    {item.q}
                  </h3>
                  <span className="flex-shrink-0 w-7 h-7 rounded-full bg-purple-100 text-purple-700 flex items-center justify-center text-lg group-open:rotate-45 transition-transform">
                    +
                  </span>
                </summary>
                <p className="mt-3 text-sm sm:text-base text-gray-600 leading-relaxed">
                  {item.a}
                </p>
              </details>
            ))}
          </div>
        </section>

        {/* ── FINAL CTA ────────────────────────────────────────────── */}
        <section className="bg-gray-50 py-16">
          <div className="mx-auto max-w-3xl px-4 sm:px-6 lg:px-8 text-center">
            <h2 className="text-2xl sm:text-3xl font-bold text-gray-900">
              Une application de rendez-vous nail art, vraiment pensée pour vous
            </h2>
            <p className="mt-3 text-base text-gray-600">
              Rejoignez les nail artists qui ont arrêté de gérer leurs RDV en DM.
            </p>
            <div className="mt-7 flex flex-col sm:flex-row gap-3 justify-center">
              <Link
                href="/inscription/pro"
                className="inline-flex items-center justify-center gap-2 rounded-xl bg-primary-600 hover:bg-primary-700 px-6 py-3.5 text-white text-base font-semibold shadow-md hover:shadow-lg transition-all"
              >
                Créer mon agenda gratuitement
                <ArrowRight className="w-4 h-4" />
              </Link>
              <Link
                href="/pricing"
                className="inline-flex items-center justify-center gap-2 rounded-xl border border-gray-300 bg-white hover:bg-gray-100 px-6 py-3.5 text-gray-800 text-base font-medium transition-colors"
              >
                Voir les tarifs
              </Link>
            </div>
          </div>
        </section>
      </main>
      <Footer />

      {/* JSON-LD structured data — picked up by Google for rich snippets
          (FAQ accordion in SERP) and software application card. */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(faqSchema) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(softwareSchema) }}
      />
    </>
  );
}
