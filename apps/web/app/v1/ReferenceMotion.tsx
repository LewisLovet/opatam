'use client';

import Image from 'next/image';
import { useEffect, useRef, useState } from 'react';
import { useTranslations } from 'next-intl';
import { ArrowLeft, ArrowRight, ArrowUpRight, Bell, CalendarDays, Globe, Smartphone, Users } from 'lucide-react';
import s from './v1.module.css';
import { CaptureViewer } from './CaptureViewer';

/** Play only while visible, with the user's motion preference respected. */
function useMotion() {
  const ref = useRef<HTMLDivElement>(null);
  const [active, setActive] = useState(false);
  const [reduced, setReduced] = useState(true);
  useEffect(() => {
    const query = matchMedia('(prefers-reduced-motion: reduce)');
    let visible = false;
    const sync = () => { setReduced(query.matches); setActive(visible && !document.hidden && !query.matches); };
    const observer = new IntersectionObserver(([entry]) => { visible = entry.isIntersecting; sync(); }, { threshold: .15 });
    if (ref.current) observer.observe(ref.current);
    query.addEventListener('change', sync);
    document.addEventListener('visibilitychange', sync);
    sync();
    return () => { observer.disconnect(); query.removeEventListener('change', sync); document.removeEventListener('visibilitychange', sync); };
  }, []);
  return { ref, active, reduced };
}

export function HeroFilm() {
  const { ref, active } = useMotion();
  const video = useRef<HTMLVideoElement>(null);
  useEffect(() => {
    if (!video.current) return;
    if (active) void video.current.play().catch(() => {});
    else video.current.pause();
  }, [active]);
  return <div ref={ref} className={s.film}>
    <video ref={video} src="/hero-loop.mp4" poster="/category-covers/beauty.jpg" muted loop playsInline preload="metadata" aria-hidden="true" />
  </div>;
}

// Captures réelles de l'application, fournies par Opatam — le parcours
// complet d'une cliente chez Braidztouch, de la vitrine au paiement de
// l'acompte. Toutes au même format, donc un seul ratio à déclarer.
// Titres, textes alternatifs et descriptions : dictionnaire landing.screens.<clé>.
const clientScreens = [
  { file: 'vitrine', key: 'vitrine' },
  { file: 'prestations', key: 'prestations' },
  { file: 'options', key: 'options' },
  { file: 'creneaux', key: 'creneaux' },
  { file: 'recapitulatif', key: 'recapitulatif' },
  { file: 'acompte', key: 'acompte' },
] as const;

// Le téléphone du haut de page garde SES captures, Cam Beauty Studio : elles
// ont été choisies pour cet emplacement, et le client tient à les y garder.
// Format d'origine différent (1290 × 2796), d'où les dimensions portées.
const heroScreens = [
  { file: 'cam-profil', key: 'camProfil', width: 1290, height: 2796 },
  { file: 'cam-prestations', key: 'camPrestations', width: 1290, height: 2796 },
  { file: 'cam-creneaux', key: 'camCreneaux', width: 1290, height: 2796 },
] as const;

// Côté pro, le même écran raconte deux métiers : l'indépendant qui voit sa
// journée, l'équipe qui voit toutes ses colonnes. D'où le sélecteur.
const proScreens = [
  { file: 'agenda-solo', key: 'solo' },
  { file: 'agenda-equipe', key: 'equipe' },
] as const;

function Capture({ file, alt, priority = false, width = 1206, height = 2622 }: { file: string; alt: string; priority?: boolean; width?: number; height?: number }) {
  return <Image src={`/v1/captures/${file}.jpg`} alt={alt} width={width} height={height} sizes="(max-width: 600px) 280px, 320px" priority={priority} className={s.captureImage} />;
}

export function HeroMotion() {
  const t = useTranslations('landing');
  const { ref, active } = useMotion();
  const [step, setStep] = useState(0);
  const [paused, setPaused] = useState(false);
  // Le téléphone arrive d'abord (entrée en 3D, ~2,2 s) ; le défilement des
  // écrans ne commence qu'ensuite, sinon le premier écran changeait pendant
  // que le téléphone se posait encore.
  const [arrive, setArrive] = useState(false);
  useEffect(() => {
    const id = setTimeout(() => setArrive(true), 2600);
    return () => clearTimeout(id);
  }, []);
  const screens = heroScreens;
  useEffect(() => {
    if (!active || paused || !arrive) return;
    const id = setTimeout(() => setStep(value => (value + 1) % 3), 5000);
    return () => clearTimeout(id);
  }, [active, paused, arrive, step]);

  return <div className={s.realHero} ref={ref} onMouseEnter={() => setPaused(true)} onMouseLeave={() => setPaused(false)} onBlurCapture={event => { if (!event.currentTarget.contains(event.relatedTarget)) setPaused(false); }} onFocusCapture={() => setPaused(true)} role="region" aria-label={t('hero.previewAria')}>
    <div className={s.captureFrame}>
      {screens.map((screen, index) => <div key={screen.file} className={s.captureSlide} data-active={step === index} aria-hidden={step !== index}>
        <Capture file={screen.file} alt={t(`screens.${screen.key}.alt`)} priority={index === 0} width={screen.width} height={screen.height} />
      </div>)}
    </div>
    <div className={s.captureControls}>
      <div role="group" aria-label={t('hero.chooseScreen')}>{screens.map((screen, index) => <button key={screen.file} aria-label={t(`screens.${screen.key}.title`)} aria-pressed={step === index} onClick={() => { setStep(index); setPaused(true); }}><span /></button>)}</div>
      <span>{t(`screens.${screens[step].key}.title`)}</span>
    </div>
    <p className={s.captureCredit}>{t('hero.credit')}</p>
  </div>;
}

export function FeatureScenes() {
  const t = useTranslations('landing');
  const [expanded, setExpanded] = useState(false);
  return <div className={s.featureScenes}>
    <article className={s.sceneRow} data-reveal>
      <div><p className={s.eyebrow}>{t('features.eyebrow')}</p><h3>{t('features.title1')}<br />{t('features.title2')}</h3><p>{t('features.lead')}</p><div className={s.agendaBenefits}>{([[CalendarDays, 'b1'], [Users, 'b2'], [Bell, 'b3']] as const).map(([BenefitIcon, key]) => <div key={key}><span><BenefitIcon size={20} /></span><p><strong>{t(`features.${key}Title`)}</strong><small>{t(`features.${key}Text`)}</small></p></div>)}</div><a href="#telecharger" className={s.textLink}>{t('features.download')} <ArrowRight size={18} /></a></div>
      <div className={s.realAgendaScene}><button onClick={() => setExpanded(true)} className={s.agendaCapture} aria-label={t('features.agendaEnlarge')}><Capture file="agenda-equipe" alt={t('screens.equipe.alt')} /></button><span>{t('features.agendaCaption')}</span></div>
    </article>
    {expanded && <CaptureViewer file="agenda-equipe" title={t('features.agendaTitle')} onClose={() => setExpanded(false)} />}
  </div>;
}

export function ProductGallery() {
  const t = useTranslations('landing');
  const { ref, active } = useMotion();
  const [expanded, setExpanded] = useState(false);
  const [view, setView] = useState<'client' | 'pro'>('client');
  const [step, setStep] = useState(0);
  const [proStep, setProStep] = useState(0);
  // Le parcours se joue tout seul, comme une démo : une étape toutes les
  // 4 s tant que la section est visible. Un geste du visiteur (étape,
  // suivant, agrandir, côté pro) reprend la main et arrête le défilement —
  // rien de pire qu'un écran qui change sous le doigt.
  const [auto, setAuto] = useState(true);
  const screen = view === 'client' ? clientScreens[step] : proScreens[proStep];
  const titre = t(`screens.${screen.key}.title`);
  const dernier = clientScreens.length - 1;
  const choisir = (index: number) => { setAuto(false); setStep(index); };
  const suivant = () => choisir(step === dernier ? 0 : step + 1);
  const precedent = () => choisir(step === 0 ? dernier : step - 1);
  useEffect(() => {
    if (!auto || !active || view !== 'client' || expanded) return;
    const id = setTimeout(() => setStep(value => (value + 1) % clientScreens.length), 4000);
    return () => clearTimeout(id);
  }, [auto, active, view, expanded, step]);
  // Trois blocs et non deux : sur mobile, les sélecteurs d'étape doivent
  // tomber SOUS la capture. Empilés dans le bloc de texte, ils occupaient
  // tout l'écran et on ne voyait pas que l'image changeait plus bas.
  // Sur grand écran, la grille les remet dans la colonne de gauche.
  return <div className={s.demo} data-reveal data-auto={auto && active && view === 'client'} ref={ref}>
    <div className={s.demoIntro}>
      <span className={s.demoNumber}>{t('gallery.eyebrow')}</span>
      <h3>{view === 'client' ? t('gallery.clientTitle') : t('gallery.proTitle')}</h3>
      <p>{view === 'client' ? t('gallery.clientLead') : t('gallery.proLead')}</p>
      <div className={s.demoChoices} role="group" aria-label={t('gallery.sideAria')}>
        <button aria-pressed={view === 'client'} onClick={() => setView('client')}><Globe size={19} /><span>{t('gallery.clientSide')}</span><ArrowRight size={18} /></button>
        <button aria-pressed={view === 'pro'} onClick={() => { setAuto(false); setView('pro'); }}><Smartphone size={19} /><span>{t('gallery.proSide')}</span><ArrowRight size={18} /></button>
      </div>
    </div>
    <div className={s.demoSteps}>
      {view === 'client'
        ? <>
          <div className={s.stepNav}>
            <button type="button" onClick={precedent} aria-label={t('gallery.prevStep')}><ArrowLeft size={18} /></button>
            <div className={s.stepProgress} role="group" aria-label={t('gallery.stepsAria')}>
              {clientScreens.map((item, index) => <button key={item.file} type="button" aria-label={t('gallery.stepAria', { n: index + 1, title: t(`screens.${item.key}.title`) })} aria-pressed={step === index} data-done={index < step} onClick={() => choisir(index)}><span /></button>)}
            </div>
            <span className={s.stepCount} aria-live="polite">{t('gallery.stepCount', { n: step + 1, total: clientScreens.length })}</span>
            <button type="button" className={s.stepNext} onClick={suivant}>{step === dernier ? t('gallery.replay') : t('gallery.next')} <ArrowRight size={17} /></button>
          </div>
          <div className={s.captureSteps} role="group" aria-label={t('gallery.jumpAria')}>{clientScreens.map((item, index) => <button key={item.file} type="button" aria-pressed={step === index} onClick={() => choisir(index)}><span>0{index + 1}</span>{t(`screens.${item.key}.title`)}</button>)}</div>
        </>
        : <div className={`${s.captureSteps} ${s.captureStepsPair}`} role="group" aria-label={t('gallery.sizeAria')}>{proScreens.map((item, index) => <button key={item.file} type="button" aria-pressed={proStep === index} onClick={() => setProStep(index)}>{t(`screens.${item.key}.title`)}</button>)}</div>}
      <p className={s.screenDescription} aria-live="polite">{t(`screens.${screen.key}.description`)}</p>
      <a className={s.textLink} href="https://opatam.com/p/braidztouch-1" target="_blank" rel="noopener noreferrer">{t('gallery.seePage')} <ArrowUpRight size={18} /></a>
      <p className={s.captureNote}>{t('gallery.note')}</p>
    </div>
    <figure className={s.galleryStage}>
      <div className={s.galleryLabel}>{view === 'client' ? t('gallery.clientLabel') : t('gallery.proLabel')}<span>{t('gallery.app')}</span></div>
      <button key={screen.file} onClick={() => { setAuto(false); setExpanded(true); }} className={s.galleryCapture} aria-label={t('gallery.enlargeAria', { title: titre })}><Capture file={screen.file} alt={t(`screens.${screen.key}.alt`)} /></button>
      <figcaption><strong>{titre}</strong><button onClick={() => { setAuto(false); setExpanded(true); }}>{t('gallery.enlarge')} <ArrowUpRight size={14} /></button></figcaption>
    </figure>
    {expanded && <CaptureViewer file={screen.file} title={titre} onClose={() => setExpanded(false)} />}
  </div>;
}
