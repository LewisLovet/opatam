'use client';

import Image from 'next/image';
import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { ArrowRight, Check, Globe, Menu, Play, Plus, Smartphone, Users, X } from 'lucide-react';
import { APP_CONFIG, SUBSCRIPTION_PLANS } from '@booking-app/shared/constants';
import { APP_STORE_URL, PLAY_STORE_URL } from '@/lib/store-links';
import { trackSite } from '@/lib/trackSite';
import { LanguageSwitcher } from '@/components/common/LanguageSwitcher';
import { memoriserCampagne, suffixeCampagne } from '@/lib/campaign';
import { contenu, trackTikTok } from '@/lib/tiktok-pixel';
import s from './v1.module.css';
import { StoriesSection } from './StoriesSection';
import { ProviderVideos, type ProviderVideo } from './ProviderVideos';
import { HeroMotion, HeroFilm, FeatureScenes, ProductGallery } from './ReferenceMotion';

// Les images des métiers ; les libellés vivent dans le dictionnaire (landing.trades).
const trades = ['beauty', 'wellness', 'sport', 'audiovisual', 'artisan'] as const;
const days = APP_CONFIG.trialDays;

function StoreLinks() {
  const t = useTranslations('landing.download');
  return <div className={s.storeLinks}>
    <a href={APP_STORE_URL} target="_blank" rel="noopener noreferrer" onClick={() => trackSite('download:ios')} aria-label={t('appStoreAria')}>
      <svg width="25" height="28" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.81-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M13 3.5c.73-.83 1.94-1.46 2.94-1.5.13 1.17-.34 2.35-1.04 3.19-.69.85-1.83 1.51-2.95 1.42-.15-1.15.41-2.35 1.05-3.11z" /></svg>
      <span><small>{t('appStoreSmall')}</small><strong>App Store</strong></span>
    </a>
    <a href={PLAY_STORE_URL} target="_blank" rel="noopener noreferrer" onClick={() => trackSite('download:android')} aria-label={t('playStoreAria')}>
      <svg width="25" height="28" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M3,20.5V3.5C3,2.91 3.34,2.39 3.84,2.15L13.69,12L3.84,21.85C3.34,21.6 3,21.09 3,20.5M16.81,15.12L6.05,21.34L14.54,12.85L16.81,15.12M20.16,10.81C20.5,11.08 20.75,11.5 20.75,12C20.75,12.5 20.53,12.9 20.18,13.18L17.89,14.5L15.39,12L17.89,9.5L20.16,10.81M6.05,2.66L16.81,8.88L14.54,11.15L6.05,2.66Z" /></svg>
      <span><small>{t('playStoreSmall')}</small><strong>Google Play</strong></span>
    </a>
  </div>;
}

export default function LandingV1({ videos = [] }: { videos?: ProviderVideo[] }) {
  const t = useTranslations('landing');
  const tTemoignages = useTranslations('home.testimonials');
  const locale = useLocale();
  // Même prix en euros partout, écrit selon les usages de la langue (12,90 € / €12.90).
  const money = (cents: number) => new Intl.NumberFormat(locale, { style: 'currency', currency: 'EUR' }).format(cents / 100);
  const root = useRef<HTMLDivElement>(null);
  const [menu, setMenu] = useState(false);
  const [paused, setPaused] = useState(false);
  // L'annuel est mis en avant : c'est l'offre qu'on veut voir choisie.
  const [yearly, setYearly] = useState(true);

  // Une vue de l'accueil, comptée dans l'entonnoir de l'admin (vues →
  // clics stores → inscriptions). L'ancienne page l'envoyait ; l'oublier
  // ici aurait mis le compteur à zéro le jour du lancement des publicités.
  useEffect(() => { trackSite('view:home'); }, []);

  // Campagne : mémorisée pour la session, et recopiée sur les liens vers
  // l'inscription (voir lib/campaign.ts). Calculé après le montage pour ne
  // pas différer du rendu serveur.
  const [suffixe, setSuffixe] = useState('');
  useEffect(() => {
    memoriserCampagne();
    setSuffixe(suffixeCampagne(window.location.search));
  }, []);
  const inscription = `/register${suffixe}`;
  const temoignages = tTemoignages.raw('items') as { name: string; role: string; text: string }[];
  const faqs = t.raw('faq.items') as { question: string; answer: string }[];
  // Les clics vers l'inscription et la démo, aussi pour TikTok (ClickButton),
  // en plus de la mesure maison.
  const clicVitrine = () => { trackSite('click:vitrine'); trackTikTok('ClickButton', { contents: contenu('creer-ma-vitrine', t('hero.create')) }); };
  const clicDemo = () => { trackSite('click:demo'); trackTikTok('ClickButton', { contents: contenu('essayer-la-demo', t('hero.demo')) }); };

  // Profondeur de défilement, deux repères envoyés une seule fois. Écouteur
  // passif et calcul différé à la prochaine image : rien ne bloque le
  // défilement lui-même.
  useEffect(() => {
    const envoyes = { 50: false, 90: false };
    let frame = 0;
    const mesurer = () => {
      frame = 0;
      const total = document.documentElement.scrollHeight - window.innerHeight;
      if (total <= 0) return;
      const pct = (window.scrollY / total) * 100;
      if (!envoyes[50] && pct >= 50) { envoyes[50] = true; trackSite('scroll:50'); }
      if (!envoyes[90] && pct >= 90) { envoyes[90] = true; trackSite('scroll:90'); }
      if (envoyes[50] && envoyes[90]) window.removeEventListener('scroll', planifier);
    };
    const planifier = () => { if (!frame) frame = requestAnimationFrame(mesurer); };
    window.addEventListener('scroll', planifier, { passive: true });
    return () => { window.removeEventListener('scroll', planifier); if (frame) cancelAnimationFrame(frame); };
  }, []);

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

  return <div className={s.root} ref={root} lang={locale}>
    <a href="#contenu-v1" className={s.skip}>{t('skip')}</a>
    <header className={s.header}>
      <div className={`${s.wrap} ${s.nav}`}>
        <Link href="/" className={s.brand} aria-label={t('brandAria')}><Image src="/logo-opatam-blanc.png" alt="" width={34} height={34} />OPATAM</Link>
        <nav className={s.desktopNav} aria-label={t('mainNav')}><a href="#fonctionnement">{t('nav.how')}</a><a href="#tarifs">{t('nav.pricing')}</a><a href="#videos">{t('nav.trades')}</a></nav>
        <div className={s.navActions}><LanguageSwitcher className={s.langue} /><Link href="/login" className={s.login}>{t('nav.login')}</Link><Link href={inscription} className={s.buttonSmall} onClick={clicVitrine}>{t('nav.create')} <ArrowRight size={15} /></Link><button className={s.menuButton} onClick={() => setMenu(!menu)} aria-expanded={menu} aria-controls="v1-menu" aria-label={menu ? t('nav.closeMenu') : t('nav.openMenu')}>{menu ? <X /> : <Menu />}</button></div>
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
        <button className={s.drawerScrim} onClick={() => setMenu(false)} tabIndex={-1} aria-label={t('nav.closeMenu')} />
        <nav id="v1-menu" className={s.drawer} aria-label={t('mobileNav')}>
          <div className={s.drawerHead}>
            <span className={s.drawerBrand}>{t('nav.menu')}</span>
            <button onClick={() => setMenu(false)} aria-label={t('nav.closeMenu')}><X size={20} /></button>
          </div>
          <div className={s.drawerLinks} onClick={() => setMenu(false)}>
            {[
              ['#fonctionnement', t('nav.how')],
              ['#videos', t('nav.trades')],
              ['#stories', t('nav.networks')],
              ['#avis', t('nav.words')],
              ['#tarifs', t('nav.pricing')],
              ['#telecharger', t('nav.download')],
            ].map(([href, label]) => (
              <a key={href} href={href} tabIndex={menu ? 0 : -1}>
                <span>{label}</span>
                <ArrowRight size={17} aria-hidden="true" />
              </a>
            ))}
          </div>
          <div className={s.drawerFoot}>
            <Link href={inscription} className={s.primary} tabIndex={menu ? 0 : -1} onClick={() => { clicVitrine(); setMenu(false); }}>
              {t('nav.createWeb')} <ArrowRight size={18} />
            </Link>
            <Link href="/login" className={s.drawerLogin} tabIndex={menu ? 0 : -1} onClick={() => setMenu(false)}>
              {t('nav.loginLong')}
            </Link>
            <div className={s.drawerLangue}><LanguageSwitcher /></div>
            <small>{t('nav.trial', { days })}</small>
          </div>
        </nav>
      </div>

    <main id="contenu-v1">
      <section className={s.hero}>
        <HeroFilm />
        <div className={s.heroTint} aria-hidden="true" />
        <div className={`${s.wrap} ${s.heroGrid}`}>
          <div className={s.heroCopy}>
            <p className={s.eyebrow}><span /> {t('hero.eyebrow')}</p>
            <h1>{t('hero.title1')}<br />{t('hero.title2')}<br /><em>{t('hero.title3')}</em></h1>
            <p className={s.heroLead}>{t('hero.lead')}</p>
            <div className={s.actions}><Link href={inscription} className={s.primary} onClick={clicVitrine}>{t('hero.create')} <ArrowRight size={18} /></Link><Link href="/p/demo" className={s.secondary} onClick={clicDemo}><Play size={17} /> {t('hero.demo')}</Link></div>
            <p className={s.fine}><Check size={15} /> {t('hero.trial', { days })} <span>·</span> {t('hero.noCard')}</p>
            {/* L'application, en second plan : deux liens discrets plutôt qu'un
                troisième bouton qui concurrencerait la vitrine et la démo. */}
            <p className={s.heroStores}><Smartphone size={15} /> {t('hero.app')}
              <a href={APP_STORE_URL} target="_blank" rel="noopener noreferrer" onClick={() => trackSite('download:ios')}>iPhone</a>
              <span>·</span>
              <a href={PLAY_STORE_URL} target="_blank" rel="noopener noreferrer" onClick={() => trackSite('download:android')}>Android</a>
            </p>
            <div className={s.heroChips}><span>{t('hero.chipReady')} <b>{t('hero.chipReadyStrong')}</b></span><span>{t('hero.chipBookings')} <b>{t('hero.chipBookingsStrong')}</b></span><span>{t('hero.chipReminders')} <b>{t('hero.chipRemindersStrong')}</b></span></div>
          </div>
          <HeroMotion />
        </div>
      </section>

      <section className={s.trades} aria-label={t('trades.aria')}>
        <div className={`${s.wrap} ${s.stripHeading}`} data-reveal><p><span>{t('trades.lead')}</span><strong>{t('trades.strong')}</strong></p></div>
        <div className={s.marquee} data-paused={paused}><div className={s.track}>{[0, 1, 2, 3].map(copy => <div className={s.tradeGroup} key={copy} aria-hidden={copy > 0 ? true : undefined}>{trades.map(trade => <div className={s.trade} key={trade}><Image src={`/category-covers/${trade}.jpg`} alt="" width={104} height={76} /><span>{t(`trades.${trade}`)}</span></div>)}</div>)}</div></div>
      </section>

      {/* Les vidéos des prestataires juste sous les métiers : la preuve
          sociale se voit tôt, avant l'explication du produit. */}
      <ProviderVideos items={videos} />

      <section className={`${s.wrap} ${s.section}`} id="fonctionnement">
        <div className={s.sectionHeading} data-reveal><p className={s.eyebrow}>{t('how.eyebrow')}</p><h2>{t('how.title1')}<br /><em>{t('how.title2')}</em></h2><p>{t('how.lead')}</p></div>
        <FeatureScenes />
        <ProductGallery />
      </section>

      <StoriesSection />

      <section className={`${s.wrap} ${s.section}`} id="avis">
        <div className={s.headingRow} data-reveal><div><p className={s.eyebrow}>{t('reviews.eyebrow')}</p><h2>{t('reviews.title1')}<br /><em>{t('reviews.title2')}</em></h2></div><p>{t('reviews.lead1')}<br />{t('reviews.lead2')}</p></div>
        {/* Les trois témoignages sont ceux de l'ancienne page, déjà traduits :
            un seul endroit à maintenir (home.testimonials.items). */}
        <div className={s.quotes}>{temoignages.map(({ name, role, text: quote }) => <figure key={name} data-reveal><span className={s.quoteMark} aria-hidden="true">“</span><blockquote>{quote}</blockquote><figcaption><strong>{name}</strong><span>{role}</span></figcaption></figure>)}</div>
      </section>

      <section className={s.pricingSection} id="tarifs"><div className={`${s.wrap} ${s.section}`}>
        <div className={s.sectionHeading} data-reveal><p className={s.eyebrow}>{t('pricing.eyebrow')}</p><h2>{t('pricing.title1')}<br /><em>{t('pricing.title2')}</em></h2><p>{t('pricing.lead')}</p><div className={s.period} role="group" aria-label={t('pricing.periodAria')}><button aria-pressed={yearly} onClick={() => setYearly(true)}>{t('pricing.yearly')} <span>{t('pricing.yearlyBadge')}</span></button><button aria-pressed={!yearly} onClick={() => setYearly(false)}>{t('pricing.monthly')}</button></div></div>
        <div className={s.plans}>{[
          { name: 'Pro', key: 'pro' as const, monthly: SUBSCRIPTION_PLANS.solo.monthlyPrice, annual: SUBSCRIPTION_PLANS.solo.yearlyPrice, icon: Smartphone },
          { name: 'Studio', key: 'studio' as const, monthly: SUBSCRIPTION_PLANS.team.baseMonthlyPrice, annual: SUBSCRIPTION_PLANS.team.baseYearlyPrice, icon: Users },
        ].map(({ name, key, monthly, annual, icon: Icon }) => <article key={name} data-reveal><div className={s.planTop}><Icon size={23} /><span>{t(`pricing.${key}Tag`)}</span></div><h3>{name}</h3><p>{t(`pricing.${key}Audience`)}</p><div className={s.price}>{money(yearly ? annual / 12 : monthly)}<small>{t('pricing.perMonth')}</small></div><p className={s.billing}>{yearly ? t('pricing.billedYearly', { total: money(annual) }) : t('pricing.billedMonthly')}</p><Link href={inscription} className={name === 'Pro' ? s.primary : s.secondary} onClick={() => trackSite('click:pricing')}>{t('pricing.cta', { name })} <ArrowRight size={17} /></Link><ul>{([1, 2, 3, 4, 5] as const).map(n => <li key={n}><Check size={17} />{t(`pricing.${key}${n}`)}</li>)}</ul></article>)}</div>
        <p className={s.priceNote}><Check size={17} /> {t('pricing.note', { days })}<span>{t('pricing.mobileQ')} <a href="#telecharger">{t('pricing.mobileCta')} <ArrowRight size={14} /></a></span></p>
      </div></section>

      <section className={`${s.wrap} ${s.section} ${s.faq}`}><div data-reveal><p className={s.eyebrow}>{t('faq.eyebrow')}</p><h2>{t('faq.title1')}<br /><em>{t('faq.title2')}</em></h2><Link href="/contact" className={s.textLink}>{t('faq.talk')} <ArrowRight size={17} /></Link></div><div className={s.faqList}>{faqs.map(({ question }, index) => <details key={question}><summary>{question}<Plus size={20} /></summary><p>{t(`faq.items.${index}.answer`, { days })}</p></details>)}</div></section>

      <section className={s.downloadSection} id="telecharger"><div className={`${s.wrap} ${s.downloadGrid}`}>
        <div data-reveal><p className={s.eyebrow}>{t('download.eyebrow')}</p><h2>{t('download.title1')}<br /><em>{t('download.title2')}</em></h2><p>{t('download.lead1')}<br />{t('download.lead2')}</p></div>
        <div className={s.startCards}><div><Smartphone size={25} /><h3>{t('download.pocket')}</h3><StoreLinks /></div><div><Globe size={25} /><h3>{t('download.page')}</h3><Link href={inscription} className={s.primary} onClick={clicVitrine}>{t('hero.create')} <ArrowRight size={18} /></Link><small>{t('nav.trial', { days })}</small></div></div>
      </div></section>
    </main>
    <footer className={`${s.wrap} ${s.footer}`}><div><Link href="/" className={s.brand}><Image src="/logo-opatam.png" alt="" width={30} height={30} />opatam.</Link><p>{t('footer.tagline')}</p></div><nav aria-label={t('footer.linksAria')}><Link href="/recherche">{t('footer.find')}</Link><Link href="/blog">{t('footer.blog')}</Link><Link href="/contact">{t('footer.contact')}</Link><Link href="/mentions-legales">{t('footer.legal')}</Link><Link href="/confidentialite">{t('footer.privacy')}</Link><Link href="/cgu">{t('footer.terms')}</Link></nav><small>© {new Date().getFullYear()} Opatam · KamerleonTech</small></footer>
  </div>;
}
