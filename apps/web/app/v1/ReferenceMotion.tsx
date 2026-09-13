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

// Original screenshots supplied by Opatam; keep their pixels and full aspect ratio.
const clientScreens = [
  { file: 'profil', title: 'Votre vitrine', alt: 'Profil Cam Beauty Studio dans l’application Opatam', description: 'Votre univers, vos photos et vos avis, réunis sur votre profil.' },
  { file: 'prestations', title: 'Les prestations', alt: 'Liste des prestations et tarifs de Cam Beauty Studio dans Opatam', description: 'Des prestations détaillées, avec leurs tarifs et leur durée.' },
  { file: 'creneaux', title: 'Les disponibilités', alt: 'Sélection d’une date et d’un horaire dans l’application Opatam', description: 'Vos clients choisissent une date et un horaire parmi les disponibilités proposées.' },
  { file: 'acompte', title: 'L’acompte', alt: 'Saisie d’une carte bancaire pour régler un acompte dans Opatam', description: 'Si vous activez les acomptes, le paiement fait partie du parcours. Cet écran montre la saisie de la carte, avant le paiement.' },
];
const agendaScreen = { file: 'agenda-jour', title: 'Votre agenda pro', alt: 'Véritable agenda professionnel Opatam en vue journée', description: 'Votre journée, vos rendez-vous et les plannings de votre équipe, dans la même application.' };

function Capture({ file, alt, priority = false }: { file: string; alt: string; priority?: boolean }) {
  return <Image src={`/v1/captures/${file}.jpg`} alt={alt} width={file === 'agenda-jour' ? 1206 : 1290} height={file === 'agenda-jour' ? 2622 : 2796} sizes="(max-width: 600px) 280px, 320px" priority={priority} className={s.captureImage} />;
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
    <p className={s.captureCredit}>Dans l’app Opatam · Cam Beauty Studio</p>
  </div>;
}

export function FeatureScenes() {
  const [expanded, setExpanded] = useState(false);
  return <div className={s.featureScenes}>
    <article className={s.sceneRow} data-reveal>
      <div><p className={s.eyebrow}>VOTRE APPLICATION PRO</p><h3>Votre journée.<br />En un coup d’œil.</h3><p>Les réservations arrivent en ligne. Vous retrouvez une organisation claire, sans passer votre journée à jongler entre les messages.</p><div className={s.agendaBenefits}>{[[CalendarDays, "Un agenda qui s’adapte", "Jour, semaine ou mois : choisissez la vue qui vous aide à organiser votre activité."], [Users, "Votre équipe, au même endroit", "Filtrez par membre et par catégorie pour voir les rendez-vous qui vous concernent."], [Bell, "Les rappels, sans y penser", "Les rappels automatiques par email et notification accompagnent vos clients avant leur rendez-vous."]].map(([Icon, title, text]) => { const BenefitIcon = Icon as typeof CalendarDays; return <div key={String(title)}><span><BenefitIcon size={20} /></span><p><strong>{String(title)}</strong><small>{String(text)}</small></p></div>; })}</div><a href="#telecharger" className={s.textLink}>Télécharger l’application <ArrowRight size={18} /></a></div>
      <div className={s.realAgendaScene}><button onClick={() => setExpanded(true)} className={s.agendaCapture} aria-label="Agrandir la capture de l’agenda pro"><Capture file="agenda-jour" alt={agendaScreen.alt} /></button><span>Vue journée · Application professionnelle</span></div>
    </article>
    {expanded && <CaptureViewer file="agenda-jour" title={agendaScreen.title} onClose={() => setExpanded(false)} />}
  </div>;
}

export function ProductGallery() {
  const [expanded, setExpanded] = useState(false);
  const [view, setView] = useState<'client' | 'pro'>('client');
  const [step, setStep] = useState(0);
  const screen = view === 'client' ? clientScreens[step] : agendaScreen;
  return <div className={s.demo} data-reveal>
    <div className={s.demoInfo}>
      <span className={s.demoNumber}>VOTRE ACTIVITÉ, DES DEUX CÔTÉS</span>
      <h3>{view === 'client' ? 'Votre univers. Leur prochain rendez-vous.' : 'Tout votre planning. À portée de main.'}</h3>
      <p>{view === 'client' ? 'Un profil à votre image et un parcours guidé pour choisir une prestation, une date et un horaire.' : agendaScreen.description}</p>
      <div className={s.demoChoices} role="group" aria-label="Choisir le côté du produit">
        <button aria-pressed={view === 'client'} onClick={() => setView('client')}><Globe size={19} /><span>Le parcours client</span><ArrowRight size={18} /></button>
        <button aria-pressed={view === 'pro'} onClick={() => setView('pro')}><Smartphone size={19} /><span>L’application pro</span><ArrowRight size={18} /></button>
      </div>
      {view === 'client' && <div className={s.captureSteps} role="group" aria-label="Étapes du parcours client">{clientScreens.map((item, index) => <button key={item.file} aria-pressed={step === index} onClick={() => setStep(index)}><span>0{index + 1}</span>{item.title}</button>)}</div>}
      <p className={s.screenDescription} aria-live="polite">{screen.description}</p>
      <a className={s.textLink} href="https://opatam.com/p/cam-beauty-studio" target="_blank" rel="noopener noreferrer">Voir sa page web en ligne <ArrowUpRight size={18} /></a>
      <p className={s.captureNote}>Captures de l’application Opatam. Le lien ouvre la vraie page web de Cam Beauty Studio.</p>
    </div>
    <figure className={s.galleryStage}>
      <div className={s.galleryLabel}>{view === 'client' ? 'CÔTÉ CLIENT' : 'CÔTÉ PRO'}<span>APP OPATAM</span></div>
      <button key={screen.file} onClick={() => setExpanded(true)} className={s.galleryCapture} aria-label={`Agrandir : ${screen.title}`}><Capture file={screen.file} alt={screen.alt} /></button>
      <figcaption><strong>{screen.title}</strong><button onClick={() => setExpanded(true)}>Agrandir <ArrowUpRight size={14} /></button></figcaption>
    </figure>
    {expanded && <CaptureViewer file={screen.file} title={screen.title} onClose={() => setExpanded(false)} />}
  </div>;
}
