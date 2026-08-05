'use client';

import Link from 'next/link';
import Image from 'next/image';
import type { ArticleCardData } from '@/app/blog/components/ArticleCard';
import s from './v2.module.css';
import { HeroV2 } from './HeroV2';
import { VideoTestimonials, type VideoTestimonial } from './VideoTestimonials';
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
          <Link href="/connexion">Se connecter</Link>
        </div>
        <Link href="/inscription" className={`${s.btn} ${s.btnPrimary}`} style={{ padding: '12px 22px' }}>
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
        >
          <div className={s.card}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 10 }}>
              <strong style={{ fontSize: 15 }}>Jeudi 30 juillet</strong>
              <span style={{ fontSize: 13, color: '#8892ab' }}>opatam.com/pro</span>
            </div>
            {[
              ['10:00', 'Manon — Pose gel', '45 €'],
              ['11:30', 'Jade — Remplissage', '35 €'],
              ['14:30', 'Léa — Nail art', '8 €'],
              ['16:00', 'Inès — Dépose', '15 €'],
            ].map(([time, who, price]) => (
              <div key={time} className={s.agendaRow}>
                <span className={s.agendaTime}>{time}</span>
                <span>{who}</span>
                <span className={s.agendaPrice}>{price}</span>
              </div>
            ))}
          </div>
        </Feature>

        <Feature
          flip
          title="Les rappels partent sans vous"
          text="24 h et 2 h avant chaque rendez-vous. Fini les SMS de relance à 22 h."
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <span className={s.pill}>
              <span className={s.dot} />
              <span>
                <strong>Rappel envoyé à Manon</strong>
                <br />
                <span style={{ color: '#68738d' }}>Pose gel demain à 14:30 — automatiquement</span>
              </span>
            </span>
            <span className={s.pill} style={{ marginLeft: 28 }}>
              <span className={s.dot} />
              <span>
                <strong>Rappel envoyé à Jade</strong>
                <br />
                <span style={{ color: '#68738d' }}>Remplissage dans 2 h — dernier rappel</span>
              </span>
            </span>
            <span className={s.pill}>
              <span className={s.dot} />
              <span>
                <strong>Léa a confirmé</strong>
                <br />
                <span style={{ color: '#68738d' }}>Aucun rendez-vous manqué cette semaine</span>
              </span>
            </span>
          </div>
        </Feature>

        <Feature
          title="Toute l'équipe synchronisée"
          text="Chaque membre a son agenda et ses prestations. Vous gardez la vue d'ensemble."
        >
          <div className={s.card}>
            {[
              ['MD', 'Marie D. — coiffeuse', '6 RDV aujourd’hui'],
              ['JK', 'Julie K. — coloriste', '4 RDV aujourd’hui'],
              ['TR', 'Thomas R. — barbier', '5 RDV aujourd’hui'],
            ].map(([initials, who, count]) => (
              <div key={initials} className={s.agendaRow}>
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
        </Feature>
      </div>
    </section>
  );
}

function Feature({
  title,
  text,
  children,
  flip = false,
}: {
  title: string;
  text: string;
  children: React.ReactNode;
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
      <div>{children}</div>
    </div>
  );
}

/* ── Story Instagram ─────────────────────────────────────────────── */

function StorySection() {
  const { ref, shown } = useReveal<HTMLDivElement>();
  return (
    <section className={`${s.sec} ${s.secDark}`}>
      <div className={s.wrap}>
        <div ref={ref} className={`${s.reveal} ${shown ? s.revealed : ''}`}>
          <span className={s.eyebrow}>Instagram &amp; Snapchat</span>
          <h2 className={s.secTitle}>
            Une story.
            <br />
            Des créneaux remplis.
          </h2>
        </div>
        <div className={s.steps}>
          {[
            ['01', 'Un trou ce mardi à 14 h.'],
            ['02', 'Un geste — Opatam génère la story avec vos dispos et votre QR code.'],
            ['03', 'Vos clientes scannent, elles réservent.'],
          ].map(([num, text]) => (
            <Step key={num} num={num} text={text} />
          ))}
        </div>
      </div>
    </section>
  );
}

function Step({ num, text }: { num: string; text: string }) {
  const { ref, shown } = useReveal<HTMLDivElement>();
  return (
    <div ref={ref} className={`${s.step} ${s.reveal} ${shown ? s.revealed : ''}`}>
      <span className={s.stepNum}>{num}</span>
      <p className={s.stepText}>{text}</p>
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

        <div className={s.tutos}>
          {tutorials.map((t) => (
            <Link key={t.slug} href={`/blog/${t.slug}`} className={s.tuto}>
              <div className={s.tutoCover}>
                {(t.videoCoverURL || t.coverImageURL) && (
                  <Image
                    src={(t.videoCoverURL || t.coverImageURL) as string}
                    alt=""
                    width={640}
                    height={360}
                    sizes="(min-width: 820px) 33vw, 100vw"
                  />
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

function Pricing() {
  const { ref, shown } = useReveal<HTMLDivElement>();
  return (
    <section className={`${s.sec} ${s.secDark}`} id="tarif">
      <div className={s.wrap}>
        <div ref={ref} className={`${s.reveal} ${shown ? s.revealed : ''}`}>
          <span className={s.eyebrow}>Le tarif</span>
          <h2 className={s.secTitle}>
            Un prix fixe.
            <br />
            Zéro surprise.
          </h2>
          <p className={s.secLead}>
            Sur 10 rendez-vous à 45 €, une commission de 20 % vous coûterait 90 €.
            Ici : 0 €.
          </p>
        </div>

        <div className={s.priceGrid}>
          <div className={s.compare}>
            <div className={s.compareRow}>
              <span>Autres plateformes</span>
              <strong>jusqu’à 20 % / RDV</strong>
            </div>
            <div className={`${s.compareRow} ${s.compareRowUs}`}>
              <span>Opatam</span>
              <strong>0 % — abonnement fixe</strong>
            </div>
          </div>

          <div className={s.priceCard}>
            <span className={s.eyebrow} style={{ color: '#233D85' }}>
              Formule Pro
            </span>
            <div className={s.priceAmount} style={{ marginTop: 12 }}>
              19,90 €
              <span style={{ fontSize: 18, fontWeight: 500, color: '#68738d' }}>/mois</span>
            </div>
            <ul className={s.priceList}>
              {[
                'Réservations illimitées, 0 % de commission',
                'Rappels automatiques 24 h et 2 h avant',
                'Vitrine en ligne + QR code',
                'Application mobile, notifications en direct',
              ].map((line) => (
                <li key={line}>
                  <span className={s.check}>✓</span>
                  {line}
                </li>
              ))}
            </ul>
            <Link href="/inscription" className={`${s.btn} ${s.btnPrimary}`} style={{ width: '100%' }}>
              Commencer mes 30 jours gratuits
            </Link>
            <p style={{ margin: '14px 0 0', fontSize: 13, color: '#68738d', textAlign: 'center' }}>
              Sans carte bancaire · formule Studio dès 29,90 € pour les équipes
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}

/* ── Final ───────────────────────────────────────────────────────── */

function FinalCta() {
  return (
    <section className={s.final}>
      <div className={s.wrap}>
        <h2 className={s.finalTitle}>Reprenez votre soirée.</h2>
        <p className={s.secLead} style={{ margin: '18px auto 30px', color: 'rgba(255,255,255,.72)' }}>
          Votre page de réservation est en ligne dans 5 minutes.
        </p>
        <Link href="/inscription" className={`${s.btn} ${s.btnPrimary}`}>
          Créer ma page
        </Link>
      </div>
    </section>
  );
}

function Footer() {
  return (
    <footer className={s.footer}>
      <div className={`${s.wrap} ${s.footerInner}`}>
        <span>© 2026 Opatam</span>
        <span>
          <Link href="/mentions-legales">Mentions légales</Link>
          <Link href="/confidentialite">Confidentialité</Link>
          <Link href="/supprimer-mon-compte">Supprimer mon compte</Link>
        </span>
      </div>
    </footer>
  );
}
