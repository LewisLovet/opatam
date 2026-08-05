'use client';

import Link from 'next/link';
import Image from 'next/image';
import type { ArticleCardData } from '@/app/blog/components/ArticleCard';
import { YouTubeThumbnail } from '@/app/blog/components/YouTubeThumbnail';
import s from './v2.module.css';
import { HeroV2 } from './HeroV2';
import { VideoTestimonials, type VideoTestimonial } from './VideoTestimonials';
import { useEffect, useMemo, useState } from 'react';
import { useReveal, useCountUp } from './useReveal';

const TRADES = [
  'Coiffeuses',
  'Barbiers',
  'Nail artists',
  'Esthéticiennes',
  'Coachs sportifs',
  'Tatoueurs',
  'Masseurs',
  'Ostéopathes',
  'Photographes',
  'Sophrologues',
  'Thérapeutes',
  'Artisans',
];

/**
 * Témoignages d'EXEMPLE.
 *
 * Volontairement en dur, et volontairement identiques : la vidéo réutilise
 * un fichier déjà présent dans /public et l'affiche a été extraite de sa
 * première seconde. Trois cartes plutôt qu'une pour juger la GRILLE, pas le
 * contenu — d'où les noms « Exemple ». Ces données partiront dans un document
 * Firestore alimenté depuis l'admin, sur le modèle de `landingGalleries`.
 */
const DEMO_TESTIMONIALS: VideoTestimonial[] = [
  {
    id: 'demo-1',
    src: '/hero-mobile.mp4',
    poster: '/v2/temoignage-demo.jpg',
    quote: "J'ai eu trois réservations le soir même de mon inscription.",
    name: 'Exemple 1',
    role: 'à remplacer',
  },
  {
    id: 'demo-2',
    src: '/hero-mobile.mp4',
    poster: '/v2/temoignage-demo.jpg',
    quote: 'Je ne réponds plus aux DM à 22 h pour caler un rendez-vous.',
    name: 'Exemple 2',
    role: 'à remplacer',
  },
  {
    id: 'demo-3',
    src: '/hero-mobile.mp4',
    poster: '/v2/temoignage-demo.jpg',
    quote: 'Les rappels automatiques ont fait disparaître mes rendez-vous manqués.',
    name: 'Exemple 3',
    role: 'à remplacer',
  },
];

export function LandingV2({ tutorials }: { tutorials: ArticleCardData[] }) {
  return (
    <div className={s.root}>
      <Nav />
      <HeroV2 />
      <Marquee />
      <WhatChanges />
      <StorySection />
      <Stats />
      <VideoTestimonials items={DEMO_TESTIMONIALS} />
      <Tutorials tutorials={tutorials} />
      <Pricing />
      <FinalCta />
      <Footer />
    </div>
  );
}

/* ── Navigation ──────────────────────────────────────────────────── */

function Nav() {
  return (
    <nav className={s.nav}>
      <div className={`${s.wrap} ${s.navInner}`}>
        <Link href="/v2" className={s.navBrand}>
          <Image src="/logo-opatam.png" alt="" width={30} height={30} />
          OPATAM
        </Link>
        <div className={s.navLinks}>
          <a href="#change">Fonctionnalités</a>
          <a href="#tutoriels">Tutoriels</a>
          <a href="#tarif">Tarif</a>
          <Link href="/login">Se connecter</Link>
        </div>
        <Link href="/register" className={`${s.btn} ${s.btnPrimary}`} style={{ padding: '12px 22px' }}>
          Créer ma page
        </Link>
      </div>
    </nav>
  );
}

/* ── Bandeau des métiers ─────────────────────────────────────────── */

function Marquee() {
  return (
    <div className={s.marquee} aria-hidden="true">
      {/* La liste est dupliquée : l'animation translate la piste de -50 %,
          la seconde copie prend exactement la place de la première et la
          boucle ne se voit pas. */}
      <div className={s.marqueeTrack}>
        {[...TRADES, ...TRADES].map((trade, i) => (
          <span key={`${trade}-${i}`}>{trade}</span>
        ))}
      </div>
    </div>
  );
}

/* ── Ce que ça change ────────────────────────────────────────────── */

function WhatChanges() {
  const head = useReveal<HTMLDivElement>();

  return (
    <section className={s.sec} id="change">
      <div className={s.wrap}>
        <div ref={head.ref} className={`${s.reveal} ${head.shown ? s.revealed : ''}`}>
          <span className={s.eyebrow}>Ce que ça change</span>
          <h2 className={s.secTitle}>
            Moins d&apos;administratif.
            <br />
            Plus de rendez-vous.
          </h2>
        </div>

        <Feature
          title="Votre agenda se remplit tout seul"
          text="Même à 23 h, même le dimanche. Au réveil, votre planning est prêt."
          mock={(active) => <AgendaMock active={active} />}
        />

        <Feature
          flip
          title="Les rappels partent sans vous"
          text="24 h et 2 h avant chaque rendez-vous. Fini les SMS de relance à 22 h."
          mock={<RemindersMock />}
        />

        <Feature
          title="Toute l'équipe synchronisée"
          text="Chaque membre a son agenda et ses prestations. Vous gardez la vue d'ensemble."
          mock={<TeamMock />}
        />
      </div>
    </section>
  );
}

/**
 * Une maquette dont le CONTENU se construit à l'entrée dans le viewport.
 * `playing` est posé une fois révélé : c'est lui qui déclenche les
 * animations internes décrites dans le module CSS.
 */
function Feature({
  title,
  text,
  mock,
  flip = false,
}: {
  title: string;
  text: string;
  /** Maquette de droite. Sous forme de fonction quand elle anime en
   *  boucle : elle reçoit alors sa visibilité, pour ne rien jouer hors
   *  du champ. */
  mock: React.ReactNode | ((active: boolean) => React.ReactNode);
  flip?: boolean;
}) {
  const { ref, shown } = useReveal<HTMLDivElement>();
  return (
    <div
      ref={ref}
      className={`${s.feature} ${flip ? s.featureFlip : ''} ${s.reveal} ${shown ? s.revealed : ''}`}
    >
      <div>
        <h3 className={s.featureTitle}>{title}</h3>
        <p className={s.featureText}>{text}</p>
      </div>
      <div className={shown ? s.playing : undefined}>
        {typeof mock === 'function' ? mock(shown) : mock}
      </div>
    </div>
  );
}

/* ── L'agenda qui se remplit ──────────────────────────────────────── */

const WEEK_DAYS = ['LUN', 'MAR', 'MER', 'JEU', 'VEN'];
const WEEK_HOURS = ['9:00', '10:30', '12:00', '14:00', '15:30', '17:00'];

/**
 * Ordre dans lequel les créneaux se réservent. Il est écrit à la main, et
 * volontairement dispersé : un remplissage colonne par colonne ressemblerait
 * à une barre de chargement, alors que des réservations tombent là où elles
 * tombent. L'index vaut `jour * 6 + rang horaire`.
 */
const FILL_ORDER = [
  8, 21, 3, 14, 27, 1, 19, 10, 25, 6, 16, 29, 4, 12, 22, 0, 17, 9, 26, 13,
];

/**
 * Anime un remplissage progressif, en boucle.
 *
 * Le compteur vit dans une variable locale à l'effet plutôt que dans une
 * mise à jour fonctionnelle du state : React exécute deux fois les
 * `updater` en développement, ce qui armerait deux minuteries et ferait
 * accélérer l'animation à chaque passage.
 */
function useFillLoop(count: number, active: boolean) {
  const [filled, setFilled] = useState(0);

  useEffect(() => {
    if (!active) return;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      setFilled(count);
      return;
    }

    let n = 0;
    let id: ReturnType<typeof setTimeout>;
    const tick = () => {
      n = n >= count ? 0 : n + 1;
      setFilled(n);
      // Une pause quand la semaine est pleine — c'est le moment où l'œil
      // lit le résultat —, une autre après la remise à zéro.
      id = setTimeout(tick, n === count ? 2600 : n === 0 ? 900 : 230);
    };
    id = setTimeout(tick, 350);

    // Rien à animer sur un onglet qu'on ne regarde pas.
    const onVisibility = () => {
      clearTimeout(id);
      if (!document.hidden) id = setTimeout(tick, 400);
    };
    document.addEventListener('visibilitychange', onVisibility);
    return () => {
      clearTimeout(id);
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, [active, count]);

  return filled;
}

/** Une semaine d'agenda dont les créneaux se réservent sous les yeux. */
function AgendaMock({ active }: { active: boolean }) {
  const filled = useFillLoop(FILL_ORDER.length, active);
  // Un Set plutôt qu'un `includes` par cellule : 30 cellules × 20 étapes
  // feraient 600 parcours de tableau à chaque battement.
  const taken = useMemo(() => new Set(FILL_ORDER.slice(0, filled)), [filled]);
  const last = filled > 0 ? FILL_ORDER[filled - 1] : -1;

  return (
    <div className={s.card}>
      <div className={s.weekHead}>
        <strong style={{ fontSize: 15 }}>Semaine du 28 juillet</strong>
        <span className={s.weekCount}>
          <b>{filled}</b> rendez-vous
        </span>
      </div>

      <div className={s.dayBar}>
        <span
          className={s.weekBarFill}
          style={{ width: `${(filled / FILL_ORDER.length) * 100}%` }}
        />
      </div>

      <div className={s.week} aria-hidden="true">
        <div className={s.weekHours}>
          <span className={s.weekDay} />
          {WEEK_HOURS.map((h) => (
            <span key={h} className={s.weekHour}>
              {h}
            </span>
          ))}
        </div>

        {WEEK_DAYS.map((day, col) => (
          <div key={day} className={s.weekCol}>
            <span className={s.weekDay}>{day}</span>
            {WEEK_HOURS.map((h, row) => {
              const idx = col * WEEK_HOURS.length + row;
              return (
                <span
                  key={h}
                  className={`${s.cell} ${taken.has(idx) ? s.cellOn : ''} ${
                    idx === last ? s.cellNew : ''
                  }`}
                />
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
}

function RemindersMock() {
  const items = [
    ['Rappel envoyé à Manon', 'Pose gel demain à 14:30 — automatiquement'],
    ['Rappel envoyé à Jade', 'Remplissage dans 2 h — dernier rappel'],
    ['Léa a confirmé', 'Aucun rendez-vous manqué cette semaine'],
  ];
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      {items.map(([title, sub], i) => (
        <span
          key={title}
          className={`${s.pill} ${s.fillItem}`}
          /* Pas de décalage décoratif sur la deuxième : sur un écran de
             375 px il mangeait la largeur et faisait passer le texte à la
             ligne, ce qui se lisait comme un défaut d'alignement. */
          style={{ ['--i' as string]: i }}
        >
          <span className={s.dot} />
          <span>
            <strong>{title}</strong>
            <br />
            <span style={{ color: '#68738d' }}>{sub}</span>
          </span>
        </span>
      ))}
    </div>
  );
}

function TeamMock() {
  const members = [
    ['MD', 'Marie D. — coiffeuse', '6 RDV aujourd’hui'],
    ['JK', 'Julie K. — coloriste', '4 RDV aujourd’hui'],
    ['TR', 'Thomas R. — barbier', '5 RDV aujourd’hui'],
  ];
  return (
    <div className={s.card}>
      {members.map(([initials, who, count], i) => (
        <div
          key={initials}
          className={`${s.agendaRow} ${s.fillItem}`}
          style={{ ['--i' as string]: i }}
        >
          <span
            className={s.avatar}
            style={{ width: 36, height: 36, fontSize: 13, background: '#233D85', color: '#fff' }}
          >
            {initials}
          </span>
          <span>
            <strong>{who}</strong>
            <br />
            <span style={{ color: '#68738d', fontSize: 13 }}>{count}</span>
          </span>
        </div>
      ))}
    </div>
  );
}

/** Petit compteur inline, pour le nombre de rendez-vous de la journée. */
function CountUpInline({ to }: { to: number }) {
  const { ref, value } = useCountUp(to, 900);
  return <span ref={ref}>{value}</span>;
}

/* ── Story Instagram ─────────────────────────────────────────────── */

function StorySection() {
  const head = useReveal<HTMLDivElement>();
  const shots = useReveal<HTMLDivElement>();

  return (
    <section className={`${s.sec} ${s.secDark}`}>
      <div className={s.wrap}>
        <div ref={head.ref} className={`${s.reveal} ${head.shown ? s.revealed : ''}`}>
          <span className={s.eyebrow}>Instagram &amp; Snapchat</span>
          <h2 className={s.secTitle}>
            Une story.
            <br />
            Des créneaux remplis.
          </h2>
          <p className={s.secLead}>
            Un trou dans votre après-midi ? L&apos;application produit la story, avec
            vos disponibilités réelles et votre QR code. Vous n&apos;avez qu&apos;à la
            publier.
          </p>
        </div>

        <div className={s.storyGrid}>
          {/* Les VRAIES images générées par l'app, déjà présentes dans /public. */}
          <div
            ref={shots.ref}
            className={`${s.storyShots} ${s.revealScale} ${shots.shown ? s.revealed : ''}`}
          >
            <div className={`${s.storyShot} ${s.storyShotA}`}>
              <Image
                src="/instagram-story-jour.png"
                alt="Story générée avec les créneaux libres du jour"
                width={420}
                height={747}
                sizes="(min-width: 940px) 210px, 150px"
              />
            </div>
            <div className={`${s.storyShot} ${s.storyShotB}`}>
              <Image
                src="/instagram-story-semaine.png"
                alt="Story générée avec les créneaux libres de la semaine"
                width={420}
                height={747}
                sizes="(min-width: 940px) 210px, 150px"
              />
            </div>
          </div>

          <div className={s.stepsCol}>
            {[
              ['01', 'Un trou ce mardi à 14 h.'],
              ['02', 'Un geste — la story est générée avec vos dispos et votre QR code.'],
              ['03', 'Vos clientes scannent, elles réservent.'],
            ].map(([num, text]) => (
              <StepRow key={num} num={num} text={text} />
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

function StepRow({ num, text }: { num: string; text: string }) {
  const { ref, shown } = useReveal<HTMLDivElement>();
  return (
    <div ref={ref} className={`${s.stepRow} ${s.reveal} ${shown ? s.revealed : ''}`}>
      <span className={s.stepBadge}>{num}</span>
      <p className={s.stepText} style={{ margin: 0 }}>
        {text}
      </p>
    </div>
  );
}

/* ── Chiffres ────────────────────────────────────────────────────── */

function Stats() {
  return (
    <section className={`${s.sec} ${s.secPaper}`} style={{ padding: '80px 0' }}>
      <div className={`${s.wrap} ${s.stats}`}>
        <Stat to={0} suffix=" %" label="de commission, pour toujours" />
        <Stat to={24} suffix="/7" label="vos clients réservent seuls" />
        <Stat to={5} suffix=" min" label="entre l’inscription et votre page en ligne" />
        <Stat to={100} suffix=" %" label="de vos gains restent à vous" />
      </div>
    </section>
  );
}

function Stat({ to, suffix, label }: { to: number; suffix: string; label: string }) {
  const { ref, value } = useCountUp(to);
  return (
    <div ref={ref}>
      <div className={s.statValue}>
        {value}
        {suffix}
      </div>
      <p className={s.statLabel}>{label}</p>
    </div>
  );
}

/* ── Tutoriels ───────────────────────────────────────────────────── */

function Tutorials({ tutorials }: { tutorials: ArticleCardData[] }) {
  const { ref, shown } = useReveal<HTMLDivElement>();
  // Aucun tutoriel publié (ou Firestore indisponible) : la section
  // disparaît, comme sur l'accueil actuel. Jamais un bloc vide.
  if (tutorials.length === 0) return null;

  return (
    <section className={s.sec} id="tutoriels">
      <div className={s.wrap}>
        <div
          ref={ref}
          className={`${s.reveal} ${shown ? s.revealed : ''}`}
          style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', gap: 20, flexWrap: 'wrap' }}
        >
          <div>
            <span className={s.eyebrow}>Tutoriels</span>
            <h2 className={s.secTitle}>
              Prenez la main
              <br />
              en quelques minutes.
            </h2>
          </div>
          <Link href="/blog/categorie/tutoriels" style={{ color: '#233D85', fontWeight: 600, textDecoration: 'none' }}>
            Tous les tutoriels →
          </Link>
        </div>

        <p className={`${s.swipeHint} ${s.swipeHintDark}`}>
          <span aria-hidden="true">←→</span> Faites défiler
        </p>

        <div className={`${s.tutos} ${s.stagger}`}>
          {tutorials.map((t) => (
            <Link key={t.slug} href={`/blog/${t.slug}`} className={s.tuto}>
              <div className={s.tutoCover}>
                {/* Tes tutoriels n'ont PAS de couverture : seulement une URL
                    YouTube. Sans ce repli, les cartes étaient vides — c'est
                    exactement ce que tu voyais. `YouTubeThumbnail` tente la
                    vignette haute définition puis retombe sur la standard,
                    qui existe toujours. */}
                {t.videoCoverURL || t.coverImageURL ? (
                  <Image
                    src={(t.videoCoverURL || t.coverImageURL) as string}
                    alt=""
                    width={640}
                    height={360}
                    sizes="(min-width: 820px) 33vw, 100vw"
                  />
                ) : (
                  <YouTubeThumbnail
                    videoUrl={t.videoUrl}
                    sizes="(min-width: 820px) 33vw, 100vw"
                  />
                )}
                {t.videoUrl && (
                  <span className={s.tutoPlay}>
                    <svg width="16" height="18" viewBox="0 0 20 22" fill="#101B38" aria-hidden="true">
                      <path d="M19 9.27a2 2 0 0 1 0 3.46L3 21.99a2 2 0 0 1-3-1.73V1.74A2 2 0 0 1 3 .01l16 9.26Z" />
                    </svg>
                  </span>
                )}
                {t.videoUrl && <span className={s.tutoTag}>Vidéo</span>}
              </div>
              <div className={s.tutoBody}>
                <h3 className={s.tutoTitle}>{t.title}</h3>
                <p className={s.tutoText}>{t.excerpt}</p>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ── Tarif ───────────────────────────────────────────────────────── */

const PLANS = [
  {
    name: 'Pro',
    forWho: 'Pour les indépendants',
    price: '19,90 €',
    year: 'ou 199 € par an — deux mois offerts',
    featured: true,
    features: [
      'Réservations illimitées, 0 % de commission',
      'Votre vitrine en ligne + QR code',
      'Rappels automatiques 24 h et 2 h avant',
      'Carte de fidélité et promotions',
      'Application mobile, notifications en direct',
    ],
  },
  {
    name: 'Studio',
    forWho: 'Pour les équipes jusqu’à 10 personnes',
    price: '29,90 €',
    year: 'ou 299 € par an — deux mois offerts',
    featured: false,
    features: [
      'Tout le plan Pro, sans limite de membres',
      'Un agenda et des prestations par membre',
      'Jusqu’à 10 adresses',
      'Page publique d’équipe',
      'Vue d’ensemble sur toute l’activité',
    ],
  },
];

function Pricing() {
  const head = useReveal<HTMLDivElement>();
  const bars = useReveal<HTMLDivElement>();

  return (
    <section className={`${s.sec} ${s.secDark}`} id="tarif">
      <div className={s.wrap}>
        <div ref={head.ref} className={`${s.reveal} ${head.shown ? s.revealed : ''}`}>
          <span className={s.eyebrow}>Le tarif</span>
          <h2 className={s.secTitle}>
            Un prix fixe.
            <br />
            Zéro surprise.
          </h2>
          <p className={s.secLead}>
            Pas de commission, pas d&apos;option cachée, pas de palier au nombre de
            rendez-vous. Le prix que vous voyez est celui que vous payez.
          </p>
        </div>

        <div className={`${s.plans} ${s.stagger}`}>
          {PLANS.map((plan) => (
            <PlanCard key={plan.name} plan={plan} />
          ))}
        </div>

        {/*
          La comparaison chiffrée : sur 20 rendez-vous à 45 €, une plateforme à
          commission prélève 180 €. Les barres se remplissent à l'apparition —
          c'est l'écart entre les deux longueurs qui porte l'argument.
        */}
        <div ref={bars.ref} className={`${s.savings} ${s.reveal} ${bars.shown ? s.revealed : ''}`}>
          <div className={s.savingsBars}>
            <div className={s.bar}>
              <span className={s.barLabel}>Plateforme à 20 %</span>
              <span className={`${s.barValue} ${s.barValueThem}`}>180 € prélevés</span>
              <span className={s.barTrack}>
                <span
                  className={`${s.barFill} ${s.barFillThem}`}
                  style={{ width: bars.shown ? '100%' : 0 }}
                />
              </span>
            </div>
            <div className={s.bar}>
              <span className={s.barLabel}>Opatam</span>
              <span className={`${s.barValue} ${s.barValueUs}`}>19,90 €</span>
              <span className={s.barTrack}>
                <span
                  className={`${s.barFill} ${s.barFillUs}`}
                  style={{ width: bars.shown ? '22%' : 0, transitionDelay: '160ms' }}
                />
              </span>
            </div>
          </div>
          <p style={{ margin: 0, fontSize: 15, lineHeight: 1.6, color: 'rgba(255,255,255,.72)' }}>
            Sur <strong style={{ color: '#fff' }}>20 rendez-vous à 45 €</strong> dans le mois.
            Chez Opatam, le prix ne bouge pas — que vous en fassiez 20 ou 200.
          </p>
        </div>

        <div className={s.reassure}>
          {[
            '30 jours gratuits',
            'Sans carte bancaire',
            'Sans engagement',
            'Résiliable en un clic',
          ].map((item) => (
            <span key={item} className={s.reassureItem}>
              <span style={{ color: '#F4C928' }}>✓</span>
              {item}
            </span>
          ))}
        </div>
      </div>
    </section>
  );
}

function PlanCard({ plan }: { plan: (typeof PLANS)[number] }) {
  const { ref, shown } = useReveal<HTMLDivElement>();
  return (
    <div
      ref={ref}
      className={`${s.plan} ${plan.featured ? s.planFeatured : ''} ${s.revealScale} ${
        shown ? s.revealed : ''
      }`}
    >
      {plan.featured && <span className={s.planTag}>Le plus choisi</span>}
      <span className={s.planName}>{plan.name}</span>
      <span className={s.planFor}>{plan.forWho}</span>
      <div className={s.planPrice}>
        {plan.price}
        <span className={s.planPer}>/mois</span>
      </div>
      <p className={s.planYear}>{plan.year}</p>

      <ul className={s.priceList}>
        {plan.features.map((f) => (
          <li key={f}>
            <span className={s.check}>✓</span>
            {f}
          </li>
        ))}
      </ul>

      <div className={s.planFooter}>
        <Link href="/register" className={`${s.btn} ${s.btnPrimary}`} style={{ width: '100%' }}>
          Commencer 30 jours gratuits
        </Link>
      </div>
    </div>
  );
}

/* ── Final ───────────────────────────────────────────────────────── */

function FinalCta() {
  const { ref, shown } = useReveal<HTMLDivElement>();
  return (
    <section className={s.final}>
      <div className={s.wrap}>
        <div ref={ref} className={`${s.finalCard} ${s.revealScale} ${shown ? s.revealed : ''}`}>
          <span className={s.eyebrow} style={{ justifyContent: 'center' }}>
            Il est encore temps
          </span>
          <h2 className={s.finalTitle} style={{ marginTop: 16 }}>
            Reprenez votre soirée.
          </h2>
          <p
            className={s.secLead}
            style={{ margin: '18px auto 30px', color: 'rgba(255,255,255,.75)', maxWidth: 480 }}
          >
            Votre page de réservation est en ligne dans 5 minutes. Vos clientes
            réservent dès ce soir.
          </p>
          <div className={s.heroCtas} style={{ justifyContent: 'center' }}>
            <Link href="/register" className={`${s.btn} ${s.btnPrimary}`}>
              Créer ma page
            </Link>
            <Link href="/p/salon-de-coiffure" className={`${s.btn} ${s.btnGhost}`}>
              Voir une démo →
            </Link>
          </div>
          <p style={{ margin: '20px 0 0', fontSize: 14, color: 'rgba(255,255,255,.5)' }}>
            30 jours gratuits · sans carte bancaire · sans engagement
          </p>
        </div>
      </div>
    </section>
  );
}

function Footer() {
  return (
    <footer className={s.footer}>
      <div className={s.wrap}>
        <div className={s.footerGrid}>
          <div className={s.footerCol}>
            <Link href="/v2" className={s.navBrand} style={{ marginBottom: 14 }}>
              <Image src="/logo-opatam.png" alt="" width={28} height={28} />
              OPATAM
            </Link>
            <span style={{ maxWidth: 260, lineHeight: 1.6 }}>
              La réservation en ligne pour les indépendants et les petites équipes.
              Sans commission, jamais.
            </span>
            <div className={s.storeRow}>
              <a
                className={s.storeBtn}
                href="https://apps.apple.com/app/opatam-agenda-rendez-vous/id6759246218"
                target="_blank"
                rel="noopener noreferrer"
              >
                App Store
              </a>
              <a
                className={s.storeBtn}
                href="https://play.google.com/store/apps/details?id=com.kamerleontech.opatam"
                target="_blank"
                rel="noopener noreferrer"
              >
                Google Play
              </a>
            </div>
          </div>

          <div className={s.footerCol}>
            <h4>Produit</h4>
            <a href="#change">Fonctionnalités</a>
            <a href="#tarif">Tarif</a>
            <a href="#tutoriels">Tutoriels</a>
            <Link href="/p/salon-de-coiffure">Voir une démo</Link>
          </div>

          <div className={s.footerCol}>
            <h4>Ressources</h4>
            <Link href="/blog">Blog</Link>
            <Link href="/telechargement">Télécharger l’app</Link>
            <Link href="/contact">Nous contacter</Link>
            <Link href="/recrutement">Recrutement</Link>
          </div>

          <div className={s.footerCol}>
            <h4>Légal</h4>
            <Link href="/mentions-legales">Mentions légales</Link>
            <Link href="/confidentialite">Confidentialité</Link>
            <Link href="/cgv">Conditions générales</Link>
            <Link href="/supprimer-mon-compte">Supprimer mon compte</Link>
          </div>
        </div>

        <div className={s.footerBottom}>
          <span>© 2026 Opatam — tous droits réservés</span>
          <span>Fait en France · 0 % de commission</span>
        </div>
      </div>
    </footer>
  );
}
