import type { Metadata } from 'next';
import Image from 'next/image';
import Link from 'next/link';
import Script from 'next/script';
import { ArrowRight, ArrowUpRight, Check, GraduationCap, Minus } from 'lucide-react';
import { Header } from '@/components/layout/Header';
import { Footer } from '@/components/layout/Footer';
import { HeroVideo } from '@/components/home/HeroVideo';
import { articleRepository, landingGalleryRepository } from '@booking-app/firebase';
import { ArticleCard, type ArticleCardData } from '@/app/blog/components/ArticleCard';
import { TutorialsCarousel } from '@/components/home/TutorialsCarousel';
import { AppStoreBadges } from '@/components/common/AppStoreBadges';
import { CamBeautyBookingButton } from './CamBeautyBookingButton';
import type { LandingGalleryItem } from '@booking-app/shared';

// ---------------------------------------------------------------------------
// /nail-artist — vertical landing for nail artists / prothésistes ongulaires
// ---------------------------------------------------------------------------
//
// Design direction: warm-cream editorial, NOT the candy-coated pink-and-
// purple SaaS template you've seen 1000 times. The audience (independent
// nail artists, often Instagram-native, 22-40 yo, taste-conscious) reacts
// poorly to "girly tech" and rewards typographic confidence + restraint.
//
// Palette is locked to:
//   - Cream background  #FAF6F0 (bg-stone-50 with a warm shift)
//   - Warm near-black   #18120E (stone-900)
//   - Brand violet      #7C3AED (primary-600 — used as accent only, never
//                                as a flood)
//   - Subtle border     stone-200
// No pink, no gradient overlays. Hierarchy comes from typography size +
// generous whitespace, not from color drama.
//
// SEO: H1 carries the primary keyword "application de rendez-vous nail
// art" verbatim. Secondaries (`prothésiste ongulaire`, `agenda nail
// artist`, `logiciel onglerie`) are layered in across H2/body/FAQ.
//
// Video assets: drop /public/nail-hero.mp4 (16:9) and
// /public/nail-hero-mobile.mp4 (9:16) before launch — the HeroVideo
// component otherwise serves a branded splash without playback.
// ---------------------------------------------------------------------------

export const metadata: Metadata = {
  title: 'Application de rendez-vous nail art — Opatam',
  description:
    "Le logiciel de réservation pensé pour les nail artists et prothésistes ongulaires. Acomptes anti-no-show, lien Instagram, agenda mobile, 0 % commission. Essai gratuit 30 jours.",
  alternates: { canonical: 'https://opatam.com/nail-artist' },
  openGraph: {
    title: 'Application de rendez-vous nail art — Opatam',
    description:
      'Centralisez vos réservations, encaissez vos acomptes et finissez-en avec les DM Instagram à 22h. Le logiciel pensé pour les nail artists indépendantes.',
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

// Three narrative pain points — written as small stories rather than
// generic feature bullets. Each pairs a "before" with the resulting
// cost (lost revenue, wasted time, missed clients). No icons here —
// the typographic hierarchy alone carries the section.
const painPoints = [
  {
    label: '01',
    title: 'Le planning vit dans vos DM',
    body:
      "Vingt messages à 22h, des « tu peux mardi à 14h ? » qui chevauchent, des clientes qu'on perd parce qu'on a tardé à répondre. Vous êtes nail artist, pas community manager.",
  },
  {
    label: '02',
    title: 'Les no-shows coûtent une fortune',
    body:
      "Une pose complète, c'est 1h30 à 3h, plus le matériel préparé, plus le créneau qu'une autre cliente aurait pu prendre. Trois absences par mois et c'est 200 € qui s'envolent — sans compter le moral.",
  },
  {
    label: '03',
    title: "L'agenda papier ne tient plus la charge",
    body:
      "Vous travaillez en salon, à domicile, en déplacement chez les clientes. Vos horaires bougent. Un cahier ou Google Calendar oublient des RDV, en doublent d'autres. Le mois est plus court que ce qu'il devrait être.",
  },
];

// Four "moments" of the nail artist's day, each tied to one Opatam
// capability. Story-first phrasing (verb-led, present tense) rather
// than feature-list phrasing. 2x2 grid means perfect balance.
const moments = [
  {
    when: 'Votre matin',
    title: 'Vous dormez. Vos clientes réservent.',
    body:
      "Votre lien de réservation vit dans votre bio Instagram, dans votre QR code en cabine, dans votre signature email. Vos clientes choisissent leur créneau à 7h, à minuit, à n'importe quelle heure — sans compte à créer, sans passer par vos DM.",
  },
  {
    when: 'En pose',
    title: 'Vous êtes en train de poser. Le RDV est déjà payé.',
    body:
      "Avec l'option Sérénité, vous demandez un acompte au moment de la réservation. La cliente paie par carte directement depuis votre lien. Si elle ne vient pas, vous gardez l'acompte. Les no-shows chutent de 60 à 80 % en moyenne.",
  },
  {
    when: 'Entre deux lieux',
    title: "Vous changez d'adresse. L'agenda suit.",
    body:
      "Salon le mardi, à domicile le mercredi, chez Pauline jeudi à 16h ? Configurez vos lieux, vos horaires par lieu, vos prestations disponibles ou non selon où vous êtes. Tout se gère depuis l'app mobile entre deux poses.",
  },
  {
    when: 'La veille du RDV',
    title: 'Vous oubliez de relancer. Opatam le fait pour vous.',
    body:
      "Confirmation immédiate à la réservation, rappel automatique 24h avant, dernier rappel 2h avant. Vos clientes ne disent plus jamais « ah merde, j'avais oublié ». Vous économisez 30 minutes de SMS par jour.",
  },
];

// FAQ — trade-specific objections we've heard from real nail artists
// during onboarding calls. Each answer ends with a concrete number or
// outcome rather than a generic reassurance.
const faqItems = [
  {
    q: 'Mes clientes peuvent réserver depuis leur téléphone sans créer de compte ?',
    a: "Oui — c'est l'un des choix forts d'Opatam. Vos clientes cliquent sur votre lien (Instagram, SMS, QR code en boutique), choisissent leur prestation et leur créneau, renseignent juste leur prénom, email et numéro. Aucun mot de passe, aucun compte. Tout se passe sur leur téléphone, en moins d'une minute.",
  },
  {
    q: 'Comment je récupère mes clientes qui réservaient en DM Instagram avant ?',
    a: "Le lien Opatam va dans votre bio Instagram, un QR code dans votre salon, et vous pouvez automatiser une réponse type aux DM avec « tu peux réserver ici directement ». Vos clientes habituées prennent le pli en deux semaines.",
  },
  {
    q: 'Combien fixer comme acompte ?',
    a: "Vous choisissez. Sur Opatam, la plupart des nail artists demandent entre 10 € et 30 % du prix de la prestation. L'acompte est encaissé par carte à la réservation, déduit du total à payer en cabine, et conservé si la cliente ne vient pas. C'est légal, transparent (vos clientes voient le montant avant de confirmer), et ça réduit drastiquement les no-shows.",
  },
  {
    q: 'Ça marche si je suis à domicile ou itinérante ?',
    a: "Très bien. Configurez plusieurs lieux (salon, domicile, déplacement chez la cliente). Chaque prestation peut être proposée sur un ou plusieurs lieux. Les clientes voient ce qui est dispo selon là où vous êtes. Vous gérez tout depuis l'app mobile entre deux poses.",
  },
  {
    q: 'Vous prenez combien de commission ?',
    a: "Zéro. Opatam est un abonnement mensuel ou annuel fixe (19,90 €/mois en Pro, ou 199 €/an), sans pourcentage prélevé sur vos prestations. Contrairement à Treatwell, ce que la cliente paie va directement chez vous. Les acomptes transitent par Stripe — vous touchez l'intégralité moins les frais bancaires (~1,4 % + 0,25 €).",
  },
  {
    q: 'Combien de temps pour configurer mon agenda nail art ?',
    a: "Cinq à dix minutes pour publier votre page de réservation. Vous créez vos prestations (pose complète, remplissage, nail art, etc.) avec durée et tarif, vous définissez vos horaires, vous activez le lien — c'est en ligne. Vous affinez (acomptes, multi-lieux) à votre rythme.",
  },
];

/**
 * Gallery management — see the "Vos créations" marquee further down.
 *
 * Source of truth: Firestore document `landingGalleries/nail-artist`,
 * edited through the admin UI at /admin/galleries/nail-artist. Items
 * carry { id, src, alt, order } — `src` can be a Firebase Storage
 * download URL OR any external HTTPS URL (provider portfolio shot,
 * CDN, etc.). The admin handles uploads to
 * `landing/galleries/nail-artist/{uuid}.jpg` and URL pasting in the
 * same screen.
 *
 * Fallback: when the Firestore doc is empty or unreachable, the
 * marquee renders 8 placeholder tiles in warm-grey gradients so the
 * layout is always present. The page never ships a broken <Image>.
 *
 * To add new images: go to /admin/galleries/nail-artist, upload or
 * paste URLs, save. No deploy needed.
 */
const PLACEHOLDER_GALLERY_LENGTH = 8;

/** Four warm-grey gradient variants, cycled across the placeholder
 *  tiles so they read as distinct shapes rather than a wall of one
 *  colour. Stone-only on purpose — coloured placeholders compete
 *  with the brand palette; warm greys stay out of the way until real
 *  photos take over. */
const PLACEHOLDER_TONES = [
  'from-stone-200 to-stone-300',
  'from-stone-300 to-stone-200',
  'from-stone-100 to-stone-300',
  'from-stone-300 to-stone-400',
];

// Marquee strip content — short, punchy value props that scroll
// continuously below the hero. The DOM duplicates the list once so
// the CSS translateX animation can loop seamlessly.
const marqueeItems = [
  '0 % de commission',
  'Acomptes anti no-show',
  'Lien Instagram dédié',
  'Application iOS + Android',
  'Rappels automatiques 24h + 2h',
  'Multi-lieux et itinérance',
  'Configuration en 5 minutes',
  '30 jours d’essai gratuit',
  'Sans engagement',
];

export default async function NailArtistPage() {
  // Tutorials — same source as the homepage block. Tolerant: an empty
  // list (no published tutorial, or Firestore unavailable) just hides
  // the section, never breaks the page.
  const tutorialDocs = await articleRepository
    .getPublishedByCategory('tutoriels', 3)
    .catch((err) => {
      console.error('[nail-artist] tutorials fetch failed:', err);
      return [];
    });
  const tutorials: ArticleCardData[] = tutorialDocs.map((a) => ({
    slug: a.slug,
    title: a.title,
    excerpt: a.excerpt,
    coverImageURL: a.coverImageURL,
    category: a.category,
    videoUrl: a.videoUrl,
    videoCoverURL: a.videoCoverURL,
    publishedAt: a.publishedAt ? a.publishedAt.toISOString() : null,
    authorName: a.authorName,
  }));

  // Gallery — managed via /admin/galleries/nail-artist. When empty
  // or unreachable, we render placeholder tiles instead. The fallback
  // is intentional: the marquee section should never visually
  // collapse, even if Firestore goes down.
  const galleryDoc = await landingGalleryRepository
    .getBySlug('nail-artist')
    .catch((err: unknown) => {
      console.error('[nail-artist] gallery fetch failed:', err);
      return null;
    });
  const galleryItems: LandingGalleryItem[] = galleryDoc?.items ?? [];
  const useGalleryPlaceholders = galleryItems.length === 0;
  const galleryDisplayLength = useGalleryPlaceholders
    ? PLACEHOLDER_GALLERY_LENGTH
    : galleryItems.length;

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
    offers: { '@type': 'Offer', price: '19.90', priceCurrency: 'EUR' },
    aggregateRating: { '@type': 'AggregateRating', ratingValue: '4.8', reviewCount: '12' },
  };

  return (
    <>
      <Header />
      <main className="bg-[#FAF6F0] text-stone-900">
        {/* ─── HERO ──────────────────────────────────────────────────
            Asymmetric column split (text 7 / video 5 on desktop) so it
            doesn't feel like a 50/50 SaaS template. H1 carries the SEO
            keyword verbatim. No gradient — just cream + ink. */}
        <section className="border-b border-stone-200">
          <div className="mx-auto max-w-7xl xl:max-w-[96rem] px-6 sm:px-8 lg:px-12 pt-14 pb-16 sm:pt-20 sm:pb-24 lg:pt-24 lg:pb-28">
            <div className="grid lg:grid-cols-12 gap-10 lg:gap-16 xl:gap-12 items-center">
              <div className="lg:col-span-7 xl:col-span-5">
                <p className="text-xs sm:text-sm font-medium uppercase tracking-[0.18em] text-stone-500 mb-7">
                  Pour les nail artists &amp; prothésistes ongulaires
                </p>
                <h1 className="text-4xl sm:text-5xl lg:text-[3.5rem] xl:text-6xl font-semibold leading-[1.05] tracking-tight text-stone-900">
                  L&apos;application de rendez-vous nail art qui remplace vos
                  <span className="text-primary-600"> DM Instagram</span>.
                </h1>
                <p className="mt-6 text-lg sm:text-xl leading-relaxed text-stone-600 max-w-2xl">
                  Centralisez vos réservations, encaissez vos acomptes, et
                  finissez-en avec les vingt messages à 22h pour caler un
                  balayage. Une seule app, sans commission.
                </p>
                <div className="mt-9 flex flex-col sm:flex-row gap-3">
                  <Link
                    href="/inscription/pro"
                    className="group inline-flex items-center justify-center gap-2 rounded-full bg-primary-900 hover:bg-primary-800 px-7 py-3.5 text-white text-[15px] font-medium transition-all"
                  >
                    Créer mon agenda nail art
                    <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-0.5" />
                  </Link>
                  <Link
                    href="/p/demo"
                    className="inline-flex items-center justify-center gap-2 rounded-full border border-stone-300 bg-transparent hover:bg-stone-100 px-7 py-3.5 text-stone-800 text-[15px] font-medium transition-colors"
                  >
                    Voir une démo
                    <ArrowUpRight className="w-4 h-4" />
                  </Link>
                </div>
                <p className="mt-6 text-sm text-stone-500">
                  Essai gratuit 30 jours · Sans carte bancaire · 0 % de commission
                </p>
              </div>

              <div className="lg:col-span-5 xl:col-span-7">
                <HeroVideo
                  variant="panel"
                  desktopSrc="/nail-hero.mp4"
                  mobileSrc="/nail-hero.mp4"
                  loaderTagline="L'agenda nail art, pensé pour vous"
                />
              </div>
            </div>
          </div>
        </section>

        {/* ─── MARQUEE STRIP ─────────────────────────────────────────
            Continuous horizontal scroll of value props. Sits just below
            the hero as a "trust band" — adds movement to the page
            without disrupting the editorial calm. Pauses on hover; the
            whole strip freezes for prefers-reduced-motion users. */}
        <section
          aria-label="Avantages clés"
          className="border-b border-stone-200 bg-primary-900 text-white overflow-hidden"
        >
          <div className="relative flex w-full overflow-hidden py-5">
            {/* Edge fades so the items melt in/out instead of clipping
                hard against the section border. */}
            <div
              aria-hidden="true"
              className="pointer-events-none absolute inset-y-0 left-0 w-24 bg-gradient-to-r from-primary-900 to-transparent z-10"
            />
            <div
              aria-hidden="true"
              className="pointer-events-none absolute inset-y-0 right-0 w-24 bg-gradient-to-l from-primary-900 to-transparent z-10"
            />
            <div className="flex flex-nowrap whitespace-nowrap animate-marquee" style={{ width: 'max-content' }}>
              {[...marqueeItems, ...marqueeItems].map((item, idx) => (
                <span
                  key={`${item}-${idx}`}
                  className="flex items-center gap-3 px-8 text-sm sm:text-base font-medium tracking-wide text-white/90"
                >
                  <span aria-hidden="true" className="text-white/40">·</span>
                  {item}
                </span>
              ))}
            </div>
          </div>
        </section>

        {/* ─── MANIFESTO ─────────────────────────────────────────────
            One bold line, full width, generous whitespace. The page's
            "pause and breathe" moment between hero and arguments. */}
        <section className="border-b border-stone-200">
          <div className="mx-auto max-w-5xl px-6 sm:px-8 lg:px-12 py-20 sm:py-28">
            <p className="text-2xl sm:text-3xl lg:text-4xl font-semibold leading-snug tracking-tight text-stone-900">
              En 2026, vos rendez-vous ne devraient plus vivre dans vos DM.
              <span className="text-stone-400"> Opatam les en sort, et vous redonne vos soirées.</span>
            </p>
          </div>
        </section>

        {/* ─── SOCIAL PROOF — Cam Beauty Studio ──────────────────────
            Sits high on the page so visitors meet a real Opatam-powered
            boutique before the arguments. Both CTAs (the link next to
            the body copy AND the "Réserver" button inside the mockup)
            open Cam Beauty Studio's actual Opatam popup via embed.js —
            the visitor literally test-drives the product through a
            real customer's booking flow. */}
        <section className="border-b border-stone-200 bg-white">
          <div className="mx-auto max-w-6xl px-6 sm:px-8 lg:px-12 py-20 sm:py-28">
            <div className="grid lg:grid-cols-12 gap-12 lg:gap-16 items-center">
              <div className="lg:col-span-6">
                <p className="text-xs sm:text-sm font-medium uppercase tracking-[0.18em] text-primary-700 mb-4">
                  Une cliente, une démo en live
                </p>
                <h2 className="text-3xl sm:text-4xl lg:text-[2.75rem] font-semibold leading-[1.1] tracking-tight text-stone-900">
                  Voici la page de Cam Beauty Studio.
                  <span className="text-stone-400"> Vous pouvez avoir la même, en 5 minutes.</span>
                </h2>
                <p className="mt-6 text-base sm:text-lg leading-relaxed text-stone-600 max-w-xl">
                  Cam fait de la manucure russe à Villeurbanne. Son site la
                  positionne comme une adresse boutique de la région lyonnaise —
                  et c&apos;est Opatam qui prend toutes ses réservations en
                  arrière-plan, du bouton « Réserver » jusqu&apos;à l&apos;acompte
                  de garantie. Cliquez ci-dessous : vous testez sa vraie page,
                  en live.
                </p>
                <dl className="mt-8 grid grid-cols-2 gap-y-5 gap-x-8 max-w-md">
                  <div>
                    <dt className="text-xs font-medium uppercase tracking-[0.14em] text-stone-500">
                      Spécialité
                    </dt>
                    <dd className="mt-1 text-base font-medium text-stone-900">
                      Manucure russe
                    </dd>
                  </div>
                  <div>
                    <dt className="text-xs font-medium uppercase tracking-[0.14em] text-stone-500">
                      Lieu
                    </dt>
                    <dd className="mt-1 text-base font-medium text-stone-900">
                      Villeurbanne (Lyon)
                    </dd>
                  </div>
                  <div>
                    <dt className="text-xs font-medium uppercase tracking-[0.14em] text-stone-500">
                      Site web
                    </dt>
                    <dd className="mt-1 text-base font-medium text-stone-900">
                      Connecté à Opatam
                    </dd>
                  </div>
                  <div>
                    <dt className="text-xs font-medium uppercase tracking-[0.14em] text-stone-500">
                      Acomptes
                    </dt>
                    <dd className="mt-1 text-base font-medium text-stone-900">
                      Sérénité activé
                    </dd>
                  </div>
                </dl>
                <div className="mt-10 flex flex-wrap items-center gap-x-6 gap-y-3">
                  <CamBeautyBookingButton className="group inline-flex items-center gap-2 rounded-full bg-primary-900 hover:bg-primary-800 px-7 py-3.5 text-white text-[15px] font-medium transition-all">
                    Tester sa page de réservation
                    <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-0.5" />
                  </CamBeautyBookingButton>
                  <a
                    href="https://cambeautystudio.com"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 text-sm font-medium text-stone-600 hover:text-stone-900 transition-colors group"
                  >
                    cambeautystudio.com
                    <ArrowUpRight className="w-3.5 h-3.5 transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
                  </a>
                </div>
              </div>

              <div className="lg:col-span-6">
                {/* Browser-frame mockup — visual hint of her real site,
                    not a live iframe (avoids cross-origin + bandwidth
                    issues). The "Réserver en ligne" button inside the
                    mockup is a *real* trigger: it opens her actual
                    Opatam booking popup via embed.js. */}
                <div className="rounded-2xl border border-stone-200 bg-stone-50 shadow-xl overflow-hidden">
                  {/* Address bar */}
                  <div className="flex items-center gap-2 border-b border-stone-200 bg-white px-4 py-3">
                    <span className="w-2.5 h-2.5 rounded-full bg-stone-300" />
                    <span className="w-2.5 h-2.5 rounded-full bg-stone-300" />
                    <span className="w-2.5 h-2.5 rounded-full bg-stone-300" />
                    <div className="ml-3 flex-1 inline-flex items-center justify-center text-xs text-stone-500 tracking-wide">
                      cambeautystudio.com
                    </div>
                  </div>
                  {/* Site preview content */}
                  <div className="bg-[#F4EFE6] px-8 py-12 sm:py-16">
                    <p className="text-[10px] sm:text-xs uppercase tracking-[0.3em] text-stone-500 mb-5">
                      Cam Beauty Studio
                    </p>
                    <h3 className="text-2xl sm:text-3xl lg:text-4xl font-serif font-light leading-tight text-stone-900">
                      Manucure russe
                      <br />
                      <em className="not-italic text-stone-700">&amp; beauté minimaliste.</em>
                    </h3>
                    <p className="mt-6 text-sm text-stone-600 max-w-sm leading-relaxed">
                      La beauté dans les détails. Un écrin discret pour des
                      finitions haut de gamme, à Villeurbanne.
                    </p>
                    <div className="mt-8 flex flex-wrap items-center gap-3">
                      <CamBeautyBookingButton className="inline-flex items-center gap-2 rounded-full bg-stone-900 hover:bg-stone-800 px-5 py-2.5 text-white text-sm font-medium transition-colors">
                        Réserver en ligne
                      </CamBeautyBookingButton>
                      <span className="text-xs text-stone-500">
                        powered by{' '}
                        <span className="font-medium text-primary-700">Opatam</span>
                      </span>
                    </div>
                    <ul className="mt-10 space-y-2 text-sm text-stone-700">
                      <li className="flex items-center justify-between border-t border-stone-300/70 pt-3">
                        <span>Manucure russe · 90 min</span>
                        <span className="font-medium">65 €</span>
                      </li>
                      <li className="flex items-center justify-between border-t border-stone-300/70 pt-3">
                        <span>Pose capsules gel · 75 min</span>
                        <span className="font-medium">55 €</span>
                      </li>
                      <li className="flex items-center justify-between border-t border-stone-300/70 pt-3">
                        <span>Dépose &amp; soin · 45 min</span>
                        <span className="font-medium">30 €</span>
                      </li>
                    </ul>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ─── GALLERY ───────────────────────────────────────────────
            Slow-scrolling marquee of nail-art prestations. Sits between
            the case study (real customer) and the pain points (real
            douleurs) as a visual bridge — "voilà ce que ces artistes
            créent, et voilà pourquoi un agenda papier ne suffit pas".
            Background matches the Cam Beauty Studio mockup interior
            (#F4EFE6) for visual continuity. The marquee uses the
            slower 90s tempo so it doesn't race against the value-prop
            strip at the top. */}
        <section aria-label="Galerie nail art" className="border-b border-stone-200 bg-[#F4EFE6] overflow-hidden">
          <div className="py-16 sm:py-20">
            <div className="mx-auto max-w-6xl px-6 sm:px-8 lg:px-12 mb-10 sm:mb-12">
              <p className="text-xs sm:text-sm font-medium uppercase tracking-[0.18em] text-stone-500 mb-4">
                Vos créations
              </p>
              <h2 className="text-3xl sm:text-4xl lg:text-5xl font-semibold leading-tight tracking-tight text-stone-900 max-w-3xl">
                Pendant qu&apos;Opatam gère l&apos;agenda,
                <span className="text-stone-400"> vous faites ce que vous savez faire de mieux.</span>
              </h2>
            </div>

            {/* Edge fades + marquee track. The fades melt the tiles
                in/out of the section instead of clipping hard at the
                viewport edge. Hover pauses the scroll for read-time. */}
            <div className="relative w-full overflow-hidden">
              <div
                aria-hidden="true"
                className="pointer-events-none absolute inset-y-0 left-0 w-16 sm:w-24 bg-gradient-to-r from-[#F4EFE6] to-transparent z-10"
              />
              <div
                aria-hidden="true"
                className="pointer-events-none absolute inset-y-0 right-0 w-16 sm:w-24 bg-gradient-to-l from-[#F4EFE6] to-transparent z-10"
              />
              <div
                className="flex flex-nowrap animate-marquee-slow gap-3 sm:gap-4"
                style={{ width: 'max-content' }}
              >
                {Array.from({ length: galleryDisplayLength * 2 }).map((_, idx) => {
                  const baseClasses =
                    'shrink-0 relative w-52 h-52 sm:w-60 sm:h-60 lg:w-72 lg:h-72 rounded-sm overflow-hidden';
                  if (useGalleryPlaceholders) {
                    return (
                      <div
                        key={`placeholder-${idx}`}
                        aria-hidden="true"
                        className={`${baseClasses} bg-gradient-to-br ${PLACEHOLDER_TONES[idx % PLACEHOLDER_TONES.length]}`}
                      />
                    );
                  }
                  const item = galleryItems[idx % galleryItems.length];
                  return (
                    <div key={`${item.id}-${idx}`} className={baseClasses}>
                      <Image
                        src={item.src}
                        alt={item.alt}
                        fill
                        sizes="(max-width: 640px) 208px, (max-width: 1024px) 240px, 288px"
                        className="object-cover"
                      />
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </section>

        {/* ─── PAIN POINTS ───────────────────────────────────────────
            Three numbered narrative blocks, stacked vertically with
            ample whitespace. Each block: huge serif-like number, title
            in display weight, body text. No icons, no cards in a row. */}
        <section className="border-b border-stone-200">
          <div className="mx-auto max-w-5xl px-6 sm:px-8 lg:px-12 py-20 sm:py-28">
            <div className="max-w-2xl mb-14 sm:mb-20">
              <p className="text-xs sm:text-sm font-medium uppercase tracking-[0.18em] text-stone-500 mb-4">
                Le quotidien d&apos;une nail artist indépendante
              </p>
              <h2 className="text-3xl sm:text-4xl lg:text-5xl font-semibold leading-tight tracking-tight text-stone-900">
                Ce qui vous fait perdre du temps, du chiffre,
                <span className="text-stone-400"> et parfois l&apos;envie</span>.
              </h2>
            </div>
            <div className="space-y-14 sm:space-y-20">
              {painPoints.map((p) => (
                <article
                  key={p.label}
                  className="reveal-on-scroll grid grid-cols-12 gap-6 sm:gap-8 items-baseline"
                >
                  <div className="col-span-12 sm:col-span-2">
                    <span className="text-5xl sm:text-6xl font-light text-stone-300 tracking-tighter">
                      {p.label}
                    </span>
                  </div>
                  <div className="col-span-12 sm:col-span-10 sm:pl-4">
                    <h3 className="text-xl sm:text-2xl lg:text-3xl font-semibold leading-snug tracking-tight text-stone-900">
                      {p.title}
                    </h3>
                    <p className="mt-3 text-base sm:text-lg leading-relaxed text-stone-600 max-w-2xl">
                      {p.body}
                    </p>
                  </div>
                </article>
              ))}
            </div>
          </div>
        </section>

        {/* ─── MOMENTS (features) ────────────────────────────────────
            Four "moments of your day" in a balanced 2×2 grid. Each one
            ties a Opatam capability to a real beat in the nail artist's
            day, story-first, verb-led. */}
        <section className="border-b border-stone-200 bg-white">
          <div className="mx-auto max-w-6xl px-6 sm:px-8 lg:px-12 py-20 sm:py-28">
            <div className="max-w-2xl mb-14 sm:mb-20">
              <p className="text-xs sm:text-sm font-medium uppercase tracking-[0.18em] text-stone-500 mb-4">
                Comment ça vous aide
              </p>
              <h2 className="text-3xl sm:text-4xl lg:text-5xl font-semibold leading-tight tracking-tight text-stone-900">
                Quatre moments de votre journée,
                <span className="text-stone-400"> repensés.</span>
              </h2>
            </div>
            <div className="grid sm:grid-cols-2 gap-x-12 lg:gap-x-20 gap-y-14 sm:gap-y-20">
              {moments.map((m) => (
                <article key={m.title} className="reveal-on-scroll border-t border-stone-200 pt-7">
                  <p className="text-xs font-medium uppercase tracking-[0.18em] text-primary-600 mb-4">
                    {m.when}
                  </p>
                  <h3 className="text-xl sm:text-2xl font-semibold leading-snug tracking-tight text-stone-900">
                    {m.title}
                  </h3>
                  <p className="mt-3 text-base leading-relaxed text-stone-600">
                    {m.body}
                  </p>
                </article>
              ))}
            </div>
          </div>
        </section>

        {/* ─── COMPARATIF ────────────────────────────────────────────
            Compact 3-column comparison — replaces the heavy table from
            the first draft. Reads like a positioning statement rather
            than a feature war. */}
        <section className="border-b border-stone-200">
          <div className="mx-auto max-w-5xl px-6 sm:px-8 lg:px-12 py-20 sm:py-24">
            <div className="max-w-2xl mb-14">
              <p className="text-xs sm:text-sm font-medium uppercase tracking-[0.18em] text-stone-500 mb-4">
                À choisir entre les options du marché
              </p>
              <h2 className="text-3xl sm:text-4xl lg:text-5xl font-semibold leading-tight tracking-tight text-stone-900">
                Pourquoi Opatam,
                <span className="text-stone-400"> pas Planity, pas Treatwell.</span>
              </h2>
            </div>
            <div className="grid md:grid-cols-3 gap-px bg-stone-200 rounded-xl overflow-hidden border border-stone-200">
              <div className="bg-primary-900 text-white p-7 sm:p-9">
                <p className="text-xs font-medium uppercase tracking-[0.18em] text-stone-400 mb-5">
                  Opatam
                </p>
                <p className="text-2xl font-semibold leading-tight mb-7">
                  19,90 €/mois
                </p>
                <ul className="space-y-3 text-sm leading-relaxed text-stone-200">
                  <li className="flex gap-2">
                    <Check className="w-4 h-4 mt-0.5 flex-shrink-0 text-primary-300" />
                    0 % de commission, jamais
                  </li>
                  <li className="flex gap-2">
                    <Check className="w-4 h-4 mt-0.5 flex-shrink-0 text-primary-300" />
                    Acomptes intégrés (Sérénité)
                  </li>
                  <li className="flex gap-2">
                    <Check className="w-4 h-4 mt-0.5 flex-shrink-0 text-primary-300" />
                    Multi-lieux et itinérance natifs
                  </li>
                  <li className="flex gap-2">
                    <Check className="w-4 h-4 mt-0.5 flex-shrink-0 text-primary-300" />
                    Mise en route en 5 minutes
                  </li>
                  <li className="flex gap-2">
                    <Check className="w-4 h-4 mt-0.5 flex-shrink-0 text-primary-300" />
                    Pensé pour les indépendantes
                  </li>
                </ul>
              </div>
              <div className="bg-white p-7 sm:p-9">
                <p className="text-xs font-medium uppercase tracking-[0.18em] text-stone-500 mb-5">
                  Planity
                </p>
                <p className="text-2xl font-semibold leading-tight mb-7 text-stone-900">
                  À partir de 89 €/mois
                </p>
                <ul className="space-y-3 text-sm leading-relaxed text-stone-600">
                  <li className="flex gap-2">
                    <Check className="w-4 h-4 mt-0.5 flex-shrink-0 text-stone-400" />
                    0 % de commission
                  </li>
                  <li className="flex gap-2">
                    <Minus className="w-4 h-4 mt-0.5 flex-shrink-0 text-stone-400" />
                    Acomptes limités
                  </li>
                  <li className="flex gap-2">
                    <Minus className="w-4 h-4 mt-0.5 flex-shrink-0 text-stone-400" />
                    Multi-lieux limité
                  </li>
                  <li className="flex gap-2">
                    <Minus className="w-4 h-4 mt-0.5 flex-shrink-0 text-stone-400" />
                    Onboarding accompagné requis
                  </li>
                  <li className="flex gap-2">
                    <Minus className="w-4 h-4 mt-0.5 flex-shrink-0 text-stone-400" />
                    Conçu pour les salons
                  </li>
                </ul>
              </div>
              <div className="bg-white p-7 sm:p-9">
                <p className="text-xs font-medium uppercase tracking-[0.18em] text-stone-500 mb-5">
                  Treatwell
                </p>
                <p className="text-2xl font-semibold leading-tight mb-7 text-stone-900">
                  + 15 à 25 % de commission
                </p>
                <ul className="space-y-3 text-sm leading-relaxed text-stone-600">
                  <li className="flex gap-2">
                    <Minus className="w-4 h-4 mt-0.5 flex-shrink-0 text-stone-400" />
                    Commission sur chaque RDV
                  </li>
                  <li className="flex gap-2">
                    <Check className="w-4 h-4 mt-0.5 flex-shrink-0 text-stone-400" />
                    Acomptes intégrés
                  </li>
                  <li className="flex gap-2">
                    <Minus className="w-4 h-4 mt-0.5 flex-shrink-0 text-stone-400" />
                    Multi-lieux limité
                  </li>
                  <li className="flex gap-2">
                    <Minus className="w-4 h-4 mt-0.5 flex-shrink-0 text-stone-400" />
                    Onboarding long
                  </li>
                  <li className="flex gap-2">
                    <Minus className="w-4 h-4 mt-0.5 flex-shrink-0 text-stone-400" />
                    Pensé pour les marketplaces
                  </li>
                </ul>
              </div>
            </div>
            <p className="mt-5 text-xs text-stone-500">
              Tarifs publics observés en mai 2026. Treatwell prélève une commission sur les réservations entrées via la marketplace.
            </p>
          </div>
        </section>

        {/* ─── FAQ ───────────────────────────────────────────────────
            Minimal accordion — divider lines only, no cards. The text
            stands on its own. */}
        <section className="border-b border-stone-200">
          <div className="mx-auto max-w-3xl px-6 sm:px-8 lg:px-12 py-20 sm:py-24">
            <div className="mb-12">
              <p className="text-xs sm:text-sm font-medium uppercase tracking-[0.18em] text-stone-500 mb-4">
                Questions fréquentes
              </p>
              <h2 className="text-3xl sm:text-4xl lg:text-5xl font-semibold leading-tight tracking-tight text-stone-900">
                Ce qu&apos;on nous demande le plus,
                <span className="text-stone-400"> chez les nail artists.</span>
              </h2>
            </div>
            <div className="border-t border-stone-200">
              {faqItems.map((item) => (
                <details key={item.q} className="group border-b border-stone-200">
                  <summary className="flex items-start justify-between gap-6 cursor-pointer list-none py-6">
                    <h3 className="text-base sm:text-lg font-medium leading-snug text-stone-900 pr-4">
                      {item.q}
                    </h3>
                    <span className="flex-shrink-0 w-6 h-6 mt-0.5 text-stone-400 group-open:rotate-45 transition-transform text-xl leading-none">
                      +
                    </span>
                  </summary>
                  <p className="pb-7 text-base leading-relaxed text-stone-600 max-w-2xl">
                    {item.a}
                  </p>
                </details>
              ))}
            </div>
          </div>
        </section>

        {/* ─── TUTORIALS ─────────────────────────────────────────────
            Reuses the homepage's tutorial articles via ArticleCard, but
            wrapped in the editorial section style of this page (cream
            background, small uppercase label, large display heading).
            Renders nothing when no tutorials are published — never a
            sad empty state. */}
        {tutorials.length > 0 && (
          <section className="border-b border-stone-200">
            <div className="mx-auto max-w-6xl px-6 sm:px-8 lg:px-12 py-20 sm:py-28">
              <div className="max-w-2xl mb-14">
                <p className="inline-flex items-center gap-2 text-xs sm:text-sm font-medium uppercase tracking-[0.18em] text-stone-500 mb-4">
                  <GraduationCap className="w-4 h-4" />
                  En vidéo
                </p>
                <h2 className="text-3xl sm:text-4xl lg:text-5xl font-semibold leading-tight tracking-tight text-stone-900">
                  Prenez en main Opatam
                  <span className="text-stone-400"> en quelques minutes.</span>
                </h2>
                <p className="mt-5 text-base sm:text-lg leading-relaxed text-stone-600 max-w-xl">
                  Des tutoriels courts pour configurer votre agenda, vos prestations,
                  vos acomptes — et démarrer du bon pied.
                </p>
              </div>
              {/* Mobile: auto-advancing carousel showing one full card
                  + a peek of neighbours (scroll-snap, dots indicator).
                  We extend the carousel edge-to-edge on phones via
                  `-mx-6 sm:mx-0` (cancels the section's px-6) so the
                  peek visually breaks past the content column — the
                  carousel handles its own internal padding. */}
              <div className="sm:hidden -mx-6 sm:mx-0">
                <TutorialsCarousel tutorials={tutorials} />
              </div>

              {/* Tablet + desktop: aligned grid (ArticleCard uses
                  h-full so the "Lire" footer sits at the bottom even
                  when titles wrap to a different line count). */}
              <div className="hidden sm:grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
                {tutorials.map((t) => (
                  <div key={t.slug} className="reveal-on-scroll h-full">
                    <ArticleCard article={t} />
                  </div>
                ))}
              </div>
              <div className="mt-10">
                <Link
                  href="/blog/categorie/tutoriels"
                  className="inline-flex items-center gap-2 text-sm font-medium text-primary-700 hover:text-primary-900 transition-colors"
                >
                  Voir tous les tutoriels
                  <ArrowRight className="w-4 h-4" />
                </Link>
              </div>
            </div>
          </section>
        )}

        {/* ─── FINAL CTA ─────────────────────────────────────────────
            Sober, no gradient. Ink-on-cream with the brand violet only
            as the action signal. */}
        <section>
          <div className="mx-auto max-w-4xl px-6 sm:px-8 lg:px-12 py-24 sm:py-32 text-center">
            <h2 className="text-3xl sm:text-4xl lg:text-5xl font-semibold leading-tight tracking-tight text-stone-900">
              Reprenez votre soirée.
            </h2>
            <p className="mt-5 text-lg text-stone-600 max-w-xl mx-auto">
              Une application de rendez-vous nail art conçue pour vous, prête en 5 minutes. Pas de carte bancaire pour l&apos;essai. Pas de commission, jamais.
            </p>
            <div className="mt-9 flex flex-col sm:flex-row gap-3 justify-center">
              <Link
                href="/inscription/pro"
                className="group inline-flex items-center justify-center gap-2 rounded-full bg-primary-900 hover:bg-primary-800 px-8 py-4 text-white text-[15px] font-medium transition-all"
              >
                Créer mon agenda gratuitement
                <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-0.5" />
              </Link>
              <Link
                href="/pricing"
                className="inline-flex items-center justify-center gap-2 rounded-full border border-stone-300 hover:bg-stone-100 px-8 py-4 text-stone-800 text-[15px] font-medium transition-colors"
              >
                Voir les tarifs
              </Link>
            </div>

            {/* Mobile install path — shared component with the home
                page, so badges, copy and the Play Store waitlist
                modal stay consistent across the site. */}
            <div className="mt-12 flex flex-col items-center gap-4">
              <p className="text-xs sm:text-sm font-medium uppercase tracking-[0.18em] text-stone-500">
                Aussi sur mobile
              </p>
              <AppStoreBadges />
            </div>
          </div>
        </section>
      </main>
      <Footer />

      {/* Opatam embed.js — exposes `window.Opatam.open(slug)` which the
          CamBeautyBookingButton invokes on click. Loaded after hydration
          so it never blocks first paint. */}
      <Script src="/embed.js" strategy="afterInteractive" />

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
