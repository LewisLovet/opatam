'use client';

import Image from 'next/image';
import { useEffect, useRef, useState } from 'react';
import { ArrowRight, ArrowUpRight, Bell, CalendarDays, Globe, Smartphone, Users } from 'lucide-react';
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
const clientScreens = [
  { file: 'vitrine', title: 'Votre vitrine', alt: 'Page Braidztouch dans l’application Opatam : photo, avis et carte de fidélité', description: 'Votre univers, vos photos, vos avis et votre carte de fidélité, réunis sur votre page.' },
  { file: 'prestations', title: 'Les prestations', alt: 'Liste des prestations Braidztouch avec tarifs, durées et promotions', description: 'Vos prestations détaillées, avec leur durée, leur tarif et vos promotions en cours.' },
  { file: 'options', title: 'Les options', alt: 'Choix de la longueur et des options d’une prestation dans Opatam', description: 'Longueurs, variantes, options : le tarif et la durée se mettent à jour au fur et à mesure.' },
  { file: 'creneaux', title: 'La date', alt: 'Calendrier et horaires disponibles d’une prestation dans Opatam', description: 'Vos clients voient les jours complets et choisissent un horaire parmi ceux que vous laissez ouverts.' },
  { file: 'recapitulatif', title: 'Le récapitulatif', alt: 'Récapitulatif d’une réservation Opatam avant confirmation', description: 'Prestation, date, professionnel et lieu : tout est relu avant de confirmer.' },
  { file: 'acompte', title: 'L’acompte', alt: 'Choix du moyen de paiement pour régler un acompte dans Opatam', description: 'Si vous demandez un acompte, il se règle dans la foulée — carte, Apple Pay ou paiement en plusieurs fois.' },
];

// Côté pro, le même écran raconte deux métiers : l'indépendant qui voit sa
// journée, l'équipe qui voit toutes ses colonnes. D'où le sélecteur.
const proScreens = [
  { file: 'agenda-solo', title: 'En solo', alt: 'Agenda Opatam d’un professionnel seul, en vue journée', description: 'En solo, votre journée tient sur une colonne : vos rendez-vous, dans l’ordre, avec la prestation et le client.' },
  { file: 'agenda-equipe', title: 'En équipe', alt: 'Agenda Opatam d’une équipe, une colonne par membre en vue journée', description: 'En équipe, chaque membre a sa colonne. Filtrez par personne ou par catégorie pour ne voir que ce qui vous concerne.' },
];

function Capture({ file, alt, priority = false }: { file: string; alt: string; priority?: boolean }) {
  return <Image src={`/v1/captures/${file}.jpg`} alt={alt} width={1206} height={2622} sizes="(max-width: 600px) 280px, 320px" priority={priority} className={s.captureImage} />;
}

export function HeroMotion() {
  const { ref, active } = useMotion();
  const [step, setStep] = useState(0);
  const [paused, setPaused] = useState(false);
  const screens = clientScreens.slice(0, 3);
  useEffect(() => {
    if (!active || paused) return;
    const id = setTimeout(() => setStep(value => (value + 1) % 3), 5000);
    return () => clearTimeout(id);
  }, [active, paused, step]);

  return <div className={s.realHero} ref={ref} onMouseEnter={() => setPaused(true)} onMouseLeave={() => setPaused(false)} onBlurCapture={event => { if (!event.currentTarget.contains(event.relatedTarget)) setPaused(false); }} onFocusCapture={() => setPaused(true)} role="region" aria-label="Aperçu du parcours client dans l’application">
    <div className={s.captureFrame}>
      {screens.map((screen, index) => <div key={screen.file} className={s.captureSlide} data-active={step === index} aria-hidden={step !== index}>
        <Capture file={screen.file} alt={screen.alt} priority={index === 0} />
      </div>)}
    </div>
    <div className={s.captureControls}>
      <div role="group" aria-label="Choisir un écran">{screens.map((screen, index) => <button key={screen.file} aria-label={screen.title} aria-pressed={step === index} onClick={() => { setStep(index); setPaused(true); }}><span /></button>)}</div>
      <span>{screens[step].title}</span>
    </div>
    <p className={s.captureCredit}>Dans l’app Opatam · Braidztouch</p>
  </div>;
}

export function FeatureScenes() {
  const [expanded, setExpanded] = useState(false);
  return <div className={s.featureScenes}>
    <article className={s.sceneRow} data-reveal>
      <div><p className={s.eyebrow}>VOTRE APPLICATION PRO</p><h3>Votre journée.<br />En un coup d’œil.</h3><p>Les réservations arrivent en ligne. Vous retrouvez une organisation claire, sans passer votre journée à jongler entre les messages.</p><div className={s.agendaBenefits}>{[[CalendarDays, "Un agenda qui s’adapte", "Jour, semaine ou mois : choisissez la vue qui vous aide à organiser votre activité."], [Users, "Votre équipe, au même endroit", "Filtrez par membre et par catégorie pour voir les rendez-vous qui vous concernent."], [Bell, "Les rappels, sans y penser", "Les rappels automatiques par email et notification accompagnent vos clients avant leur rendez-vous."]].map(([Icon, title, text]) => { const BenefitIcon = Icon as typeof CalendarDays; return <div key={String(title)}><span><BenefitIcon size={20} /></span><p><strong>{String(title)}</strong><small>{String(text)}</small></p></div>; })}</div><a href="#telecharger" className={s.textLink}>Télécharger l’application <ArrowRight size={18} /></a></div>
      <div className={s.realAgendaScene}><button onClick={() => setExpanded(true)} className={s.agendaCapture} aria-label="Agrandir la capture de l’agenda pro"><Capture file="agenda-equipe" alt={proScreens[1].alt} /></button><span>Vue journée · Application professionnelle</span></div>
    </article>
    {expanded && <CaptureViewer file="agenda-equipe" title="Votre agenda pro" onClose={() => setExpanded(false)} />}
  </div>;
}

export function ProductGallery() {
  const [expanded, setExpanded] = useState(false);
  const [view, setView] = useState<'client' | 'pro'>('client');
  const [step, setStep] = useState(0);
  const [proStep, setProStep] = useState(0);
  const screen = view === 'client' ? clientScreens[step] : proScreens[proStep];
  return <div className={s.demo} data-reveal>
    <div className={s.demoInfo}>
      <span className={s.demoNumber}>VOTRE ACTIVITÉ, DES DEUX CÔTÉS</span>
      <h3>{view === 'client' ? 'Votre univers. Leur prochain rendez-vous.' : 'Tout votre planning. À portée de main.'}</h3>
      <p>{view === 'client' ? 'Une page à votre image et un parcours guidé, de la prestation au paiement de l’acompte.' : 'Le même agenda, que vous travailliez seul ou à plusieurs.'}</p>
      <div className={s.demoChoices} role="group" aria-label="Choisir le côté du produit">
        <button aria-pressed={view === 'client'} onClick={() => setView('client')}><Globe size={19} /><span>Le parcours client</span><ArrowRight size={18} /></button>
        <button aria-pressed={view === 'pro'} onClick={() => setView('pro')}><Smartphone size={19} /><span>L’application pro</span><ArrowRight size={18} /></button>
      </div>
      {view === 'client'
        ? <div className={s.captureSteps} role="group" aria-label="Étapes du parcours client">{clientScreens.map((item, index) => <button key={item.file} aria-pressed={step === index} onClick={() => setStep(index)}><span>0{index + 1}</span>{item.title}</button>)}</div>
        : <div className={s.captureSteps} role="group" aria-label="Taille de l’activité">{proScreens.map((item, index) => <button key={item.file} aria-pressed={proStep === index} onClick={() => setProStep(index)}>{item.title}</button>)}</div>}
      <p className={s.screenDescription} aria-live="polite">{screen.description}</p>
      <a className={s.textLink} href="https://opatam.com/p/braidztouch-1" target="_blank" rel="noopener noreferrer">Voir sa page web en ligne <ArrowUpRight size={18} /></a>
      <p className={s.captureNote}>Captures de l’application Opatam. Le lien ouvre la vraie page web de Braidztouch.</p>
    </div>
    <figure className={s.galleryStage}>
      <div className={s.galleryLabel}>{view === 'client' ? 'CÔTÉ CLIENT' : 'CÔTÉ PRO'}<span>APP OPATAM</span></div>
      <button key={screen.file} onClick={() => setExpanded(true)} className={s.galleryCapture} aria-label={`Agrandir : ${screen.title}`}><Capture file={screen.file} alt={screen.alt} /></button>
      <figcaption><strong>{screen.title}</strong><button onClick={() => setExpanded(true)}>Agrandir <ArrowUpRight size={14} /></button></figcaption>
    </figure>
    {expanded && <CaptureViewer file={screen.file} title={screen.title} onClose={() => setExpanded(false)} />}
  </div>;
}
