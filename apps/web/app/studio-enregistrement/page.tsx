import type { Metadata } from 'next';
import Link from 'next/link';
import Script from 'next/script';
import { ArrowRight, Check, Minus } from 'lucide-react';
import { Header } from '@/components/layout/Header';
import { Footer } from '@/components/layout/Footer';
import { articleRepository } from '@booking-app/firebase';
import { type ArticleCardData } from '@/app/blog/components/ArticleCard';
import { TutorialsCarousel } from '@/components/home/TutorialsCarousel';
import { AppStoreBadges } from '@/components/common/AppStoreBadges';
import { StudioDemoButton } from './StudioDemoButton';

// ---------------------------------------------------------------------------
// /studio-enregistrement — page verticale pour les studios d'enregistrement
// ---------------------------------------------------------------------------
//
// POURQUOI CETTE VERTICALE : c'est le premier métier du catalogue qui a
// besoin du plan Studio pour une raison structurelle, et non par confort.
// Un salon prend le plan Studio quand il embauche ; un studio le prend dès
// le premier jour, parce qu'il a deux salles et une cabine voix, donc trois
// agendas à ne pas télescoper. L'argumentaire tient donc en une phrase :
// une salle = un agenda.
//
// DIRECTION ARTISTIQUE : sombre, à l'opposé du crème éditorial de
// /nail-artist. Ce n'est pas un caprice — un studio se photographie en
// lumière tamisée, et l'audience (ingénieurs du son, gérants de studio,
// 25-45 ans) juge une page à sa sobriété. Palette verrouillée :
//   - Fond          #0B0B0D, sections alternées #111114
//   - Texte         #F4F2EE, secondaire zinc-400
//   - Accent          le bleu de marque (primary-400 pour le texte,
//                     primary-600 pour les aplats) — un accent maison
//                     inventé pour cette page casserait la cohérence
//                     avec le reste du site
//   - Bordures      white/10
// Pas de dégradé, pas de « glow ». La hiérarchie vient de la typographie
// et du vide.
//
// SEO : le H1 porte « logiciel de réservation pour studio d'enregistrement »
// mot pour mot. Secondaires répartis en H2/corps/FAQ : « réserver une
// session studio », « agenda studio musique », « planning cabine voix »,
// « acompte session enregistrement ».
//
// HONNÊTETÉ DU DISCOURS : Opatam ne réserve pas une ressource combinée
// (salle + ingénieur en une seule ligne), ne fait ni devis ni facturation.
// La section « Ce qu'Opatam ne fait pas » le dit franchement — sur un métier
// aussi outillé, promettre trop se paie en désabonnements le mois suivant.
// ---------------------------------------------------------------------------

export const metadata: Metadata = {
  // `absolute` court-circuite le `template: '%s | OPATAM'` du layout racine.
  // Sans ça le titre servi est « … — Opatam | OPATAM » : la marque deux fois,
  // et 70 caractères que Google tronque dans ses résultats.
  title: {
    absolute: "Logiciel de réservation pour studio d'enregistrement — Opatam",
  },
  description:
    "Le logiciel de réservation pensé pour les studios d'enregistrement. Un agenda par salle, acomptes à la réservation, 0 % de commission. Jusqu'à 10 agendas synchronisés. Essai gratuit 30 jours.",
  alternates: { canonical: 'https://opatam.com/studio-enregistrement' },
  openGraph: {
    title: "Logiciel de réservation pour studio d'enregistrement — Opatam",
    description:
      "Un agenda par salle, des acomptes encaissés à la réservation, zéro commission. Le logiciel de planning pensé pour les studios d'enregistrement.",
    url: 'https://opatam.com/studio-enregistrement',
    type: 'website',
    // Pas de `images` ici : `opengraph-image.tsx` du même dossier est
    // découvert par Next et gagne. Le déclarer à la main réinstallerait le
    // logo générique, qui ne dit rien de la page.
  },
};

// Trois douleurs, écrites comme des scènes plutôt que comme des tirets de
// fonctionnalités. Chacune se termine sur son coût réel — en euros, en
// heures ou en séance perdue.
const painPoints = [
  {
    label: '01',
    title: 'La disponibilité se négocie en quinze messages',
    body:
      "Un artiste écrit sur Instagram, un autre par mail, un troisième appelle. Chacun demande « vous avez quoi la semaine prochaine ? ». Vous ouvrez l'agenda, vous répondez, il ne rappelle pas, le créneau reste vide. Vous passez vos soirées à faire du secrétariat au lieu de mixer.",
  },
  {
    label: '02',
    title: "Une session annulée le matin même, c'est la journée perdue",
    body:
      "Quatre heures de studio réservées, un ingénieur du son planifié, du matériel patché la veille. L'artiste ne vient pas. Le créneau ne se revend pas à midi pour l'après-midi : personne ne prépare une session en deux heures. Vous encaissez zéro et vous payez quand même.",
  },
  {
    label: '03',
    title: 'Deux salles, un seul agenda, une collision par mois',
    body:
      "La cabine voix est prise par le Studio A pendant que le Studio B croyait l'avoir. Vous vous en apercevez le jour même, devant deux groupes. Un agenda partagé ne suffit pas quand chaque espace se réserve indépendamment.",
  },
];

// Quatre moments de la vie d'un studio, chacun rattaché à une capacité
// réelle du produit. Formulation au présent, verbe en tête.
const moments = [
  {
    when: 'À 2 h du matin',
    title: "L'artiste réserve. Vous dormez.",
    body:
      "Ce métier se décide la nuit. Votre lien de réservation vit dans votre bio Instagram, sur votre QR code à l'entrée, dans votre signature. L'artiste voit vos créneaux réels, choisit son samedi de 14 h à 18 h et confirme — sans compte à créer, sans attendre votre réponse.",
  },
  {
    when: 'À la réservation',
    title: "L'acompte est encaissé avant que la session existe.",
    body:
      "Avec l'option Sérénité, vous demandez un acompte au moment de la réservation. L'artiste paie par carte depuis votre lien. S'il ne vient pas, l'acompte vous reste — selon le délai d'annulation que vous avez fixé. C'est le seul filtre qui distingue une intention d'une réservation.",
  },
  {
    when: 'En session',
    title: 'Chaque salle a son agenda. Elles ne se marchent plus dessus.',
    body:
      "Studio A, Studio B, cabine voix, salle de répétition : un agenda par espace, ses propres horaires, ses propres prestations. Le plan Studio en synchronise jusqu'à dix. Une réservation en cabine voix ne bloque plus le Studio A.",
  },
  {
    when: 'La veille',
    title: 'Le rappel part sans vous.',
    body:
      "Confirmation immédiate, rappel automatique 24 h avant, dernier rappel 2 h avant. Vous ne relancez plus personne la veille au soir, et l'artiste n'a plus d'excuse pour avoir oublié.",
  },
];

// Ce qu'Opatam fait / ne fait pas. Cette section existe parce que le métier
// est déjà outillé (Studiotime, Bandcamp, des tableurs très élaborés) : un
// gérant de studio repère une promesse creuse en trente secondes.
const scope = {
  does: [
    "Un agenda par salle, jusqu'à dix salles synchronisées",
    "Des sessions de 30 minutes à 24 heures, au tarif que vous fixez",
    'Des acomptes encaissés par carte à la réservation',
    "Vos horaires d'ouverture par salle, et vos fermetures",
    'Rappels automatiques par e-mail et notification',
    "Jusqu'à 10 adresses si vous avez plusieurs sites",
    'Une page publique avec vos salles, vos tarifs, vos photos',
    '0 % de commission sur ce que vous encaissez',
  ],
  doesNot: [
    "Réserver une salle ET un ingénieur du son en une seule ligne",
    'Éditer des devis ou des factures',
    'Gérer un inventaire de matériel ou des cautions',
    'Vendre du temps studio en abonnement mensuel',
  ],
};

// FAQ — les objections réellement formulées par des gérants de studio.
// Alimente aussi le JSON-LD FAQPage plus bas : garder les deux en phase,
// Google pénalise l'écart entre le visible et le structuré.
const faqItems = [
  {
    q: "Comment gérer plusieurs salles avec des tarifs différents ?",
    a: "Chaque salle devient un agenda avec ses propres prestations et ses propres prix : « Studio A — 4 h » à 180 €, « Cabine voix — 2 h » à 70 €, « Journée complète » à 320 €. L'artiste choisit d'abord la salle, puis le créneau. Les agendas sont indépendants, donc deux réservations simultanées dans deux salles ne posent aucun problème.",
  },
  {
    q: "Est-ce que je peux demander un acompte sur une session ?",
    a: "Oui, avec l'option Sérénité. Vous fixez un acompte en pourcentage ou en montant fixe, par prestation. L'artiste paie par carte au moment de réserver et reçoit son reçu. S'il annule hors du délai que vous avez fixé, ou s'il ne vient pas, vous conservez l'acompte ; à l'intérieur du délai, il est remboursé. C'est votre politique d'annulation qui tranche, pas nous. Le reste se règle sur place, comme d'habitude.",
  },
  {
    q: "Une session de huit heures, c'est possible ?",
    a: "Oui. Une prestation peut durer jusqu'à 24 heures, ce qui couvre la journée complète comme la résidence sur deux jours découpée en deux réservations. Vous pouvez aussi proposer la même salle en formats multiples — 2 h, 4 h, journée — avec un tarif propre à chacun.",
  },
  {
    q: "Mes clients doivent-ils créer un compte pour réserver ?",
    a: "Non. La réservation se fait avec un nom, un e-mail et un téléphone. Le compte est facultatif — il sert à retrouver ses réservations passées et à profiter de la carte de fidélité si vous en activez une.",
  },
  {
    q: "Quelle différence entre le plan Pro et le plan Studio ?",
    a: "Le plan Pro à 19,90 €/mois gère un seul agenda : c'est le bon choix si vous avez une seule salle. Le plan Studio à 29,90 €/mois synchronise jusqu'à dix agendas et jusqu'à dix adresses, avec l'assignation des prestations par salle et une page publique d'équipe. Dès deux espaces réservables, c'est le plan Studio.",
  },
  {
    q: "Est-ce qu'Opatam prend une commission sur mes sessions ?",
    a: "Non, jamais. Vous payez un abonnement fixe et vous gardez 100 % de ce que vous facturez, que vous fassiez cinq sessions ou cinquante dans le mois. Les acomptes encaissés par carte passent par Stripe, avec les frais bancaires habituels et rien de plus de notre part.",
  },
  {
    q: "Je travaille aussi en déplacement, chez les artistes. Ça marche ?",
    a: "Oui. Configurez plusieurs adresses — jusqu'à dix — et rattachez chaque salle ou chaque prestation à son lieu. Vos horaires peuvent différer d'une adresse à l'autre, et tout se pilote depuis l'application mobile entre deux prises.",
  },
];

export default async function StudioEnregistrementPage() {
  // Tutoriels — même source que l'accueil. Tolérant : une liste vide
  // masque la section au lieu de casser la page.
  const tutorialDocs = await articleRepository
    .getPublishedByCategory('tutoriels', 3)
    .catch((err) => {
      console.error('[studio-enregistrement] tutorials fetch failed:', err);
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
    name: "Opatam — logiciel de réservation pour studio d'enregistrement",
    applicationCategory: 'BusinessApplication',
    operatingSystem: 'Web, iOS, Android',
    audience: {
      '@type': 'Audience',
      audienceType: "Studios d'enregistrement et de production musicale",
    },
    offers: { '@type': 'Offer', price: '29.90', priceCurrency: 'EUR' },
  };

  return (
    <>
      {/* La navigation par défaut pointe vers les ancres de l'accueil
          (/#tarifs, /#faq…) : depuis une verticale, chaque clic ferait
          SORTIR le visiteur du parcours qu'on vient de construire. Elle
          vise donc les sections de cette page. Et le sélecteur de langue
          disparaît : cette page n'existe qu'en français, proposer « EN »
          renverrait vers un accueil traduit sans rapport. */}
      <Header
        showLanguageSwitcher={false}
        navLinks={[
          { href: '#salles', label: 'Les salles' },
          { href: '#demo', label: 'La démo' },
          { href: '#tarif', label: 'Tarif' },
          { href: '#faq', label: 'Questions' },
        ]}
      />
      <main className="bg-[#0B0B0D] text-[#F4F2EE]">
        {/* ─── HERO ────────────────────────────────────────────────────
            Colonnes 7/5 comme sur /nail-artist, pour la même raison : un
            50/50 sent le gabarit. Le H1 porte la requête mot pour mot. */}
        <section className="border-b border-white/10">
          <div className="mx-auto max-w-7xl xl:max-w-[96rem] px-6 sm:px-8 lg:px-12 pt-14 pb-16 sm:pt-20 sm:pb-24 lg:pt-24 lg:pb-28">
            <div className="grid lg:grid-cols-12 gap-10 lg:gap-16 items-center">
              <div className="lg:col-span-7">
                <p className="text-xs sm:text-sm font-medium uppercase tracking-[0.18em] text-primary-400 mb-7">
                  Pour les studios d&apos;enregistrement
                </p>
                <h1 className="text-4xl sm:text-5xl lg:text-6xl font-semibold leading-[1.05] tracking-tight">
                  Le logiciel de réservation
                  <br />
                  pour studio d&apos;enregistrement.
                </h1>
                <p className="mt-7 text-lg sm:text-xl leading-relaxed text-zinc-400 max-w-2xl">
                  Un agenda par salle. Des acomptes encaissés avant la session.
                  Zéro commission sur ce que vous facturez. Vos artistes réservent
                  seuls, vous retournez derrière la console.
                </p>

                <div className="mt-10 flex flex-col sm:flex-row gap-4">
                  <Link
                    href="/register"
                    className="inline-flex items-center justify-center gap-2 rounded-full bg-primary-600 px-8 py-4 text-base font-semibold text-white transition hover:bg-primary-500"
                  >
                    Essayer 30 jours gratuitement
                    <ArrowRight className="h-4 w-4" />
                  </Link>
                  <StudioDemoButton className="inline-flex items-center justify-center gap-2 rounded-full border border-white/20 px-8 py-4 text-base font-semibold text-[#F4F2EE] transition hover:border-white/40 hover:bg-white/5">
                    Voir la réservation côté artiste
                  </StudioDemoButton>
                </div>

                <p className="mt-6 text-sm text-zinc-500">
                  Sans carte bancaire · sans engagement · prêt en 10 minutes
                </p>
              </div>

              {/* Maquette d'agenda : trois salles en parallèle. C'est
                  l'illustration littérale de l'argument, donc elle vaut
                  mieux qu'une photo d'illustration. */}
              <div className="lg:col-span-5">
                <div className="rounded-xl border border-white/10 bg-[#111114] p-5 sm:p-6">
                  <div className="flex items-baseline justify-between mb-5">
                    <span className="text-sm font-semibold">Samedi 14 mars</span>
                    <span className="text-xs text-zinc-500">3 salles</span>
                  </div>
                  <div className="grid grid-cols-3 gap-3">
                    {[
                      { room: 'Studio A', slots: ['10—14', '15—19', null] },
                      { room: 'Studio B', slots: [null, '14—18', '19—23'] },
                      { room: 'Cabine voix', slots: ['11—13', null, '18—20'] },
                    ].map((col) => (
                      <div key={col.room}>
                        <p className="text-[11px] uppercase tracking-wider text-zinc-500 mb-2 truncate">
                          {col.room}
                        </p>
                        <div className="space-y-2">
                          {col.slots.map((slot, i) =>
                            slot ? (
                              <div
                                key={i}
                                className="rounded-lg bg-primary-600 px-2 py-3 text-center text-[11px] font-semibold text-white"
                              >
                                {slot}
                              </div>
                            ) : (
                              <div
                                key={i}
                                className="rounded-lg border border-dashed border-white/15 px-2 py-3 text-center text-[11px] text-zinc-600"
                              >
                                libre
                              </div>
                            ),
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                  <p className="mt-5 text-xs leading-relaxed text-zinc-500">
                    Trois espaces, trois agendas indépendants. Une réservation en
                    cabine voix ne bloque plus le Studio A.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ─── DOULEURS ───────────────────────────────────────────── */}
        <section className="border-b border-white/10 bg-[#111114]">
          <div className="mx-auto max-w-7xl px-6 sm:px-8 lg:px-12 py-20 sm:py-24">
            <h2 className="text-3xl sm:text-4xl lg:text-5xl font-semibold leading-tight tracking-tight max-w-3xl">
              Ce qui vous coûte de l&apos;argent
              <br />
              n&apos;est pas ce que vous croyez.
            </h2>
            <div className="mt-14 grid md:grid-cols-3 gap-10 lg:gap-14">
              {painPoints.map((point) => (
                <div key={point.label}>
                  <span className="text-sm font-mono text-primary-400">{point.label}</span>
                  <h3 className="mt-4 text-xl font-semibold leading-snug">{point.title}</h3>
                  <p className="mt-3 text-[15px] leading-relaxed text-zinc-400">{point.body}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ─── MOMENTS ────────────────────────────────────────────── */}
        <section className="border-b border-white/10">
          <div className="mx-auto max-w-7xl px-6 sm:px-8 lg:px-12 py-20 sm:py-24">
            <h2 className="text-3xl sm:text-4xl lg:text-5xl font-semibold leading-tight tracking-tight max-w-3xl">
              Une journée de studio,
              <br />
              sans le secrétariat.
            </h2>
            <div className="mt-14 grid md:grid-cols-2 gap-x-12 gap-y-14">
              {moments.map((moment) => (
                <div key={moment.when} className="border-t border-white/10 pt-7">
                  <span className="text-xs uppercase tracking-[0.16em] text-primary-400">
                    {moment.when}
                  </span>
                  <h3 className="mt-3 text-2xl font-semibold leading-snug">{moment.title}</h3>
                  <p className="mt-3 text-[15px] leading-relaxed text-zinc-400">{moment.body}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ─── VOTRE STUDIO DANS OPATAM ───────────────────────────────
            Répond à la seule question que se pose un gérant : à quoi
            ressemblera MA page, et comment mes artistes réserveront-ils ?
            La règle d'accès est écrite noir sur blanc — c'est ici qu'on
            évite de laisser croire qu'Opatam affecte un ingénieur. */}
        <section className="border-b border-white/10" id="salles">
          <div className="mx-auto max-w-7xl px-6 sm:px-8 lg:px-12 py-20 sm:py-24">
            <h2 className="text-3xl sm:text-4xl lg:text-5xl font-semibold leading-tight tracking-tight max-w-3xl">
              Votre studio,
              <br />
              tel que vos artistes le verront.
            </h2>
            <p className="mt-6 text-lg leading-relaxed text-zinc-400 max-w-2xl">
              Voici Studio Harmonie, notre studio de démonstration : trois espaces
              réservables, deux ingénieurs du son, et une règle d&apos;accès claire.
            </p>

            <div className="mt-14 grid lg:grid-cols-3 gap-6">
              {[
                {
                  name: 'Studio A — grande salle',
                  detail: 'Régie séparée, console analogique, cabine attenante',
                  formats: '4 h — 180 € · journée — 320 €',
                },
                {
                  name: 'Studio B — salle de prise',
                  detail: 'Formats légers : voix, guitare, podcast à deux micros',
                  formats: '4 h — 140 €',
                },
                {
                  name: 'Cabine voix',
                  detail: 'Cabine traitée, micro à condensateur, retour casque',
                  formats: '2 h — 70 €',
                },
              ].map((room) => (
                <div key={room.name} className="rounded-xl border border-white/10 bg-[#111114] p-6">
                  <h3 className="text-lg font-semibold">{room.name}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-zinc-400">{room.detail}</p>
                  <p className="mt-4 text-sm font-medium text-primary-400">{room.formats}</p>
                  <p className="mt-4 text-xs uppercase tracking-wider text-zinc-600">
                    Agenda indépendant
                  </p>
                </div>
              ))}
            </div>

            <div className="mt-8 grid md:grid-cols-2 gap-6">
              <div className="rounded-xl border border-white/10 p-6">
                <h3 className="text-sm uppercase tracking-[0.16em] text-primary-400">
                  L&apos;équipe
                </h3>
                <p className="mt-4 text-[15px] leading-relaxed text-zinc-300">
                  Naïm et Clara, ingénieurs du son. Ils apparaissent sur la page
                  publique du studio, avec leurs spécialités — mais ils ne sont pas
                  des agendas réservables.
                </p>
              </div>
              <div className="rounded-xl border border-white/10 p-6">
                <h3 className="text-sm uppercase tracking-[0.16em] text-zinc-500">
                  La règle d&apos;accès
                </h3>
                <p className="mt-4 text-[15px] leading-relaxed text-zinc-400">
                  L&apos;artiste réserve <strong className="text-zinc-200">un espace</strong>,
                  pas une personne. Le studio affecte ensuite l&apos;ingénieur selon la
                  salle et l&apos;horaire, et le confirme par e-mail. Opatam ne réserve
                  pas les deux en une seule ligne — mieux vaut le dire que le
                  laisser découvrir.
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* ─── DÉMO EN DIRECT ─────────────────────────────────────── */}
        <section className="border-b border-white/10 bg-[#111114]" id="demo">
          <div className="mx-auto max-w-7xl px-6 sm:px-8 lg:px-12 py-20 sm:py-24">
            <div className="grid lg:grid-cols-2 gap-12 items-center">
              <div>
                <h2 className="text-3xl sm:text-4xl lg:text-5xl font-semibold leading-tight tracking-tight">
                  Essayez-le
                  <br />
                  comme un artiste.
                </h2>
                <p className="mt-6 text-lg leading-relaxed text-zinc-400">
                  Studio Harmonie est un studio de démonstration, avec ses salles,
                  ses formats et ses tarifs. Réservez-y une session : vous verrez
                  exactement ce que vos clients verront, jusqu&apos;à l&apos;e-mail de
                  confirmation.
                </p>
                <StudioDemoButton className="mt-9 inline-flex items-center justify-center gap-2 rounded-full bg-[#F4F2EE] px-8 py-4 text-base font-semibold text-[#0B0B0D] transition hover:bg-white">
                  Voir la réservation côté artiste
                  <ArrowRight className="h-4 w-4" />
                </StudioDemoButton>
              </div>

              <div className="rounded-xl border border-white/10 bg-[#0B0B0D] p-6 sm:p-8">
                <p className="text-xs uppercase tracking-[0.16em] text-zinc-500">
                  Studio Harmonie · Lyon 7ᵉ
                </p>
                <div className="mt-5 space-y-3">
                  {[
                    ['Studio A — session 4 h', '4 h', '180 €'],
                    ['Studio A — journée complète', '8 h', '320 €'],
                    ['Cabine voix — session 2 h', '2 h', '70 €'],
                    ['Mixage — par titre', '3 h', '150 €'],
                  ].map(([name, dur, price]) => (
                    <div
                      key={name}
                      className="flex items-center justify-between gap-4 border-b border-white/5 pb-3 last:border-0"
                    >
                      <span className="text-sm">
                        <span className="font-medium">{name}</span>
                        <br />
                        <span className="text-zinc-500">{dur}</span>
                      </span>
                      <span className="font-semibold whitespace-nowrap">{price}</span>
                    </div>
                  ))}
                </div>
                <p className="mt-5 text-xs text-zinc-500">
                  Acompte de 30 % demandé à la réservation.
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* ─── PÉRIMÈTRE ──────────────────────────────────────────────
            Dire ce que le produit ne fait pas est un argument de vente sur
            un métier déjà outillé : ça signale qu'on connaît le sujet. */}
        <section className="border-b border-white/10">
          <div className="mx-auto max-w-7xl px-6 sm:px-8 lg:px-12 py-20 sm:py-24">
            <h2 className="text-3xl sm:text-4xl lg:text-5xl font-semibold leading-tight tracking-tight max-w-3xl">
              Ce qu&apos;Opatam fait,
              <br />
              et ce qu&apos;il ne fait pas.
            </h2>
            <div className="mt-14 grid md:grid-cols-2 gap-10 lg:gap-16">
              <div>
                <h3 className="text-sm uppercase tracking-[0.16em] text-primary-400 mb-6">
                  Inclus
                </h3>
                <ul className="space-y-4">
                  {scope.does.map((item) => (
                    <li key={item} className="flex gap-3 text-[15px] leading-relaxed">
                      <Check className="h-5 w-5 shrink-0 text-primary-400" />
                      {item}
                    </li>
                  ))}
                </ul>
              </div>
              <div>
                <h3 className="text-sm uppercase tracking-[0.16em] text-zinc-500 mb-6">
                  Pas au programme
                </h3>
                <ul className="space-y-4">
                  {scope.doesNot.map((item) => (
                    <li
                      key={item}
                      className="flex gap-3 text-[15px] leading-relaxed text-zinc-500"
                    >
                      <Minus className="h-5 w-5 shrink-0" />
                      {item}
                    </li>
                  ))}
                </ul>
                <p className="mt-8 text-sm leading-relaxed text-zinc-500">
                  Si votre studio a besoin de devis et de facturation, gardez votre
                  outil comptable : Opatam s&apos;occupe du planning et de
                  l&apos;encaissement des acomptes, pas de votre comptabilité.
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* ─── TARIF ──────────────────────────────────────────────────
            Le plan Studio est mis en avant, parce que c'est celui qui
            correspond au métier dès deux espaces réservables. */}
        <section className="border-b border-white/10 bg-[#111114]" id="tarif">
          <div className="mx-auto max-w-7xl px-6 sm:px-8 lg:px-12 py-20 sm:py-24">
            <h2 className="text-3xl sm:text-4xl lg:text-5xl font-semibold leading-tight tracking-tight">
              Un abonnement fixe.
              <br />
              Jamais de commission.
            </h2>

            <div className="mt-14 grid md:grid-cols-2 gap-6 max-w-4xl">
              <div className="rounded-xl border border-white/10 p-8">
                <p className="text-sm uppercase tracking-[0.16em] text-zinc-500">Pro</p>
                <p className="mt-2 text-sm text-zinc-400">Une seule salle</p>
                <p className="mt-6 text-4xl font-semibold">
                  19,90 €<span className="text-lg font-normal text-zinc-500">/mois</span>
                </p>
                <p className="mt-2 text-sm text-zinc-500">ou 199 € par an</p>
                <ul className="mt-7 space-y-3 text-[15px]">
                  {[
                    'Un agenda, réservations illimitées',
                    'Votre page publique et votre QR code',
                    'Rappels automatiques',
                    '0 % de commission',
                  ].map((f) => (
                    <li key={f} className="flex gap-3">
                      <Check className="h-5 w-5 shrink-0 text-zinc-500" />
                      {f}
                    </li>
                  ))}
                </ul>
              </div>

              <div className="rounded-xl border border-primary-500 bg-primary-500/10 p-8 relative">
                <span className="absolute -top-3 left-8 rounded-full bg-primary-600 px-4 py-1 text-xs font-semibold text-white">
                  Le plan des studios
                </span>
                <p className="text-sm uppercase tracking-[0.16em] text-primary-400">Studio</p>
                <p className="mt-2 text-sm text-zinc-400">Dès deux espaces réservables</p>
                <p className="mt-6 text-4xl font-semibold">
                  29,90 €<span className="text-lg font-normal text-zinc-500">/mois</span>
                </p>
                <p className="mt-2 text-sm text-zinc-500">ou 299 € par an — deux mois offerts</p>
                <ul className="mt-7 space-y-3 text-[15px]">
                  {[
                    "Jusqu'à 10 agendas synchronisés",
                    'Prestations assignées par salle',
                    "Jusqu'à 10 adresses",
                    'Page publique regroupant vos salles',
                    'Tout le plan Pro inclus',
                  ].map((f) => (
                    <li key={f} className="flex gap-3">
                      <Check className="h-5 w-5 shrink-0 text-primary-400" />
                      {f}
                    </li>
                  ))}
                </ul>
                <Link
                  href="/register"
                  className="mt-8 inline-flex w-full items-center justify-center gap-2 rounded-full bg-primary-600 px-6 py-3.5 text-base font-semibold text-white transition hover:bg-primary-500"
                >
                  Commencer 30 jours gratuits
                </Link>
              </div>
            </div>

            <p className="mt-8 text-sm text-zinc-500 max-w-2xl">
              Les acomptes par carte demandent l&apos;option Sérénité, facturée à
              part. Les frais bancaires Stripe s&apos;appliquent sur les acomptes
              encaissés — Opatam ne prélève rien de plus.
            </p>
          </div>
        </section>

        {/* ─── FAQ ────────────────────────────────────────────────── */}
        <section className="border-b border-white/10" id="faq">
          <div className="mx-auto max-w-7xl px-6 sm:px-8 lg:px-12 py-20 sm:py-24">
            <h2 className="text-3xl sm:text-4xl lg:text-5xl font-semibold leading-tight tracking-tight">
              Les questions
              <br />
              qu&apos;on nous pose.
            </h2>
            <div className="mt-12 max-w-3xl divide-y divide-white/10">
              {faqItems.map((item) => (
                <details key={item.q} className="group py-6">
                  <summary className="flex cursor-pointer items-start justify-between gap-6 text-lg font-medium marker:content-none">
                    {item.q}
                    <span className="mt-1 shrink-0 text-primary-400 transition group-open:rotate-45">
                      +
                    </span>
                  </summary>
                  <p className="mt-4 text-[15px] leading-relaxed text-zinc-400">{item.a}</p>
                </details>
              ))}
            </div>
          </div>
        </section>

        {/* ─── TUTORIELS ──────────────────────────────────────────── */}
        {tutorials.length > 0 && (
          <section className="border-b border-white/10 bg-[#111114]">
            <div className="mx-auto max-w-7xl px-6 sm:px-8 lg:px-12 py-20 sm:py-24">
              <h2 className="text-3xl sm:text-4xl font-semibold leading-tight tracking-tight">
                Prendre en main, en quelques minutes.
              </h2>
              <div className="mt-10">
                <TutorialsCarousel tutorials={tutorials} />
              </div>
            </div>
          </section>
        )}

        {/* ─── CTA FINAL ──────────────────────────────────────────── */}
        <section>
          <div className="mx-auto max-w-7xl px-6 sm:px-8 lg:px-12 py-20 sm:py-28 text-center">
            <h2 className="text-3xl sm:text-4xl lg:text-5xl font-semibold leading-tight tracking-tight">
              Votre agenda se remplit.
              <br />
              Vous restez derrière la console.
            </h2>
            <p className="mt-6 text-lg text-zinc-400 max-w-2xl mx-auto">
              Trente jours pour tester, sans carte bancaire. Si ça ne vous
              convient pas, vous n&apos;avez rien avancé.
            </p>
            <Link
              href="/register"
              className="mt-10 inline-flex items-center justify-center gap-2 rounded-full bg-primary-600 px-9 py-4 text-base font-semibold text-white transition hover:bg-primary-500"
            >
              Créer la page de mon studio
              <ArrowRight className="h-4 w-4" />
            </Link>
            <div className="mt-12 flex justify-center">
              <AppStoreBadges />
            </div>
          </div>
        </section>
      </main>
      <Footer />

      {/* embed.js expose `window.Opatam.open(slug)`, qu'appelle
          StudioDemoButton. Chargé après hydratation : il ne dispute jamais
          sa bande passante au premier rendu. */}
      <Script src="/embed.js" strategy="afterInteractive" />

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
