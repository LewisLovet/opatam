'use client';

import Image from 'next/image';
import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { ArrowRight, Maximize2 } from 'lucide-react';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/Tabs';
import { CaptureViewer } from './CaptureViewer';
import s from './v1.module.css';

type StoryScreen = { src?: string };
// `key` : entrée du dictionnaire landing.stories.<key> (label, title,
// description, screen1, screen2) — les textes ne vivent plus ici.
type StoryCategory = { id: string; key: string; screens: [StoryScreen, StoryScreen] };

// Only original, available captures are shown. Populate the remaining pairs
// when the user supplies them; never relabel availability images as other UI.
const categories: StoryCategory[] = [
  { id: 'dispos', key: 'dispos', screens: [{ src: '/instagram-story-jour.png' }, { src: '/instagram-story-semaine.png' }] },
  { id: 'prestations', key: 'prestations', screens: [{}, {}] },
  { id: 'realisations', key: 'realisations', screens: [{}, {}] },
  { id: 'avant-apres', key: 'avantApres', screens: [{}, {}] },
  { id: 'avis', key: 'avis', screens: [{}, {}] },
  { id: 'fidelite', key: 'fidelite', screens: [{}, {}] },
  { id: 'page', key: 'page', screens: [{}, {}] },
];

// Seules les catégories dont les DEUX captures existent sont montrées. Les
// autres affichaient au visiteur un cadre gris « Capture originale à
// intégrer » : six onglets sur sept étaient vides. Poser la capture dans la
// liste ci-dessus suffit à faire réapparaître l'onglet.
const visibles = categories.filter((category) => category.screens.every((screen) => screen.src));

// Inclinaison qui suit la souris : ±7° selon la position du pointeur sur le
// téléphone, et un reflet qui se déplace avec lui. Tout passe par des
// variables CSS lues par .storyPreviewButton — aucun rendu React par
// mouvement, seulement le style de l'élément touché.
function incliner(event: React.PointerEvent<HTMLButtonElement>) {
  const el = event.currentTarget;
  const r = el.getBoundingClientRect();
  const x = (event.clientX - r.left) / r.width;
  const y = (event.clientY - r.top) / r.height;
  el.style.setProperty('--ry', `${((x - 0.5) * 14).toFixed(2)}deg`);
  el.style.setProperty('--rx', `${((0.5 - y) * 14).toFixed(2)}deg`);
  el.style.setProperty('--mx', `${(x * 100).toFixed(1)}%`);
  el.style.setProperty('--my', `${(y * 100).toFixed(1)}%`);
  el.style.setProperty('--lift', '-8px');
}
function redresser(event: React.PointerEvent<HTMLButtonElement>) {
  const el = event.currentTarget;
  ['--rx', '--ry', '--lift'].forEach(v => el.style.removeProperty(v));
}

export function StoriesSection() {
  const t = useTranslations('landing.stories');
  const [selected, setSelected] = useState(visibles[0]?.id ?? '');
  const [expanded, setExpanded] = useState<{ src: string; title: string } | null>(null);
  if (!visibles.length) return null;
  return <section id="stories" className={s.socialSection}>
    <div className={s.wrap}>
      <div className={s.socialHeading} data-reveal><p className={s.eyebrow}>{t('eyebrow')}</p><h2>{t('title1')}<br /><em>{t('title2')}</em></h2><p>{t('lead')}</p></div>
      <Tabs defaultValue={visibles[0].id} value={selected} onValueChange={setSelected}>
        <TabsList className={s.socialTabs} aria-label={t('tabsAria')} onKeyDown={event => {
          const keys = ['ArrowRight', 'ArrowLeft', 'Home', 'End'];
          if (!keys.includes(event.key)) return;
          event.preventDefault();
          const index = visibles.findIndex(category => category.id === selected);
          const next = event.key === 'Home' ? 0 : event.key === 'End' ? visibles.length - 1 : (index + (event.key === 'ArrowRight' ? 1 : -1) + visibles.length) % visibles.length;
          setSelected(visibles[next].id);
          document.getElementById(`story-tab-${visibles[next].id}`)?.focus();
        }}>{visibles.map(category => <TabsTrigger key={category.id} value={category.id} id={`story-tab-${category.id}`} aria-controls={`story-panel-${category.id}`} tabIndex={selected === category.id ? 0 : -1} className={s.socialTab}>{t(`${category.key}.label`)}</TabsTrigger>)}</TabsList>
        {visibles.map(category => <TabsContent key={category.id} value={category.id} id={`story-panel-${category.id}`} aria-labelledby={`story-tab-${category.id}`} className={s.socialPanel}>
          <div className={s.storyPitch}><span className={s.socialCategory}>{t(`${category.key}.label`)}</span><h3>{t(`${category.key}.title`)}</h3><p>{t(`${category.key}.description`)}</p><a href="#telecharger" className={s.primary}>{t('cta')} <ArrowRight size={18} /></a><small>{t('small')}</small></div>
          <div className={s.storyPair}>{category.screens.map((screen, index) => { const title = t(`${category.key}.screen${index + 1}`); return <figure key={`${category.id}-${index}`}>
            <button className={s.storyPreviewButton} onClick={() => setExpanded({ src: screen.src!, title })} onPointerMove={incliner} onPointerLeave={redresser} aria-label={t('enlargeAria', { title })}><Image src={screen.src!} alt={t('alt', { title })} width={540} height={960} sizes="(max-width: 600px) 43vw, 270px" /><span><Maximize2 size={17} /></span></button>
            <figcaption>{title}</figcaption>
          </figure>; })}</div>
        </TabsContent>)}
      </Tabs>
    </div>
    {expanded && <CaptureViewer src={expanded.src} title={expanded.title} onClose={() => setExpanded(null)} />}
  </section>;
}
