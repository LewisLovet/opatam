'use client';

import Image from 'next/image';
import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import { ArrowRight, Check, Globe, Menu, Play, Plus, Smartphone, Users, X } from 'lucide-react';
import { APP_CONFIG, SUBSCRIPTION_PLANS } from '@booking-app/shared/constants';
import { APP_STORE_URL, PLAY_STORE_URL } from '@/lib/store-links';
import { trackSite } from '@/lib/trackSite';
import s from './v1.module.css';
import { StoriesSection } from './StoriesSection';
import { ProviderVideos, type ProviderVideo } from './ProviderVideos';
import { HeroMotion, HeroFilm, FeatureScenes, ProductGallery } from './ReferenceMotion';

const trades = [
  { title: 'Beauté & coiffure', image: 'beauty' },
  { title: 'Bien-être', image: 'wellness' },
  { title: 'Sport & coaching', image: 'sport' },
  { title: 'Photo & création', image: 'audiovisual' },
  { title: 'Artisanat', image: 'artisan' },
];

const faqs = [
  ['Faut-il choisir entre l’application et le site web ?', 'Les deux se complètent : votre page web permet à vos clients de réserver, et votre espace professionnel vous permet de gérer votre activité sur ordinateur ou depuis l’application.'],
  ['Mes clients doivent-ils télécharger une application ?', 'Non. Ils ouvrent votre lien, choisissent une prestation et un créneau, puis renseignent leur nom, leur email et leur téléphone. Ils peuvent réserver directement sur le web, sans compte.'],
  ['Comment se passe l’essai gratuit ?', `Vous disposez de ${APP_CONFIG.trialDays} jours pour essayer Opatam, sans carte bancaire. Vous choisissez ensuite la formule adaptée à votre activité si vous souhaitez continuer.`],
  ['Est-ce adapté à une petite équipe ?', 'Oui. La formule Studio permet de gérer jusqu’à 10 membres et 10 lieux. Chaque membre possède son planning et ses prestations, et vous gardez une vue d’ensemble.'],
  ['Opatam prend-il une commission ?', 'Opatam ne prélève aucune commission sur vos réservations. Les formules reposent sur un abonnement fixe. Si vous activez un service de paiement en ligne, les frais de traitement applicables restent distincts.'],
];
const money = (cents: number) => new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' }).format(cents / 100);

function StoreLinks() {
  return <div className={s.storeLinks}>
    <a href={APP_STORE_URL} target="_blank" rel="noopener noreferrer" onClick={() => trackSite('download:ios')} aria-label="Télécharger Opatam sur l’App Store">
      <svg width="25" height="28" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.81-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M13 3.5c.73-.83 1.94-1.46 2.94-1.5.13 1.17-.34 2.35-1.04 3.19-.69.85-1.83 1.51-2.95 1.42-.15-1.15.41-2.35 1.05-3.11z" /></svg>
      <span><small>Télécharger sur</small><strong>App Store</strong></span>
    </a>
    <a href={PLAY_STORE_URL} target="_blank" rel="noopener noreferrer" onClick={() => trackSite('download:android')} aria-label="Télécharger Opatam sur Google Play">
      <svg width="25" height="28" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M3,20.5V3.5C3,2.91 3.34,2.39 3.84,2.15L13.69,12L3.84,21.85C3.34,21.6 3,21.09 3,20.5M16.81,15.12L6.05,21.34L14.54,12.85L16.81,15.12M20.16,10.81C20.5,11.08 20.75,11.5 20.75,12C20.75,12.5 20.53,12.9 20.18,13.18L17.89,14.5L15.39,12L17.89,9.5L20.16,10.81M6.05,2.66L16.81,8.88L14.54,11.15L6.05,2.66Z" /></svg>
      <span><small>Disponible sur</small><strong>Google Play</strong></span>
    </a>
  </div>;
}

export default function LandingV1({ videos = [] }: { videos?: ProviderVideo[] }) {
  const root = useRef<HTMLDivElement>(null);
  const [menu, setMenu] = useState(false);
  const [paused, setPaused] = useState(false);
  // L'annuel est mis en avant : c'est l'offre qu'on veut voir choisie.
  const [yearly, setYearly] = useState(true);

  useEffect(() => {
    const media = window.matchMedia('(prefers-reduced-motion: reduce)');
    const sync = () => setPaused(media.matches);
    sync();
    media.addEventListener('change', sync);
    return () => media.removeEventListener('change', sync);
  }, []);

  useEffect(() => {
    const nodes = root.current?.querySelectorAll<HTMLElement>('[data-reveal]');
    if (!nodes || !('IntersectionObserver' in window)) return;
    const observer = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          entry.target.setAttribute('data-visible', 'true');
          observer.unobserve(entry.target);
        }
      });
    }, { threshold: 0.12 });
    nodes.forEach(node => {
      if (node.getBoundingClientRect().top > window.innerHeight) node.setAttribute('data-visible', 'false');
      observer.observe(node);
    });
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (!menu) return;
    const close = (e: KeyboardEvent) => { if (e.key === 'Escape') setMenu(false); };
    window.addEventListener('keydown', close);
    // Sans ce verrou, le doigt fait défiler la page DERRIÈRE le panneau.
    const avant = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', close);
      document.body.style.overflow = avant;
    };
  }, [menu]);

  return <div className={s.root} ref={root} lang="fr">
    <a href="#contenu-v1" className={s.skip}>Aller au contenu</a>
    <header className={s.header}>
      <div className={`${s.wrap} ${s.nav}`}>
        <Link href="/" className={s.brand} aria-label="Opatam, accueil"><Image src="/logo-opatam-blanc.png" alt="" width={34} height={34} />OPATAM</Link>
        <nav className={s.desktopNav} aria-label="Navigation principale"><a href="#fonctionnement">Comment ça marche</a><a href="#tarifs">Tarifs</a><a href="#videos">Leurs métiers</a></nav>
        <div className={s.navActions}><Link href="/login" className={s.login}>Connexion</Link><Link href="/register" className={s.buttonSmall}>Créer ma page <ArrowRight size={15} /></Link><button className={s.menuButton} onClick={() => setMenu(!menu)} aria-expanded={menu} aria-controls="v1-menu" aria-label={menu ? 'Fermer le menu' : 'Ouvrir le menu'}>{menu ? <X /> : <Menu />}</button></div>
      </div>
    </header>
      {/* Le panneau est un FRÈRE de l'en-tête, pas un enfant : le
          `backdrop-filter` du bandeau crée un bloc conteneur, et un
          `position: fixed` posé dedans se retrouve enfermé dans ses 70 px
          de hauteur au lieu de couvrir l'écran. */}
      {/* Panneau latéral, pas un dépliant : sur un téléphone, un menu qui
          pousse le contenu vers le bas se confond avec la page. Le voile
          sombre et le panneau qui arrive par la droite disent clairement
          qu'on est sorti du fil de lecture. */}
      <div className={s.drawerRoot} data-open={menu} aria-hidden={!menu}>
        <button className={s.drawerScrim} onClick={() => setMenu(false)} tabIndex={-1} aria-label="Fermer le menu" />
        <nav id="v1-menu" className={s.drawer} aria-label="Navigation mobile">
          <div className={s.drawerHead}>
            <span className={s.drawerBrand}>Menu</span>
            <button onClick={() => setMenu(false)} aria-label="Fermer le menu"><X size={20} /></button>
          </div>
          <div className={s.drawerLinks} onClick={() => setMenu(false)}>
            {[
              ['#fonctionnement', 'Comment ça marche'],
              ['#videos', 'Leurs métiers'],
              ['#stories', 'Vos réseaux'],
              ['#avis', 'Leurs mots'],
              ['#tarifs', 'Tarifs'],
              ['#telecharger', 'Télécharger l’app'],
            ].map(([href, label]) => (
              <a key={href} href={href} tabIndex={menu ? 0 : -1}>
                <span>{label}</span>
                <ArrowRight size={17} aria-hidden="true" />
              </a>
            ))}
          </div>
          <div className={s.drawerFoot}>
            <Link href="/register" className={s.primary} tabIndex={menu ? 0 : -1} onClick={() => setMenu(false)}>
              Créer ma page web <ArrowRight size={18} />
            </Link>
            <Link href="/login" className={s.drawerLogin} tabIndex={menu ? 0 : -1} onClick={() => setMenu(false)}>
              J’ai déjà un compte · Connexion
            </Link>
            <small>{APP_CONFIG.trialDays} jours gratuits · Sans carte bancaire</small>
          </div>
        </nav>
      </div>

    <main id="contenu-v1">
      <section className={s.hero}>
        <HeroFilm />
        <div className={s.heroTint} aria-hidden="true" />
        <div className={`${s.wrap} ${s.heroGrid}`}>
          <div className={s.heroCopy}>
            <p className={s.eyebrow}><span /> POUR LES INDÉPENDANTS & PETITES ÉQUIPES</p>
            <h1>La réservation<br />en ligne,<br /><em>qui remplit votre agenda.</em></h1>
            <p className={s.heroLead}>Vos clients réservent 24 h/24 sur votre page. Votre agenda vous suit dans l’app. Vous gardez la main sur votre activité.</p>
            <div className={s.actions}><Link href="/register" className={s.primary}>Créer ma vitrine <ArrowRight size={18} /></Link><Link href="/p/demo" className={s.secondary}><Play size={17} /> Essayer la démo</Link></div>
            <p className={s.fine}><Check size={15} /> {APP_CONFIG.trialDays} jours gratuits <span>·</span> Sans carte bancaire</p>
            {/* L'application, en second plan : deux liens discrets plutôt qu'un
                troisième bouton qui concurrencerait la vitrine et la démo. */}
            <p className={s.heroStores}><Smartphone size={15} /> L’application :
              <a href={APP_STORE_URL} target="_blank" rel="noopener noreferrer" onClick={() => trackSite('download:ios')}>iPhone</a>
              <span>·</span>
              <a href={PLAY_STORE_URL} target="_blank" rel="noopener noreferrer" onClick={() => trackSite('download:android')}>Android</a>
            </p>
            <div className={s.heroChips}><span>Prêt en <b>5 min</b></span><span>Réservations <b>24 h/24</b></span><span>Rappels <b>automatiques</b></span></div>
          </div>
          <HeroMotion />
        </div>
      </section>

      <section className={s.trades} aria-label="Les métiers qui peuvent utiliser Opatam">
        <div className={`${s.wrap} ${s.stripHeading}`} data-reveal><p><span>Vous avez le savoir-faire</span><strong>On s’occupe des rendez-vous.</strong></p></div>
        <div className={s.marquee} data-paused={paused}><div className={s.track}>{[0, 1, 2, 3].map(copy => <div className={s.tradeGroup} key={copy} aria-hidden={copy > 0 ? true : undefined}>{trades.map(trade => <div className={s.trade} key={trade.title}><Image src={`/category-covers/${trade.image}.jpg`} alt="" width={104} height={76} /><span>{trade.title}</span></div>)}</div>)}</div></div>
      </section>

      {/* Les vidéos des prestataires juste sous les métiers : la preuve
          sociale se voit tôt, avant l'explication du produit. */}
      <ProviderVideos items={videos} />

      <section className={`${s.wrap} ${s.section}`} id="fonctionnement">
        <div className={s.sectionHeading} data-reveal><p className={s.eyebrow}>CE QUE ÇA CHANGE</p><h2>Moins d’administratif.<br /><em>Plus de rendez-vous.</em></h2><p>Une page pour être réservé. Une application pour tout gérer.</p></div>
        <FeatureScenes />
        <ProductGallery />
      </section>

      <StoriesSection />

      <section className={`${s.wrap} ${s.section}`} id="avis">
        <div className={s.headingRow} data-reveal><div><p className={s.eyebrow}>ILS ONT FAIT LE PREMIER PAS</p><h2>Leur métier.<br /><em>Leurs mots.</em></h2></div><p>Des indépendantes qui ont choisi<br />une autre façon de gérer leurs rendez-vous.</p></div>
        <div className={s.quotes}>{[
          ['BraidzTouch', 'Coiffeuse', 'J’adore Opatam, un outil de gestion très simple qui me permet de gérer mes rendez-vous de façon automatique.'],
          ['Cam Beauty Studio', 'Prothésiste ongulaire', 'J’ai rejoint récemment l’application et je ne regrette pas du tout, surtout sur le plan économique.'],
          ['Palm Beauty', 'Spray tan & blanchiment dentaire', 'Ma première application de rendez-vous automatisés, et je ne regrette pas mon choix.'],
        ].map(([name, role, quote]) => <figure key={name} data-reveal><span className={s.quoteMark} aria-hidden="true">“</span><blockquote>{quote}</blockquote><figcaption><strong>{name}</strong><span>{role}</span></figcaption></figure>)}</div>
      </section>

      <section className={s.pricingSection} id="tarifs"><div className={`${s.wrap} ${s.section}`}>
        <div className={s.sectionHeading} data-reveal><p className={s.eyebrow}>SIMPLE, JUSQU’AU TARIF</p><h2>Votre activité grandit.<br /><em>Pas nos commissions.</em></h2><p>Un abonnement fixe. Aucune commission sur vos réservations.</p><div className={s.period} role="group" aria-label="Période de facturation"><button aria-pressed={yearly} onClick={() => setYearly(true)}>Annuel <span>2 mois offerts</span></button><button aria-pressed={!yearly} onClick={() => setYearly(false)}>Mensuel</button></div></div>
        <div className={s.plans}>{[
          { name: 'Pro', audience: 'Votre activité, en solo.', monthly: SUBSCRIPTION_PLANS.solo.monthlyPrice, annual: SUBSCRIPTION_PLANS.solo.yearlyPrice, icon: Smartphone, features: ['Votre page de réservation personnalisée', 'Réservations illimitées, sans commission', 'Agenda sur le web et dans l’app', 'Rappels automatiques email et push', '1 professionnel · 1 lieu'] },
          { name: 'Studio', audience: 'Un collectif. Un même rythme.', monthly: SUBSCRIPTION_PLANS.team.baseMonthlyPrice, annual: SUBSCRIPTION_PLANS.team.baseYearlyPrice, icon: Users, features: ['Tout ce qui est inclus dans Pro', 'Jusqu’à 10 agendas synchronisés', 'Prestations attribuées par membre', 'Jusqu’à 10 lieux d’exercice', 'Une page publique pour votre équipe'] },
        ].map(({ name, audience, monthly, annual, icon: Icon, features }) => <article key={name} data-reveal><div className={s.planTop}><Icon size={23} /><span>{name === 'Pro' ? 'POUR LES INDÉPENDANTS' : 'POUR LES PETITES ÉQUIPES'}</span></div><h3>{name}</h3><p>{audience}</p><div className={s.price}>{money(yearly ? annual / 12 : monthly)}<small>/ mois</small></div><p className={s.billing}>{yearly ? `${money(annual)} facturés par an` : 'Facturation mensuelle · Sans engagement'}</p><Link href="/register" className={name === 'Pro' ? s.primary : s.secondary}>Créer ma page {name} <ArrowRight size={17} /></Link><ul>{features.map(feature => <li key={feature}><Check size={17} />{feature}</li>)}</ul></article>)}</div>
        <p className={s.priceNote}><Check size={17} /> {APP_CONFIG.trialDays} jours pour essayer. Sans carte bancaire.<span>Vous préférez commencer sur mobile ? <a href="#telecharger">Téléchargez l’app <ArrowRight size={14} /></a></span></p>
      </div></section>

      <section className={`${s.wrap} ${s.section} ${s.faq}`}><div data-reveal><p className={s.eyebrow}>ON VOUS RÉPOND</p><h2>Encore une<br /><em>petite question ?</em></h2><Link href="/contact" className={s.textLink}>Parlons-en <ArrowRight size={17} /></Link></div><div className={s.faqList}>{faqs.map(([question, answer]) => <details key={question}><summary>{question}<Plus size={20} /></summary><p>{answer}</p></details>)}</div></section>

      <section className={s.downloadSection} id="telecharger"><div className={`${s.wrap} ${s.downloadGrid}`}>
        <div data-reveal><p className={s.eyebrow}>LE PROCHAIN RENDEZ-VOUS COMMENCE ICI</p><h2>Faites de la place<br /><em>à votre métier.</em></h2><p>Sur votre téléphone ou votre ordinateur,<br />votre nouvelle organisation commence avec Opatam.</p></div>
        <div className={s.startCards}><div><Smartphone size={25} /><h3>Votre activité dans la poche.</h3><StoreLinks /></div><div><Globe size={25} /><h3>Votre page, prête à être partagée.</h3><Link href="/register" className={s.primary}>Créer ma page web <ArrowRight size={18} /></Link><small>{APP_CONFIG.trialDays} jours gratuits · Sans carte bancaire</small></div></div>
      </div></section>
    </main>
    <footer className={`${s.wrap} ${s.footer}`}><div><Link href="/v1" className={s.brand}><Image src="/logo-opatam.png" alt="" width={30} height={30} />opatam.</Link><p>Votre savoir-faire mérite du temps.</p></div><nav aria-label="Liens utiles"><Link href="/recherche">Trouver un professionnel</Link><Link href="/blog">Conseils & tutoriels</Link><Link href="/contact">Contact</Link><Link href="/mentions-legales">Mentions légales</Link><Link href="/confidentialite">Confidentialité</Link><Link href="/cgu">CGU</Link></nav><small>© {new Date().getFullYear()} Opatam · KamerleonTech</small></footer>
  </div>;
}
